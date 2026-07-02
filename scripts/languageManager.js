/**
 * @file languageManager.js
 * @description State and helper methods for handling multilingual layout adjustments
 * and font properties dynamically. Ensures Arabic and English are always present,
 * while managing active secondary translation layouts and safety fallbacks.
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
    this.activeSecondaryLang = 'id'; // Default secondary language
    this.isSecondaryEnabled = true;  // Toggle secondary translation layer
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

  toggleSecondaryLanguage(enabled) {
    this.isSecondaryEnabled = !!enabled;
  }

  getActiveLanguages() {
    const list = [
      LANGUAGES_METADATA.ar,
      LANGUAGES_METADATA.en
    ];
    if (this.isSecondaryEnabled && LANGUAGES_METADATA[this.activeSecondaryLang]) {
      list.push(LANGUAGES_METADATA[this.activeSecondaryLang]);
    }
    return list;
  }

  /**
   * Generates a safe, well-proportioned layout structure for canvas drawing or UI rendering.
   * Auto-calculates safe font sizing modifiers based on the total text payload size
   * to guarantee zero clipping or overflows.
   * 
   * @param {Object} verse The raw verse object returned by quranService
   * @param {Object} fontConfig User font-size selections
   * @returns {Object} Ready-to-render layout properties
   */
  getLayoutPlan(verse, fontConfig = { arabicSize: 32, translationSize: 16 }) {
    const arabicText = verse.arabic || "";
    const englishText = verse.translations?.en || "";
    const secondaryText = this.isSecondaryEnabled ? (verse.translations?.[this.activeSecondaryLang] || "") : "";

    // Count characters to adjust dynamic spacing
    const totalChars = arabicText.length + englishText.length + secondaryText.length;
    
    // Scale scaling factors dynamically
    let scaleModifier = 1.0;
    if (totalChars > 800) {
      scaleModifier = 0.65;
    } else if (totalChars > 600) {
      scaleModifier = 0.72;
    } else if (totalChars > 450) {
      scaleModifier = 0.80;
    } else if (totalChars > 300) {
      scaleModifier = 0.88;
    } else if (totalChars > 200) {
      scaleModifier = 0.94;
    }

    const finalArabicSize = Math.max(16, Math.floor(fontConfig.arabicSize * scaleModifier));
    const finalTranslationSize = Math.max(11, Math.floor(fontConfig.translationSize * scaleModifier));

    // Determine line heights & gaps
    const lineGaps = {
      arabic: Math.floor(finalArabicSize * 0.5),
      translation: Math.floor(finalTranslationSize * 0.45),
      blockGap: totalChars > 300 ? 12 : 20
    };

    return {
      arabic: {
        text: arabicText,
        fontSize: finalArabicSize,
        fontFamily: 'Amiri',
        dir: 'rtl',
        lineGap: lineGaps.arabic
      },
      english: {
        text: englishText,
        fontSize: finalTranslationSize,
        fontFamily: 'Plus Jakarta Sans',
        dir: 'ltr',
        lineGap: lineGaps.translation
      },
      secondary: secondaryText ? {
        text: secondaryText,
        fontSize: Math.max(10, finalTranslationSize - 1),
        fontFamily: LANGUAGES_METADATA[this.activeSecondaryLang]?.defaultFont || 'Plus Jakarta Sans',
        dir: LANGUAGES_METADATA[this.activeSecondaryLang]?.dir || 'ltr',
        lineGap: lineGaps.translation,
        label: LANGUAGES_METADATA[this.activeSecondaryLang]?.name
      } : null,
      meta: {
        reference: `${verse.surahName} • ${verse.verseKey}`,
        bismillah: (verse.verseKey?.endsWith(":1") || parseInt(verse.verseKey?.split(':')[0]) === 9) ? "" : "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ",
        totalChars,
        scaleModifier
      }
    };
  }
}

export const languageManager = new LanguageManager();
