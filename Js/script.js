/**
 * Nebula Music Player - Core Logic (REPAIRED)
 * Fix: Removed massive code duplication, fixed Modal opening, and Search persistence.
 */

// --- DATA & INITIALIZATION ---
const initialSongs = [
    { id: 0, name: 'synthwave-dreams', displayName: 'Synthwave Dreams', artist: 'Neon Voyager', src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', cover: 'assets/cover1.png', liked: false, genre: 'Chill', isSpotify: false },
    { id: 1, name: 'lofi-night', displayName: 'Lofi Night', artist: 'Rainy City', src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3', cover: 'assets/cover2.png', liked: true, genre: 'Chill', isSpotify: false },
    { id: 2, name: 'cinematic-echoes', displayName: 'Cinematic Echoes', artist: 'Stellar Orchestrations', src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3', cover: 'assets/cover3.png', liked: false, genre: 'Workout', isSpotify: false }
];

let songs = [];
let playlists = [];
let history = [];
let isPlaying = false;
let isShuffle = false;
let isRepeat = false;
let songIndex = 0;
let currentPlaylist = [];

// --- DOM ELEMENTS ---
const audio = document.getElementById('audio');
const playIcon = document.getElementById('play-icon');
const playerTitle = document.getElementById('player-title');
const playerArtist = document.getElementById('player-artist');
const playerCover = document.getElementById('player-mini-cover');
const playerLikeBtn = document.getElementById('player-like-btn');
const visualizer = document.getElementById('visualizer');
const progress = document.getElementById('progress');
const currentTimeEl = document.getElementById('current-time');
const durationEl = document.getElementById('duration');
const volumeSlider = document.getElementById('volume');
const volumeIcon = document.getElementById('volume-icon');
const trackGrid = document.getElementById('track-grid');
const recentlyPlayedGrid = document.getElementById('recently-played-grid');
const mainSearchInput = document.getElementById('search-input');
const modalOverlay = document.getElementById('modal-overlay');
const onlineSearchInput = document.getElementById('online-search-input');
const onlineResults = document.getElementById('online-results');
const toastContainer = document.getElementById('toast-container');
const playlistList = document.getElementById('playlist-list');
const showAllBtn = document.getElementById('show-all-btn');
const menuToggle = document.getElementById('menu-toggle');
const sidebar = document.querySelector('.sidebar');

// Local File Elements
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const fileTitleInput = document.getElementById('file-title');
const submitFileBtn = document.getElementById('submit-file');

// --- APP INITIALIZATION ---
async function saveAllData() {
    localStorage.setItem('nebula_songs', JSON.stringify(songs));
    localStorage.setItem('nebula_playlists', JSON.stringify(playlists));
    localStorage.setItem('nebula_history', JSON.stringify(history));
}

async function initLibrary() {
    try {
        const savedSongs = localStorage.getItem('nebula_songs');
        if (savedSongs) {
            const parsed = JSON.parse(savedSongs);
            if (Array.isArray(parsed) && parsed.length > 0) songs = parsed;
            else songs = [...initialSongs];
        } else {
            songs = [...initialSongs];
        }

        const savedPlaylists = localStorage.getItem('nebula_playlists');
        playlists = savedPlaylists ? JSON.parse(savedPlaylists) : [];

        const savedHistory = localStorage.getItem('nebula_history');
        history = savedHistory ? JSON.parse(savedHistory) : [];

        // Restore local binary links if dbManager exists
        for (let song of songs) {
            if (song.isLocal && window.dbManager) {
                const refreshedUrl = await window.dbManager.getTrackData(song.id);
                if (refreshedUrl) song.src = refreshedUrl;
            }
        }

        currentPlaylist = [...songs];
        loadSong(songs[songIndex] || songs[0]);
        renderTrackGrid(currentPlaylist);
        renderRecentlyPlayed();
        renderPlaylistList();
        updateNavCounts();
    } catch (e) {
        console.error("Init Error:", e);
        songs = [...initialSongs];
        renderTrackGrid(songs);
    }
}

// --- PLAYER LOGIC ---
function loadSong(song) {
    if (!song) return;
    playerTitle.innerText = song.displayName;
    playerArtist.innerText = song.artist;
    audio.src = song.src;
    
    if (song.cover) {
        playerCover.style.display = 'block';
        playerCover.src = song.cover;
        const fb = playerCover.parentElement.querySelector('.mini-cover.fallback');
        if (fb) fb.remove();
    } else {
        playerCover.style.display = 'none';
        let fb = playerCover.parentElement.querySelector('.mini-cover.fallback');
        if (!fb) {
            fb = document.createElement('div');
            fb.className = 'mini-cover fallback';
            fb.innerHTML = '<i class="fas fa-music"></i>';
            playerCover.parentElement.insertBefore(fb, playerCover);
        }
    }
    
    updateLikeButtonStatus(song);
    updateGridActiveItem();
    updateBackgroundEffects();
    addToHistory(song);
}

function addToHistory(song) {
    if (!song) return;
    if (history.length > 0 && history[0].id === song.id) return;
    history = [song, ...history.filter(s => s.id !== song.id)].slice(0, 5);
    saveAllData();
    renderRecentlyPlayed();
}

function playSong() {
    isPlaying = true;
    playIcon.classList.replace('fa-play', 'fa-pause');
    if (visualizer) visualizer.classList.add('active');
    audio.play().catch(e => console.log("Play interrupted"));
}

function pauseSong() {
    isPlaying = false;
    playIcon.classList.replace('fa-pause', 'fa-play');
    if (visualizer) visualizer.classList.remove('active');
    audio.pause();
}

function nextSong() {
    songIndex = isShuffle ? Math.floor(Math.random() * currentPlaylist.length) : (songIndex + 1) % currentPlaylist.length;
    loadSong(currentPlaylist[songIndex]);
    playSong();
}

function prevSong() {
    songIndex = (songIndex - 1 + currentPlaylist.length) % currentPlaylist.length;
    loadSong(currentPlaylist[songIndex]);
    playSong();
}

// --- RENDER LOGIC ---
function renderTrackGrid(songsToRender, targetGrid = trackGrid) {
    targetGrid.innerHTML = '';
    const fragment = document.createDocumentFragment();
    
    songsToRender.forEach((song) => {
        const card = document.createElement('div');
        card.classList.add('track-card');
        card.innerHTML = `
            <div class="card-img-container">
                ${song.cover ? `<img src="${song.cover}" loading="lazy">` : `<div class="cover-fallback"><i class="fas fa-music"></i></div>`}
                <div class="card-play-btn"><i class="fas fa-play"></i></div>
            </div>
            <div class="card-info-col">
                <div class="card-title">${song.displayName}</div>
                <div class="card-artist">${song.artist}</div>
            </div>
            <div class="card-actions">
                <i class="${song.liked ? 'fas' : 'far'} fa-heart like-track-icon" style="color: ${song.liked ? 'var(--primary-color)' : 'inherit'}; cursor: pointer;" title="Favorite"></i>
                <i class="${song.bookmarked ? 'fas' : 'far'} fa-bookmark bookmark-track-icon" style="color: ${song.bookmarked ? 'var(--primary-color)' : 'inherit'}; cursor: pointer;" title="Bookmark"></i>
                <i class="fas fa-trash-alt delete-track-icon" title="Remove"></i>
            </div>
        `;
        
        card.querySelector('.card-img-container').onclick = () => {
            currentPlaylist = songsToRender;
            songIndex = currentPlaylist.indexOf(song);
            loadSong(song);
            playSong();
        };

        card.querySelector('.delete-track-icon').onclick = (e) => {
            e.stopPropagation();
            deleteTrack(song.id);
        };

        const likeIcon = card.querySelector('.like-track-icon');
        if (likeIcon) {
            likeIcon.onclick = (e) => {
                e.stopPropagation();
                song.liked = !song.liked;
                
                likeIcon.className = `${song.liked ? 'fas' : 'far'} fa-heart like-track-icon`;
                likeIcon.style.color = song.liked ? 'var(--primary-color)' : 'inherit';
                
                if (typeof currentPlaylist !== 'undefined' && currentPlaylist[songIndex] && currentPlaylist[songIndex].id === song.id) {
                    updateLikeButtonStatus(song);
                }
                saveAllData();
                updateNavCounts();
            };
        }

        const bookmarkIcon = card.querySelector('.bookmark-track-icon');
        if (bookmarkIcon) {
            bookmarkIcon.onclick = (e) => {
                e.stopPropagation();
                song.bookmarked = !song.bookmarked;
                
                bookmarkIcon.className = `${song.bookmarked ? 'fas' : 'far'} fa-bookmark bookmark-track-icon`;
                bookmarkIcon.style.color = song.bookmarked ? 'var(--primary-color)' : 'inherit';
                
                saveAllData();
            };
        }

        fragment.appendChild(card);
    });
    targetGrid.appendChild(fragment);
    updateGridActiveItem();
}

function renderRecentlyPlayed() {
    renderTrackGrid(history, recentlyPlayedGrid);
    recentlyPlayedGrid.classList.add('mini');
}

function renderPlaylistList() {
    playlistList.innerHTML = `
        <a href="#" class="nav-item" data-type="genre" data-id="Chill"><i class="fas fa-snowflake"></i><span>Chill Vibes</span><span class="track-count">0</span></a>
        <a href="#" class="nav-item" data-type="genre" data-id="Workout"><i class="fas fa-fire"></i><span>Workout Mix</span><span class="track-count">0</span></a>
    `;
    playlists.forEach(pl => {
        const a = document.createElement('a');
        a.className = 'nav-item';
        a.dataset.type = 'custom';
        a.dataset.id = pl.id;
        a.innerHTML = `<i class="fas fa-music"></i><span>${pl.name}</span><span class="track-count">${pl.songIds.length}</span><i class="fas fa-times delete-playlist"></i>`;
        a.onclick = (e) => {
            if (e.target.classList.contains('delete-playlist')) { deletePlaylist(pl.id); return; }
        };
        playlistList.appendChild(a);
    });
    updateNavCounts();
}

function updateNavCounts() {
    const counts = {
        'Chill': songs.filter(s => s.genre === 'Chill').length,
        'Workout': songs.filter(s => s.genre === 'Workout').length,
        'Favs': songs.filter(s => s.liked).length
    };
    document.querySelectorAll('.nav-item[data-id="Chill"] .track-count').forEach(el => el.innerText = counts.Chill);
    document.querySelectorAll('.nav-item[data-id="Workout"] .track-count').forEach(el => el.innerText = counts.Workout);
    const favCountEl = document.querySelector('#nav-favorites .track-count');
    if (favCountEl) favCountEl.innerText = counts.Favs;
}

// --- LOGIC FUNCTIONS ---
function deleteTrack(id) {
    if (!confirm("Remove this track?")) return;
    if (window.dbManager) window.dbManager.removeTrackData(id);
    songs = songs.filter(s => s.id !== id);
    history = history.filter(s => s.id !== id);
    saveAllData();
    initLibrary();
}

function addSongToPlaylist(songId, plId) {
    const pl = playlists.find(p => p.id == plId);
    if (pl && !pl.songIds.includes(songId)) {
        pl.songIds.push(songId);
        saveAllData();
        renderPlaylistList();
        showToast(`Added to ${pl.name}`);
    }
}

function deletePlaylist(id) {
    playlists = playlists.filter(pl => pl.id !== id);
    saveAllData();
    renderPlaylistList();
}

function updateGridActiveItem() {
    const cur = currentPlaylist[songIndex];
    if (!cur) return;
    document.querySelectorAll('.track-card').forEach(card => {
        card.classList.toggle('active', card.querySelector('.card-title').innerText === cur.displayName);
    });
}

function showToast(msg) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.innerHTML = `<i class="fas fa-check-circle"></i><span>${msg}</span>`;
    toastContainer.appendChild(t);
    setTimeout(() => { t.classList.add('removing'); setTimeout(() => t.remove(), 300); }, 3000);
}

function updateLikeButtonStatus(song) {
    playerLikeBtn.classList.toggle('fas', song.liked);
    playerLikeBtn.classList.toggle('far', !song.liked);
    playerLikeBtn.classList.toggle('active', song.liked);
}

function updateBackgroundEffects() {
    document.querySelectorAll('.bg-blob').forEach(b => {
        b.style.left = Math.random() * 90 + '%';
        b.style.top = Math.random() * 90 + '%';
    });
}

// --- SEARCH ENGINE (ITUNES) ---
// --- SEARCH ENGINE (ITUNES JSONP) ---
function searchOnlineTracks(query) {
    if (!query) return;
    const skeleton = document.getElementById('skeleton-template');
    if (onlineResults && skeleton) {
        onlineResults.innerHTML = skeleton.innerHTML.repeat(3);
    }

    // Remove any existing callback scripts to clean up
    const oldScript = document.getElementById('itunes-jsonp');
    if (oldScript) oldScript.remove();

    // Create a unique callback name
    const callbackName = 'itunesCallback_' + Date.now();
    
    // Define the global callback function
    window[callbackName] = function(data) {
        if (!onlineResults) return;
        onlineResults.innerHTML = '';
        
        if (!data.results || data.results.length === 0) {
            onlineResults.innerHTML = '<div class="empty-results-msg">No results found for "' + query + '"</div>';
            return;
        }

        data.results.forEach(track => {
            const item = document.createElement('div');
            item.className = 'result-item';
            item.innerHTML = `
                <img class="result-cover" src="${track.artworkUrl100}">
                <div class="result-info"><div class="result-title">${track.trackName}</div><div class="result-artist">${track.artistName}</div></div>
                <button class="add-result-btn"><i class="fas fa-plus"></i></button>
            `;
            item.querySelector('button').onclick = () => {
                const newSong = { 
                    id: Date.now(), 
                    displayName: track.trackName, 
                    artist: track.artistName, 
                    src: track.previewUrl, 
                    cover: track.artworkUrl100.replace('100x100', '600x600'), 
                    liked: false, 
                    bookmarked: false 
                };
                songs.push(newSong);
                saveAllData();
                initLibrary();
                modalOverlay.classList.remove('active');
                showToast(`Added ${track.trackName}`);
            };
            onlineResults.appendChild(item);
        });

        // Cleanup
        delete window[callbackName];
        const script = document.getElementById('itunes-jsonp');
        if (script) script.remove();
    };

    // Create and inject the script tag
    const script = document.createElement('script');
    script.id = 'itunes-jsonp';
    script.src = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&limit=10&callback=${callbackName}`;
    
    script.onerror = () => {
        if (onlineResults) {
            onlineResults.innerHTML = `<div class="error-msg" style="color: #ff4d4d; padding: 20px; text-align: center;">
                <i class="fas fa-exclamation-circle" style="display: block; font-size: 1.5rem; margin-bottom: 8px;"></i>
                Search failed to load.<br>
                <span style="font-size: 0.8rem; color: var(--text-dim);">This might be a network issue.</span>
            </div>`;
        }
    };

    document.body.appendChild(script);
}

// --- EVENT LISTENERS ---
document.addEventListener('click', (e) => {
    if (e.target.closest('#open-modal')) {
        modalOverlay.classList.add('active');
        // Close mobile sidebar when opening modal
        if (sidebar.classList.contains('mobile-open')) {
            sidebar.classList.remove('mobile-open');
            const menuToggleIcon = menuToggle.querySelector('i');
            if (menuToggleIcon) menuToggleIcon.classList.replace('fa-times', 'fa-bars');
        }
    }
    if (e.target.closest('#close-modal')) modalOverlay.classList.remove('active');
    
    if (e.target.closest('#logged-in-view')) {
        const logoutClick = e.target.closest('#logout-btn');
        if (!logoutClick && typeof currentUser !== 'undefined' && currentUser) {
            openProfilePage();
        }
    }
    
    // Sidebar routing
    const nav = e.target.closest('.nav-item');
    if (nav && nav.id !== 'open-modal' && !e.target.classList.contains('delete-playlist')) {
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        nav.classList.add('active');
        
        // Handle Visibility of Top Sections
        const profileHeader = document.getElementById('profile-header');
        const mainHeader = document.getElementById('main-library-header');
        const heroSection = document.getElementById('hero-section');
        const recentHeader = document.getElementById('recent-header');
        const recentlyPlayedGrid = document.getElementById('recently-played-grid');

        if (profileHeader) profileHeader.style.display = 'none';
        if (mainHeader) mainHeader.style.display = 'flex';
        
        // Only show Hero and Recent on Home
        if (nav.id === 'nav-home') {
            if (heroSection) heroSection.style.display = 'block';
            if (recentHeader) recentHeader.style.display = 'flex';
            if (recentlyPlayedGrid) recentlyPlayedGrid.style.display = 'grid';
            currentPlaylist = [...songs];
            document.getElementById('main-grid-title').innerText = "Your Library";
        } else {
            if (heroSection) heroSection.style.display = 'none';
            if (recentHeader) recentHeader.style.display = 'none';
            if (recentlyPlayedGrid) recentlyPlayedGrid.style.display = 'none';
        }

        const { type, id } = nav.dataset;
        if (nav.id === 'nav-favorites') {
            currentPlaylist = songs.filter(s => s.liked);
            document.getElementById('main-grid-title').innerText = "Favorites";
        }
        else if (nav.id === 'nav-discover') {
            currentPlaylist = [...songs].sort(() => Math.random() - 0.5);
            document.getElementById('main-grid-title').innerText = "Discover";
        }
        else if (nav.id === 'nav-profile') {
            openProfilePage();
            return; // openProfilePage handles the rendering manually
        }
        else if (type === 'genre') {
            currentPlaylist = songs.filter(s => s.genre === id);
            document.getElementById('main-grid-title').innerText = `${id} Vibes`;
        }
        else if (type === 'custom') {
            const pl = playlists.find(p => p.id == id);
            currentPlaylist = songs.filter(s => pl.songIds.includes(s.id));
            document.getElementById('main-grid-title').innerText = pl.name;
        }
        
        if (nav.id !== 'nav-profile') {
            renderTrackGrid(currentPlaylist);
        }

        // Close mobile sidebar if open
        if (sidebar.classList.contains('mobile-open')) {
            sidebar.classList.remove('mobile-open');
            const menuToggleIcon = menuToggle.querySelector('i');
            if (menuToggleIcon) menuToggleIcon.classList.replace('fa-times', 'fa-bars');
        }
    }
});

// Mobile Menu Toggle Logic
if (menuToggle) {
    menuToggle.onclick = () => {
        sidebar.classList.toggle('mobile-open');
        const icon = menuToggle.querySelector('i');
        if (sidebar.classList.contains('mobile-open')) {
            icon.classList.replace('fa-bars', 'fa-times');
        } else {
            icon.classList.replace('fa-times', 'fa-bars');
        }
    };
}

function openProfilePage() {
    const profileHeader = document.getElementById('profile-header');
    const mainHeader = document.getElementById('main-library-header');

    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const navProfile = document.getElementById('nav-profile');
    if (navProfile) navProfile.classList.add('active');

    const favs = songs.filter(s => s.bookmarked);
    const likedSongs = songs.filter(s => s.liked);
    const localTracks = songs.filter(s => s.isLocal);
    const avatarUrl = currentUser.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.name)}&background=7b2ff7&color=fff&size=128&bold=true`;

    // Build a full-width premium profile banner
    profileHeader.innerHTML = `
        <div style="
            width: 100%;
            background: linear-gradient(135deg, #1a0a3e 0%, #2a0a5e 40%, #0d0d2b 100%);
            border-radius: 20px;
            padding: 40px 40px 30px;
            position: relative;
            overflow: hidden;
            box-shadow: 0 20px 60px rgba(0,0,0,0.5);
        ">
            <!-- Decorative background blobs -->
            <div style="position:absolute;top:-40px;right:-40px;width:200px;height:200px;background:radial-gradient(circle,rgba(123,47,247,0.4) 0%,transparent 70%);border-radius:50%;pointer-events:none;"></div>
            <div style="position:absolute;bottom:-30px;left:20%;width:150px;height:150px;background:radial-gradient(circle,rgba(0,200,255,0.15) 0%,transparent 70%);border-radius:50%;pointer-events:none;"></div>

            <!-- User Info Row -->
            <div style="display:flex;align-items:center;gap:24px;position:relative;z-index:1;">
                <img src="${avatarUrl}" style="
                    width: 90px; height: 90px; border-radius: 50%;
                    border: 3px solid rgba(255,255,255,0.2);
                    box-shadow: 0 8px 24px rgba(0,0,0,0.6);
                    object-fit: cover;
                ">
                <div>
                    <p style="margin:0 0 2px;font-size:0.8rem;color:rgba(255,255,255,0.45);letter-spacing:2px;text-transform:uppercase;">Your Profile</p>
                    <h2 style="margin:0;font-size:1.8rem;font-weight:800;color:white;letter-spacing:-0.5px;">${currentUser.name}</h2>
                    <p style="margin:4px 0 0;color:rgba(255,255,255,0.45);font-size:0.85rem;">${currentUser.email}</p>
                </div>
            </div>

            <!-- Stats Row -->
            <div style="display:flex;gap:14px;margin-top:28px;flex-wrap:wrap;position:relative;z-index:1;">
                <div style="background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.1);padding:12px 22px;border-radius:14px;text-align:center;min-width:90px;">
                    <div style="font-size:1.5rem;font-weight:800;color:white;">${favs.length}</div>
                    <div style="font-size:0.75rem;color:rgba(255,255,255,0.45);margin-top:2px;text-transform:uppercase;letter-spacing:1px;">Bookmarks</div>
                </div>
                <div style="background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.1);padding:12px 22px;border-radius:14px;text-align:center;min-width:90px;">
                    <div style="font-size:1.5rem;font-weight:800;color:white;">${likedSongs.length}</div>
                    <div style="font-size:0.75rem;color:rgba(255,255,255,0.45);margin-top:2px;text-transform:uppercase;letter-spacing:1px;">Favorites</div>
                </div>
                <div style="background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.1);padding:12px 22px;border-radius:14px;text-align:center;min-width:90px;">
                    <div style="font-size:1.5rem;font-weight:800;color:white;">${localTracks.length}</div>
                    <div style="font-size:0.75rem;color:rgba(255,255,255,0.45);margin-top:2px;text-transform:uppercase;letter-spacing:1px;">Uploads</div>
                </div>
                <div style="background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.1);padding:12px 22px;border-radius:14px;text-align:center;min-width:90px;">
                    <div style="font-size:1.5rem;font-weight:800;color:white;">${songs.length}</div>
                    <div style="font-size:0.75rem;color:rgba(255,255,255,0.45);margin-top:2px;text-transform:uppercase;letter-spacing:1px;">Library</div>
                </div>
            </div>
        </div>
    `;

    mainHeader.style.display = 'none';
    profileHeader.style.display = 'block';

    // Clear previous track grid content
    trackGrid.innerHTML = '';

    // Section builder helper
    const addSection = (title, icon, songList, emptyMsg) => {
        const wrapper = document.createElement('div');
        wrapper.style.marginBottom = '32px';

        const header = document.createElement('div');
        header.style.cssText = 'display:flex;align-items:center;gap:10px;margin-bottom:16px;padding-bottom:10px;border-bottom:1px solid rgba(255,255,255,0.07);';
        header.innerHTML = `
            <i class="${icon}" style="color:var(--primary-color);font-size:1rem;"></i>
            <h3 style="margin:0;font-size:1rem;font-weight:700;letter-spacing:0.5px;">${title}</h3>
            <span style="margin-left:auto;background:rgba(255,255,255,0.08);padding:2px 10px;border-radius:20px;font-size:0.75rem;color:rgba(255,255,255,0.5);">${songList.length} tracks</span>
        `;
        wrapper.appendChild(header);

        if (songList.length > 0) {
            const grid = document.createElement('div');
            grid.className = 'track-list';
            wrapper.appendChild(grid);
            renderTrackGrid(songList, grid);
        } else {
            const empty = document.createElement('div');
            empty.style.cssText = 'color:rgba(255,255,255,0.3);font-size:0.9rem;padding:20px;text-align:center;background:rgba(255,255,255,0.02);border-radius:12px;border:1px dashed rgba(255,255,255,0.08);';
            empty.innerHTML = `<i class="fas fa-music" style="display:block;font-size:1.5rem;margin-bottom:8px;"></i>${emptyMsg}`;
            wrapper.appendChild(empty);
        }

        trackGrid.appendChild(wrapper);
    };

    addSection('Bookmarks', 'fas fa-bookmark', favs, 'Click the bookmark icon on any track to save it here.');
    addSection('Local Uploads', 'fas fa-upload', localTracks, 'Drag & drop MP3 files using Add Track.');

    currentPlaylist = favs.length ? favs : songs;
}

mainSearchInput.oninput = (e) => {
    const val = e.target.value.toLowerCase();
    currentPlaylist = songs.filter(s => s.displayName.toLowerCase().includes(val) || s.artist.toLowerCase().includes(val));
    if (!val) currentPlaylist = [...songs];
    renderTrackGrid(currentPlaylist);
};

document.getElementById('tab-file').onclick = () => {
    document.getElementById('tab-file').classList.add('active');
    document.getElementById('tab-search').classList.remove('active');
    document.getElementById('file-form').style.display = 'block';
    document.getElementById('search-form').style.display = 'none';
};

document.getElementById('tab-search').onclick = () => {
    document.getElementById('tab-search').classList.add('active');
    document.getElementById('tab-file').classList.remove('active');
    document.getElementById('search-form').style.display = 'block';
    document.getElementById('file-form').style.display = 'none';
};

document.getElementById('play').onclick = () => isPlaying ? pauseSong() : playSong();
document.getElementById('next').onclick = nextSong;
document.getElementById('prev').onclick = prevSong;

audio.ontimeupdate = () => {
    const { duration, currentTime } = audio;
    progress.style.width = (currentTime / duration) * 100 + '%';
    const fmt = (t) => `${Math.floor(t/60)}:${Math.floor(t%60).toString().padStart(2,'0')}`;
    currentTimeEl.innerText = fmt(currentTime);
    if (duration) durationEl.innerText = fmt(duration);
};

document.getElementById('progress-container').onclick = (e) => {
    audio.currentTime = (e.offsetX / e.currentTarget.clientWidth) * audio.duration;
};

let debounceT;
const clearOnlineSearch = document.getElementById('clear-online-search');
onlineSearchInput.oninput = (e) => {
    const query = e.target.value.trim();
    if (clearOnlineSearch) clearOnlineSearch.style.display = query ? 'block' : 'none';
    clearTimeout(debounceT);
    debounceT = setTimeout(() => searchOnlineTracks(query), 600);
};

if (clearOnlineSearch) {
    clearOnlineSearch.onclick = () => {
        onlineSearchInput.value = '';
        onlineResults.innerHTML = '<div class="empty-results-msg">Enter a song name to begin...</div>';
        clearOnlineSearch.style.display = 'none';
        onlineSearchInput.focus();
    };
}

playerLikeBtn.onclick = () => {
    const s = songs.find(s => s.id === currentPlaylist[songIndex].id);
    if (s) { s.liked = !s.liked; updateLikeButtonStatus(s); saveAllData(); updateNavCounts(); }
};

if (showAllBtn) {
    showAllBtn.onclick = () => {
        currentPlaylist = [...songs];
        renderTrackGrid(currentPlaylist);
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    };
}

// --- VOLUME CONTROL ---
let lastVolume = localStorage.getItem('nebula_volume') ? parseFloat(localStorage.getItem('nebula_volume')) : 0.7;

function updateVolumeIcon(vol, muted) {
    volumeIcon.className = 'fas control-icon';
    volumeIcon.style.cursor = 'pointer';
    
    if (vol === 0 || muted) {
        volumeIcon.classList.add('fa-volume-xmark');
        volumeIcon.style.color = 'var(--accent-color)';
    } else if (vol > 0.6) {
        volumeIcon.classList.add('fa-volume-high');
        volumeIcon.style.color = 'var(--text-main)';
    } else {
        volumeIcon.classList.add('fa-volume-low');
        volumeIcon.style.color = 'var(--text-dim)';
    }
}

function setVolume(vol) {
    const v = Math.max(0, Math.min(1, parseFloat(vol)));
    audio.volume = v;
    audio.muted = (v === 0);
    if (v > 0) {
        lastVolume = v;
        localStorage.setItem('nebula_volume', v);
    }
}

if (volumeSlider) {
    volumeSlider.oninput = (e) => setVolume(e.target.value);
}

if (volumeIcon) {
    volumeIcon.onclick = () => {
        if (audio.muted || audio.volume === 0) {
            setVolume(lastVolume || 0.7);
        } else {
            lastVolume = audio.volume;
            setVolume(0);
        }
    };
}

// Ensure the UI stays in sync with the actual audio element state
audio.onvolumechange = () => {
    if (volumeSlider) volumeSlider.value = audio.volume;
    updateVolumeIcon(audio.volume, audio.muted);
};

// Initial volume sync
setVolume(lastVolume);


const createPlBtn = document.getElementById('create-playlist-btn');
if (createPlBtn) {
    createPlBtn.onclick = () => {
        const name = prompt("Playlist Name:");
        if (name) { playlists.push({ id: Date.now(), name, songIds: [] }); saveAllData(); renderPlaylistList(); }
    };
}

document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    if (e.code === 'Space') { e.preventDefault(); isPlaying ? pauseSong() : playSong(); }
    else if (e.code === 'ArrowRight') nextSong();
    else if (e.code === 'ArrowLeft') prevSong();
});

