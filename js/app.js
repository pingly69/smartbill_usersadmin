let userProfile = {};
let approveRequestName = "";
let pettycashApprove = "";

async function init() {
    try {
        await liff.init({ liffId: LIFF_ID });
        if (!liff.isLoggedIn()) {
            liff.login();
            return;
        }
        userProfile = await liff.getProfile();
        checkAuthorization();
    } catch (err) {
        console.error("LIFF Init Error:", err);
    }
}

async function callApi(payload) {
    document.getElementById('loading').classList.remove('hidden');
    try {
        const response = await fetch(GAS_WEB_APP_URL, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        const res = await response.json();
        if (!res.success) throw new Error(res.message);
        return res.data;
    } catch (err) {
        alert("ข้อผิดพลาด: " + err.message);
        return null;
    } finally {
        document.getElementById('loading').classList.add('hidden');
    }
}

async function checkAuthorization() {
    const data = await callApi({ action: 'checkUser', line_uid: userProfile.userId });
    if (data && data.status === 'authorized') {
        approveRequestName = data.approve_request;
        pettycashApprove = data.pettycash_approve || "NO";
        showListScreen();
    } else if (data && data.status === 'unauthorized') {
        document.getElementById('unauth-screen').classList.remove('hidden');
        if (data.message) {
            document.getElementById('unauth-message').innerText = data.message;
        }
    } else {
        document.getElementById('reg-screen').classList.remove('hidden');
    }
}

async function register() {
    const pass = document.getElementById('reg-pass').value;
    if (!pass) return alert("กรุณากรอกรหัสผ่าน");
    const data = await callApi({
        action: 'register',
        line_uid: userProfile.userId,
        displayName: userProfile.displayName,
        password: pass
    });
    if (data) {
        approveRequestName = data.approve_request;
        pettycashApprove = data.pettycash_approve || "NO";
        showListScreen();
    }
}

function showListScreen() {
    document.getElementById('reg-screen').classList.add('hidden');
    document.getElementById('list-screen').classList.remove('hidden');
    document.getElementById('user-info').innerText = `LINE UID: ${userProfile.userId}`;
    loadData();
}

async function loadData() {
    const items = await callApi({ action: 'getPending', approve_request: approveRequestName });
    const container = document.getElementById('data-container');
    container.innerHTML = "";

    if (!items || items.length === 0) {
        document.getElementById('no-data').classList.remove('hidden');
        document.getElementById('action-bar').classList.add('hidden');
        return;
    }

    document.getElementById('no-data').classList.add('hidden');
    document.getElementById('action-bar').classList.remove('hidden');

    items.forEach(item => {
        let fileId = "";
        if (item.pic.includes('id=')) {
            fileId = item.pic.split('id=')[1].split('&')[0];
        } else if (item.pic.includes('/d/')) {
            fileId = item.pic.split('/d/')[1].split('/')[0];
        }

        const thumbUrl = fileId ? `https://drive.google.com/thumbnail?id=${fileId}&sz=w400` : "";

        const card = `
            <div class="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                <div class="p-5 border-b border-gray-50 bg-indigo-50/30 flex justify-between items-center">
                    <div class="flex-1 pr-4">
                        <span class="text-[10px] font-bold text-indigo-500 uppercase block mb-0.5 tracking-wider">PROJECT</span>
                        <h3 class="font-bold text-gray-900 truncate leading-tight">${item.project || 'ไม่มีชื่อโครงการ'}</h3>
                        <p class="text-xs text-gray-500 font-medium mt-1">ผู้ขอ: ${item.reqName}</p>
                    </div>
                    <div class="text-right">
                        <p class="text-lg font-black text-indigo-600 leading-none">฿${parseFloat(item.net).toLocaleString()}</p>
                        <p class="text-[10px] text-gray-400 mt-1">${item.docDate}</p>
                    </div>
                </div>
                
                <div class="p-5 flex gap-5 items-start">
                    <div class="w-28 h-28 bg-gray-100 rounded-2xl flex-shrink-0 overflow-hidden shadow-inner cursor-pointer img-container relative group" onclick="window.open('${item.pic}', '_blank')">
                        <img src="${thumbUrl}" class="w-full h-full object-cover" 
                             onerror="this.src='https://placehold.co/400x400/e2e8f0/64748b?text=VIEW+BILL'">
                        <div class="absolute inset-0 bg-black/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                            <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                        </div>
                    </div>
                    <div class="flex-1">
                        <span class="text-[10px] font-bold text-gray-300 uppercase block mb-1">REMARK / หมายเหตุ</span>
                        <p class="text-sm text-gray-600 line-clamp-3">${item.remark || '-'}</p>
                    </div>
                </div>

                <label class="px-5 py-4 bg-gray-50 flex items-center justify-between cursor-pointer border-t border-gray-100 group">
                    <span class="text-sm font-bold text-gray-400 group-has-[:checked]:text-indigo-600 transition">เลือกรายการนี้</span>
                    <div class="relative">
                        <input type="checkbox" name="record" value="${item.recordId}" class="peer sr-only">
                        <div class="w-6 h-6 border-2 border-gray-300 rounded-lg peer-checked:border-indigo-600 peer-checked:bg-indigo-600 transition"></div>
                        <svg class="w-4 h-4 text-white absolute top-1 left-1 opacity-0 peer-checked:opacity-100 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg>
                    </div>
                </label>
            </div>
        `;
        container.innerHTML += card;
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function processApprove(status) {
    const selected = Array.from(document.querySelectorAll('input[name="record"]:checked')).map(el => el.value);
    if (selected.length === 0) return alert("กรุณาเลือกรายการที่ต้องการดำเนินการ");

    const actionLabel = status === 'Paided' ? 'Confirm Paid' : 'Confirm Reject';
    if (!confirm(`${actionLabel} สำหรับ ${selected.length} รายการ?`)) return;

    const success = await callApi({
        action: 'updateStatus',
        items: selected,
        line_uid: userProfile.userId,
        status: status
    });

    if (success) {
        loadData();
    }
}

window.onload = init;
