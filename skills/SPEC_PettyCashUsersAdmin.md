# SPEC: PettyCash Users Admin (GAS + LINE LIFF)

**Version:** 1.0.0 (spec draft)
**Type:** Google Apps Script Web App (backend) + Static HTML frontend hosted on GitHub Pages, called via LIFF
**Purpose:** CRUD ระบบจัดการ `users_profile` และ `Approve_Users` สำหรับระบบเบิก/อนุมัติเงินสดย่อย (Petty Cash) โดยผูกบัญชีผู้ใช้เข้ากับ LINE UID ผ่านกระบวนการยืนยันตัวตนด้วย PIN

---

## 1. Objective

สร้างเว็บแอปสำหรับ:
1. **Admin** เข้ามาเพิ่ม/แก้ไข/ลบ ผู้ใช้ใน `users_profile` และดูแลข้อมูล `Approve_Users` ที่ผูกกัน
2. **User ใหม่** เข้ามายืนยันตัวตนครั้งแรกด้วย PIN 6 หลักที่ Admin แจ้งให้แบบ out-of-band (โทร/แชท) เพื่อผูก LINE UID จริงของตนเองเข้ากับ record ที่ Admin เตรียมไว้ล่วงหน้า

**สาเหตุที่ host หน้า HTML บน GitHub Pages แทนที่จะ serve จาก GAS โดยตรง:** เพื่อตัดปัญหา LINE LIFF ไม่สามารถเปิดผ่าน iframe ของ GAS HtmlService ได้ในบางอุปกรณ์/เบราว์เซอร์ Static HTML บน GitHub Pages เรียก GAS ผ่าน `google.script.run` ไม่ได้ (เพราะไม่ใช่หน้า GAS) — **ให้เรียก backend ผ่าน GAS Web App URL (`doGet`/`doPost` deployed as Web App) โดยใช้ `fetch()` จากฝั่ง client แทน**

---

## 2. Architecture

```
[LINE LIFF] --> [GitHub Pages: index.html + JS + CSS]
                        |
                        | fetch() JSON (CORS via GAS ContentService)
                        v
                 [GAS Web App: doGet/doPost]
                        |
                        v
                 [Google Sheets: Approve_Users, users_profile]
```

- Frontend: Vanilla JS (ไม่ใช้ framework) แยกไฟล์ `index.html`, `app.js`, `style.css` เพื่อ maintain ง่าย
- Backend: Google Apps Script, แยกไฟล์ตามหน้าที่ (ห้ามรวมทุกอย่างไว้ไฟล์เดียว):
  - `Code.gs` — `doGet`/`doPost` router เท่านั้น
  - `Config.gs` — ค่าคงที่ทั้งหมด
  - `AuthService.gs` — ตรวจ ADMIN_PINCODE และตรวจ/จับคู่ user PIN
  - `UsersProfileService.gs` — CRUD ของ `users_profile`
  - `ApproveUsersService.gs` — CRUD/sync ของ `Approve_Users`
  - `SheetHelper.gs` — read/write generic helper (getRows, findRowByValue, ฯลฯ)
  - `Utils.gs` — PIN generator, validators

---

## 3. Config (Script Properties)

```javascript
const _props = PropertiesService.getScriptProperties().getProperties() || {};

const CONFIG = {
  SPREADSHEET_ID: '1amztKC_QEVv9H7u6ubGCJYEHCHo0NWnJhT6ksNQCpnA',
  SHEET_USERS_PROFILE: 'users_profile',
  SHEET_APPROVE_USERS: 'Approve_Users',
  ADMIN_PINCODE: parseInt(_props['ADMIN_PINCODE'], 10),
  PIN_LENGTH: 6,
  PIN_MIN: 100000,
  PIN_MAX: 999999
};
```

- `ADMIN_PINCODE` ต้องเป็นตัวเลข 6 หลัก เก็บใน Script Properties เท่านั้น ห้าม hardcode ในโค้ด
- ทุก service อ่านค่าจาก `CONFIG` object นี้จุดเดียว ห้าม hardcode sheet name/ID ซ้ำที่อื่น

---

## 4. Google Sheets Schema (ยืนยันแล้ว — ห้ามเปลี่ยนชื่อคอลัมน์)

### 4.1 Sheet: `Approve_Users`

