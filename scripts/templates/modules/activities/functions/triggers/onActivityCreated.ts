import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';
import * as logger from 'firebase-functions/logger';
import { isDerivedOnlyChange, logSyncError } from '../utils';

const REGION = 'europe-west3';

/**
 * Ricalcola simmetricamente e in-memory le statistiche di un cliente relative alle attività.
 * Garantisce il ciclo di vita reversibile: Azione ➔ Reversione = Stato 0 (Principio 7).
 * Utilizza ordinamento e deduzione date in-memory per evitare errori FAILED_PRECONDITION su indici Firestore mancanti.
 */
export async function recalculateClientActivityStats(
  db: admin.firestore.Firestore,
  clientId: string,
  _activityId?: string,
  _activityData?: any
): Promise<void> {
  if (!clientId) return;

  try {
    const clientRef = db.collection('clients').doc(clientId);
    const clientSnap = await clientRef.get();
    if (!clientSnap.exists) {
      return;
    }

    // 1. Scansiona le attività collegate (sia root collection che subcollection legacy)
    const [rootActivitiesByClientId, rootActivitiesByTargetId, subActivitiesSnap] = await Promise.all([
      db.collection('activities').where('clientId', '==', clientId).get(),
      db.collection('activities').where('targetId', '==', clientId).get(),
      db.collection('clients').doc(clientId).collection('activities').get()
    ]);

    const uniqueActivityMap = new Map<string, any>();

    const processDoc = (docSnap: admin.firestore.QueryDocumentSnapshot) => {
      const data = docSnap.data() || {};
      // Ignora le attività cancellate (soft delete)
      if (data.derived?.deleted || data.deleted) return;
      uniqueActivityMap.set(docSnap.id, data);
    };

    rootActivitiesByClientId.forEach(processDoc);
    rootActivitiesByTargetId.forEach(processDoc);
    subActivitiesSnap.forEach(processDoc);

    const activeActivities = Array.from(uniqueActivityMap.values());
    const activitiesCount = activeActivities.length;

    let lastActivityDate: string | null = null;

    if (activitiesCount > 0) {
      const validDates = activeActivities
        .map(a => a.edits?.createdAt || a.original?.date || a.scheduledDate || a.date || a.createdAt)
        .filter(Boolean)
        .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

      if (validDates.length > 0) {
        lastActivityDate = validDates[validDates.length - 1];
      }
    }

    // 2. Aggiornamento atomico dello stato derived del cliente
    await clientRef.update({
      'derived.activitiesCount': activitiesCount,
      'derived.lastActivityDate': lastActivityDate
    });

    logger.info(`[recalculateClientActivityStats] Client ${clientId} synced: count=${activitiesCount}, lastDate=${lastActivityDate}`);
  } catch (error: any) {
    logger.error(`[recalculateClientActivityStats] Error recalculating stats for client ${clientId}:`, error);
    throw error;
  }
}

export const onActivityCreated = onDocumentWritten(
  { region: REGION, document: '{path=**}/activities/{actId}' },
  async (event) => {
    const change = event.data;
    if (!change) return;

    const beforeData = change.before?.data();
    const afterData = change.after?.data();

    // 1. GUARDIA ANTI-LOOP: Ignora mutazioni limitate a soli campi derived (Principio 10)
    if (beforeData && afterData && isDerivedOnlyChange(beforeData, afterData)) {
      return;
    }

    const activityId = event.params.actId;
    const db = admin.firestore();

    // 2. Rileva tutti i clienti coinvolti (Dual-Client Recalculation per supporto cambio cliente)
    const clientIdsToSync = new Set<string>();

    // Client IDs da path (se subcollection)
    const rawParams = event.params as Record<string, string>;
    if (rawParams.clientId) {
      clientIdsToSync.add(rawParams.clientId);
    }

    // Client IDs da prima della mutazione
    if (beforeData) {
      if (beforeData.clientId) clientIdsToSync.add(beforeData.clientId);
      if (beforeData.targetType === 'client' && beforeData.targetId) clientIdsToSync.add(beforeData.targetId);
      if (beforeData.original?.clientId) clientIdsToSync.add(beforeData.original.clientId);
    }

    // Client IDs dopo la mutazione
    if (afterData) {
      if (afterData.clientId) clientIdsToSync.add(afterData.clientId);
      if (afterData.targetType === 'client' && afterData.targetId) clientIdsToSync.add(afterData.targetId);
      if (afterData.original?.clientId) clientIdsToSync.add(afterData.original.clientId);
    }

    if (clientIdsToSync.size === 0) return;

    try {
      for (const cId of clientIdsToSync) {
        await recalculateClientActivityStats(db, cId);
      }
      logger.info(`Successfully synced activity metrics on write for activity ${activityId}`);
    } catch (error: any) {
      logger.error(`Error in onActivityCreated (onDocumentWritten) for activity ${activityId}:`, error);
      await logSyncError(
        db,
        'onActivityCreated',
        activityId,
        `activities/${activityId}`,
        error.message,
        error.stack,
        { clientIds: Array.from(clientIdsToSync) }
      );
    }
  }
);

// Backward-compatible alias
export const runActivityCreated = recalculateClientActivityStats;
export const runActivityWrite = recalculateClientActivityStats;
export const onActivityWritten = onActivityCreated;
