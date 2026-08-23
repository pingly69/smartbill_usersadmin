# SmartBill Approve — System Overview

> **Reverse-Engineered Specification**
> สร้างจากการวิเคราะห์ source code โดยไม่มีเอกสาร original
> Generated: 2026-08-16

---

## 1. สรุปภาพรวม (Executive Summary)

**SmartBill Approve (v2.6)** คือ LINE LIFF Web Application สำหรับ**การนำเงินสดย่อยมาจ่ายคืนเงินให้ผู้ขอเบิก (Petty Cash Disbursement & Payment)** โดยผู้ถือวงเงินสดย่อยจะเข้ามากดจ่ายเงิน (Paid) หรือปฏิเสธ (Reject)

ระบบนี้ออกแบบมาให้ผู้ถือวงเงินสดย่อย (Disburser/Approver) สามารถ:
- ดูรายการบิลที่รอการจ่ายเงิน พร้อมรูปภาพหลักฐาน
- เลือกรายการแบบ batch (หลายรายการพร้อมกัน)
- กดจ่ายเงิน (Paid) หรือปฏิเสธ (Reject)

โดยข้อมูลทั้งหมดถูกจัดเก็บใน **Google Sheets** และ backend เป็น **Google Apps Script (GAS) Web App**

---

## 2. Technology Stack

| Layer | Technology | Detail |
|-------|-----------|--------|
| **Frontend Hosting** | GitHub Pages | URL: `https://pingly69.github.io/smartbill_approve/` |
| **Frontend** | HTML + TailwindCSS CDN + Vanilla JS | Single-page app ใน `index.html` (v2.6) |
| **Frontend SDK** | LINE LIFF SDK v2 | LIFF ID: `2009016720-Wih8NJa6` |
| **Backend** | Google Apps Script (GAS) | Deploy เป็น Web App (doPost) |
| **Database** | Google Sheets | Sheet ID: `1amztKC_QEVv9H7u6ubGCJYEHCHo0NWnJhT6ksNQCpnA` |
| **File Storage** | Google Drive | เก็บรูปภาพบิล, ตั้ง auto-permission |
| **Authentication** | LINE Login (via LIFF) + Password Registration + Role Filter | สิทธิ์เฉพาะ `pettycash_approve == 'NO'` |
| **Backend Deployment** | GAS Web App | Execute as: USER_DEPLOYING, Access: ANYONE_ANONYMOUS |

> **⚠️ สาเหตุที่แยก Frontend ออกจาก GAS**: LINE LIFF มีข้อจำกัดในการโหลด Web App ที่ serve จาก GAS 
> เพราะ GAS Web App ทำงานภายใน iframe ที่ซ้อนกัน ซึ่ง LINE LIFF SDK ไม่สามารถ init ได้ถูกต้อง
> จึงต้องแยก Frontend ไป host บน GitHub Pages ที่เป็น top-level page แล้วเรียก GAS backend ผ่าน fetch API

---

## 3. Architecture Diagram

```
┌─────────────────────────────┐
│     LINE App (Mobile)       │
│  ┌───────────────────────┐  │
│  │   LIFF Web App        │  │
│  │   (index.html v2.6)   │  │
│  │                       │  │
│  │  ┌─────────────────┐  │  │
│  │  │ Registration    │  │  │
│  │  │ Screen          │  │  │
│  │  └─────────────────┘  │  │
│  │  ┌─────────────────┐  │  │
│  │  │ Payment List    │  │  │
│  │  │ Screen          │  │  │
│  │  └─────────────────┘  │  │
│  └───────┬───────────────┘  │
│          │                  │
└──────────┼──────────────────┘
           │ Hosted on GitHub Pages
           │ https://pingly69.github.io/smartbill_approve/
           │
           │ fetch (POST, cross-origin)
           ▼
┌─────────────────────────────┐
│  Google Apps Script         │
│  (code.js - doPost)         │
│  Backend API Only           │
│                             │
│  Actions:                   │
│  ├─ checkUser               │ (เช็ค pettycash_approve === 'NO')
│  ├─ register                │ (เช็ค pettycash_approve === 'NO')
│  ├─ getPending              │
│  └─ updateStatus            │ (สถานะ Paided / Rejected)
│          │                  │
└──────────┼──────────────────┘
           │
    ┌──────┴──────┐
    ▼             ▼
┌────────┐  ┌──────────┐
│ Google │  │ Google   │
│ Sheets │  │ Drive    │
│        │  │ (Images) │
└────────┘  └──────────┘

Key: Frontend ≠ Backend server
     Frontend: GitHub Pages (static hosting)
     Backend:  GAS Web App (API only, no HTML serving)
     เหตุผล:   LINE LIFF iframe restriction workaround
```

