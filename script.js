/* ================================================================
   💌 Memory Letter Box — สคริปต์หลัก
   จดหมายมาจาก 2 ทาง: จดหมายตั้งต้นใน letters.js + จดหมายที่คนเขียน
   ผ่านหน้าเว็บ (เก็บด้วย storage.js — โหมด cloud หรือ local)
   ================================================================ */

"use strict";

const STORAGE_KEY = "mlb_save_v2";
const SOUND_KEY = "mlb_sound_v1";

/* ---------- อ้างอิง DOM ---------- */
const $ = (id) => document.getElementById(id);

const el = {
  mailbox: $("mailbox"),
  glowRing: $("glow-ring"),
  sparkles: $("sparkles"),
  btnDraw: $("btn-draw"),
  btnWrite: $("btn-write"),
  progress: $("progress-text"),
  modeNote: $("mode-note"),

  sceneEnvelope: $("scene-envelope"),
  envelope: $("envelope"),
  envelopeHint: $("envelope-hint"),

  sceneLetter: $("scene-letter"),
  letterTitle: $("letter-title"),
  letterMessage: $("letter-message"),
  letterImage: $("letter-image"),
  letterSender: $("letter-sender"),
  btnCloseLetter: $("btn-close-letter"),

  sceneCollection: $("scene-collection"),
  collectionGrid: $("collection-grid"),
  collectionSub: $("collection-sub"),
  btnCollection: $("btn-collection"),
  btnCloseCollection: $("btn-close-collection"),
  btnReset: $("btn-reset"),

  sceneLock: $("scene-lock"),
  lockPass: $("lock-pass"),
  lockError: $("lock-error"),
  btnUnlock: $("btn-unlock"),
  btnCloseLock: $("btn-close-lock"),

  sceneWrite: $("scene-write"),
  wSender: $("w-sender"),
  wTitle: $("w-title"),
  wMessage: $("w-message"),
  writeError: $("write-error"),
  btnSubmitLetter: $("btn-submit-letter"),
  btnCloseWrite: $("btn-close-write"),

  btnSound: $("btn-sound"),
  bgHearts: $("bg-hearts"),
  confettiLayer: $("confetti-layer"),
  toast: $("toast"),
};

/* ================================================================
   สถานะเกม (อิงด้วย id ของจดหมาย เพราะจำนวนจดหมายเปลี่ยนได้ตลอด)
   - allLetters : จดหมายทั้งหมดที่โหลดมา
   - opened     : id ที่เคยเปิดแล้ว (สมุดสะสม)
   - pool       : id ที่ยังไม่ถูกสุ่มในรอบนี้ (สุ่มไม่ซ้ำ)
   ================================================================ */
let allLetters = [];
let state = { opened: [], pool: [] };
let currentLetter = null;  // จดหมายที่กำลังเปิดอยู่ (null = อ่านย้อนหลัง)
let typingTimer = null;
let fullMessage = "";
let isBusy = false;
let isLocked = false;      // โหมด cloud: ต้องใส่รหัสตู้ก่อนถึงจะอ่านได้
let subscribed = false;    // กันสมัคร realtime listener ซ้ำ

function loadState() {
  try {
    const s = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (s && Array.isArray(s.opened) && Array.isArray(s.pool)) return s;
  } catch (e) { /* save เสีย → เริ่มใหม่ */ }
  return { opened: [], pool: [] };
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) { /* ไม่มี storage ก็เล่นต่อได้ แค่ไม่จำ */ }
}

/* จัดระเบียบ state ให้ตรงกับจดหมายที่มีอยู่จริงตอนนี้ */
function syncStateWithLetters() {
  const ids = allLetters.map((l) => l.id);
  state.opened = state.opened.filter((id) => ids.includes(id));
  state.pool = state.pool.filter((id) => ids.includes(id));
  // จดหมายใหม่ที่ยังไม่เคยเปิดและยังไม่อยู่ใน pool → เพิ่มเข้า pool
  ids.forEach((id) => {
    if (!state.opened.includes(id) && !state.pool.includes(id)) state.pool.push(id);
  });
  saveState();
}

/* ================================================================
   ระบบเสียง (สังเคราะห์ด้วย Web Audio API — ไม่ต้องมีไฟล์เสียง)
   ================================================================ */
