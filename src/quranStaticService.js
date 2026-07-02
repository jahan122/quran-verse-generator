/**
 * @file quranStaticService.js
 * @description Provides getSurah and getVerse helpers that read the
 * statically generated surah modules. No network requests, no async loading.
 */

const surahModules = {};

function loadSurah(number) {
  return import(`./data/surah_${number}.js`);
}

function getSurah(number) {
  const mod = surahModules[number];
  if (!mod) throw new Error(`Surah ${number} not loaded`);
  return mod.surah;
}

export function getVerse(surahNumber, ayahNumber) {
  if (!surahModules[surahNumber]) return { arabic: '', english: '' };
  const surah = surahModules[surahNumber];
  const ayah = surah.ayahs.find(v => v.ayah === ayahNumber);
  return {
    arabic: ayah?.arabic || '',
    english: ayah?.english || ''
  };
}

export async function preloadAllSurahs() {
  const promises = [];
  for (let i = 1; i <= 114; i++) {
    promises.push(loadSurah(i).then(mod => { surahModules[i] = mod; }));
  }
  await Promise.all(promises);
}