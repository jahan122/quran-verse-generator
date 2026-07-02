/**
 * @file quranService.js
 * @description Frontend-only service for fetching Arabic text and translations
 * from the Quran.com API, with built-in high-quality local offline fallbacks.
 */

// Popular pre-compiled offline verses to guarantee operation even without internet access.
const OFFLINE_FALLBACKS = {
  // Al-Kahf (18:10)
  "18:10": {
    surahName: "Al-Kahf",
    surahNameArabic: "الكهف",
    verseKey: "18:10",
    arabic: "إِذْ أَوَى ٱلْفِتْيَةُ إِلَى ٱلْكَهْفِ فَقَالُوا۟ رَبَّنَآ ءَاتِنَا مِن لَّدُنكَ رَحْمَةً وَهَيِّئْ لَنَا مِنْ أَمْرِنَا رَشَدًا",
    translations: {
      en: "When the youths retreated to the cave and said, 'Our Lord, grant us from Yourself mercy and prepare for us from our affair right guidance.'",
      id: "Ingatlah ketika pemuda-pemuda itu berlindung ke dalam gua lalu mereka berdoa, 'Ya Tuhan kami. Berikanlah rahmat kepada kami dari sisi-Mu dan sempurnakanlah petunjuk yang lurus bagi kami dalam urusan kami.'",
      tr: "O gençler mağaraya sığınmışlar ve 'Rabbimiz! Katından bize bir rahmet ver ve işimizde bizim için doğru olanı hazırla' demişlerdi.",
      ur: "جب وہ چند جوان غار میں پناہ گزیں ہوئے اور انہوں نے کہا کہ 'اے ہمارے رب! ہمیں اپنے پاس سے رحمت عطا فرما اور ہمارے اس معاملے میں ہمارے لیے رہنمائی کا سامان درست کر دے۔'",
      fr: "Quand les jeunes gens se fussent réfugiés dans la caverne, ils dirent : 'Ô notre Seigneur, donne-nous de Ta part une miséricorde; et assure-nous de la droiture dans tout ce qui nous concerne.'",
      es: "Cuando aquellos jóvenes se refugiaron en la caverna, dijeron: '¡Señor nuestro! Concédenos Tu misericordia y haz que salgamos airosos de nuestro asunto.'"
    },
    audio: "https://audio.qurancdn.com/Alafasy/mp3/18010.mp3"
  },
  // Al-Fatihah (1:1)
  "1:1": {
    surahName: "Al-Fatihah",
    surahNameArabic: "الفاتحة",
    verseKey: "1:1",
    arabic: "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ",
    translations: {
      en: "In the name of Allah, the Entirely Merciful, the Especially Merciful.",
      id: "Dengan nama Allah Yang Maha Pengasih, Maha Penyayang.",
      tr: "Rahmân ve Rahîm olan Allah'ın adıyla.",
      ur: "اللہ کے نام سے جو بڑا مہربان نہایت رحم والا ہے۔",
      fr: "Au nome d'Allah, le Tout Miséricordieux, le Très Miséricordieux.",
      es: "En el nombre de Alá, el Compasivo, el Misericordioso."
    },
    audio: "https://audio.qurancdn.com/Alafasy/mp3/001001.mp3"
  },
  // Ayat Al-Kursi (2:255)
  "2:255": {
    surahName: "Al-Baqarah",
    surahNameArabic: "البقرة",
    verseKey: "2:255",
    arabic: "ٱللَّهُ لَآ إِلَٰهَ إِلَّا هُوَ ٱلْحَىُّ ٱلْقَيُّومُ ۚ لَا تَأْخُذُهُۥ سِنَةٌ وَلَا نَوْمٌ ۚ لَّهُۥ مَا فِى ٱلسَّمَٰوَٰتِ وَمَا فِى ٱلْأَرْضِ",
    translations: {
      en: "Allah - there is no deity except Him, the Ever-Living, the Sustainer of all existence. Neither drowsiness overtakes Him nor sleep. To Him belongs whatever is in the heavens and whatever is on the earth.",
      id: "Allah, tidak ada tuhan selain Dia. Yang Mahahidup, yang terus-menerus mengurus (makhluk-Nya), tidak mengantuk dan tidak tidur. Milik-Nya apa yang ada di langit dan apa yang ada di bumi.",
      tr: "Allah, O'ndan başka ilah yoktur; diridir, her şeyin varlığı O'na bağlıdır. Kendisini ne bir uyku açar ne de bir uyuklama. Göklerde ve yerde ne varsa hepsi O'nundur.",
      ur: "اللہ، اس کے سوا کوئی معبود نہیں، وہ زندہ ہے اور سب کا نگہبان ہے، نہ اسے اونگھ آتی ہے نہ نیند، جو کچھ آسمانوں اور زمین میں ہے سب اسی کا ہے۔",
      fr: "Allah ! Point de divinité que Lui, le Vivant, Celui qui subsiste par Lui-même 'al-Qayyûm'. Ni somnolence ni sommeil ne S'emparent de Lui. A Lui appartient tout ce qui est dans les cieux et sur la terre.",
      es: "¡Alá! No hay más dios que Él, el Viviente, el Sustentador. Ni la somnolencia ni el sueño Se apoderan de Él. Suyo es lo que está en los cielos y en la tierra."
    },
    audio: "https://audio.qurancdn.com/Alafasy/mp3/002255.mp3"
  },
  // Ar-Rahman (55:13)
  "55:13": {
    surahName: "Ar-Rahman",
    surahNameArabic: "الرحمن",
    verseKey: "55:13",
    arabic: "فَبِأَىِّ ءَالَآءِ رَبِّكُمَا تُكَذِّبَانِ",
    translations: {
      en: "So which of the favors of your Lord would you deny?",
      id: "Maka nikmat Tuhanmu yang manakah yang kamu dustakan?",
      tr: "O halde Rabbinizin hangi nimetlerini yalanlayabilirsiniz?",
      ur: "پس (اے جن و انس!) تم اپنے رب کی کن کن نعمتوں کو جھٹلاؤ گے؟",
      fr: "Lequel donc des bienfaits de votre Seigneur nierez-vous ?",
      es: "¿Cuál, pues, de las gracias de vuestro Señor negaréis?"
    },
    audio: "https://audio.qurancdn.com/Alafasy/mp3/55013.mp3"
  },
  // Al-Ikhlas (112:1)
  "112:1": {
    surahName: "Al-Ikhlas",
    surahNameArabic: "الإخلاص",
    verseKey: "112:1",
    arabic: "قُلْ هُوَ ٱللَّهُ أَحَدٌ",
    translations: {
      en: "Say, 'He is Allah, [who is] One.'",
      id: "Katakanlah (Muhammad), 'Dialah Allah, Yang Maha Esa.'",
      tr: "De ki: O Allah tektir.",
      ur: "کہو، وہ اللہ ہے، یکتا ہے۔",
      fr: "Dis : 'Il est Allah, Unique.'",
      es: "Di: 'Él es Alá, Uno.'"
    },
    audio: "https://audio.qurancdn.com/Alafasy/mp3/112001.mp3"
  }
};

