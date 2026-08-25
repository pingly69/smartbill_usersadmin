/**
 * SmartBill Users Admin - Frontend Application Logic
 * Clean, Robust, and Modern Architecture
 */

// Global Application State
const state = {
    isAdmin: false,
    adminPin: '',
    currentPendingUser: null,
    usersList: [],
    filteredUsers: [],
    liffProfile: null,
    activeGeneratedPin: ''
};

/**
 * Initialize LIFF and Application on page load
 */
async function initApp() {
    // Set version badges
    const versionStr = typeof APP_VERSION !== 'undefined' ? APP_VERSION : 'v1.0.0';
    const vBadge = document.getElementById('app-version-badge');
    const vFooter = document.getElementById('footer-version');
    if (vBadge) vBadge.innerText = versionStr;
    if (vFooter) vFooter.innerText = versionStr;

    // Initialize LIFF if available
    try {
        if (typeof liff !== 'undefined' && typeof LIFF_ID !== 'undefined' && LIFF_ID) {
            await liff.init({ liffId: LIFF_ID });
            if (liff.isLoggedIn()) {
                state.liffProfile = await liff.getProfile();
                console.log('LIFF Profile loaded:', state.liffProfile.displayName);
            }
        }
    } catch (err) {
        console.warn('LIFF Initialization note:', err);
    }

    // Auto-focus PIN input on desktop
    const pinInput = document.getElementById('pin-input');
    if (pinInput && window.innerWidth > 640) {
        pinInput.focus();
    }
}

/**
 * Universal API Caller with UI loading overlay and error handling
 */
