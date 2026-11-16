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


// Mencegah listener dipasang berulang kali
let dashboardInitialized = false;


// -------------------------------------------------------------
// 4. AUTHENTICATION STATE
// -------------------------------------------------------------

auth.onAuthStateChanged(user => {

    if (user) {

        console.log("User login:", user.email);

        dashboardSection.classList.remove('hidden');

        userEmailDisplay.textContent = user.email || '';

        // Inisialisasi dashboard
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


    // ---------------------------------------------------------
    // A. MONITOR STATUS PINTU REAL-TIME
    // ---------------------------------------------------------

    const doorStatusRef = db.ref('smartdoor/status');

    doorStatusRef.on('value', snapshot => {

        const status = snapshot.val();

        updateDoorUI(status);

    }, error => {
        console.error("Gagal membaca status pintu:", error);
    });


    // ---------------------------------------------------------
    // B. KONTROL MANUAL PINTU
    // ---------------------------------------------------------

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


    // ---------------------------------------------------------
    // C. MONITOR LOG AKSES REAL-TIME
    // ---------------------------------------------------------

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

        // Update Info Akses Terakhir
        if (logsData.length > 0) {
            const latest = logsData[0];
            document.getElementById('last-user-name').textContent = latest.userName || latest.userId || 'Tanpa Nama';
            document.getElementById('last-method').textContent = `Metode: ${latest.method || 'Unknown'}`;
            document.getElementById('last-time').textContent = `Waktu: ${latest.timestamp || '-'}`;
            
            const badge = document.getElementById('last-status-badge');
            if (latest.status === 'GRANTED' || latest.status === true) {
                badge.className = "px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400";
                badge.textContent = "Akses Diterima";
            } else {
                badge.className = "px-3 py-1 rounded-full text-xs font-semibold bg-red-500/20 text-red-400";
                badge.textContent = "Akses Ditolak";
            }
        }

        // Populate Tabel Log
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


    // ---------------------------------------------------------
    // D. TOMBOL CLEAR LOGS
    // ---------------------------------------------------------

    document.getElementById('btn-clear-logs').addEventListener('click', async () => {

        if (confirm("Yakin ingin menghapus seluruh riwayat akses?")) {

            try {

                await db.ref('smartdoor/logs').remove();

                alert("Riwayat akses berhasil dihapus!");

            } catch (error) {

                alert("Gagal menghapus log: " + error.message);

            }

        }

    });


    // ---------------------------------------------------------
    // E. TOGGLE FORM TAMBAH AKSES
    // ---------------------------------------------------------

    const btnToggleForm = document.getElementById('btn-toggle-form');
    const addAccessForm = document.getElementById('add-access-form');
    const btnCancelForm = document.getElementById('btn-cancel-form');
    const accessTypeSelect = document.getElementById('access-type');
    const pinInputContainer = document.getElementById('pin-input-container');

    btnToggleForm.onclick = () => {
        addAccessForm.classList.toggle('hidden');
    };

    btnCancelForm.onclick = () => {
        addAccessForm.classList.add('hidden');
        addAccessForm.reset();
        pinInputContainer.classList.remove('hidden');
    };

    // Dinamis: Sembunyikan kolom input PIN jika memilih RFID atau Fingerprint
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


    // ---------------------------------------------------------
    // F. FORM TAMBAH AKSES (DENGAN NAMA PEMILIK)
    // ---------------------------------------------------------

    addAccessForm.onsubmit = async (e) => {
        e.preventDefault();

        const ownerName = document.getElementById('access-owner-name').value.trim();
        const type = document.getElementById('access-type').value;

        if (!ownerName) {
            alert("Nama pemilik / pengguna wajib diisi!");
            return;
        }

        try {
            if (type === 'valid_pin') {
                // Jika PIN, ambil nilai PIN manual dari input
                const pinVal = document.getElementById('access-key').value.trim();
                if (!pinVal) {
                    alert("Nomor PIN tidak boleh kosong!");
                    return;
                }

                // Simpan ke database dengan format objek berisikan nama
                await db.ref(`access_control/valid_pin/${pinVal}`).set({
                    name: ownerName,
                    active: true
                });

                alert(`PIN untuk ${ownerName} berhasil ditambahkan!`);
                addAccessForm.reset();
                addAccessForm.classList.add('hidden');
                pinInputContainer.classList.remove('hidden');

            } else if (type === 'valid_rfid') {
                // Jika RFID, kirim trigger perintah dan nama target ke ESP32
                await db.ref('smartdoor/command').set('ADD_RFID');
                await db.ref('smartdoor/target_name').set(ownerName);

                alert(`Mode pendaftaran RFID diaktifkan untuk [${ownerName}]!\nSilakan tempelkan kartu pada perangkat ESP32.`);
                addAccessForm.reset();
                addAccessForm.classList.add('hidden');

            } else if (type === 'fingerprint') {
                // Jika Fingerprint, kirim trigger perintah dan nama target ke ESP32
                await db.ref('smartdoor/command').set('ADD_FINGERPRINT');
                await db.ref('smartdoor/target_name').set(ownerName);

                alert(`Mode pendaftaran Fingerprint diaktifkan untuk [${ownerName}]!\nSilakan masukkan ID via Keypad perangkat.`);
                addAccessForm.reset();
                addAccessForm.classList.add('hidden');
            }

        } catch (error) {
            alert("Gagal memproses pendaftaran: " + error.message);
        }
    };


    // ---------------------------------------------------------
    // G. MONITOR DAFTAR PIN DAN RFID
    // ---------------------------------------------------------

    const accessControlRef = db.ref('access_control');

    accessControlRef.on('value', snapshot => {

        const pinContainer = document.getElementById('list-pins');
        const rfidContainer = document.getElementById('list-rfid');

        pinContainer.innerHTML = '';
        rfidContainer.innerHTML = '';

        const data = snapshot.val() || {};

        // -----------------------------------------------------
        // DAFTAR PIN
        // -----------------------------------------------------

        const pins = data.valid_pin || {};

        if (Object.keys(pins).length === 0) {

            pinContainer.innerHTML = `
                <p class="text-[11px] text-slate-500">
                    Belum ada PIN.
                </p>
            `;

        } else {

            for (const [pin, info] of Object.entries(pins)) {
                // Mendukung format lama (boolean) maupun format baru (objek {name, active})
                const nameLabel = (typeof info === 'object' && info !== null) ? info.name : 'Tanpa Nama';
                pinContainer.appendChild(
                    createBadgeItem('valid_pin', pin, nameLabel)
                );
            }

        }


        // -----------------------------------------------------
        // DAFTAR RFID
        // -----------------------------------------------------

        const rfids = data.valid_rfid || {};

        if (Object.keys(rfids).length === 0) {

            rfidContainer.innerHTML = `
                <p class="text-[11px] text-slate-500">
                    Belum ada RFID.
                </p>
            `;

        } else {

            for (const [rfid, info] of Object.entries(rfids)) {
                const nameLabel = (typeof info === 'object' && info !== null) ? info.name : 'Tanpa Nama';
                rfidContainer.appendChild(
                    createBadgeItem('valid_rfid', rfid, nameLabel)
                );
            }

        }

    }, error => {
        console.error("Gagal membaca daftar akses:", error);
    });

}


// -------------------------------------------------------------
// 7. HELPER MEMBUAT ITEM PIN / RFID DENGAN NAMA
// -------------------------------------------------------------

function createBadgeItem(category, key, ownerName) {

    const item = document.createElement('div');

    item.className =
        "flex justify-between items-center bg-slate-700/50 px-3 py-1.5 rounded text-xs";


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

async function deleteAccess(category, key) {

    if (confirm(`Yakin ingin menghapus [${key}] dari ${category}?`)) {

        try {

            await db.ref(`access_control/${category}/${key}`).remove();

            console.log("Akses berhasil dihapus:", key);

        } catch (error) {

            alert("Gagal menghapus akses: " + error.message);

        }

    }

}


// -------------------------------------------------------------
// 9. UPDATE UI STATUS PINTU
// -------------------------------------------------------------

function updateDoorUI(status) {

    const container = document.getElementById('door-icon-container');

    const icon = document.getElementById('door-icon');

    const text = document.getElementById('door-status-text');


    if (status === 'UNLOCKED' || status === false) {

        // PINTU TERBUKA

        container.className =
            "w-20 h-20 rounded-full flex items-center justify-center bg-red-500/10 text-red-500 mb-3 transition-all duration-300";

        icon.className = "fa-solid fa-lock-open text-4xl";

        text.className = "text-2xl font-bold text-red-400";

        text.textContent = "TERBUKA";

    } else {

        // PINTU TERKUNCI

        container.className =
            "w-20 h-20 rounded-full flex items-center justify-center bg-emerald-500/10 text-emerald-500 mb-3 transition-all duration-300";

        icon.className = "fa-solid fa-lock text-4xl";

        text.className = "text-2xl font-bold text-emerald-400";

        text.textContent = "TERKUNCI";

    }

}