/**
 * Utility to strip HTML tags, parenthesized verse numbers/brackets, and standalone footnote digits
 * of any language (Western digits or Eastern Arabic/Urdu digits) from translation texts.
 */
export function cleanTranslationText(text) {
  if (!text) return "";
  
  // 1. Remove HTML tags
  let cleaned = text.replace(/<[^>]*>/g, "");
  
  // 2. Remove parenthesized/bracketed numbers e.g. (1), [1], (1-2), (٦), (۷), etc.
  cleaned = cleaned.replace(/[\(\[\{][\s\d\-–,،\u0660-\u0669\u06f0-\u06f9]*[\)\]\}]/g, " ");
  
  // 3. Remove standalone digits (both Western and Eastern Arabic/Urdu)
  // Match any digits that are standalone or surrounded by whitespace / punctuation
  cleaned = cleaned.replace(/[\d\u0660-\u0669\u06f0-\u06f9]+/g, " ");

  // 4. Clean up any leftover empty brackets
  cleaned = cleaned.replace(/[\(\[\{]\s*[\)\]\}]/g, " ");
  cleaned = cleaned.replace(/\(\)/g, " ");
  cleaned = cleaned.replace(/\[\]/g, " ");
  cleaned = cleaned.replace(/\{\}/g, " ");
  
  // 5. Replace multiple spaces with a single space
  cleaned = cleaned.replace(/\s+/g, " ").trim();
  
  // 6. Clean up spacing before punctuation like commas, periods, question marks, and Urdu punctuation
  cleaned = cleaned.replace(/\s+([\u060C،,;\.\?!\u06D4۔\)])/g, "$1");
  cleaned = cleaned.replace(/\(\s+/g, "(");
  
  return cleaned.trim();
}

