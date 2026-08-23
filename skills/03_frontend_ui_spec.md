# SmartBill Approve — Frontend UI Specification

> **Source**: [`index.html`](file:///c:/Antigravity_Data/SmartBill_Approve/index.html)
> Reverse-Engineered from source code

---

## 1. Page Structure

`index.html` เป็น **Single Page Application (SPA)** ที่มีหน้าจอหลักและ overlay ดังนี้:

```
┌────────────────────────────┐
│  Loading Overlay (#loading)│ ← แสดงตอนเรียก API
│  (spinner + pulse text)    │
├────────────────────────────┤
│                            │
│  Unauthorized Screen       │ ← แสดงถ้า pettycash_approve !== 'NO'
│  (#unauth-screen)          │
│                            │
├────────────────────────────┤
│                            │
│  Registration Screen       │ ← แสดงถ้ายังไม่ register
│  (#reg-screen)             │
│                            │
├────────────────────────────┤
│                            │
│  List Screen               │ ← แสดงรายการ pending
│  (#list-screen)            │
│  ┌──────────────────────┐  │
│  │ Header (sticky)      │  │
│  │ - Title + UID info   │  │
│  │ - Refresh button     │  │
│  ├──────────────────────┤  │
│  │ Data Container       │  │
│  │ (#data-container)    │  │
│  │ - Card 1             │  │
│  │ - Card 2             │  │
│  │ - ...                │  │
│  ├──────────────────────┤  │
│  │ No Data Message      │  │
│  │ (#no-data)           │  │
│  ├──────────────────────┤  │
│  │ Action Bar (floating)│  │
│  │ - Reject / Paid      │  │
│  └──────────────────────┘  │
└────────────────────────────┘
```

---

## 2. Screens Detail

### 2.1 Loading Overlay — [index.html:19-22](file:///c:/Antigravity_Data/SmartBill_Approve/index.html#L19-L22)

| Element | Description |
|---------|-------------|
| CSS spinner | `border-top-color: #3498db`, หมุน 360° loop |
| Loading text | "กำลังดึงข้อมูลล่าสุด..." พร้อม `animate-pulse` |
| Backdrop | `bg-white/80 backdrop-blur-sm` |
| Behavior | แสดงทุกครั้งก่อนเรียก API, ซ่อนหลัง API return |

---

### 2.2 Unauthorized Screen — [index.html:24-37](file:///c:/Antigravity_Data/SmartBill_Approve/index.html#L24-L37)

**แสดงเมื่อ**: `checkUser` return `status: 'unauthorized'` (เมื่อผู้ใช้มี `pettycash_approve !== 'NO'`)

| Element | Type | Description |
|---------|------|-------------|
| Icon | SVG warning | วงกลมสีเหลืองอำพัน + ไอคอนเครื่องหมายตกใจ |
| Title | Text | "ไม่มีสิทธิ์เข้าใช้งาน" |
| Message | Text | "คุณไม่มีสิทธิ์เข้าใช้งานระบบนี้ (สำหรับผู้ถือวงเงินสดย่อยเท่านั้น)" |

---

### 2.3 Registration Screen — [index.html:39-55](file:///c:/Antigravity_Data/SmartBill_Approve/index.html#L39-L55)

**แสดงเมื่อ**: `checkUser` return `status: 'not_found'`

| Element | Type | Description |
|---------|------|-------------|
| Icon | SVG lock | วงกลมสีม่วง + ไอคอนแม่กุญแจ |
| Title | Text | "ลงทะเบียนผู้อนุมัติ" |
| Subtitle | Text | "ระบุรหัสผ่านส่วนตัวเพื่อเริ่มการอนุมัติ" |
| Password input | `<input type="password">` | ID: `reg-pass`, placeholder: "กรอกรหัสผ่านของคุณ" |
| Submit button | Button | "ยืนยันตัวตน", สี `bg-indigo-600`, มี `active:scale-95` effect |

**User Flow**:
1. ผู้ใช้กรอกรหัสผ่าน
2. กด "ยืนยันตัวตน"
3. เรียก `register()` → API `register` action (ตรวจสอบสิทธิ์ `pettycash_approve === 'NO'`)
4. สำเร็จ → ซ่อน reg-screen, แสดง list-screen, เรียก `loadData()`
5. ล้มเหลว → alert error message

---

### 2.4 List Screen — [index.html:57-99](file:///c:/Antigravity_Data/SmartBill_Approve/index.html#L57-L99)

**แสดงเมื่อ**: `checkUser` return `status: 'authorized'` หรือ register สำเร็จ

#### Header (Sticky)
| Element | Description |
|---------|-------------|
| Title | "SmartBill Approve v2.6" (`font-black text-xl text-indigo-900`) |
| User info | แสดง `LINE UID: <uid>` ขนาด 10px |
| Refresh button | SVG refresh icon, กด → `loadData()` |

#### Bill Card Template

แต่ละ card ประกอบด้วย 3 ส่วน:

**Card Header** (`bg-indigo-50/30`):
```
┌─────────────────────────────────┐
│ [ชื่อโครงการ]          ฿1,500   │
│ ผู้ขอ: ชื่อ            16/08/26 │
└─────────────────────────────────┘
```

**Card Body**:
```
┌─────────────────────────────────┐
│ ┌────────┐  REMARK / หมายเหตุ  │
│ │  รูป   │  ข้อความหมายเหตุ    │
│ │  บิล   │                     │
│ └────────┘                     │
└─────────────────────────────────┘
```
- รูปภาพ: ใช้ Google Drive thumbnail API (`/thumbnail?id=<fileId>&sz=w400`)
- กดรูป → เปิด original URL ใน new tab
- Fallback image: `placehold.co/400x400` แสดงข้อความ "VIEW BILL"

**Card Footer** (Checkbox):
```
┌─────────────────────────────────┐
│ เลือกรายการนี้           ☐/☑   │
└─────────────────────────────────┘
```
- Custom checkbox styling (peer-checked)
- Value = `recordId`

#### No Data Message — [index.html:77-85](file:///c:/Antigravity_Data/SmartBill_Approve/index.html#L77-L85)
- แสดงเมื่อไม่มี pending items
- ไอคอนวงกลมเขียว + check mark
- "จัดการเรียบร้อยแล้ว!" / "ไม่มีรายการที่ต้องจ่ายเงินในขณะนี้"

#### Floating Action Bar — [index.html:87-98](file:///c:/Antigravity_Data/SmartBill_Approve/index.html#L87-L98)
- ตำแหน่ง: `fixed bottom-6`, glassmorphism style
- ปุ่ม 2 ปุ่มเรียงกัน:

| Button | Style | Action |
|--------|-------|--------|
| **Reject** | White bg, red border+text | `processApprove('Rejected')` |
| **Paid** | Indigo bg, white text, shadow | `processApprove('Paided')` |

- ซ่อนเมื่อไม่มีข้อมูล, แสดงเมื่อมีข้อมูล

---

## 3. Image Handling

ระบบจัดการรูปภาพจาก Google Drive ดังนี้:

### URL Parsing (ทำทั้ง Frontend + Backend)
```javascript
// Pattern 1: https://drive.google.com/open?id=FILE_ID
if (url.includes('id=')) fileId = url.split('id=')[1].split('&')[0];

// Pattern 2: https://drive.google.com/file/d/FILE_ID/view
if (url.includes('/d/')) fileId = url.split('/d/')[1].split('/')[0];
```

### Thumbnail URL
```
https://drive.google.com/thumbnail?id={fileId}&sz=w400
```

### Auto-Permission (Backend)
- ทุกครั้งที่เรียก `getPending` ระบบจะ call `setFilePublic(fileId)` สำหรับทุกรูป
- เปลี่ยนสิทธิ์เป็น `ANYONE_WITH_LINK` + `VIEW`

---

## 4. CSS & Styling

### Framework
- **TailwindCSS** via CDN: `https://cdn.tailwindcss.com`
- ไม่มี custom configuration, ใช้ default theme

### Custom CSS — [index.html:13-18](file:///c:/Antigravity_Data/SmartBill_Approve/index.html#L13-L18)
```css
/* Loading spinner */
.loader { border-top-color: #3498db; animation: spin 1s linear infinite; }
@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

/* Image touch feedback */
.img-container img { transition: transform 0.3s; }
.img-container:active img { transform: scale(1.05); }
```

### Cache Control
```html
<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
<meta http-equiv="Pragma" content="no-cache">
<meta http-equiv="Expires" content="0">
```

---

## 5. Design System Summary

| Element | Color/Style |
|---------|-------------|
| Primary | Indigo-600 (`#4F46E5`) |
| Background | Gray-100 |
| Cards | White, `rounded-3xl`, subtle shadow |
| Buttons | `rounded-xl`, `active:scale-95` effect |
| Typography | System font (`font-sans`) |
| Glassmorphism | Action bar: `bg-white/90 backdrop-blur-md` |