const SoundFX = {
  ctx: null,
  enabled: localStorage.getItem(SOUND_KEY) !== "off",

  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) this.ctx = new AC();
    }
    if (this.ctx && this.ctx.state === "suspended") this.ctx.resume();
    return this.ctx;
  },

  tone(freq, start, dur, type = "sine", vol = 0.18) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, ctx.currentTime + start);
    gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(ctx.currentTime + start);
    osc.stop(ctx.currentTime + start + dur + 0.05);
  },

  noise(start, dur, vol = 0.12) {
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 1200;
    const gain = ctx.createGain();
    gain.gain.value = vol;
    src.connect(filter).connect(gain).connect(ctx.destination);
    src.start(ctx.currentTime + start);
  },

  /* เสียงตอนกดสุ่ม: วิ้ง ๆ ไต่ขึ้น */
  draw() {
    if (!this.enabled || !this.ensure()) return;
    [523, 659, 784, 1047].forEach((f, i) => this.tone(f, i * 0.09, 0.22, "triangle", 0.14));
    this.noise(0, 0.3, 0.05);
  },

  /* เสียงเปิดซอง: กระดาษ + ป๊อป */
  open() {
    if (!this.enabled || !this.ensure()) return;
    this.noise(0, 0.22, 0.14);
    this.tone(880, 0.12, 0.15, "sine", 0.15);
    this.tone(1318, 0.2, 0.3, "sine", 0.12);
  },

  /* เสียงฉลองตอนอ่านจบ / ส่งจดหมายสำเร็จ */
  fanfare() {
    if (!this.enabled || !this.ensure()) return;
    [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, i * 0.11, 0.35, "triangle", 0.13));
  },

  /* ติ๊ก ๆ ตอนพิมพ์ */
  tick() {
    if (!this.enabled || !this.ctx) return;
    this.tone(1900 + Math.random() * 300, 0, 0.03, "square", 0.015);
  },

  toggle() {
    this.enabled = !this.enabled;
    localStorage.setItem(SOUND_KEY, this.enabled ? "on" : "off");
    if (this.enabled) this.ensure();
    updateSoundBtn();
  },
};

function updateSoundBtn() {
  el.btnSound.textContent = SoundFX.enabled ? "🔊" : "🔇";
  el.btnSound.title = SoundFX.enabled ? "ปิดเสียง" : "เปิดเสียง";
}

/* ================================================================
   เอฟเฟกต์: ประกาย / คอนเฟตติ / หัวใจลอย / toast
   ================================================================ */
function burstSparkles() {
  const icons = ["✨", "⭐", "💖", "✨", "🌟"];
  for (let i = 0; i < 12; i++) {
    const s = document.createElement("span");
    s.className = "sparkle";
    s.textContent = icons[i % icons.length];
    s.style.left = 20 + Math.random() * 60 + "%";
    s.style.top = 15 + Math.random() * 55 + "%";
    s.style.animationDelay = Math.random() * 0.5 + "s";
    el.sparkles.appendChild(s);
    setTimeout(() => s.remove(), 1600);
  }
}

function burstConfetti(count = 60) {
  const colors = ["#ff9db8", "#f76d8e", "#e94f5f", "#ffd6e0", "#fff6ec", "#ffc4d1"];
  for (let i = 0; i < count; i++) {
    const c = document.createElement("span");
    c.className = "confetti";
    c.style.left = Math.random() * 100 + "vw";
    c.style.background = colors[Math.floor(Math.random() * colors.length)];
    c.style.animationDuration = 1.8 + Math.random() * 1.6 + "s";
    c.style.animationDelay = Math.random() * 0.4 + "s";
    c.style.transform = `rotate(${Math.random() * 360}deg)`;
    if (Math.random() < 0.3) c.style.borderRadius = "50%";
    el.confettiLayer.appendChild(c);
    setTimeout(() => c.remove(), 4200);
  }
}

function burstHearts(count = 10) {
  const icons = ["💗", "💕", "❤️", "💘", "🩷"];
  for (let i = 0; i < count; i++) {
    spawnHeart(icons[i % icons.length], 2.4 + Math.random() * 1.6);
  }
}

