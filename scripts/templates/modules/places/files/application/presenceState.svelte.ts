import { db } from '$lib/firebase';
import type { PlacePresenceLog, PresenceVerificationMode } from '../domain/models/presence';
import { PresenceFirestoreRepository } from '../infrastructure/firestore/PresenceFirestoreRepository';
import { checkGeofenceProximity } from '../domain/services/presenceUtils';
import { presenceRadar, type TargetPlaceItem } from './presenceRadar.svelte';
import { cleanUndefined } from '$lib/utils/helpers';

export class PresenceStateManager {
  private repo = new PresenceFirestoreRepository(db);

  activePresence = $state<PlacePresenceLog | null>(null);
  todayActivities = $state<any[]>([]);
  relevantPlaces = $state<TargetPlaceItem[]>([]);
  isLoading = $state<boolean>(false);
  isSubmitting = $state<boolean>(false);
  lastError = $state<string | null>(null);

  /**
   * Carica i dati di avvio per l'utente: presenza attiva + attività e luoghi di oggi
   */
  async loadUserTodayData(userId: string, userTeamIds: string[] = [], orgId: string = 'default') {
    if (!userId) return;
    this.isLoading = true;
    this.lastError = null;

    try {
      const todayStr = new Date().toISOString().split('T')[0];

      // 1. Lettura presenza attiva corrente
      const currentActive = await this.repo.getActivePresenceForUser(orgId, userId);
      this.activePresence = currentActive;

      // 2. Query atomica attività e luoghi del giorno con chunking protetto
      const activities = await this.repo.fetchTodayRelevantActivities(orgId, userId, userTeamIds, todayStr);
      this.todayActivities = activities;

      // 3. Estrazione luoghi con coordinate
      const placesMap = new Map<string, TargetPlaceItem>();
      const missingPlaceIds: string[] = [];

      for (const act of activities) {
        if (act.placeId) {
          const lat = act.placeSummary?.coordinates?.lat ?? act.placeSummary?.lat ?? act.latitude;
          const lng = act.placeSummary?.coordinates?.lng ?? act.placeSummary?.lng ?? act.longitude;
          const radius = act.placeSummary?.radiusMeters ?? act.radiusMeters ?? 50;
          const name = act.placeName || act.placeSummary?.name || act.placeSummary?.label || 'Luogo';

          if (typeof lat === 'number' && typeof lng === 'number') {
            placesMap.set(act.placeId, {
              id: act.placeId,
              name,
              code: act.placeSummary?.code,
              lat,
              lng,
              radiusMeters: radius,
              activityId: act.id,
              activityName: act.title || act.name,
              scheduledStartTime: act.scheduledStartTime,
              scheduledEndTime: act.scheduledEndTime
            });
          } else {
            missingPlaceIds.push(act.placeId);
          }
        }
      }

      // Se ci sono ID di luoghi privi di coordinate nelle attività, li recupera da Firestore
      if (missingPlaceIds.length > 0) {
        const fetchedPlaces = await this.repo.fetchPlacesByIds(missingPlaceIds);
        for (const p of fetchedPlaces) {
          const lat = p.address?.coordinates?.lat ?? p.geo?.location?.latitude ?? p.geo?.coordinates?.lat ?? p.latitude ?? p.lat;
          const lng = p.address?.coordinates?.lng ?? p.geo?.location?.longitude ?? p.geo?.coordinates?.lng ?? p.longitude ?? p.lng;
          const radius = p.geo?.radiusMeters ?? p.geofenceRadiusMeters ?? p.radiusMeters ?? 100;
          if (typeof lat === 'number' && typeof lng === 'number') {
            const act = activities.find(a => a.placeId === p.id);
            placesMap.set(p.id, {
              id: p.id,
              name: p.name || 'Luogo',
              code: p.code,
              lat,
              lng,
              radiusMeters: radius,
              activityId: act?.id,
              activityName: act?.title || act?.name,
              scheduledStartTime: act?.scheduledStartTime,
              scheduledEndTime: act?.scheduledEndTime
            });
          }
        }
      }

      // Se l'utente non ha attività programmate con luogo oggi, recupera i luoghi attivi generici
      if (placesMap.size === 0) {
        const activePlaces = await this.repo.fetchActiveGeofencedPlaces(orgId);
        for (const p of activePlaces) {
          const lat = p.address?.coordinates?.lat ?? p.geo?.location?.latitude ?? p.geo?.coordinates?.lat ?? p.latitude ?? p.lat;
          const lng = p.address?.coordinates?.lng ?? p.geo?.location?.longitude ?? p.geo?.coordinates?.lng ?? p.longitude ?? p.lng;
          const radius = p.geo?.radiusMeters ?? p.geofenceRadiusMeters ?? p.radiusMeters ?? 100;
          if (typeof lat === 'number' && typeof lng === 'number') {
            placesMap.set(p.id, {
              id: p.id,
              name: p.name || 'Luogo',
              code: p.code,
              lat,
              lng,
              radiusMeters: radius
            });
          }
        }
      }

      this.relevantPlaces = Array.from(placesMap.values());

      // 4. Avvio del Radar di prossimità Foreground
      if (this.relevantPlaces.length > 0) {
        presenceRadar.startRadar(this.relevantPlaces);
      }
    } catch (e: any) {
      console.warn('[PresenceStateManager] Errore caricamento presenze:', e);
      this.lastError = e?.message || 'Errore nel caricamento delle presenze';
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Esegue il check-in dell'utente in un luogo
   */
  async checkIn(
    params: {
      placeId: string;
      placeName: string;
      placeCode?: string;
      parentId?: string | null;
      parentName?: string;
      activityId?: string;
      activityName?: string;
      teamId?: string;
      teamName?: string;
      targetLat?: number;
      targetLng?: number;
      radiusMeters?: number;
      userId: string;
      userName: string;
      userEmail?: string;
      verifiedBy?: PresenceVerificationMode;
      mode?: PresenceVerificationMode;
      verifiedByUserId?: string;
      verifiedByUserName?: string;
      notes?: string;
      orgId?: string;
    }
  ): Promise<string | null> {
    this.isSubmitting = true;
    this.lastError = null;

    try {
      const orgId = params.orgId || 'default';
      const mode = params.mode || params.verifiedBy || (params.targetLat && params.targetLng ? 'self_gps' : 'self_manual');
      let geoVerification: any = undefined;

      // Se richiesto GPS, cattura coordinate istantanee
      if (mode === 'self_gps' || mode === 'proximity_radar') {
        let coords = presenceRadar.currentCoords;
        if (!coords) {
          coords = await presenceRadar.requestImmediatePosition();
        }

        if (coords && params.targetLat !== undefined && params.targetLng !== undefined) {
          geoVerification = checkGeofenceProximity(
            params.targetLat,
            params.targetLng,
            params.radiusMeters || 50,
            coords.lat,
            coords.lng,
            coords.accuracy
          );
        }
      }

      const clientNow = new Date().toISOString();
      const rawPayload: Omit<PlacePresenceLog, 'id' | 'createdAt' | 'updatedAt'> = {
        orgId,
        placeId: params.placeId,
        placeName: params.placeName,
        placeCode: params.placeCode,
        parentId: params.parentId,
        parentName: params.parentName,
        activityId: params.activityId,
        activityName: params.activityName,
        teamId: params.teamId,
        teamName: params.teamName,
        userId: params.userId,
        userName: params.userName,
        userEmail: params.userEmail,
        verifiedBy: mode,
        verifiedByUserId: params.verifiedByUserId || params.userId,
        verifiedByUserName: params.verifiedByUserName || params.userName,
        geoVerification,
        clientEnteredAt: clientNow,
        status: 'active',
        isOfflineSync: !navigator.onLine,
        notes: params.notes
      };

      const payload = cleanUndefined(rawPayload);
      const newId = await this.repo.performSmartCheckIn(orgId, payload);

      // Aggiorna stato locale
      this.activePresence = {
        ...payload,
        id: newId,
        createdAt: clientNow,
        updatedAt: clientNow
      };

      return newId;
    } catch (e: any) {
      console.error('[PresenceStateManager] Errore check-in:', e);
      this.lastError = e?.message || 'Errore durante la registrazione del check-in';
      return null;
    } finally {
      this.isSubmitting = false;
    }
  }

  /**
   * Esegue il check-out del turno attivo
   */
  async checkOut(notes?: string, orgId: string = 'default'): Promise<boolean> {
    if (!this.activePresence) return false;
    this.isSubmitting = true;
    this.lastError = null;

    try {
      await this.repo.performCheckOut(
        orgId,
        this.activePresence.id,
        this.activePresence.userId,
        this.activePresence.clientEnteredAt,
        notes
      );

      this.activePresence = null;
      return true;
    } catch (e: any) {
      console.error('[PresenceStateManager] Errore check-out:', e);
      this.lastError = e?.message || 'Errore durante la registrazione del check-out';
      return false;
    } finally {
      this.isSubmitting = false;
    }
  }
}

export const presenceState = new PresenceStateManager();
