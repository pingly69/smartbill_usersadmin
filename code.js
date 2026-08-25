/**
 * Code.js - Main Web App Entry Point & API Router (doGet & doPost)
 * SmartBill Users Admin
 */

function doGet(e) {
  try {
    const params = (e && e.parameter) ? e.parameter : {};
    const action = params.action || 'ping';

    if (action === 'ping') {
      return Utils.jsonResponse({
        success: true,
        message: 'SmartBill Users Admin Web App is running.',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      });
    }

    if (action === 'listUsers') {
      const result = UsersProfileService.listUsers();
      return Utils.jsonResponse(result);
    }

    if (action === 'setup') {
      const result = setupScriptProperties(params.adminPin);
      return Utils.jsonResponse(result);
    }

    return Utils.jsonResponse({
      success: false,
      message: `Unknown GET action: "${action}"`
    });
  } catch (err) {
    Logger.log('Error in doGet: ' + err.toString());
    return Utils.jsonResponse({
      success: false,
      message: 'Server Error: ' + err.message
    });
  }
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return Utils.jsonResponse({
        success: false,
        message: 'No POST body provided'
      });
    }

    const payload = JSON.parse(e.postData.contents);
    const action = payload.action;

    if (!action) {
      return Utils.jsonResponse({
        success: false,
        message: 'Missing "action" in request payload'
      });
    }

    let response;

    switch (action) {
      case 'verifyPin':
        response = AuthService.verifyPin(payload.pin);
        break;

      case 'registerUser':
        response = AuthService.registerUser(
          payload.pin || payload.matchedPin,
          payload.line_uid || payload.lineUid,
          payload.displayName || payload.line_profile
        );
        break;

      case 'listUsers':
        response = UsersProfileService.listUsers();
        break;

      case 'createUser':
        response = UsersProfileService.createUser(payload);
        break;

      case 'updateUser':
        response = UsersProfileService.updateUser(payload);
        break;

      case 'deleteUser':
        response = UsersProfileService.deleteUser(payload.line_uid || payload.target_line_uid);
        break;

      case 'setup':
        response = setupScriptProperties(payload.adminPin);
        break;

      default:
        response = {
          success: false,
          message: `Unknown action: "${action}"`
        };
        break;
    }

    return Utils.jsonResponse(response);
  } catch (err) {
    Logger.log('Error in doPost: ' + err.toString());
    return Utils.jsonResponse({
      success: false,
      message: 'Server Error: ' + err.message
    });
  }
}
