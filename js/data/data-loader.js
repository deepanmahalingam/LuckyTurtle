import { CONFIG } from '../config.js';

export class DataLoader {
  static async load(onProgress) {
    // Try cache first
    const cached = DataLoader.getFromCache();
    if (cached) {
      if (onProgress) onProgress('Loaded from cache');
      return cached;
    }

    if (onProgress) onProgress('Fetching historical data...');

    try {
      const response = await fetch(CONFIG.DATA_URL);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const rawData = await response.json();

      if (onProgress) onProgress('Processing data...');
      DataLoader.saveToCache(rawData);
      return rawData;
    } catch (err) {
      console.error('Failed to fetch data:', err);
      // Try cache even if expired
      const expired = DataLoader.getFromCache(true);
      if (expired) return expired;
      throw err;
    }
  }

  static getFromCache(ignoreExpiry = false) {
    try {
      const stored = localStorage.getItem(CONFIG.CACHE_KEY);
      if (!stored) return null;

      const { version, timestamp, data } = JSON.parse(stored);
      if (version !== CONFIG.CACHE_VERSION) return null;

      if (!ignoreExpiry) {
        const age = Date.now() - timestamp;
        if (age > CONFIG.CACHE_EXPIRY_MS) return null;
      }

      return data;
    } catch {
      return null;
    }
  }

  static saveToCache(data) {
    try {
      const payload = {
        version: CONFIG.CACHE_VERSION,
        timestamp: Date.now(),
        data
      };
      localStorage.setItem(CONFIG.CACHE_KEY, JSON.stringify(payload));
    } catch (e) {
      console.warn('Cache save failed:', e);
    }
  }
}
