/**
 * @file quranService.js
 * @description Frontend-only service for fetching Arabic text and translations.
 */

const TRANSLATION_IDS = { en: 131, id: 33, sw: 125, tr: 77, ur: 97, fr: 31, es: 83 };
const SURAH_INFO = { 1: { name: "Al-Fatihah", arabic: "الفاتحة" }, 18: { name: "Al-Kahf", arabic: "الكهف" } };

export function cleanTranslationText(text) {
  if (!text) return "";
  return text.replace(/<[^>]*>/g, "").replace(/[\(\[\{][\s\d\-–,،\u0660-\u0669\u06f0-\u06f9]*[\)\]\}]/g, " ").replace(/\s+/g, " ").trim();
}

export async function getSurahs() {
  try {
    const res = await fetch("https://api.quran.com/api/v4/chapters");
    const data = await res.json();
    return data.chapters.map(ch => ({ id: ch.id, name: ch.name_simple, arabic: ch.name_arabic, versesCount: ch.verses_count }));
  } catch (e) {
    return Object.keys(SURAH_INFO).map(id => ({ id: parseInt(id), name: SURAH_INFO[id].name, arabic: SURAH_INFO[id].arabic, versesCount: id === "18" ? 110 : 7 }));
  }
}

export async function fetchVerses(surahId, startVerse, endVerse, secondLanguage = "id", reciterName = "Mishary Rashid Alafasy") {
  const RECITER_IDS = {
    "Mishary Rashid Alafasy": 7,
    "Abdul Rahman Al-Sudais": 3,
    "Saad Al-Ghamdi": 4,
    "Maher Al-Muaiqly": 12,
    "Yasser Al-Dosari": 11,
    "Abu Bakr Al-Shatri": 10,
    "Nasser Al-Qatami": 115,
    "Hani Ar-Rifai": 9,
    "Khalil al-Husary": 5,
    "Muhammad Siddiq al-Minshawi": 1,
    "Mustafa Ismail": 124
  };

  const recitationId = RECITER_IDS[reciterName] || 7;
  const audioFilesMap = {};
  try {
    const audioRes = await fetch(`https://api.quran.com/api/v4/quran/recitations/${recitationId}?chapter_number=${surahId}`);
    const audioData = await audioRes.json();
    audioData.audio_files.forEach(file => {
      if (file.verse_key && file.url) audioFilesMap[file.verse_key] = file.url.startsWith("http") ? file.url : `https://audio.qurancdn.com/${file.url}`;
    });
  } catch (e) {}

  const versesData = [];
  for (let v = startVerse; v <= endVerse; v++) {
    const key = `${surahId}:${v}`;
    try {
      const arRes = await fetch(`https://api.quran.com/api/v4/quran/verses/uthmani?verse_key=${key}`);
      const arData = await arRes.json();
      const enRes = await fetch(`https://api.quran.com/api/v4/quran/translations/${TRANSLATION_IDS.en}?verse_key=${key}`);
      const enData = await enRes.json();
      
      let secText = "";
      if (secondLanguage !== "en") {
        const secRes = await fetch(`https://api.quran.com/api/v4/quran/translations/${TRANSLATION_IDS[secondLanguage] || 33}?verse_key=${key}`);
        const secData = await secRes.json();
        secText = cleanTranslationText(secData.translations[0].text);
      }

      versesData.push({
        surahName: SURAH_INFO[surahId]?.name || `Surah ${surahId}`,
        verseKey: key,
        arabic: arData.verses[0].text_uthmani,
        translations: { en: cleanTranslationText(enData.translations[0].text), [secondLanguage]: secText },
        audio: audioFilesMap[key]
      });
    } catch (e) {}
  }
  return versesData;
}

export const quranService = { getSurahs, fetchVerses };