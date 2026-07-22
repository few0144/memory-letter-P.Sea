/* ================================================================
   ⚙️ Memory Letter Box — หน้าแอดมิน (เพิ่ม/ลบจดหมายบนคลาวด์)
   ----------------------------------------------------------------
   ความปลอดภัยจริงอยู่ที่ Firestore Security Rules ฝั่งเซิร์ฟเวอร์:
   เฉพาะบัญชี Google ที่อีเมลตรงกับใน Rules เท่านั้นที่ลบได้
   ต่อให้ใครเปิดหน้านี้หรือแก้โค้ดฝั่งเบราว์เซอร์ ก็ลบของจริงไม่ได้
   ================================================================ */

const $ = (id) => document.getElementById(id);

const el = {
  notConfigured: $("not-configured"),
  authBox: $("auth-box"),
  authLoading: $("auth-loading"),
  authSignedOut: $("auth-signedout"),
  authSignedIn: $("auth-signedin"),
  authEmail: $("auth-email"),
  authError: $("auth-error"),
  adminPass: $("admin-pass"),
  btnLogin: $("btn-login"),
  btnLogout: $("btn-logout"),

  adminPanel: $("admin-panel"),
  aSender: $("a-sender"),
  aTitle: $("a-title"),
  aMessage: $("a-message"),
  addError: $("add-error"),
  btnAdd: $("btn-add"),
  letterCount: $("letter-count"),
  lettersList: $("letters-list"),
};

function showError(target, msg) {
  target.textContent = msg;
  target.classList.remove("hidden");
}

/* ---------- ยังไม่ได้ตั้งค่า Firebase ---------- */
if (typeof firebaseConfig === "undefined" || !firebaseConfig || !firebaseConfig.apiKey) {
  el.notConfigured.classList.remove("hidden");
} else {
  main().catch((e) => {
    console.error(e);
    el.authBox.classList.remove("hidden");
    el.authLoading.classList.add("hidden");
    showError(el.authError, "โหลด Firebase ไม่สำเร็จ: " + e.message);
  });
}