function spawnHeart(icon, dur) {
  const h = document.createElement("span");
  h.className = "float-heart";
  h.textContent = icon;
  h.style.left = Math.random() * 96 + "vw";
  h.style.fontSize = 14 + Math.random() * 22 + "px";
  h.style.animationDuration = dur + "s";
  el.bgHearts.appendChild(h);
  setTimeout(() => h.remove(), dur * 1000 + 200);
}

/* หัวใจลอยเบา ๆ ตลอดเวลาเป็นบรรยากาศ */
setInterval(() => {
  if (Math.random() < 0.55) spawnHeart(["🤍", "🩷", "💗"][Math.floor(Math.random() * 3)], 6 + Math.random() * 4);
}, 1800);

let toastTimer = null;
function showToast(msg) {
  el.toast.textContent = msg;
  el.toast.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.toast.classList.add("hidden"), 3200);
}

/* ================================================================
   ระบบสุ่มแบบไม่ซ้ำ
   ================================================================ */
function drawRandomLetter() {
  if (state.pool.length === 0) {
    state.pool = allLetters.map((l) => l.id); // เปิดครบทุกฉบับ → เริ่มรอบใหม่
  }
  const at = Math.floor(Math.random() * state.pool.length);
  const id = state.pool.splice(at, 1)[0];
  saveState();
  return allLetters.find((l) => l.id === id) || null;
}

function updateProgress() {
  el.progress.textContent = `เปิดแล้ว ${state.opened.length} / ${allLetters.length} ฉบับ`;
}

/* ================================================================
   ลำดับการสุ่ม: สั่น → แสง → ซองลอยออกมา
   ================================================================ */
function startDraw() {
  if (isLocked) { openLock(); return; }
  if (isBusy || allLetters.length === 0) return;
  isBusy = true;

  currentLetter = drawRandomLetter();
  if (!currentLetter) { isBusy = false; return; }

  SoundFX.draw();
  el.mailbox.classList.add("shaking");
  el.glowRing.classList.add("active");
  burstSparkles();

  setTimeout(() => burstSparkles(), 600);

  setTimeout(() => {
    el.mailbox.classList.remove("shaking");
    el.glowRing.classList.remove("active");
    showEnvelope();
  }, 1400);
}

function showEnvelope() {
  el.envelope.classList.remove("opening", "leaving");
  el.envelopeHint.style.opacity = "1";
  el.sceneEnvelope.classList.remove("hidden");
  isBusy = false;
}

/* ================================================================
   เปิดซอง → กระดาษคลี่ → typewriter
   ================================================================ */
function openEnvelope() {
  if (isBusy || !currentLetter) return;
  isBusy = true;

  SoundFX.open();
  el.envelope.classList.add("opening");
  el.envelopeHint.style.opacity = "0";
  burstHearts(8);

  setTimeout(() => {
    el.envelope.classList.add("leaving");
  }, 750);

  setTimeout(() => {
    el.sceneEnvelope.classList.add("hidden");
    showLetter(currentLetter, true);
  }, 1150);
}

function showLetter(letter, withTypewriter) {
  if (!letter) { isBusy = false; return; }

  el.letterTitle.textContent = letter.title || "จดหมายไร้ชื่อ";
  el.letterSender.textContent = `— จาก ${letter.sender || "ใครบางคน"} —`;
  el.letterSender.classList.remove("show");
  el.btnCloseLetter.classList.remove("show");
  el.letterMessage.textContent = "";

  // รูปภาพ (ถ้ามี — เฉพาะจดหมายตั้งต้นใน letters.js)
  el.letterImage.classList.add("hidden");
  el.letterImage.removeAttribute("src");
  if (letter.image) {
    el.letterImage.onerror = () => el.letterImage.classList.add("hidden");
    el.letterImage.onload = () => el.letterImage.classList.remove("hidden");
    el.letterImage.src = letter.image;
  }

  el.sceneLetter.classList.remove("hidden");
  // รีสตาร์ตแอนิเมชันกระดาษคลี่
  const paper = $("letter-paper");
  paper.style.animation = "none";
  void paper.offsetWidth;
  paper.style.animation = "";

  fullMessage = letter.message || "";

  if (withTypewriter) {
    setTimeout(() => typeMessage(fullMessage), 650);
  } else {
    finishTyping(false);
  }
}

