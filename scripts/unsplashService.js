/**
 * @file unsplashService.js
 * @description Handles searching and fetching pristine, high-resolution nature photography
 * using the user's Unsplash developer API key. Includes local persistence/caching to avoid rate limits.
 */

const UNSPLASH_ACCESS_KEY = "JZLSF3RCJnC0k8odKHeLw3y_YW2VSaC7sjKU2OmesoI";

export class UnsplashService {
  constructor() {
    this.images = this.loadFromCache() || [];
    // Trigger background fetch to populate/refresh cache
    this.fetchNatureImages();
  }

  loadFromCache() {
    try {
      const data = localStorage.getItem('unsplash_nature_images');
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  }

  saveToCache(images) {
    try {
      localStorage.setItem('unsplash_nature_images', JSON.stringify(images));
    } catch (e) {
      console.warn("UnsplashService: failed to cache to localStorage", e);
    }
  }

  /**
   * Fetches nature images from Unsplash.
   * Falls back to a rich curated list if API fails or rate-limited.
   */
  async fetchNatureImages() {
    // If we have cached images, use them but refresh in the background
    const hasCached = this.images.length > 0;
    
    try {
      // Fetch beautiful nature photos using nature-related keywords
      const response = await fetch(`https://api.unsplash.com/search/photos?query=nature-scenic-landscape&per_page=30&client_id=${UNSPLASH_ACCESS_KEY}`);
      if (!response.ok) {
        throw new Error(`Unsplash API error: ${response.status}`);
      }
      const data = await response.json();
      if (data && data.results && data.results.length > 0) {
        const fetchedImages = data.results.map(photo => ({
          id: photo.id,
          url: photo.urls.regular,
          fullUrl: photo.urls.full || photo.urls.regular,
          downloadLocation: photo.links.download_location
        }));
        this.images = fetchedImages;
        this.saveToCache(this.images);
        
        // Trigger download tracking as required by Unsplash API terms
        fetchedImages.forEach(img => {
          this.trackDownload(img.downloadLocation);
        });
        
        return this.images;
      }
    } catch (err) {
      console.warn("Unsplash API fetch failed, using cached or curated fallback nature list", err);
    }

    if (hasCached) {
      return this.images;
    }

    // Curated high-quality nature fallback photos (copyright-free Unsplash IDs/URLs)
    const curatedFallback = [
      { id: "1", url: "https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?auto=format&fit=crop&w=1000&q=80", fullUrl: "https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?auto=format&fit=crop&w=1920&q=80" },
      { id: "2", url: "https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?auto=format&fit=crop&w=1000&q=80", fullUrl: "https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?auto=format&fit=crop&w=1920&q=80" },
      { id: "3", url: "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=1000&q=80", fullUrl: "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=1920&q=80" },
      { id: "4", url: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1000&q=80", fullUrl: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1920&q=80" },
      { id: "5", url: "https://images.unsplash.com/photo-1501854140801-50d01698950b?auto=format&fit=crop&w=1000&q=80", fullUrl: "https://images.unsplash.com/photo-1501854140801-50d01698950b?auto=format&fit=crop&w=1920&q=80" },
      { id: "6", url: "https://images.unsplash.com/photo-1472214222541-d510753a4907?auto=format&fit=crop&w=1000&q=80", fullUrl: "https://images.unsplash.com/photo-1472214222541-d510753a4907?auto=format&fit=crop&w=1920&q=80" },
      { id: "7", url: "https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1000&q=80", fullUrl: "https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1920&q=80" },
      { id: "8", url: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1000&q=80", fullUrl: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1920&q=80" },
      { id: "9", url: "https://images.unsplash.com/photo-1475924156734-496f6cac6ec1?auto=format&fit=crop&w=1000&q=80", fullUrl: "https://images.unsplash.com/photo-1475924156734-496f6cac6ec1?auto=format&fit=crop&w=1920&q=80" },
      { id: "10", url: "https://images.unsplash.com/photo-1434725039720-abb26e227fc7?auto=format&fit=crop&w=1000&q=80", fullUrl: "https://images.unsplash.com/photo-1434725039720-abb26e227fc7?auto=format&fit=crop&w=1920&q=80" }
    ];
    this.images = curatedFallback;
    return this.images;
  }

  async trackDownload(downloadLocationUrl) {
    if (!downloadLocationUrl) return;
    try {
      await fetch(`${downloadLocationUrl}&client_id=${UNSPLASH_ACCESS_KEY}`);
    } catch (e) {
      // Silent catch
    }
  }

  /**
   * Synchronously gets a background image from the current loaded pool for a given seed
   */
  getBgImageSync(seed, highRes = false) {
    if (!this.images || this.images.length === 0) {
      // Absolute fallback before fetch is complete
      return highRes 
        ? "https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?auto=format&fit=crop&w=1920&q=80"
        : "https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?auto=format&fit=crop&w=1000&q=80";
    }
    const index = Math.abs(seed) % this.images.length;
    const photo = this.images[index];
    return highRes ? photo.fullUrl : photo.url;
  }
}

export const unsplashService = new UnsplashService();
