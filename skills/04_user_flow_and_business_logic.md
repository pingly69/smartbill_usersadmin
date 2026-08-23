# SmartBill Approve — User Flow & Business Logic

> Reverse-Engineered from source code
> Generated: 2026-08-16

---

## 1. Complete User Flow Diagram

```
┌──────────────────┐
│  เปิด LIFF App   │
│  (LINE Browser)  │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐     ┌──────────────────┐
│  LIFF Init       │────▶│  Not Logged In?  │
│  liffId:         │     │  → liff.login()  │
│  2009016720-...  │     │  → redirect back │
└────────┬─────────┘     └──────────────────┘
         │ logged in
         ▼
┌──────────────────┐
│  getProfile()    │
│  → userId        │
│  → displayName   │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  checkUser(uid)  │
│  API call        │
└────────┬─────────┘
         │
    ┌────┼──────────────┐
    │    │              │
    ▼    ▼              ▼
authorized unauthorized not_found
    │    │              │
    │    │              ▼
    │    │     ┌──────────────────┐
    │    │     │  Registration    │
    │    │     │  Screen          │
    │    │     │  → input password│
    │    │     └────────┬─────────┘
    │    │              │
    │    │              ▼
    │    │     ┌──────────────────┐
    │    │     │  register()      │
    │    │     │  → match password│
    │    │     │  → check         │
    │    │     │    pettycash='NO'│
    │    │     │  → save UID      │
    │    │     │  → save name     │
    │    │     └────────┬─────────┘
    │    │              │ success
    │    ▼              │
    │  ┌──────────────┐ │
    │  │ Unauthorized │ │
    │  │ Screen       │ │
    │  │ (pettycash   │ │
    │  │  approve!=NO)│ │
    │  └──────────────┘ │
    ▼                   ▼
┌──────────────────────────┐
│  showListScreen()        │
│  → show #list-screen     │
│  → show LINE UID         │
│  → call loadData()       │
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│  loadData()              │
│  → getPending API        │
│  → filter: pending +     │
│    matching approver     │
│  → auto-set file public  │
│  → max 5 items           │
└────────────┬─────────────┘
             │
    ┌────────┴────────┐
    │                 │
    ▼                 ▼
 items > 0        items = 0
    │                 │
    ▼                 ▼
┌──────────┐   ┌────────────┐
│ Show     │   │ Show       │
│ Cards +  │   │ "จัดการ    │
│ Action   │   │ เรียบร้อย" │
│ Bar      │   │ message    │
└────┬─────┘   └────────────┘
     │
     ▼
┌──────────────────────────┐
│  User selects checkbox   │
│  (one or more cards)     │
└────────────┬─────────────┘
             │
    ┌────────┴────────┐
    │                 │
    ▼                 ▼
  Paid             Reject
    │                 │
    ▼                 ▼
┌──────────────────────────┐
│  confirm dialog          │
│  "Confirm Paid/Reject    │
│   สำหรับ N รายการ?"      │
└────────────┬─────────────┘
             │ OK
             ▼
┌──────────────────────────┐
│  updateStatus API        │
│  → items: [recordIds]    │
│  → status: Paided/       │
│    Rejected              │
│  → line_uid: user UID    │
│  → writes:               │
│    - status column       │
│    - approver UID        │
│    - timestamp           │
└────────────┬─────────────┘
             │ success
             ▼
┌──────────────────────────┐
│  loadData() again        │
│  → refresh list          │
│  (paid items no          │
│   longer appear)         │
└──────────────────────────┘
```

---

## 2. Business Rules

### 2.1 Authentication & Authorization

| Rule | Description |
|------|-------------|
| LINE Login Required | ต้อง login ผ่าน LINE ก่อนเข้าใช้งาน (LIFF enforces) |
| Role Restriction | **เฉพาะผู้ที่มี `pettycash_approve == 'NO'` ใน `Approve_users` เท่านั้น** ที่เข้าใช้งานได้ |
| One-Time Registration | ใช้ password matching เพื่อจับคู่ LINE UID กับ approver slot |
| Password Overwrite | หลัง register สำเร็จ, password ถูกแทนที่ด้วย displayName |
| Re-registration | ไม่สามารถ re-register ได้ (password ถูก overwrite แล้ว) |
| Device Change | ถ้า approver เปลี่ยน LINE account/device จะต้องแก้ Sheet ด้วยมือ |

