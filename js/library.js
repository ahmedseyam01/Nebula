/**
 * library.js - Views (home, discover, favorites, quran, playlists, profile, search),
 * track cards, the sidebar and the "add to playlist" menu.
 */

const SMART_PLAYLISTS = [
    { id: 'Chill', name: 'Chill Vibes', icon: 'fa-snowflake' },
    { id: 'Workout', name: 'Workout Mix', icon: 'fa-fire' }
];

const VIEW_TITLES = {
    home: 'Your Library',
    discover: 'Discover',
    favorites: 'Favorites',
    quran: 'القرآن الكريم'
};

const libraryUI = {
    sidebar: $('#sidebar'),
    navItems: () => $$('.nav-item[data-view]'),
    playlistList: $('#playlist-list'),
    homeSections: $('#home-sections'),
    recentSection: $('#recent-section'),
    recentGrid: $('#recently-played-grid'),
    profileHeader: $('#profile-header'),
    title: $('#view-title'),
    count: $('#view-count'),
    grid: $('#track-grid'),
    search: $('#search-input'),
    playlistMenu: $('#playlist-menu')
};

const library = {
    view: { name: 'home' },
    previousView: { name: 'home' },
    discoverOrder: [],
    menuSongId: null,

    init() {
        this.bindEvents();
        this.renderSidebar();
        this.show({ name: 'home' });
    },

    // --- Views ---
    show(view) {
        if (view.name !== 'search') {
            libraryUI.search.value = '';
            this.previousView = view;
        }
        if (view.name === 'discover') {
            this.discoverOrder = store.songs.map(s => s.id).sort(() => Math.random() - 0.5);
        }
        this.view = view;
        this.closeSidebar();
        this.highlightNav();
        this.render(true);
        $('#main-view').scrollTo({ top: 0, behavior: 'smooth' });
    },

    songsForView(view = this.view) {
        const { songs } = store;
        switch (view.name) {
            case 'discover': return this.discoverOrder.map(id => store.getSong(id)).filter(Boolean);
            case 'favorites': return songs.filter(s => s.liked);
            case 'quran': return songs.filter(s => s.isQuran);
            case 'genre': return songs.filter(s => s.genre === view.id);
            case 'playlist': {
                const pl = store.getPlaylist(view.id);
                return pl ? pl.songIds.map(id => store.getSong(id)).filter(Boolean) : [];
            }
            case 'profile': return songs.filter(s => s.bookmarked);
            case 'search': {
                const q = normalizeText(view.query);
                return songs.filter(s => normalizeText(`${s.displayName} ${s.artist}`).includes(q));
            }
            default: return songs;
        }
    },

    titleForView(view = this.view) {
        if (view.name === 'genre') return SMART_PLAYLISTS.find(p => p.id === view.id)?.name ?? view.id;
        if (view.name === 'playlist') return store.getPlaylist(view.id)?.name ?? 'Playlist';
        if (view.name === 'profile') return 'Bookmarks';
        if (view.name === 'search') return `Results for "${view.query}"`;
        return VIEW_TITLES[view.name] ?? 'Your Library';
    },

    render(animate = false) {
        // A deleted playlist can't be shown anymore.
        if (this.view.name === 'playlist' && !store.getPlaylist(this.view.id)) this.view = { name: 'home' };
        if (this.view.name === 'profile' && !auth.user) this.view = { name: 'home' };

        const isHome = this.view.name === 'home';
        libraryUI.homeSections.hidden = !isHome;
        libraryUI.profileHeader.hidden = this.view.name !== 'profile';
        if (isHome) this.renderRecent(animate);
        if (this.view.name === 'profile') this.renderProfile();

        const songs = this.songsForView();
        libraryUI.title.textContent = this.titleForView();
        libraryUI.count.textContent = `${songs.length} ${songs.length === 1 ? 'track' : 'tracks'}`;

        if (songs.length) this.renderTracks(songs, libraryUI.grid, animate);
        else libraryUI.grid.innerHTML = this.emptyState();

        this.updateCounts();
        this.markActive();
    },

    renderRecent(animate = false) {
        libraryUI.recentSection.hidden = !store.history.length;
        this.renderTracks(store.history.map(id => store.getSong(id)).filter(Boolean), libraryUI.recentGrid, animate);
        this.markActive();
    },

    emptyState() {
        const states = {
            search: ['fa-magnifying-glass', 'No matches found', `Nothing in your library matches "${escapeHTML(this.view.query)}".`],
            favorites: ['fa-heart', 'No favorites yet', 'Tap the heart on any track to keep it here.'],
            quran: ['fa-book-quran', 'لا توجد سور بعد', 'Add complete surahs by your favourite reciter.', '<button class="btn btn-primary" data-open-add="quran"><i class="fas fa-plus"></i> Browse the Quran</button>'],
            playlist: ['fa-list', 'This playlist is empty', 'Use the <i class="fas fa-list-ul"></i> button on a track to add it here.'],
            profile: ['fa-bookmark', 'No bookmarks yet', 'Tap the bookmark icon on any track to save it here.']
        };
        const [icon, title, text, action = ''] = states[this.view.name]
            || ['fa-music', 'Your library is empty', 'Upload a file or search online to get started.', '<button class="btn btn-primary" data-open-add="file"><i class="fas fa-plus"></i> Add a track</button>'];
        return `<div class="empty-state"><i class="fas ${icon}"></i><h3>${title}</h3><p>${text}</p>${action}</div>`;
    },

    renderTracks(songs, container, animate) {
        container.songs = songs; // used as the play queue when a card is clicked
        container.innerHTML = songs.map((song, i) => this.cardHTML(song, i, animate)).join('');
    },

    cardHTML(song, index, animate) {
        const cover = song.cover
            ? `<img src="${escapeHTML(song.cover)}" alt="" loading="lazy">`
            : '<div class="cover-fallback"><i class="fas fa-music"></i></div>';
        const badge = song.isQuran ? '<span class="badge badge-full">Full</span>'
            : song.isPreview ? '<span class="badge badge-preview">30s</span>' : '';
        const anim = animate ? ` style="animation-delay:${Math.min(index, 12) * 30}ms"` : '';
        return `
            <article class="track-card${animate ? ' animate-in' : ''}" data-id="${escapeHTML(song.id)}"${anim}>
                <button class="row-index" data-action="play" aria-label="Play ${escapeHTML(song.displayName)}">
                    <span class="num">${index + 1}</span><i class="fas fa-play"></i>
                </button>
                <button class="card-cover" data-action="play" tabindex="-1" aria-hidden="true">
                    ${cover}
                    <span class="card-play-btn"><i class="fas fa-play"></i></span>
                </button>
                <div class="card-info">
                    <h3 class="card-title" title="${escapeHTML(song.displayName)}">${escapeHTML(song.displayName)}</h3>
                    <p class="card-artist">${badge}${escapeHTML(song.artist)}</p>
                </div>
                <div class="card-actions">
                    <button class="icon-btn${song.liked ? ' on' : ''}" data-action="like" title="Favorite"><i class="${song.liked ? 'fas' : 'far'} fa-heart"></i></button>
                    <button class="icon-btn${song.bookmarked ? ' on' : ''}" data-action="bookmark" title="Bookmark"><i class="${song.bookmarked ? 'fas' : 'far'} fa-bookmark"></i></button>
                    <button class="icon-btn" data-action="playlist" title="Add to playlist"><i class="fas fa-list-ul"></i></button>
                    <button class="icon-btn danger" data-action="delete" title="Remove"><i class="far fa-trash-can"></i></button>
                </div>
            </article>`;
    },

    // Highlights the playing track without re-rendering anything.
    markActive() {
        const current = player.current;
        $$('.track-card').forEach(card => {
            const active = Boolean(current) && card.dataset.id === String(current.id);
            card.classList.toggle('active', active);
            card.classList.toggle('playing', active && player.isPlaying);
            $$('.card-play-btn i, .row-index i', card).forEach(icon => {
                icon.className = `fas ${active && player.isPlaying ? 'fa-pause' : 'fa-play'}`;
            });
        });
    },

    // --- Sidebar ---
    renderSidebar() {
        const smart = SMART_PLAYLISTS.map(p => `
            <a href="#" class="nav-item" data-view="genre" data-id="${p.id}">
                <i class="fas ${p.icon}"></i><span>${p.name}</span><span class="track-count" data-count-genre="${p.id}">0</span>
            </a>`).join('');
        const custom = store.playlists.map(pl => `
            <a href="#" class="nav-item" data-view="playlist" data-id="${escapeHTML(pl.id)}">
                <i class="fas fa-music"></i><span>${escapeHTML(pl.name)}</span>
                <span class="track-count">${pl.songIds.length}</span>
                <button class="delete-playlist" data-delete-playlist="${escapeHTML(pl.id)}" title="Delete playlist"><i class="fas fa-xmark"></i></button>
            </a>`).join('');
        libraryUI.playlistList.innerHTML = smart + custom;
        this.highlightNav();
        this.updateCounts();
    },

    highlightNav() {
        libraryUI.navItems().forEach(item => {
            const match = item.dataset.view === this.view.name && (item.dataset.id ?? '') === String(this.view.id ?? '');
            item.classList.toggle('active', match);
        });
    },

    updateCounts() {
        $('#count-favorites').textContent = store.songs.filter(s => s.liked).length;
        $('#count-quran').textContent = store.songs.filter(s => s.isQuran).length;
        $$('[data-count-genre]').forEach(el => {
            el.textContent = store.songs.filter(s => s.genre === el.dataset.countGenre).length;
        });
        $$('.nav-item[data-view="playlist"]').forEach(el => {
            const pl = store.getPlaylist(el.dataset.id);
            if (pl) $('.track-count', el).textContent = pl.songIds.length;
        });
    },

    openSidebar() {
        libraryUI.sidebar.classList.add('open');
        document.body.classList.add('sidebar-open');
    },

    closeSidebar() {
        libraryUI.sidebar.classList.remove('open');
        document.body.classList.remove('sidebar-open');
    },

    // --- Profile ---
    renderProfile() {
        const user = auth.user;
        const { songs } = store;
        const avatar = user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=7c4dff&color=fff&size=128&bold=true`;
        const stats = [
            ['Bookmarks', songs.filter(s => s.bookmarked).length],
            ['Favorites', songs.filter(s => s.liked).length],
            ['Uploads', songs.filter(s => s.isLocal).length],
            ['Surahs', songs.filter(s => s.isQuran).length],
            ['Library', songs.length]
        ];
        libraryUI.profileHeader.innerHTML = `
            <div class="profile-banner">
                <div class="profile-user">
                    <img src="${escapeHTML(avatar)}" alt="" class="profile-avatar">
                    <div>
                        <p class="eyebrow">Your profile</p>
                        <h2>${escapeHTML(user.name)}</h2>
                        <p class="profile-email">${escapeHTML(user.email)}</p>
                    </div>
                </div>
                <div class="profile-stats">
                    ${stats.map(([label, value]) => `<div class="stat"><strong>${value}</strong><span>${label}</span></div>`).join('')}
                </div>
            </div>`;
    },

    // --- Track actions ---
    handleCardAction(action, song, container, trigger) {
        switch (action) {
            case 'play':
                player.playFrom(container.songs || store.songs, song.id);
                break;
            case 'like':
            case 'bookmark':
                store.toggle(song.id, action === 'like' ? 'liked' : 'bookmarked');
                document.dispatchEvent(new CustomEvent('library:changed'));
                break;
            case 'playlist':
                this.openPlaylistMenu(song.id, trigger);
                break;
            case 'delete':
                if (!confirm(`Remove "${song.displayName}" from your library?`)) return;
                player.forget(song.id);
                store.removeSong(song.id);
                document.dispatchEvent(new CustomEvent('library:changed'));
                showToast('Track removed', 'info');
                break;
        }
    },

    openPlaylistMenu(songId, trigger) {
        this.menuSongId = songId;
        const menu = libraryUI.playlistMenu;
        menu.innerHTML = `
            <p class="menu-title">Add to playlist</p>
            ${store.playlists.map(pl => {
                const has = pl.songIds.includes(songId);
                return `<button class="menu-item" data-playlist="${escapeHTML(pl.id)}" ${has ? 'disabled' : ''}>
                    <i class="fas ${has ? 'fa-check' : 'fa-music'}"></i>${escapeHTML(pl.name)}</button>`;
            }).join('') || '<p class="menu-empty">No playlists yet</p>'}
            <button class="menu-item accent" data-playlist="new"><i class="fas fa-plus"></i>New playlist</button>`;
        menu.hidden = false;

        const rect = trigger.getBoundingClientRect();
        const { offsetWidth: w, offsetHeight: h } = menu;
        menu.style.left = `${Math.max(8, Math.min(rect.right - w, innerWidth - w - 8))}px`;
        menu.style.top = `${rect.bottom + h + 8 > innerHeight ? rect.top - h - 6 : rect.bottom + 6}px`;
    },

    closePlaylistMenu() {
        libraryUI.playlistMenu.hidden = true;
        this.menuSongId = null;
    },

    createPlaylist() {
        const name = prompt('Playlist name:')?.trim();
        if (!name) return null;
        const playlist = store.createPlaylist(name);
        this.renderSidebar();
        showToast(`Created "${name}"`);
        return playlist;
    },

    bindEvents() {
        document.addEventListener('click', e => {
            // Track cards (any grid)
            const actionBtn = e.target.closest('.track-card [data-action]');
            if (actionBtn) {
                const card = actionBtn.closest('.track-card');
                const song = store.songs.find(s => String(s.id) === card.dataset.id);
                if (song) this.handleCardAction(actionBtn.dataset.action, song, card.parentElement, actionBtn);
                return;
            }
            // Like Spotify, clicking anywhere on a list row plays it.
            const row = e.target.closest('.track-list .track-card');
            if (row) {
                const song = store.songs.find(s => String(s.id) === row.dataset.id);
                if (song) this.handleCardAction('play', song, row.parentElement, row);
                return;
            }

            // Playlist menu
            const menuItem = e.target.closest('#playlist-menu [data-playlist]');
            if (menuItem) {
                const songId = this.menuSongId;
                const playlist = menuItem.dataset.playlist === 'new' ? this.createPlaylist() : store.getPlaylist(menuItem.dataset.playlist);
                if (playlist && store.addToPlaylist(playlist.id, songId)) {
                    showToast(`Added to ${playlist.name}`);
                    document.dispatchEvent(new CustomEvent('library:changed'));
                }
                this.closePlaylistMenu();
                return;
            }
            if (!e.target.closest('#playlist-menu')) this.closePlaylistMenu();

            // Sidebar
            const deleteBtn = e.target.closest('[data-delete-playlist]');
            if (deleteBtn) {
                e.preventDefault();
                const pl = store.getPlaylist(deleteBtn.dataset.deletePlaylist);
                if (pl && confirm(`Delete playlist "${pl.name}"?`)) {
                    store.deletePlaylist(pl.id);
                    this.renderSidebar();
                    this.render();
                }
                return;
            }
            const nav = e.target.closest('.nav-item[data-view]');
            if (nav) {
                e.preventDefault();
                this.show({ name: nav.dataset.view, id: nav.dataset.id });
                return;
            }
            if (e.target.closest('#show-all-btn')) this.show({ name: 'home' });
            if (e.target.closest('#create-playlist-btn')) this.createPlaylist();
            if (e.target.closest('#menu-toggle')) this.openSidebar();
            if (e.target.closest('#sidebar-backdrop')) this.closeSidebar();
        });

        libraryUI.search.addEventListener('input', e => {
            const query = e.target.value.trim();
            if (query) {
                this.view = { name: 'search', query };
                this.highlightNav();
                this.render();
            } else {
                // Restore the previous view as it was (show() would reshuffle Discover).
                this.view = this.previousView;
                this.highlightNav();
                this.render();
            }
        });

        document.addEventListener('library:changed', () => {
            this.renderSidebar();
            this.render();
            player.renderLike();
        });
        document.addEventListener('history:changed', () => {
            if (this.view.name === 'home') this.renderRecent();
        });
        document.addEventListener('player:trackchange', () => this.markActive());
        document.addEventListener('player:statechange', () => this.markActive());
        document.addEventListener('auth:change', () => this.render());
        window.addEventListener('resize', () => this.closePlaylistMenu());
        $('#main-view').addEventListener('scroll', () => this.closePlaylistMenu(), { passive: true });
    }
};
