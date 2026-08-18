import { calculateGeohash } from '../../domain/services/placeUtils';

export interface GeocodeResult {
  latitude: number;
  longitude: number;
  formattedAddress: string;
  geohash: string;
  raw: any;
}

export class NominatimGeocoderAdapter {
  private static lastRequestTimestamp = 0;
  private static cache = new Map<string, GeocodeResult>();
  private static MIN_INTERVAL_MS = 1100; // Nominatim policy: max 1 req/sec

  /**
   * Geocodifica un indirizzo testuale o strutturato tramite OpenStreetMap Nominatim
   */
  static async geocodeAddress(
    queryAddress: string | { street?: string; city?: string; postalCode?: string; country?: string }
  ): Promise<GeocodeResult | null> {
    let queryStr = '';
    if (typeof queryAddress === 'string') {
      queryStr = queryAddress.trim();
    } else {
      const parts = [
        queryAddress.street,
        queryAddress.postalCode,
        queryAddress.city,
        queryAddress.country || 'Italy'
      ].filter(Boolean);
      queryStr = parts.join(', ').trim();
    }

    if (!queryStr) return null;

    const cacheKey = queryStr.toLowerCase();
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    // Rate Limiting (1 req/sec)
    const now = Date.now();
    const timeSinceLast = now - this.lastRequestTimestamp;
    if (timeSinceLast < this.MIN_INTERVAL_MS) {
      await new Promise(resolve => setTimeout(resolve, this.MIN_INTERVAL_MS - timeSinceLast));
    }
    this.lastRequestTimestamp = Date.now();

    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(queryStr)}&limit=1&addressdetails=1`;
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Gestoray-Enterprise-ERP/4.2 (https://gestoray.com)'
        }
      });

      if (!response.ok) {
        console.warn(`Nominatim geocoding failed with status: ${response.status}`);
        return null;
      }

      const results = await response.json();
      if (!Array.isArray(results) || results.length === 0) {
        return null;
      }

      const first = results[0];
      const latitude = parseFloat(first.lat);
      const longitude = parseFloat(first.lon);
      if (isNaN(latitude) || isNaN(longitude)) return null;

      const geohash = calculateGeohash(latitude, longitude, 8);
      const result: GeocodeResult = {
        latitude,
        longitude,
        formattedAddress: first.display_name || queryStr,
        geohash,
        raw: first
      };

      this.cache.set(cacheKey, result);
      return result;
    } catch (err) {
      console.warn('Errore durante la geocodifica Nominatim:', err);
      return null;
    }
  }

  /**
   * Reverse geocoding da coordinate (lat, lng) a indirizzo
   */
  static async reverseGeocode(lat: number, lng: number): Promise<string | null> {
    const now = Date.now();
    const timeSinceLast = now - this.lastRequestTimestamp;
    if (timeSinceLast < this.MIN_INTERVAL_MS) {
      await new Promise(resolve => setTimeout(resolve, this.MIN_INTERVAL_MS - timeSinceLast));
    }
    this.lastRequestTimestamp = Date.now();

    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Gestoray-Enterprise-ERP/4.2 (https://gestoray.com)'
        }
      });

      if (!response.ok) return null;
      const data = await response.json();
      return data.display_name || null;
    } catch (err) {
      console.warn('Errore reverse geocoding:', err);
      return null;
    }
  }
}
