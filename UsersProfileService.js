/**
 * UsersProfileService.js - High-Performance CRUD operations for users_profile and sync with Approve_Users
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
      const is6DigitPin = Utils.isPendingPin(rawUid);
      const isEmptyUid = !rawUid;
      const isPending = is6DigitPin || isEmptyUid;
      const reqNameNormalized = Utils.normalizeName(user.Request_Name);

      // Find matching row in Approve_Users
      const approveMatch = approveRows.find(app => {
        const appUid = String(app.line_uid || '').trim();
        const appProfile = String(app.line_profile || '').trim();
        const appReq = Utils.normalizeName(app.approve_request);

        if (isPending) {
          return (rawUid && appProfile === rawUid) || (appReq === reqNameNormalized && (!appUid || Utils.isPendingPin(appUid)));
        } else {
          return appUid === rawUid || appReq === reqNameNormalized;
        }
      });

      const hasApproveRecord = !!approveMatch;
      const pettycashApprove = approveMatch ? String(approveMatch.pettycash_approve || 'NO').toUpperCase() : 'NO';
      const isControl = String(user.pettycash_control || 'NO').toUpperCase() === 'YES';
      const canApprove = hasApproveRecord && pettycashApprove === 'YES';

      return {
        line_uid: rawUid,
        Request_Name: user.Request_Name || '',
        emp_no: user.emp_no || '',
        pc_limit: Number(user['pc.limit']) || 0,
        pettycash_control: isControl ? 'YES' : 'NO',
        isPending: isPending,
        status: isPending ? 'PENDING' : 'REGISTERED',
        needsPin: isEmptyUid,
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
      const allUsers = SheetHelper.getAllRows(CONFIG.SHEET_USERS_PROFILE);
      const allApproves = SheetHelper.getAllRows(CONFIG.SHEET_APPROVE_USERS);

      // 1. Uniqueness check for Request_Name in memory
      const normReqName = Utils.normalizeName(reqName);
      const isDuplicate = allUsers.some(row => Utils.normalizeName(row.Request_Name) === normReqName);
      if (isDuplicate) {
        return { success: false, message: 'ชื่อนี้มีอยู่ในระบบแล้ว กรุณาใช้ชื่ออื่น' };
      }

      // 2. Gather existing PINs across sheets
      const existingPins = new Set();
      allUsers.forEach(u => {
        const uid = String(u.line_uid || '').trim();
        if (Utils.isPendingPin(uid)) existingPins.add(uid);
      });
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

      // 5. Handle Approve_Users sync (Always populate line_uid with PIN consistently)
      if (isControl) {
        SheetHelper.appendRow(CONFIG.SHEET_APPROVE_USERS, {
          approve_request: reqName,
          line_profile: newPin,
          line_uid: newPin,
          pettycash_approve: 'NO'
        });
      } else if (canApprove) {
        SheetHelper.appendRow(CONFIG.SHEET_APPROVE_USERS, {
          approve_request: reqName,
          line_profile: newPin,
          line_uid: newPin,
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

    if (!targetUid && !data.Request_Name) {
      return { success: false, message: 'ไม่พบข้อมูลผู้ใช้ที่ต้องการแก้ไข' };
    }
    if (!newReqName) {
      return { success: false, message: 'กรุณาระบุชื่อผู้ใช้ (Request_Name)' };
    }

    return SheetHelper.withLock(() => {
      const allUsers = SheetHelper.getAllRows(CONFIG.SHEET_USERS_PROFILE);
      const allApproves = SheetHelper.getAllRows(CONFIG.SHEET_APPROVE_USERS);

      // 1. Find user in memory
      const userRow = allUsers.find(row => {
        const uid = String(row.line_uid || '').trim();
        if (targetUid && uid === targetUid) return true;
        // Fallback match by original name if targetUid was empty
        return Utils.normalizeName(row.Request_Name) === Utils.normalizeName(data.old_request_name || newReqName);
      });

      if (!userRow) {
        return { success: false, message: 'ไม่พบข้อมูลผู้ใช้ในระบบ' };
      }

      const oldReqName = String(userRow.Request_Name || '').trim();
      const currentRawUid = String(userRow.line_uid || '').trim();
      const isPending = Utils.isPendingPin(currentRawUid) || !currentRawUid;

      // 2. If Request_Name changed, check uniqueness
      const normNewReqName = Utils.normalizeName(newReqName);
      if (normNewReqName !== Utils.normalizeName(oldReqName)) {
        const isDuplicate = allUsers.some(row => row._rowIndex !== userRow._rowIndex && Utils.normalizeName(row.Request_Name) === normNewReqName);
        if (isDuplicate) {
          return { success: false, message: 'ชื่อนี้มีอยู่ในระบบแล้ว กรุณาใช้ชื่ออื่น' };
        }
      }

      let finalUid = currentRawUid;
      let generatedNewPin = null;

      // 3. Check if PIN regeneration needed
      if (data.regenerate_pin || !currentRawUid) {
        const existingPins = new Set();
        allUsers.forEach(u => {
          const uid = String(u.line_uid || '').trim();
          if (Utils.isPendingPin(uid)) existingPins.add(uid);
        });
        allApproves.forEach(a => {
          const prof = String(a.line_profile || '').trim();
          const aUid = String(a.line_uid || '').trim();
          if (Utils.isPendingPin(prof)) existingPins.add(prof);
          if (Utils.isPendingPin(aUid)) existingPins.add(aUid);
        });

        generatedNewPin = Utils.generateUniquePin(existingPins);
        finalUid = generatedNewPin;
      }

      // 4. Fast Update users_profile
      SheetHelper.updateRow(CONFIG.SHEET_USERS_PROFILE, userRow._rowIndex, {
        line_uid: finalUid,
        Request_Name: newReqName,
        emp_no: newEmpNo,
        'pc.limit': newPcLimit,
        pettycash_control: isControl ? 'YES' : 'NO'
      });

      // 5. Match & Sync with Approve_Users
      const approveMatch = allApproves.find(app => {
        const appUid = String(app.line_uid || '').trim();
        const appProfile = String(app.line_profile || '').trim();
        const appReq = Utils.normalizeName(app.approve_request);

        if (currentRawUid && (appUid === currentRawUid || appProfile === currentRawUid)) {
          return true;
        }
        return appReq === Utils.normalizeName(oldReqName);
      });

      const shouldHaveApprove = isControl || canApprove;
      const targetPettycashApprove = isControl ? 'NO' : 'YES';

      if (shouldHaveApprove) {
        if (approveMatch) {
          const updatePayload = {
            approve_request: newReqName,
            pettycash_approve: targetPettycashApprove
          };
          if (isPending || generatedNewPin) {
            updatePayload.line_profile = finalUid;
            updatePayload.line_uid = finalUid;
          }
          SheetHelper.updateRow(CONFIG.SHEET_APPROVE_USERS, approveMatch._rowIndex, updatePayload);
        } else {
          SheetHelper.appendRow(CONFIG.SHEET_APPROVE_USERS, {
            approve_request: newReqName,
            line_profile: (isPending || generatedNewPin) ? finalUid : (data.displayName || newReqName),
            line_uid: finalUid,
            pettycash_approve: targetPettycashApprove
          });
        }
      } else {
        if (approveMatch) {
          SheetHelper.deleteRow(CONFIG.SHEET_APPROVE_USERS, approveMatch._rowIndex);
        }
      }

      return {
        success: true,
        message: 'บันทึกการแก้ไขข้อมูลสำเร็จ',
        data: generatedNewPin ? { pin: generatedNewPin, Request_Name: newReqName } : null
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
      const allUsers = SheetHelper.getAllRows(CONFIG.SHEET_USERS_PROFILE);
      const allApproves = SheetHelper.getAllRows(CONFIG.SHEET_APPROVE_USERS);

      const userRow = allUsers.find(row => String(row.line_uid || '').trim() === targetUid);
      if (!userRow) {
        return { success: false, message: 'ไม่พบข้อมูลผู้ใช้ในระบบ users_profile' };
      }

      const reqName = String(userRow.Request_Name || '').trim();
      const isPending = Utils.isPendingPin(targetUid);

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

      const userDeleted = SheetHelper.deleteRow(CONFIG.SHEET_USERS_PROFILE, userRow._rowIndex);
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