function typeMessage(text) {
  clearInterval(typingTimer);
  let i = 0;
  el.letterMessage.classList.add("typing");
  typingTimer = setInterval(() => {
    i++;
    el.letterMessage.textContent = text.slice(0, i);
    if (text[i - 1] && text[i - 1] !== " " && text[i - 1] !== "\n") SoundFX.tick();
    if (i >= text.length) finishTyping(true);
  }, 45);
}

function finishTyping(celebrate) {
  clearInterval(typingTimer);
  typingTimer = null;
  el.letterMessage.textContent = fullMessage;
  el.letterMessage.classList.remove("typing");
  el.letterSender.classList.add("show");
  el.btnCloseLetter.classList.add("show");
  isBusy = false;

  if (celebrate) {
    SoundFX.fanfare();
    burstConfetti();
    burstHearts(12);
  }
}

/* แตะกระดาษระหว่างพิมพ์ = ข้ามไปแสดงทั้งหมด */
el.sceneLetter.addEventListener("click", (e) => {
  if (typingTimer && !e.target.closest("button")) finishTyping(true);
});

function closeLetter() {
  clearInterval(typingTimer);
  typingTimer = null;

  // บันทึกเข้าสมุดสะสม (ถ้ามาจากการสุ่ม และยังไม่เคยเก็บ)
  if (currentLetter && !state.opened.includes(currentLetter.id)) {
    state.opened.push(currentLetter.id);
    saveState();
  }
  currentLetter = null;

  el.sceneLetter.classList.add("hidden");
  updateProgress();
  isBusy = false;
}

/* ================================================================
   สมุดสะสม
   ================================================================ */
function renderCollection() {
  el.collectionGrid.innerHTML = "";
  el.collectionSub.textContent = `สะสมแล้ว ${state.opened.length} / ${allLetters.length} ฉบับ`;

  if (allLetters.length === 0) {
    el.collectionGrid.innerHTML = `<p class="collection-empty">ยังไม่มีจดหมายในตู้เลย<br>เป็นคนแรกที่เขียนสิ! ✍️</p>`;
    return;
  }

  allLetters.forEach((letter) => {
    const isOpened = state.opened.includes(letter.id);
    const card = document.createElement("button");

    if (isOpened) {
      card.className = "collection-card";
      card.innerHTML = `
        <span class="cc-emoji">💌</span>
        <div class="cc-title"></div>
        <div class="cc-sender"></div>`;
      card.querySelector(".cc-title").textContent = letter.title || "จดหมายไร้ชื่อ";
      card.querySelector(".cc-sender").textContent = `จาก ${letter.sender || "ใครบางคน"}`;
      card.addEventListener("click", () => {
        el.sceneCollection.classList.add("hidden");
        currentLetter = null; // อ่านย้อนหลัง ไม่นับซ้ำ
        SoundFX.open();
        showLetter(letter, false);
      });
    } else {
      card.className = "collection-card locked";
      card.disabled = true;
      card.innerHTML = `
        <span class="cc-emoji">✉️</span>
        <div class="cc-title">? ? ?</div>
        <div class="cc-sender">ยังไม่ถูกเปิด</div>`;
    }
    el.collectionGrid.appendChild(card);
  });
}

function openCollection() {
  if (isLocked) { openLock(); return; }
  renderCollection();
  el.sceneCollection.classList.remove("hidden");
}

/* ================================================================
   รหัสตู้ (โหมด cloud): ใส่รหัสก่อนสุ่มเปิดอ่าน
   ================================================================ */
function openLock() {
  el.lockError.classList.add("hidden");
  el.sceneLock.classList.remove("hidden");
  setTimeout(() => el.lockPass.focus(), 100);
}

function closeLock() {
  el.sceneLock.classList.add("hidden");
}

async function submitUnlock() {
  const pass = el.lockPass.value;
  if (!pass) {
    el.lockError.textContent = "ใส่รหัสก่อนนะ";
    el.lockError.classList.remove("hidden");
    return;
  }
  el.lockError.classList.add("hidden");
  el.btnUnlock.disabled = true;
  el.btnUnlock.textContent = "กำลังเปิดตู้...";

  try {
    const res = await window.LetterStore.unlock(pass);
    el.lockPass.value = "";
    closeLock();
    if (res.created) {
      alert("ตั้งรหัสนี้เป็นรหัสประจำตู้เรียบร้อย ✅ แชร์รหัสให้เฉพาะคนที่อยากให้อ่านนะ");
    }
    // watchAuth จะจัดการปลดล็อกหน้าจอ + เริ่ม realtime ให้เอง
  } catch (e) {
    el.lockError.textContent = e.message;
    el.lockError.classList.remove("hidden");
  }

  el.btnUnlock.disabled = false;
  el.btnUnlock.textContent = "เปิดตู้ 🔓";
}

