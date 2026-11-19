// -------------------------------------------------------------
// 1. KONFIGURASI FIREBASE
// -------------------------------------------------------------

const firebaseConfig = {
    apiKey: "AIzaSyAoELiMsoMfqoycaWQMBRweXVr5xZJ6PGQ",
    authDomain: "smartdoorlock-pnj.firebaseapp.com",
    databaseURL: "https://smartdoorlock-pnj-default-rtdb.firebaseio.com",
    projectId: "smartdoorlock-pnj",
    storageBucket: "smartdoorlock-pnj.firebasestorage.app",
    messagingSenderId: "49116506203",
    appId: "1:49116506203:web:39a1a859cdeb83c75bb77e",
    measurementId: "G-SMNZ55PT1T"
};

// -------------------------------------------------------------
// 2. INISIALISASI FIREBASE
// -------------------------------------------------------------

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.database();

// -------------------------------------------------------------
// 3. ELEMENT DOM
// -------------------------------------------------------------

const dashboardSection = document.getElementById('dashboard-section');
const btnLogout = document.getElementById('btn-logout');
const userEmailDisplay = document.getElementById('user-email-display');

let dashboardInitialized = false;
let currentDeleteCallback = null;
let successModalTimer = null;

// -------------------------------------------------------------
// 4. AUTHENTICATION STATE
// -------------------------------------------------------------

auth.onAuthStateChanged(user => {
    if (user) {
        console.log("User login:", user.email);
        dashboardSection.classList.remove('hidden');
        userEmailDisplay.textContent = user.email || '';

        if (!dashboardInitialized) {
            initDashboardListeners();
            dashboardInitialized = true;
        }
    } else {
        console.log("User belum login");
        window.location.replace("login.html");
    }
});

// -------------------------------------------------------------
// 5. LOGOUT
// -------------------------------------------------------------

btnLogout.addEventListener('click', async () => {
    try {
        await auth.signOut();
        console.log("Logout berhasil!");
        window.location.replace("login.html");
    } catch (error) {
        console.error("Logout gagal:", error);
        alert("Logout gagal: " + error.message);
    }
});

// -------------------------------------------------------------
// 6. DASHBOARD LISTENERS
// -------------------------------------------------------------

