/* ================================================================
   💌 Memory Letter Box — ชั้นเก็บข้อมูลจดหมาย
   ----------------------------------------------------------------
   - ถ้าตั้งค่า firebase-config.js แล้ว  → โหมด cloud (แชร์ทุกเครื่อง)
   - ถ้ายังไม่ตั้งค่า / โหลด Firebase ไม่ได้ → โหมด local (เก็บในเครื่อง)

   จดหมายตั้งต้นใน letters.js จะถูกรวมเข้ามาด้วยเสมอ
   ================================================================ */

const LS_WRITTEN_KEY = "mlb_written_v1";
const MAX = { sender: 30, title: 50, message: 1000 };

/* จดหมายตั้งต้นจาก letters.js */
const BUILTIN = (typeof letters !== "undefined" && Array.isArray(letters) ? letters : [])
  .slice(0, 15)
  .map((l, i) => ({
    id: "builtin-" + i,
    sender: String(l.sender || ""),
    title: String(l.title || ""),
    message: String(l.message || ""),
    image: String(l.image || ""),
  }));

function clean(data) {
  return {
    sender: String(data.sender || "").trim().slice(0, MAX.sender),
    title: String(data.title || "").trim().slice(0, MAX.title),
    message: String(data.message || "").trim().slice(0, MAX.message),
    image: "",
  };
}

/* ---------- โหมด local: เก็บใน localStorage ของเครื่องนี้ ---------- */
function readWritten() {
  try {
    const arr = JSON.parse(localStorage.getItem(LS_WRITTEN_KEY));
    return Array.isArray(arr) ? arr : [];
  } catch (e) { return []; }
}

const localStore = {
  mode: "local",
  async loadLetters() {
    return [...BUILTIN, ...readWritten().map((l) => ({ ...clean(l), id: l.id }))];
  },
  async addLetter(data) {
    const letter = { ...clean(data), id: "local-" + Date.now() + "-" + Math.floor(Math.random() * 1e6) };
    const all = readWritten();
    all.push(letter);
    localStorage.setItem(LS_WRITTEN_KEY, JSON.stringify(all));
    return letter;
  },
};

/* ---------- โหมด cloud: Firebase Firestore ---------- */
async function makeCloudStore() {
  const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js");
  const { getFirestore, collection, addDoc, getDocs, query, orderBy, limit, serverTimestamp } =
    await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");

  const db = getFirestore(initializeApp(firebaseConfig));
  const lettersCol = collection(db, "letters");

  return {
    mode: "cloud",
    async loadLetters() {
      const snap = await getDocs(query(lettersCol, orderBy("createdAt", "asc"), limit(500)));
      const cloud = snap.docs.map((d) => ({ ...clean(d.data()), id: d.id }));
      return [...BUILTIN, ...cloud];
    },
    async addLetter(data) {
      const body = clean(data);
      const ref = await addDoc(lettersCol, {
        sender: body.sender,
        title: body.title,
        message: body.message,
        createdAt: serverTimestamp(),
      });
      return { ...body, id: ref.id };
    },
  };
}

/* ---------- เลือกโหมดแล้วประกาศให้ script.js ใช้งาน ---------- */
let store = localStore;
if (typeof firebaseConfig !== "undefined" && firebaseConfig && firebaseConfig.apiKey) {
  try {
    store = await makeCloudStore();
  } catch (e) {
    console.warn("โหลด Firebase ไม่สำเร็จ ใช้โหมดเก็บในเครื่องแทน:", e);
    store = localStore;
  }
}

window.LetterStore = store;
window.LetterStoreLocal = localStore; // ตัวสำรองเมื่อคลาวด์ล่ม/ยังตั้งค่าไม่เสร็จ
window.dispatchEvent(new Event("letterstore-ready"));
