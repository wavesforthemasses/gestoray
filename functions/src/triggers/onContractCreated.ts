import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';
import * as logger from 'firebase-functions/logger';
import { calculateCommission } from '../business-logic';
import { isDerivedOnlyChange, logSyncError } from '../utils';

const REGION = 'europe-west3';

// Recalculates client and vendor stats from scratch for a given clientId/vendorId to ensure 100% accuracy.
// This is the ultimate "self-healing" state sync pattern.
export async function syncClientAndVendorStats(
  db: admin.firestore.Firestore,
  clientId: string,
  vendorUids: string[]
) {
  // 1. Fetch all contracts for the client
  const clientContractsSnap = await db
    .collection('contracts')
    .where('original.clientId', '==', clientId)
    .get();

  let contractsCount = 0;
  let approvedContractsCount = 0;
  let totalContractValue = 0;
  let clientTotalPaid = 0;
  let clientTotalRemaining = 0;
  const approvedContracts: any[] = [];

  clientContractsSnap.forEach((docSnap) => {
    const cData = docSnap.data() || {};
    const orig = cData.original || {};
    const status = orig.status || 'pending';

    if (status !== 'cancelled') {
      contractsCount++;
      totalContractValue += orig.totalPrice || 0;
      clientTotalPaid += cData.derived?.totalPaid || 0;
      clientTotalRemaining += cData.derived?.totalRemaining || 0;
    }

    if (status === 'approved') {
      approvedContractsCount++;
      approvedContracts.push({
        id: docSnap.id,
        createdAt: cData.edits?.createdAt || orig.createdAt || new Date().toISOString()
      });
    }
  });

  // Sort approved contracts to find NNCF (New Novel Customer First) date
  let nncfDate = null;
  let nncfOrderId = null;
  if (approvedContracts.length > 0) {
    approvedContracts.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    nncfDate = approvedContracts[0].createdAt;
    nncfOrderId = approvedContracts[0].id;
  }

  // Update client
  const clientRef = db.collection('clients').doc(clientId);
  await clientRef.update({
    'original.status': approvedContractsCount > 0 ? 'customer' : 'prospect',
    'derived.contractsCount': contractsCount,
    'derived.approvedContractsCount': approvedContractsCount,
    'derived.totalContractValue': totalContractValue,
    'derived.totalPaid': clientTotalPaid,
    'derived.totalRemaining': clientTotalRemaining,
    'derived.nncfDate': nncfDate,
    'derived.nncfOrderId': nncfOrderId
  });

  // 2. Fetch and sync stats for each affected vendor
  for (const uid of vendorUids) {
    if (!uid) continue;

    const vendorContractsSnap = await db
      .collection('contracts')
      .where('original.vendorUid', '==', uid)
      .get();

    const vendorCoContractsSnap = await db
      .collection('contracts')
      .where('original.secondVendorUid', '==', uid)
      .get();

    let totalContractsCount = 0;
    let totalPendingSales = 0;
    let totalApprovedSales = 0;
    let totalCommissionPending = 0;
    let totalCommissionEarned = 0;

    const processContract = (cData: any) => {
      const orig = cData.original || {};
      const deriv = cData.derived || {};
      const status = orig.status || 'pending';

      if (status === 'cancelled') return;

      totalContractsCount++;

      const isPrimary = orig.vendorUid === uid;
      const secondShare = orig.secondVendorShare || 0;
      const primaryShare = 100 - secondShare;
      const share = isPrimary ? primaryShare : secondShare;
      const sale = ((orig.totalPrice || 0) * share) / 100;

      const comm = isPrimary ? (deriv.commissionPrimary || 0) : (deriv.commissionSecondary || 0);

      if (status === 'approved') {
        totalApprovedSales += sale;
        totalCommissionEarned += comm;
      } else {
        totalPendingSales += sale;
        totalCommissionPending += comm;
      }
    };

    vendorContractsSnap.forEach((docSnap) => processContract(docSnap.data()));
    vendorCoContractsSnap.forEach((docSnap) => processContract(docSnap.data()));

    const vendorRef = db.collection('users').doc(uid);
    await vendorRef.update({
      'derived.totalContractsCount': totalContractsCount,
      'derived.totalPendingSales': totalPendingSales,
      'derived.totalApprovedSales': totalApprovedSales,
      'derived.totalCommissionPending': totalCommissionPending,
      'derived.totalCommissionEarned': totalCommissionEarned
    });
  }
}

export const onContractCreated = onDocumentWritten(
  { region: REGION, document: 'contracts/{contractId}' },
  async (event) => {
    const contractId = event.params.contractId;
    const db = admin.firestore();

    const beforeDoc = event.data?.before;
    const afterDoc = event.data?.after;

    const beforeData = beforeDoc?.data();
    const afterData = afterDoc?.data();

    // Guard: ignora mutazioni che riguardano esclusivamente campi calcolati derived.* (Principio 10 Anti-Loop)
    if (beforeData && afterData && isDerivedOnlyChange(beforeData, afterData)) {
      return;
    }

    // Collect all vendor UIDs and clientIds affected by this change (both old and new values)
    const clientIds = new Set<string>();
    const vendorUids = new Set<string>();

    if (beforeData?.original) {
      if (beforeData.original.clientId) clientIds.add(beforeData.original.clientId);
      if (beforeData.original.vendorUid) vendorUids.add(beforeData.original.vendorUid);
      if (beforeData.original.secondVendorUid) vendorUids.add(beforeData.original.secondVendorUid);
    }
    if (afterData?.original) {
      if (afterData.original.clientId) clientIds.add(afterData.original.clientId);
      if (afterData.original.vendorUid) vendorUids.add(afterData.original.vendorUid);
      if (afterData.original.secondVendorUid) vendorUids.add(afterData.original.secondVendorUid);
    }

    try {
      // 1. If it was created, calculate initial derived fields for the contract document itself
      if (afterDoc?.exists && !beforeDoc?.exists) {
        const original = (afterData && afterData.original) || {};
        const { vendorUid, products = [], secondVendorShare = 0 } = original;

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
          const commission = calculateCommission(products, qualification as any, secondVendorShare);

          await db.collection('contracts').doc(contractId).update({
            'derived.totalPaid': 0,
            'derived.totalRemaining': original.totalPrice || 0,
            'derived.paymentsCount': 0,
            'derived.installmentsCount': 0,
            'derived.commissionTotal': commission.total,
            'derived.commissionPrimary': commission.primary,
            'derived.commissionSecondary': commission.secondary
          });
        }
      }

      // 2. Perform self-healing sync for client and vendor aggregations
      for (const clientId of clientIds) {
        await syncClientAndVendorStats(db, clientId, Array.from(vendorUids));
      }

      logger.info(`Successfully synced stats on write/delete/update for contract ${contractId}`);
    } catch (error: any) {
      logger.error(`Error in onContractCreated trigger for contract ${contractId}:`, error);
      await logSyncError(
        db,
        'onContractCreated',
        contractId,
        `contracts/${contractId}`,
        error.message,
        error.stack
      );
    }
  }
);
