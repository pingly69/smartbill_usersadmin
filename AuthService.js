/**
 * AuthService.js - Authentication, PIN Verification, and Identity Registration
 * SmartBill Users Admin
 */

const AuthService = {
  /**
   * Verify entered PIN (Admin PIN checked first, then pending User PIN)
   */
  verifyPin(pin) {
    const inputPin = Utils.sanitizeString(pin);
    if (!inputPin) {
      return { success: false, message: 'กรุณากรอกรหัส PIN' };
    }

    const adminPin = String(CONFIG.ADMIN_PINCODE).trim();

    // 1. Check against ADMIN_PINCODE first
    if (adminPin && inputPin === adminPin) {
      return {
        success: true,
        role: 'ADMIN',
        message: 'เข้าสู่ระบบผู้ดูแลระบบสำเร็จ'
      };
    }

    // 2. Check against pending users in users_profile
    if (Utils.isPendingPin(inputPin)) {
      const userRow = SheetHelper.findRow(CONFIG.SHEET_USERS_PROFILE, row => {
        const uid = String(row.line_uid || '').trim();
        return Utils.isPendingPin(uid) && uid === inputPin;
      });

      if (userRow) {
        return {
          success: true,
          role: 'USER',
          isPending: true,
          data: {
            requestName: userRow.Request_Name || '',
            empNo: userRow.emp_no || '',
            pcLimit: userRow['pc.limit'] || 0,
            pettycashControl: userRow.pettycash_control || 'NO'
          },
          message: 'พบข้อมูลผู้ใช้ พร้อมทำการลงทะเบียน'
        };
      }
    }

    // 3. Invalid PIN (Generic error to prevent PIN guessing)
    return {
      success: false,
      message: 'รหัสไม่ถูกต้อง'
    };
  },

  /**
   * Register real LINE UID into users_profile and Approve_Users
   */
  registerUser(matchedPin, lineUid, displayName) {
    const pin = Utils.sanitizeString(matchedPin);
    const uid = Utils.sanitizeString(lineUid);
    const name = Utils.sanitizeString(displayName);

    if (!pin || !uid) {
      return { success: false, message: 'ข้อมูลไม่ครบถ้วน (ต้องระบุ PIN และ LINE UID)' };
    }

    return SheetHelper.withLock(() => {
      // Find pending user in users_profile
      const userRow = SheetHelper.findRow(CONFIG.SHEET_USERS_PROFILE, row => {
        const rowUid = String(row.line_uid || '').trim();
        return Utils.isPendingPin(rowUid) && rowUid === pin;
      });

      if (!userRow) {
        return {
          success: false,
          message: 'ไม่พบรายการผู้ใช้ที่รอลงทะเบียนด้วยรหัส PIN นี้ (อาจมีการลงทะเบียนไปแล้ว)'
        };
      }

      // Update users_profile
      SheetHelper.updateRow(CONFIG.SHEET_USERS_PROFILE, userRow._rowIndex, {
        line_uid: uid
      });

      // Find matching row in Approve_Users (matched by line_profile == PIN or approve_request)
      const approveRow = SheetHelper.findRow(CONFIG.SHEET_APPROVE_USERS, row => {
        const profile = String(row.line_profile || '').trim();
        const rowUid = String(row.line_uid || '').trim();
        const reqName = Utils.normalizeName(row.approve_request);
        const targetReq = Utils.normalizeName(userRow.Request_Name);

        return profile === pin || rowUid === pin || (reqName === targetReq && (!rowUid || Utils.isPendingPin(rowUid)));
      });

      if (approveRow) {
        SheetHelper.updateRow(CONFIG.SHEET_APPROVE_USERS, approveRow._rowIndex, {
          line_uid: uid,
          line_profile: name || userRow.Request_Name || uid
        });
      }

      return {
        success: true,
        message: 'ยืนยันตัวตนสำเร็จ',
        data: {
          lineUid: uid,
          displayName: name,
          requestName: userRow.Request_Name
        }
      };
    });
  }
};
