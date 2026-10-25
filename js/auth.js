/** 
 * auth.js - Custom Native Authentication & Firebase Google Extension
 */

const authModalOverlay = document.getElementById('auth-modal-overlay');
const openAuthBtn = document.getElementById('open-auth-btn');
const closeAuthModal = document.getElementById('close-auth-modal');
const loginFormContainer = document.getElementById('login-form-container');
const registerFormContainer = document.getElementById('register-form-container');
const switchToRegister = document.getElementById('switch-to-register');
const switchToLogin = document.getElementById('switch-to-login');
const authModalTitle = document.getElementById('auth-modal-title');

// UI DOM
const loggedOutView = document.getElementById('open-auth-btn');
const loggedInView = document.getElementById('logged-in-view');
const userAvatar = document.getElementById('user-avatar');
const userName = document.getElementById('user-name');
const logoutBtn = document.getElementById('logout-btn');

// --- MODAL TOGGLES ---
if (openAuthBtn) {
    openAuthBtn.onclick = () => authModalOverlay.classList.add('active');
}
if (closeAuthModal) {
    closeAuthModal.onclick = () => authModalOverlay.classList.remove('active');
}
const authFeedbackMsg = document.getElementById('auth-feedback-msg');

function showAuthFeedback(msg, isError = true) {
    if (!authFeedbackMsg) return;
    authFeedbackMsg.style.display = 'block';
    authFeedbackMsg.innerText = msg;
    if (isError) {
        authFeedbackMsg.style.backgroundColor = 'rgba(255, 60, 60, 0.1)';
        authFeedbackMsg.style.color = '#ff6b6b';
        authFeedbackMsg.style.border = '1px solid rgba(255, 107, 107, 0.3)';
    } else {
        authFeedbackMsg.style.backgroundColor = 'rgba(81, 207, 102, 0.1)';
        authFeedbackMsg.style.color = '#51cf66';
        authFeedbackMsg.style.border = '1px solid rgba(81, 207, 102, 0.3)';
    }
}

// Clear feedback when toggling
if (switchToRegister) {
    switchToRegister.onclick = () => {
        loginFormContainer.style.display = 'none';
        registerFormContainer.style.display = 'block';
        authModalTitle.innerText = 'Create Account';
        if (authFeedbackMsg) authFeedbackMsg.style.display = 'none';
    };
}
if (switchToLogin) {
    switchToLogin.onclick = () => {
        registerFormContainer.style.display = 'none';
        loginFormContainer.style.display = 'block';
        authModalTitle.innerText = 'Welcome Back';
        if (authFeedbackMsg) authFeedbackMsg.style.display = 'none';
    };
}

// --- NATIVE LOCAL AUTHENTICATION ---
let currentUser = null;

function loadNativeSession() {
    const session = localStorage.getItem('nebula_current_user');
    if (session) {
        currentUser = JSON.parse(session);
        updateAuthUI(currentUser);
    }
}

function updateAuthUI(user) {
    const navProfile = document.getElementById('nav-profile');
    if (user) {
        loggedOutView.style.display = 'none';
        loggedInView.style.display = 'flex';
        userName.innerText = user.name;
        userAvatar.src = user.avatar || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(user.name) + '&background=random';
        if (navProfile) navProfile.style.display = 'flex';
    } else {
        loggedOutView.style.display = 'flex';
        loggedInView.style.display = 'none';
        if (navProfile) navProfile.style.display = 'none';
        
        // If viewing profile page and logged out, switch back to home
        const profileHeader = document.getElementById('profile-header');
        if (profileHeader && profileHeader.style.display === 'flex') {
            document.getElementById('nav-home').click();
        }
    }
}

function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

document.getElementById('register-submit-btn').onclick = () => {
    const name = document.getElementById('register-name').value.trim();
    const email = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value;

    if (!name || !email || !password) {
        showAuthFeedback("Please fill all required fields!");
        return;
    }

    if (!validateEmail(email)) {
        showAuthFeedback("Please enter a valid email format!");
        return;
    }

    if (password.length < 6) {
        showAuthFeedback("Password must be at least 6 characters!");
        return;
    }

    const users = JSON.parse(localStorage.getItem('nebula_users') || '[]');
    if (users.find(u => u.email === email)) {
        showAuthFeedback("Email is already registered!");
        return;
    }

    const newUser = { id: Date.now(), name, email, password };
    users.push(newUser);
    localStorage.setItem('nebula_users', JSON.stringify(users));

    // Auto login
    currentUser = { name: newUser.name, email: newUser.email };
    localStorage.setItem('nebula_current_user', JSON.stringify(currentUser));
    
    showAuthFeedback("Account Created Successfully!", false);
    setTimeout(() => {
        authModalOverlay.classList.remove('active');
        updateAuthUI(currentUser);
        if (typeof showToast === 'function') showToast(`Welcome, ${name}!`);
    }, 1000);
};

document.getElementById('login-submit-btn').onclick = () => {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    if (!email || !password) {
        showAuthFeedback("Please fill all required fields!");
        return;
    }
    
    if (!validateEmail(email)) {
        showAuthFeedback("Please enter a valid email format!");
        return;
    }

    const users = JSON.parse(localStorage.getItem('nebula_users') || '[]');
    const user = users.find(u => u.email === email && u.password === password);

    if (user) {
        currentUser = { name: user.name, email: user.email };
        localStorage.setItem('nebula_current_user', JSON.stringify(currentUser));
        showAuthFeedback("Login Successful!", false);
        
        setTimeout(() => {
            authModalOverlay.classList.remove('active');
            updateAuthUI(currentUser);
            if (typeof showToast === 'function') showToast(`Welcome back, ${user.name}!`);
        }, 800);
    } else {
        showAuthFeedback("Invalid email or password!");
    }
};

logoutBtn.onclick = (e) => {
    e.stopPropagation();
    // Clear Native Auth
    currentUser = null;
    localStorage.removeItem('nebula_current_user');
    
    // Clear Firebase Auth if present
    if (typeof firebase !== 'undefined' && firebase.apps.length) {
        firebase.auth().signOut().catch(e => console.log(e));
    }
    
    updateAuthUI(null);
    if (typeof showToast === 'function') showToast("Logged out successfully.");
};

// Start Native Session
loadNativeSession();


// Removed Firebase Dynamic Extension per user request.

