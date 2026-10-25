/**
 * store.js - Library state (songs, playlists, history) and its persistence.
 */

const STORAGE = {
    songs: 'nebula_songs',
    playlists: 'nebula_playlists',
    history: 'nebula_history',
    volume: 'nebula_volume',
    lastPlayed: 'nebula_last_played'
};

const HISTORY_LIMIT = 8;

const DEFAULT_SONGS = [
    { id: 0, displayName: 'Synthwave Dreams', artist: 'Neon Voyager', src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', cover: 'assets/cover1.png', genre: 'Chill' },
    { id: 1, displayName: 'Lofi Night', artist: 'Rainy City', src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3', cover: 'assets/cover2.png', genre: 'Chill', liked: true },
    { id: 2, displayName: 'Cinematic Echoes', artist: 'Stellar Orchestrations', src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3', cover: 'assets/cover3.png', genre: 'Workout' }
];

const store = {
    songs: [],
    playlists: [],
    history: [], // song ids, most recent first

    async load() {
        const saved = readJSON(STORAGE.songs, null);
        this.songs = Array.isArray(saved) && saved.length ? saved : DEFAULT_SONGS.map(s => ({ ...s }));
        this.playlists = readJSON(STORAGE.playlists, []);

        // Older versions stored full song objects in history; keep only the ids.
        this.history = readJSON(STORAGE.history, [])
            .map(entry => (entry && typeof entry === 'object' ? entry.id : entry))
            .filter(id => this.getSong(id));

        // Blob URLs die with the page, so rebuild them for uploaded files.
        await Promise.all(this.songs.filter(s => s.isLocal).map(async song => {
            try {
                song.src = (await musicDB.getTrackUrl(song.id)) || '';
            } catch (e) {
                console.error('Could not restore local track', song.displayName, e);
            }
        }));
    },

    save() {
        writeJSON(STORAGE.songs, this.songs.map(s => (s.isLocal ? { ...s, src: '' } : s)));
        writeJSON(STORAGE.playlists, this.playlists);
        writeJSON(STORAGE.history, this.history);
    },

    getSong(id) {
        return this.songs.find(s => s.id === id);
    },

    hasSong(id) {
        return this.songs.some(s => s.id === id);
    },

    addSong(song) {
        if (this.hasSong(song.id)) return false;
        this.songs.push({ liked: false, bookmarked: false, ...song });
        this.save();
        return true;
    },

    removeSong(id) {
        const song = this.getSong(id);
        if (song?.isLocal) musicDB.removeTrack(id).catch(console.error);
        this.songs = this.songs.filter(s => s.id !== id);
        this.history = this.history.filter(h => h !== id);
        this.playlists.forEach(pl => { pl.songIds = pl.songIds.filter(sid => sid !== id); });
        this.save();
    },

    toggle(id, field) {
        const song = this.getSong(id);
        if (!song) return null;
        song[field] = !song[field];
        this.save();
        return song;
    },

    pushHistory(id) {
        this.history = [id, ...this.history.filter(h => h !== id)].slice(0, HISTORY_LIMIT);
        this.save();
    },

    getPlaylist(id) {
        return this.playlists.find(pl => String(pl.id) === String(id));
    },

    createPlaylist(name) {
        const playlist = { id: createId('pl'), name, songIds: [] };
        this.playlists.push(playlist);
        this.save();
        return playlist;
    },

    deletePlaylist(id) {
        this.playlists = this.playlists.filter(pl => String(pl.id) !== String(id));
        this.save();
    },

    addToPlaylist(playlistId, songId) {
        const playlist = this.getPlaylist(playlistId);
        if (!playlist || playlist.songIds.includes(songId)) return false;
        playlist.songIds.push(songId);
        this.save();
        return true;
    }
};
