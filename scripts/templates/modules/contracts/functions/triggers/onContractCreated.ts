import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';
import * as logger from 'firebase-functions/logger';
import { calculateCommission } from '../business-logic';
import { isDerivedOnlyChange, logSyncError } from '../utils';

const REGION = 'europe-west3';

/**
 * Helper SSOT: Estrae la data efficace del contratto per il confronto cronologico NNCF
 */
export function extractContractEffectiveDate(cData: any): string {
  const orig = cData?.original || {};
  const edits = cData?.edits || {};
  return (
    cData?.startDate ||
    cData?.createdAt ||
    edits?.createdAt ||
    orig?.startDate ||
    orig?.createdAt ||
    ''
  );
}

/**
 * Helper SSOT: Ordina due contratti per anzianità deterministica con tie-breaker su contractNumber e ID
 */
export function compareContractEffectiveDates(a: any, b: any): number {
  const dateA = extractContractEffectiveDate(a);
  const dateB = extractContractEffectiveDate(b);

  const timeA = dateA ? new Date(dateA.includes('T') ? dateA : `${dateA}T12:00:00Z`).getTime() : 0;
  const timeB = dateB ? new Date(dateB.includes('T') ? dateB : `${dateB}T12:00:00Z`).getTime() : 0;

  if (timeA !== timeB) {
    return timeA - timeB; // Ascending: il più vecchio prima
  }

  const numA = a.contractNumber || a.original?.contractNumber || '';
  const numB = b.contractNumber || b.original?.contractNumber || '';
  if (numA && numB && numA !== numB) {
    return numA.localeCompare(numB);
  }

  return (a.id || '').localeCompare(b.id || '');
}

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

    if (['approved', 'approvato', 'attivo', 'accettato', 'firmato'].includes(status)) {
      approvedContracts.push({
        id: docId,
        ...cData
      });
    }
  });

  // Sort approved contracts to find NNCF (New Name in Central File) winner
  approvedContracts.sort(compareContractEffectiveDates);

  const winner = approvedContracts.length > 0 ? approvedContracts[0] : null;
  const nncfOrderId = winner ? winner.id : null;
  const nncfDate = winner ? extractContractEffectiveDate(winner) : null;
  const nncfVendorUid = winner ? (winner.agentId || winner.original?.vendorUid || null) : null;

  // 1b. Batch atomico: aggiorna derived.isNNCF su tutti i contratti del cliente e sincronizza il cliente
  const batch = db.batch();

  contractDocsMap.forEach((cData, docId) => {
    if (cData.derived?.deleted) return;
    const shouldBeNNCF = winner !== null && docId === winner.id;
    const currentIsNNCF = Boolean(cData.derived?.isNNCF);

    if (shouldBeNNCF !== currentIsNNCF) {
      const cRef = db.collection('contracts').doc(docId);
      batch.update(cRef, { 'derived.isNNCF': shouldBeNNCF });
    }
  });

  // Update client
  const clientRef = db.collection('clients').doc(clientId);
  const clientSnap = await clientRef.get();
  if (clientSnap.exists) {
    batch.update(clientRef, {
      'original.status': approvedContracts.length > 0 ? 'customer' : 'prospect',
      'derived.contractsCount': contractsCount,
      'derived.approvedContractsCount': approvedContracts.length,
      'derived.totalContractValue': totalContractValue,
      'derived.totalPaid': clientTotalPaid,
      'derived.totalRemaining': clientTotalRemaining,
      'derived.nncfDate': nncfDate,
      'derived.nncfOrderId': nncfOrderId,
      'derived.nncfVendorUid': nncfVendorUid
    });
  }

  await batch.commit();

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
