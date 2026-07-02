/**
 * @file languageManager.js
 * @description State and helper methods for handling multilingual layout adjustments
 * and font properties dynamically.
 */

const LANGUAGES_METADATA = {
  ar: { code: 'ar', name: 'Arabic', nativeName: 'العربية', dir: 'rtl', isArabic: true, defaultFont: 'Amiri' },
  en: { code: 'en', name: 'English', nativeName: 'English', dir: 'ltr', isArabic: false, defaultFont: 'Plus Jakarta Sans' },
  id: { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia', dir: 'ltr', isArabic: false, defaultFont: 'Plus Jakarta Sans' },
  sw: { code: 'sw', name: 'Swahili', nativeName: 'Kiswahili', dir: 'ltr', isArabic: false, defaultFont: 'Plus Jakarta Sans' },
  tr: { code: 'tr', name: 'Turkish', nativeName: 'Türkçe', dir: 'ltr', isArabic: false, defaultFont: 'Plus Jakarta Sans' },
  ur: { code: 'ur', name: 'Urdu', nativeName: 'اردو', dir: 'rtl', isArabic: false, defaultFont: 'Amiri' },
  fr: { code: 'fr', name: 'French', nativeName: 'Français', dir: 'ltr', isArabic: false, defaultFont: 'Plus Jakarta Sans' },
  es: { code: 'es', name: 'Spanish', nativeName: 'Español', dir: 'ltr', isArabic: false, defaultFont: 'Plus Jakarta Sans' }
};

export class LanguageManager {
  constructor() {
    this.activeSecondaryLang = 'id';
    this.isSecondaryEnabled = true;
  }

  setSecondaryLanguage(langCode) {
    if (langCode === 'en' || langCode === 'ar') {
      this.isSecondaryEnabled = false;
      return true;
    }
    if (LANGUAGES_METADATA[langCode]) {
      this.activeSecondaryLang = langCode;
      this.isSecondaryEnabled = true;
      return true;
    }
    return false;
  }

  getLayoutPlan(verse, fontConfig = { arabicSize: 32, translationSize: 16 }) {
    const arabicText = verse.arabic || "";
    const englishText = verse.translations?.en || "";
    const secondaryText = this.isSecondaryEnabled ? (verse.translations?.[this.activeSecondaryLang] || "") : "";

    // Surah At-Tawbah is Surah 9. No Bismillah for it.
    const surahId = verse.surahId || parseInt(verse.verseKey?.split(':')[0]);
    const isAtTawbah = surahId === 9;
    
    // Bismillah logic: Only show if it's the first verse of a surah AND not At-Tawbah
    const isFirstVerse = verse.verseKey?.endsWith(":1");
    const showBismillah = isFirstVerse && !isAtTawbah;

    return {
      arabic: {
        text: arabicText,
        fontSize: fontConfig.arabicSize,
        fontFamily: 'Amiri',
        dir: 'rtl'
      },
      english: {
        text: englishText,
        fontSize: fontConfig.translationSize,
        fontFamily: 'Plus Jakarta Sans',
        dir: 'ltr'
      },
      meta: {
        reference: `${verse.surahName} • ${verse.verseKey}`,
        bismillah: showBismillah ? "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ" : "",
        surahId
      }
    };
  }
}

export const languageManager = new LanguageManager();