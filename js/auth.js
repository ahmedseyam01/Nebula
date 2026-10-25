/**
 * auth.js - Simple local (browser-only) accounts.
 * Note: this is a demo login stored in localStorage, not real security.
 */

const authUI = {
    overlay: $('#auth-modal'),
    title: $('#auth-modal-title'),
    feedback: $('#auth-feedback'),
    loginForm: $('#login-form'),
    registerForm: $('#register-form'),
    signInBtn: $('#open-auth-btn'),
    userChip: $('#user-chip'),
    userName: $('#user-name'),
    userAvatar: $('#user-avatar'),
    navProfile: $('#nav-profile')
};

const auth = {
    user: readJSON('nebula_current_user', null),

    init() {
        this.bindEvents();
        this.renderUI();
    },

    open(mode = 'login') {
        this.switchMode(mode);
        authUI.overlay.classList.add('active');
        $('input', mode === 'login' ? authUI.loginForm : authUI.registerForm).focus();
    },

    close() {
        authUI.overlay.classList.remove('active');
    },

    switchMode(mode) {
        const isLogin = mode === 'login';
        authUI.loginForm.hidden = !isLogin;
        authUI.registerForm.hidden = isLogin;
        authUI.title.textContent = isLogin ? 'Welcome Back' : 'Create Account';
        authUI.feedback.hidden = true;
    },

    feedback(message, isError = true) {
        authUI.feedback.hidden = false;
        authUI.feedback.textContent = message;
        authUI.feedback.classList.toggle('error', isError);
        authUI.feedback.classList.toggle('success', !isError);
    },

    users() {
        return readJSON('nebula_users', []);
    },

    // Salted SHA-256 so passwords aren't readable in localStorage.
    // crypto.subtle only exists in secure contexts (https / localhost); elsewhere we fall back to plain text.
    async hashPassword(password, salt) {
        if (!window.crypto?.subtle) return null;
        const data = new TextEncoder().encode(`${salt}:${password}`);
        const digest = await crypto.subtle.digest('SHA-256', data);
        return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
    },

    async withPassword(user, password) {
        const salt = createId('salt');
        const hash = await this.hashPassword(password, salt);
        const { password: _legacy, ...rest } = user;
        return hash ? { ...rest, salt, passwordHash: hash } : { ...rest, password };
    },

    async checkPassword(user, password) {
        if (user.passwordHash) return (await this.hashPassword(password, user.salt)) === user.passwordHash;
        return user.password === password; // accounts created before hashing
    },

    setUser(user) {
        this.user = user ? { name: user.name, email: user.email } : null;
        if (this.user) writeJSON('nebula_current_user', this.user);
        else localStorage.removeItem('nebula_current_user');
        this.renderUI();
        document.dispatchEvent(new CustomEvent('auth:change'));
    },

    async register(form) {
        const name = form.name.value.trim();
        const email = form.email.value.trim().toLowerCase();
        const password = form.password.value;

        if (!name || !email || !password) return this.feedback('Please fill all required fields!');
        if (!form.email.checkValidity()) return this.feedback('Please enter a valid email address!');
        if (password.length < 6) return this.feedback('Password must be at least 6 characters!');

        const users = this.users();
        if (users.some(u => u.email.toLowerCase() === email)) return this.feedback('Email is already registered!');

        const user = await this.withPassword({ id: createId('user'), name, email }, password);
        writeJSON('nebula_users', [...users, user]);
        this.complete(user, 'Account created!', `Welcome, ${name}!`);
    },

    async login(form) {
        const email = form.email.value.trim().toLowerCase();
        const password = form.password.value;
        if (!email || !password) return this.feedback('Please fill all required fields!');

        const users = this.users();
        const index = users.findIndex(u => u.email.toLowerCase() === email);
        const user = users[index];
        if (!user || !(await this.checkPassword(user, password))) return this.feedback('Invalid email or password!');

        // Upgrade old plain-text accounts on their next successful login.
        if (!user.passwordHash) {
            users[index] = await this.withPassword(user, password);
            writeJSON('nebula_users', users);
        }
        this.complete(user, 'Login successful!', `Welcome back, ${user.name}!`);
    },

    complete(user, message, toast) {
        this.feedback(message, false);
        setTimeout(() => {
            this.close();
            authUI.loginForm.reset();
            authUI.registerForm.reset();
            this.setUser(user);
            showToast(toast);
        }, 600);
    },

    logout() {
        this.setUser(null);
        showToast('Logged out successfully.', 'info');
    },

    renderUI() {
        const user = this.user;
        authUI.signInBtn.hidden = Boolean(user);
        authUI.userChip.hidden = !user;
        authUI.navProfile.hidden = !user;
        if (user) {
            authUI.userName.textContent = user.name;
            authUI.userAvatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=7c4dff&color=fff&bold=true`;
        }
    },

    bindEvents() {
        authUI.signInBtn.addEventListener('click', () => this.open('login'));
        $('#close-auth-modal').addEventListener('click', () => this.close());
        $('#switch-to-register').addEventListener('click', () => this.switchMode('register'));
        $('#switch-to-login').addEventListener('click', () => this.switchMode('login'));
        authUI.loginForm.addEventListener('submit', e => { e.preventDefault(); this.login(e.target); });
        authUI.registerForm.addEventListener('submit', e => { e.preventDefault(); this.register(e.target); });

        authUI.userChip.addEventListener('click', e => {
            if (e.target.closest('#logout-btn')) this.logout();
            else library.show({ name: 'profile' });
        });
    }
};
