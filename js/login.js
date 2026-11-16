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

// Inisialisasi Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();

// -------------------------------------------------------------
// 2. ELEMEN DOM & EVENT LISTENERS
// -------------------------------------------------------------
const loginSection = document.getElementById('login-section');
// const dashboardSection = document.getElementById('dashboard-section');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const userEmailDisplay = document.getElementById('user-email-display');

// Authentication State Listener
auth.onAuthStateChanged(user => {
    if (user) {
        loginSection.classList.add('hidden');
        // dashboardSection.classList.remove('hidden');
        window.location.replace("index.html")
        // userEmailDisplay.textContent = user.email;
        initDashboardListeners();
    } else {
        loginSection.classList.remove('hidden');
        // dashboardSection.classList.add('hidden');
        loginForm.reset(); 
    }
});

// Form Login
loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    auth.signInWithEmailAndPassword(email, password)
        .catch(err => {
            loginError.textContent = "Login gagal: " + err.message;
            loginError.classList.remove('hidden');
        });
});

