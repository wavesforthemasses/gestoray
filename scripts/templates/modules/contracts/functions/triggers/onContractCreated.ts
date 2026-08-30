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
  // 1. Fetch all contracts for the client (dual check: root clientId or original.clientId)
  const [snapRoot, snapOrig] = await Promise.all([
    db.collection('contracts').where('clientId', '==', clientId).get(),
    db.collection('contracts').where('original.clientId', '==', clientId).get()
  ]);

  const contractDocsMap = new Map<string, FirebaseFirestore.DocumentData>();
  snapRoot.forEach(d => contractDocsMap.set(d.id, d.data()));
  snapOrig.forEach(d => contractDocsMap.set(d.id, d.data()));

  let contractsCount = 0;
  let approvedContractsCount = 0;
  let totalContractValue = 0;
  let clientTotalPaid = 0;
  let clientTotalRemaining = 0;
  const approvedContracts: any[] = [];

  contractDocsMap.forEach((cData, docId) => {
    if (cData.derived?.deleted) return;

    const orig = cData.original || {};
    const status = cData.status || orig.status || 'pending';
    const totalAmount = Number(cData.totalAmount ?? orig.totalPrice ?? 0);

    if (status !== 'cancelled' && status !== 'rifiutato') {
      contractsCount++;
      totalContractValue += totalAmount;
      clientTotalPaid += cData.derived?.totalPaid || 0;
      clientTotalRemaining += cData.derived?.totalRemaining || 0;
    }

    if (status === 'approved' || status === 'approvato' || status === 'attivo') {
      approvedContractsCount++;
      approvedContracts.push({
        id: docId,
        createdAt: cData.createdAt || cData.edits?.createdAt || orig.createdAt || new Date().toISOString()
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
  const clientSnap = await clientRef.get();
  if (clientSnap.exists) {
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
  }

  // 2. Fetch and sync stats for each affected vendor
  for (const uid of vendorUids) {
    if (!uid) continue;

    const [vRoot, vOrig, vCoRoot, vCoOrig] = await Promise.all([
      db.collection('contracts').where('agentId', '==', uid).get(),
      db.collection('contracts').where('original.vendorUid', '==', uid).get(),
      db.collection('contracts').where('coSellerUid', '==', uid).get(),
      db.collection('contracts').where('original.secondVendorUid', '==', uid).get()
    ]);

    const vendorDocsMap = new Map<string, FirebaseFirestore.DocumentData>();
    vRoot.forEach(d => vendorDocsMap.set(d.id, d.data()));
    vOrig.forEach(d => vendorDocsMap.set(d.id, d.data()));
    vCoRoot.forEach(d => vendorDocsMap.set(d.id, d.data()));
    vCoOrig.forEach(d => vendorDocsMap.set(d.id, d.data()));

    let totalContractsCount = 0;
    let totalPendingSales = 0;
    let totalApprovedSales = 0;
    let totalCommissionPending = 0;
    let totalCommissionEarned = 0;

    vendorDocsMap.forEach((cData) => {
      if (cData.derived?.deleted) return;

      const orig = cData.original || {};
      const deriv = cData.derived || {};
      const status = cData.status || orig.status || 'pending';

      if (status === 'cancelled' || status === 'rifiutato') return;

      totalContractsCount++;

      const isPrimary = (cData.agentId === uid) || (orig.vendorUid === uid);
      const secondShare = Number(cData.coSellerShare ?? orig.secondVendorShare ?? 0);
      const primaryShare = 100 - secondShare;
      const share = isPrimary ? primaryShare : secondShare;
      const totalAmt = Number(cData.totalAmount ?? orig.totalPrice ?? 0);
      const sale = (totalAmt * share) / 100;

      const comm = isPrimary ? (deriv.commissionPrimary || 0) : (deriv.commissionSecondary || 0);

      if (status === 'approved' || status === 'approvato' || status === 'attivo') {
        totalApprovedSales += sale;
        totalCommissionEarned += comm;
      } else {
        totalPendingSales += sale;
        totalCommissionPending += comm;
      }
    });

    const vendorRef = db.collection('users').doc(uid);
    const vendorSnap = await vendorRef.get();
    if (vendorSnap.exists) {
      await vendorRef.update({
        'derived.totalContractsCount': totalContractsCount,
        'derived.totalPendingSales': totalPendingSales,
        'derived.totalApprovedSales': totalApprovedSales,
        'derived.totalCommissionPending': totalCommissionPending,
        'derived.totalCommissionEarned': totalCommissionEarned
      });
    }
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

    // Guard: ignora mutazioni che riguardano esclusivamente campi calcolati derived.* (Anti-Loop)
    if (beforeData && afterData && isDerivedOnlyChange(beforeData, afterData)) {
      return;
    }

    // Collect all vendor UIDs and clientIds affected by this change
    const clientIds = new Set<string>();
    const vendorUids = new Set<string>();

    const extractRefs = (data: any) => {
      if (!data) return;
      if (data.clientId) clientIds.add(data.clientId);
      if (data.original?.clientId) clientIds.add(data.original.clientId);
      if (data.agentId) vendorUids.add(data.agentId);
      if (data.original?.vendorUid) vendorUids.add(data.original.vendorUid);
      if (data.coSellerUid) vendorUids.add(data.coSellerUid);
      if (data.original?.secondVendorUid) vendorUids.add(data.original.secondVendorUid);
    };

    extractRefs(beforeData);
    extractRefs(afterData);

    try {
      // 1. If created or updated without derived commissions, calculate them
      if (afterDoc?.exists && (!beforeDoc?.exists || !afterData?.derived?.commissionTotal)) {
        const vendorUid = afterData?.agentId || afterData?.original?.vendorUid;
        const products = afterData?.items || afterData?.original?.products || [];
        const secondVendorShare = Number(afterData?.coSellerShare ?? afterData?.original?.secondVendorShare ?? 0);
        const totalAmount = Number(afterData?.totalAmount ?? afterData?.original?.totalPrice ?? 0);

        if (vendorUid) {
          const vendorSnap = await db.collection('users').doc(vendorUid).get();
          const qualificationId = vendorSnap.data()?.original?.qualification || vendorSnap.data()?.qualification;
          let qualification = null;
          if (qualificationId) {
            const qualSnap = await db.collection('qualifications').doc(qualificationId).get();
            if (qualSnap.exists) {
              qualification = qualSnap.data();
            }
          }
          const commission = calculateCommission(products, qualification as any, secondVendorShare);

          await db.collection('contracts').doc(contractId).update({
            'derived.totalPaid': afterData?.derived?.totalPaid || 0,
            'derived.totalRemaining': totalAmount - (afterData?.derived?.totalPaid || 0),
            'derived.paymentsCount': afterData?.derived?.paymentsCount || 0,
            'derived.installmentsCount': afterData?.derived?.installmentsCount || 0,
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