async function main() {
  const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js");
  const { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } =
    await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js");
  const { getFirestore, collection, getDocs, addDoc, deleteDoc, doc, query, orderBy, limit, serverTimestamp } =
    await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");

  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);
  const lettersCol = collection(db, "letters");

  el.authBox.classList.remove("hidden");

  /* ----------------------------------------------------------------
     ล็อกอินด้วยรหัสผ่านอย่างเดียว
     - ครั้งแรกสุด (ยังไม่มีบัญชีแอดมิน): รหัสที่พิมพ์จะถูก "ตั้ง"
       เป็นรหัสแอดมินโดยอัตโนมัติ
     - ครั้งถัดไป: ต้องพิมพ์ให้ตรงถึงจะเข้าได้
     (เบื้องหลังผูกกับบัญชี ADMIN_EMAIL ที่ผู้ใช้ไม่ต้องรู้จัก)
     ---------------------------------------------------------------- */
  async function login() {
    el.authError.classList.add("hidden");
    const pass = el.adminPass.value;
    if (!pass) {
      showError(el.authError, "ใส่รหัสผ่านก่อนนะ");
      return;
    }
    el.btnLogin.disabled = true;
    try {
      await signInWithEmailAndPassword(auth, ADMIN_EMAIL, pass);
      el.adminPass.value = "";
    } catch (e) {
      console.error(e);
      if (e.code === "auth/operation-not-allowed" || e.code === "auth/configuration-not-found") {
        showError(el.authError, "ยังไม่ได้เปิดสวิตช์ Email/Password ใน Firebase Console (Authentication → Sign-in method)");
      } else if (e.code === "auth/user-not-found" || e.code === "auth/invalid-credential" || e.code === "auth/wrong-password") {
        // อาจเป็นเพราะยังไม่เคยตั้งรหัส → ลองตั้งรหัสนี้เป็นรหัสแอดมิน
        try {
          await createUserWithEmailAndPassword(auth, ADMIN_EMAIL, pass);
          el.adminPass.value = "";
          alert("ตั้งรหัสนี้เป็นรหัสแอดมินเรียบร้อย ✅ จำไว้ให้ดีนะ");
        } catch (e2) {
          if (e2.code === "auth/email-already-in-use") {
            showError(el.authError, "รหัสผ่านไม่ถูกต้อง 🔒");
          } else if (e2.code === "auth/weak-password") {
            showError(el.authError, "รหัสผ่านต้องยาวอย่างน้อย 6 ตัวอักษร");
          } else {
            showError(el.authError, "เข้าสู่ระบบไม่สำเร็จ: " + (e2.code || e2.message));
          }
        }
      } else if (e.code === "auth/too-many-requests") {
        showError(el.authError, "ใส่รหัสผิดหลายครั้งเกินไป — รอสักครู่แล้วลองใหม่");
      } else {
        showError(el.authError, "เข้าสู่ระบบไม่สำเร็จ: " + (e.code || e.message));
      }
    }
    el.btnLogin.disabled = false;
  }

  el.btnLogin.addEventListener("click", login);
  el.adminPass.addEventListener("keydown", (e) => {
    if (e.key === "Enter") login();
  });

  el.btnLogout.addEventListener("click", () => signOut(auth));

  onAuthStateChanged(auth, (user) => {
    el.authLoading.classList.add("hidden");
    el.authError.classList.add("hidden");
    if (user) {
      el.authSignedOut.classList.add("hidden");
      el.authSignedIn.classList.remove("hidden");
      el.authEmail.textContent = "แอดมิน ✅";
      el.adminPanel.classList.remove("hidden");
      loadLetters();
    } else {
      el.authSignedIn.classList.add("hidden");
      el.authSignedOut.classList.remove("hidden");
      el.adminPanel.classList.add("hidden");
    }
  });

  /* ---------- โหลดรายการจดหมาย ---------- */
  async function loadLetters() {
    el.lettersList.innerHTML = `<p class="admin-sub">กำลังโหลด...</p>`;
    try {
      const snap = await getDocs(query(lettersCol, orderBy("createdAt", "desc"), limit(500)));
      renderList(snap.docs);
    } catch (e) {
      console.error(e);
      el.lettersList.innerHTML = "";
      showError(el.authError, "โหลดจดหมายไม่สำเร็จ: " + (e.code || e.message));
    }
  }

  function renderList(docs) {
    el.letterCount.textContent = docs.length;
    el.lettersList.innerHTML = "";

    if (docs.length === 0) {
      el.lettersList.innerHTML = `<p class="admin-sub">ยังไม่มีจดหมายบนคลาวด์</p>`;
      return;
    }

    docs.forEach((d) => {
      const data = d.data();
      const item = document.createElement("div");
      item.className = "admin-item";

      const info = document.createElement("div");
      info.className = "admin-item-info";

      const title = document.createElement("div");
      title.className = "admin-item-title";
      title.textContent = data.title || "(ไม่มีหัวข้อ)";

      const meta = document.createElement("div");
      meta.className = "admin-item-meta";
      const when = data.createdAt && data.createdAt.toDate
        ? data.createdAt.toDate().toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" })
        : "";
      meta.textContent = `จาก ${data.sender || "?"}${when ? " · " + when : ""}`;

      const msg = document.createElement("div");
      msg.className = "admin-item-msg";
      msg.textContent = data.message || "";

      info.append(title, meta, msg);

      const del = document.createElement("button");
      del.className = "del-btn";
      del.textContent = "🗑️";
      del.title = "ลบจดหมายนี้";
      del.addEventListener("click", async () => {
        if (!confirm(`ลบจดหมาย "${data.title}" จาก ${data.sender}?\n(ลบแล้วกู้คืนไม่ได้)`)) return;
        del.disabled = true;
        try {
          await deleteDoc(doc(db, "letters", d.id));
          item.remove();
          el.letterCount.textContent = String(Number(el.letterCount.textContent) - 1);
        } catch (e) {
          console.error(e);
          del.disabled = false;
          if (e.code === "permission-denied") {
            showError(el.authError, "บัญชีนี้ไม่มีสิทธิ์ลบ — อีเมลต้องตรงกับที่กำหนดใน Security Rules");
          } else {
            showError(el.authError, "ลบไม่สำเร็จ: " + (e.code || e.message));
          }
        }
      });

      item.append(info, del);
      el.lettersList.appendChild(item);
    });
  }

  /* ---------- เพิ่มจดหมาย ---------- */
  el.btnAdd.addEventListener("click", async () => {
    const sender = el.aSender.value.trim();
    const title = el.aTitle.value.trim();
    const message = el.aMessage.value.trim();

    if (!sender || !title || !message) {
      showError(el.addError, "กรอกให้ครบทั้ง 3 ช่องนะ");
      return;
    }
    el.addError.classList.add("hidden");
    el.btnAdd.disabled = true;
    el.btnAdd.textContent = "กำลังเพิ่ม...";

    try {
      await addDoc(lettersCol, { sender, title, message, createdAt: serverTimestamp() });
      el.aSender.value = "";
      el.aTitle.value = "";
      el.aMessage.value = "";
      loadLetters();
    } catch (e) {
      console.error(e);
      showError(el.addError, "เพิ่มไม่สำเร็จ: " + (e.code || e.message));
    }

    el.btnAdd.disabled = false;
    el.btnAdd.textContent = "เพิ่มจดหมาย 📮";
  });
}