function initDashboardListeners() {
    console.log("Dashboard listeners berhasil dijalankan");

    // A. KONTROL MANUAL PINTU
    document.getElementById('btn-unlock').addEventListener('click', async () => {
        try {
            await db.ref('smartdoor/control').set('UNLOCK');
            console.log("Perintah UNLOCK dikirim");
        } catch (error) {
            alert("Gagal membuka pintu: " + error.message);
        }
    });

    document.getElementById('btn-lock').addEventListener('click', async () => {
        try {
            await db.ref('smartdoor/control').set('LOCK');
            console.log("Perintah LOCK dikirim");
        } catch (error) {
            alert("Gagal mengunci pintu: " + error.message);
        }
    });

    // B. MONITOR LOG AKSES REAL-TIME & STATUS PINTU OTOMATIS
    const logsRef = db.ref('smartdoor/logs').limitToLast(20);
    logsRef.on('value', snapshot => {
        const logsTable = document.getElementById('logs-table-body');
        logsTable.innerHTML = '';
        
        if (!snapshot.exists()) {
            logsTable.innerHTML = '<tr><td colspan="4" class="p-4 text-center text-slate-500">Belum ada riwayat akses.</td></tr>';
            return;
        }

        let logsData = [];
        snapshot.forEach(child => {
            logsData.unshift({ id: child.key, ...child.val() });
        });

        if (logsData.length > 0) {
            const latest = logsData[0];
            document.getElementById('last-user-name').textContent = latest.userName || latest.userId || 'Tanpa Nama';
            document.getElementById('last-method').textContent = `Metode: ${latest.method || 'Unknown'}`;
            document.getElementById('last-time').textContent = `Waktu: ${latest.timestamp || '-'}`;
            
            const badge = document.getElementById('last-status-badge');
            const isGranted = latest.status === 'GRANTED' || latest.status === true;

            if (isGranted) {
                badge.className = "px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400";
                badge.textContent = "Akses Diterima";
                updateDoorUI('UNLOCKED');
                setTimeout(() => { updateDoorUI('LOCKED'); }, 4000);
            } else {
                badge.className = "px-3 py-1 rounded-full text-xs font-semibold bg-red-500/20 text-red-400";
                badge.textContent = "Akses Ditolak";
                updateDoorUI('LOCKED');
            }
        }

        logsData.forEach(log => {
            const row = document.createElement('tr');
            const isGranted = log.status === 'GRANTED' || log.status === true;
            row.innerHTML = `
                <td class="p-3 text-xs text-slate-400">${log.timestamp || '-'}</td>
                <td class="p-3 font-medium text-white">${log.userName || log.userId || 'Akses Alat'}</td>
                <td class="p-3 text-xs">${log.method || '-'}</td>
                <td class="p-3">
                    <span class="px-2 py-0.5 text-xs rounded ${isGranted ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}">
                        ${isGranted ? 'GRANTED' : 'DENIED'}
                    </span>
                </td>
            `;
            logsTable.appendChild(row);
        });
    });

    // C. TOMBOL CLEAR LOGS
    document.getElementById('btn-clear-logs').addEventListener('click', () => {
        tampilkanModalKonfirmasi("Yakin ingin menghapus seluruh riwayat akses?", async () => {
            try {
                await db.ref('smartdoor/logs').remove();
                tampilkanModalSukses("Riwayat akses berhasil dihapus!");
            } catch (error) {
                alert("Gagal menghapus log: " + error.message);
            }
        });
    });

    // D. TOGGLE FORM TAMBAH AKSES
    const btnToggleForm = document.getElementById('btn-toggle-form');
    const addAccessForm = document.getElementById('add-access-form');
    const btnCancelForm = document.getElementById('btn-cancel-form');
    const accessTypeSelect = document.getElementById('access-type');
    const pinInputContainer = document.getElementById('pin-input-container');

    btnToggleForm.onclick = () => { addAccessForm.classList.toggle('hidden'); };

    btnCancelForm.onclick = () => {
        addAccessForm.classList.add('hidden');
        addAccessForm.reset();
        pinInputContainer.classList.remove('hidden');
    };

    accessTypeSelect.onchange = (e) => {
        const val = e.target.value;
        if (val === 'valid_pin') {
            pinInputContainer.classList.remove('hidden');
            document.getElementById('access-key').required = true;
        } else {
            pinInputContainer.classList.add('hidden');
            document.getElementById('access-key').required = false;
        }
    };

    // E. FORM TAMBAH AKSES (VALIDASI PAKAI MODAL PERINGATAN)
    addAccessForm.onsubmit = async (e) => {
        e.preventDefault();
        const ownerName = document.getElementById('access-owner-name').value.trim();
        const type = document.getElementById('access-type').value;

        if (!ownerName) {
            tampilkanPeringatan("Nama pemilik / pengguna wajib diisi!");
            return;
        }

        try {
            if (type === 'valid_pin') {
                const pinVal = document.getElementById('access-key').value.trim();
                if (!pinVal) {
                    tampilkanPeringatan("Nomor PIN tidak boleh kosong!");
                    return;
                }

                await db.ref(`access_control/valid_pin/${pinVal}`).set({ name: ownerName, active: true });
                tampilkanModalSukses(`PIN untuk <b>[${ownerName}]</b> berhasil ditambahkan!`);
                addAccessForm.reset();
                addAccessForm.classList.add('hidden');
                pinInputContainer.classList.remove('hidden');

            } else if (type === 'valid_rfid') {
                await db.ref('smartdoor/command').set('ADD_RFID');
                await db.ref('smartdoor/target_name').set(ownerName);
                tampilkanModalRfid(ownerName, "rfid");
                addAccessForm.reset();
                addAccessForm.classList.add('hidden');

            } else if (type === 'fingerprint') {
                await db.ref('smartdoor/command').set('ADD_FINGERPRINT');
                await db.ref('smartdoor/target_name').set(ownerName);
                tampilkanModalRfid(ownerName, "fingerprint");
                addAccessForm.reset();
                addAccessForm.classList.add('hidden');
            }
        } catch (error) {
            alert("Gagal memproses pendaftaran: " + error.message);
        }
    };

    // F. EVENT LISTENER TOMBOL MODAL
    const btnCloseRfidModal = document.getElementById('btn-close-rfid-modal');
    if (btnCloseRfidModal) {
        btnCloseRfidModal.addEventListener('click', () => { tutupModalRfid(); });
    }

    const btnCloseAlert = document.getElementById('btn-close-alert-modal');
    if (btnCloseAlert) {
        btnCloseAlert.addEventListener('click', () => { tutupPeringatan(); });
    }

    const btnConfirmYes = document.getElementById('btn-confirm-yes');
    const btnConfirmNo = document.getElementById('btn-confirm-no');

    if (btnConfirmYes) {
        btnConfirmYes.onclick = () => {
            const callbackToRun = currentDeleteCallback;
            tutupModalKonfirmasi();
            if (typeof callbackToRun === 'function') {
                callbackToRun();
            }
        };
    }

    if (btnConfirmNo) {
        btnConfirmNo.onclick = () => { tutupModalKonfirmasi(); };
    }

    // G. MONITOR DAFTAR PIN DAN RFID
    const accessControlRef = db.ref('access_control');
    accessControlRef.on('value', snapshot => {
        const pinContainer = document.getElementById('list-pins');
        const rfidContainer = document.getElementById('list-rfid');

        pinContainer.innerHTML = '';
        rfidContainer.innerHTML = '';

        const data = snapshot.val() || {};

        const pins = data.valid_pin || {};
        if (Object.keys(pins).length === 0) {
            pinContainer.innerHTML = `<p class="text-[11px] text-slate-500">Belum ada PIN.</p>`;
        } else {
            for (const [pin, info] of Object.entries(pins)) {
                const nameLabel = (typeof info === 'object' && info !== null) ? info.name : 'Tanpa Nama';
                pinContainer.appendChild(createBadgeItem('valid_pin', pin, nameLabel));
            }
        }

        const rfids = data.valid_rfid || {};
        if (Object.keys(rfids).length === 0) {
            rfidContainer.innerHTML = `<p class="text-[11px] text-slate-500">Belum ada RFID.</p>`;
        } else {
            for (const [rfid, info] of Object.entries(rfids)) {
                const nameLabel = (typeof info === 'object' && info !== null) ? info.name : 'Tanpa Nama';
                rfidContainer.appendChild(createBadgeItem('valid_rfid', rfid, nameLabel));
            }
        }
    }, error => {
        console.error("Gagal membaca daftar akses:", error);
    });

    // H. MONITOR OTOMATIS: Tutup Modal Pendaftaran jika RFID/Fingerprint Baru Masuk ke Firebase
    const rfidCheckRef = db.ref('access_control/valid_rfid');
    rfidCheckRef.on('child_added', () => {
        const modalRfid = document.getElementById('rfidModal');
        if (modalRfid && modalRfid.style.display === 'flex') {
            tutupModalRfid();
            tampilkanModalSukses("Kartu RFID berhasil didaftarkan oleh perangkat ESP32!");
        }
    });

    const fpCheckRef = db.ref('access_control/fingerprint');
    if (fpCheckRef) {
        fpCheckRef.on('child_added', () => {
            const modalRfid = document.getElementById('rfidModal');
            if (modalRfid && modalRfid.style.display === 'flex') {
                tutupModalRfid();
                tampilkanModalSukses("Fingerprint berhasil didaftarkan oleh perangkat ESP32!");
            }
        });
    }
}

