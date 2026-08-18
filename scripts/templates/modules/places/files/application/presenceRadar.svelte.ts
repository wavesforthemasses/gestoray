import { haversineDistanceMeters } from '../domain/services/placeUtils';

export interface TargetPlaceItem {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radiusMeters: number;
}

export class PresenceRadarState {
  currentCoords = $state<{ lat: number; lng: number; accuracy: number } | null>(null);
  permissionStatus = $state<'prompt' | 'granted' | 'denied'>('prompt');
  activeRelevantPlaces = $state<TargetPlaceItem[]>([]);
  isWatching = $state<boolean>(false);
  isLocating = $state<boolean>(false);
  
  private intervalTimer: any = null;

  nearestPlace = $derived.by(() => {
    if (!this.currentCoords || this.activeRelevantPlaces.length === 0) return null;
    let closest: { place: TargetPlaceItem; distance: number } | null = null;
    for (const p of this.activeRelevantPlaces) {
      if (typeof p.lat !== 'number' || typeof p.lng !== 'number') continue;
      const dist = haversineDistanceMeters(this.currentCoords.lat, this.currentCoords.lng, p.lat, p.lng);
      if (!closest || dist < closest.distance) {
        closest = { place: p, distance: Math.round(dist) };
      }
    }
    return closest;
  });

  // Polling dinamico a 3 velocità per massimizzare la durata della batteria
  pollingIntervalMs = $derived.by(() => {
    if (!this.nearestPlace) return 300000; // 5 min (nessun luogo vicino)
    if (this.nearestPlace.distance > 2000) return 180000; // 3 min (> 2 km)
    if (this.nearestPlace.distance > 500) return 60000;   // 1 min (< 2 km)
    return 15000; // 15 sec (< 500 m, vicinanza imminente)
  });

  isInsideNearest = $derived.by(() => {
    if (!this.nearestPlace) return false;
    const tolerance = 25; // tolleranza GPS in metri
    return this.nearestPlace.distance <= (this.nearestPlace.place.radiusMeters + tolerance);
  });

  /**
   * Avvia il radar con aggancio automatico a document.visibilityState
   */
  startRadar(places: TargetPlaceItem[]) {
    this.activeRelevantPlaces = places;
    if (typeof window === 'undefined' || !navigator.geolocation) return;

    this.checkPermissions();
    this.resumePolling();

    // Sospendi quando l'app va in background o schermo spento
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
    }
  }

  stopRadar() {
    this.pausePolling();
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    }
  }

  updatePlaces(places: TargetPlaceItem[]) {
    this.activeRelevantPlaces = places;
  }

  /**
   * Richiede una lettura istantanea della posizione (ad es. al clic del bottone)
   */
  async requestImmediatePosition(): Promise<{ lat: number; lng: number; accuracy: number } | null> {
    return new Promise((resolve) => {
      if (typeof window === 'undefined' || !navigator.geolocation) {
        resolve(null);
        return;
      }
      this.isLocating = true;
      this.queryPositionOnce(true, (coords) => {
        this.isLocating = false;
        resolve(coords);
      });
    });
  }

  private handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      this.resumePolling();
    } else {
      this.pausePolling();
    }
  };

  private resumePolling() {
    this.queryPositionOnce(true);
    if (this.intervalTimer) clearInterval(this.intervalTimer);
    this.intervalTimer = setInterval(() => {
      this.queryPositionOnce(true);
    }, this.pollingIntervalMs);
    this.isWatching = true;
  }

  private pausePolling() {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
    this.isWatching = false;
  }

  /**
   * Esegue la lettura della posizione con fallback resiliente indoor/cantiere
   */
  private queryPositionOnce(
    retryWithLowAccuracy = true,
    callback?: (coords: { lat: number; lng: number; accuracy: number } | null) => void
  ) {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      if (callback) callback(null);
      return;
    }

    const useHighAccuracy = (this.nearestPlace?.distance ?? 1000) < 500;

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.currentCoords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy
        };
        this.permissionStatus = 'granted';
        if (callback) callback(this.currentCoords);
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          this.permissionStatus = 'denied';
          if (callback) callback(null);
        } else if (err.code === err.TIMEOUT && retryWithLowAccuracy) {
          // Fallback a bassa precisione (antenne / Wi-Fi) se il GPS satellitare va in timeout
          navigator.geolocation.getCurrentPosition(
            (fallbackPos) => {
              this.currentCoords = {
                lat: fallbackPos.coords.latitude,
                lng: fallbackPos.coords.longitude,
                accuracy: fallbackPos.coords.accuracy
              };
              this.permissionStatus = 'granted';
              if (callback) callback(this.currentCoords);
            },
            () => {
              if (callback) callback(null);
            },
            { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 }
          );
        } else {
          if (callback) callback(null);
        }
      },
      {
        enableHighAccuracy: useHighAccuracy,
        timeout: 8000,
        maximumAge: 30000
      }
    );
  }

  private async checkPermissions() {
    if (typeof navigator !== 'undefined' && (navigator as any).permissions?.query) {
      try {
        const status = await (navigator as any).permissions.query({ name: 'geolocation' });
        this.permissionStatus = status.state;
        status.onchange = () => {
          this.permissionStatus = status.state;
        };
      } catch (_) {}
    }
  }
}

export const presenceRadar = new PresenceRadarState();
