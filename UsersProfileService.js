/**
 * UsersProfileService.js - CRUD operations for users_profile and sync with Approve_Users
 * SmartBill Users Admin
 */

const UsersProfileService = {
  /**
   * List all users from users_profile joined with Approve_Users status
   */
  listUsers() {
    const userRows = SheetHelper.getAllRows(CONFIG.SHEET_USERS_PROFILE);
    const approveRows = SheetHelper.getAllRows(CONFIG.SHEET_APPROVE_USERS);

    const list = userRows.map(user => {
      const rawUid = String(user.line_uid || '').trim();
      const isPending = Utils.isPendingPin(rawUid);
      const reqNameNormalized = Utils.normalizeName(user.Request_Name);

      // Find matching row in Approve_Users
      const approveMatch = approveRows.find(app => {
        const appUid = String(app.line_uid || '').trim();
        const appProfile = String(app.line_profile || '').trim();
        const appReq = Utils.normalizeName(app.approve_request);

        if (isPending) {
          return appProfile === rawUid || (appReq === reqNameNormalized && (!appUid || Utils.isPendingPin(appUid)));
        } else {
          return appUid === rawUid || appReq === reqNameNormalized;
        }
      });

      const hasApproveRecord = !!approveMatch;
      const pettycashApprove = approveMatch ? String(approveMatch.pettycash_approve || 'NO').toUpperCase() : 'NO';
      const isControl = String(user.pettycash_control || 'NO').toUpperCase() === 'YES';

      // can_approve is true if user has an approve record and pettycash_approve is YES
      const canApprove = hasApproveRecord && pettycashApprove === 'YES';

      return {
        line_uid: rawUid,
        Request_Name: user.Request_Name || '',
        emp_no: user.emp_no || '',
        pc_limit: Number(user['pc.limit']) || 0,
        pettycash_control: isControl ? 'YES' : 'NO',
        isPending: isPending,
        status: isPending ? 'PENDING' : 'REGISTERED',
        hasApproveRecord: hasApproveRecord,
        pettycash_approve: pettycashApprove,
        can_approve: canApprove,
        displayName: (approveMatch && !isPending) ? String(approveMatch.line_profile || '') : ''
      };
    });

    return {
      success: true,
      data: list
    };
  },

  /**
   * Create a new user in users_profile and sync to Approve_Users if needed
   */
  createUser(data) {
    const reqName = Utils.sanitizeString(data.Request_Name);
    const empNo = Utils.sanitizeString(data.emp_no);
    const pcLimit = Number(data.pc_limit) || 0;
    const isControl = String(data.pettycash_control || 'NO').toUpperCase() === 'YES';
    const canApprove = data.can_approve === true || String(data.can_approve || '').toUpperCase() === 'YES';

    if (!reqName) {
      return { success: false, message: 'กรุณาระบุชื่อผู้ใช้ (Request_Name)' };
    }

    return SheetHelper.withLock(() => {
      // 1. Uniqueness check for Request_Name
      const existingUser = SheetHelper.findRow(CONFIG.SHEET_USERS_PROFILE, row => {
        return Utils.normalizeName(row.Request_Name) === Utils.normalizeName(reqName);
      });

      if (existingUser) {
        return { success: false, message: 'ชื่อนี้มีอยู่ในระบบแล้ว กรุณาใช้ชื่ออื่น' };
      }

      // 2. Gather existing PINs across sheets
      const existingPins = new Set();
      const allUsers = SheetHelper.getAllRows(CONFIG.SHEET_USERS_PROFILE);
      allUsers.forEach(u => {
        const uid = String(u.line_uid || '').trim();
        if (Utils.isPendingPin(uid)) existingPins.add(uid);
      });

      const allApproves = SheetHelper.getAllRows(CONFIG.SHEET_APPROVE_USERS);
      allApproves.forEach(a => {
        const prof = String(a.line_profile || '').trim();
        if (Utils.isPendingPin(prof)) existingPins.add(prof);
      });

      // 3. Generate unique 6-digit PIN
      const newPin = Utils.generateUniquePin(existingPins);

      // 4. Append to users_profile
      SheetHelper.appendRow(CONFIG.SHEET_USERS_PROFILE, {
        line_uid: newPin,
        Request_Name: reqName,
        emp_no: empNo,
        'pc.limit': pcLimit,
        pettycash_control: isControl ? 'YES' : 'NO'
      });

      // 5. Handle Approve_Users sync according to business rules:
      // - If pettycash_control == YES -> MUST have record, pettycash_approve = 'NO'
      // - Else if can_approve == YES -> MUST have record, pettycash_approve = 'YES'
      // - Else (regular user) -> NO record in Approve_Users
      if (isControl) {
        SheetHelper.appendRow(CONFIG.SHEET_APPROVE_USERS, {
          approve_request: reqName,
          line_profile: newPin,
          line_uid: '',
          pettycash_approve: 'NO'
        });
      } else if (canApprove) {
        SheetHelper.appendRow(CONFIG.SHEET_APPROVE_USERS, {
          approve_request: reqName,
          line_profile: newPin,
          line_uid: '',
          pettycash_approve: 'YES'
        });
      }

      return {
        success: true,
        message: 'เพิ่มผู้ใช้ใหม่สำเร็จ',
        data: {
          pin: newPin,
          Request_Name: reqName,
          emp_no: empNo,
          pc_limit: pcLimit,
          pettycash_control: isControl ? 'YES' : 'NO',
          can_approve: canApprove
        }
      };
    });
  },

  /**
   * Update an existing user in users_profile and sync Approve_Users
   */
  updateUser(data) {
    const targetUid = Utils.sanitizeString(data.target_line_uid || data.line_uid);
    const newReqName = Utils.sanitizeString(data.Request_Name);
    const newEmpNo = Utils.sanitizeString(data.emp_no);
    const newPcLimit = Number(data.pc_limit) || 0;
    const isControl = String(data.pettycash_control || 'NO').toUpperCase() === 'YES';
    const canApprove = data.can_approve === true || String(data.can_approve || '').toUpperCase() === 'YES';

    if (!targetUid) {
      return { success: false, message: 'ไม่พบรหัสผู้ใช้ (line_uid) ที่ต้องการแก้ไข' };
    }
    if (!newReqName) {
      return { success: false, message: 'กรุณาระบุชื่อผู้ใช้ (Request_Name)' };
    }

    return SheetHelper.withLock(() => {
      // 1. Find user in users_profile
      const userRow = SheetHelper.findRow(CONFIG.SHEET_USERS_PROFILE, row => {
        return String(row.line_uid || '').trim() === targetUid;
      });

      if (!userRow) {
        return { success: false, message: 'ไม่พบข้อมูลผู้ใช้ในระบบ' };
      }

      const oldReqName = String(userRow.Request_Name || '').trim();
      const isPending = Utils.isPendingPin(targetUid);

      // 2. If Request_Name changed, check uniqueness
      if (Utils.normalizeName(newReqName) !== Utils.normalizeName(oldReqName)) {
        const dupRow = SheetHelper.findRow(CONFIG.SHEET_USERS_PROFILE, row => {
          return row._rowIndex !== userRow._rowIndex && Utils.normalizeName(row.Request_Name) === Utils.normalizeName(newReqName);
        });
        if (dupRow) {
          return { success: false, message: 'ชื่อนี้มีอยู่ในระบบแล้ว กรุณาใช้ชื่ออื่น' };
        }
      }

      // 3. Update users_profile
      SheetHelper.updateRow(CONFIG.SHEET_USERS_PROFILE, userRow._rowIndex, {
        Request_Name: newReqName,
        emp_no: newEmpNo,
        'pc.limit': newPcLimit,
        pettycash_control: isControl ? 'YES' : 'NO'
      });

      // 4. Sync with Approve_Users
      const allApproves = SheetHelper.getAllRows(CONFIG.SHEET_APPROVE_USERS);
      const approveMatch = allApproves.find(app => {
        const appUid = String(app.line_uid || '').trim();
        const appProfile = String(app.line_profile || '').trim();
        const appReq = Utils.normalizeName(app.approve_request);

        if (isPending) {
          return appProfile === targetUid || (appReq === Utils.normalizeName(oldReqName) && (!appUid || Utils.isPendingPin(appUid)));
        } else {
          return appUid === targetUid || appReq === Utils.normalizeName(oldReqName);
        }
      });

      const shouldHaveApprove = isControl || canApprove;
      const targetPettycashApprove = isControl ? 'NO' : 'YES';

      if (shouldHaveApprove) {
        if (approveMatch) {
          // Update existing Approve_Users record
          const updatePayload = {
            approve_request: newReqName,
            pettycash_approve: targetPettycashApprove
          };
          if (isPending) {
            updatePayload.line_profile = targetUid;
          }
          SheetHelper.updateRow(CONFIG.SHEET_APPROVE_USERS, approveMatch._rowIndex, updatePayload);
        } else {
          // Append new Approve_Users record
          SheetHelper.appendRow(CONFIG.SHEET_APPROVE_USERS, {
            approve_request: newReqName,
            line_profile: isPending ? targetUid : (data.displayName || newReqName),
            line_uid: isPending ? '' : targetUid,
            pettycash_approve: targetPettycashApprove
          });
        }
      } else {
        // User should not be in Approve_Users; delete if exists
        if (approveMatch) {
          SheetHelper.deleteRow(CONFIG.SHEET_APPROVE_USERS, approveMatch._rowIndex);
        }
      }

      return {
        success: true,
        message: 'บันทึกการแก้ไขข้อมูลสำเร็จ'
      };
    });
  },

  /**
   * Delete user from users_profile and Approve_Users
   */
  deleteUser(targetLineUid) {
    const targetUid = Utils.sanitizeString(targetLineUid);
    if (!targetUid) {
      return { success: false, message: 'ไม่พบรหัสผู้ใช้ที่ต้องการลบ' };
    }

    return SheetHelper.withLock(() => {
      // Find in users_profile
      const userRow = SheetHelper.findRow(CONFIG.SHEET_USERS_PROFILE, row => {
        return String(row.line_uid || '').trim() === targetUid;
      });

      if (!userRow) {
        return { success: false, message: 'ไม่พบข้อมูลผู้ใช้ในระบบ users_profile' };
      }

      const reqName = String(userRow.Request_Name || '').trim();
      const isPending = Utils.isPendingPin(targetUid);

      // Find in Approve_Users
      const allApproves = SheetHelper.getAllRows(CONFIG.SHEET_APPROVE_USERS);
      const approveMatch = allApproves.find(app => {
        const appUid = String(app.line_uid || '').trim();
        const appProfile = String(app.line_profile || '').trim();
        const appReq = Utils.normalizeName(app.approve_request);

        if (isPending) {
          return appProfile === targetUid || (appReq === Utils.normalizeName(reqName) && (!appUid || Utils.isPendingPin(appUid)));
        } else {
          return appUid === targetUid || appReq === Utils.normalizeName(reqName);
        }
      });

      // Delete from users_profile
      const userDeleted = SheetHelper.deleteRow(CONFIG.SHEET_USERS_PROFILE, userRow._rowIndex);

      // Delete from Approve_Users if exists
      let approveDeleted = true;
      if (approveMatch) {
        approveDeleted = SheetHelper.deleteRow(CONFIG.SHEET_APPROVE_USERS, approveMatch._rowIndex);
      }

      if (!userDeleted) {
        return { success: false, message: 'ไม่สามารถลบแถวจาก users_profile ได้' };
      }

      return {
        success: true,
        message: approveMatch && !approveDeleted
          ? 'ลบจาก users_profile สำเร็จ แต่ไม่พบลำดับใน Approve_Users'
          : 'ลบผู้ใช้เรียบร้อยแล้ว'
      };
    });
  }
};
