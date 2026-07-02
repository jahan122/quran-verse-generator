/**
 * @file quranService.js
 * @description Optimized service for fetching Quranic data using bulk endpoints.
 */

const TRANSLATION_IDS = { en: 131, id: 33, sw: 125, tr: 77, ur: 97, fr: 31, es: 83 };

export function cleanTranslationText(text) {
  if (!text) return "";
  // Remove HTML tags and footnotes/references in brackets
  return text
    .replace(/<[^>]*>/g, "")
    .replace(/[\(\[\{][\s\d\-–,،\u0660-\u0669\u06f0-\u06f9]*[\)\]\}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function getSurahs() {
  try {
    const res = await fetch("https://api.quran.com/api/v4/chapters");
    if (!res.ok) {
      throw new Error(`Failed to fetch surahs: ${res.status} ${res.statusText}`);
    }
    const data = await res.json();
    return data.chapters.map(ch => ({ 
      id: ch.id, 
      name: ch.name_simple, 
      arabic: ch.name_arabic, 
      versesCount: ch.verses_count 
    }));
  } catch (e) {
    console.error("getSurahs error:", e);
    throw new Error(`getSurahs failed: ${e.message}`);
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
  const transIds = [TRANSLATION_IDS.en];
  if (secondLanguage && secondLanguage !== 'en' && TRANSLATION_IDS[secondLanguage]) {
    transIds.push(TRANSLATION_IDS[secondLanguage]);
  }

  try {
    // 1. Fetch Audio and Surah Info in parallel
    const [audioRes, surahRes] = await Promise.all([
      fetch(`https://api.quran.com/api/v4/quran/recitations/${recitationId}?chapter_number=${surahId}`),
      fetch(`https://api.quran.com/api/v4/chapters/${surahId}`)
    ]);

    // Check audio response
    if (!audioRes.ok) {
      throw new Error(`Failed to fetch audio for surah ${surahId}: ${audioRes.status} ${audioRes.statusText}`);
    }
    const audioData = await audioRes.json();

    // Check surah response
    if (!surahRes.ok) {
      throw new Error(`Failed to fetch surah info for surah ${surahId}: ${surahRes.status} ${surahRes.statusText}`);
    }
    const surahData = await surahRes.json();
    const surahName = surahData?.chapter?.name_simple || surahNameFallback || `Surah ${surahId}`;

    const audioFilesMap = {};
    audioData.audio_files.forEach(file => {
      if (file.verse_key) {
        audioFilesMap[file.verse_key] = file.url.startsWith("http") ? file.url : `https://audio.qurancdn.com/${file.url}`;
      }
    });

    // 2. Fetch Verses with Translations and Arabic Text in one bulk request
    const versesRes = await fetch(
      `https://api.quran.com/api/v4/verses/by_chapter/${surahId}?translations=${transIds.join(',')}&fields=text_uthmani&per_page=286&page=1`
    );
    
    if (!versesRes.ok) {
      // Try to get error details from response body
      let errorDetails = '';
      try {
        const errorData = await versesRes.json();
        errorDetails = JSON.stringify(errorData);
      } catch (e) {
        errorDetails = await versesRes.text();
      }
      throw new Error(`Failed to fetch verses for surah ${surahId}: ${versesRes.status} ${versesRes.statusText} - ${errorDetails}`);
    }
    const versesData = await versesRes.json();

    // 3. Filter and Map the results to our range
    const results = versesData.verses
      .filter(v => {
        const vNum = parseInt(v.verse_key.split(':')[1]);
        return vNum >= startVerse && vNum <= endVerse;
      })
      .map(v => {
        const translations = {};
        v.translations.forEach(t => {
          if (t.resource_id === TRANSLATION_IDS.en) translations.en = cleanTranslationText(t.text);
          else translations[secondLanguage] = cleanTranslationText(t.text);
        });

        return {
          surahId: parseInt(surahId),
          surahName: surahName,
          verseKey: v.verse_key,
          arabic: v.text_uthmani,
          translations: translations,
          audio: audioFilesMap[v.verse_key]
        };
      });

    if (results.length === 0) {
      throw new Error(`No verses found for surah ${surahId}, verses ${startVerse}-${endVerse}`);
    }

    return results;
  } catch (err) {
    console.error("fetchVerses critical error:", err);
    // Ensure we throw an Error object with a message
    if (err instanceof Error) {
      throw err;
    } else {
      throw new Error(String(err));
    }
  }
}

export const quranService = { getSurahs, fetchVerses };