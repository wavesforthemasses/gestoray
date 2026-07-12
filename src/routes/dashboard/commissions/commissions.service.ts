import { db, doc, setDoc, getDoc, updateDoc, collection, getDocs, query, where, orderBy, deleteDoc } from '$lib/firebase';

export class CommissionsService {
  static async getVersions(periodId: string) {
    const versionsRef = collection(db, 'commissions_closings', periodId, 'versions');
    const q = query(versionsRef, orderBy('generatedAt', 'desc'));
    const snap = await getDocs(q);
    
    const vList: any[] = [];
    snap.forEach((d: any) => {
      vList.push({ id: d.id, ...d.data() });
    });
    return vList;
  }

  static async getVersion(periodId: string, versionId: string) {
    const snap = await getDoc(doc(db, 'commissions_closings', periodId, 'versions', versionId));
    if (snap.exists()) {
      return { id: snap.id, ...snap.data() };
    }
    return null;
  }

  static async deleteVersion(periodId: string, versionId: string) {
    await deleteDoc(doc(db, 'commissions_closings', periodId, 'versions', versionId));
  }

  static async finalizeVersion(periodId: string, versionId: string, userId: string, userEmail: string) {
    const now = new Date().toISOString();

    await updateDoc(doc(db, 'commissions_closings', periodId, 'versions', versionId), {
      status: 'finalized',
      finalizedAt: now,
      finalizedBy: userId,
      finalizedEmail: userEmail
    });

    await updateDoc(doc(db, 'commissions_closings', periodId), {
      latestStatus: 'finalized',
      updatedAt: now
    });

    return now;
  }

  static async generateCalculation(periodId: string, month: number, year: number, userId: string, userEmail: string, hasAnyFinalized: boolean) {
    const settingsSnap = await getDoc(doc(db, 'settings', 'commissions'));
    const settings = settingsSnap.exists() ? settingsSnap.data() : { discountPenalty: 'linear', qualificationMode: 'historical' };
    
    // 1. Fetch Users & Qualifications
    const usersSnap = await getDocs(collection(db, 'users'));
    const usersList: any[] = [];
    usersSnap.forEach((d: any) => usersList.push({ uid: d.id, ...d.data().original }));

    const qualsSnap = await getDocs(collection(db, 'qualifications'));
    const qualsMap = new Map<string, any>();
    qualsSnap.forEach((d: any) => qualsMap.set(d.id, { id: d.id, ...d.data() }));

    // 2. Fetch Payments in period
    const startOfMonth = new Date(year, month - 1, 1).toISOString();
    const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999).toISOString();

    const paymentsSnap = await getDocs(
      query(collection(db, 'payments'), where('original.date', '>=', startOfMonth), where('original.date', '<=', endOfMonth))
    );

    let sumIncassi = 0;
    const paymentsList: any[] = [];
    paymentsSnap.forEach((doc: any) => {
      const d = doc.data();
      sumIncassi += (d.original?.amount || 0);
      paymentsList.push({ id: doc.id, ...d });
    });

    // 3. Fetch Allocations and check for undistributed payments
    const allocs: any[] = [];
    const contractsToFetch = new Set<string>();
    const undistributedPayments: string[] = [];

    await Promise.all(paymentsList.map(async (p: any) => {
      const cPaidSnap = await getDocs(collection(db, 'payments', p.id, 'contractsPaid'));
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
      throw new Error(`Impossibile calcolare: I seguenti incassi non sono stati completamente distribuiti sui servizi: ${undistributedPayments.join(', ')}`);
    }

    // 4. Fetch Contracts
    const contractsMap = new Map<string, any>();
    await Promise.all(Array.from(contractsToFetch).map(async (cId) => {
      const contractSnap = await getDoc(doc(db, 'contracts', cId));
      if (contractSnap.exists()) {
        const data = contractSnap.data();
        contractsMap.set(cId, { id: cId, ...data.original, derived: data.derived });
      }
    }));

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
        if (settings.discountPenalty === 'linear') {
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

    await setDoc(doc(db, 'commissions_closings', periodId), {
      month,
      year,
      latestStatus: hasAnyFinalized ? 'finalized' : 'draft',
      updatedAt: now
    }, { merge: true });

    await setDoc(doc(db, 'commissions_closings', periodId, 'versions', versionId), draftData);
    
    return { id: versionId, ...draftData };
  }
}
