/**
 * ApproveUsersService.js - Service layer for Approve_Users sheet
 * SmartBill Users Admin
 */

const ApproveUsersService = {
  /**
   * Get all rows from Approve_Users sheet
   */
  getAll() {
    return SheetHelper.getAllRows(CONFIG.SHEET_APPROVE_USERS);
  },

  /**
   * Find row by real LINE UID
   */
  findByLineUid(lineUid) {
    if (!lineUid) return null;
    const target = String(lineUid).trim();
    return SheetHelper.findRow(CONFIG.SHEET_APPROVE_USERS, row => String(row.line_uid || '').trim() === target);
  },

  /**
   * Find row by line_profile (which stores PIN when pending)
   */
  findByLineProfile(profileVal) {
    if (!profileVal) return null;
    const target = String(profileVal).trim();
    return SheetHelper.findRow(CONFIG.SHEET_APPROVE_USERS, row => String(row.line_profile || '').trim() === target);
  },

  /**
   * Find row by approve_request (Request_Name)
   */
  findByApproveRequest(requestName) {
    if (!requestName) return null;
    const target = Utils.normalizeName(requestName);
    return SheetHelper.findRow(CONFIG.SHEET_APPROVE_USERS, row => Utils.normalizeName(row.approve_request) === target);
  },

  /**
   * Add a new row to Approve_Users
   */
  addRow(data) {
    return SheetHelper.appendRow(CONFIG.SHEET_APPROVE_USERS, {
      approve_request: Utils.sanitizeString(data.approve_request),
      line_profile: Utils.sanitizeString(data.line_profile),
      line_uid: Utils.sanitizeString(data.line_uid || ''),
      pettycash_approve: data.pettycash_approve === 'YES' ? 'YES' : 'NO'
    });
  },

  /**
   * Update row in Approve_Users by rowIndex
   */
  updateRow(rowIndex, updateData) {
    return SheetHelper.updateRow(CONFIG.SHEET_APPROVE_USERS, rowIndex, updateData);
  },

  /**
   * Delete row in Approve_Users by rowIndex
   */
  deleteRow(rowIndex) {
    return SheetHelper.deleteRow(CONFIG.SHEET_APPROVE_USERS, rowIndex);
  }
};
