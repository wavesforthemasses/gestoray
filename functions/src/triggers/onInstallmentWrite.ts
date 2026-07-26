import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';
import * as logger from 'firebase-functions/logger';
import { isDerivedOnlyChange, logSyncError } from '../utils';

const REGION = 'europe-west3';

export async function runInstallmentWrite(
  db: admin.firestore.Firestore,
  contractId: string
) {
  // 1. Fetch all installments for this contract
  const installmentsSnap = await db
    .collection('contracts')
    .doc(contractId)
    .collection('installments')
    .get();

  let installmentsCount = 0;
  let paidInstallmentsCount = 0;
  let overdueInstallmentsCount = 0;
  let nextInstallmentDate: string | null = null;
  let nextInstallmentAmount: number | null = null;

  const todayStr = new Date().toISOString().split('T')[0];

  installmentsSnap.forEach((docSnap) => {
    const inst = docSnap.data()?.original || {};
    const status = inst.status || 'pending';
    const dueDate = inst.dueDate || '';
    const amount = inst.expectedAmount || 0;

    installmentsCount += 1;

    if (status === 'paid') {
      paidInstallmentsCount += 1;
    } else {
      // Status is pending
      if (dueDate && dueDate < todayStr) {
        overdueInstallmentsCount += 1;
      }

      if (dueDate) {
        if (!nextInstallmentDate || dueDate < nextInstallmentDate) {
          nextInstallmentDate = dueDate;
          nextInstallmentAmount = amount;
        }
      }
    }
  });

  // 2. Update parent contract document
  const contractRef = db.collection('contracts').doc(contractId);
  await contractRef.update({
    'derived.installmentsCount': installmentsCount,
    'derived.paidInstallmentsCount': paidInstallmentsCount,
    'derived.overdueInstallmentsCount': overdueInstallmentsCount,
    'derived.nextInstallmentDate': nextInstallmentDate,
    'derived.nextInstallmentAmount': nextInstallmentAmount
  });
}

export const onInstallmentWrite = onDocumentWritten(
  { region: REGION, document: 'contracts/{contractId}/installments/{instId}' },
  async (event) => {
    const change = event.data;
    if (!change) return;

    const before = change.before.data();
    const after = change.after.data();

    // Guard: ignore if it's only derived field update
    if (before && after && isDerivedOnlyChange(before, after)) return;

    const contractId = event.params.contractId;
    const instId = event.params.instId;
    const db = admin.firestore();

    try {
      await runInstallmentWrite(db, contractId);
      logger.info(`Successfully updated installments metrics for contract ${contractId}`);
    } catch (error: any) {
      logger.error(`Error in onInstallmentWrite for contract ${contractId}:`, error);
      await logSyncError(
        db,
        'onInstallmentWrite',
        instId,
        `contracts/${contractId}/installments/${instId}`,
        error.message,
        error.stack,
        { contractId, instId }
      );
    }
  }
);