| Col | Index | Field | ประเภท | คำอธิบาย |
|---|---|---|---|---|
| A | 0 | `approve_request` | string | ชื่อ/รหัสสำหรับกรอง request ที่ต้องจ่ายเงิน — **ต้องมีค่าเท่ากับ `users_profile.Request_Name` เสมอ** |
| B | 1 | `line_profile` | string | ก่อน register = PIN 6 หลัก (placeholder); หลัง register สำเร็จ = LINE displayName |
| C | 2 | `line_uid` | string | LINE User ID จริง — เขียนค่าเมื่อ register สำเร็จเท่านั้น (ก่อนหน้านั้นเป็นค่าว่าง) |
| D | 3 | `pettycash_approve` | `"YES"` \| `"NO"` | สิทธิ์อนุมัติชดเชยวงเงิน (derived — ดูกฎข้อ 6.3) |

### 4.2 Sheet: `users_profile`

| Col | Field | ประเภท | คำอธิบาย |
|---|---|---|---|
| A | `line_uid` | string | **PK** — ก่อน register = PIN 6 หลัก (placeholder, เก็บเป็น string ไม่ใช่ number เพื่อกัน leading-zero หาย); หลัง register = LINE UID จริง |
| B | `Request_Name` | string | ชื่อผู้ใช้ที่แสดง/ใช้อ้างอิง — **บังคับ unique ทั้งชีต** (ดูกฎข้อ 6.4) |
| C | `emp_no` | string | รหัสพนักงาน |
| D | `pc.limit` | number | วงเงินสดย่อย (บาท) |
| E | `pettycash_control` | `"YES"` \| `"NO"` | `"YES"` = เป็นผู้ถือวงเงินสดย่อย, `"NO"` = ไม่ได้ถือวงเงิน |

### 4.3 ความสัมพันธ์ระหว่างสองชีต

- Join key จริง (หลัง register แล้ว): `users_profile.line_uid` = `Approve_Users.line_uid`
- ก่อน register: ทั้งสองชีตผูกกันด้วย **PIN เดียวกัน** ที่อยู่ใน `users_profile.line_uid` และ `Approve_Users.line_uid` (ทั้งคู่ยังว่างหรือ placeholder — ดู 6.1)
- ทุกครั้งที่แก้ `Request_Name` ใน `users_profile` → ต้องเขียนค่าเดียวกันไปที่ `Approve_Users.approve_request` และ `Approve_Users.line_profile` (เฉพาะกรณียังไม่ register — ถ้า register แล้ว `line_profile` เก็บ displayName ไม่ใช่ชื่อนี้ ดังนั้นอัปเดตเฉพาะ `approve_request`)

---

## 5. PIN Generation Rule

- สุ่มเลข 6 หลัก ช่วง `[100000, 999999]`
- **Uniqueness check:** ต้องไม่ชนกับ (ก) `CONFIG.ADMIN_PINCODE` (ข) ค่า `line_uid` ของทุกแถวใน `users_profile` ที่ยังไม่ register (ค) ค่า `line_uid` ของทุกแถวใน `Approve_Users` ที่ยังไม่ register
- **วิธีจัดการชนกัน:** สุ่มใหม่วนลูปอัตโนมัติจนกว่าจะได้ค่าที่ไม่ชน (`while` loop เรียก `generateAndCheck()` — ใส่ safety cap ที่ 50 รอบ แล้ว throw error ถ้าเกิน เพื่อกัน infinite loop ในกรณี edge case ที่ pool หมด)
- PIN ที่ generate แล้วต้องแสดงบนหน้าจอ Admin CRUD ทันทีหลัง save (ให้ Admin คัดลอกไปแจ้ง user เอง — ระบบไม่ส่งอัตโนมัติ)

---

## 6. Business Rules (CRUD Logic)

### 6.1 Admin: เพิ่ม User ใหม่ (Create)

Input จาก Admin: `Request_Name`, `emp_no`, `pc.limit`, `pettycash_control`

Flow:
1. Validate `Request_Name` ไม่ซ้ำกับที่มีอยู่ (ดู 6.4) → ถ้าซ้ำ reject พร้อม error message ชัดเจน
2. Generate unique PIN (ดูข้อ 5) → ใช้เป็นค่า placeholder
3. เขียนแถวใหม่ใน `users_profile`:
   - `line_uid` = PIN (as string)
   - `Request_Name`, `emp_no`, `pc.limit`, `pettycash_control` = ตามที่ Admin กรอก