### 2.2 Data Visibility

| Rule | Description |
|------|-------------|
| Filtered by Approver | แต่ละ approver เห็นเฉพาะบิลที่ assign ให้ตัวเอง (`reqBy === approve_request`) |
| Status Filter | แสดงเฉพาะ status = `pending` |
| Page Limit | แสดงสูงสุด 5 รายการต่อครั้ง |
| No Pagination | ไม่มีปุ่ม next page, ต้อง paid/reject ชุดปัจจุบันก่อนจึงจะเห็นชุดถัดไป |

### 2.3 Payment / Approval Process

| Rule | Description |
|------|-------------|
| Meaning of Action | เป็นการนำเงินสดย่อยมาจ่ายคืนเงินให้ผู้ขอเบิก โดยผู้ถือวงเงินสดย่อยเข้ามากด Paid หรือ Reject |
| Batch Operation | เลือกหลายรายการแล้ว Paid/Reject พร้อมกัน |
| Confirmation Required | แสดง confirm dialog ก่อนดำเนินการทุกครั้ง (`Confirm Paid` / `Confirm Reject`) |
| Status Values | `pending` → `Paided` หรือ `Rejected` |
| Audit Trail | บันทึก: สถานะ (`Paided`/`Rejected`), LINE UID ผู้ดำเนินการ, timestamp |
| Chat Summary Log | **เมื่อกด Paid สำเร็จ**: LIFF จะส่งข้อความสรุปรายการที่จ่ายคืนเข้าห้องแชท LINE ของผู้ใช้ทันที (`liff.sendMessages`) เพื่อให้มีหลักฐานตรวจสอบย้อนหลังในแชท (ฟรี ไม่เสียโควตา LINE OA) |
| Irreversible | ไม่มีฟีเจอร์ undo หรือกลับสถานะ |

### 2.4 Image Access

| Rule | Description |
|------|-------------|
| Auto-Public | ไฟล์ภาพถูกเปิดเป็น public อัตโนมัติตอนดึงข้อมูล |
| Thumbnail | ใช้ Google Drive thumbnail API ขนาด 400px |
| Full View | กดรูปเปิดดู original URL ใน browser ใหม่ |
| Fallback | หากโหลดรูปไม่ได้ แสดง placeholder "VIEW BILL" |

---

## 3. State Machine

```
                         ┌─────────┐
                         │ pending │
                         └────┬────┘
                              │
               ┌──────────────┼──────────────┐
               │                             │
               ▼                             ▼
         ┌────────────┐                ┌────────────┐
         │   Paided   │                │  Rejected  │
         └────────────┘                └────────────┘
```

**สถานะเป็น one-way** — ไม่สามารถกลับไป pending ได้จากระบบนี้

---

## 4. Data Flow Summary

```
[External System] ── เขียนข้อมูลบิลลง Sheet ──▶ [Google Sheets: TaxData]
                                                   │ status = "pending"
                                                   │ reqBy = "approver_name"
                                                   │
                                                   ▼
                                            [SmartBill Approve v2.6]
                                                   │
                                               Paid/Reject
                                                   │
                                                   ▼
                                            [Google Sheets: TaxData]
                                                   │ status = "Paided"/"Rejected"
                                                   │ line_uid = approver UID
                                                   │ timestamp = now
                                                   │
                                                   ▼
                                            [External System reads result]
```

> **สิ่งที่ระบบนี้ไม่ทำ**: ไม่ได้สร้างข้อมูลบิล, ไม่ได้ส่ง notification, ไม่ได้ทำ post-approval processing
> ระบบนี้เป็นเพียง **approval interface** เท่านั้น
