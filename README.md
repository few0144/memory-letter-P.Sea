# 💌 Memory Letter Box

เว็บตู้ไปรษณีย์แห่งความทรงจำ — **ใครก็ได้เปิดลิงก์เข้ามาเขียนจดหมายหย่อนลงตู้ แล้วให้ทุกคนสุ่มเปิดอ่าน** พร้อมแอนิเมชันเปิดซองแบบเกมกาชา ไม่ต้องสมัครสมาชิก ไม่ต้อง login

## 📂 โครงสร้างไฟล์

```
web/
├── index.html          ← โครงหน้าเว็บ
├── style.css           ← สไตล์และแอนิเมชัน
├── script.js           ← ระบบสุ่ม / เปิดซอง / เขียนจดหมาย / สมุดสะสม / เสียง
├── storage.js          ← ชั้นเก็บข้อมูล (เลือกโหมด cloud หรือ local อัตโนมัติ)
├── firebase-config.js  ← 🔥 วางค่า Firebase ที่นี่ (เพื่อให้จดหมายแชร์ถึงกันทุกเครื่อง)
├── letters.js          ← จดหมายตั้งต้น (แก้/ลบได้ตามใจ สูงสุด 15 ฉบับ)
└── images/             ← รูปประกอบจดหมายตั้งต้น
```

## 🎮 โหมดการทำงาน

| โหมด | เงื่อนไข | จดหมายที่คนเขียน |
|---|---|---|
| **ทดลอง (local)** | ยังไม่ตั้งค่า `firebase-config.js` | เก็บในเบราว์เซอร์เครื่องนั้น เห็นคนเดียว |
| **แชร์จริง (cloud)** | ตั้งค่า Firebase แล้ว | รวมอยู่ตู้เดียวกัน ทุกคนสุ่มอ่านได้ |

เว็บเลือกโหมดให้อัตโนมัติ — แค่วางค่า config ก็สลับเป็นโหมดแชร์ทันที

## 🔥 ตั้งค่า Firebase (ครั้งเดียว ~5 นาที ฟรี)

