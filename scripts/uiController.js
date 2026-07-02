/**
 * @file uiController.js
 * @description Manages all UI interactions, event listeners, state syncing,
 * settings persistence, and mockup text/style preview.
 */

import { quranService } from './quranService.js';
import { languageManager } from './languageManager.js';
import { unsplashService } from './unsplashService.js';

/**
 * Helper to combine a range of fetched verses into a unified, beautifully styled layout data payload.
 */
function combineVerses(verses, secondLanguage) {
  if (verses.length === 1) {
    return {
      ...verses[0],
      verses: verses
    };
  }
  
  const first = verses[0];
  const last = verses[verses.length - 1];
  
  const firstNum = parseInt(first.verseKey.split(':')[1]);
  const lastNum = parseInt(last.verseKey.split(':')[1]);
  const verseKey = `${first.verseKey.split(':')[0]}:${firstNum}-${lastNum}`;
  
  const toArabicDigits = (num) => {
    const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    return String(num).split('').map(d => arabicDigits[parseInt(d)] || d).join('');
  };
  
  // Arabic text joined with beautiful Arabic verse markers
  const arabic = verses.map(v => {
    const num = v.verseKey.split(':')[1];
    return `${v.arabic} ﴿${toArabicDigits(num)}﴾`;
  }).join(" ");
  
  // English translation joined beautifully without numbers
  const en = verses.map(v => {
    return v.translations.en;
  }).join(" ");
  
  // Secondary translation joined beautifully without numbers
  const secondaryTextList = verses.map(v => {
    return v.translations[secondLanguage] || "";
  }).filter(Boolean);
  
  const secondaryCombined = secondaryTextList.join(" ");
  
  return {
    surahName: first.surahName,
    surahNameArabic: first.surahNameArabic,
    verseKey,
    arabic,
    translations: {
      en,
      [secondLanguage]: secondaryCombined
    },
    audio: first.audio, // default to first verse audio
    verses: verses
  };
}

export class UIController {
  constructor() {
    this.state = {
      surah: 18,
      startVerse: 10,
      endVerse: 10,
      translation: 'id',
      bgType: 'image', // image, video, solid
      searchQuery: 'nature landscape stars',
      contrast: 45,
      arabicFont: 'Amiri',
      translationFont: 'Plus Jakarta Sans',
      arabicSize: 32,
      translationSize: 16,
      diacritics: true,
      goldenBorder: true,
      showReference: true,
      reciter: 'Mishary Rashid Alafasy',
      visualizer: 'Classic Bars',
      aspectRatio: '1:1', // 1:1, 9:16, 16:9
      bgSeed: 12345,
      activeVerseData: null,
      isPlayingAudio: false,
      fontGap: 0,
      lineGap: 0
    };

    if (typeof Audio !== 'undefined') {
      this.audioElement = new Audio();
      this.audioElement.crossOrigin = 'anonymous';
    } else {
      this.audioElement = {
        addEventListener: () => {},
        removeEventListener: () => {},
        load: () => {},
        pause: () => {},
        play: () => Promise.resolve(),
        duration: 15,
        currentTime: 0
      };
    }
    this.els = {};
  }

