import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';

export const generateCommissionsCalculation = onCall({ region: 'europe-west3', cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Devi essere loggato.');
  }

  const { periodId, month, year, hasAnyFinalized } = request.data;
  const userId = request.auth.uid;
  const userEmail = request.auth.token.email || 'N/D';

  if (!periodId || !month || !year) {
    throw new HttpsError('invalid-argument', 'Parametri mancanti.');
  }

  const db = admin.firestore();

  try {
    const settingsSnap = await db.collection('settings').doc('commissions').get();
    const settings = settingsSnap.exists ? settingsSnap.data() : { discountPenalty: 'linear', qualificationMode: 'historical' };
    
    // 1. Fetch Users & Qualifications
    const usersSnap = await db.collection('users').get();
    const usersList: any[] = [];
    usersSnap.forEach(d => usersList.push({ uid: d.id, ...d.data().original }));

    const qualsSnap = await db.collection('qualifications').get();
    const qualsMap = new Map<string, any>();
    qualsSnap.forEach(d => qualsMap.set(d.id, { id: d.id, ...d.data() }));

    // 2. Fetch Payments in period
    const startOfMonth = new Date(year, month - 1, 1).toISOString();
    const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999).toISOString();

    const paymentsSnap = await db.collection('payments')
      .where('original.date', '>=', startOfMonth)
      .where('original.date', '<=', endOfMonth)
      .get();

    let sumIncassi = 0;
    const paymentsList: any[] = [];
    paymentsSnap.forEach(doc => {
      const d = doc.data();
      sumIncassi += (d.original?.amount || 0);
      paymentsList.push({ id: doc.id, ...d });
    });

    // 3. Fetch Allocations and check for undistributed payments
    const allocs: any[] = [];
    const contractsToFetch = new Set<string>();
    const undistributedPayments: string[] = [];

    await Promise.all(paymentsList.map(async (p: any) => {
      const cPaidSnap = await db.collection('payments').doc(p.id).collection('contractsPaid').get();
      let totalDistributedOnProducts = 0;
      
      cPaidSnap.forEach((doc: any) => {
        const d = doc.data();
        const pAllocs = d.original?.productAllocations || [];
        totalDistributedOnProducts += pAllocs.reduce((sum: number, pa: any) => sum + pa.amount, 0);

        allocs.push({
          id: doc.id,
          paymentId: p.id,
          contractId: d.original?.contractId,
          amount: d.original?.amount || 0,
          productAllocations: pAllocs
        });
        if (d.original?.contractId) contractsToFetch.add(d.original.contractId);
      });

      if (p.original.amount - totalDistributedOnProducts > 0.01) {
        undistributedPayments.push(p.id);
      }
    }));

    if (undistributedPayments.length > 0) {
      throw new HttpsError('failed-precondition', `Impossibile calcolare: I seguenti incassi non sono stati completamente distribuiti sui servizi: ${undistributedPayments.join(', ')}`);
    }

    // 4. Fetch Contracts (Fail-safe for optional contracts module)
    const contractsMap = new Map<string, any>();
    const contractIdsArray = Array.from(contractsToFetch);
    if (contractIdsArray.length > 0) {
      try {
        for (let i = 0; i < contractIdsArray.length; i += 30) {
          const chunk = contractIdsArray.slice(i, i + 30);
          const contractSnaps = await db.collection('contracts').where(admin.firestore.FieldPath.documentId(), 'in', chunk).get();
          contractSnaps.forEach(snap => {
            const data = snap.data();
            contractsMap.set(snap.id, { id: snap.id, ...data.original, derived: data.derived });
          });
        }
      } catch (e) {
        console.warn('Modulo contratti non disponibile per il calcolo provvigionale:', e);
      }
    }

    // 5. Build Summary Map
    const summary = new Map<string, any>();
    usersList.forEach(u => {
      const qualId = u.qualification;
      let qualName = qualId || 'junior';
      let qualObj = null;
      if (qualId && qualsMap.has(qualId)) {
        qualObj = qualsMap.get(qualId);
        qualName = qualObj.name;
      }
      summary.set(u.uid, {
        uid: u.uid,
        name: `${u.nome || ''} ${u.cognome || ''}`.trim() || u.email,
        email: u.email,
        qualification: qualName,
        qualObj: qualObj,
        salesInPeriod: 0,
        commissionInPeriod: 0,
        details: []
      });
    });

    let sumAllocated = 0;
    const enrichedAllocs: any[] = [];

    // 6. Calculate
    for (const alloc of allocs) {
      sumAllocated += alloc.amount;
      const contract = contractsMap.get(alloc.contractId);
      if (!contract) continue;

      let commissionPrimary = 0;
      let commissionSecondary = 0;

      const primaryUid = contract.vendorUid;
      const secondaryUid = contract.secondVendorUid;

      let primaryPct = 0;
      if (primaryUid && summary.has(primaryUid)) {
        primaryPct = summary.get(primaryUid)!.qualObj?.percentage || 0;
      }

      // Calculate commission per product
      for (const pAlloc of (alloc.productAllocations || [])) {
        const product = contract.products?.find((p: any) => p.productId === pAlloc.productId);
        if (!product) continue;

        const venduto = product.priceSold * product.quantity;
        const listino = product.listPrice * product.quantity;
        const minimo = product.minPrice * product.quantity;
        
        let penaltyFactor = 1;
        if (settings?.discountPenalty === 'linear') {
          const margine = listino - minimo;
          const sconto = listino - venduto;
          if (margine > 0) {
            penaltyFactor = 1 - (sconto / margine);
            penaltyFactor = Math.max(0, penaltyFactor); // Minimo 0
          } else if (venduto < listino) {
            penaltyFactor = 0; // Se non c'è margine e fa sconto, 0%
          }
        }
        
        const effectivePct = primaryPct * penaltyFactor;
        const productCommissionFull = venduto * (effectivePct / 100);
        
        const pctOfProductPaid = venduto > 0 ? pAlloc.amount / venduto : 0;
        const commissionForThisPayment = productCommissionFull * pctOfProductPaid;

        const secShare = contract.secondVendorShare || 0;
        const secCommProduct = commissionForThisPayment * (secShare / 100);
        const primCommProduct = commissionForThisPayment - secCommProduct;

        commissionPrimary += primCommProduct;
        commissionSecondary += secCommProduct;

        if (primaryUid && summary.has(primaryUid)) {
          const vendor = summary.get(primaryUid)!;
          vendor.salesInPeriod += pAlloc.amount * (secondaryUid ? (1 - (contract.secondVendorShare || 0) / 100) : 1);
          vendor.commissionInPeriod += primCommProduct;
          vendor.details.push({
            paymentId: alloc.paymentId || 'N/D',
            contractId: alloc.contractId || 'N/D',
            clientName: contract.clientName || 'N/D',
            productName: product.name || 'N/D',
            allocatedAmount: (pAlloc.amount * (secondaryUid ? (1 - (contract.secondVendorShare || 0) / 100) : 1)) || 0,
            commission: primCommProduct || 0
          });
        }

        if (secondaryUid && summary.has(secondaryUid)) {
          const vendor = summary.get(secondaryUid)!;
          vendor.salesInPeriod += pAlloc.amount * ((contract.secondVendorShare || 0) / 100);
          vendor.commissionInPeriod += secCommProduct;
          vendor.details.push({
            paymentId: alloc.paymentId || 'N/D',
            contractId: alloc.contractId || 'N/D',
            clientName: contract.clientName || 'N/D',
            productName: product.name || 'N/D',
            allocatedAmount: (pAlloc.amount * ((contract.secondVendorShare || 0) / 100)) || 0,
            commission: secCommProduct || 0
          });
        }
      }

      let primaryName = contract.vendorEmail || 'N/D';
      if (primaryUid && summary.has(primaryUid)) {
          primaryName = summary.get(primaryUid)!.name;
      }

      let secondaryName = null;
      if (secondaryUid && summary.has(secondaryUid)) {
          secondaryName = summary.get(secondaryUid)!.name;
      } else if (contract.secondVendorEmail) {
          secondaryName = contract.secondVendorEmail;
      }

      enrichedAllocs.push({
        paymentId: alloc.paymentId || 'N/D',
        contractId: alloc.contractId || 'N/D',
        clientName: contract.clientName || 'N/D',
        amount: alloc.amount || 0,
        primaryEmail: contract.vendorEmail || 'N/D',
        primaryName: primaryName,
        secondVendorEmail: contract.secondVendorEmail || null,
        secondVendorName: secondaryName,
        secondVendorShare: contract.secondVendorShare || 0,
        commissionGenerated: (commissionPrimary + commissionSecondary) || 0
      });
    }

    const finalBreakdown = Array.from(summary.values())
      .sort((a, b) => b.commissionInPeriod - a.commissionInPeriod)
      .map(v => ({
        uid: v.uid || 'N/D',
        name: v.name || 'N/D',
        email: v.email || 'N/D',
        qualification: v.qualification || 'N/D',
        sales: v.salesInPeriod || 0,
        commission: v.commissionInPeriod || 0,
        details: v.details || []
      }));

    const finalTotalCommissions = finalBreakdown.reduce((sum, v) => sum + v.commission, 0);

    const now = new Date().toISOString();
    const versionId = `v_${Date.now()}`;

    const draftData = {
      month,
      year,
      status: 'draft',
      generatedAt: now,
      generatedBy: userId,
      generatedEmail: userEmail,
      totalIncassi: sumIncassi,
      totalAllocated: sumAllocated,
      totalCommissions: finalTotalCommissions,
      breakdown: finalBreakdown,
      allocations: enrichedAllocs
    };

    // Use batch to ensure atomic writes
    const batch = db.batch();
    
    batch.set(db.collection('commissions_closings').doc(periodId), {
      month,
      year,
      latestStatus: hasAnyFinalized ? 'finalized' : 'draft',
      updatedAt: now
    }, { merge: true });

    batch.set(db.collection('commissions_closings').doc(periodId).collection('versions').doc(versionId), draftData);
    
    await batch.commit();

    return { id: versionId, ...draftData };
  } catch (error: any) {
    console.error('Commission error:', error);
    throw new HttpsError('internal', error.message || 'Errore nel calcolo delle provvigioni.');
  }
});
