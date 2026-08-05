import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import * as logger from 'firebase-functions/logger';

// Import all run functions from triggers
import { syncClientAndVendorStats } from './onContractCreated';
import { calculateCommission } from '../business-logic';
import { runContractsPaidCreated } from './onContractsPaidCreated';
import { runContractUpdated } from './onContractUpdated';
import { runActivityWrite } from './onActivityCreated';
import { runInstallmentWrite } from './onInstallmentWrite';
import { runPaymentCreated } from './onPaymentCreated';

const REGION = 'europe-west3';

export const retryFailedSyncs = onCall(
  { region: REGION },
  async (request) => {
    // 1. Authorization checks
    const auth = request.auth;
    if (!auth) {
      throw new HttpsError('unauthenticated', 'L\'utente deve essere autenticato.');
    }

    const db = admin.firestore();

    try {
      const userSnap = await db.collection('users').doc(auth.uid).get();
      if (!userSnap.exists) {
        throw new HttpsError('permission-denied', 'Utente non trovato nel database.');
      }
      const roles = userSnap.data()?.original?.roles || [];
      const hasAccess = roles.includes('superadmin') || roles.includes('amministrazione') || roles.includes('direzione');
      if (!hasAccess) {
        throw new HttpsError('permission-denied', 'Permessi insufficienti.');
      }

      // 2. Fetch pending errors
      const errorsSnap = await db
        .collection('sync_errors')
        .where('original.status', '==', 'pending')
        .get();

      let resolvedCount = 0;
      let failedCount = 0;

      for (const errDoc of errorsSnap.docs) {
        const errorId = errDoc.id;
        const errData = errDoc.data()?.original || {};
        const triggerName = errData.triggerName || '';
        const documentId = errData.documentId || '';
        const metadata = errData.metadata || {};
        const currentAttempts = errData.attempts || 1;

        try {
          logger.info(`Retrying sync for error ${errorId} (trigger: ${triggerName}, docId: ${documentId})`);

          // Route to the correct execution function
          if (triggerName === 'onContractCreated') {
            const docSnap = await db.collection('contracts').doc(documentId).get();
            if (docSnap.exists) {
              const data = docSnap.data() || {};
              const original = data.original || {};
              const vendorUid = original.vendorUid;
              const secondVendorUid = original.secondVendorUid;
              const clientId = original.clientId;
              
              if (vendorUid) {
                const vendorSnap = await db.collection('users').doc(vendorUid).get();
                const qualificationId = vendorSnap.data()?.original?.qualification;
                let qualification = null;
                if (qualificationId) {
                  const qualSnap = await db.collection('qualifications').doc(qualificationId).get();
                  if (qualSnap.exists) {
                    qualification = qualSnap.data();
                  }
                }
                const products = original.products || [];
                const secondVendorShare = original.secondVendorShare || 0;
                const commission = calculateCommission(products, qualification as any, secondVendorShare);

                await db.collection('contracts').doc(documentId).update({
                  'derived.commissionTotal': commission.total,
                  'derived.commissionPrimary': commission.primary,
                  'derived.commissionSecondary': commission.secondary
                });
              }

              if (clientId) {
                const vendors = [];
                if (vendorUid) vendors.push(vendorUid);
                if (secondVendorUid) vendors.push(secondVendorUid);
                await syncClientAndVendorStats(db, clientId, vendors);
              }
            } else {
              logger.warn(`Contract ${documentId} no longer exists, resolving error anyway.`);
            }
          } else if (triggerName === 'onContractsPaidCreated') {
            const { paymentId, contractId } = metadata;
            if (paymentId && contractId) {
              await runContractsPaidCreated(db, paymentId, contractId);
            } else {
              throw new Error('Missing paymentId or contractId in metadata');
            }
          } else if (triggerName === 'onContractUpdated') {
            await runContractUpdated(db, documentId);
          } else if (triggerName === 'onActivityCreated') {
            const { clientId, activityId } = metadata;
            if (clientId && activityId) {
              const docSnap = await db
                .collection('clients')
                .doc(clientId)
                .collection('activities')
                .doc(activityId)
                .get();
              if (docSnap.exists) {
                await runActivityWrite(db, clientId, activityId, docSnap.data());
              } else {
                logger.warn(`Activity ${activityId} no longer exists, resolving error anyway.`);
              }
            } else {
              throw new Error('Missing clientId or activityId in metadata');
            }
          } else if (triggerName === 'onInstallmentWrite') {
            const { contractId } = metadata;
            if (contractId) {
              await runInstallmentWrite(db, contractId);
            } else {
              throw new Error('Missing contractId in metadata');
            }
          } else if (triggerName === 'onPaymentCreated') {
            const docSnap = await db.collection('payments').doc(documentId).get();
            if (docSnap.exists) {
              await runPaymentCreated(db, documentId, docSnap.data());
            } else {
              logger.warn(`Payment ${documentId} no longer exists, resolving error anyway.`);
            }
          } else {
            throw new Error(`Unknown triggerName: ${triggerName}`);
          }

          // If execution succeeded, mark as resolved
          await db.collection('sync_errors').doc(errorId).update({
            'original.status': 'resolved',
            'original.attempts': currentAttempts + 1,
            'original.resolvedAt': new Date().toISOString(),
            'edits.modifiedAt': new Date().toISOString(),
            'edits.modifiedBy': auth.uid
          });
          resolvedCount++;

        } catch (execErr: any) {
          logger.error(`Retry attempt failed for error ${errorId}:`, execErr);
          
          const nextAttempts = currentAttempts + 1;
          const status = nextAttempts >= 5 ? 'failed' : 'pending';

          await db.collection('sync_errors').doc(errorId).update({
            'original.attempts': nextAttempts,
            'original.status': status,
            'original.errorMessage': execErr.message || 'Unknown error',
            'original.stack': execErr.stack || '',
            'original.lastAttemptAt': new Date().toISOString(),
            'edits.modifiedAt': new Date().toISOString()
          });
          failedCount++;
        }
      }

      return {
        status: 'success',
        processed: errorsSnap.size,
        resolvedCount,
        failedCount
      };

    } catch (e: any) {
      logger.error('Error in retryFailedSyncs:', e);
      throw new HttpsError('internal', e.message || 'Errore interno durante il retry.');
    }
  }
);