  /**
   * Safe DOM querying with fallback element creation or logging to avoid breaks
   */
  initElements() {
    this.els = {
      surahSelect: document.getElementById('surahSelect'),
      startVerseInput: document.getElementById('startVerseInput'),
      endVerseInput: document.getElementById('endVerseInput'),
      translationSelect: document.getElementById('translationSelect'),
      fetchButton: document.getElementById('fetchButton'),
      
      mediaSourceButtons: document.querySelectorAll('#controlSidebar section:nth-of-type(2) .grid button'),
      searchQueryInput: document.getElementById('searchQueryInput'),
      searchQueryButton: document.getElementById('searchQueryBtn'),
      contrastSlider: document.querySelector('#controlSidebar section:nth-of-type(2) input[type="range"]'),
      
      arabicFontSelect: document.getElementById('arabicFontSelect'),
      translationFontSelect: document.getElementById('translationFontSelect'),
      arabicSizeSlider: document.getElementById('arabicSizeSlider'),
      translationSizeSlider: document.getElementById('translationSizeSlider'),
      
      diacriticsCheckbox: document.getElementById('diacriticsCheckbox'),
      goldenBorderCheckbox: document.getElementById('goldenBorderCheckbox'),
      showReferenceCheckbox: document.getElementById('showReferenceCheckbox'),
      
      fontGapSlider: document.getElementById('fontGapSlider'),
      lineGapSlider: document.getElementById('lineGapSlider'),
      shuffleBgBtn: document.getElementById('shuffleBgBtn'),
      
      reciterSelect: document.getElementById('reciterSelect'),
      
      ratioButtons: document.querySelectorAll('#previewWorkspace > div:first-of-type button'),
      mockupContainer: document.getElementById('mockupContainer'),
      canvas: document.getElementById('studioCanvas'),
      
      generateImageBtn: document.getElementById('generateImageBtn'),
      generateVideoBtn: document.getElementById('generateVideoBtn'),
      
      audioPlayBtn: document.querySelector('#previewWorkspace .absolute.bottom-4 button'),
      audioTimer: document.querySelector('#previewWorkspace .font-mono'),
      audioWaveIndicator: document.querySelector('#previewWorkspace .flex.items-end.gap-0\\.5'),
      engineLoaderStatus: document.querySelector('#previewWorkspace section div div span.flex'),
      engineLoaderBar: document.querySelector('#previewWorkspace section div .h-1 div')
    };
  }

  /**
   * Initializes controller, loads persistent configurations,
   * fetches initial surah lists, and establishes live handlers.
   */
  async init() {
    this.initElements();
    this.loadSettings();
    languageManager.setSecondaryLanguage(this.state.translation);
    this.enableAllControls();
    await this.loadSurahsList();
    this.setupListeners();
    await this.triggerFetch();
    this.updateLoaderStatus("System Fully Loaded", "100%", "bg-emerald-500");
  }

  /**
   * Reads settings from local storage
   */
  loadSettings() {
    try {
      const saved = localStorage.getItem('al_bayan_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        this.state = { ...this.state, ...parsed };
      }
    } catch (e) {
      console.error("UIController: Failed to load local settings", e);
    }
  }

  /**
   * Saves settings to local storage
   */
  saveSettings() {
    try {
      const { activeVerseData, isPlayingAudio, ...toSave } = this.state;
      localStorage.setItem('al_bayan_settings', JSON.stringify(toSave));
    } catch (e) {
      console.error("UIController: Failed to save local settings", e);
    }
  }

  /**
   * Removes 'disabled' properties and adjusts initial DOM state
   */
  enableAllControls() {
    Object.keys(this.els).forEach(key => {
      const el = this.els[key];
      if (el) {
        if (el instanceof NodeList || el instanceof HTMLCollection) {
          el.forEach(item => {
            if (item instanceof HTMLElement) {
              item.removeAttribute('disabled');
              item.classList.remove('cursor-not-allowed');
            }
          });
        } else if (el instanceof HTMLElement) {
          el.removeAttribute('disabled');
          el.classList.remove('cursor-not-allowed');
        }
      }
    });

    // Remove cursor classes from active components
    if (this.els.generateImageBtn) this.els.generateImageBtn.classList.remove('bg-slate-800', 'text-slate-400');
    if (this.els.generateImageBtn) this.els.generateImageBtn.classList.add('bg-islamic-700', 'text-gold-200', 'hover:bg-islamic-600', 'border-gold-500/30', 'cursor-pointer');
    if (this.els.generateVideoBtn) this.els.generateVideoBtn.classList.remove('bg-slate-800', 'text-slate-400');
    if (this.els.generateVideoBtn) this.els.generateVideoBtn.classList.add('bg-gold-600', 'text-slate-950', 'hover:bg-gold-500', 'cursor-pointer');
  }

  /**
   * Loads Quranic surah list dynamically
   */
  async loadSurahsList() {
    if (!this.els.surahSelect) return;
    
    this.updateLoaderStatus("Loading Surah Catalog...", "30%", "bg-gold-500");
    const chapters = await quranService.getSurahs();
    this.chapters = chapters;
    
    this.els.surahSelect.innerHTML = '';
    chapters.forEach(ch => {
      const opt = document.createElement('option');
      opt.value = ch.id;
      opt.textContent = `${ch.id}. ${ch.name} (${ch.arabic})`;
      if (ch.id === this.state.surah) {
        opt.selected = true;
      }
      this.els.surahSelect.appendChild(opt);
    });

    this.updateVerseLimits();
  }

