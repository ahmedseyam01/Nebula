# 🎧 Nebula Music Player

A modern music & Quran player built with plain HTML, CSS and JavaScript (no build step).

## ✨ Features

- **Full Quran recitations**: complete surahs (not 30-second clips) from 200+ reciters via the [mp3quran.net](https://mp3quran.net) API. Browse by reciter, filter by surah, or add a reciter's whole Quran in one click.
- **Smart online search**: type `سورة البقرة`, `يس العفاسي`, `ماهر` or `Al-Kahf` and the Quran results show up first. Song results from iTunes are labelled **30s** because iTunes only gives previews.
- **Local uploads**: drag & drop audio files; they're kept in **IndexedDB** so they survive a reload.
- **Library tools**: favorites, bookmarks, custom playlists, recently played, search, shuffle/repeat.
- **Resume playback**: remembers the last track and position (useful for long surahs).
- **Media keys / lock screen** controls through the Media Session API.
- **Local demo accounts** with a profile page (stored in the browser only, not real security).
- Fully responsive, from wide desktops down to phones.

## 🗂️ Project structure

```
index.html
assets/            covers, favicon, Quran cover
css/
  base.css         design tokens, reset, animations
  layout.css       app grid, sidebar, topbar, hero, profile, footer
  components.css   buttons, inputs, badges, toasts, popover menu
  tracks.css       track cards / list rows
  player.css       bottom player bar
  modals.css       add-track & auth dialogs
js/
  utils.js         shared helpers ($, escapeHTML, formatTime, toast…)
  db.js            IndexedDB wrapper for uploaded files
  store.js         library state + localStorage persistence
  quran.js         mp3quran API + Quran search matching
  player.js        audio engine, queue, player bar
  library.js       views, track cards, sidebar, playlist menu
  add-modal.js     upload / online search / Quran browser dialog
  auth.js          local accounts
  app.js           boot
```

Scripts are plain (non-module) files loaded in order, so the app also works when `index.html` is opened directly from disk.

## 🚀 Getting started

Open `index.html` in a browser, or serve the folder with any static server.
