# Changelog

All notable changes to the **SmartBill Users Admin** project will be documented in this file.

## [v1.0.0] - 2026-08-25

### Added
- **Google Apps Script Backend (Modular)**:
  - `Config.js`: Centralized configuration (`SPREADSHEET_ID`, `SHEET_USERS_PROFILE`, `SHEET_APPROVE_USERS`, `ADMIN_PINCODE`) with automated `setupScriptProperties()` and `setup()` functions.
  - `SheetHelper.js`: Robust generic Google Sheets CRUD layer with `LockService` concurrency control.
  - `Utils.js`: 6-digit random PIN generator with 50-iteration retry safety cap, uniqueness checks against admin and pending PINs, regex validators, and JSON response helper.
  - `AuthService.js`: Two-step verification order (Admin PIN first, followed by pending User PIN) and atomic LINE UID registration.
  - `UsersProfileService.js`: Full CRUD for `users_profile` with case-insensitive `Request_Name` uniqueness validation and bidirectional synchronization with `Approve_Users`.
  - `ApproveUsersService.js`: Query and management helper methods for `Approve_Users` sheet.
  - `Code.js`: Clean `doGet` and `doPost` Web App routers with centralized error handling.
- **Frontend Web & LINE LIFF (GitHub Pages)**:
  - `index.html`: Responsive single-page application containing PIN landing screen, Admin Dashboard, Add/Edit User modal, PIN Reveal modal with 1-click copy, and User Registration / LINE binding screen.
  - `css/style.css`: Modern design system featuring glassmorphism, micro-animations, tailored color palette, mobile-first responsive layout, and custom toggle switches.
  - `js/config.js`: Application configuration with deployment URL, LIFF ID, and APP_VERSION.
  - `js/app.js`: State management, LIFF profile integration, API communications, search & filter controllers, and toast notifications.
- **Business Logic Integration**:
  - Support for `pettycash_control == 'YES'` (automatically adds to `Approve_Users` with `pettycash_approve = 'NO'`).
  - Support for `pettycash_control == 'NO'` with independent `can_approve` toggle (adds to `Approve_Users` with `pettycash_approve = 'YES'` when enabled, or removes/omits when disabled).