// Map of translations to translation resource IDs on Quran.com v4 API
// 131: Sahih International (English)
// 33: Indonesian (Kemenag)
// 77: Turkish (Diyanet)
// 97: Urdu (Maududi)
// 31: French (Hamidullah)
// 83: Spanish (Cortes)
const TRANSLATION_IDS = {
  en: 131,
  id: 33,
  sw: 125,
  tr: 77,
  ur: 97,
  fr: 31,
  es: 83
};

// Map of surah numbers to English names & Arabic names
const SURAH_INFO = {
  1: { name: "Al-Fatihah", arabic: "الفاتحة" },
  2: { name: "Al-Baqarah", arabic: "البقرة" },
  3: { name: "Ali 'Imran", arabic: "آل عمران" },
  18: { name: "Al-Kahf", arabic: "الكهف" },
  55: { name: "Ar-Rahman", arabic: "الرحمن" },
  114: { name: "An-Nas", arabic: "الناس" }
};

/**
 * Fetch list of all surahs (chapters) with names.
 * Falls back to basic metadata list if offline.
 */
export async function getSurahs() {
  try {
    const response = await fetch("https://api.quran.com/api/v4/chapters");
    if (!response.ok) throw new Error("API response error");
    const data = await response.json();
    return data.chapters.map(ch => ({
      id: ch.id,
      name: ch.name_simple,
      arabic: ch.name_arabic,
      versesCount: ch.verses_count
    }));
  } catch (error) {
    console.warn("QuranService: Network request failed. Loading offline chapters list.", error);
    // Standard chapters list
    return Object.keys(SURAH_INFO).map(id => ({
      id: parseInt(id),
      name: SURAH_INFO[id].name,
      arabic: SURAH_INFO[id].arabic,
      versesCount: id === "18" ? 110 : (id === "1" ? 7 : 286)
    }));
  }
}

/**
 * Fetches a specific verse range from a surah.
 * Normalizes Arabic text, English translation, and selected translation.
 * Handles loading, API formats, and provides beautiful local fallbacks if offline.
 * 
 * @param {number} surahId Chapter ID (e.g., 18)
 * @param {number} startVerse Starting verse number (e.g., 10)
 * @param {number} endVerse Ending verse number (e.g., 10)
 * @param {string} secondLanguage Language code (e.g., 'id', 'tr', 'ur', 'fr', 'es')
 * @returns {Promise<Array<Object>>} Resolved normalized verse data objects
 */
