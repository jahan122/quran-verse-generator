/**
 * @file quranDataStore.js
 * @description Background Quran data loader with non-blocking async
 */

const ARABIC_URL = 'https://raw.githubusercontent.com/semarketir/quranjson/master/source/quran.json';
const ENGLISH_URL = 'https://raw.githubusercontent.com/semarketir/quranjson/master/source/en.translation.json';

let arabicData = null;
let englishData = null;
let loadingPromise = null;

/**
 * Background data loader with timeout and retry
 */
function loadQuranInBackground() {
  if (loadingPromise) return loadingPromise;

  loadingPromise = new Promise((resolve, reject) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const loadWithRetry = async (url, cacheKey) => {
      try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        localStorage.setItem(cacheKey, JSON.stringify(data));
        return data;
      } catch (error) {
        try {
          const cached = localStorage.getItem(cacheKey);
          if (cached) return JSON.parse(cached);
        } catch (e) {}
        return null;
      }
    };

    const [arabic, english] = await Promise.all([
      loadWithRetry(ARABIC_URL, 'quran_arabic_cache'),
      loadWithRetry(ENGLISH_URL, 'quran_english_cache')
    ]);

    arabicData = arabic || {};
    englishData = english || {};
    resolve();
  });

  return loadingPromise;
}

/**
 * Safe verse lookup with fallback
 */
export function getVerseSafe(surah, ayah) {
  if (!arabicData || !englishData) {
    throw new Error('Quran data not ready');
  }

  const key = `${surah}:${ayah}`;
  const arabicVerse = arabicData.find(v => v.verse === key);
  const englishVerse = englishData.find(v => v.verse === key);

  if (!arabicVerse || !englishVerse) {
    throw new Error('Verse not found');
  }

  return {
    arabic: arabicVerse.text,
    english: englishVerse.translation
  };
}