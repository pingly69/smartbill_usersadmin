/**
 * Utils.js - Helper utilities, validators, PIN generator, and JSON output builder
 * SmartBill Users Admin
 */

const Utils = {
  /**
   * Check if a string represents a 6-digit pending PIN
   */
  isPendingPin(val) {
    if (!val) return false;
    const str = String(val).trim();
    return /^\d{6}$/.test(str);
  },

  /**
   * Normalize name for case-insensitive and whitespace-trimmed uniqueness check
   */
  normalizeName(name) {
    if (!name) return '';
    return String(name).trim().toLowerCase();
  },

  /**
   * Sanitize string input
   */
  sanitizeString(val) {
    if (val === null || val === undefined) return '';
    return String(val).trim();
  },

  /**
   * Generate a unique 6-digit PIN that does not collide with ADMIN_PINCODE or any existing pending PINs
   */
  generateUniquePin(existingPins = new Set()) {
    const adminPin = String(CONFIG.ADMIN_PINCODE).trim();
    const pinSet = new Set(existingPins);
    if (adminPin) pinSet.add(adminPin);

    let attempts = 0;
    const maxAttempts = 50;

    while (attempts < maxAttempts) {
      attempts++;
      // Random integer between 100000 and 999999
      const randNum = Math.floor(Math.random() * (CONFIG.PIN_MAX - CONFIG.PIN_MIN + 1)) + CONFIG.PIN_MIN;
      const pinStr = String(randNum).padStart(CONFIG.PIN_LENGTH, '0');

      if (!pinSet.has(pinStr)) {
        return pinStr;
      }
    }

    throw new Error('ไม่สามารถสุ่ม PIN ที่ไม่ซ้ำได้ (เกินจำนวนรอบสูงสุด 50 รอบ) กรุณาลองใหม่อีกครั้ง');
  },

  /**
   * Build standardized JSON Response for GAS Web App
   */
  jsonResponse(data) {
    const payload = typeof data === 'object' ? JSON.stringify(data) : data;
    return ContentService.createTextOutput(payload)
      .setMimeType(ContentService.MimeType.JSON);
  }
};
