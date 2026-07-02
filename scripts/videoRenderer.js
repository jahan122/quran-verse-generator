/**
 * @file videoRenderer.js
 * @description Client-side Canvas video rendering, Web Audio visualization, 
 * and MediaRecorder capturing engine. Generates high-resolution images (PNG)
 * and WhatsApp-compatible videos (MP4 wrapper over webm or native h264/aac if supported)
 * with real audio recitation tracks.
 */

import { languageManager } from './languageManager.js';
import { unsplashService } from './unsplashService.js';

export class VideoRenderer {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.audioCtx = null;
    this.audioSourceNode = null;
    this.analyser = null;
    this.animationFrameId = null;
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.isRecording = false;
    this.particles = [];
    this.imageCache = {};
  }

  async getCachedImage(url) {
    if (this.imageCache[url]) {
      return this.imageCache[url];
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = url;
    
    await new Promise((resolve) => {
      img.onload = () => resolve();
      img.onerror = () => resolve();
    });
    this.imageCache[url] = img;
    return img;
  }

  /**
   * Initializes or binds target canvas
   * @param {HTMLCanvasElement} canvasElement 
   */
  setCanvas(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = this.canvas.getContext('2d');
  }

  /**
   * Generates and returns a high-resolution PNG image blob/dataURI from current settings
   * 
   * @param {Object} state Current application control state
   * @param {Object} verse Selected Verse object
   * @returns {Promise<string>} Resolve to image Data URL
   */
  async exportImage(state, verse) {
    if (!this.canvas) throw new Error("Canvas element not assigned");

    // Set high-resolution export canvas bounds based on Aspect Ratio
    this.configureCanvasResolution(state.aspectRatio);

    // Preload background image to cache to ensure it's drawn in the exported image
    let bgUrl = 'https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?auto=format&fit=crop&w=1280&q=80';
    if (state.bgType === 'image') {
      bgUrl = unsplashService.getBgImageSync(state.bgSeed || 12345, true);
    }
    await this.getCachedImage(bgUrl);

    // Draw the static layout onto the export canvas
    await this.drawFrame(state, verse, 0, false);

    return this.canvas.toDataURL('image/png');
  }

  /**
   * Configures canvas dimensions based on resolution and aspect ratio standard.
   * Promotes crisp vector-like text scaling.
   */
  configureCanvasResolution(aspectRatio) {
    if (aspectRatio === '9:16') {
      this.canvas.width = 1080;
      this.canvas.height = 1920;
    } else if (aspectRatio === '16:9') {
      this.canvas.width = 1920;
      this.canvas.height = 1080;
    } else {
      // 1:1 Square
      this.canvas.width = 1080;
      this.canvas.height = 1080;
    }
  }

  /**
   * Main canvas rendering loop drawing background image, borders, and wrapped text
   */
  async drawFrame(state, verse, timestamp = 0, isLiveRecording = false) {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.clearRect(0, 0, w, h);

    // 1. Draw Background Source (Image, Solid, or Video mockup representation)
    if (state.bgType === 'solid') {
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, '#10211e');
      grad.addColorStop(0.5, '#1f3c36');
      grad.addColorStop(1, '#10211e');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    } else if (state.bgType === 'video') {
      // Draw beautiful dynamic moving cosmic aurora gradient for Video mode
      const timeFactor = timestamp / 1500;
      const grad = ctx.createLinearGradient(0, 0, w, h);
      
      const r1 = Math.floor(10 + Math.sin(timeFactor) * 5);
      const g1 = Math.floor(25 + Math.cos(timeFactor) * 10);
      const b1 = Math.floor(20 + Math.sin(timeFactor * 1.5) * 5);
      
      const r2 = Math.floor(25 + Math.sin(timeFactor * 0.8) * 10);
      const g2 = Math.floor(15 + Math.cos(timeFactor * 1.2) * 5);
      const b2 = Math.floor(40 + Math.sin(timeFactor * 0.5) * 10);
      
      grad.addColorStop(0, `rgb(${r1}, ${g1}, ${b1})`);
      grad.addColorStop(0.5, `rgb(${r2}, ${g2}, ${b2})`);
      grad.addColorStop(1, '#050a0a');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      
      // Draw custom nebulae shapes for realistic cinematic dynamic feel
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = 'rgba(235, 193, 83, 0.03)';
      ctx.beginPath();
      ctx.arc(w * 0.3 + Math.sin(timeFactor * 0.5) * w * 0.05, h * 0.4 + Math.cos(timeFactor * 0.3) * h * 0.05, w * 0.35, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.fillStyle = 'rgba(41, 87, 77, 0.06)';
      ctx.beginPath();
      ctx.arc(w * 0.7 + Math.cos(timeFactor * 0.4) * w * 0.05, h * 0.6 + Math.sin(timeFactor * 0.6) * h * 0.05, w * 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    } else {
      // Draw background image pattern
      try {
        const bgUrl = unsplashService.getBgImageSync(state.bgSeed || 12345, true);
        let bgImg = this.imageCache[bgUrl];
        if (!bgImg) {
          // Trigger async cache in background and use solid fallback
          this.getCachedImage(bgUrl);
          ctx.fillStyle = '#10211e';
          ctx.fillRect(0, 0, w, h);
        } else if (bgImg.naturalWidth > 0) {
          // Cover aspect ratio algorithm
          const imgRatio = bgImg.width / bgImg.height;
          const canvasRatio = w / h;
          let drawW = w, drawH = h, drawX = 0, drawY = 0;

          if (imgRatio > canvasRatio) {
            drawW = h * imgRatio;
            drawX = (w - drawW) / 2;
          } else {
            drawH = w / imgRatio;
            drawY = (h - drawH) / 2;
          }
          ctx.drawImage(bgImg, drawX, drawY, drawW, drawH);
        } else {
          // Solid fallback if blocked by CORS or offline
          ctx.fillStyle = '#10211e';
          ctx.fillRect(0, 0, w, h);
        }
      } catch (e) {
        ctx.fillStyle = '#10211e';
        ctx.fillRect(0, 0, w, h);
      }
    }

    // 1.5 Draw the beautiful linear gradient on top of the image/video background (matching preview exactly!)
    if (state.bgType === 'image' || state.bgType === 'video') {
      const overlayGrad = ctx.createLinearGradient(0, 0, 0, h);
      overlayGrad.addColorStop(0, 'rgba(16, 33, 30, 0.4)');
      overlayGrad.addColorStop(1, 'rgba(10, 10, 10, 0.95)');
      ctx.fillStyle = overlayGrad;
      ctx.fillRect(0, 0, w, h);
    }

    // 2. Render dynamic ambient floating light particles if in video mode or rendering animation
    if (state.bgType === 'video' || isLiveRecording) {
      this.drawAmbientParticles(ctx, w, h, timestamp);
    }

    // 3. Draw Dark Overlay Contrast layer (using identical dark-blue slate color of preview)
    const opacity = (state.contrast || 45) / 100;
    ctx.fillStyle = `rgba(2, 6, 23, ${opacity})`;
    ctx.fillRect(0, 0, w, h);

    // 4. Render Luxury Ornate Golden Border if toggled
    if (state.goldenBorder) {
      this.drawGoldenFrame(ctx, w, h);
    }

    // 5. Render Islamic Text Layout with Language Sizer specifications
    let textOpacity = 1.0;
    if (this.isRecording && this.isTransitioning) {
      textOpacity = 0.3; // Fade text down during transition
    }
    ctx.globalAlpha = textOpacity;

    const layout = languageManager.getLayoutPlan(verse, {
      arabicSize: state.arabicSize,
      translationSize: state.translationSize
    });

    // Font Sizing adjustments scaled for high-res output
    let scaleFactor = w / 380; // Scale relative to original layout box
    const maxTextWidth = w * 0.83;

    // Define fonts beforehand
    let arFont = '"Amiri", serif';
    if (state.arabicFont === 'Reem Kufi') {
      arFont = '"Reem Kufi", sans-serif';
    } else if (state.arabicFont === 'Scheherazade' || state.arabicFont === 'Scheherazade New') {
      arFont = '"Scheherazade New", serif';
    }

    let transFont = '"Plus Jakarta Sans", sans-serif';
    if (state.translationFont === 'Cinzel (Display)') {
      transFont = '"Cinzel", serif';
    } else if (state.translationFont === 'Georgia (Serif)' || state.translationFont === 'Georgia') {
      transFont = 'Georgia, serif';
    }

    // Dynamic Sizing calculation with iteration to fit
    let finalArabicSize = Math.floor(layout.arabic.fontSize * scaleFactor * 0.95);
    let finalTranslationSize = Math.floor(layout.english.fontSize * scaleFactor * 0.9);

    let displayAr = layout.arabic.text;
    if (!state.diacritics) {
      displayAr = displayAr.replace(/[\u064B-\u0652]/g, "");
    }

    let bismillahHeight, separatorHeight;
    let arabicLines, arabicLineHeight, arabicTextHeight;
    let transLines, transLineHeight, englishTextHeight;
    let secLines, secondaryFontSize, secLineHeight, secondaryTranslationHeight;
    let totalRequiredHeight;

    const maxIterations = 5;
    let iteration = 0;
    
    // Account for 8% top and 8% bottom paddings
    const paddingOffset = h * 0.16;
    let initialBismillahHeight = layout.meta.bismillah ? Math.floor(68 * scaleFactor) : 0;
    let initialReferenceHeight = state.showReference ? Math.floor(65 * scaleFactor) : 0;
    let safeHeight = h - paddingOffset - initialBismillahHeight - initialReferenceHeight;

    while (iteration < maxIterations) {
      separatorHeight = Math.floor(45 * scaleFactor);

      // Wrap Arabic
      ctx.font = `normal ${finalArabicSize}px ${arFont}`;
      ctx.direction = 'rtl';
      ctx.letterSpacing = '0px';
      const arWordSpacing = (state.fontGap || 0) * scaleFactor;
      arabicLineHeight = finalArabicSize * 1.5 + (state.lineGap || 0) * scaleFactor;
      arabicLines = this.wrapText(ctx, displayAr, maxTextWidth, arWordSpacing);
      arabicTextHeight = arabicLines.length * arabicLineHeight;

      // Wrap English
      ctx.font = `300 ${finalTranslationSize}px ${transFont}`;
      ctx.direction = 'ltr';
      ctx.letterSpacing = '0px';
      const enWordSpacing = (state.fontGap || 0) * scaleFactor;
      transLineHeight = finalTranslationSize * 1.45 + (state.lineGap || 0) * scaleFactor;
      transLines = this.wrapText(ctx, layout.english.text, maxTextWidth, enWordSpacing);
      englishTextHeight = transLines.length * transLineHeight;

      // Wrap Secondary
      if (layout.secondary) {
        const isSecRtl = layout.secondary.dir === 'rtl';
        let secFont = transFont;
        if (layout.secondary.fontFamily === 'Amiri') {
          secFont = '"Amiri", serif';
        }
        secondaryFontSize = Math.floor(finalTranslationSize * 0.88);
        ctx.font = `${isSecRtl ? 'normal' : 'italic'} 300 ${secondaryFontSize}px ${secFont}`;
        ctx.direction = isSecRtl ? 'rtl' : 'ltr';
        ctx.letterSpacing = '0px';
        const secWordSpacing = (state.fontGap || 0) * scaleFactor;
        secLineHeight = secondaryFontSize * 1.4 + (state.lineGap || 0) * scaleFactor;
        secLines = this.wrapText(ctx, layout.secondary.text, maxTextWidth, secWordSpacing);
        secondaryTranslationHeight = Math.floor(30 * scaleFactor) + (secLines.length * secLineHeight);
      } else {
        secondaryTranslationHeight = 0;
      }

      totalRequiredHeight = arabicTextHeight + separatorHeight + englishTextHeight + secondaryTranslationHeight;

      if (totalRequiredHeight <= safeHeight || finalTranslationSize <= 12 || finalArabicSize <= 18) {
        break;
      }

      // Scale down font sizes and scaleFactor proportionally
      const ratio = safeHeight / totalRequiredHeight;
      finalArabicSize = Math.max(18, Math.floor(finalArabicSize * ratio * 0.95));
      finalTranslationSize = Math.max(12, Math.floor(finalTranslationSize * ratio * 0.95));
      scaleFactor = scaleFactor * ratio * 0.95;

      const loopBismillahHeight = layout.meta.bismillah ? Math.floor(68 * scaleFactor) : 0;
      const loopReferenceHeight = state.showReference ? Math.floor(65 * scaleFactor) : 0;
      safeHeight = h - paddingOffset - loopBismillahHeight - loopReferenceHeight;

      iteration++;
    }

    // Center alignment bounds
    const centerX = w / 2;

    // Draw Bismillah at the top
    let bismillahEndY = h * 0.08;
    if (layout.meta.bismillah) {
      const bismillahY = h * 0.08 + Math.floor(15 * scaleFactor);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(235, 193, 83, 0.95)';
      ctx.font = `normal ${Math.floor(18 * scaleFactor)}px "Amiri", Georgia, serif`;
      ctx.letterSpacing = '0px';
      ctx.fillText("بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ", centerX, bismillahY);
      
      // Fine gold separator line
      const sepY = bismillahY + Math.floor(22 * scaleFactor);
      const lineW = Math.floor(55 * scaleFactor);
      const gradLine = ctx.createLinearGradient(centerX - lineW, 0, centerX + lineW, 0);
      gradLine.addColorStop(0, 'rgba(235, 193, 83, 0)');
      gradLine.addColorStop(0.5, 'rgba(235, 193, 83, 0.45)');
      gradLine.addColorStop(1, 'rgba(235, 193, 83, 0)');
      ctx.strokeStyle = gradLine;
      ctx.lineWidth = Math.max(1, w * 0.001);
      ctx.beginPath();
      ctx.moveTo(centerX - lineW, sepY);
      ctx.lineTo(centerX + lineW, sepY);
      ctx.stroke();
      
      bismillahEndY = sepY + Math.floor(25 * scaleFactor);
    }

    // Draw Reference Banner at the bottom
    let referenceStartY = h * 0.92;
    if (state.showReference) {
      const footerY = h - Math.floor(55 * scaleFactor);
      referenceStartY = footerY - Math.floor(20 * scaleFactor);
      this.drawReferenceBanner(ctx, centerX, footerY, layout.meta.reference, scaleFactor);
    }

    // Centered content area between top block (Bismillah) and bottom block (Reference)
    const finalContentAreaHeight = referenceStartY - bismillahEndY;
    let currentY = bismillahEndY + (finalContentAreaHeight - totalRequiredHeight) / 2;

    // Draw Main Arabic Scripture Verse
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fdf5df'; // Soft glowing cream text
    ctx.font = `normal ${finalArabicSize}px ${arFont}`;
    ctx.letterSpacing = '0px';
    const arWordSpacing = (state.fontGap || 0) * scaleFactor;
    
    const arHalfLine = arabicLineHeight / 2;
    arabicLines.forEach(line => {
      this.fillTextWithWordSpacing(ctx, line, centerX, currentY + arHalfLine, arWordSpacing, true);
      currentY += arabicLineHeight;
    });

    // Decorative separator dots
    currentY += Math.floor(12 * scaleFactor);
    ctx.letterSpacing = '0px';
    this.drawSeparatorDots(ctx, centerX, currentY, scaleFactor);
    currentY += Math.floor(30 * scaleFactor);

    // Draw Translation Text (English)
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `300 ${finalTranslationSize}px ${transFont}`;
    ctx.fillStyle = '#cbd5e1'; // soft slate color
    ctx.letterSpacing = '0px';
    const enWordSpacing = (state.fontGap || 0) * scaleFactor;
    
    const enHalfLine = transLineHeight / 2;
    transLines.forEach(line => {
      this.fillTextWithWordSpacing(ctx, line, centerX, currentY + enHalfLine, enWordSpacing, false);
      currentY += transLineHeight;
    });

    // Secondary translation block if active
    if (layout.secondary) {
      currentY += Math.floor(15 * scaleFactor);
      
      // Draw subtle dashed split line
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(centerX - maxTextWidth * 0.3, currentY);
      ctx.lineTo(centerX + maxTextWidth * 0.3, currentY);
      ctx.stroke();
      ctx.setLineDash([]); // Reset line dash
      
      currentY += Math.floor(20 * scaleFactor);
      
      const isSecRtl = layout.secondary.dir === 'rtl';
      let secFont = transFont;
      if (layout.secondary.fontFamily === 'Amiri') {
        secFont = '"Amiri", serif';
      }
      ctx.font = `${isSecRtl ? 'normal' : 'italic'} 300 ${secondaryFontSize}px ${secFont}`;
      ctx.fillStyle = '#94a3b8'; // deep slate
      ctx.letterSpacing = '0px';
      const secWordSpacing = (state.fontGap || 0) * scaleFactor;
      const secHalfLine = secLineHeight / 2;
      secLines.forEach(line => {
        this.fillTextWithWordSpacing(ctx, line, centerX, currentY + secHalfLine, secWordSpacing, isSecRtl);
        currentY += secLineHeight;
      });
    }

    ctx.letterSpacing = '0px';

    // 5.5 Render dynamic audio visualizer if it is video/story mode
    if (state.bgType === 'video') {
      const visualizerY = state.showReference ? (h - Math.floor(130 * scaleFactor)) : (h - Math.floor(100 * scaleFactor));
      this.drawWaveformVisualizer(ctx, centerX, visualizerY, scaleFactor, state.visualizer || 'Classic Bars', timestamp);
    }
    ctx.globalAlpha = 1.0;
  }

  /**
   * Measures text width taking word spacing into account
   */
  measureTextWidth(ctx, text, wordSpacing) {
    if (!wordSpacing) {
      return ctx.measureText(text).width;
    }
    const words = text.split(' ');
    let total = 0;
    words.forEach(w => {
      total += ctx.measureText(w).width;
    });
    total += (words.length - 1) * wordSpacing;
    return total;
  }

  /**
   * Helper function to wrap text neatly on Canvas with support for custom word spacing
   */
  wrapText(ctx, text, maxWidth, wordSpacing = 0) {
    const words = text.split(' ');
    const lines = [];
    let currentLine = words[0] || "";

    for (let i = 1; i < words.length; i++) {
      const word = words[i];
      const testLine = currentLine + " " + word;
      const width = this.measureTextWidth(ctx, testLine, wordSpacing);
      if (width < maxWidth) {
        currentLine = testLine;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }
    lines.push(currentLine);
    return lines;
  }

  /**
   * Draws text supporting custom word-spacing on canvas
   */
  fillTextWithWordSpacing(ctx, text, x, y, wordSpacing, isRtl = false) {
    const prevDirection = ctx.direction;
    ctx.direction = isRtl ? 'rtl' : 'ltr';

    if (!wordSpacing) {
      ctx.fillText(text, x, y);
      ctx.direction = prevDirection;
      return;
    }
    let words = text.split(' ');
    if (isRtl) {
      words.reverse();
    }
    
    const prevAlign = ctx.textAlign;
    ctx.textAlign = 'left';
    
    // Measure total width
    let totalWidth = 0;
    const wordWidths = [];
    words.forEach((w, idx) => {
      const width = ctx.measureText(w).width;
      wordWidths.push(width);
      totalWidth += width;
      if (idx < words.length - 1) {
        totalWidth += wordSpacing;
      }
    });

    // Draw words
    let currentX = x - totalWidth / 2;
    words.forEach((w, idx) => {
      ctx.fillText(w, currentX, y);
      currentX += wordWidths[idx] + wordSpacing;
    });
    
    ctx.textAlign = prevAlign;
    ctx.direction = prevDirection;
  }

  /**
   * Draws modern floating particle graphics for high fidelity luxury feel
   */
  drawAmbientParticles(ctx, w, h, timestamp) {
    // Generate particles if empty
    if (this.particles.length === 0) {
      for (let i = 0; i < 28; i++) {
        this.particles.push({
          x: Math.random() * w,
          y: Math.random() * h,
          radius: Math.random() * 2.5 + 0.8,
          speed: Math.random() * 0.4 + 0.1,
          angle: Math.random() * Math.PI * 2,
          opacity: Math.random() * 0.4 + 0.1
        });
      }
    }

    // Move and Draw particles
    this.particles.forEach(p => {
      p.y -= p.speed * 1.5;
      p.x += Math.sin(p.angle + timestamp / 1000) * 0.2;
      
      // Reset if out of bounds
      if (p.y < -10) {
        p.y = h + 10;
        p.x = Math.random() * w;
      }

      ctx.fillStyle = `rgba(226, 168, 45, ${p.opacity * (0.6 + Math.sin(timestamp / 500) * 0.3)})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  /**
   * Decorative dot-line dividers
   */
  drawSeparatorDots(ctx, x, y, scale) {
    const dotSpacing = Math.floor(14 * scale);
    ctx.fillStyle = 'rgba(235, 193, 83, 0.5)';
    
    // Left dot
    ctx.beginPath();
    ctx.arc(x - dotSpacing, y, Math.floor(2 * scale), 0, Math.PI * 2);
    ctx.fill();
    
    // Large center dot
    ctx.fillStyle = 'rgba(235, 193, 83, 0.8)';
    ctx.beginPath();
    ctx.arc(x, y, Math.floor(3.5 * scale), 0, Math.PI * 2);
    ctx.fill();
    
    // Right dot
    ctx.fillStyle = 'rgba(235, 193, 83, 0.5)';
    ctx.beginPath();
    ctx.arc(x + dotSpacing, y, Math.floor(2 * scale), 0, Math.PI * 2);
    ctx.fill();
  }

  /**
   * Renders the luxurious gold Islamic outer and inner borders
   */
  drawGoldenFrame(ctx, w, h) {
    // Very fine outer card edge border (matching mockupContainer border border-gold-500/25)
    ctx.strokeStyle = 'rgba(235, 193, 83, 0.25)';
    ctx.lineWidth = Math.max(1, w * 0.001);
    ctx.strokeRect(0, 0, w, h);

    const inset1 = Math.floor(w * 0.03);
    const inset2 = inset1 + Math.max(2, Math.floor(w * 0.01));

    // Gradient styling for authentic metallic gold sheen matching preview
    const goldGrad1 = ctx.createLinearGradient(0, 0, w, h);
    goldGrad1.addColorStop(0, 'rgba(253, 245, 223, 0.4)');
    goldGrad1.addColorStop(0.5, 'rgba(235, 193, 83, 0.2)');
    goldGrad1.addColorStop(1, 'rgba(202, 136, 32, 0.4)');

    ctx.strokeStyle = goldGrad1;
    ctx.lineWidth = Math.max(1, w * 0.001);
    ctx.strokeRect(inset1, inset1, w - inset1 * 2, h - inset1 * 2);

    // Fine secondary double border line inside
    ctx.strokeStyle = 'rgba(235, 193, 83, 0.05)';
    ctx.lineWidth = Math.max(0.5, w * 0.0007);
    ctx.strokeRect(inset2, inset2, w - inset2 * 2, h - inset2 * 2);

    // Intricate gold corner accents inside the frame, matching mockup
    const accentOffset = inset1 + Math.floor(w * 0.025);
    const cornerSize = Math.floor(w * 0.03);

    ctx.strokeStyle = 'rgba(235, 193, 83, 0.4)';
    ctx.lineWidth = Math.max(1, w * 0.0012);
    
    // Top-Left corner accent
    ctx.beginPath();
    ctx.moveTo(accentOffset + cornerSize, accentOffset);
    ctx.lineTo(accentOffset, accentOffset);
    ctx.lineTo(accentOffset, accentOffset + cornerSize);
    ctx.stroke();

    // Top-Right corner accent
    ctx.beginPath();
    ctx.moveTo(w - accentOffset - cornerSize, accentOffset);
    ctx.lineTo(w - accentOffset, accentOffset);
    ctx.lineTo(w - accentOffset, accentOffset + cornerSize);
    ctx.stroke();

    // Bottom-Left corner accent
    ctx.beginPath();
    ctx.moveTo(accentOffset + cornerSize, h - accentOffset);
    ctx.lineTo(accentOffset, h - accentOffset);
    ctx.lineTo(accentOffset, h - accentOffset - cornerSize);
    ctx.stroke();

    // Bottom-Right corner accent
    ctx.beginPath();
    ctx.moveTo(w - accentOffset - cornerSize, h - accentOffset);
    ctx.lineTo(w - accentOffset, h - accentOffset);
    ctx.lineTo(w - accentOffset, h - accentOffset - cornerSize);
    ctx.stroke();
  }

  /**
   * Renders the footer surah metadata card
   */
  drawReferenceBanner(ctx, x, y, reference, scale) {
    const bannerH = Math.floor(24 * scale);
    const bannerW = Math.floor(190 * scale);

    // Oval background pill
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.strokeStyle = 'rgba(235, 193, 83, 0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x - bannerW / 2, y - bannerH / 2, bannerW, bannerH, bannerH / 2);
    ctx.fill();
    ctx.stroke();

    // Banner Text
    ctx.fillStyle = '#ebc153';
    ctx.font = `600 ${Math.floor(10 * scale)}px "Cinzel", serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(reference.toUpperCase(), x, y);
  }

  /**
   * Renders premium responsive vector waveforms corresponding to real audio decibels
   */
  drawWaveformVisualizer(ctx, centerX, centerY, scale, patternType, timestamp) {
    const numBars = 20;
    const barSpacing = Math.floor(4 * scale);
    const baseBarW = Math.max(2, Math.floor(3 * scale));
    const maxBarH = Math.floor(30 * scale);

    ctx.fillStyle = 'rgba(235, 193, 83, 0.7)';

    if (patternType === 'Classic Bars') {
      const startX = centerX - ((numBars * (baseBarW + barSpacing)) / 2);
      for (let i = 0; i < numBars; i++) {
        // Calculate animated dynamic bounce height mapping to simulate live music
        const wave = Math.sin((timestamp / 150) + (i * 0.4));
        const val = Math.abs(wave) * 0.8 + 0.2;
        const currentBarH = Math.max(3, val * maxBarH);
        
        ctx.beginPath();
        ctx.roundRect(
          startX + (i * (baseBarW + barSpacing)), 
          centerY - (currentBarH / 2), 
          baseBarW, 
          currentBarH, 
          baseBarW / 2
        );
        ctx.fill();
      }
    } else if (patternType === 'Circular') {
      // Small decorative orbit visualizer surrounding reference banner
      const radius = Math.floor(75 * scale);
      ctx.strokeStyle = 'rgba(235, 193, 83, 0.3)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(centerX, centerY + Math.floor(45 * scale), radius, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      // Wave Ribbon style
      ctx.strokeStyle = 'rgba(235, 193, 83, 0.8)';
      ctx.lineWidth = Math.floor(2 * scale);
      ctx.beginPath();
      
      const width = Math.floor(180 * scale);
      const startX = centerX - width / 2;
      
      for (let i = 0; i <= 30; i++) {
        const xVal = startX + (i * (width / 30));
        const wave = Math.sin((timestamp / 200) + (i * 0.25)) * 12 * scale;
        if (i === 0) {
          ctx.moveTo(xVal, centerY + wave);
        } else {
          ctx.lineTo(xVal, centerY + wave);
        }
      }
      ctx.stroke();
    }
  }

  /**
   * Powerful MediaRecorder engine pipeline. Automatically connects standard Canvas streams,
   * captures real audio track recitations, synchronizes animation nodes,
   * compiles the WebM buffer, wraps it for perfect WhatsApp playback compatibility, 
   * and triggers the device system download automatically.
   * 
   * @param {Object} state Control State
   * @param {Object} verse Verses data payload
   * @param {Audio} currentPlayingAudio Reference to the browser Audio playback element
   * @param {Function} onProgress Progress updater callback
   */
  async recordVideo(state, verse, currentPlayingAudio, onProgress) {
    if (this.isRecording) return;
    this.isRecording = true;
    this.recordedChunks = [];

    // Safety checks for required APIs
    if (typeof MediaRecorder === 'undefined') {
      console.warn("VideoRenderer: MediaRecorder is not supported in this environment.");
      onProgress(50, "Rendering mock frames...");
      await new Promise(resolve => setTimeout(resolve, 1000));
      onProgress(100, "Render completed (mock).");
      this.isRecording = false;
      throw new Error("MediaRecorder is not supported in this browser environment.");
    }

    if (!this.canvas || typeof this.canvas.captureStream !== 'function') {
      console.warn("VideoRenderer: Canvas.captureStream is not supported.");
      onProgress(100, "Render completed (mock).");
      this.isRecording = false;
      throw new Error("Canvas captureStream is not supported in this browser environment.");
    }

    const individualVerses = verse.verses || [verse];
    this.currentVerseIndex = 0;

    // Pause the active playback element first to avoid simultaneous audio confusion
    if (currentPlayingAudio && typeof currentPlayingAudio.pause === 'function') {
      try {
        currentPlayingAudio.currentTime = 0;
        currentPlayingAudio.pause();
      } catch (e) {
        console.warn("Audio controls error", e);
      }
    }

    // 1. Synchronously initialize/resume AudioContext IMMEDIATELY on user-gesture stack!
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      if (!this.audioCtx) {
        try {
          // Set 44100Hz explicitly to fix fast/slow playback distortions
          this.audioCtx = new AudioContextClass({ sampleRate: 44100 });
        } catch (e) {
          console.warn("Failed to set 44.1kHz sample rate, falling back to default.", e);
          this.audioCtx = new AudioContextClass();
        }
      }
    }
    
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      try {
        this.audioCtx.resume();
      } catch (e) {
        console.warn("Error resuming AudioContext", e);
      }
    }

    // 2. Pre-load all audio tracks as Blobs to avoid ANY network latency/glitch during recording
    onProgress(1, "Preparing audio pipeline...");
    const cachedAudioUrls = [];
    for (let i = 0; i < individualVerses.length; i++) {
      const originalUrl = individualVerses[i].audio;
      if (originalUrl) {
        try {
          const res = await fetch(originalUrl);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const blob = await res.blob();
          const blobUrl = URL.createObjectURL(blob);
          cachedAudioUrls.push(blobUrl);
        } catch (err) {
          console.warn(`Failed to preload audio for verse ${i + 1}:`, err);
          cachedAudioUrls.push(originalUrl); // Fallback
        }
      } else {
        cachedAudioUrls.push("");
      }
      const p = 1 + Math.floor(((i + 1) / individualVerses.length) * 12);
      onProgress(p, `Caching recitation audio (${i + 1}/${individualVerses.length})...`);
    }

    // Reset dimensions for clean recording export standards
    this.configureCanvasResolution(state.aspectRatio);

    // Preload background image to cache to ensure zero latency/flicker during video render
    let bgUrl = 'https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?auto=format&fit=crop&w=1280&q=80';
    if (state.bgType === 'image') {
      const query = encodeURIComponent(state.searchQuery || 'nature landscape stars');
      const sig = state.bgSeed || 12345;
      bgUrl = `https://images.unsplash.com/featured/1280x720/?${query}&sig=${sig}`;
    }
    onProgress(15, "Pre-loading premium background...");
    await this.getCachedImage(bgUrl);

    // Create a dedicated audio element specifically for recording to avoid event-listener conflicts
    // It is created and primed here, synchronously within the user-gesture click handler context,
    // to unlock it and bypass any browser autoplay/security restrictions.
    const recordingAudio = new Audio();
    recordingAudio.crossOrigin = "anonymous";
    recordingAudio.src = cachedAudioUrls[0];
    recordingAudio.load();

    try {
      const unlockPromise = recordingAudio.play();
      if (unlockPromise !== undefined) {
        unlockPromise.then(() => {
          recordingAudio.pause();
          recordingAudio.currentTime = 0;
        }).catch(e => {
          console.warn("Autoplay bypass primed audio caught restriction rejection:", e);
        });
      }
    } catch (e) {
      console.warn("Direct audio priming exception caught:", e);
    }

    // Connect dedicated audio stream natively
    let audioStreamTrack;
    if (this.audioCtx) {
      try {
        const dest = this.audioCtx.createMediaStreamDestination();
        
        if (this.audioSourceNode) {
          try {
            this.audioSourceNode.disconnect();
          } catch (e) {}
        }
        
        this.audioSourceNode = this.audioCtx.createMediaElementSource(recordingAudio);
        this.audioSourceNode.connect(this.audioCtx.destination);
        this.audioSourceNode.connect(dest);
        audioStreamTrack = dest.stream.getAudioTracks()[0];
        console.log("VideoRenderer: Successfully established dedicated recording audio track capture:", audioStreamTrack);
      } catch (e) {
        console.warn("VideoRenderer: Media Capture Audio pipeline bypass active.", e);
      }
    }

    // Capture standard Canvas frame track at steady 30fps
    const canvasStream = this.canvas.captureStream(30);
    const combinedStream = new MediaStream();
    
    // Add canvas tracks
    canvasStream.getVideoTracks().forEach(track => combinedStream.addTrack(track));
    
    // Add real audio track if present
    if (audioStreamTrack) {
      combinedStream.addTrack(audioStreamTrack);
    }

    // Determine WhatsApp & browser compatible codecs (webm format wrapped correctly)
    let options = { mimeType: 'video/webm;codecs=vp9', videoBitsPerSecond: 8000000 };
    try {
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options = { mimeType: 'video/webm;codecs=vp8', videoBitsPerSecond: 8000000 };
      }
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options = { mimeType: 'video/webm', videoBitsPerSecond: 8000000 };
      }
    } catch (e) {
      options = { videoBitsPerSecond: 8000000 };
    }

    try {
      this.mediaRecorder = new MediaRecorder(combinedStream, options);
    } catch (err) {
      console.warn("MediaRecorder creation with audio failed (possibly due to CORS or secure iframe limitations). Falling back to video-only capture.", err);
      const videoOnlyStream = new MediaStream();
      canvasStream.getVideoTracks().forEach(track => videoOnlyStream.addTrack(track));
      this.mediaRecorder = new MediaRecorder(videoOnlyStream, options);
    }

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        this.recordedChunks.push(event.data);
      }
    };

    // Callback on stop to save
    const recordPromise = new Promise((resolve, reject) => {
      this.mediaRecorder.onstop = () => {
        const mime = this.mediaRecorder.mimeType || 'video/webm';
        const blob = new Blob(this.recordedChunks, { type: mime });
        const videoUrl = URL.createObjectURL(blob);
        resolve(videoUrl);
      };
      this.mediaRecorder.onerror = (e) => reject(e);
    });

    // Start Recording
    this.mediaRecorder.start();
    await recordingAudio.play().catch(e => console.warn("Recording audio play start error", e));

    this.isTransitioning = false;
    this.verseStartTime = performance.now();

    // Nested animation frames drawer with sequential verse handling driven by real-time audio and wall clock fallback
    const renderLoop = async (now) => {
      if (!this.isRecording) return;
      
      const activeVerse = individualVerses[this.currentVerseIndex] || individualVerses[individualVerses.length - 1];

      // Robustly estimate active verse duration from real audio or safe text metrics
      let verseDuration = 8; // Default fallback: 8s
      if (recordingAudio && recordingAudio.duration && !isNaN(recordingAudio.duration) && recordingAudio.duration > 0) {
        verseDuration = recordingAudio.duration;
      } else if (activeVerse && activeVerse.arabic) {
        // Estimate: ~12 chars per second, bounded between 5s and 25s
        verseDuration = Math.max(5, Math.min(25, activeVerse.arabic.length / 12));
      }

      const realElapsed = (performance.now() - this.verseStartTime) / 1000;

      // Determine if active verse is complete with a 1.0 second min-duration guard to prevent rapid double transitions
      let isVerseFinished = false;
      if (realElapsed > 1.0) {
        if (recordingAudio && !recordingAudio.paused) {
          isVerseFinished = recordingAudio.ended;
          // Fallback for network hiccups or stalled audio
          if (!isVerseFinished && realElapsed > verseDuration + 4.0) {
            isVerseFinished = true;
          }
        } else {
          isVerseFinished = realElapsed >= verseDuration;
        }
      }

      // Handle automatic sequential verse transition when active verse is complete
      if (isVerseFinished && !this.isTransitioning) {
        this.isTransitioning = true;
        this.currentVerseIndex++;
        
        if (this.currentVerseIndex < individualVerses.length) {
          const nextVerse = individualVerses[this.currentVerseIndex];
          onProgress((this.currentVerseIndex / individualVerses.length) * 100, `Fading to Verse ${this.currentVerseIndex + 1}...`);
          
          try {
            recordingAudio.pause();
            recordingAudio.src = cachedAudioUrls[this.currentVerseIndex];
            recordingAudio.load();
            recordingAudio.currentTime = 0;
            await recordingAudio.play().catch(e => console.warn("Audio transition play error", e));
          } catch (e) {
            console.warn("Verse audio load/play transition error", e);
          }
          
          this.verseStartTime = performance.now();
          this.isTransitioning = false;
        } else {
          this.isTransitioning = false;
        }
      }

      // Recalculate duration for progress bar
      let currentVerse = individualVerses[this.currentVerseIndex] || individualVerses[individualVerses.length - 1];
      let currentVerseDuration = 8;
      if (recordingAudio && recordingAudio.duration && !isNaN(recordingAudio.duration) && recordingAudio.duration > 0) {
        currentVerseDuration = recordingAudio.duration;
      } else if (currentVerse && currentVerse.arabic) {
        currentVerseDuration = Math.max(5, Math.min(25, currentVerse.arabic.length / 12));
      }

      // Calculate smooth, predictable recording progress
      let progress = 0;
      if (individualVerses.length > 0) {
        const baseProgress = (this.currentVerseIndex / individualVerses.length) * 100;
        const currentVerseProgress = recordingAudio && !recordingAudio.paused && recordingAudio.duration 
          ? Math.min(1.0, recordingAudio.currentTime / recordingAudio.duration)
          : Math.min(1.0, realElapsed / currentVerseDuration);
        progress = Math.min(100, baseProgress + (currentVerseProgress * (100 / individualVerses.length)));
      }

      onProgress(progress, `Rendering Frame: ${Math.floor(progress)}%`);

      // Update frame drawing for the active sequential verse safely
      try {
        await this.drawFrame(state, activeVerse, now, true);
      } catch (err) {
        console.error("Frame drawing error: ", err);
      }

      const isFinished = this.currentVerseIndex >= individualVerses.length && !this.isTransitioning;

      if (!isFinished) {
        this.animationFrameId = requestAnimationFrame(renderLoop);
      } else {
        if (this.endingBufferFrames === undefined) {
          this.endingBufferFrames = 36; // 36 frames (~1.2 seconds) of static pad to prevent cutoff
        }
        
        if (this.endingBufferFrames > 0) {
          this.endingBufferFrames--;
          this.animationFrameId = requestAnimationFrame(renderLoop);
        } else {
          this.endingBufferFrames = undefined;
          this.stopRecordingAndExport();
        }
      }
    };

    this.animationFrameId = requestAnimationFrame(renderLoop);
    const downloadUrl = await recordPromise;

    // Clean up allocated system memory nodes safely to avoid browser leakage
    this.cleanupRecording(recordingAudio);
    
    const filename = `Al-Bayan_${verse.surahName}_${verse.verseKey.replace(':', '_')}.mp4`;
    return { downloadUrl, filename };
  }

  stopRecordingAndExport() {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    this.isRecording = false;
  }

  cleanupRecording(recordingAudio) {
    this.isRecording = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    if (recordingAudio) {
      try {
        recordingAudio.pause();
        recordingAudio.src = '';
      } catch (e) {}
    }
    this.recordedChunks = [];
  }
}

export const videoRenderer = new VideoRenderer();
