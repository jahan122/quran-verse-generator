/**
 * @file app.js
 * @description Application bootstrap script. Orchestrates the UI controller,
 * wires Quranic services, and coordinates the high-resolution video/image rendering pipelines.
 */

import { uiController } from './uiController.js';
import { videoRenderer } from './videoRenderer.js';

// Safe querySelector and querySelectorAll wrapper patch to escape Tailwind fractional classes (like .gap-0.5)
const originalQuerySelector = document.querySelector;
const originalQuerySelectorAll = document.querySelectorAll;

function escapeFractionalSelector(selector) {
  if (typeof selector !== 'string') return selector;
  // Replace unescaped decimals in Tailwind class names (e.g., .gap-0.5 -> .gap-0\.5, .py-1.5 -> .py-1\.5)
  return selector.replace(/\.([\w-]+)-(\d+)\.(\d+)/g, '.$1-$2\\.$3');
}

document.querySelector = function(selector) {
  try {
    return originalQuerySelector.call(this, selector);
  } catch (err) {
    const fixed = escapeFractionalSelector(selector);
    if (fixed !== selector) {
      try {
        return originalQuerySelector.call(this, fixed);
      } catch (e) {}
    }
    throw err;
  }
};

document.querySelectorAll = function(selector) {
  try {
    return originalQuerySelectorAll.call(this, selector);
  } catch (err) {
    const fixed = escapeFractionalSelector(selector);
    if (fixed !== selector) {
      try {
        return originalQuerySelectorAll.call(this, fixed);
      } catch (e) {}
    }
    throw err;
  }
};

/**
 * Bootstrap the main application, coordinate the UI and video rendering engines,
 * and wire up the interactive pipeline.
 */
