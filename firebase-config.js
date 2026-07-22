/* ================================================================
   🔥 Firebase Config — ทำให้จดหมายแชร์ถึงกันทุกเครื่อง
   ================================================================
   ตอนนี้ยังเป็น null = โหมดทดลอง (จดหมายเก็บในเครื่องใครเครื่องมัน)

   วิธีเปิดใช้ (ฟรี ใช้เวลา ~5 นาที — มีขั้นตอนละเอียดใน README.md):
   1. ไปที่ https://console.firebase.google.com สร้างโปรเจกต์ใหม่
   2. สร้าง Web App แล้วก๊อป firebaseConfig ที่ได้มาวางแทน null ข้างล่าง
   3. เปิดใช้ Cloud Firestore แล้ววาง Security Rules ตามใน README.md

   ตัวอย่างหลังวางค่าแล้ว:

   const firebaseConfig = {
     apiKey: "AIzaSy...",
     authDomain: "xxx.firebaseapp.com",
     projectId: "xxx",
     storageBucket: "xxx.appspot.com",
     messagingSenderId: "123456",
     appId: "1:123456:web:abcdef"
   };
   ================================================================ */

/* อีเมลประจำบัญชีแอดมิน (เป็นอีเมลสมมติ ใช้จับคู่กับรหัสผ่านเท่านั้น)
   ต้องตรงกับ: บัญชีที่สร้างใน Authentication → Users และอีเมลใน Security Rules */
const ADMIN_EMAIL = "admin@memoryletterbox.app";

const firebaseConfig = {
  apiKey: "AIzaSyCOzmGche1DI4m3nXXoOacn5Gks88teRjg",
  authDomain: "memoryletterbox.firebaseapp.com",
  projectId: "memoryletterbox",
  storageBucket: "memoryletterbox.firebasestorage.app",
  messagingSenderId: "487981610646",
  appId: "1:487981610646:web:21f7e54e89e1d6a59bb4b7",
  measurementId: "G-G60R7YSV7V"
};