4. เขียนแถวคู่ใน `Approve_Users` (ดูกฎ derive ที่ 6.3):
   - `approve_request` = `Request_Name`
   - `line_profile` = PIN เดียวกัน (placeholder)
   - `line_uid` = "" (ว่าง จนกว่าจะ register)
   - `pettycash_approve` = derive จาก `pettycash_control` (6.3)
5. คืนค่า PIN กลับไปแสดงบนหน้าจอ Admin

### 6.2 Admin: แก้ไข User (Update)

- แก้ `Request_Name` → sync ไปที่ `Approve_Users.approve_request` เสมอ; ถ้า user ยังไม่ register (ยัง match กับ PIN placeholder) ให้ sync ไปที่ `Approve_Users.line_profile` ด้วย (เพราะยังเก็บ PIN ไม่ใช่ displayName — จริงๆ ไม่กระทบ แต่ต้องไม่ไปทับ displayName ถ้า register แล้ว)
- แก้ `emp_no`, `pc.limit` → กระทบเฉพาะ `users_profile` ไม่ต้อง sync ไป `Approve_Users`
- แก้ `pettycash_control` (`YES` ↔ `NO`) → **ต้อง auto-sync `Approve_Users.pettycash_approve` ทันทีตาม rule 6.3 ในทรานแซกชันเดียวกับการ save** ไม่ว่า user จะ register แล้วหรือยัง
- ทุก update ต้อง match แถวด้วย `line_uid` (ค่าปัจจุบัน ไม่ว่าจะเป็น PIN หรือ LINE UID จริง) เป็นหลัก

### 6.3 กฎ Derive `pettycash_approve` จาก `pettycash_control`

| `users_profile.pettycash_control` | ความหมาย | `Approve_Users.pettycash_approve` |
|---|---|---|
| `YES` | เป็นผู้ถือวงเงินสดย่อย | `NO` (ผู้ถือวงเงินอนุมัติเบิกจ่ายให้ตัวเองไม่ได้) |
| `NO` | ไม่ได้ถือวงเงิน | `YES` (มีสิทธิ์อนุมัติชดเชยวงเงินให้คนอื่น) |

กฎนี้เป็น **derived value เสมอ** — ห้ามให้ Admin แก้ `pettycash_approve` ตรงๆ ในหน้า CRUD ของ `Approve_Users` ต้องแก้ผ่าน `pettycash_control` ใน `users_profile` เท่านั้น ระบบ sync ให้อัตโนมัติทุกครั้งที่ save (create หรือ update)

### 6.4 Uniqueness ของ `Request_Name`

- บังคับ unique (case-insensitive, trim whitespace ก่อนเทียบ) ทั้งชีต `users_profile`
- ตรวจก่อน save ทุกครั้ง (create และ update ที่มีการแก้ `Request_Name`) — ถ้าซ้ำ reject การ save พร้อม error message: `"ชื่อนี้มีอยู่ในระบบแล้ว กรุณาใช้ชื่ออื่น"`
- Backend ต้อง validate (ห้าม rely on frontend validation อย่างเดียว เพราะเสี่ยง race condition เวลามี 2 admin แก้พร้อมกัน)

### 6.5 Admin: ลบ User (Delete)

- ลบแถวออกจากทั้งสองชีตพร้อมกัน (`users_profile` โดย match `line_uid`, `Approve_Users` โดย match `line_uid` เดียวกัน)
- ถ้าลบไม่สำเร็จฝั่งใดฝั่งหนึ่ง (เช่น หา match ไม่เจอ) ให้แจ้งเตือน Admin แบบชัดเจนว่าฝั่งไหนลบไม่สำเร็จ ไม่ silent fail

---

## 7. Identity Verification Flow (User ฝั่งเข้ามายืนยันตัวตนครั้งแรก)

### 7.1 หน้าจอแรก (Landing / PIN Entry)

ผู้ใช้ (ไม่ว่าจะเป็น Admin หรือ User ใหม่) เจอหน้าเดียวกัน: ช่องกรอก PIN 6 หลัก

**ลำดับการตรวจสอบ (ต้องตรวจตามลำดับนี้เท่านั้น ห้ามสลับ):**

