/**
 * @file quranService.js
 * @description Optimized service for fetching Quranic data with solid error handling
 * and a static fallback when the external API cannot be reached.
 */

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
 * Get the list of Surahs (chapters).
 */
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

/**
 * Fetch verses for a given Surah range, including translations and audio URLs.
 * If any network request fails, a minimal static fallback is returned so the UI
 * can continue to work.
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
    // 1️⃣ Parallel fetch: audio files + surah metadata
    // -------------------------------------------------
    const [audioRes, surahRes] = await Promise.all([
      fetch(
        `https://api.quran.com/api/v4/quran/recitations/${recitationId}?chapter_number=${surahId}`
      ),
      fetch(`https://api.quran.com/api/v4/chapters/${surahId}`)
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
    // 2️⃣ Fetch verses (Arabic + requested translations)
    // -------------------------------------------------
    const versesRes = await fetch(
      `https://api.quran.com/api/v4/verses/by_chapter/${surahId}` +
        `?translations=${transIds.join(",")}` +
        `&fields=text_uthmani,verse_key` +
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
    // Return the fallback only if the original request truly failed.
    // This keeps the UI functional while still surfacing the original error in the console.
    return fallback;
  }
}

/**
 * Exported service object.
 */
export const quranService = { getSurahs, fetchVerses };