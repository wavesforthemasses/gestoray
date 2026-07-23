import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';
import * as logger from 'firebase-functions/logger';

const REGION = 'europe-west3';

export async function runContractUpdated(
  db: admin.firestore.Firestore,
  contractId: string
) {
  // Deprecated: onContractCreated (onDocumentWritten) now handles all contract updates and synchronizations.
  logger.info(`runContractUpdated called for contract ${contractId} (deprecated no-op)`);
}

export const onContractUpdated = onDocumentUpdated(
  { region: REGION, document: 'contracts/{contractId}' },
  async (event) => {
    // Deprecated: handled by the onDocumentWritten trigger in onContractCreated
    logger.info(`onContractUpdated triggered for contract ${event.params.contractId} (deprecated no-op)`);
  }
);
