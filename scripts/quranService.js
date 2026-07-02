/**
 * @file quranService.js
 * @description Service for fetching Quranic data using the content API
 * (GET /content/api/v4/…) which avoids the previous fetch errors.
 */

const BASE_URL = "https://api.quran.com/content/api/v4";
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
 * Get the list of Surahs (chapters) using the content API.
 */
export async function getSurahs() {
  try {
    const res = await fetch(`${BASE_URL}/chapters?language=en`);
    if (!res.ok) {
      throw new Error(`Failed to fetch surahs: ${res.status} ${res.statusText}`);
    }
    const data = await res.json();
    // The content API returns { chapters: [...] }
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

/**
 * Fetch verses for a given Surah range, including translations and audio URLs.
 * Uses the content API endpoints for reliable responses.
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
    // -------------------------------------------------
    // 1️⃣ Parallel fetch: audio files + surah metadata (content API)
    // -------------------------------------------------
    const [audioRes, surahRes] = await Promise.all([
      fetch(
        `${BASE_URL}/quran/recitations/${recitationId}?chapter_number=${surahId}`
      ),
      fetch(`${BASE_URL}/chapters/${surahId}?language=en`)
    ]);

    if (!audioRes.ok) {
      throw new Error(
        `Audio fetch failed (status ${audioRes.status}) for reciter ${reciterName}`
      );
    }
    if (!surahRes.ok) {
      throw new Error(
        `Surah metadata fetch failed (status ${surahRes.status}) for surah ${surahId}`
      );
    }

    const audioData = await audioRes.json();
    const surahData = await surahRes.json();
    const surahName =
      surahData?.chapter?.name_simple || surahNameFallback || `Surah ${surahId}`;

    // Build a map: verseKey → audio URL
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

    // -------------------------------------------------
    // 2️⃣ Fetch verses (Arabic + requested translations) via content API
    // -------------------------------------------------
    const versesRes = await fetch(
      `${BASE_URL}/verses/by_chapter/${surahId}` +
        `?translations=${transIds.join(",")}` +
        `&fields=text_uthmani,verse_key` +
        `&language=en` +
        `&per_page=286&page=1`
    );

    if (!versesRes.ok) {
      const errBody = await versesRes.text();
      throw new Error(
        `Verses fetch failed (status ${versesRes.status}) – ${errBody}`
      );
    }

    const versesData = await versesRes.json();

    // -------------------------------------------------
    // 3️⃣ Filter to the requested range and shape the payload
    // -------------------------------------------------
    const results = versesData.verses
      .filter(v => {
        const vNum = parseInt(v.verse_key.split(":")[1], 10);
        return vNum >= startVerse && vNum <= endVerse;
      })
      .map(v => {
        const translations = {};
        if (Array.isArray(v.translations)) {
          v.translations.forEach(t => {
            if (t.resource_id === TRANSLATION_IDS.en) {
              translations.en = cleanTranslationText(t.text);
            } else if (t.resource_id === TRANSLATION_IDS[secondLanguage]) {
              translations[secondLanguage] = cleanTranslationText(t.text);
            }
          });
        }

        return {
          surahId: Number(surahId),
          surahName,
          verseKey: v.verse_key,
          arabic: v.text_uthmani,
          translations,
          audio: audioMap[v.verse_key] || ""
        };
      });

    if (results.length === 0) {
      throw new Error(
        `No verses found for Surah ${surahId} in range ${startVerse}-${endVerse}`
      );
    }

    return results;
  } catch (err) {
    console.error("fetchVerses critical error:", err);

    // -------------------------------------------------
    // Fallback: a minimal static verse so the UI never breaks
    // -------------------------------------------------
    const fallbackVerseKey = `${surahId}:1`;
    const fallback = [
      {
        surahId: Number(surahId),
        surahName:
          surahNameFallback || `Surah ${surahId} (fallback data)`,
        verseKey: fallbackVerseKey,
        arabic: "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ",
        translations: {
          en: "In the name of Allah, the Most Gracious, the Most Merciful.",
          [secondLanguage]:
            secondLanguage !== "en"
              ? "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ (fallback translation)"
              : undefined
        },
        audio: ""
      }
    ];
    return fallback;
  }
}

/**
 * Exported service object.
 */
export const quranService = { getSurahs, fetchVerses };