import {
  collection,
  doc,
  query,
  where,
  getDoc,
  getDocs,
  limit,
  runTransaction,
  type Firestore
} from 'firebase/firestore';
import type { PlacePresenceLog, UserActivePresenceSlot } from '../../domain/models/presence';
import { resolveVirtualPresenceLog } from '../../domain/services/presenceUtils';
import { cleanUndefined } from '$lib/utils/helpers';

export class PresenceFirestoreRepository {
  constructor(private db: Firestore) {}

  /**
   * Recupera in modo sicuro le attività e i luoghi di oggi per l'utente,
   * rispettando il limite Firestore di 30 item su array-contains-any.
   */
  async fetchTodayRelevantActivities(
    orgId: string,
    userId: string,
    userTeamIds: string[],
    todayDateStr: string
  ): Promise<any[]> {
    const allFilterKeys = [
      `u:${userId}`,
      ...userTeamIds.map(tId => `t:${tId}`)
    ];

    const CHUNK_SIZE = 30;
    const chunks: string[][] = [];
    for (let i = 0; i < allFilterKeys.length; i += CHUNK_SIZE) {
      chunks.push(allFilterKeys.slice(i, i + CHUNK_SIZE));
    }

    const activitiesCol = collection(this.db, 'activities');
    
    // Esecuzione parallela protetta dei chunk
    const promises = chunks.map(chunk => {
      const q = query(
        activitiesCol,
        where('scheduledDate', '==', todayDateStr),
        where('assigneeFilterKeys', 'array-contains-any', chunk)
      );
      return getDocs(q);
    });

    const snapshots = await Promise.all(promises);
    const activityMap = new Map<string, any>();

    for (const snap of snapshots) {
      for (const d of snap.docs) {
        if (!activityMap.has(d.id)) {
          activityMap.set(d.id, { id: d.id, ...d.data() });
        }
      }
    }

    return Array.from(activityMap.values());
  }

  /**
   * Esegue il check-in in transazione atomica con lock O(1) deterministico:
   * 1. Legge il puntatore slot in /user_active_presences/{userId}
   * 2. Se esiste una sessione attiva precedente, la chiude automaticamente
   * 3. Crea il nuovo documento place_presences
   * 4. Aggiorna il puntatore slot
   */
  async performSmartCheckIn(
    orgId: string,
    data: Omit<PlacePresenceLog, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<string> {
    return await runTransaction(this.db, async (tx) => {
      const slotRef = doc(this.db, 'user_active_presences', data.userId);
      const presencesCol = collection(this.db, 'place_presences');
      const newLogRef = doc(presencesCol);
      const nowIso = new Date().toISOString();

      // 1. Lettura atomica del lock di sessione attiva
      const slotSnap = await tx.get(slotRef);

      if (slotSnap.exists()) {
        const slotData = slotSnap.data() as UserActivePresenceSlot;
        if (slotData.activeLogId) {
          const prevLogRef = doc(this.db, 'place_presences', slotData.activeLogId);
          const prevLogSnap = await tx.get(prevLogRef);

          if (prevLogSnap.exists() && prevLogSnap.data()?.status === 'active') {
            const prev = prevLogSnap.data() as PlacePresenceLog;
            const enterTime = new Date(prev.clientEnteredAt).getTime();
            const exitTime = new Date(nowIso).getTime();
            const durationMin = Math.max(1, Math.round((exitTime - enterTime) / 60000));

            tx.update(prevLogRef, cleanUndefined({
              status: 'completed',
              clientLeftAt: nowIso,
              durationMinutes: durationMin,
              updatedAt: nowIso,
              notes: (prev.notes ? prev.notes + ' • ' : '') + 'Chiusura automatica per nuovo check-in'
            }));
          }
        }
      }

      // 2. Crea il nuovo log di presenza
      tx.set(newLogRef, cleanUndefined({
        ...data,
        id: newLogRef.id,
        status: 'active',
        createdAt: nowIso,
        updatedAt: nowIso
      }));

      // 3. Aggiorna il puntatore di sessione attiva
      tx.set(slotRef, cleanUndefined({
        activeLogId: newLogRef.id,
        placeId: data.placeId,
        placeName: data.placeName,
        clientEnteredAt: data.clientEnteredAt,
        activityId: data.activityId || '',
        activityName: data.activityName || '',
        updatedAt: nowIso
      }));

      return newLogRef.id;
    });
  }

  /**
   * Esegue il check-out regolare dell'utente e libera lo slot attivo.
   */
  async performCheckOut(
    orgId: string,
    logId: string,
    userId: string,
    clientEnteredAt: string,
    notes?: string
  ): Promise<void> {
    const logRef = doc(this.db, 'place_presences', logId);
    const slotRef = doc(this.db, 'user_active_presences', userId);
    const nowIso = new Date().toISOString();
    const enterTime = new Date(clientEnteredAt).getTime();
    const durationMin = Math.max(1, Math.round((new Date(nowIso).getTime() - enterTime) / 60000));

    await runTransaction(this.db, async (tx) => {
      tx.update(logRef, cleanUndefined({
        status: 'completed',
        clientLeftAt: nowIso,
        durationMinutes: durationMin,
        updatedAt: nowIso,
        ...(notes ? { notes } : {})
      }));

      // Rilascia o aggiorna lo slot
      tx.delete(slotRef);
    });
  }

  /**
   * Recupera la presenza attiva corrente dell'utente (se esiste).
   */
  async getActivePresenceForUser(orgId: string, userId: string): Promise<PlacePresenceLog | null> {
    try {
      const slotRef = doc(this.db, 'user_active_presences', userId);
      const slotSnap = await getDoc(slotRef);
      if (!slotSnap.exists()) return null;

      const slotData = slotSnap.data() as UserActivePresenceSlot;
      if (!slotData.activeLogId) return null;

      const logRef = doc(this.db, 'place_presences', slotData.activeLogId);
      const logSnap = await getDoc(logRef);
      if (!logSnap.exists()) return null;

      const log = logSnap.data() as PlacePresenceLog;
      return resolveVirtualPresenceLog(log);
    } catch (e) {
      console.warn('[PresenceFirestoreRepository] Errore getActivePresenceForUser:', e);
      return null;
    }
  }

  /**
   * Recupera le presenze per un determinato luogo (attive e storiche recenti).
   */
  async getPresencesForPlace(orgId: string, placeId: string, limitCount = 50): Promise<PlacePresenceLog[]> {
    try {
      const presencesCol = collection(this.db, 'place_presences');
      const q = query(
        presencesCol,
        where('placeId', '==', placeId),
        limit(limitCount)
      );

      const snap = await getDocs(q);
      const logs = snap.docs.map(d => resolveVirtualPresenceLog(d.data() as PlacePresenceLog));
      // Ordinamento client-side per data decrescente
      return logs.sort((a, b) => new Date(b.clientEnteredAt).getTime() - new Date(a.clientEnteredAt).getTime());
    } catch (e) {
      console.warn('[PresenceFirestoreRepository] Errore getPresencesForPlace:', e);
      return [];
    }
  }
}
