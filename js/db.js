/**
 * db.js - Lightweight IndexedDB wrapper that keeps uploaded audio files across reloads.
 */

class MusicDB {
    constructor() {
        this.dbName = 'NebulaMusicDB';
        this.storeName = 'tracks';
        this.dbPromise = null;
    }

    open() {
        if (!this.dbPromise) {
            this.dbPromise = new Promise((resolve, reject) => {
                const request = indexedDB.open(this.dbName, 1);
                request.onupgradeneeded = () => {
                    const db = request.result;
                    if (!db.objectStoreNames.contains(this.storeName)) {
                        db.createObjectStore(this.storeName, { keyPath: 'id' });
                    }
                };
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        }
        return this.dbPromise;
    }

    async run(mode, action) {
        const db = await this.open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.storeName, mode);
            const request = action(tx.objectStore(this.storeName));
            tx.oncomplete = () => resolve(request.result);
            tx.onerror = () => reject(tx.error);
        });
    }

    saveTrack(id, blob) {
        return this.run('readwrite', store => store.put({ id, blob }));
    }

    async getTrackUrl(id) {
        const record = await this.run('readonly', store => store.get(id));
        return record ? URL.createObjectURL(record.blob) : null;
    }

    removeTrack(id) {
        return this.run('readwrite', store => store.delete(id));
    }
}

const musicDB = new MusicDB();
