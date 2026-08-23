/**
 * System: LINE LIFF Approval System
 * Role: Backend API (Google Apps Script)
 * Updated: เพิ่มระบบ Auto-Permission สำหรับรูปภาพ
 */

const SHEET_ID = '1amztKC_QEVv9H7u6ubGCJYEHCHo0NWnJhT6ksNQCpnA';
const LIMIT_PER_PAGE = 5; 

function doPost(e) {
  const request = JSON.parse(e.postData.contents);
  const action = request.action;
  let result;

  try {
    switch (action) {
      case 'checkUser':
        result = checkUser(request.line_uid);
        break;
      case 'register':
        result = registerUser(request.line_uid, request.displayName, request.password);
        break;
      case 'getPending':
        result = getPendingData(request.approve_request);
        break;
      case 'updateStatus':
        result = updateBatchStatus(request.items, request.line_uid, request.status);
        break;
      default:
        throw new Error('Invalid action');
    }
    return ContentService.createTextOutput(JSON.stringify({ success: true, data: result }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function checkUser(line_uid) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName('Approve_users');
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    const approveRequest = String(data[i][0]).trim();
    const userLineUid = String(data[i][2]).trim();
    const pettycashApprove = String(data[i][3] || '').trim().toUpperCase();

    if (userLineUid === line_uid && approveRequest !== 'เงินสดย่อยรอตัด') {
      if (pettycashApprove === 'NO') {
        return { 
          status: 'authorized', 
          approve_request: data[i][0],
          pettycash_approve: data[i][3]
        };
      } else {
        return { 
          status: 'unauthorized', 
          message: 'คุณไม่มีสิทธิ์เข้าใช้งานระบบนี้' 
        };
      }
    }
  }
  return { status: 'not_found' };
}

function registerUser(line_uid, displayName, password) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName('Approve_users');
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    const approveRequest = String(data[i][0]).trim();
    const storedProfileOrPass = String(data[i][1]).trim();
    const pettycashApprove = String(data[i][3] || '').trim().toUpperCase();

    if (storedProfileOrPass === String(password).trim() && approveRequest !== 'เงินสดย่อยรอตัด') {
      if (pettycashApprove !== 'NO') {
        throw new Error('บัญชีนี้ไม่มีสิทธิ์เข้าใช้งานระบบนี้');
      }
      sheet.getRange(i + 1, 3).setValue(line_uid);
      sheet.getRange(i + 1, 2).setValue(displayName);
      return { 
        success: true, 
        approve_request: data[i][0],
        pettycash_approve: data[i][3]
      };
    }
  }
  throw new Error('รหัสผ่านไม่ถูกต้อง หรือไม่มีสิทธิ์เข้าถึง');
}

// แก้ไขฟังก์ชันดึงข้อมูลให้ทำการปลดล็อคสิทธิ์ไฟล์ภาพอัตโนมัติ
function getPendingData(approve_request) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName('TaxData');
  const data = sheet.getDataRange().getValues();
  
  const idx = {
    status: 19, reqBy: 16, project: 9, reqName: 13, pic: 11, docDate: 5, net: 8, remark: 10, recordId: 15
  };

  const pendingList = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[idx.status] === 'pending' && row[idx.reqBy] === approve_request) {
      
      let picUrl = row[idx.pic];
      
      // --- ส่วนที่เพิ่ม: ปลดล็อคสิทธิ์ไฟล์ภาพให้อัตโนมัติ ---
      try {
        if (picUrl && picUrl.includes('id=')) {
          const fileId = picUrl.split('id=')[1].split('&')[0];
          setFilePublic(fileId);
        } else if (picUrl && picUrl.includes('/d/')) {
          const fileId = picUrl.split('/d/')[1].split('/')[0];
          setFilePublic(fileId);
        }
      } catch (e) {
        console.error("Cannot set permission: " + e.message);
      }
      // -------------------------------------------

      let formattedDocDate = '';
      if (row[idx.docDate] instanceof Date) {
        formattedDocDate = Utilities.formatDate(row[idx.docDate], "GMT+7", "dd/MM/yyyy");
      } else if (row[idx.docDate]) {
        const rawDateStr = String(row[idx.docDate]).trim();
        if (rawDateStr.includes('T')) {
          const d = new Date(rawDateStr);
          formattedDocDate = !isNaN(d.getTime()) ? Utilities.formatDate(d, "GMT+7", "dd/MM/yyyy") : rawDateStr.split('T')[0];
        } else {
          formattedDocDate = rawDateStr;
        }
      }

      pendingList.push({
        project: row[idx.project],
        reqName: row[idx.reqName],
        pic: picUrl,
        docDate: formattedDocDate,
        net: row[idx.net],
        remark: row[idx.remark],
        recordId: row[idx.recordId]
      });
      if (pendingList.length >= LIMIT_PER_PAGE) break;
    }
  }
  return pendingList;
}

// Helper: ตั้งค่าไฟล์ให้คนที่มี Link สามารถดูได้ (เพื่อให้ img tag แสดงผลได้)
function setFilePublic(fileId) {
  try {
    const file = DriveApp.getFileById(fileId);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (e) {
    // กรณีไม่มีสิทธิ์จัดการไฟล์ หรือ ID ผิดพลาด
  }
}

function updateBatchStatus(recordIds, line_uid, status) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName('TaxData');
  const data = sheet.getDataRange().getValues();
  const now = new Date();
  const recordIdCol = 15;
  for (let i = 1; i < data.length; i++) {
    const rowId = String(data[i][recordIdCol]);
    if (recordIds.includes(rowId)) {
      sheet.getRange(i + 1, 20).setValue(status);
      sheet.getRange(i + 1, 18).setValue(line_uid);
      sheet.getRange(i + 1, 19).setValue(now);
    }
  }
  return true;
}