async function bootstrapApp() {
  console.log("Al-Bayan Quranic Studio: Starting client initialization...");

  try {
    // 1. Initialize the UI state & bind controls
    await uiController.init();
    
    // 2. Bind the Canvas renderer engine to our workspace canvas
    const canvas = uiController.els.canvas || document.getElementById('studioCanvas');
    if (canvas) {
      videoRenderer.setCanvas(canvas);
      console.log("Al-Bayan Quranic Studio: Canvas successfully bound to VideoRenderer.");
    } else {
      console.warn("Al-Bayan Quranic Studio: Canvas element not found during bootstrap.");
    }

    // 3. Register Image generation trigger (PNG)
    const genImageBtn = uiController.els.generateImageBtn || document.querySelector('#previewWorkspace section button:nth-of-type(1)');
    if (genImageBtn) {
      // Remove any existing event listeners by replacing the button or using a fresh listener
      genImageBtn.addEventListener('click', async () => {
        if (!uiController.state.activeVerseData) {
          console.warn("No active verse loaded for export");
          uiController.updateLoaderStatus("Please Select a Verse First", "100%", "bg-rose-500");
          return;
        }

        uiController.updateLoaderStatus("Exporting PNG Image...", "50%", "bg-gold-500");
        
        try {
          const dataUrl = await videoRenderer.exportImage(uiController.state, uiController.state.activeVerseData);
          
          // Trigger dynamic browser download trigger
          const trigger = document.createElement('a');
          trigger.href = dataUrl;
          trigger.download = `Al-Bayan_${uiController.state.activeVerseData.surahName}_${uiController.state.activeVerseData.verseKey.replace(':', '_')}.png`;
          document.body.appendChild(trigger);
          trigger.click();
          document.body.removeChild(trigger);
          
          uiController.updateLoaderStatus("Image Saved Successfully", "100%", "bg-emerald-500");
        } catch (e) {
          console.error("Failed to generate image", e);
          uiController.updateLoaderStatus("Image Generation Failed", "100%", "bg-rose-500");
        }
      });
    }

    // 4. Register Video/Stories generation trigger (MP4 Wrapper)
    const genVideoBtn = uiController.els.generateVideoBtn || document.querySelector('#previewWorkspace section button:nth-of-type(2)');
    
    // Modal selectors
    const previewModal = document.getElementById('videoPreviewModal');
    const modalVideoPlayer = document.getElementById('modalVideoPlayer');
    const closePreviewBtn = document.getElementById('closePreviewModalBtn');
    const discardVideoBtn = document.getElementById('discardVideoBtn');
    const downloadVideoBtn = document.getElementById('downloadVideoBtn');

    let activeVideoBlobUrl = null;
    let activeVideoFilename = '';

    const showModal = (blobUrl, filename) => {
      // Discard previous if exists
      if (activeVideoBlobUrl) {
        try { URL.revokeObjectURL(activeVideoBlobUrl); } catch (e) {}
      }

      activeVideoBlobUrl = blobUrl;
      activeVideoFilename = filename;
      
      if (modalVideoPlayer) {
        modalVideoPlayer.src = blobUrl;
        modalVideoPlayer.load();
      }
      
      if (previewModal) {
        previewModal.classList.remove('hidden');
        // Force reflow and add opacity + scaling transitions
        setTimeout(() => {
          previewModal.classList.remove('opacity-0');
          const innerModal = previewModal.querySelector('.bg-slate-900');
          if (innerModal) {
            innerModal.classList.remove('scale-95');
            innerModal.classList.add('scale-100');
          }
        }, 10);
      }
    };

    const hideModal = () => {
      if (modalVideoPlayer) {
        modalVideoPlayer.pause();
        modalVideoPlayer.src = '';
      }
      if (previewModal) {
        previewModal.classList.add('opacity-0');
        const innerModal = previewModal.querySelector('.bg-slate-900');
        if (innerModal) {
          innerModal.classList.remove('scale-100');
          innerModal.classList.add('scale-95');
        }
        setTimeout(() => {
          previewModal.classList.add('hidden');
        }, 300);
      }
    };

    if (closePreviewBtn) closePreviewBtn.addEventListener('click', hideModal);
    if (discardVideoBtn) discardVideoBtn.addEventListener('click', () => {
      if (activeVideoBlobUrl) {
        try { URL.revokeObjectURL(activeVideoBlobUrl); } catch (e) {}
        activeVideoBlobUrl = null;
      }
      hideModal();
    });

    if (downloadVideoBtn) {
      downloadVideoBtn.addEventListener('click', () => {
        if (!activeVideoBlobUrl) return;
        const trigger = document.createElement('a');
        trigger.href = activeVideoBlobUrl;
        trigger.download = activeVideoFilename;
        document.body.appendChild(trigger);
        trigger.click();
        document.body.removeChild(trigger);
        hideModal();
      });
    }

    if (previewModal) {
      previewModal.addEventListener('click', (e) => {
        if (e.target === previewModal) {
          hideModal();
        }
      });
    }

    if (genVideoBtn) {
      genVideoBtn.addEventListener('click', async () => {
        if (!uiController.state.activeVerseData) {
          console.warn("No active verse loaded for video rendering");
          uiController.updateLoaderStatus("Please Select a Verse First", "100%", "bg-rose-500");
          return;
        }

        uiController.updateLoaderStatus("Preparing Render...", "10%", "bg-gold-500");

        try {
          // Pass UI controller active state, verse, actual audio player, and progress listener
          const result = await videoRenderer.recordVideo(
            uiController.state,
            uiController.state.activeVerseData,
            uiController.audioElement, // CORRECT audio element reference!
            (progress, statusText) => {
              uiController.updateLoaderStatus(statusText, `${progress}%`, "bg-gold-500");
            }
          );
          
          uiController.updateLoaderStatus("Video Story Ready!", "100%", "bg-emerald-500");

          if (result && result.downloadUrl) {
            showModal(result.downloadUrl, result.filename);
          }
        } catch (e) {
          console.error("Video recorder failed", e);
          uiController.updateLoaderStatus("Video Export Blocked", "100%", "bg-rose-500");
        }
      });
    }

    console.log("Al-Bayan Quranic Studio: Application bootstrapped and services wired successfully.");
  } catch (err) {
    console.error("Al-Bayan Engine bootstrap failed with a critical error:", err);
  }
}

// Ensure execution triggers only after DOM is fully ready
if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', bootstrapApp);
} else {
  bootstrapApp();
}

