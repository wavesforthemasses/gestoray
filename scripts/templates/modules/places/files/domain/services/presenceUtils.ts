import type { PlacePresenceLog, PlacePresenceGeoVerification } from '../models/presence';
import { haversineDistanceMeters } from './placeUtils';

/**
 * Verifica se una coordinata GPS si trova all'interno del geofence di un luogo,
 * tenendo conto della tolleranza d'errore strumentale del GPS (default 25 metri).
 */
export function checkGeofenceProximity(
  targetLat: number,
  targetLng: number,
  radiusMeters: number,
  currentLat: number,
  currentLng: number,
  currentAccuracyMeters: number = 0,
  gpsToleranceMeters: number = 25
): PlacePresenceGeoVerification {
  const distance = haversineDistanceMeters(targetLat, targetLng, currentLat, currentLng);
  // La tolleranza include l'accuratezza del sensore (se affidabile) o il valore fisso configurato
  const effectiveTolerance = Math.max(gpsToleranceMeters, Math.min(currentAccuracyMeters, 50));
  const isWithin = distance <= (radiusMeters + effectiveTolerance);

  return {
    latitude: currentLat,
    longitude: currentLng,
    accuracyMeters: Math.round(currentAccuracyMeters),
    distanceFromCenterMeters: Math.round(distance),
    isWithinRadius: isWithin,
    geofenceRadiusMeters: radiusMeters
  };
}

/**
 * Calcola l'uscita da un luogo applicando una soglia di isteresi (default +35 metri).
 * Previene il flapping ai bordi del geofence.
 */
export function isOutsidePlaceWithHysteresis(
  targetLat: number,
  targetLng: number,
  radiusMeters: number,
  currentLat: number,
  currentLng: number,
  hysteresisMeters: number = 35
): boolean {
  const dist = haversineDistanceMeters(targetLat, targetLng, currentLat, currentLng);
  return dist > (radiusMeters + hysteresisMeters);
}

/**
 * Calcola virtualmente lo stato del log durante la lettura / visualizzazione UI.
 * Se il turno è 'active' ma sono passati più di 60 min dalla fine prevista,
 * restituisce un oggetto arricchito con status 'auto_closed' e durata calcolata (Zero-Cost Cloud Functions).
 */
export function resolveVirtualPresenceLog(
  log: PlacePresenceLog,
  scheduledDurationMinutes: number = 480,
  autoCloseGraceMinutes: number = 60
): PlacePresenceLog {
  if (log.status !== 'active') return log;

  const now = Date.now();
  const enteredTime = new Date(log.clientEnteredAt).getTime();
  if (isNaN(enteredTime)) return log;

  const maxShiftMs = scheduledDurationMinutes * 60 * 1000;
  const gracePeriodMs = autoCloseGraceMinutes * 60 * 1000;

  if (now > (enteredTime + maxShiftMs + gracePeriodMs)) {
    const calculatedLeftAt = new Date(enteredTime + maxShiftMs).toISOString();

    return {
      ...log,
      status: 'auto_closed',
      clientLeftAt: calculatedLeftAt,
      durationMinutes: scheduledDurationMinutes,
      isEstimatedClosing: true,
      notes: (log.notes ? log.notes + ' • ' : '') + 'Chiusura automatica stimata dal sistema'
    };
  }

  return log;
}

/**
 * Genera l'array unificato di chiavi di filtro per la query atomica a 1 singola lettura.
 * Esplode in modo trasparente gli utenti e i team assegnati.
 * Output: ['u:usr_123', 't:team_muratori', 't:team_finiture']
 */
export function deriveAssigneeFilterKeys(activity: {
  assignedEntities?: Array<{ entityType: string; entityId: string }>;
  assignedUid?: string;
  assignedTeamIds?: string[];
  assignedUserIds?: string[];
}): string[] {
  const keys = new Set<string>();

  // 1. Da assignedEntities
  if (Array.isArray(activity.assignedEntities)) {
    for (const entity of activity.assignedEntities) {
      if (entity && entity.entityId) {
        if (entity.entityType === 'user') {
          keys.add(`u:${entity.entityId}`);
        } else if (entity.entityType === 'team') {
          keys.add(`t:${entity.entityId}`);
        }
      }
    }
  }

  // 2. Da array dedicati (se presenti)
  if (Array.isArray(activity.assignedUserIds)) {
    for (const uId of activity.assignedUserIds) {
      if (uId) keys.add(`u:${uId}`);
    }
  }

  if (Array.isArray(activity.assignedTeamIds)) {
    for (const tId of activity.assignedTeamIds) {
      if (tId) keys.add(`t:${tId}`);
    }
  }

  // 3. Fallback legacy
  if (activity.assignedUid) {
    keys.add(`u:${activity.assignedUid}`);
  }

  return Array.from(keys);
}

/**
 * Formatta i minuti di durata in formato leggibile "Xh Ym"
 */
export function formatMinutesDuration(minutes?: number): string {
  if (minutes === undefined || minutes === null || isNaN(minutes) || minutes < 0) {
    return '0m';
  }
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
