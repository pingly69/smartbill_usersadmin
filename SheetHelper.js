/**
 * SheetHelper.js - Generic Google Sheets Access Layer with LockService
 * SmartBill Users Admin
 */

const SheetHelper = {
  /**
   * Get Spreadsheet instance
   */
  getSpreadsheet() {
    const id = CONFIG.SPREADSHEET_ID;
    if (!id) throw new Error('SPREADSHEET_ID is not configured');
    return SpreadsheetApp.openById(id);
  },

  /**
   * Get Sheet by name
   */
  getSheet(sheetName) {
    const ss = this.getSpreadsheet();
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      throw new Error(`Sheet "${sheetName}" not found in Spreadsheet (${CONFIG.SPREADSHEET_ID})`);
    }
    return sheet;
  },

  /**
   * Get headers and all rows as array of objects
   * Returns: [{ _rowIndex: 2, col1: val1, ... }]
   */
  getAllRows(sheetName) {
    const sheet = this.getSheet(sheetName);
    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();

    if (lastRow < 1 || lastCol < 1) {
      return [];
    }

    const range = sheet.getRange(1, 1, lastRow, lastCol);
    const values = range.getValues();
    if (values.length <= 1) {
      return []; // Only header or empty
    }

    const headers = values[0].map(h => String(h || '').trim());
    const rows = [];

    for (let i = 1; i < values.length; i++) {
      const rowData = values[i];
      // Check if row is completely empty
      const isBlank = rowData.every(val => val === '' || val === null || val === undefined);
      if (isBlank) continue;

      const obj = { _rowIndex: i + 1 };
      headers.forEach((header, colIdx) => {
        if (header) {
          let val = rowData[colIdx];
          if (typeof val === 'string') {
            val = val.trim();
          }
          obj[header] = val;
        }
      });
      rows.push(obj);
    }

    return rows;
  },

  /**
   * Get sheet column headers
   */
  getHeaders(sheetName) {
    const sheet = this.getSheet(sheetName);
    const lastCol = sheet.getLastColumn();
    if (lastCol < 1) return [];
    const values = sheet.getRange(1, 1, 1, lastCol).getValues();
    return values[0].map(h => String(h || '').trim());
  },

  /**
   * Find a single row matching predicate
   */
  findRow(sheetName, predicate) {
    const rows = this.getAllRows(sheetName);
    return rows.find(predicate) || null;
  },

  /**
   * Find all rows matching predicate
   */
  findRows(sheetName, predicate) {
    const rows = this.getAllRows(sheetName);
    return rows.filter(predicate);
  },

  /**
   * Append a row using column header mapping
   */
  appendRow(sheetName, rowObj) {
    const sheet = this.getSheet(sheetName);
    const headers = this.getHeaders(sheetName);
    if (headers.length === 0) {
      throw new Error(`Cannot append row: Sheet "${sheetName}" has no headers.`);
    }

    const rowValues = headers.map(header => {
      const val = rowObj[header];
      return val !== undefined && val !== null ? val : '';
    });

    sheet.appendRow(rowValues);
    const newRowIndex = sheet.getLastRow();

    // Ensure line_uid or PIN columns are stored as plain text if needed
    headers.forEach((header, idx) => {
      if (header === 'line_uid' || header === 'emp_no' || header === 'line_profile') {
        const cell = sheet.getRange(newRowIndex, idx + 1);
        cell.setNumberFormat('@');
      }
    });

    return newRowIndex;
  },

  /**
   * Update row values by rowIndex (1-indexed)
   */
  updateRow(sheetName, rowIndex, updateObj) {
    const sheet = this.getSheet(sheetName);
    const headers = this.getHeaders(sheetName);

    headers.forEach((header, idx) => {
      if (Object.prototype.hasOwnProperty.call(updateObj, header)) {
        const cell = sheet.getRange(rowIndex, idx + 1);
        if (header === 'line_uid' || header === 'emp_no' || header === 'line_profile') {
          cell.setNumberFormat('@');
        }
        cell.setValue(updateObj[header]);
      }
    });
    return true;
  },

  /**
   * Delete row by rowIndex (1-indexed)
   */
  deleteRow(sheetName, rowIndex) {
    const sheet = this.getSheet(sheetName);
    if (rowIndex > 1 && rowIndex <= sheet.getLastRow()) {
      sheet.deleteRow(rowIndex);
      return true;
    }
    return false;
  },

  /**
   * Execute callback inside a distributed script lock
   */
  withLock(callback, timeoutMs = CONFIG.LOCK_TIMEOUT_MS) {
    const lock = LockService.getScriptLock();
    const hasLock = lock.tryLock(timeoutMs);
    if (!hasLock) {
      throw new Error('ระบบกำลังประมวลผลคำขออื่นอยู่ กรุณาลองใหม่อีกครั้งในครู่เดียว');
    }
    try {
      return callback();
    } finally {
      lock.releaseLock();
    }
  }
};
