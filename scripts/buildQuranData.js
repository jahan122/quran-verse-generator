/**
 * Build script – run with `node scripts/buildQuranData.js` to generate
 * src/data/surah_*.js files from the public Quran JSON mirrors.
 * This script is **only** for development; it is never executed at runtime.
 */

import { writeFileSync } from 'fs';
import { resolve } from 'path';

// URLs of the static mirrors (CORS‑free)
const ARABIC_URL = 'https://raw.githubusercontent.com/semarketir/quranjson/master/source/quran.json';
const ENGLISH_URL = 'https://raw.githubusercontent.com/semarketir/quranjson/master/source/en.translation.json';

// Simple GET with 10‑second timeout
async function get(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  const res = await fetch(url, { signal: controller.signal });
  clearTimeout(timeout);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}

// Build a lookup by verse key "surah:ayah"
function buildIndex(data) {
  const map = new Map();
  data.forEach(item => map.set(item.verse, item));
  return map;
}

// Main
(async () => {
  try {
    const [arabicJson, englishJson] = await Promise.all([
      get(ARABIC_URL),
      get(ENGLISH_URL)
    ]);

    const arabicIndex = buildIndex(arabicJson);
    const englishIndex = buildIndex(englishJson);

    // Generate a file for each surah (1‑114)
    for (let surah = 1; surah <= 114; surah++) {
      const surahAyahs = [];

      for (let ayah = 1; ayah <= 286; ayah++) {
        const key = `${surah}:${ayah}`;
        if (!arabicIndex.has(key)) continue;
        const arabicText = arabicIndex.get(key).text || '';
        const englishText = englishIndex.get(key)?.translation || '';
        surahAyahs.push({
          ayah,
          arabic: arabicText,
          english: englishText
        });
      }

      const filePath = resolve('src', 'data', `surah_${surah}.js`);
      const output = `export const surah = {\n` +
        `  number: ${surah},\n` +
        `  name: "${arabicIndex.get(`${surah}:1`)?.name || ''}",\n` +
        `  englishName: "${englishIndex.find(v => v.verse.startsWith(surah + ':1'))?.translation || ''}",\n` +
        `  ayahs: [\n`;

      for (const v of surahAyahs) {
        output += `    {\n`;
        output += `      ayah: ${v.ayah},\n`;
        output += `      arabic: "${v.arabic.replace(/"/g, '\\"')}",\n`;
        output += `      english: "${v.english.replace(/"/g, '\\"')}"\n`;
        output += `    },\n`;
      }
      output += `  ]\n};`;

      writeFileSync(filePath, output, 'utf8');
      console.log(`Generated src/data/surah_${surah}.js`);
    }
  } catch (err) {
    console.error('Build script failed:', err);
    process.exit(1);
  }
})();