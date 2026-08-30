import { haversineDistanceMeters } from '../domain/services/placeUtils';
import { isOutsidePlaceWithHysteresis } from '../domain/services/presenceUtils';

export interface TargetPlaceItem {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radiusMeters: number;
  code?: string;
  address?: string;
  activityId?: string;
  activityName?: string;
  scheduledTime?: string;
  scheduledStartTime?: string;
  scheduledEndTime?: string;
}

export class PresenceRadarState {
  currentCoords = $state<{ lat: number; lng: number; accuracy: number } | null>(null);
  permissionStatus = $state<'prompt' | 'granted' | 'denied'>('prompt');
  activeRelevantPlaces = $state<TargetPlaceItem[]>([]);
  isWatching = $state<boolean>(false);
  isLocating = $state<boolean>(false);

  // Debouncing a campioni consecutivi (previene sfarfallio e falsi allarmi)
  private insideCount = $state<number>(0);
  private outsideCount = $state<number>(0);
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

  // Lista di tutti i luoghi vicini ordinati per distanza (per widget dock laterale e selezione multi-cantiere)
  nearbyPlaces = $derived.by(() => {
    if (!this.currentCoords || this.activeRelevantPlaces.length === 0) return [];
    return this.activeRelevantPlaces
      .filter(p => typeof p.lat === 'number' && typeof p.lng === 'number')
      .map(p => {
        const distance = Math.round(haversineDistanceMeters(this.currentCoords!.lat, this.currentCoords!.lng, p.lat, p.lng));
        const isInside = distance <= (p.radiusMeters + 25);
        return { place: p, distance, isInside };
      })
      .sort((a, b) => a.distance - b.distance);
  });

  // Polling dinamico a 3 velocità per massimizzare la durata della batteria
  pollingIntervalMs = $derived.by(() => {
    if (!this.nearestPlace) return 300000; // 5 min (nessun luogo vicino)
    if (this.nearestPlace.distance > 2000) return 180000; // 3 min (> 2 km)
    if (this.nearestPlace.distance > 500) return 60000;   // 1 min (< 2 km)
    return 15000; // 15 sec (< 500 m, vicinanza imminente)
  });

  // Rilevamento ingresso con tolleranza GPS
  isInsideNearest = $derived.by(() => {
    if (!this.nearestPlace) return false;
    const tolerance = 25; // tolleranza GPS in metri
    return this.nearestPlace.distance <= (this.nearestPlace.place.radiusMeters + tolerance);
  });

  /**
   * Aggiorna le coordinate con soglia di stabilizzazione (deadband) anti-flicker
   */
  updateCoords(newLat: number, newLng: number, newAcc: number) {
    if (this.currentCoords) {
      const dist = haversineDistanceMeters(this.currentCoords.lat, this.currentCoords.lng, newLat, newLng);
      // Se lo spostamento è inferiore a 0.5 metri e l'accuratezza è simile, evita ri-render
      if (dist < 0.5 && Math.abs((this.currentCoords.accuracy || 0) - newAcc) < 2) {
        return;
      }
    }
    this.currentCoords = { lat: newLat, lng: newLng, accuracy: newAcc };
  }

  /**
   * Verifica se l'utente è uscito dal perimetro di un luogo specifico con ISTERESI (+35m)
   */
  isOutsidePlaceWithHysteresis(targetLat: number, targetLng: number, radiusMeters: number): boolean {
    if (!this.currentCoords) return false;
    const dist = haversineDistanceMeters(this.currentCoords.lat, this.currentCoords.lng, targetLat, targetLng);
    const exitThreshold = radiusMeters + 35; // Isteresi di uscita per evitare rimbalzi
    return dist > exitThreshold;
  }

  /**
   * Avvia il radar con controllo preliminare dei permessi
   */
  async startRadar(places: TargetPlaceItem[]) {
    this.activeRelevantPlaces = places;
    if (typeof window === 'undefined' || !navigator.geolocation) return;

    await this.checkPermissions();

    // Se i permessi non sono negati dall'utente, avvia il polling
    if (this.permissionStatus !== 'denied') {
      this.resumePolling();
    }

    // Sospendi quando l'app va in background o lo schermo è spento
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
    }
  }

  /**
   * Avvio forzato/esplicito del radar (ad es. su interazione utente)
   */
  async activateExplicitly(places?: TargetPlaceItem[]) {
    if (places) this.activeRelevantPlaces = places;
    await this.requestImmediatePosition();
    this.resumePolling();
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
   * Richiede una lettura istantanea della posizione
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
      if (this.permissionStatus === 'granted') {
        this.resumePolling();
      }
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
        this.updateCoords(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy);
        this.permissionStatus = 'granted';
        if (callback) callback(this.currentCoords);
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          this.permissionStatus = 'denied';
          this.pausePolling();
          if (callback) callback(null);
        } else if (err.code === err.TIMEOUT && retryWithLowAccuracy) {
          // Fallback a bassa precisione se il GPS satellitare va in timeout
          navigator.geolocation.getCurrentPosition(
            (fallbackPos) => {
              this.updateCoords(fallbackPos.coords.latitude, fallbackPos.coords.longitude, fallbackPos.coords.accuracy);
              this.permissionStatus = 'granted';
              if (callback) callback(this.currentCoords);
            },
            () => {
              if (callback) callback(null);
            },
            { enableHighAccuracy: false, timeout: 5000, maximumAge: 0 }
          );
        } else {
          if (callback) callback(null);
        }
      },
      {
        enableHighAccuracy: useHighAccuracy,
        timeout: 8000,
        maximumAge: 0
      }
    );
  }

  async checkPermissions(): Promise<'prompt' | 'granted' | 'denied'> {
    if (typeof navigator !== 'undefined' && (navigator as any).permissions?.query) {
      try {
        const status = await (navigator as any).permissions.query({ name: 'geolocation' });
        this.permissionStatus = status.state;
        status.onchange = () => {
          this.permissionStatus = status.state;
          if (status.state === 'granted') {
            this.resumePolling();
          } else if (status.state === 'denied') {
            this.pausePolling();
          }
        };
        return status.state;
      } catch (_) {}
    }
    return this.permissionStatus;
  }
}

export const presenceRadar = new PresenceRadarState();
if (typeof window !== 'undefined') {
  (window as any).__presenceRadar = presenceRadar;
}