function showLockedUI() {
  isLocked = true;
  el.btnDraw.disabled = false; // กดได้ แต่จะเด้งช่องใส่รหัสแทน
  el.progress.textContent = "🔒 ใส่รหัสของตู้เพื่อเปิดอ่าน — เขียนจดหมายได้เลยไม่ต้องใช้รหัส";
}

function resetCollection() {
  if (!confirm("ล้างสมุดสะสมทั้งหมด แล้วเริ่มสุ่มใหม่ตั้งแต่ต้น?")) return;
  state = { opened: [], pool: allLetters.map((l) => l.id) };
  saveState();
  updateProgress();
  renderCollection();
}

/* ================================================================
   เขียนจดหมาย
   ================================================================ */
function openWrite() {
  el.writeError.classList.add("hidden");
  el.sceneWrite.classList.remove("hidden");
  setTimeout(() => el.wSender.focus(), 100);
}

function closeWrite() {
  el.sceneWrite.classList.add("hidden");
}

async function submitLetter() {
  const sender = el.wSender.value.trim();
  const title = el.wTitle.value.trim();
  const message = el.wMessage.value.trim();

  if (!sender || !title || !message) {
    el.writeError.textContent = "กรอกให้ครบทั้งชื่อผู้ส่ง หัวข้อ และข้อความนะ 🙏";
    el.writeError.classList.remove("hidden");
    return;
  }
  el.writeError.classList.add("hidden");

  el.btnSubmitLetter.disabled = true;
  el.btnSubmitLetter.textContent = "กำลังหย่อนลงตู้...";

  try {
    const letter = await window.LetterStore.addLetter({ sender, title, message });
    // โหมด local ต้องอัปเดตเอง (โหมด cloud ตัว realtime listener จัดการให้)
    if (!window.LetterStore.subscribe) {
      allLetters.push(letter);
      state.pool.push(letter.id);
      saveState();
      updateProgress();
      el.btnDraw.disabled = false;
    }

    el.wSender.value = "";
    el.wTitle.value = "";
    el.wMessage.value = "";
    closeWrite();

    SoundFX.fanfare();
    burstConfetti(40);
    burstHearts(10);
    el.mailbox.classList.add("shaking");
    setTimeout(() => el.mailbox.classList.remove("shaking"), 700);
    showToast("จดหมายถูกหย่อนลงตู้แล้ว 💌 รอใครสักคนมาสุ่มเจอ");
  } catch (e) {
    console.error(e);
    el.writeError.textContent = "ส่งไม่สำเร็จ ลองใหม่อีกครั้งนะ 😢";
    el.writeError.classList.remove("hidden");
  }

  el.btnSubmitLetter.disabled = false;
  el.btnSubmitLetter.textContent = "หย่อนลงตู้ 📮";
}

/* ================================================================
   ผูกปุ่มต่าง ๆ
   ================================================================ */
el.btnDraw.addEventListener("click", () => {
  el.btnDraw.disabled = true;
  startDraw();
  setTimeout(() => { el.btnDraw.disabled = false; }, 1600);
});

el.envelope.addEventListener("click", openEnvelope);
el.envelope.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") openEnvelope();
});

el.btnCloseLetter.addEventListener("click", closeLetter);
el.btnCollection.addEventListener("click", openCollection);
el.btnCloseCollection.addEventListener("click", () => el.sceneCollection.classList.add("hidden"));
el.btnReset.addEventListener("click", resetCollection);
el.btnSound.addEventListener("click", () => SoundFX.toggle());

el.btnWrite.addEventListener("click", openWrite);
el.btnCloseWrite.addEventListener("click", closeWrite);
el.btnSubmitLetter.addEventListener("click", submitLetter);