// --- LOCAL FILE UPLOAD (DRAG & DROP) ---
async function addNewTrack(file) {
    if (!file) { showToast('Please select a file!'); return; }
    const title = fileTitleInput ? fileTitleInput.value || file.name.split('.')[0] : file.name.split('.')[0];
    const id = Date.now();
    
    // Save to IndexedDB
    if (window.dbManager) {
        try {
            await window.dbManager.saveTrackData(id, file);
        } catch(e) {
            console.error("Could not save to DB", e);
        }
    }
    const trackUrl = URL.createObjectURL(file);
    
    const newSong = { id, name: title.toLowerCase().replace(/ /g, '-'), displayName: title, artist: 'Local Track', src: trackUrl, cover: '', liked: false, bookmarked: false, isLocal: true };
    songs.push(newSong);
    saveAllData();
    showToast('Saved to Local Database!');
    initLibrary();
    modalOverlay.classList.remove('active');
}

if (submitFileBtn && fileInput && dropZone) {
    submitFileBtn.onclick = () => addNewTrack(fileInput.files[0]);
    dropZone.onclick = () => fileInput.click();
    dropZone.ondragover = e => { e.preventDefault(); dropZone.classList.add('dragover'); };
    dropZone.ondragleave = () => dropZone.classList.remove('dragover');
    dropZone.ondrop = e => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('audio/')) {
            // Assigning file array isn't fully cross browser, but we just trigger the logic directly
            addNewTrack(file);
        } else {
            showToast('Please drop an audio file');
        }
    };
    fileInput.onchange = (e) => {
        if(e.target.files.length && fileTitleInput) {
            fileTitleInput.value = e.target.files[0].name.split('.')[0];
        }
    };
}

// --- GO ---
initLibrary();