---

## 4. Google Sheets Structure

### Sheet: `Approve_users`
ตาราง User ผู้มีสิทธิ์อนุมัติ / จ่ายเงินสดย่อย

| Column | Index | Field | Description |
|--------|-------|-------|-------------|
| A | 0 | `approve_request` | ชื่อ/รหัสสำหรับกรอง request ที่ต้องจ่ายเงิน |
| B | 1 | `line_profile` | เก็บ password ก่อน register, ถูกแทนที่ด้วย displayName หลัง register |
| C | 2 | `line_uid` | LINE User ID (เขียนเมื่อ register สำเร็จ) |
| D | 3 | `pettycash_approve` | สิทธิ์การเข้าใช้งาน: `NO` = เข้าใช้งานระบบนี้ได้ (ผู้ถือวงเงินสดย่อย), `YES` = ไม่มีสิทธิ์ใช้งานระบบนี้ |

### Sheet: `TaxData`
ตารางบิลที่ต้องดำเนินการ

| Column | Index | Field | Description |
|--------|-------|-------|-------------|
| F | 5 | `docDate` | วันที่เอกสาร |
| I | 8 | `net` | จำนวนเงินสุทธิ |
| J | 9 | `project` | ชื่อโครงการ |
| K | 10 | `remark` | หมายเหตุ |
| L | 11 | `pic` | URL รูปภาพบิล (Google Drive link) |
| N | 13 | `reqName` | ชื่อผู้ขอเบิก |
| P | 15 | `recordId` | รหัสบันทึก (ใช้อ้างอิงในการ paid/reject) |
| Q | 16 | `reqBy` | ชื่อ ผู้จ่าย/Approver (match กับ approve_request) |
| R | 17 | `approver_uid` | LINE UID ของผู้ดำเนินการ (เขียนเมื่อ Paid/Reject) |
| S | 18 | `approved_at` | วันเวลาที่ดำเนินการจ่ายเงิน/ปฏิเสธ |
| T | 19 | `status` | สถานะ: `pending` / `Paided` / `Rejected` |

> **หมายเหตุ**: Column index เป็น 0-based ตาม code

> **หมายเหตุ**: Column index เป็น 0-based ตาม code

---

## 5. Deployment Configuration

```json
{
  "timeZone": "Asia/Bangkok",
  "dependencies": {},
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8",
  "webapp": {
    "executeAs": "USER_DEPLOYING",
    "access": "ANYONE_ANONYMOUS"
  }
}
```

| Setting | Value | Implication |
|---------|-------|-------------|
| `executeAs` | `USER_DEPLOYING` | ใช้สิทธิ์ของ deployer ในการเข้าถึง Sheets/Drive |
| `access` | `ANYONE_ANONYMOUS` | ใครก็เข้าถึง Web App URL ได้ (ไม่ต้อง Google login) |

---

## 6. Project Files

| File | Type | Size | Role |
|------|------|------|------|
| `code.js` | SERVER_JS | 5,196 bytes | Backend API (all server-side logic) |
| `index.html` | HTML | 13,976 bytes | Frontend UI + client-side logic |
| `appsscript.json` | JSON | 213 bytes | Project manifest / configuration |

---

## 7. Key Constants

| Constant | Value | Location | Description |
|----------|-------|----------|-------------|
| `SHEET_ID` | `1amztKC_QEVv9H7u6ubGCJYEHCHo0NWnJhT6ksNQCpnA` | code.js:7 | Google Sheets ID |
| `LIMIT_PER_PAGE` | `5` | code.js:8 | จำนวนรายการ pending สูงสุดที่ดึงมาต่อครั้ง |
| `GAS_WEB_APP_URL` | `https://script.google.com/macros/s/AKfycby.../exec` | index.html:84 | Deployed Web App URL |
| `liffId` | `2009016720-Wih8NJa6` | index.html | LINE LIFF Application ID |
