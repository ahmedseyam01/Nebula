/**
 * quran.js - Full-length Quran recitations from the mp3quran.net API.
 * Unlike the iTunes previews (30s), every surah here is the complete recording.
 */

const QURAN_API = 'https://www.mp3quran.net/api/v3';
const QURAN_COVER = 'assets/quran-cover.svg';

// Shown first in pickers and used when a search names a surah but no reciter.
const FEATURED_RECITERS = [123, 51, 118, 112, 54, 102, 92, 31, 86];

const QURAN_KEYWORDS = ['قران', 'القران', 'الكريم', 'سوره', 'سورت', 'تلاوه', 'كامله', 'كامل', 'الشيخ', 'للشيخ', 'القارئ', 'بصوت',
    'quran', 'koran', 'surah', 'sura', 'surat', 'sheikh', 'recitation', 'full'];

const GENERIC_NAME_PARTS = new Set(['محمد', 'احمد', 'عبدالله', 'عبدالرحمن', 'عبد', 'الله', 'ابراهيم', 'علي', 'بن', 'ابو', 'عبدالعزيز',
    'mohammed', 'muhammad', 'mohamed', 'ahmed', 'ahmad', 'abdullah', 'abdulrahman', 'abdul', 'ibn', 'bin', 'abu', 'ali', 'ibrahim']);

const stripArticle = word => word.replace(/^(ال|al)(?=.{2,})/, '');

const quran = {
    dataPromise: null,

    // Loads (once) the surah list and reciters in Arabic + English for matching.
    load() {
        if (!this.dataPromise) {
            const get = path => fetch(`${QURAN_API}/${path}`).then(r => {
                if (!r.ok) throw new Error(`Quran API ${r.status}`);
                return r.json();
            });
            this.dataPromise = Promise.all([
                get('suwar?language=ar'), get('suwar?language=eng'),
                get('reciters?language=ar'), get('reciters?language=eng')
            ]).then(([suwarAr, suwarEn, recitersAr, recitersEn]) => {
                const enSurah = new Map(suwarEn.suwar.map(s => [s.id, s.name]));
                const enReciter = new Map(recitersEn.reciters.map(r => [r.id, r.name]));

                const suwar = suwarAr.suwar.map(s => {
                    const nameEn = enSurah.get(s.id) || '';
                    const keys = [normalizeText(s.name), normalizeText(nameEn)].filter(Boolean);
                    return { id: s.id, name: s.name, nameEn, makkia: s.makkia, keys: [...new Set([...keys, ...keys.map(k => k.split(' ').map(stripArticle).join(' '))])] };
                });

                const reciters = recitersAr.reciters
                    .map(r => ({ id: r.id, name: r.name, nameEn: enReciter.get(r.id) || '', moshaf: this.pickMoshaf(r.moshaf) }))
                    .filter(r => r.moshaf)
                    .map(r => ({ ...r, tokens: this.nameTokens(`${r.name} ${r.nameEn}`) }))
                    .sort((a, b) => this.rank(a) - this.rank(b) || a.name.localeCompare(b.name, 'ar'));

                return { suwar, reciters };
            }).catch(err => {
                this.dataPromise = null; // allow a retry next time
                throw err;
            });
        }
        return this.dataPromise;
    },

    rank(reciter) {
        const i = FEATURED_RECITERS.indexOf(reciter.id);
        return i === -1 ? FEATURED_RECITERS.length : i;
    },

    // Prefer the most complete Hafs recording a reciter has.
    pickMoshaf(list = []) {
        const parsed = list.map(m => ({
            id: m.id,
            name: m.name,
            server: m.server,
            surahs: new Set(String(m.surah_list).split(',').map(Number).filter(Boolean))
        })).filter(m => m.server && m.surahs.size);
        parsed.sort((a, b) => (b.surahs.size - a.surahs.size) || (b.name.includes('حفص') - a.name.includes('حفص')));
        return parsed[0] || null;
    },

    nameTokens(name) {
        return normalizeText(name).split(' ').map(stripArticle).filter(t => t.length >= 3 && !GENERIC_NAME_PARTS.has(t));
    },

    surahUrl(moshaf, surahId) {
        return `${moshaf.server}${String(surahId).padStart(3, '0')}.mp3`;
    },

    toSong(surah, reciter) {
        return {
            id: `quran-${reciter.moshaf.id}-${surah.id}`,
            displayName: `سورة ${surah.name}`,
            artist: reciter.name,
            src: this.surahUrl(reciter.moshaf, surah.id),
            cover: QURAN_COVER,
            genre: 'Quran',
            isQuran: true
        };
    },

    surahsFor(reciter, suwar) {
        return suwar.filter(s => reciter.moshaf.surahs.has(s.id));
    },

    /**
     * Interprets free text such as "سورة البقرة العفاسي", "يس", "maher" or "quran".
     * Returns groups of { reciter, suwar } or [] when the query isn't Quran related.
     */
    async search(query) {
        const { suwar, reciters } = await this.load();
        const normalized = normalizeText(query);
        let tokens = normalized.split(' ').filter(Boolean);
        const hasKeyword = tokens.some(t => QURAN_KEYWORDS.includes(t));
        tokens = tokens.filter(t => !QURAN_KEYWORDS.includes(t));
        if (!tokens.length) {
            return hasKeyword ? [{ reciter: reciters[0], suwar: this.surahsFor(reciters[0], suwar) }] : [];
        }

        // 1) Surahs: whole-word match anywhere in the query, or prefix match while typing.
        const padded = ` ${tokens.join(' ')} ${tokens.map(stripArticle).join(' ')} `;
        const lastToken = stripArticle(tokens[tokens.length - 1]);
        const usedWords = new Set();
        const matchedSuwar = suwar.filter(s => s.keys.some(key => {
            const exact = padded.includes(` ${key} `);
            const prefix = tokens.length === 1 && lastToken.length >= 3 && stripArticle(key).startsWith(lastToken);
            if (exact || prefix) key.split(' ').forEach(w => { usedWords.add(w); usedWords.add(stripArticle(w)); });
            return exact || prefix;
        }));

        // 2) Reciters: any distinctive name part, using the words the surah match didn't consume.
        const rest = tokens.map(stripArticle).filter(t => t.length >= 3 && !usedWords.has(t));
        // Keep only the best-scoring reciters, so "ماهر المعيقلي" doesn't also return other Mahers.
        const scored = rest.length
            ? reciters.map(r => ({ r, score: rest.filter(t => r.tokens.some(rt => rt === t || (t.length >= 4 && rt.startsWith(t)))).length }))
                .filter(x => x.score > 0)
            : [];
        const best = Math.max(0, ...scored.map(x => x.score));
        const matchedReciters = scored.filter(x => x.score === best).map(x => x.r);

        if (matchedSuwar.length && matchedReciters.length) {
            return matchedReciters.slice(0, 5)
                .map(reciter => ({ reciter, suwar: matchedSuwar.filter(s => reciter.moshaf.surahs.has(s.id)) }))
                .filter(g => g.suwar.length);
        }
        if (matchedSuwar.length) {
            const featured = reciters.filter(r => FEATURED_RECITERS.includes(r.id));
            return featured
                .map(reciter => ({ reciter, suwar: matchedSuwar.filter(s => reciter.moshaf.surahs.has(s.id)).slice(0, 3) }))
                .filter(g => g.suwar.length);
        }
        if (matchedReciters.length) {
            return matchedReciters.slice(0, 2).map(reciter => ({ reciter, suwar: this.surahsFor(reciter, suwar) }));
        }
        return [];
    }
};