// -------------------------------------------------------------
// 7. HELPER MEMBUAT ITEM PIN / RFID
// -------------------------------------------------------------

function createBadgeItem(category, key, ownerName) {
    const item = document.createElement('div');
    item.className = "flex justify-between items-center bg-slate-700/50 px-3 py-1.5 rounded text-xs";

    const infoDiv = document.createElement('div');
    infoDiv.className = "flex flex-col";

    const keyText = document.createElement('span');
    keyText.className = "font-mono text-white font-medium";
    keyText.textContent = key;

    const nameText = document.createElement('span');
    nameText.className = "text-[10px] text-emerald-400";
    nameText.textContent = `Pemilik: ${ownerName}`;

    infoDiv.appendChild(keyText);
    infoDiv.appendChild(nameText);

    const deleteButton = document.createElement('button');
    deleteButton.className = "text-red-400 hover:text-red-300 ml-2";
    deleteButton.innerHTML = '<i class="fa-solid fa-trash"></i>';
    deleteButton.title = "Hapus akses";
    deleteButton.addEventListener('click', () => {
        deleteAccess(category, key);
    });

    item.appendChild(infoDiv);
    item.appendChild(deleteButton);
    return item;
}

// -------------------------------------------------------------
// 8. HAPUS PIN / RFID
// -------------------------------------------------------------

