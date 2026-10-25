/**
 * player.js - Audio playback, the play queue and the bottom player bar.
 */

const audio = $('#audio');

const playerUI = {
    playIcon: $('#play-icon'),
    title: $('#player-title'),
    artist: $('#player-artist'),
    cover: $('#player-mini-cover'),
    coverFallback: $('#player-cover-fallback'),
    likeBtn: $('#player-like-btn'),
    visualizer: $('#visualizer'),
    progress: $('#progress'),
    progressBar: $('#progress-container'),
    currentTime: $('#current-time'),
    duration: $('#duration'),
    volume: $('#volume'),
    volumeIcon: $('#volume-icon'),
    shuffleBtn: $('#shuffle-btn'),
    repeatBtn: $('#repeat-btn')
};

const player = {
    queue: [],      // song ids in play order
    index: -1,
    isShuffle: false,
    isRepeat: false,
    lastVolume: 0.7,
    lastSaved: 0,

    get current() {
        return store.getSong(this.queue[this.index]);
    },

    get isPlaying() {
        return !audio.paused;
    },

    init() {
        this.bindEvents();
        this.lastVolume = parseFloat(localStorage.getItem(STORAGE.volume)) || 0.7;
        this.setVolume(this.lastVolume);
        this.renderVolume(); // volumechange doesn't fire if the value didn't change

        // Restore the last track (and position) without auto-playing it.
        const last = readJSON(STORAGE.lastPlayed, null);
        const song = (last && store.getSong(last.id)) || store.songs[0];
        if (song) {
            this.setQueue(store.songs, song.id);
            this.load(song, song.id === last?.id ? last.time : 0);
        } else {
            this.renderEmpty();
        }
    },

    setQueue(songs, startId) {
        this.queue = songs.map(s => s.id);
        this.index = Math.max(0, this.queue.indexOf(startId));
    },

    playFrom(songs, songId) {
        if (this.current?.id === songId) {
            this.toggle();
            return;
        }
        this.setQueue(songs, songId);
        this.load(this.current);
        this.play();
    },

    load(song, startAt = 0) {
        if (!song) return this.renderEmpty();
        audio.src = song.src;
        if (startAt > 0) {
            audio.addEventListener('loadedmetadata', () => { audio.currentTime = startAt; }, { once: true });
        }
        this.renderTrack(song);
        this.updateMediaSession(song);
        document.dispatchEvent(new CustomEvent('player:trackchange', { detail: song }));
    },

    play() {
        const song = this.current;
        if (!song) return;
        if (!song.src) {
            showToast('This file is no longer available. Please re-upload it.', 'error');
            return;
        }
        audio.play().catch(e => {
            if (e.name !== 'AbortError') console.warn('Playback failed:', e);
        });
        store.pushHistory(song.id);
        document.dispatchEvent(new CustomEvent('library:changed'));
    },

    pause() {
        audio.pause();
    },

    toggle() {
        this.isPlaying ? this.pause() : this.play();
    },

    next() {
        if (!this.queue.length) return;
        if (this.isShuffle && this.queue.length > 1) {
            let i;
            do { i = Math.floor(Math.random() * this.queue.length); } while (i === this.index);
            this.index = i;
        } else {
            this.index = (this.index + 1) % this.queue.length;
        }
        this.load(this.current);
        this.play();
    },

    prev() {
        if (!this.queue.length) return;
        // Like most players: restart the track if we're a few seconds in.
        if (audio.currentTime > 3) {
            audio.currentTime = 0;
            return;
        }
        this.index = (this.index - 1 + this.queue.length) % this.queue.length;
        this.load(this.current);
        this.play();
    },

    // Called when a song is deleted from the library.
    forget(id) {
        const wasCurrent = this.current?.id === id;
        const pos = this.queue.indexOf(id);
        if (pos === -1) return;
        this.queue.splice(pos, 1);
        if (pos < this.index) this.index--;
        if (!wasCurrent) return;

        audio.pause();
        if (!this.queue.length) {
            this.index = -1;
            audio.removeAttribute('src');
            this.renderEmpty();
            return;
        }
        this.index = this.index % this.queue.length;
        this.load(this.current);
    },

    seek(ratio) {
        if (Number.isFinite(audio.duration)) audio.currentTime = ratio * audio.duration;
    },

    setVolume(value) {
        const v = Math.max(0, Math.min(1, parseFloat(value) || 0));
        audio.volume = v;
        audio.muted = v === 0;
        if (v > 0) {
            this.lastVolume = v;
            localStorage.setItem(STORAGE.volume, v);
        }
    },

    toggleMute() {
        if (audio.muted || audio.volume === 0) this.setVolume(this.lastVolume || 0.7);
        else this.setVolume(0);
    },

    toggleShuffle() {
        this.isShuffle = !this.isShuffle;
        playerUI.shuffleBtn.classList.toggle('active', this.isShuffle);
        showToast(`Shuffle ${this.isShuffle ? 'on' : 'off'}`, 'info');
    },

    toggleRepeat() {
        this.isRepeat = !this.isRepeat;
        audio.loop = this.isRepeat;
        playerUI.repeatBtn.classList.toggle('active', this.isRepeat);
        showToast(`Repeat ${this.isRepeat ? 'on' : 'off'}`, 'info');
    },

    toggleLike() {
        const song = this.current;
        if (!song) return;
        store.toggle(song.id, 'liked');
        document.dispatchEvent(new CustomEvent('library:changed', { detail: { id: song.id } }));
    },

    savePosition(force = false) {
        const song = this.current;
        if (!song || (!force && Date.now() - this.lastSaved < 5000)) return;
        this.lastSaved = Date.now();
        writeJSON(STORAGE.lastPlayed, { id: song.id, time: audio.currentTime || 0 });
    },

    // --- Rendering ---
    renderTrack(song) {
        playerUI.title.textContent = song.displayName;
        playerUI.artist.textContent = song.artist;
        const hasCover = Boolean(song.cover);
        playerUI.cover.hidden = !hasCover;
        playerUI.coverFallback.hidden = hasCover;
        if (hasCover) playerUI.cover.src = song.cover;
        this.renderLike();
        this.renderProgress();
    },

    renderEmpty() {
        playerUI.title.textContent = 'No track selected';
        playerUI.artist.textContent = 'Add something to your library';
        playerUI.cover.hidden = true;
        playerUI.coverFallback.hidden = false;
        this.renderLike();
        this.renderProgress();
    },

    renderLike() {
        const liked = Boolean(this.current?.liked);
        playerUI.likeBtn.classList.toggle('fas', liked);
        playerUI.likeBtn.classList.toggle('far', !liked);
        playerUI.likeBtn.classList.toggle('active', liked);
    },

    renderPlayState() {
        const playing = this.isPlaying;
        playerUI.playIcon.classList.toggle('fa-play', !playing);
        playerUI.playIcon.classList.toggle('fa-pause', playing);
        playerUI.visualizer.classList.toggle('active', playing);
        document.dispatchEvent(new CustomEvent('player:statechange'));
    },

    renderProgress() {
        const { currentTime, duration } = audio;
        const pct = Number.isFinite(duration) && duration > 0 ? (currentTime / duration) * 100 : 0;
        playerUI.progress.style.width = `${pct}%`;
        playerUI.currentTime.textContent = formatTime(currentTime);
        playerUI.duration.textContent = formatTime(duration);
    },

    renderVolume() {
        const { volume, muted } = audio;
        playerUI.volume.value = muted ? 0 : volume;
        const icon = muted || volume === 0 ? 'fa-volume-xmark' : volume > 0.6 ? 'fa-volume-high' : 'fa-volume-low';
        playerUI.volumeIcon.className = `fas ${icon} control-icon`;
        playerUI.volumeIcon.classList.toggle('muted', muted || volume === 0);
    },

    updateMediaSession(song) {
        if (!('mediaSession' in navigator)) return;
        navigator.mediaSession.metadata = new MediaMetadata({
            title: song.displayName,
            artist: song.artist,
            artwork: song.cover ? [{ src: new URL(song.cover, location.href).href }] : []
        });
    },

    bindEvents() {
        $('#play').addEventListener('click', () => this.toggle());
        $('#next').addEventListener('click', () => this.next());
        $('#prev').addEventListener('click', () => this.prev());
        playerUI.shuffleBtn.addEventListener('click', () => this.toggleShuffle());
        playerUI.repeatBtn.addEventListener('click', () => this.toggleRepeat());
        playerUI.likeBtn.addEventListener('click', () => this.toggleLike());
        playerUI.volume.addEventListener('input', e => this.setVolume(e.target.value));
        playerUI.volumeIcon.addEventListener('click', () => this.toggleMute());

        playerUI.progressBar.addEventListener('click', e => {
            const rect = playerUI.progressBar.getBoundingClientRect();
            this.seek((e.clientX - rect.left) / rect.width);
        });

        audio.addEventListener('play', () => this.renderPlayState());
        audio.addEventListener('pause', () => { this.renderPlayState(); this.savePosition(true); });
        audio.addEventListener('timeupdate', () => { this.renderProgress(); this.savePosition(); });
        audio.addEventListener('durationchange', () => this.renderProgress());
        audio.addEventListener('volumechange', () => this.renderVolume());
        audio.addEventListener('ended', () => this.next()); // `loop` handles repeat-one
        audio.addEventListener('error', () => {
            if (!audio.getAttribute('src')) return;
            showToast(`Couldn't play "${this.current?.displayName ?? 'this track'}"`, 'error');
            this.renderPlayState();
        });
        window.addEventListener('pagehide', () => this.savePosition(true));

        document.addEventListener('keydown', e => {
            if (e.target.closest('input, textarea, select, [contenteditable]') || $('.modal-overlay.active')) return;
            if (e.code === 'Space') { e.preventDefault(); this.toggle(); }
            else if (e.code === 'ArrowRight') this.next();
            else if (e.code === 'ArrowLeft') this.prev();
        });

        if ('mediaSession' in navigator) {
            navigator.mediaSession.setActionHandler('play', () => this.play());
            navigator.mediaSession.setActionHandler('pause', () => this.pause());
            navigator.mediaSession.setActionHandler('nexttrack', () => this.next());
            navigator.mediaSession.setActionHandler('previoustrack', () => this.prev());
        }
    }
};
