/**
 * @file quranService.js
 * @description Frontend-only service for fetching Arabic text and translations.
 */

const TRANSLATION_IDS = { en: 131, id: 33, sw: 125, tr: 77, ur: 97, fr: 31, es: 83 };

export function cleanTranslationText(text) {
  if (!text) return "";
  return text.replace(/<[^>]*>/g, "").replace(/[\(\[\{][\s\d\-–,،\u0660-\u0669\u06f0-\u06f9]*[\)\]\}]/g, " ").replace(/\s+/g, " ").trim();
}

export async function getSurahs() {
  try {
    const res = await fetch("https://api.quran.com/api/v4/chapters");
    if (!res.ok) throw new Error("Failed to fetch surahs");
    const data = await res.json();
    return data.chapters.map(ch => ({ 
      id: ch.id, 
      name: ch.name_simple, 
      arabic: ch.name_arabic, 
      versesCount: ch.verses_count 
    }));
  } catch (e) {
    console.error("getSurahs error:", e);
    return [];
  }
}

export async function fetchVerses(surahId, startVerse, endVerse, secondLanguage = "id", reciterName = "Mishary Rashid Alafasy", surahNameFallback = "") {
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
  
  let surahName = surahNameFallback || `Surah ${surahId}`;

  try {
    // Fetch audio and surah info in parallel
    const [audioRes, surahRes] = await Promise.all([
      fetch(`https://api.quran.com/api/v4/quran/recitations/${recitationId}?chapter_number=${surahId}`),
      surahNameFallback ? Promise.resolve(null) : fetch(`https://api.quran.com/api/v4/chapters/${surahId}`)
    ]);

    if (audioRes.ok) {
      const audioData = await audioRes.json();
      audioData.audio_files.forEach(file => {
        if (file.verse_key && file.url) {
          audioFilesMap[file.verse_key] = file.url.startsWith("http") ? file.url : `https://audio.qurancdn.com/${file.url}`;
        }
      });
    }

    if (surahRes && surahRes.ok) {
      const sData = await surahRes.json();
      surahName = sData.chapter.name_simple;
    }
  } catch (e) {
    console.warn("Initial metadata fetch error:", e);
  }

  const versePromises = [];
  for (let v = startVerse; v <= endVerse; v++) {
    const key = `${surahId}:${v}`;
    
    const fetchVerseData = async () => {
      try {
        const [arRes, enRes, secRes] = await Promise.all([
          fetch(`https://api.quran.com/api/v4/quran/verses/uthmani?verse_key=${key}`),
          fetch(`https://api.quran.com/api/v4/quran/translations/${TRANSLATION_IDS.en}?verse_key=${key}`),
          secondLanguage !== "en" ? fetch(`https://api.quran.com/api/v4/quran/translations/${TRANSLATION_IDS[secondLanguage] || 33}?verse_key=${key}`) : Promise.resolve(null)
        ]);

        if (!arRes.ok || !enRes.ok) return null;

        const [arData, enData, secData] = await Promise.all([
          arRes.json(),
          enRes.json(),
          secRes ? secRes.json() : Promise.resolve(null)
        ]);

        return {
          surahId: parseInt(surahId),
          surahName: surahName,
          verseKey: key,
          arabic: arData.verses[0].text_uthmani,
          translations: { 
            en: cleanTranslationText(enData.translations[0].text), 
            [secondLanguage]: secData ? cleanTranslationText(secData.translations[0].text) : "" 
          },
          audio: audioFilesMap[key]
        };
      } catch (err) {
        console.error(`Error fetching verse ${key}:`, err);
        return null;
      }
    };
    
    versePromises.push(fetchVerseData());
  }

  const results = await Promise.all(versePromises);
  return results.filter(v => v !== null);
}

export const quranService = { getSurahs, fetchVerses };