1. ไปที่ [console.firebase.google.com](https://console.firebase.google.com) → **Add project** ตั้งชื่ออะไรก็ได้ (ปิด Google Analytics ได้)
2. ในหน้าโปรเจกต์ กดไอคอน **`</>`** (Web) → ตั้งชื่อแอป → กด Register → ก๊อปก้อน `const firebaseConfig = { ... }` ที่โชว์ขึ้นมา
3. เปิดไฟล์ `firebase-config.js` แล้ววางทับบรรทัด `const firebaseConfig = null;`
4. กลับไปที่คอนโซล เมนู **Build → Firestore Database** → **Create database** → เลือก location ไหนก็ได้ → เริ่มแบบ production mode
5. ไปแท็บ **Rules** วางกฎด้านล่างนี้แล้วกด **Publish** (อนุญาตให้ทุกคนอ่าน+เขียนจดหมายใหม่ แต่ห้ามแก้/ลบของคนอื่น และกันข้อมูลแปลกปลอม):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isAdmin() {
      return request.auth != null
        && request.auth.token.email == 'admin@memoryletterbox.app';
    }
    match /letters/{id} {
      allow read: if true;
      allow create: if isAdmin() || (
        request.resource.data.keys().hasOnly(['sender', 'title', 'message', 'createdAt'])
        && request.resource.data.sender is string
        && request.resource.data.sender.size() > 0 && request.resource.data.sender.size() <= 30
        && request.resource.data.title is string
        && request.resource.data.title.size() > 0 && request.resource.data.title.size() <= 50
        && request.resource.data.message is string
        && request.resource.data.message.size() > 0 && request.resource.data.message.size() <= 1000
        && request.resource.data.createdAt == request.time
      );
      allow update: if false;
      allow delete: if isAdmin();
    }
  }
}
```

> 💡 ค่า `firebaseConfig` เป็นข้อมูลสาธารณะโดยออกแบบ (ไม่ใช่รหัสลับ) — ความปลอดภัยอยู่ที่ Rules ด้านบน

## ⚙️ หน้าแอดมิน (เพิ่ม/ลบจดหมาย)

เปิดที่ `admin.html` (มีลิงก์ ⚙️ เล็ก ๆ มุมล่างขวาของหน้าแรกด้วย) — **ใส่รหัสผ่านช่องเดียว** แล้วจะ:
- 🗑️ **ลบ**จดหมายที่ไม่เหมาะสมออกจากตู้
- ➕ **เพิ่ม**จดหมายใหม่ลงตู้

การลบถูกบังคับที่ฝั่งเซิร์ฟเวอร์ด้วย Security Rules — คนที่ไม่รู้รหัส ต่อให้เปิดหน้าแอดมินหรือแก้โค้ดในเบราว์เซอร์ก็ลบไม่ได้ (เบื้องหลังรหัสผูกกับบัญชีภายใน `admin@memoryletterbox.app` ซึ่งไม่ต้องไปยุ่งอะไรกับมันเลย)

**เปิดใช้ครั้งแรก (กดสวิตช์เดียว):**
1. Firebase Console → **Build → Authentication** → กด **Get started**
2. แท็บ **Sign-in method** → เลือก **Email/Password** → **Enable** → **Save**
3. เปิด `admin.html` แล้วพิมพ์รหัสที่อยากใช้ (**ขั้นต่ำ 6 ตัว** เช่น `123456`) → รหัสนั้นถูกตั้งเป็นรหัสแอดมินทันที ⚠️ ทำข้อนี้ทันทีหลังเปิดสวิตช์ เพราะคนแรกที่ตั้งรหัสจะได้เป็นแอดมิน

**ลืมรหัส / อยากเปลี่ยนรหัส:** Firebase Console → Authentication → แท็บ Users → ลบแถวบัญชี `admin@...` ทิ้ง → กลับไปพิมพ์รหัสใหม่ใน `admin.html` (จะถูกตั้งเป็นรหัสแอดมินรอบใหม่)

## 🚀 Deploy ขึ้น GitHub Pages (ฟรี)

1. สร้าง repository ใหม่บน GitHub แล้วอัปโหลดไฟล์ทั้งหมดในโฟลเดอร์นี้ (ยกเว้นโฟลเดอร์ `.claude/` ซึ่งใช้ทดสอบในเครื่องเท่านั้น)
2. ไปที่ **Settings → Pages** → Source เลือก **Deploy from a branch** → เลือก branch `main` / folder `/ (root)` → Save
3. รอสักครู่ จะได้ลิงก์ `https://<ชื่อคุณ>.github.io/<ชื่อ repo>/` — แชร์ลิงก์นี้ให้ใครก็ได้มาเขียน/สุ่มอ่านจดหมาย

(จะใช้ Netlify Drop หรือ Replit แทนก็ได้เหมือนกัน — ลากโฟลเดอร์ขึ้นไปวางได้เลย)

## ✏️ จดหมายตั้งต้น (letters.js)

จดหมายที่อยากใส่ไว้ในตู้ตั้งแต่แรก แก้ได้ในไฟล์ `letters.js` (สูงสุด 15 ฉบับ ใส่รูปได้):

```js
const letters = [
  {
    sender: "แม่",
    title: "กำลังใจ",
    message: "ภูมิใจในตัวลูกเสมอ",   // ใช้ \n ขึ้นบรรทัดใหม่ได้
    image: "images/mom.jpg"          // ไม่มีรูปให้ใส่ ""
  },
];
```

ไม่อยากมีจดหมายตั้งต้นเลย ก็ลบให้เหลือ `const letters = [];`

## ✨ ฟีเจอร์

- ✍️ เขียนจดหมายผ่านหน้าเว็บ (ชื่อผู้ส่ง + หัวข้อ + ข้อความ) หย่อนลงตู้ได้ทันที
- 🎲 สุ่มเปิดอ่านแบบไม่ซ้ำ — เปิดครบทุกฉบับแล้วเริ่มรอบใหม่อัตโนมัติ
- 📖 สมุดสะสม — จดหมายที่เคยเปิด กลับมาอ่านย้อนหลังได้ (บันทึกไว้ในเครื่องผู้อ่าน)
- แอนิเมชันครบ: ตู้สั่น แสงเรือง ซองลอย ซองเปิด กระดาษคลี่ Typewriter Confetti หัวใจลอย
- 🔊 เสียงเอฟเฟกต์สังเคราะห์ด้วย Web Audio API (ไม่ต้องมีไฟล์เสียง) + ปุ่มเปิด/ปิด
- 📱 Responsive เน้นมือถือเป็นหลัก
