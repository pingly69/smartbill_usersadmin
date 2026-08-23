# SmartBill Approve — Backend API Specification

> **Source**: [`code.js`](file:///c:/Antigravity_Data/SmartBill_Approve/code.js)
> Reverse-Engineered from source code

---

## 1. API Entry Point

### `doPost(e)` — [code.js:10-38](file:///c:/Antigravity_Data/SmartBill_Approve/code.js#L10-L38)

**Protocol**: HTTP POST → Google Apps Script Web App
**Content-Type**: JSON (parsed from `e.postData.contents`)

**Request Format**:
```json
{
  "action": "<action_name>",
  ...additional_fields
}
```

**Response Format (Success)**:
```json
{
  "success": true,
  "data": <result_object>
}
```

**Response Format (Error)**:
```json
{
  "success": false,
  "message": "<error_string>"
}
```

---

## 2. API Actions

### 2.1 `checkUser` — ตรวจสอบสิทธิ์ผู้ใช้

**Function**: [`checkUser(line_uid)`](file:///c:/Antigravity_Data/SmartBill_Approve/code.js#L40-L60)

**Purpose**: ตรวจว่า LINE UID นี้มีสิทธิ์ใช้งานระบบจ่ายเงินสดย่อยหรือไม่ (ต้องมี `pettycash_approve === 'NO'`)

**Request**:
```json
{
  "action": "checkUser",
  "line_uid": "U1234567890abcdef..."
}
```

**Logic**:
1. เปิด Sheet `Approve_users`
2. วนลูปหาแถวที่ Column C (index 2) === `line_uid` และ Column A (index 0) !== `'เงินสดย่อยรอตัด'`
3. ตรวจสอบ Column D (index 3) `pettycash_approve`:
   - ถ้า `pettycash_approve === 'NO'` → return `{ status: 'authorized', approve_request: <Column A>, pettycash_approve: <Column D> }`
   - ถ้า `pettycash_approve !== 'NO'` (เช่น 'YES') → return `{ status: 'unauthorized', message: 'คุณไม่มีสิทธิ์เข้าใช้งานระบบนี้' }`
4. ถ้าไม่เจอ (หรือตรงกับแถว 'เงินสดย่อยรอตัด') → return `{ status: 'not_found' }`

**Response (authorized)**:
```json
{
  "status": "authorized",
  "approve_request": "ชื่อผู้อนุมัติ",
  "pettycash_approve": "NO"
}
```

**Response (unauthorized)**:
```json
{
  "status": "unauthorized",
  "message": "คุณไม่มีสิทธิ์เข้าใช้งานระบบนี้"
}
```

**Response (not found)**:
```json
{
  "status": "not_found"
}
```

---

### 2.2 `register` — ลงทะเบียนผู้อนุมัติ

**Function**: [`registerUser(line_uid, displayName, password)`](file:///c:/Antigravity_Data/SmartBill_Approve/code.js#L62-L86)

**Purpose**: ผูก LINE UID กับบัญชีผู้อนุมัติโดยใช้ password (เฉพาะที่ `pettycash_approve === 'NO'`)

**Request**:
```json
{
  "action": "register",
  "line_uid": "U1234567890abcdef...",
  "displayName": "ชื่อจาก LINE Profile",
  "password": "รหัสผ่านที่กรอก"
}
```

**Logic**:
1. เปิด Sheet `Approve_users`
2. วนลูปหาแถวที่ Column B (index 1) === `password` (เปรียบเทียบเป็น String) และ Column A (index 0) !== `'เงินสดย่อยรอตัด'`
3. ถ้าเจอ:
   - ตรวจสอบ Column D (index 3) `pettycash_approve`: หากไม่ใช่ `'NO'` → throw Error "บัญชีนี้ไม่มีสิทธิ์เข้าใช้งานระบบนี้"
   - เขียน `line_uid` ลง Column C (index 2)
   - เขียน `displayName` **ทับ** Column B (index 1) ← **⚠️ password ถูกลบแทนด้วยชื่อ**
   - return `{ success: true, approve_request: <Column A>, pettycash_approve: <Column D> }`
4. ถ้าไม่เจอ (หรือตรงกับแถว 'เงินสดย่อยรอตัด') → throw Error "รหัสผ่านไม่ถูกต้อง หรือไม่มีสิทธิ์เข้าถึง"

> **⚠️ Critical Design Note**: หลังจาก register สำเร็จ password จะถูก overwrite ด้วย displayName
> ทำให้ **register ได้เพียงครั้งเดียว** ต่อ user slot
> ไม่สามารถ re-register ใหม่ได้ (ยกเว้นเติม password กลับเข้า Sheet ด้วยมือ)

---

### 2.3 `getPending` — ดึงรายการรอการอนุมัติ / จ่ายเงิน

**Function**: [`getPendingData(approve_request)`](file:///c:/Antigravity_Data/SmartBill_Approve/code.js#L88-L131)

**Purpose**: ดึงบิลที่มีสถานะ `pending` สำหรับ approver คนนั้น

**Request**:
```json
{
  "action": "getPending",
  "approve_request": "ชื่อผู้อนุมัติ"
}
```

**Logic**:
1. เปิด Sheet `TaxData`
2. กรองข้อมูลด้วยเงื่อนไข:
   - Column T (index 19) === `'pending'`
   - Column Q (index 16) === `approve_request`
3. สำหรับแต่ละรายการ ที่ตรง:
   - แปลง Google Drive URL ของรูปภาพ → extract `fileId`
   - เรียก `setFilePublic(fileId)` เพื่อเปิดสิทธิ์ให้คนที่มี Link ดูได้
4. สร้าง object response โดย format `docDate` เป็น `dd/MM/yyyy` (ถ้าเป็น Date)
5. จำกัดผลลัพธ์สูงสุด **5 รายการ** (`LIMIT_PER_PAGE = 5`)

**Response**:
```json
[
  {
    "project": "ชื่อโครงการ",
    "reqName": "ชื่อผู้ขอเบิก",
    "pic": "https://drive.google.com/...",
    "docDate": "16/08/2026",
    "net": 1500.00,
    "remark": "หมายเหตุ",
    "recordId": "REC001"
  }
]
```

**Column Mapping** (0-based index):
```javascript
const idx = {
  status: 19,    // Column T
  reqBy: 16,     // Column Q
  project: 9,    // Column J
  reqName: 13,   // Column N
  pic: 11,       // Column L
  docDate: 5,    // Column F
  net: 8,        // Column I
  remark: 10,    // Column K
  recordId: 15   // Column P
};
```

---

### 2.4 `updateStatus` — บันทึกสถานะการจ่ายเงิน / ปฏิเสธ (Batch)

**Function**: [`updateBatchStatus(recordIds, line_uid, status)`](file:///c:/Antigravity_Data/SmartBill_Approve/code.js#L143-L158)

**Purpose**: อัพเดตสถานะบิลหลายรายการพร้อมกัน

**Request**:
```json
{
  "action": "updateStatus",
  "items": ["REC001", "REC002", "REC003"],
  "line_uid": "U1234567890abcdef...",
  "status": "Paided"
}
```

**Possible Status Values**: `"Paided"` | `"Rejected"`

**Logic**:
1. เปิด Sheet `TaxData`
2. วนลูปทุกแถว
3. เปรียบเทียบ Column P (index 15) กับ `recordIds` array
4. ถ้าตรง → เขียน:
   - Column T (index 19, sheet col 20) ← `status` ("Paided" / "Rejected")
   - Column R (index 17, sheet col 18) ← `line_uid`
   - Column S (index 18, sheet col 19) ← `new Date()` (timestamp ปัจจุบัน)
5. Return `true`

> **หมายเหตุ**: ใช้ `sheet.getRange(i + 1, <1-based column>)` ซึ่ง column ที่ระบุ:
> - Column 20 = T (status)
> - Column 18 = R (approver UID)
> - Column 19 = S (approved timestamp)

---

## 3. Helper Functions

### `setFilePublic(fileId)` — [code.js:113-120](file:///c:/Antigravity_Data/SmartBill_Approve/code.js#L113-L120)

**Purpose**: ตั้งค่าไฟล์ใน Google Drive ให้ **Anyone with Link** สามารถดูได้

**Logic**:
1. `DriveApp.getFileById(fileId)` → ดึง file object
2. `file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW)` → เปิด public view
3. หาก fail (ไม่มีสิทธิ์หรือ ID ผิด) → catch error silently

> **⚠️ Security Note**: ฟังก์ชันนี้เปลี่ยนไฟล์จาก private เป็น public โดยอัตโนมัติ
> ทุกครั้งที่ approver ดึงข้อมูล pending ระบบจะเปิดสิทธิ์ไฟล์ภาพทั้งหมดที่เกี่ยวข้อง