  /**
   * Dynamically sets input constraints (max value) and clamps selected verse numbers
   * based on the selected surah's total verses
   */
  updateVerseLimits() {
    if (!this.chapters || !this.els.startVerseInput || !this.els.endVerseInput) return;
    const selectedSurahId = this.state.surah;
    const ch = this.chapters.find(c => c.id === selectedSurahId);
    if (ch) {
      const maxVerses = ch.versesCount || 286;
      this.els.startVerseInput.max = maxVerses;
      this.els.endVerseInput.max = maxVerses;
      
      let startVal = parseInt(this.els.startVerseInput.value) || 1;
      let endVal = parseInt(this.els.endVerseInput.value) || 1;
      
      startVal = Math.max(1, Math.min(maxVerses, startVal));
      endVal = Math.max(1, Math.min(maxVerses, endVal));
      
      if (startVal > endVal) {
        startVal = endVal;
      }
      
      this.state.startVerse = startVal;
      this.state.endVerse = endVal;
      this.els.startVerseInput.value = startVal;
      this.els.endVerseInput.value = endVal;
    }
  }

  /**
   * Updates progress loader bars to simulate engine loading/compiling states
   */
  updateLoaderStatus(text, width, barColor = "bg-gold-500") {
    if (this.els.engineLoaderStatus) {
      this.els.engineLoaderStatus.innerHTML = `
        <span class="h-2 w-2 rounded-full ${barColor === 'bg-emerald-500' ? 'bg-emerald-500' : 'bg-gold-400 animate-ping'}"></span>
        <span>${text}</span>
      `;
    }
    if (this.els.engineLoaderBar) {
      this.els.engineLoaderBar.style.width = width;
      this.els.engineLoaderBar.className = `h-full ${barColor} rounded-full transition-all duration-300`;
    }
  }

