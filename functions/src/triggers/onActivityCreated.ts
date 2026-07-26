import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';
import * as logger from 'firebase-functions/logger';
import { logSyncError } from '../utils';

const REGION = 'europe-west3';

export async function runActivityCreated(
  db: admin.firestore.Firestore,
  clientId: string,
  activityId: string,
  activityData: any
) {
  const activityDate = activityData.edits?.createdAt || activityData.original?.date || new Date().toISOString();
  const clientRef = db.collection('clients').doc(clientId);

  await db.runTransaction(async (transaction) => {
    const clientSnap = await transaction.get(clientRef);
    if (!clientSnap.exists) {
      logger.error(`Client ${clientId} does not exist`);
      return;
    }

    const clientData = clientSnap.data() || {};
    const currentDerived = clientData.derived || {};
    const lastActDate = currentDerived.lastActivityDate || '';

    const newLastActDate = (!lastActDate || new Date(activityDate) > new Date(lastActDate))
      ? activityDate
      : lastActDate;

    transaction.update(clientRef, {
      'derived.activitiesCount': admin.firestore.FieldValue.increment(1),
      'derived.lastActivityDate': newLastActDate
    });
  });
}

export const onActivityCreated = onDocumentCreated(
  { region: REGION, document: 'clients/{clientId}/activities/{actId}' },
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const clientId = event.params.clientId;
    const activityId = event.params.actId;
    const db = admin.firestore();

    try {
      await runActivityCreated(db, clientId, activityId, snap.data());
      logger.info(`Successfully updated activity derived fields for client ${clientId}`);
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