el.btnUnlock.addEventListener("click", submitUnlock);
el.btnCloseLock.addEventListener("click", closeLock);
el.lockPass.addEventListener("keydown", (e) => {
  if (e.key === "Enter") submitUnlock();
});

/* ================================================================
   เริ่มต้น: รอ storage.js พร้อม แล้วโหลดจดหมายทั้งหมด
   ================================================================ */
updateSoundBtn();

/* อัปเดตหน้าจอทุกครั้งที่รายชื่อจดหมายเปลี่ยน (โหลดครั้งแรก / realtime) */
function afterLettersLoaded(isFirst) {
  if (isFirst) state = loadState();
  syncStateWithLetters();
  updateProgress();

  if (window.LetterStore.mode === "local") {
    el.modeNote.classList.remove("hidden");
  } else {
    el.modeNote.classList.add("hidden");
  }

  if (allLetters.length === 0) {
    el.btnDraw.disabled = true;
    el.progress.textContent = "ตู้ยังว่างอยู่ — เป็นคนแรกที่เขียนจดหมายสิ ✍️";
  } else {
    el.btnDraw.disabled = false;
  }

  // สมุดสะสมเปิดค้างอยู่ → วาดใหม่ให้เห็นของใหม่ทันที
  if (!el.sceneCollection.classList.contains("hidden")) renderCollection();
}

async function fallbackToLocal() {
  window.LetterStore = window.LetterStoreLocal;
  allLetters = await window.LetterStore.loadLetters();
  afterLettersLoaded(true);
  showToast("เชื่อมต่อคลาวด์ไม่สำเร็จ — ใช้โหมดเก็บในเครื่องชั่วคราว");
}

/* โหมด cloud: ฟัง Firestore แบบ realtime — ใครหย่อนจดหมายก็เห็นทันที */
function bootRealtime() {
  const cloudStore = window.LetterStore;
  let first = true;
  let gotData = false;

  // กันค้าง: 10 วิแรกยังไม่มีข้อมูล → ถอยไปโหมดเก็บในเครื่องก่อน
  const fallbackTimer = setTimeout(() => {
    if (!gotData && window.LetterStoreLocal) fallbackToLocal();
  }, 10000);

  cloudStore.subscribe(
    (letters, serverAdds) => {
      gotData = true;
      clearTimeout(fallbackTimer);
      window.LetterStore = cloudStore; // เผื่อเคยถอยไป local แล้วคลาวด์ฟื้น
      allLetters = letters;
      const isFirst = first;
      first = false;
      afterLettersLoaded(isFirst);

      // มีจดหมายใหม่จากคนอื่นเข้ามาสด ๆ
      if (!isFirst && serverAdds > 0) {
        showToast("📮 มีจดหมายใหม่ถูกหย่อนลงตู้!");
        el.mailbox.classList.add("shaking");
        setTimeout(() => el.mailbox.classList.remove("shaking"), 700);
        burstHearts(4);
      }
    },
    (err) => {
      console.error("การเชื่อมต่อ realtime ล้มเหลว:", err);
      clearTimeout(fallbackTimer);
      if (err && err.code === "permission-denied") {
        // Rules ไม่ให้อ่าน → ต้องใส่รหัสตู้
        subscribed = false;
        showLockedUI();
        return;
      }
      if (!gotData && window.LetterStoreLocal) fallbackToLocal();
    }
  );
}

async function boot() {
  if (window.LetterStore.subscribe) {
    if (window.LetterStore.watchAuth) {
      // โหมด cloud + ระบบรหัสตู้: รอรู้สถานะก่อนว่าปลดล็อกอยู่ไหม
      window.LetterStore.watchAuth((user) => {
        if (user) {
          isLocked = false;
          closeLock();
          if (!subscribed) {
            subscribed = true;
            bootRealtime();
          }
        } else {
          showLockedUI();
        }
      });
    } else {
      bootRealtime();
    }
    return;
  }
  // โหมด local: โหลดครั้งเดียว ไม่มีระบบล็อก
  try {
    allLetters = await window.LetterStore.loadLetters();
  } catch (e) {
    console.error("โหลดจดหมายไม่สำเร็จ:", e);
    allLetters = [];
  }
  afterLettersLoaded(true);
}

if (window.LetterStore) {
  boot();
} else {
  window.addEventListener("letterstore-ready", boot, { once: true });
}
