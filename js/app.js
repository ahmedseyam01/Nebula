/**
 * app.js - Boots the app once every module is loaded.
 */

async function initApp() {
    await store.load();
    auth.init();
    player.init();
    library.init();
    addModal.init();

    // Shared modal behaviour: close on backdrop click or Escape.
    $$('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', e => { if (e.target === overlay) overlay.classList.remove('active'); });
    });
    document.addEventListener('keydown', e => {
        if (e.key !== 'Escape') return;
        closeAllModals();
        library.closePlaylistMenu();
        library.closeSidebar();
    });
}

initApp().catch(e => {
    console.error('Nebula failed to start:', e);
    showToast('Something went wrong while loading your library', 'error');
});
