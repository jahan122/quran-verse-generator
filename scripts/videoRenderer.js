/**
 * @file videoRenderer.js
 * @description Client-side Canvas video rendering with smooth fade transitions.
 */

import { languageManager } from './languageManager.js';
import { unsplashService } from './unsplashService.js';

export class VideoRenderer {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.audioCtx = null;
    this.audioSourceNode = null;
    this.animationFrameId = null;
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.isRecording = false;
    this.particles = [];
    this.imageCache = {};
    this.transitionDuration = 0.8;
  }

  async getCachedImage(url) {
    if (this.imageCache[url]) return this.imageCache[url];
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = url;
    await new Promise(resolve => { img.onload = resolve; img.onerror = resolve; });
    this.imageCache[url] = img;
    return img;
  }

  setCanvas(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = this.canvas.getContext('2d');
  }

  configureCanvasResolution(aspectRatio) {
    if (aspectRatio === '9:16') { this.canvas.width = 1080; this.canvas.height = 1920; }
    else if (aspectRatio === '16:9') { this.canvas.width = 1920; this.canvas.height = 1080; }
    else { this.canvas.width = 1080; this.canvas.height = 1080; }
  }

  async exportImage(state, verse) {
    this.configureCanvasResolution(state.aspectRatio);
    const bgUrl = unsplashService.getBgImageSync(state.bgSeed || 12345, true);
    await this.getCachedImage(bgUrl);
    await this.drawFrame(state, verse, 0, false);
    return this.canvas.toDataURL('image/png');
  }

  async drawFrame(state, verse, timestamp = 0, isLiveRecording = false, opacity = 1.0) {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Background
    const bgUrl = unsplashService.getBgImageSync(state.bgSeed || 12345, true);
    const bgImg = this.imageCache[bgUrl];
    if (bgImg && bgImg.naturalWidth > 0) {
      const imgRatio = bgImg.width / bgImg.height;
      const canvasRatio = w / h;
      let dW = w, dH = h, dX = 0, dY = 0;
      if (imgRatio > canvasRatio) { dW = h * imgRatio; dX = (w - dW) / 2; }
      else { dH = w / imgRatio; dY = (h - dH) / 2; }
      ctx.drawImage(bgImg, dX, dY, dW, dH);
    } else {
      ctx.fillStyle = state.theme === 'light' ? '#f8fafc' : '#10211e';
      ctx.fillRect(0, 0, w, h);
    }

    // Overlay Gradients
    const overlayColor = state.theme === 'light' ? 'rgba(255, 255, 255, 0.4)' : 'rgba(16, 33, 30, 0.4)';
    const bottomColor = state.theme === 'light' ? 'rgba(248, 250, 252, 0.95)' : 'rgba(10, 10, 10, 0.95)';
    const overlayGrad = ctx.createLinearGradient(0, 0, 0, h);
    overlayGrad.addColorStop(0, overlayColor);
    overlayGrad.addColorStop(1, bottomColor);
    ctx.fillStyle = overlayGrad;
    ctx.fillRect(0, 0, w, h);

    const contrastOpacity = (state.contrast || 45) / 100;
    // Always use dark overlay for contrast
    ctx.fillStyle = `rgba(2, 6, 23, ${contrastOpacity})`;
    ctx.fillRect(0, 0, w, h);

    if (state.goldenBorder) this.drawGoldenFrame(ctx, w, h);

    ctx.globalAlpha = opacity;
    const layout = languageManager.getLayoutPlan(verse, { 
      arabicSize: state.arabicSize, 
      translationSize: state.translationSize 
    });
    
    const scale = w / 380;
    const centerX = w / 2;

    // Bismillah
    if (layout.meta.bismillah) {
      ctx.font = `normal ${14 * scale}px "Amiri", serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ebc153';
      ctx.fillText(layout.meta.bismillah, centerX, h * 0.15);
    }

    // Arabic
    const arFontMap = { 
      'Amiri': '"Amiri", serif', 
      'Reem Kufi': '"Reem Kufi", sans-serif', 
      'Scheherazade': '"Scheherazade New", serif', 
      'Noto Naskh Arabic': '"Noto Naskh Arabic", serif', 
      'Lateef': '"Lateef", serif', 
      'Harmattan': '"Harmattan", sans-serif' 
    };
    ctx.font = `normal ${layout.arabic.fontSize * scale}px ${arFontMap[state.arabicFont] || arFontMap['Amiri']}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = state.theme === 'light' ? '#1e293b' : '#fdf5df';
    
    let displayAr = layout.arabic.text;
    if (!state.diacritics) displayAr = displayAr.replace(/[\u064B-\u0652]/g, "");
    
    // Wrap Arabic Text
    const arLines = this.wrapText(ctx, displayAr, w * 0.8);
    let arY = h * 0.45 - (arLines.length * layout.arabic.fontSize * scale * 0.5);
    arLines.forEach(line => {
      ctx.fillText(line, centerX, arY);
      arY += layout.arabic.fontSize * scale * 1.5 + (state.lineGap || 0) * scale;
    });

    // Translation
    const transFontMap = { 
      'Plus Jakarta Sans': '"Plus Jakarta Sans", sans-serif', 
      'Cinzel': '"Cinzel", serif', 
      'Montserrat': '"Montserrat", sans-serif', 
      'Playfair Display': '"Playfair Display", serif', 
      'Lora': '"Lora", serif', 
      'Georgia': 'Georgia, serif' 
    };
    ctx.font = `300 ${layout.english.fontSize * scale}px ${transFontMap[state.translationFont] || transFontMap['Plus Jakarta Sans']}`;
    ctx.fillStyle = state.theme === 'light' ? '#475569' : '#cbd5e1';
    
    const enLines = this.wrapText(ctx, layout.english.text, w * 0.8);
    let enY = h * 0.65 - (enLines.length * layout.english.fontSize * scale * 0.5);
    enLines.forEach(line => {
      ctx.fillText(line, centerX, enY);
      enY += layout.english.fontSize * scale * 1.45 + (state.lineGap || 0) * scale;
    });

    if (state.showReference) this.drawReferenceBanner(ctx, centerX, h * 0.9, layout.meta.reference, scale);
    ctx.globalAlpha = 1.0;
  }

  wrapText(ctx, text, maxWidth) {
    if (!text) return [];
    const words = text.split(' ');
    const lines = [];
    let currentLine = words[0];

    for (let i = 1; i < words.length; i++) {
      const word = words[i];
      const width = ctx.measureText(currentLine + " " + word).width;
      if (width < maxWidth) {
        currentLine += " " + word;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }
    lines.push(currentLine);
    return lines;
  }

  drawGoldenFrame(ctx, w, h) {
    ctx.strokeStyle = 'rgba(235, 193, 83, 0.3)';
    ctx.lineWidth = w * 0.005;
    ctx.strokeRect(w * 0.03, w * 0.03, w * 0.94, h - w * 0.06);
    
    // Corner accents
    const s = w * 0.05;
    const p = w * 0.03;
    ctx.lineWidth = w * 0.008;
    // TL
    ctx.beginPath(); ctx.moveTo(p, p + s); ctx.lineTo(p, p); ctx.lineTo(p + s, p); ctx.stroke();
    // TR
    ctx.beginPath(); ctx.moveTo(w - p - s, p); ctx.lineTo(w - p, p); ctx.lineTo(w - p, p + s); ctx.stroke();
    // BL
    ctx.beginPath(); ctx.moveTo(p, h - p - s); ctx.lineTo(p, h - p); ctx.lineTo(p + s, h - p); ctx.stroke();
    // BR
    ctx.beginPath(); ctx.moveTo(w - p - s, h - p); ctx.lineTo(w - p, h - p); ctx.lineTo(w - p, h - p - s); ctx.stroke();
  }

  drawReferenceBanner(ctx, x, y, ref, scale) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.beginPath(); ctx.roundRect(x - 90 * scale, y - 15 * scale, 180 * scale, 30 * scale, 15 * scale); ctx.fill();
    ctx.fillStyle = '#ebc153'; ctx.font = `600 ${10 * scale}px "Cinzel", serif`; ctx.fillText(ref.toUpperCase(), x, y + 4 * scale);
  }

  async recordVideo(state, verse, currentPlayingAudio, onProgress) {
    if (this.isRecording) return;
    this.isRecording = true;
    this.recordedChunks = [];
    const individualVerses = verse.verses || [verse];
    
    const cachedAudioUrls = [];
    for (let i = 0; i < individualVerses.length; i++) {
      const res = await fetch(individualVerses[i].audio);
      const blob = await res.blob();
      cachedAudioUrls.push(URL.createObjectURL(blob));
      onProgress(((i + 1) / individualVerses.length) * 15, "Caching audio...");
    }

    this.configureCanvasResolution(state.aspectRatio);
    await this.getCachedImage(unsplashService.getBgImageSync(state.bgSeed, true));

    const recordingAudio = new Audio();
    recordingAudio.crossOrigin = "anonymous";
    recordingAudio.src = cachedAudioUrls[0];
    
    const canvasStream = this.canvas.captureStream(30);
    this.mediaRecorder = new MediaRecorder(canvasStream, { mimeType: 'video/webm;codecs=vp9', videoBitsPerSecond: 8000000 });
    this.mediaRecorder.ondataavailable = e => { if (e.data.size > 0) this.recordedChunks.push(e.data); };
    
    const recordPromise = new Promise(resolve => { this.mediaRecorder.onstop = () => resolve(URL.createObjectURL(new Blob(this.recordedChunks, { type: 'video/webm' }))); });

    this.mediaRecorder.start();
    await recordingAudio.play();
    
    let currentIdx = 0;
    let startTime = performance.now();
    let isTransitioning = false;

    const renderLoop = async (now) => {
      if (!this.isRecording) return;
      const elapsed = (performance.now() - startTime) / 1000;
      const duration = recordingAudio.duration || 5;
      
      let opacity = 1.0;
      if (elapsed > duration - this.transitionDuration) {
        opacity = Math.max(0, (duration - elapsed) / this.transitionDuration);
      } else if (elapsed < this.transitionDuration) {
        opacity = Math.min(1, elapsed / this.transitionDuration);
      }

      await this.drawFrame(state, individualVerses[currentIdx], now, true, opacity);

      if (elapsed >= duration && !isTransitioning) {
        isTransitioning = true;
        currentIdx++;
        if (currentIdx < individualVerses.length) {
          recordingAudio.src = cachedAudioUrls[currentIdx];
          await recordingAudio.play();
          startTime = performance.now();
          isTransitioning = false;
          this.animationFrameId = requestAnimationFrame(renderLoop);
        } else {
          this.mediaRecorder.stop();
          this.isRecording = false;
        }
      } else {
        this.animationFrameId = requestAnimationFrame(renderLoop);
      }
      onProgress((currentIdx / individualVerses.length) * 100, `Rendering...`);
    };

    this.animationFrameId = requestAnimationFrame(renderLoop);
    const downloadUrl = await recordPromise;
    return { downloadUrl, filename: `Al-Bayan_${verse.surahName}.mp4` };
  }
}

export const videoRenderer = new VideoRenderer();