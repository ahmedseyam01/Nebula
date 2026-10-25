/**
 * add-modal.js - The "Add Track" dialog: local uploads, online search (Quran + iTunes)
 * and the Quran browser.
 */

const addUI = {
    overlay: $('#add-modal'),
    tabs: () => $$('#add-modal .tab-btn'),
    panels: () => $$('#add-modal .tab-panel'),
    // Upload
    dropZone: $('#drop-zone'),
    fileInput: $('#file-input'),
    fileTitle: $('#file-title'),
    fileName: $('#selected-file-name'),
    submitFile: $('#submit-file'),
    // Online search
    searchInput: $('#online-search-input'),
    clearSearch: $('#clear-online-search'),
    results: $('#online-results'),
    // Quran browser
    reciterSelect: $('#reciter-select'),
    surahFilter: $('#surah-filter'),
    addAllBtn: $('#add-all-surahs'),
    surahList: $('#surah-list')
};

const SKELETON = `
    <div class="result-item skeleton">
        <div class="skeleton-img"></div>
        <div class="result-info"><div class="skeleton-line title"></div><div class="skeleton-line artist"></div></div>
    </div>`.repeat(4);

const addModal = {
    searchId: 0,
    debounce: null,
    selectedFile: null,
    quranData: null,

    init() {
        this.bindEvents();
    },

    open(tab = 'file') {
        library.closeSidebar();
        addUI.overlay.classList.add('active');
        this.switchTab(tab);
    },

    close() {
        addUI.overlay.classList.remove('active');
    },

    switchTab(name) {
        addUI.tabs().forEach(t => t.classList.toggle('active', t.dataset.tab === name));
        addUI.panels().forEach(p => { p.hidden = p.dataset.panel !== name; });
        if (name === 'search') addUI.searchInput.focus();
        if (name === 'quran') this.initQuranBrowser();
    },

    addSong(song, button) {
        if (store.addSong(song)) {
            showToast(`Added ${song.displayName}${song.isPreview ? ' (30s preview)' : ''}`);
            document.dispatchEvent(new CustomEvent('library:changed'));
        }
        if (button) this.markAdded(button);
    },

    markAdded(button) {
        button.classList.add('added');
        button.disabled = true;
        button.innerHTML = '<i class="fas fa-check"></i>';
    },

    resultItem(song, note = '') {
        const item = document.createElement('div');
        item.className = 'result-item';
        const added = store.hasSong(song.id);
        const badge = song.isQuran ? '<span class="badge badge-full">Full</span>' : song.isPreview ? '<span class="badge badge-preview">30s</span>' : '';
        item.innerHTML = `
            <img class="result-cover" src="${escapeHTML(song.cover)}" alt="" loading="lazy">
            <div class="result-info">
                <div class="result-title">${escapeHTML(song.displayName)}</div>
                <div class="result-artist">${badge}${escapeHTML(song.artist)}${note ? ` · ${escapeHTML(note)}` : ''}</div>
            </div>
            <button class="add-result-btn${added ? ' added' : ''}" title="Add to library" ${added ? 'disabled' : ''}>
                <i class="fas ${added ? 'fa-check' : 'fa-plus'}"></i>
            </button>`;
        const btn = $('.add-result-btn', item);
        btn.addEventListener('click', () => this.addSong(song, btn));
        return item;
    },

    groupHeader(title, subtitle, onAddAll) {
        const header = document.createElement('div');
        header.className = 'results-group-header';
        header.innerHTML = `<div><h4>${escapeHTML(title)}</h4><p>${escapeHTML(subtitle)}</p></div>`;
        if (onAddAll) {
            const btn = document.createElement('button');
            btn.className = 'btn btn-ghost btn-sm';
            btn.innerHTML = '<i class="fas fa-plus"></i> Add all';
            btn.addEventListener('click', () => onAddAll(btn));
            header.appendChild(btn);
        }
        return header;
    },

    addMany(songs, btn, container) {
        const added = songs.filter(s => store.addSong(s)).length;
        if (added) document.dispatchEvent(new CustomEvent('library:changed'));
        showToast(added ? `Added ${added} surahs` : 'Already in your library', added ? 'success' : 'info');
        $$('.add-result-btn:not(.added)', container).forEach(b => this.markAdded(b));
        btn.disabled = true;
    },

    // --- Online search ---
    async searchOnline(query) {
        const id = ++this.searchId;
        if (!query) {
            addUI.results.innerHTML = '<div class="empty-results-msg">Search for a song, artist, surah or reciter…</div>';
            return;
        }
        addUI.results.innerHTML = SKELETON;

        const [quranGroups, tracks] = await Promise.all([
            quran.search(query).catch(e => { console.warn('Quran search failed', e); return []; }),
            this.searchItunes(query).catch(e => { console.warn('iTunes search failed', e); return null; })
        ]);
        if (id !== this.searchId) return; // a newer search started

        addUI.results.innerHTML = '';
        quranGroups.forEach(({ reciter, suwar }) => {
            const songs = suwar.map(s => quran.toSong(s, reciter));
            const group = document.createElement('div');
            group.className = 'results-group';
            group.appendChild(this.groupHeader(reciter.name, `Full recitation · ${songs.length} ${songs.length === 1 ? 'surah' : 'surahs'}`,
                songs.length > 1 ? btn => this.addMany(songs, btn, group) : null));
            songs.forEach(song => group.appendChild(this.resultItem(song)));
            addUI.results.appendChild(group);
        });

        if (tracks?.length) {
            const group = document.createElement('div');
            group.className = 'results-group';
            group.appendChild(this.groupHeader('Songs', 'iTunes only provides 30-second previews'));
            tracks.forEach(song => group.appendChild(this.resultItem(song)));
            addUI.results.appendChild(group);
        }

        if (!quranGroups.length && !tracks?.length) {
            addUI.results.innerHTML = tracks === null
                ? '<div class="empty-results-msg">Search failed. Check your internet connection.</div>'
                : `<div class="empty-results-msg"><i class="fas fa-magnifying-glass"></i><p>No results for "${escapeHTML(query)}"</p></div>`;
        }
    },

    async searchItunes(query) {
        const country = /[؀-ۿ]/.test(query) ? 'EG' : 'US';
        const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&entity=song&limit=20&country=${country}`);
        if (!res.ok) throw new Error(`iTunes ${res.status}`);
        const data = await res.json();
        return (data.results || [])
            .filter(t => t.wrapperType === 'track' && t.previewUrl)
            .map(t => ({
                id: `itunes-${t.trackId}`,
                displayName: t.trackName || 'Unknown Title',
                artist: t.artistName || 'Unknown Artist',
                src: t.previewUrl,
                cover: t.artworkUrl100 ? t.artworkUrl100.replace('100x100', '600x600') : 'assets/cover1.png',
                genre: t.primaryGenreName,
                isPreview: true
            }));
    },

    // --- Quran browser ---
    async initQuranBrowser() {
        if (this.quranData) return;
        addUI.surahList.innerHTML = SKELETON;
        try {
            this.quranData = await quran.load();
        } catch (e) {
            console.error(e);
            addUI.surahList.innerHTML = '<div class="empty-results-msg">Couldn\'t load the reciters. Check your connection and reopen this tab.</div>';
            return;
        }
        const { reciters } = this.quranData;
        const option = r => `<option value="${r.id}">${escapeHTML(r.name)}${r.moshaf.surahs.size < 114 ? ` (${r.moshaf.surahs.size} surahs)` : ''}</option>`;
        const featured = reciters.filter(r => FEATURED_RECITERS.includes(r.id));
        const others = reciters.filter(r => !FEATURED_RECITERS.includes(r.id));
        addUI.reciterSelect.innerHTML = `
            <optgroup label="Popular">${featured.map(option).join('')}</optgroup>
            <optgroup label="All reciters">${others.map(option).join('')}</optgroup>`;
        this.renderSurahList();
    },

    renderSurahList() {
        if (!this.quranData) return;
        const reciter = this.quranData.reciters.find(r => String(r.id) === addUI.reciterSelect.value);
        if (!reciter) return;
        const filter = normalizeText(addUI.surahFilter.value);
        const suwar = quran.surahsFor(reciter, this.quranData.suwar)
            .filter(s => !filter || String(s.id) === filter || s.keys.some(k => k.includes(filter)));

        addUI.surahList.innerHTML = '';
        if (!suwar.length) {
            addUI.surahList.innerHTML = '<div class="empty-results-msg">No surah matches that name.</div>';
            return;
        }
        suwar.forEach(s => addUI.surahList.appendChild(this.resultItem(quran.toSong(s, reciter), `${s.id}. ${s.nameEn}`)));
        addUI.addAllBtn.disabled = false;
        addUI.addAllBtn.onclick = () => this.addMany(suwar.map(s => quran.toSong(s, reciter)), addUI.addAllBtn, addUI.surahList);
    },

    // --- Local upload ---
    selectFile(file) {
        if (!file) return;
        if (!file.type.startsWith('audio/')) {
            showToast('Please choose an audio file', 'error');
            return;
        }
        this.selectedFile = file;
        addUI.fileName.textContent = file.name;
        addUI.dropZone.classList.add('has-file');
        if (!addUI.fileTitle.value) addUI.fileTitle.value = file.name.replace(/\.[^.]+$/, '');
    },

    async uploadFile() {
        const file = this.selectedFile;
        if (!file) {
            showToast('Please select a file first', 'error');
            return;
        }
        const id = createId('local');
        try {
            await musicDB.saveTrack(id, file);
        } catch (e) {
            console.error('Could not save to IndexedDB', e);
            showToast('Saved for this session only (storage unavailable)', 'info');
        }
        this.addSong({
            id,
            displayName: addUI.fileTitle.value.trim() || file.name.replace(/\.[^.]+$/, ''),
            artist: 'Local Track',
            src: URL.createObjectURL(file),
            cover: '',
            isLocal: true
        });
        this.resetUpload();
        this.close();
    },

    resetUpload() {
        this.selectedFile = null;
        addUI.fileInput.value = '';
        addUI.fileTitle.value = '';
        addUI.fileName.textContent = '';
        addUI.dropZone.classList.remove('has-file');
    },

    bindEvents() {
        document.addEventListener('click', e => {
            const opener = e.target.closest('[data-open-add]');
            if (opener) {
                e.preventDefault();
                this.open(opener.dataset.openAdd || 'file');
            }
        });
        $('#close-add-modal').addEventListener('click', () => this.close());
        addUI.tabs().forEach(tab => tab.addEventListener('click', () => this.switchTab(tab.dataset.tab)));

        // Upload
        addUI.dropZone.addEventListener('click', () => addUI.fileInput.click());
        addUI.dropZone.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') addUI.fileInput.click(); });
        addUI.dropZone.addEventListener('dragover', e => { e.preventDefault(); addUI.dropZone.classList.add('dragover'); });
        addUI.dropZone.addEventListener('dragleave', () => addUI.dropZone.classList.remove('dragover'));
        addUI.dropZone.addEventListener('drop', e => {
            e.preventDefault();
            addUI.dropZone.classList.remove('dragover');
            this.selectFile(e.dataTransfer.files[0]);
        });
        addUI.fileInput.addEventListener('change', e => this.selectFile(e.target.files[0]));
        addUI.submitFile.addEventListener('click', () => this.uploadFile());

        // Online search
        addUI.searchInput.addEventListener('input', e => {
            const query = e.target.value.trim();
            addUI.clearSearch.hidden = !query;
            clearTimeout(this.debounce);
            this.debounce = setTimeout(() => this.searchOnline(query), 450);
        });
        addUI.clearSearch.addEventListener('click', () => {
            addUI.searchInput.value = '';
            addUI.clearSearch.hidden = true;
            this.searchOnline('');
            addUI.searchInput.focus();
        });

        // Quran browser
        addUI.reciterSelect.addEventListener('change', () => this.renderSurahList());
        addUI.surahFilter.addEventListener('input', () => this.renderSurahList());
    }
};
