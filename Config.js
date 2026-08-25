/**
 * Config.js - Central Configuration & Script Properties with In-Memory Caching
 * SmartBill Users Admin
 */

let _cachedProperties = null;
function getScriptProps() {
  if (!_cachedProperties) {
    try {
      _cachedProperties = PropertiesService.getScriptProperties().getProperties() || {};
    } catch(e) {
      _cachedProperties = {};
    }
  }
  return _cachedProperties;
}

const CONFIG = {
  get SPREADSHEET_ID() {
    const props = getScriptProps();
    return props['SPREADSHEET_ID'] || '1amztKC_QEVv9H7u6ubGCJYEHCHo0NWnJhT6ksNQCpnA';
  },
  get SHEET_USERS_PROFILE() {
    const props = getScriptProps();
    return props['SHEET_USERS_PROFILE'] || 'users_profile';
  },
  get SHEET_APPROVE_USERS() {
    const props = getScriptProps();
    return props['SHEET_APPROVE_USERS'] || 'Approve_Users';
  },
  get ADMIN_PINCODE() {
    const props = getScriptProps();
    const pin = props['ADMIN_PINCODE'];
    return pin ? String(pin).trim() : '999999';
  },
  PIN_LENGTH: 6,
  PIN_MIN: 100000,
  PIN_MAX: 999999,
  LOCK_TIMEOUT_MS: 30000
};

/**
 * Setup Script Properties automatically from default spec values.
 * Run this function once from Apps Script Editor or via setup action.
 */
function setupScriptProperties(customAdminPin) {
  const adminPin = customAdminPin ? String(customAdminPin).trim() : (CONFIG.ADMIN_PINCODE || '999999');
  const properties = {
    SPREADSHEET_ID: '1amztKC_QEVv9H7u6ubGCJYEHCHo0NWnJhT6ksNQCpnA',
    SHEET_USERS_PROFILE: 'users_profile',
    SHEET_APPROVE_USERS: 'Approve_Users',
    ADMIN_PINCODE: adminPin
  };
  
  PropertiesService.getScriptProperties().setProperties(properties);
  _cachedProperties = properties;
  Logger.log('Script Properties setup successfully: %s', JSON.stringify(properties));
  return {
    success: true,
    message: 'Script Properties configured successfully',
    properties: properties
  };
}

/**
 * Alias for easy execution in Apps Script Editor dropdown
 */
function setup() {
  return setupScriptProperties('999999');
}