1. **ตรวจกับ `CONFIG.ADMIN_PINCODE` ก่อนเสมอ**
   - ถ้าตรง → เข้าสู่หน้า Admin CRUD ทันที (ไม่ต้องผูก LINE UID ใดๆ, ไม่แตะ `users_profile`/`Approve_Users`)
   - ถ้าไม่ตรง → ไปข้อ 2
2. **ค้นหา PIN ที่กรอกใน `users_profile.line_uid`** (เทียบเฉพาะแถวที่ยังเป็นสถานะ pending — ดู 7.2 นิยาม pending)
   - ถ้าเจอ match → เข้าสู่กระบวนการ register (ข้อ 7.3)
   - ถ้าไม่เจอ match เลย → **ปฏิเสธการเข้าใช้งานทันที** แสดง error `"รหัสไม่ถูกต้อง"` ไม่เปิดเผยว่าปฏิเสธเพราะเหตุใด (กันการเดา PIN)

### 7.2 นิยามสถานะ "Pending" ของแถว

แถวใน `users_profile` ถือว่า **pending** (ยังไม่ register) เมื่อค่า `line_uid` เป็นตัวเลข 6 หลักล้วน (ตรง pattern PIN) — เมื่อ register สำเร็จ `line_uid` จะถูกแทนที่ด้วย LINE UID จริง (ซึ่งเป็น string รูปแบบอื่น เช่น `U1234...` ความยาว 33 ตัวอักษร) ทำให้ตรวจสถานะได้จาก pattern ของค่านี้โดยไม่ต้องมีคอลัมน์ status เพิ่ม

### 7.3 กระบวนการ Register (เมื่อ PIN match กับแถว pending)

1. เรียก LIFF `liff.getProfile()` ฝั่ง client เพื่อได้ `userId` (LINE UID จริง) และ `displayName`
2. ส่ง `matchedPin`, `lineUid`, `displayName` ไปที่ backend
3. Backend:
   - หาแถวใน `users_profile` ที่ `line_uid == matchedPin` → เขียนทับ `line_uid` = `lineUid` จริง
   - หาแถวใน `Approve_Users` ที่ `line_uid == matchedPin` (คือแถวว่าง — ดู 6.1 ข้อ 4 ที่บอกว่า `line_uid` เริ่มต้นเป็น "") — **หมายเหตุสำคัญ:** เนื่องจาก `Approve_Users.line_uid` เริ่มต้นเป็นค่าว่างไม่ใช่ PIN ต้อง match แถวนี้ผ่าน `line_profile == matchedPin` แทน (ไม่ใช่ `line_uid`) แล้วจึงเขียน `line_uid` = `lineUid` จริง และเขียน `line_profile` = `displayName` (ทับค่า PIN เดิม)
   - Transaction ต้องสำเร็จทั้งสองชีตพร้อมกัน — ถ้าฝั่งใดฝั่งหนึ่ง fail ให้ rollback ฝั่งที่ทำสำเร็จแล้ว (หรืออย่างน้อย log error ชัดเจนให้ Admin ตรวจสอบย้อนหลังได้)
4. หลัง register สำเร็จ → แสดงหน้ายืนยัน `"ยืนยันตัวตนสำเร็จ"` ให้ user (ไม่ต้องเข้าหน้า CRUD ใดๆ ต่อ เพราะ user ทั่วไปไม่มีสิทธิ์เข้า Admin)

---

## 8. API Design (GAS Web App)

Deploy เป็น Web App, ใช้ `doGet(e)` สำหรับ read และ `doPost(e)` สำหรับ write ทั้งหมด (เพื่อเลี่ยงข้อจำกัด GET query length และป้องกัน caching ของ browser กับ write operation)

Request/Response format: JSON ทั้งหมด ผ่าน `ContentService.createTextOutput(JSON.stringify(...)).setMimeType(ContentService.MimeType.JSON)`

Payload ทุก request ต้องมี field `action` เพื่อ route ภายใน `doPost`/`doGet` ตัวอย่าง action ที่ต้องมี:

| Action | Method | ใช้เมื่อ |
|---|---|---|
| `verifyPin` | POST | หน้าแรก ตรวจ PIN (admin หรือ pending user) |
| `registerUser` | POST | ผูก LINE UID จริงเข้ากับแถว pending |
| `listUsers` | GET | Admin โหลดรายการ users_profile ทั้งหมด (join แสดง status pending/registered) |
| `createUser` | POST | Admin เพิ่ม user ใหม่ |
| `updateUser` | POST | Admin แก้ไข user |
| `deleteUser` | POST | Admin ลบ user |

ทุก response ต้องมี field `success: boolean` และ `message` (ภาษาไทย, human-readable) เสมอ เพื่อให้ frontend แสดง error ได้ตรงจุดโดยไม่ต้องเดา

---

## 9. Frontend Screens

1. **PIN Entry** — ช่องกรอกตัวเลข 6 หลัก (numeric keypad บนมือถือ), ปุ่มยืนยัน
2. **Admin Dashboard** — ตารางรายชื่อ `users_profile` ทั้งหมด แสดงคอลัมน์: ชื่อ, รหัสพนักงาน, วงเงิน, สถานะผู้ถือวงเงิน (YES/NO), สถานะ register (Pending/Registered — derive จาก pattern ข้อ 7.2), ปุ่มแก้ไข/ลบ, ปุ่มเพิ่มใหม่
3. **Add/Edit User Form** — ฟอร์มกรอก `Request_Name`, `emp_no`, `pc.limit`, `pettycash_control` (toggle/dropdown) — หลัง save ถ้าเป็น create ใหม่ ให้ popup แสดง PIN ที่ generate ได้เด่นชัด พร้อมปุ่ม "คัดลอก PIN"
4. **Register Success** — หน้ายืนยันตัวตนสำเร็จสำหรับ user ทั่วไป

**Responsive requirement:** ทุกหน้าต้องใช้งานได้ดีทั้งบนมือถือ (ผ่าน LIFF in-app browser) และเดสก์ท็อป (ผ่าน browser ปกติสำหรับ Admin) — ใช้ CSS responsive (flexbox/grid + media query) ห้ามพึ่งพา fixed width

---

## 10. Version Control

- ใส่เลขเวอร์ชันไว้ใน footer ของหน้าเว็บ (อ่านจาก constant ตัวเดียวใน `app.js` เช่น `const APP_VERSION = 'v1.0.0'`)
- Commit message convention: `[vX.Y.Z] คำอธิบายการเปลี่ยนแปลง`
- เก็บ CHANGELOG.md แยกไฟล์ใน repo เดียวกับ static HTML

---

## 11. Non-Functional Requirements

- **Concurrency:** รองรับ Admin/User ใช้งานพร้อมกันได้หลายคน — ใช้ `LockService.getScriptLock()` ครอบทุก write operation (create/update/delete/register) เพื่อกัน race condition ตอนเขียนชีตพร้อมกัน
- **Error handling:** ทุก backend function ครอบด้วย `try/catch` และ return `{success: false, message: ...}` แทนการ throw ตรงๆ ไปหา client
- **Security:** ไม่มี field ใดใน response ที่รั่วไหล `ADMIN_PINCODE` หรือ PIN ของ user คนอื่นออกไปนอกเหนือจากที่จำเป็น (เช่น หน้า list ของ Admin ไม่ต้องแสดง PIN ของ user ที่ pending อยู่แล้ว ยกเว้นตอน create ใหม่ที่ต้อง reveal ครั้งเดียว)
- **CORS:** ตั้งค่า GAS Web App deploy เป็น "Anyone" (execute as ตัว owner) เพื่อให้ static page บน GitHub Pages เรียกได้โดยไม่ติด CORS

---
เพิ่มเติมแก้ไข users ที่ไม่ได้ถือวงเงิน pettycash_control=NO ไม่จำเป็นว่า ต้องมี record เป็นผู้อนุมัติใน approve_users เสมอไป ให้มี ปุ่มหรือ on/off กำหนดได้ว่า ว่ามีสิทธิ์ ในการอนุมัติ ด้วยหรือไม่ ถ้ามี ค่อยเพิ่ม ข้อมูลใน approve_users และpettycash_approve=YES คือมีสิทธิ์อนุมัติเงินชดเชยเข้าวงเงิน   แต่ถ้าเป็น users ธรรมดาไม่มีสิทธิ์ อนัมัติ  ก็ให้ลบ หรือไม่ต้องเพิ่มข้อมูลใน approve_users
