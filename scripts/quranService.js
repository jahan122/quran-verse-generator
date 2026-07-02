/**
 * @file quranService.js
 * @description Service for fetching Quranic data using the content API
 * (GET /content/api/v4/…) which avoids the previous fetch errors.
 */

const BASE_URL = "https://api.quran.com/content/api/v4";
const OLD_API_URL = "https://api.quran.com/api/v4"; // Confirmed working in version 2
const TRANSLATION_IDS = { en: 131, id: 33, sw: 125, tr: 77, ur: 97, fr: 31, es: 83 };

/**
 * Strip HTML tags and footnote brackets from translation text.
 */
export function cleanTranslationText(text) {
  if (!text) return "";
  return text
    .replace(/<[^>]*>/g, "")
    .replace(/[\(\[\{][\s\d\-–,،\u0660-\u0669\u06f0-\u06f9]*[\)\]\}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Get the list of Surahs (chapters) using the OLD API that was working in version 2.
 * Implements retry logic with max 5 attempts.
 */
export async function getSurahs() {
  const maxRetries = 5;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const res = await fetch(`${OLD_API_URL}/chapters`);
      if (!res.ok) {
        throw new Error(`Failed to fetch surahs (attempt ${attempt+1}/${maxRetries}): ${res.status} ${res.statusText}`);
      }
      const data = await res.json();
      return data.chapters.map(ch => ({
        id: ch.id,
        name: ch.name_simple,
        arabic: ch.name_arabic,
        versesCount: ch.verses_count
      }));
    } catch (e) {
      if (attempt === maxRetries - 1) {
        throw new Error(`getSurahs failed after ${maxRetries} attempts: ${e.message}`);
      }
      // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }
}

/**
 * Fetch verses for a given Surah range, including translations and audio URLs.
 * Uses the content API endpoints for audio endpoint from content API and verses endpoint from content API.
 * Returns a fallback array if anything goes wrong.
 */
export async function fetchVerses(
  surahId,
  startVerse,
  endVerse,
  secondLanguage = "id",
  reciterName = "Mishary Rashid Alafasy",
  surahNameFallback = ""
) {
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
  if (secondLanguage && secondLanguage !== "en" && TRANSLATION_IDS[secondLanguage]) {
    transIds.push(TRANSLATION_IDS[secondLanguage]);
  }

  try {
    // Parallel fetch: audio files (content API) + surah metadata (old API that works)
    const [audioRes, surahRes] = await Promise.all([
      fetch(`${BASE_URL}/quran/recitations/${recitationId}?chapter_number=${surahId}`),
      fetch(`${OLD_API_URL}/chapters/${surahId}`)
    ]);

    if (!audioRes.ok) {
      throw new Error(`Audio fetch failed (status ${audioRes.status}) for reciter ${reciterName}`);
    }
    if (!surahRes.ok) {
      throw new Error(`Surah metadata fetch failed (status ${surahRes.status}) for surah ${surahId}`);
    }

    const audioData = await audioRes.json();
    const surahData = await surahRes.json();
    const surahName = surahData?.chapter?.name_simple || surahNameFallback || `Surah ${surahId}`;

    // Build verseKey → audio URL map
    const audioMap = {};
    if (Array.isArray(audioData.audio_files)) {
      audioData.audio_files.forEach(file => {
        if (file.verse_key) {
          audioMap[file.verse_key] = file.url.startsWith("http")
            ? file.url
            : `https://audio.qurancdn.com/${file.url}`;
        }
      });
    }

    // Fetch verses via content API
    const versesRes = await fetch(
      `${BASE_URL}/verses/by_chapter/${surahId}` +
        `?translations=${transIds.join(",")}` +
        `&fields=text_uthmani,verse_key` +
        `&per_page=286&page=1`
    );

    if (!versesRes.ok) {
      const errBody = await versesRes.text();
      throw new Error(`Verses fetch failed (status ${versesRes.status}) – ${errBody}`);
    }

    const versesData = await versesRes.json();

    // Filter and shape results
    const results = versesData.verses
      .filter(v => {
        const vNum = parseInt(v.verse_key.split(":")[1], 10);
        return vNum >= startVerse && vNum <= endVerse;
      })
      .map(v => ({
        surahId: Number(surahId),
        surahName,
        verseKey: v.verse_key,
        arabic: v.text_uthmani,
        translations: {
          en: cleanTranslationText(v.translations.find(t => t.resource_id === TRANSLATION_IDS.en)?.text || ""),
          [secondLanguage]: cleanTranslationText(v.translations.find(t => t.resource_id === TRANSLATION_IDS[secondLanguage])?.text || "")
        },
        audio: audioMap[v.verse_key] || ""
      }));

    if (results.length === 0) {
      throw new Error(`No verses found for Surah ${surahId} in range ${startVerse}-${endVerse}`);
    }

    return results;
  } catch (err) {
    console.error("fetchVerses critical error:", err);

    // Fallback verse
    const fallbackVerseKey = `${surahId}:1`;
    return [{
      surahId: Number(surahId),
      surahName: surahNameFallback || `Surah ${surahId} (fallback)`,
      verseKey: fallbackVerseKey,
      arabic: "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ",
      translations: {
        en: "In the name of Allah, the Most Gracious, the Most Merciful.",
        [secondLanguage]: secondLanguage !== "en"
          ? "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ (fallback)"
          : undefined
      },
      audio: ""
    }];
  }
}

/**
 * Exported service object.
 */
export const quranService = { getSurahs, fetchVerses };