async function callApi(action, payload = {}) {
    showLoading(true);
    try {
        const body = JSON.stringify({ action, ...payload });
        const response = await fetch(GAS_WEB_APP_URL, {
            method: 'POST',
            body: body,
            headers: {
                'Content-Type': 'text/plain;charset=utf-8'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP Error ${response.status}: ${response.statusText}`);
        }

        const res = await response.json();
        if (!res.success) {
            throw new Error(res.message || 'เกิดข้อผิดพลาดในการประมวลผล');
        }
        return res;
    } catch (err) {
        console.error(`API Error (${action}):`, err);
        showToast(err.message, 'error');
        throw err;
    } finally {
        showLoading(false);
    }
}

/**
 * Toggle Loading Overlay
 */
function showLoading(show, text = 'กำลังโหลดข้อมูล...') {
    const loading = document.getElementById('loading');
    const loadingText = document.getElementById('loading-text');
    if (!loading) return;

    if (show) {
        if (loadingText) loadingText.innerText = text;
        loading.classList.remove('hidden');
    } else {
        loading.classList.add('hidden');
    }
}

/**
 * Handle PIN Submit on Landing Screen
 */
async function handlePinSubmit(e) {
    if (e) e.preventDefault();

    const pinInput = document.getElementById('pin-input');
    const pinError = document.getElementById('pin-error');
    const pin = pinInput ? pinInput.value.trim() : '';

    if (!pin || pin.length !== 6) {
        if (pinError) {
            pinError.innerText = 'กรุณากรอกรหัส PIN ให้ครบ 6 หลัก';
            pinError.classList.remove('hidden');
        }
        return;
    }

    if (pinError) pinError.classList.add('hidden');

    try {
        const res = await callApi('verifyPin', { pin });

        if (res.role === 'ADMIN') {
            state.isAdmin = true;
            state.adminPin = pin;
            showScreen('admin');
            showToast('เข้าสู่ระบบผู้ดูแลระบบสำเร็จ', 'success');
            await loadUsersList();
        } else if (res.role === 'USER') {
            state.currentPendingUser = {
                pin: pin,
                ...res.data
            };
            showRegistrationScreen();
        }
    } catch (err) {
        if (pinError) {
            pinError.innerText = err.message || 'รหัสไม่ถูกต้อง';
            pinError.classList.remove('hidden');
        }
        if (pinInput) {
            pinInput.value = '';
            pinInput.focus();
        }
    }
}

/**
 * Show Target Screen and hide others
 */
function showScreen(screenName) {
    const screens = {
        pin: document.getElementById('pin-screen'),
        admin: document.getElementById('admin-screen'),
        register: document.getElementById('register-screen'),
        regSuccess: document.getElementById('reg-success-screen')
    };

    Object.keys(screens).forEach(key => {
        if (screens[key]) {
            if (key === screenName) {
                screens[key].classList.remove('hidden');
            } else {
                screens[key].classList.add('hidden');
            }
        }
    });
}

/**
 * Show User Registration / Binding Screen
 */
async function showRegistrationScreen() {
    showScreen('register');

    const u = state.currentPendingUser;
    if (!u) return;

    // Fill user info
    document.getElementById('reg-name').innerText = u.requestName || '-';
    document.getElementById('reg-emp').innerText = u.empNo || '-';
    document.getElementById('reg-limit').innerText = `฿${Number(u.pcLimit || 0).toLocaleString()}`;
    document.getElementById('reg-control').innerText = u.pettycashControl === 'YES' ? 'ผู้ถือวงเงิน (YES)' : 'ไม่ได้ถือวงเงิน (NO)';

    // Fill LIFF profile if available
    if (state.liffProfile) {
        document.getElementById('reg-line-name').innerText = state.liffProfile.displayName || '-';
        if (state.liffProfile.pictureUrl) {
            const avatar = document.getElementById('reg-avatar');
            const fallback = document.getElementById('reg-avatar-fallback');
            avatar.src = state.liffProfile.pictureUrl;
            avatar.classList.remove('hidden');
            if (fallback) fallback.classList.add('hidden');
        }
    } else {
        // Attempt to login if inside LIFF
        if (typeof liff !== 'undefined' && liff.isInClient && !liff.isLoggedIn()) {
            liff.login();
        } else {
            document.getElementById('reg-line-name').innerText = 'Web Browser (ไม่มีข้อมูล LINE)';
        }
    }
}

/**
 * Complete Registration (Bind LINE UID)
 */
async function handleCompleteRegistration() {
    const u = state.currentPendingUser;
    if (!u || !u.pin) {
        showToast('ไม่พบข้อมูลการลงทะเบียน', 'error');
        return;
    }

    let lineUid = '';
    let displayName = '';

    if (state.liffProfile) {
        lineUid = state.liffProfile.userId;
        displayName = state.liffProfile.displayName;
    } else if (typeof liff !== 'undefined' && liff.isLoggedIn()) {
        const prof = await liff.getProfile();
        lineUid = prof.userId;
        displayName = prof.displayName;
    } else {
        // Fallback for testing / browser without LIFF
        lineUid = 'U_WEB_' + Math.random().toString(36).substring(2, 10);
        displayName = u.requestName;
    }

    try {
        await callApi('registerUser', {
            pin: u.pin,
            lineUid: lineUid,
            displayName: displayName
        });

        showScreen('regSuccess');
    } catch (err) {
        // Error toast already shown by callApi
    }
}

/**
 * Close LIFF Window
 */
function closeLiff() {
    if (typeof liff !== 'undefined' && liff.isInClient()) {
        liff.closeWindow();
    } else {
        window.location.reload();
    }
}

/**
 * Load all users from backend for Admin Dashboard
 */
async function loadUsersList() {
    try {
        const res = await callApi('listUsers', { adminPin: state.adminPin });
        state.usersList = res.data || [];
        updateStats();
        filterUsers();
    } catch (err) {
        console.error('Failed to load users:', err);
    }
}

/**
 * Calculate and display summary statistics
 */
function updateStats() {
    const list = state.usersList;
    const total = list.length;
    const registered = list.filter(u => u.status === 'REGISTERED').length;
    const pending = list.filter(u => u.status === 'PENDING').length;
    const control = list.filter(u => u.pettycash_control === 'YES').length;
    const approver = list.filter(u => u.can_approve === true).length;

    document.getElementById('stat-total').innerText = total;
    document.getElementById('stat-registered').innerText = registered;
    document.getElementById('stat-pending').innerText = pending;
    document.getElementById('stat-control').innerText = control;
    document.getElementById('stat-approver').innerText = approver;
}

/**
 * Filter users by search input and status dropdown
 */
function filterUsers() {
    const search = (document.getElementById('search-input')?.value || '').trim().toLowerCase();
    const filter = document.getElementById('status-filter')?.value || 'ALL';

    state.filteredUsers = state.usersList.filter(u => {
        // Search matching
        const matchSearch = !search ||
            (u.Request_Name && u.Request_Name.toLowerCase().includes(search)) ||
            (u.emp_no && u.emp_no.toLowerCase().includes(search)) ||
            (u.line_uid && u.line_uid.toLowerCase().includes(search)) ||
            (u.displayName && u.displayName.toLowerCase().includes(search));

        if (!matchSearch) return false;

        // Status matching
        if (filter === 'REGISTERED') return u.status === 'REGISTERED';
        if (filter === 'PENDING') return u.status === 'PENDING';
        if (filter === 'CONTROL') return u.pettycash_control === 'YES';
        if (filter === 'APPROVER') return u.can_approve === true;
        return true;
    });

    renderUsers();
}

/**
 * Render Users Table (Desktop) and Cards (Mobile)
 */
function renderUsers() {
    const tableBody = document.getElementById('users-table-body');
    const cardContainer = document.getElementById('users-card-container');
    const emptyState = document.getElementById('empty-state');

    if (!tableBody || !cardContainer) return;

    tableBody.innerHTML = '';
    cardContainer.innerHTML = '';

    if (state.filteredUsers.length === 0) {
        if (emptyState) emptyState.classList.remove('hidden');
        return;
    }

    if (emptyState) emptyState.classList.add('hidden');

    state.filteredUsers.forEach(u => {
        const isRegistered = u.status === 'REGISTERED';
        const isControl = u.pettycash_control === 'YES';
        const canApprove = u.can_approve === true;
        const limitFormatted = Number(u.pc_limit || 0).toLocaleString();

        // 1. Desktop Table Row
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50/80 transition';
        tr.innerHTML = `
            <td class="px-5 py-4">
                <div class="font-bold text-slate-900 text-sm">${escapeHtml(u.Request_Name)}</div>
                <div class="text-xs text-slate-400 font-mono mt-0.5">
                    ${isRegistered ? `LINE: ${escapeHtml(u.displayName || u.line_uid)}` : '<span class="text-amber-500 font-semibold">PIN Placeholder</span>'}
                </div>
            </td>
            <td class="px-4 py-4 text-xs font-semibold text-slate-700">
                ${escapeHtml(u.emp_no || '-')}
            </td>
            <td class="px-4 py-4 text-right font-bold text-sm text-slate-800">
                ฿${limitFormatted}
            </td>
            <td class="px-4 py-4 text-center">
                <span class="badge-pill ${isControl ? 'badge-control-yes' : 'badge-control-no'}">
                    ${isControl ? 'YES' : 'NO'}
                </span>
            </td>
            <td class="px-4 py-4 text-center">
                <span class="badge-pill ${canApprove ? 'badge-approver-yes' : 'badge-approver-no'}">
                    ${canApprove ? 'YES' : 'NO'}
                </span>
            </td>
            <td class="px-4 py-4 text-center">
                <span class="badge-pill ${isRegistered ? 'badge-registered' : 'badge-pending'}">
                    ${isRegistered ? 'ลงทะเบียนแล้ว' : 'รอ PIN'}
                </span>
            </td>
            <td class="px-5 py-4 text-right">
                <div class="flex items-center justify-end gap-1.5">
                    <button onclick="openEditUserModal('${escapeHtml(u.line_uid)}')" 
                            class="p-2 text-slate-500 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition" 
                            title="แก้ไขข้อมูล">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                        </svg>
                    </button>
                    <button onclick="openDeleteConfirm('${escapeHtml(u.line_uid)}', '${escapeHtml(u.Request_Name)}')" 
                            class="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition" 
                            title="ลบผู้ใช้">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                        </svg>
                    </button>
                </div>
            </td>
        `;
        tableBody.appendChild(tr);

        // 2. Mobile Card
        const card = document.createElement('div');
        card.className = 'bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-3';
        card.innerHTML = `
            <div class="flex items-start justify-between gap-2">
                <div>
                    <h4 class="font-bold text-slate-900 text-base leading-tight">${escapeHtml(u.Request_Name)}</h4>
                    <p class="text-xs text-slate-400 mt-0.5">${escapeHtml(u.emp_no || 'ไม่ระบุรหัสพนักงาน')}</p>
                </div>
                <span class="badge-pill ${isRegistered ? 'badge-registered' : 'badge-pending'} flex-shrink-0">
                    ${isRegistered ? 'ลงทะเบียนแล้ว' : 'รอ PIN'}
                </span>
            </div>

            <div class="grid grid-cols-3 gap-2 py-2.5 px-3 bg-slate-50 rounded-xl text-center">
                <div>
                    <span class="text-[10px] font-bold text-slate-400 block uppercase">วงเงิน</span>
                    <span class="text-xs font-extrabold text-slate-800">฿${limitFormatted}</span>
                </div>
                <div>
                    <span class="text-[10px] font-bold text-slate-400 block uppercase">ผู้ถือวงเงิน</span>
                    <span class="text-xs font-bold ${isControl ? 'text-brand-600' : 'text-slate-500'}">${isControl ? 'YES' : 'NO'}</span>
                </div>
                <div>
                    <span class="text-[10px] font-bold text-slate-400 block uppercase">อนุมัติชดเชย</span>
                    <span class="text-xs font-bold ${canApprove ? 'text-emerald-600' : 'text-slate-400'}">${canApprove ? 'YES' : 'NO'}</span>
                </div>
            </div>

            <div class="flex items-center justify-between pt-1 border-t border-slate-100 text-xs">
                <span class="text-slate-400 truncate max-w-[180px]">
                    ${isRegistered ? `LINE: ${escapeHtml(u.displayName || u.line_uid)}` : 'สถานะ: รอส่ง PIN'}
                </span>
                <div class="flex items-center gap-1">
                    <button onclick="openEditUserModal('${escapeHtml(u.line_uid)}')" 
                            class="px-3 py-1.5 bg-slate-100 hover:bg-brand-50 hover:text-brand-600 font-bold rounded-lg transition text-xs">
                        แก้ไข
                    </button>
                    <button onclick="openDeleteConfirm('${escapeHtml(u.line_uid)}', '${escapeHtml(u.Request_Name)}')" 
                            class="px-3 py-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 font-bold rounded-lg transition text-xs">
                        ลบ
                    </button>
                </div>
            </div>
        `;
        cardContainer.appendChild(card);
    });
}

/**
 * Open Modal to Add New User
 */
function openAddUserModal() {
    document.getElementById('modal-title').innerText = 'เพิ่มผู้ใช้ใหม่';
    document.getElementById('form-target-uid').value = '';
    document.getElementById('form-request-name').value = '';
    document.getElementById('form-emp-no').value = '';
    document.getElementById('form-pc-limit').value = '';
    document.getElementById('form-pettycash-control').checked = false;
    document.getElementById('form-can-approve').checked = false;

    handleControlSwitchChange();
    document.getElementById('user-modal').classList.remove('hidden');
}

/**
 * Open Modal to Edit Existing User
 */
function openEditUserModal(line_uid) {
    const user = state.usersList.find(u => String(u.line_uid) === String(line_uid));
    if (!user) return;

    document.getElementById('modal-title').innerText = 'แก้ไขข้อมูลผู้ใช้';
    document.getElementById('form-target-uid').value = user.line_uid;
    document.getElementById('form-request-name').value = user.Request_Name || '';
    document.getElementById('form-emp-no').value = user.emp_no || '';
    document.getElementById('form-pc-limit').value = user.pc_limit || 0;
    document.getElementById('form-pettycash-control').checked = user.pettycash_control === 'YES';
    document.getElementById('form-can-approve').checked = user.can_approve === true;

    handleControlSwitchChange();
    document.getElementById('user-modal').classList.remove('hidden');
}

/**
 * Close Add/Edit User Modal
 */
function closeUserModal() {
    document.getElementById('user-modal').classList.add('hidden');
}

/**
 * Dynamically adjust can_approve switch when pettycash_control toggle changes
 */
function handleControlSwitchChange() {
    const isControl = document.getElementById('form-pettycash-control').checked;
    const canApproveCheckbox = document.getElementById('form-can-approve');
    const helperText = document.getElementById('approver-helper-text');
    const container = document.getElementById('approver-switch-container');

    if (isControl) {
        // Pettycash fund holder cannot approve compensation to themselves
        canApproveCheckbox.checked = false;
        canApproveCheckbox.disabled = true;
        helperText.innerText = 'ผู้ถือวงเงินสดย่อย (ระบบกำหนด pettycash_approve เป็น NO ให้อัตโนมัติ)';
        helperText.classList.add('text-brand-600');
        container.classList.add('opacity-70');
    } else {
        canApproveCheckbox.disabled = false;
        helperText.innerText = 'มีสิทธิ์อนุมัติการชดเชยเงินเข้าวงเงินสดย่อย (pettycash_approve = YES)';
        helperText.classList.remove('text-brand-600');
        container.classList.remove('opacity-70');
    }
}

/**
 * Save User (Create or Update)
 */
async function handleSaveUser(e) {
    if (e) e.preventDefault();

    const targetUid = document.getElementById('form-target-uid').value.trim();
    const reqName = document.getElementById('form-request-name').value.trim();
    const empNo = document.getElementById('form-emp-no').value.trim();
    const pcLimit = parseFloat(document.getElementById('form-pc-limit').value) || 0;
    const isControl = document.getElementById('form-pettycash-control').checked;
    const canApprove = document.getElementById('form-can-approve').checked;

    if (!reqName) {
        showToast('กรุณาระบุชื่อผู้ใช้ (Request Name)', 'error');
        return;
    }

    const payload = {
        Request_Name: reqName,
        emp_no: empNo,
        pc_limit: pcLimit,
        pettycash_control: isControl ? 'YES' : 'NO',
        can_approve: canApprove
    };

    try {
        if (!targetUid) {
            // Create User
            const res = await callApi('createUser', payload);
            closeUserModal();
            showToast('เพิ่มผู้ใช้ใหม่สำเร็จ', 'success');
            await loadUsersList();

            // Show Generated PIN Popup
            if (res.data && res.data.pin) {
                showGeneratedPinModal(res.data.pin, reqName);
            }
        } else {
            // Update User
            payload.target_line_uid = targetUid;
            await callApi('updateUser', payload);
            closeUserModal();
            showToast('บันทึกการแก้ไขข้อมูลสำเร็จ', 'success');
            await loadUsersList();
        }
    } catch (err) {
        // Error toast handled by callApi
    }
}

/**
 * Show PIN Generated Modal
 */
function showGeneratedPinModal(pin, userName) {
    state.activeGeneratedPin = pin;
    document.getElementById('generated-pin-display').innerText = pin;
    document.getElementById('generated-pin-user').innerText = `ผู้ใช้: ${userName}`;
    document.getElementById('copy-pin-btn-text').innerText = 'คัดลอกรหัส PIN';
    document.getElementById('pin-modal').classList.remove('hidden');
}

/**
 * Close PIN Generated Modal
 */
function closePinModal() {
    document.getElementById('pin-modal').classList.add('hidden');
}

/**
 * Copy Generated PIN to Clipboard
 */
function copyGeneratedPin() {
    const pin = state.activeGeneratedPin;
    if (!pin) return;

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(pin).then(() => {
            document.getElementById('copy-pin-btn-text').innerText = 'คัดลอกสำเร็จแล้ว!';
            showToast(`คัดลอก PIN: ${pin} แล้ว`, 'success');
        }).catch(() => fallbackCopy(pin));
    } else {
        fallbackCopy(pin);
    }
}

function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
        document.execCommand('copy');
        document.getElementById('copy-pin-btn-text').innerText = 'คัดลอกสำเร็จแล้ว!';
        showToast(`คัดลอก PIN: ${text} แล้ว`, 'success');
    } catch (e) {
        showToast('ไม่สามารถคัดลอกได้อัตโนมัติ กรุณาจดจำรหัส PIN', 'error');
    }
    document.body.removeChild(ta);
}

/**
 * Open Delete Confirmation Modal
 */
function openDeleteConfirm(line_uid, name) {
    document.getElementById('confirm-delete-name').innerText = `"${name}"`;
    const btn = document.getElementById('btn-confirm-delete-action');
    btn.onclick = () => handleDeleteUser(line_uid);
    document.getElementById('confirm-modal').classList.remove('hidden');
}

/**
 * Close Delete Confirmation Modal
 */
function closeConfirmModal() {
    document.getElementById('confirm-modal').classList.add('hidden');
}

/**
 * Execute Delete User
 */
async function handleDeleteUser(line_uid) {
    try {
        await callApi('deleteUser', { line_uid, adminPin: state.adminPin });
        closeConfirmModal();
        showToast('ลบผู้ใช้เรียบร้อยแล้ว', 'success');
        await loadUsersList();
    } catch (err) {
        // Handled by callApi
    }
}

/**
 * Handle Logout
 */
function handleLogout() {
    state.isAdmin = false;
    state.adminPin = '';
    state.usersList = [];
    state.filteredUsers = [];

    const pinInput = document.getElementById('pin-input');
    if (pinInput) pinInput.value = '';

    showScreen('pin');
    showToast('ออกจากระบบเรียบร้อยแล้ว', 'info');
}

/**
 * Toast Notification Helper
 */
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    const bgColors = {
        success: 'bg-emerald-600 text-white shadow-emerald-500/20',
        error: 'bg-rose-600 text-white shadow-rose-500/20',
        info: 'bg-slate-800 text-white shadow-slate-900/20'
    };

    toast.className = `p-4 rounded-2xl shadow-xl flex items-center gap-3 text-xs sm:text-sm font-semibold pointer-events-auto animate-slide-up ${bgColors[type] || bgColors.info}`;
    toast.innerHTML = `
        <span>${escapeHtml(message)}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-10px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

/**
 * Utility: HTML Escape
 */
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Attach init on window load
window.addEventListener('DOMContentLoaded', initApp);
