/**
 * utils.js - Small shared helpers used by every other module.
 */

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

function escapeHTML(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
}

// Long recitations (e.g. Al-Baqarah) run for hours, so support h:mm:ss.
function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return h ? `${h}:${m.toString().padStart(2, '0')}:${s}` : `${m}:${s}`;
}

function createId(prefix = 'track') {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function readJSON(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch {
        return fallback;
    }
}

function writeJSON(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
        console.error(`Could not save "${key}"`, e);
    }
}

// Normalises Arabic/Latin text so "سُورَةُ البَقَرَةِ", "البقرة" and "Al-Baqarah" compare sanely.
function normalizeText(text) {
    return String(text || '')
        .toLowerCase()
        .replace(/[ً-ٰٟـ]/g, '') // tashkeel + tatweel
        .replace(/[أإآٱ]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/ى/g, 'ي')
        .replace(/[-'`’_.]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function showToast(message, type = 'success') {
    const icons = { success: 'fa-check-circle', error: 'fa-circle-exclamation', info: 'fa-circle-info' };
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<i class="fas ${icons[type] || icons.success}"></i><span>${escapeHTML(message)}</span>`;
    $('#toast-container').appendChild(toast);
    setTimeout(() => {
        toast.classList.add('removing');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function closeAllModals() {
    $$('.modal-overlay.active').forEach(m => m.classList.remove('active'));
}