  /**
   * Binds all controls and fields to listeners
   */
  setupListeners() {
    // Surah Selection changes
    if (this.els.surahSelect) {
      this.els.surahSelect.addEventListener('change', (e) => {
        this.state.surah = parseInt(e.target.value);
        this.updateVerseLimits();
        this.saveSettings();
      });
    }

    // Verse Numbers
    if (this.els.startVerseInput) {
      this.els.startVerseInput.value = this.state.startVerse;
      this.els.startVerseInput.addEventListener('input', (e) => {
        const max = parseInt(this.els.startVerseInput.max) || 286;
        let val = parseInt(e.target.value) || 1;
        val = Math.max(1, Math.min(max, val));
        
        if (val > this.state.endVerse) {
          this.state.endVerse = val;
          if (this.els.endVerseInput) this.els.endVerseInput.value = val;
        }
        
        this.state.startVerse = val;
        e.target.value = val;
        this.saveSettings();
      });
    }
    if (this.els.endVerseInput) {
      this.els.endVerseInput.value = this.state.endVerse;
      this.els.endVerseInput.addEventListener('input', (e) => {
        const max = parseInt(this.els.endVerseInput.max) || 286;
        let val = parseInt(e.target.value) || 1;
        val = Math.max(1, Math.min(max, val));
        
        if (val < this.state.startVerse) {
          this.state.startVerse = val;
          if (this.els.startVerseInput) this.els.startVerseInput.value = val;
        }
        
        this.state.endVerse = val;
        e.target.value = val;
        this.saveSettings();
      });
    }

    // Translation Selector
    if (this.els.translationSelect) {
      this.els.translationSelect.value = this.state.translation;
      this.els.translationSelect.addEventListener('change', (e) => {
        this.state.translation = e.target.value;
        languageManager.setSecondaryLanguage(e.target.value);
        this.saveSettings();
        this.triggerFetch();
      });
    }

    // Fetch Button
    if (this.els.fetchButton) {
      this.els.fetchButton.addEventListener('click', () => this.triggerFetch());
    }

    // Media Source Selectors
    if (this.els.mediaSourceButtons) {
      this.els.mediaSourceButtons.forEach(btn => {
        // Sync active state visually
        const text = btn.textContent.trim().toLowerCase();
        if (text.includes('image') && this.state.bgType === 'image') this.setActiveButton(btn, this.els.mediaSourceButtons);
        if (text.includes('video') && this.state.bgType === 'video') this.setActiveButton(btn, this.els.mediaSourceButtons);
        if (text.includes('solid') && this.state.bgType === 'solid') this.setActiveButton(btn, this.els.mediaSourceButtons);

        btn.addEventListener('click', () => {
          this.setActiveButton(btn, this.els.mediaSourceButtons);
          if (text.includes('image')) this.state.bgType = 'image';
          if (text.includes('video')) this.state.bgType = 'video';
          if (text.includes('solid')) this.state.bgType = 'solid';
          this.saveSettings();
          this.updateMockupPreview();
        });
      });
    }

    // Pixabay search field
    if (this.els.searchQueryInput) {
      this.els.searchQueryInput.value = this.state.searchQuery;
      this.els.searchQueryInput.addEventListener('input', (e) => {
        this.state.searchQuery = e.target.value;
        this.saveSettings();
      });
      this.els.searchQueryInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          this.state.bgSeed = Math.floor(Math.random() * 1000000);
          this.saveSettings();
          this.updateMockupPreview();
        }
      });
    }

    if (this.els.searchQueryButton) {
      this.els.searchQueryButton.addEventListener('click', () => {
        this.state.bgSeed = Math.floor(Math.random() * 1000000);
        this.saveSettings();
        this.updateMockupPreview();
      });
    }

    // Contrast overlay opacity
    if (this.els.contrastSlider) {
      this.els.contrastSlider.value = this.state.contrast;
      this.els.contrastSlider.addEventListener('input', (e) => {
        this.state.contrast = parseInt(e.target.value);
        const valSpan = this.els.contrastSlider.parentElement.querySelector('span.text-gold-400');
        if (valSpan) valSpan.textContent = `${this.state.contrast}%`;
        this.updateMockupPreview();
        this.saveSettings();
      });
    }

    // Font Selectors
    if (this.els.arabicFontSelect) {
      this.els.arabicFontSelect.value = this.state.arabicFont;
      this.els.arabicFontSelect.addEventListener('change', (e) => {
        this.state.arabicFont = e.target.value;
        this.saveSettings();
        this.updateMockupPreview();
      });
    }
    if (this.els.translationFontSelect) {
      this.els.translationFontSelect.value = this.state.translationFont;
      this.els.translationFontSelect.addEventListener('change', (e) => {
        this.state.translationFont = e.target.value;
        this.saveSettings();
        this.updateMockupPreview();
      });
    }

    // Typography Sizing
    if (this.els.arabicSizeSlider) {
      this.els.arabicSizeSlider.value = this.state.arabicSize;
      this.els.arabicSizeSlider.addEventListener('input', (e) => {
        this.state.arabicSize = parseInt(e.target.value);
        const valSpan = this.els.arabicSizeSlider.parentElement.querySelector('span.text-gold-400');
        if (valSpan) valSpan.textContent = `${this.state.arabicSize}px`;
        this.saveSettings();
        this.updateMockupPreview();
      });
    }
    if (this.els.translationSizeSlider) {
      this.els.translationSizeSlider.value = this.state.translationSize;
      this.els.translationSizeSlider.addEventListener('input', (e) => {
        this.state.translationSize = parseInt(e.target.value);
        const valSpan = this.els.translationSizeSlider.parentElement.querySelector('span.text-gold-400');
        if (valSpan) valSpan.textContent = `${this.state.translationSize}px`;
        this.saveSettings();
        this.updateMockupPreview();
      });
    }

    // Checkboxes
    if (this.els.diacriticsCheckbox) {
      this.els.diacriticsCheckbox.checked = this.state.diacritics;
      this.els.diacriticsCheckbox.addEventListener('change', (e) => {
        this.state.diacritics = e.target.checked;
        this.saveSettings();
        this.updateMockupPreview();
      });
    }
    if (this.els.goldenBorderCheckbox) {
      this.els.goldenBorderCheckbox.checked = this.state.goldenBorder;
      this.els.goldenBorderCheckbox.addEventListener('change', (e) => {
        this.state.goldenBorder = e.target.checked;
        this.saveSettings();
        this.updateMockupPreview();
      });
    }
    if (this.els.showReferenceCheckbox) {
      this.els.showReferenceCheckbox.checked = this.state.showReference;
      this.els.showReferenceCheckbox.addEventListener('change', (e) => {
        this.state.showReference = e.target.checked;
        this.saveSettings();
        this.updateMockupPreview();
      });
    }

    // Font gap (letter spacing)
    if (this.els.fontGapSlider) {
      this.els.fontGapSlider.value = this.state.fontGap || 0;
      const fontGapValSpan = document.getElementById('fontGapVal');
      if (fontGapValSpan) fontGapValSpan.textContent = `${this.state.fontGap || 0}px`;
      
      this.els.fontGapSlider.addEventListener('input', (e) => {
        this.state.fontGap = parseInt(e.target.value) || 0;
        if (fontGapValSpan) fontGapValSpan.textContent = `${this.state.fontGap}px`;
        this.saveSettings();
        this.updateMockupPreview();
      });
    }

    // Line gap (line-height spacing)
    if (this.els.lineGapSlider) {
      this.els.lineGapSlider.value = this.state.lineGap || 0;
      const lineGapValSpan = document.getElementById('lineGapVal');
      if (lineGapValSpan) lineGapValSpan.textContent = `${this.state.lineGap || 0}px`;
      
      this.els.lineGapSlider.addEventListener('input', (e) => {
        this.state.lineGap = parseInt(e.target.value) || 0;
        if (lineGapValSpan) lineGapValSpan.textContent = `${this.state.lineGap}px`;
        this.saveSettings();
        this.updateMockupPreview();
      });
    }

    // Shuffle Nature Background
    if (this.els.shuffleBgBtn) {
      this.els.shuffleBgBtn.addEventListener('click', () => {
        this.state.bgSeed = Math.floor(Math.random() * 1000000);
        const keywords = [
          'nature,landscape',
          'forest,mountains,scenic',
          'stars,milkyway,nightsky',
          'ocean,sunset,waves',
          'desert,sand,dunes',
          'river,waterfall,scenic',
          'meadow,field,flowers,trees',
          'foggy,misty,woods',
          'autumn,trees,foliage'
        ];
        this.state.searchQuery = keywords[Math.floor(Math.random() * keywords.length)];
        this.saveSettings();
        this.updateMockupPreview();
      });
    }

    // Reciters Select
    if (this.els.reciterSelect) {
      this.els.reciterSelect.value = this.state.reciter;
      this.els.reciterSelect.addEventListener('change', (e) => {
        this.state.reciter = e.target.value;
        this.saveSettings();
        this.triggerFetch();
      });
    }

    // Visualizers Selection
    if (this.els.visualizerButtons) {
      this.els.visualizerButtons.forEach(btn => {
        const text = btn.textContent.trim();
        if (text === this.state.visualizer) this.setActiveButton(btn, this.els.visualizerButtons);

        btn.addEventListener('click', () => {
          this.setActiveButton(btn, this.els.visualizerButtons);
          this.state.visualizer = text;
          this.saveSettings();
        });
      });
    }

    // Viewport Aspect Ratio Buttons
    if (this.els.ratioButtons) {
      this.els.ratioButtons.forEach(btn => {
        const text = btn.textContent.trim();
        if (text.includes(this.state.aspectRatio)) this.setActiveRatioButton(btn);

        btn.addEventListener('click', () => {
          this.setActiveRatioButton(btn);
          if (text.includes('1:1')) this.state.aspectRatio = '1:1';
          if (text.includes('9:16')) this.state.aspectRatio = '9:16';
          if (text.includes('16:9')) this.state.aspectRatio = '16:9';
          this.saveSettings();
          this.adjustPreviewContainerRatio();
        });
      });
    }

    // Audio Playback Elements
    if (this.els.audioPlayBtn) {
      this.els.audioPlayBtn.addEventListener('click', () => this.toggleAudioPlay());
    }

    // Audio event updates
    this.audioElement.addEventListener('timeupdate', () => {
      this.updateAudioProgress();
    });

    this.audioElement.addEventListener('ended', () => {
      const verses = this.state.activeVerseData?.verses || [];
      if (this.state.isPlayingAudio && verses.length > 1) {
        if (this.state.currentPreviewVerseIndex === undefined) {
          this.state.currentPreviewVerseIndex = 0;
        }
        this.state.currentPreviewVerseIndex++;
        if (this.state.currentPreviewVerseIndex < verses.length) {
          this.audioElement.src = verses[this.state.currentPreviewVerseIndex].audio;
          this.audioElement.load();
          this.audioElement.play().catch(e => console.warn("Sequential preview playback blocked.", e));
          return;
        }
      }
      this.state.isPlayingAudio = false;
      this.updateAudioBtnUI();
    });
  }

  /**
   * Standard Active visual selector helper
   */
  setActiveButton(activeBtn, allButtons) {
    if (!activeBtn) return;
    if (allButtons) {
      allButtons.forEach(btn => {
        btn.className = "text-slate-400 hover:text-slate-200 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition";
      });
    }
    activeBtn.className = "bg-islamic-950 text-gold-400 border border-gold-500/20 py-1.5 rounded-md text-xs font-semibold cursor-pointer shadow-sm";
  }

  setActiveRatioButton(activeBtn) {
    if (!this.els.ratioButtons) return;
    this.els.ratioButtons.forEach(btn => {
      btn.className = "px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200 cursor-pointer transition";
    });
    activeBtn.className = "px-3 py-1.5 rounded-lg text-xs font-semibold bg-gold-600 text-slate-950 border border-gold-400 shadow-md shadow-gold-600/10 cursor-pointer";
  }

  /**
   * Resizes preview mockup visualizer wrapper relative to aspect ratio
   */
  adjustPreviewContainerRatio() {
    if (!this.els.mockupContainer) return;
    this.els.mockupContainer.className = 'w-full max-w-[380px] rounded-xl overflow-hidden shadow-2xl shadow-black relative border border-gold-500/25 transition-all duration-300';
    
    if (this.state.aspectRatio === '1:1') {
      this.els.mockupContainer.classList.add('aspect-square');
    } else if (this.state.aspectRatio === '9:16') {
      this.els.mockupContainer.classList.add('aspect-[9/16]');
    } else if (this.state.aspectRatio === '16:9') {
      this.els.mockupContainer.classList.add('aspect-[16/9]', 'max-w-[500px]');
    }
  }

  /**
   * Actions verse pipeline trigger
   */
  async triggerFetch() {
    this.updateLoaderStatus("Fetching Quranic Data...", "60%", "bg-gold-500");
    try {
      const verses = await quranService.fetchVerses(this.state.surah, this.state.startVerse, this.state.endVerse, this.state.translation, this.state.reciter);
      if (verses && verses.length > 0) {
        this.state.activeVerseData = combineVerses(verses, this.state.translation); // Set active view to combined range of verses
        this.updateLoaderStatus("Data Synced Successfully", "100%", "bg-emerald-500");
        this.updateMockupPreview();
        this.loadAudioSource();
      }
    } catch (err) {
      console.error("UIController: Failed to fetch verse data", err);
      this.updateLoaderStatus("Fetch Failed. Retrying...", "100%", "bg-rose-500");
    }
  }

  /**
   * Standardizes audio loading pipeline
   */
  loadAudioSource() {
    if (!this.state.activeVerseData?.audio) return;
    this.audioElement.src = this.state.activeVerseData.audio;
    this.audioElement.load();
    if (this.els.audioTimer) {
      this.els.audioTimer.textContent = `0:00 / 0:15`;
    }
  }

  /**
   * Toggles actual live audio recitation playbacks safely
   */
  toggleAudioPlay() {
    if (!this.state.activeVerseData) return;
    
    if (this.state.isPlayingAudio) {
      this.audioElement.pause();
      this.state.isPlayingAudio = false;
    } else {
      const verses = this.state.activeVerseData.verses || [];
      if (verses.length > 1) {
        this.state.currentPreviewVerseIndex = 0;
        this.audioElement.src = verses[0].audio;
        this.audioElement.load();
      }
      this.audioElement.play().catch(e => console.warn("Audio play blocked by browser autoplay rules.", e));
      this.state.isPlayingAudio = true;
    }
    this.updateAudioBtnUI();
  }

  updateAudioBtnUI() {
    if (!this.els.audioPlayBtn) return;
    if (this.state.isPlayingAudio) {
      this.els.audioPlayBtn.innerHTML = `
        <!-- Pause Icon -->
        <svg class="h-3 w-3 fill-current" viewBox="0 0 24 24">
          <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
        </svg>
      `;
      this.els.audioPlayBtn.classList.add('bg-gold-500', 'text-slate-950');
      if (this.els.audioWaveIndicator) {
        this.els.audioWaveIndicator.querySelectorAll('span').forEach(span => span.classList.add('animate-pulse'));
      }
    } else {
      this.els.audioPlayBtn.innerHTML = `
        <!-- Play Icon -->
        <svg class="h-3 w-3 fill-current" viewBox="0 0 24 24">
          <path d="M8 5v14l11-7z" />
        </svg>
      `;
      this.els.audioPlayBtn.classList.remove('bg-gold-500', 'text-slate-950');
      if (this.els.audioWaveIndicator) {
        this.els.audioWaveIndicator.querySelectorAll('span').forEach(span => span.classList.remove('animate-pulse'));
      }
    }
  }

  updateAudioProgress() {
    if (!this.els.audioTimer || !this.audioElement) return;
    const cur = this.audioElement.currentTime || 0;
    const dur = this.audioElement.duration || 15;
    
    const formatTime = (seconds) => {
      const m = Math.floor(seconds / 60);
      const s = Math.floor(seconds % 60);
      return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    this.els.audioTimer.textContent = `${formatTime(cur)} / ${formatTime(dur)}`;

    // Update bottom bar playback progress width
    const progressPercent = (cur / dur) * 100;
    const progressBar = this.els.mockupContainer?.querySelector('.absolute.bottom-0 div');
    if (progressBar) {
      progressBar.style.width = `${progressPercent}%`;
    }
  }

  /**
   * Re-evaluates font pairing choices, styles, and text strings
   * inside the HTML live mockup display.
   */
  updateMockupPreview() {
    if (!this.state.activeVerseData || !this.els.mockupContainer) return;

    // Run language manager to obtain scaled size & alignment specs
    const layout = languageManager.getLayoutPlan(this.state.activeVerseData, {
      arabicSize: this.state.arabicSize,
      translationSize: this.state.translationSize
    });

    // 1. Update text fields inside mockup
    const arabicTextEl = this.els.mockupContainer.querySelector('.font-serif.text-2xl');
    const englishTextEl = this.els.mockupContainer.querySelector('.font-sans.text-xs');
    const bismillahTextEl = this.els.mockupContainer.querySelector('.pt-2 p');
    const referenceEl = this.els.mockupContainer.querySelector('.font-display.text-\\[9px\\]');
    
    // Clear secondary if existed, or build if needed
    let secondaryTextEl = this.els.mockupContainer.querySelector('.secondary-translation');

    if (arabicTextEl) {
      // Manage diacritics visibility (simplified representation in DOM)
      let displayAr = layout.arabic.text;
      if (!this.state.diacritics) {
        // Strip common diacritics/tashkeel
        displayAr = displayAr.replace(/[\u064B-\u0652]/g, "");
      }
      
      // Font mapping
      if (this.state.arabicFont === 'Amiri Naskh' || this.state.arabicFont === 'Amiri') {
        arabicTextEl.style.fontFamily = '"Amiri", serif';
      } else if (this.state.arabicFont === 'Reem Kufi') {
        arabicTextEl.style.fontFamily = '"Reem Kufi", sans-serif';
      } else {
        arabicTextEl.style.fontFamily = '"Scheherazade New", serif';
      }
      
      arabicTextEl.innerHTML = `
        <div style="font-size: ${layout.arabic.fontSize}px; word-spacing: ${this.state.fontGap || 0}px; line-height: ${layout.arabic.fontSize * 1.5 + (this.state.lineGap || 0)}px;">${displayAr}</div>
      `;
    }

    if (bismillahTextEl) {
      bismillahTextEl.textContent = layout.meta.bismillah;
      bismillahTextEl.style.opacity = layout.meta.bismillah ? '0.9' : '0';
    }

    if (englishTextEl) {
      // Font Family selection
      if (this.state.translationFont === 'Plus Jakarta' || this.state.translationFont === 'Plus Jakarta Sans') {
        englishTextEl.style.fontFamily = '"Plus Jakarta Sans", sans-serif';
      } else if (this.state.translationFont === 'Cinzel (Display)') {
        englishTextEl.style.fontFamily = '"Cinzel", serif';
      } else {
        englishTextEl.style.fontFamily = 'Georgia, serif';
      }
      
      // Combined layout text representing English and Secondary
      if (layout.secondary) {
        const secFontSize = Math.max(10, Math.floor(layout.english.fontSize * 0.88));
        const secFontFamily = layout.secondary.fontFamily === 'Amiri' ? '"Amiri", serif' : 'inherit';
        englishTextEl.innerHTML = `
          <div class="mb-1.5" style="font-size: ${layout.english.fontSize}px; word-spacing: ${this.state.fontGap || 0}px; line-height: ${layout.english.fontSize * 1.45 + (this.state.lineGap || 0)}px;">${layout.english.text}</div>
          <div class="${layout.secondary.dir === 'rtl' ? 'not-italic font-normal' : 'italic'} border-t border-slate-800/60 pt-1.5 mt-1.5 text-slate-400" dir="${layout.secondary.dir || 'ltr'}" style="font-family: ${secFontFamily}; font-size: ${secFontSize}px; word-spacing: ${this.state.fontGap || 0}px; line-height: ${secFontSize * 1.4 + (this.state.lineGap || 0)}px;">${layout.secondary.text}</div>
        `;
      } else {
        englishTextEl.innerHTML = `
          <div style="font-size: ${layout.english.fontSize}px; word-spacing: ${this.state.fontGap || 0}px; line-height: ${layout.english.fontSize * 1.45 + (this.state.lineGap || 0)}px;">${layout.english.text}</div>
        `;
      }
    }


    if (referenceEl && this.state.showReference) {
      referenceEl.parentElement.style.opacity = '1';
      referenceEl.textContent = layout.meta.reference;
    } else if (referenceEl) {
      referenceEl.parentElement.style.opacity = '0';
    }

    // 2. Ornate Border Toggle
    const ornateBorder = this.els.mockupContainer.querySelector('.absolute.inset-3');
    if (ornateBorder) {
      ornateBorder.style.display = this.state.goldenBorder ? 'block' : 'none';
    }

    // 3. Contrast Overlay dark level
    const darkOverlay = this.els.mockupContainer.querySelector('.absolute.inset-0.bg-slate-950\\/40');
    if (darkOverlay) {
      darkOverlay.style.backgroundColor = `rgba(2, 6, 23, ${this.state.contrast / 100})`;
    }

    // 4. Update Background styles
    const backgroundDiv = this.els.mockupContainer.querySelector('.absolute.inset-0.bg-cover');
    if (backgroundDiv) {
      if (this.state.bgType === 'solid') {
        backgroundDiv.style.backgroundImage = 'linear-gradient(135deg, #10211e 0%, #1f3c36 50%, #10211e 100%)';
      } else if (this.state.bgType === 'video') {
        // High quality premium video landscape visual fallback
        backgroundDiv.style.backgroundImage = `linear-gradient(180deg, rgba(16, 33, 30, 0.4) 0%, rgba(10, 10, 10, 0.95) 100%), url('https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?auto=format&fit=crop&w=800&q=80')`;
      } else {
        // Photo image source based on Unsplash Search Query using user API key
        const bgUrl = unsplashService.getBgImageSync(this.state.bgSeed || 12345, false);
        backgroundDiv.style.backgroundImage = `linear-gradient(180deg, rgba(16, 33, 30, 0.4) 0%, rgba(10, 10, 10, 0.95) 100%), url('${bgUrl}')`;
      }

    }
  }
}

export const uiController = new UIController();
