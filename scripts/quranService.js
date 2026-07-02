/**
 * @file quranService.js
 * @description Quran verse fetching using static JSON mirrors only.
 * NEVER calls Quran.com API at runtime.
 */

const ARABIC_URL = 'https://raw.githubusercontent.com/semarketir/quranjson/master/source/quran.json';
const ENGLISH_URL = 'https://raw.githubusercontent.com/semarketir/quranjson/master/source/en.translation.json';

const CACHE_KEY_ARABIC = 'quran_arabic_cache';
const CACHE_KEY_ENGLISH = 'quran_english_cache';
const CACHE_KEY_TIMESTAMP = 'quran_cache_timestamp';

let arabicData = null;
let englishData = null;
let isInitialized = false;

/**
 * Timeout wrapper for fetch
 */
function fetchWithTimeout(url, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    fetch(url, { signal: controller.signal })
      .then(response => {
        clearTimeout(timeoutId);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then(resolve)
      .catch(reject);
  });
}

/**
 * Load both Arabic and English data with retry
 */
async function loadData() {
  const loadWithRetry = async (url, cacheKey, dataSetter) => {
    try {
      const data = await fetchWithTimeout(url);
      localStorage.setItem(cacheKey, JSON.stringify(data));
      dataSetter(data);
      return data;
    } catch (error) {
      console.warn(`Failed to fetch ${url}, trying localStorage cache`);
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          dataSetter(parsed);
          return parsed;
        }
      } catch (e) {
        console.warn(`Failed to load from localStorage for ${cacheKey}`);
      }
      return null;
    }
  };

  await Promise.all([
    loadWithRetry(ARABIC_URL, CACHE_KEY_ARABIC, (d) => { arabicData = d; }),
    loadWithRetry(ENGLISH_URL, CACHE_KEY_ENGLISH, (d) => { englishData = d; })
  ]);

  isInitialized = true;
}

/**
 * Initialize the Quran data on module load
 */
(async () => {
  await loadData();
})();

/**
 * Get a single verse by surah and ayah number
 * @param {number} surah - Surah number (1-114)
 * @param {number} ayah - Ayah number
 * @returns {Promise<{arabic: string, english: string}>}
 */
export async function getVerse(surah, ayah) {
  // Ensure data is loaded
  if (!isInitialized || !arabicData || !englishData) {
    await loadData();
  }

  const verseKey = `${surah}:${ayah}`;

  try {
    // Find Arabic text
    const arabicVerse = arabicData?.find(v => v.verse === verseKey);
    const arabic = arabicVerse?.text || '';

    // Find English translation
    const englishVerse = englishData?.find(v => v.verse === verseKey);
    const english = englishVerse?.translation || '';

    if (!arabic && !english) {
      return { arabic: '', english: '' };
    }

    return { arabic, english };
  } catch (error) {
    console.warn(`Error getting verse ${verseKey}:`, error);
    return { arabic: '', english: '' };
  }
}

/**
 * Get multiple verses
 * @param {number} surah - Surah number
 * @param {number} startAyah - Start ayah
 * @param {number} endAyah - End ayah
 * @returns {Promise<Array<{arabic: string, english: string}>>}
 */
export async function getVerses(surah, startAyah, endAyah) {
  const verses = [];
  for (let ayah = startAyah; ayah <= endAyah; ayah++) {
    const verse = await getVerse(surah, ayah);
    verses.push(verse);
  }
  return verses;
}

/**
 * Get full surah verses
 * @param {number} surah - Surah number
 * @returns {Promise<Array<{arabic: string, english: string}>>}
 */
export async function getSurahVerses(surah) {
  if (!isInitialized || !arabicData) {
    await loadData();
  }

  const surahVerses = arabicData?.filter(v => v.verse.startsWith(`${surah}:`)) || [];
  const result = [];

  for (const verse of surahVerses) {
    const [s, a] = verse.verse.split(':').map(Number);
    const englishVerse = englishData?.find(v => v.verse === verse.verse);
    result.push({
      arabic: verse.text,
      english: englishVerse?.translation || ''
    });
  }

  return result;
}

export const quranService = {
  getVerse,
  getVerses,
  getSurahVerses
};