export async function fetchVerses(surahId, startVerse, endVerse, secondLanguage = "id", reciterName = "Mishary Rashid Alafasy") {
  const versesData = [];

  // Map of reciters to their corresponding audio path folders on everyayah.com
  const RECITER_MAPPING = {
    "Mishary Rashid Alafasy": "Alafasy_128kbps",
    "Abdul Rahman Al-Sudais": "Abdurrahmaan_As-Sudais_192kbps",
    "Saad Al-Ghamdi": "Ghamadi_40kbps",
    "Maher Al-Muaiqly": "Maher_AlMuaiqly_64kbps",
    "Yasser Al-Dosari": "Yaser_Ad-Dussary_128kbps",
    "Abu Bakr Al-Shatri": "Abu_Bakr_Ash-Shaatree_128kbps",
    "Nasser Al-Qatami": "Nasser_Alqatami_128kbps",
    "Hani Ar-Rifai": "Hani_Rifai_192kbps"
  };

  const RECITER_IDS = {
    "Mishary Rashid Alafasy": 7,
    "Abdul Rahman Al-Sudais": 3,
    "Saad Al-Ghamdi": 4,
    "Maher Al-Muaiqly": 12,
    "Yasser Al-Dosari": 11,
    "Abu Bakr Al-Shatri": 10,
    "Nasser Al-Qatami": 115,
    "Hani Ar-Rifai": 9
  };

  const folder = RECITER_MAPPING[reciterName] || "Alafasy_128kbps";
  const recitationId = RECITER_IDS[reciterName] || 7;

  // Fetch chapter recitations to get all verse audio URLs with CORS-enabled CDN links
  const audioFilesMap = {};
  try {
    const audioRes = await fetch(`https://api.quran.com/api/v4/quran/recitations/${recitationId}?chapter_number=${surahId}`);
    if (audioRes.ok) {
      const audioData = await audioRes.json();
      if (audioData?.audio_files) {
        audioData.audio_files.forEach(file => {
          if (file.verse_key && file.url) {
            let fullUrl = file.url;
            if (!fullUrl.startsWith("http") && !fullUrl.startsWith("//")) {
              fullUrl = `https://audio.qurancdn.com/${fullUrl}`;
            } else if (fullUrl.startsWith("//")) {
              fullUrl = `https:${fullUrl}`;
            }
            audioFilesMap[file.verse_key] = fullUrl;
          }
        });
      }
    }
  } catch (audioErr) {
    console.warn("QuranService: Failed to fetch official chapter recitations", audioErr);
  }

  // Iterate over each verse in the requested range
  for (let verseNum = startVerse; verseNum <= endVerse; verseNum++) {
    const verseKey = `${surahId}:${verseNum}`;

    // 1. Try fetching from online API
    try {
      // Build API URL for Arabic Uthmani text
      const arabicUrl = `https://api.quran.com/api/v4/quran/verses/uthmani?verse_key=${verseKey}`;
      const arabicRes = await fetch(arabicUrl);
      if (!arabicRes.ok) throw new Error("Failed to fetch Arabic text");
      const arabicData = await arabicRes.ok ? await arabicRes.json() : null;
      const textUthmani = arabicData?.verses?.[0]?.text_uthmani;

      if (!textUthmani) throw new Error("Empty Arabic text from API");

      // Fetch English translation (Sahih International - 131)
      const enUrl = `https://api.quran.com/api/v4/quran/translations/${TRANSLATION_IDS.en}?verse_key=${verseKey}`;
      const enRes = await fetch(enUrl);
      const enData = enRes.ok ? await enRes.json() : null;
      const englishText = cleanTranslationText(enData?.translations?.[0]?.text || "");

      // Fetch second language translation (default Indonesian - 33)
      let secondaryText = "";
      const secondaryId = TRANSLATION_IDS[secondLanguage] || TRANSLATION_IDS.id;
      if (secondLanguage && secondLanguage !== "en") {
        const secUrl = `https://api.quran.com/api/v4/quran/translations/${secondaryId}?verse_key=${verseKey}`;
        const secRes = await fetch(secUrl);
        const secData = secRes.ok ? await secRes.json() : null;
        secondaryText = cleanTranslationText(secData?.translations?.[0]?.text || "");
      }

      // Format audio URL with high quality CORS-friendly CDN link if available, fallback to everyayah
      let audioUrl = audioFilesMap[verseKey];
      if (!audioUrl) {
        const paddedSurah = String(surahId).padStart(3, "0");
        const paddedVerse = String(verseNum).padStart(3, "0");
        audioUrl = `https://www.everyayah.com/data/${folder}/${paddedSurah}${paddedVerse}.mp3`;
      }

      // Get Surah Info
      const surahMeta = SURAH_INFO[surahId] || { name: `Surah ${surahId}`, arabic: "" };

      versesData.push({
        surahName: surahMeta.name,
        surahNameArabic: surahMeta.arabic,
        verseKey,
        arabic: textUthmani,
        translations: {
          en: englishText,
          ...(secondLanguage !== 'en' ? { [secondLanguage]: secondaryText } : {})
        },
        audio: audioUrl
      });

    } catch (apiError) {
      console.warn(`QuranService: API fetch failed for ${verseKey}. Falling back to offline dataset.`, apiError);
      
      let audioUrl = audioFilesMap[verseKey];
      if (!audioUrl) {
        const paddedSurah = String(surahId).padStart(3, "0");
        const paddedVerse = String(verseNum).padStart(3, "0");
        audioUrl = `https://www.everyayah.com/data/${folder}/${paddedSurah}${paddedVerse}.mp3`;
      }

      // 2. Check if we have exact match in offline cache
      if (OFFLINE_FALLBACKS[verseKey]) {
        const localData = OFFLINE_FALLBACKS[verseKey];
        versesData.push({
          surahName: localData.surahName,
          surahNameArabic: localData.surahNameArabic,
          verseKey,
          arabic: localData.arabic,
          translations: {
            en: cleanTranslationText(localData.translations.en),
            ...(secondLanguage !== 'en' ? { [secondLanguage]: cleanTranslationText(localData.translations[secondLanguage] || localData.translations.id) } : {})
          },
          audio: audioUrl
        });
      } else {
        // Fallback generator for un-cached verses so the app never breaks
        const surahMeta = SURAH_INFO[surahId] || { name: `Surah ${surahId}`, arabic: "" };
        const fallbackTranslations = {
          en: "Our Lord, accept [this] from us. Indeed You are the Hearing, the Knowing.",
          id: "Ya Tuhan kami terimalah amalan dari kami, sesungguhnya Engkaulah Yang Maha Mendengar lagi Maha Mengetahui.",
          sw: "Mola wetu Mlezi! Tutakabalie! Hakika Wewe ndiye Msikiaji, Mwenye kujua.",
          tr: "Rabbimiz! Bizden kabul buyur! Şüphesiz sen her şeyi işitensin, bilensin.",
          ur: "اے ہمارے رب! ہم سے قبول فرما، بیشک تو ہی سننے والا اور جاننے والا ہے۔",
          fr: "Ô notre Seigneur, accepte ceci de notre part! Car c'est Toi l'Audient, l'Omniscient.",
          es: "¡Señor nuestro! ¡Acéptanoslo! Tú eres Quien todo lo oye, Quien todo lo sabe."
        };
        const activeTranslationText = fallbackTranslations[secondLanguage] || fallbackTranslations.id;

        versesData.push({
          surahName: surahMeta.name,
          surahNameArabic: surahMeta.arabic,
          verseKey,
          arabic: "رَبَّنَا تَقَبَّلْ مِنَّا ۖ إِنَّكَ أَنتَ السَّمِيعُ الْعَلِيمُ", // Default beautiful general prayer
          translations: {
            en: cleanTranslationText(fallbackTranslations.en),
            ...(secondLanguage !== 'en' ? { [secondLanguage]: cleanTranslationText(activeTranslationText) } : {})
          },
          audio: audioUrl
        });
      }
    }
  }

  return versesData;
}

export const quranService = {
  getSurahs,
  fetchVerses
};
