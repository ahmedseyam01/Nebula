/**
 * MusicDB - A lightweight IndexedDB wrapper for persisting local audio files.
 */
class MusicDB {
    constructor() {
        this.dbName = 'NebulaMusicDB';
        this.storeName = 'tracks';
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 1);

            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName, { keyPath: 'id' });
                }
            };

            request.onsuccess = (e) => {
                this.db = e.target.result;
                resolve(this.db);
            };

            request.onerror = (e) => {
                console.error('IndexedDB Error:', e.target.error);
                reject(e.target.error);
            };
        });
    }

    async saveTrackData(id, blob) {
        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.put({ id, blob });

            request.onsuccess = () => resolve();
            request.onerror = (e) => reject(e.target.error);
        });
    }

    async getTrackData(id) {
        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.get(id);

            request.onsuccess = () => {
                if (request.result) {
                    resolve(URL.createObjectURL(request.result.blob));
                } else {
                    resolve(null);
                }
            };
            request.onerror = (e) => reject(e.target.error);
        });
    }

    async removeTrackData(id) {
        if (!this.db) await this.init();
        const transaction = this.db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        store.delete(id);
    }
}

const dbManager = new MusicDB();
window.dbManager = dbManager; // Make it globally accessible for script.js