function deleteAccess(category, key) {
    tampilkanModalKonfirmasi(`Yakin ingin menghapus [<b>${key}</b>] dari <b>${category}</b>?`, async () => {
        try {
            await db.ref(`access_control/${category}/${key}`).remove();
            console.log("Akses berhasil dihapus:", key);
            tampilkanModalSukses(`Data [${key}] berhasil dihapus!`);
        } catch (error) {
            alert("Gagal menghapus akses: " + error.message);
        }
    });
}

// -------------------------------------------------------------
// 9. UPDATE UI STATUS PINTU
// -------------------------------------------------------------

function updateDoorUI(status) {
    const container = document.getElementById('door-icon-container');
    const icon = document.getElementById('door-icon');
    const text = document.getElementById('door-status-text');

    if (status === 'UNLOCKED') {
        container.className = "w-20 h-20 rounded-full flex items-center justify-center bg-emerald-500/15 text-emerald-500 mb-3 transition-all duration-300";
        icon.className = "fa-solid fa-lock-open text-4xl";
        text.className = "text-2xl font-bold text-emerald-400";
        text.textContent = "TERBUKA";
    } else {
        container.className = "w-20 h-20 rounded-full flex items-center justify-center bg-red-500/15 text-red-500 mb-3 transition-all duration-300";
        icon.className = "fa-solid fa-lock text-4xl";
        text.className = "text-2xl font-bold text-red-400";
        text.textContent = "TERKUNCI";
    }
}

// -------------------------------------------------------------
// 10. KONTROL CUSTOM MODAL (RFID / FINGERPRINT)
// -------------------------------------------------------------

function tampilkanModalRfid(nama, mode) {
    const modal = document.getElementById('rfidModal');
    const textEl = document.getElementById('rfidModalText');
    
    if (mode === 'fingerprint') {
        textEl.innerHTML = `Mode pendaftaran Fingerprint diaktifkan untuk <b>[${nama}]</b>.<br>Silakan masukkan ID via Keypad perangkat.`;
    } else {
        textEl.innerHTML = `Mode pendaftaran RFID diaktifkan untuk <b>[${nama}]</b>.<br>Silakan tempelkan kartu pada perangkat ESP32.`;
    }
    modal.style.display = 'flex';
}

function tutupModalRfid() {
    const modal = document.getElementById('rfidModal');
    modal.style.display = 'none';
    db.ref('smartdoor/command').set('IDLE').catch(err => console.log(err));
}

// -------------------------------------------------------------
// 11. KONTROL CUSTOM MODAL SUKSES (AUTO-CLOSE 2.5 DETIK)
// -------------------------------------------------------------

function tampilkanModalSukses(pesan) {
    const modal = document.getElementById('successModal');
    const textEl = document.getElementById('successModalText');
    textEl.innerHTML = pesan;
    modal.style.display = 'flex';

    if (successModalTimer) {
        clearTimeout(successModalTimer);
    }

    successModalTimer = setTimeout(() => {
        tutupModalSukses();
    }, 2500);
}

function tutupModalSukses() {
    const modal = document.getElementById('successModal');
    modal.style.display = 'none';
    if (successModalTimer) {
        clearTimeout(successModalTimer);
        successModalTimer = null;
    }
}

// -------------------------------------------------------------
// 12. KONTROL CUSTOM MODAL PERINGATAN / ERROR
// -------------------------------------------------------------

function tampilkanPeringatan(pesan) {
    const modal = document.getElementById('alertModal');
    const textEl = document.getElementById('alertModalText');
    textEl.innerHTML = pesan;
    modal.style.display = 'flex';
}

function tutupPeringatan() {
    const modal = document.getElementById('alertModal');
    modal.style.display = 'none';
}

// -------------------------------------------------------------
// 13. KONTROL CUSTOM MODAL KONFIRMASI HAPUS
// -------------------------------------------------------------

function tampilkanModalKonfirmasi(pesan, callback) {
    const modal = document.getElementById('confirmModal');
    const textEl = document.getElementById('confirmModalText');
    textEl.innerHTML = pesan;
    currentDeleteCallback = callback;
    modal.style.display = 'flex';
}

function tutupModalKonfirmasi() {
    const modal = document.getElementById('confirmModal');
    modal.style.display = 'none';
    currentDeleteCallback = null;
}