import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';
import * as logger from 'firebase-functions/logger';
import { logSyncError } from '../utils';

const REGION = 'europe-west3';

export async function runPaymentCreated(
  db: admin.firestore.Firestore,
  paymentId: string,
  paymentData: any
) {
  const amount = paymentData.original?.amount || 0;
  const paymentRef = db.collection('payments').doc(paymentId);
  await paymentRef.update({
    'derived.distributedAmount': 0,
    'derived.remainingToDistribute': amount
  });
}

export const onPaymentCreated = onDocumentCreated(
  { region: REGION, document: 'payments/{paymentId}' },
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const paymentId = event.params.paymentId;
    const db = admin.firestore();

    try {
      await runPaymentCreated(db, paymentId, snap.data());
      logger.info(`Successfully initialized derived fields for payment ${paymentId}`);
    } catch (error: any) {
      logger.error(`Error in onPaymentCreated for payment ${paymentId}:`, error);
      await logSyncError(
        db,
        'onPaymentCreated',
        paymentId,
        `payments/${paymentId}`,
        error.message,
        error.stack
      );
    }
  }
);
