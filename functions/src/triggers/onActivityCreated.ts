import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';
import * as logger from 'firebase-functions/logger';
import { logSyncError, dateToInt } from '../utils';

const REGION = 'europe-west3';

export async function runActivityWrite(
  db: admin.firestore.Firestore,
  clientId: string
) {
  const clientRef = db.collection('clients').doc(clientId);
  const activitiesSnap = await clientRef.collection('activities').get();

  let activitiesCount = 0;
  let lastActivityDate: string | null = null;

  activitiesSnap.forEach((docSnap) => {
    const act = docSnap.data() || {};
    const actDate = act.edits?.createdAt || act.original?.date || act.original?.createdAt || '';
    activitiesCount++;

    if (actDate) {
      if (!lastActivityDate || new Date(actDate) > new Date(lastActivityDate)) {
        lastActivityDate = actDate;
      }
    }
  });

  const lastActivityDateInt = dateToInt(lastActivityDate);

  // Avoid unnecessary writes if metrics haven't changed to prevent trigger cascades
  const clientSnap = await clientRef.get();
  const currentDerived = clientSnap.data()?.derived || {};
  if (
    currentDerived.activitiesCount === activitiesCount &&
    currentDerived.lastActivityDate === lastActivityDate &&
    currentDerived.lastActivityDateInt === lastActivityDateInt
  ) {
    return;
  }

  await clientRef.update({
    'derived.activitiesCount': activitiesCount,
    'derived.lastActivityDate': lastActivityDate,
    'derived.lastActivityDateInt': lastActivityDateInt
  });
}


export const onActivityCreated = onDocumentWritten(
  { region: REGION, document: 'clients/{clientId}/activities/{actId}' },
  async (event) => {
    const change = event.data;
    if (!change) return;

    const clientId = event.params.clientId;
    const activityId = event.params.actId;
    const db = admin.firestore();

    try {
      await runActivityWrite(db, clientId);
      logger.info(`Successfully synced activity metrics for client ${clientId}`);
    } catch (error: any) {
      logger.error(`Error in onActivityCreated for client ${clientId}:`, error);
      await logSyncError(
        db,
        'onActivityCreated',
        activityId,
        `clients/${clientId}/activities/${activityId}`,
        error.message,
        error.stack,
        { clientId }
      );
    }
  }
);
