# 🎧 Nebula Music Dashboard
*A Professional, Cloud-Integrated Audio Experience*

Nebula is a premium music player built with a modern glassmorphism aesthetic, featuring deep integration with cloud services and local browser storage.

## ✨ Key Features

### 🔍 Intelligence & Search
- **Instant Search**: Search millions of tracks via the integrated iTunes Search engine.
- **One-Click Add**: Add searched tracks directly to your persistent library with high-res cover art.
- **Auto-Metadata**: Automatically fetches genre, artist, and album art for every online track.

### 💾 Reliability & Persistence
- **Local File Sync**: Add your own MP3s and they'll stay in your library forever (even after refresh) using **IndexedDB**.
- **Cloud Metadata**: your library metadata and 'Liked' status are synced via **LocalStorage**.
- **Google Identity**: Secure login with **Firebase Google Auth** to personalize your profile.

### 🎨 Stunning Visuals
- **Dynamic Backgrounds**: Background aura blobs morph and move based on your current track.
- **Audio Visualizer**: Real-time CSS-animated bars that react during playback.
- **Skeleton Loading**: High-performance "shimmer" loading effects for search results.
- **Glassmorphism UI**: A dark, premium aesthetic with blur effects and vibrant gradients.

### 📱 Fully Responsive
- Seamlessly transitions from ultra-wide desktops to compact mobile navigation bars.

## 🛠️ Technology Stack
- **Frontend**: HTML5, Vanilla CSS3, JavaScript (ES6+)
- **Storage**: IndexedDB (Native), LocalStorage
- **APIs**: iTunes Search API, Spotify IFrame API
- **Auth**: Firebase Authentication (Google OAuth)
- **Icons**: Font Awesome 6.0

## 🚀 Getting Started
1. Open `index.html` in your browser (or use the provided local server link).
2. **Persistence Note**: If using Google Auth, ensure you've updated the `firebaseConfig` in `Js/auth.js` with your own keys.
3. Start adding music by dragging files or using the "Search Online" feature!

---
*Created with ❤️ for the AS Music Player Course.*
