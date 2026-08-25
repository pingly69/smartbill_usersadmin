/**
 * SheetHelper.js - High-Performance Google Sheets Access Layer with In-Memory Caching & Batch Operations
 * SmartBill Users Admin
 */

const SheetHelper = {
  _ss: null,
  _sheets: {},
  _headers: {},

  /**
   * Get Cached Spreadsheet instance
   */
  getSpreadsheet() {
    if (!this._ss) {
      const id = CONFIG.SPREADSHEET_ID;
      if (!id) throw new Error('SPREADSHEET_ID is not configured');
      this._ss = SpreadsheetApp.openById(id);
    }
    return this._ss;
  },

  /**
   * Get Cached Sheet by name
   */
  getSheet(sheetName) {
    if (!this._sheets[sheetName]) {
      const ss = this.getSpreadsheet();
      const sheet = ss.getSheetByName(sheetName);
      if (!sheet) {
        throw new Error(`Sheet "${sheetName}" not found in Spreadsheet (${CONFIG.SPREADSHEET_ID})`);
      }
      this._sheets[sheetName] = sheet;
    }
    return this._sheets[sheetName];
  },

  /**
   * Get Cached Column Headers for a sheet
   */
  getHeaders(sheetName) {
    if (!this._headers[sheetName]) {
      const sheet = this.getSheet(sheetName);
      const lastCol = sheet.getLastColumn();
      if (lastCol < 1) {
        this._headers[sheetName] = [];
      } else {
        const values = sheet.getRange(1, 1, 1, lastCol).getValues();
        this._headers[sheetName] = values[0].map(h => String(h || '').trim());
      }
    }
    return this._headers[sheetName];
  },

  /**
   * Get all rows as array of objects in a single batch read
   * Returns: [{ _rowIndex: 2, col1: val1, ... }]
   */
  getAllRows(sheetName) {
    const sheet = this.getSheet(sheetName);
    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();

    if (!values || values.length <= 1) {
      return []; // Only header or empty
    }

    const headers = values[0].map(h => String(h || '').trim());
    this._headers[sheetName] = headers; // Cache headers
    const rows = [];

    for (let i = 1; i < values.length; i++) {
      const rowData = values[i];
      // Check if row is completely empty
      let isBlank = true;
      for (let j = 0; j < rowData.length; j++) {
        if (rowData[j] !== '' && rowData[j] !== null && rowData[j] !== undefined) {
          isBlank = false;
          break;
        }
      }
      if (isBlank) continue;

      const obj = { _rowIndex: i + 1 };
      for (let colIdx = 0; colIdx < headers.length; colIdx++) {
        const header = headers[colIdx];
        if (header) {
          let val = rowData[colIdx];
          if (typeof val === 'string') {
            val = val.trim();
          }
          obj[header] = val;
        }
      }
      rows.push(obj);
    }

    return rows;
  },

  /**
   * Find a single row matching predicate
   */
  findRow(sheetName, predicate, preloadedRows = null) {
    const rows = preloadedRows || this.getAllRows(sheetName);
    return rows.find(predicate) || null;
  },

  /**
   * Find all rows matching predicate
   */
  findRows(sheetName, predicate, preloadedRows = null) {
    const rows = preloadedRows || this.getAllRows(sheetName);
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

    // Format specific text columns
    headers.forEach((header, idx) => {
      if (header === 'line_uid' || header === 'emp_no' || header === 'line_profile') {
        sheet.getRange(newRowIndex, idx + 1).setNumberFormat('@');
      }
    });

    return newRowIndex;
  },

  /**
   * Fast Batch Update row values by rowIndex (1-indexed)
   */
  updateRow(sheetName, rowIndex, updateObj) {
    const sheet = this.getSheet(sheetName);
    const headers = this.getHeaders(sheetName);
    if (headers.length === 0) return false;

    // Read current row to merge updates in memory
    const range = sheet.getRange(rowIndex, 1, 1, headers.length);
    const currentValues = range.getValues()[0];

    headers.forEach((header, idx) => {
      if (Object.prototype.hasOwnProperty.call(updateObj, header)) {
        currentValues[idx] = updateObj[header];
      }
    });

    // Write all values in a single batch API call
    range.setValues([currentValues]);

    // Format text columns if modified
    headers.forEach((header, idx) => {
      if (Object.prototype.hasOwnProperty.call(updateObj, header)) {
        if (header === 'line_uid' || header === 'emp_no' || header === 'line_profile') {
          sheet.getRange(rowIndex, idx + 1).setNumberFormat('@');
        }
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
