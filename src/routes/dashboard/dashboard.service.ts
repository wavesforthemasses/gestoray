import { db, getDoc, doc, getDocs, collection, query, where, getCountFromServer, getAggregateFromServer, sum, collectionGroup, orderBy, functions, httpsCallable } from "$lib/firebase";
import { formatDate } from "$lib/utils/formatters";

export interface DashboardKPIs {
  commContractsCount: number;
  commTotalSold: number;
  commApprovedSold: number;
  commTotalNNCF: number;
  commMaturate: number;
  commIncassato: number;
  totalClienti: number;
  totalVenduto: number;
  totalIncassato: number;
  totalNNCF: number;
  totalContratti: number;
  pendingContratti: number;
  activityCalls: number;
  activityMeetings: number;
  activityAppointments: number;
  commTotalNA: number;
  usersList: any[];
}

export interface AdminTables {
  adminPendingContracts: any[];
  adminOverdueInstallments: any[];
  adminPendingCommissions: any[];
  adminFinalizedCommissions: any[];
  adminUndistributedPayments: any[];
}

export class DashboardService {
  static async fetchGlobalKPIs(role: string, myUid: string): Promise<DashboardKPIs> {
    const kpis: DashboardKPIs = {
      commContractsCount: 0, commTotalSold: 0, commApprovedSold: 0, commTotalNNCF: 0, commMaturate: 0, commIncassato: 0,
      totalClienti: 0, totalVenduto: 0, totalIncassato: 0, totalNNCF: 0, totalContratti: 0, pendingContratti: 0,
      activityCalls: 0, activityMeetings: 0, activityAppointments: 0, commTotalNA: 0, usersList: []
    };

    // 1. Fetch current user profile to read derived KPIs
    const userSnap = await getDoc(doc(db, 'users', myUid));
    if (userSnap.exists()) {
      const uData = userSnap.data() || {};
      const uDerived = uData.derived || {};
      kpis.commContractsCount = uDerived.totalContractsCount || 0;
      kpis.commTotalSold = (uDerived.totalPendingSales || 0) + (uDerived.totalApprovedSales || 0);
      kpis.commApprovedSold = uDerived.totalApprovedSales || 0;
      kpis.commTotalNNCF = uDerived.totalNNCF || 0;
    }

    // Fetch commMaturate from finalized closings
    try {
      const closingsSnap = await getDocs(query(collection(db, 'commissions_closings'), where('latestStatus', '==', 'finalized')));
      let totalMaturate = 0;
      await Promise.all(closingsSnap.docs.map(async (cDoc: any) => {
        const vSnap = await getDocs(query(collection(db, 'commissions_closings', cDoc.id, 'versions'), where('status', '==', 'finalized')));
        if (!vSnap.empty) {
          const version = vSnap.docs[0].data();
          if (role === 'commerciale') {
            const myBreakdown = version.breakdown?.find((b: any) => b.uid === myUid);
            if (myBreakdown) totalMaturate += (myBreakdown.commission || 0);
          } else {
            totalMaturate += (version.totalCommissions || 0);
          }
        }
      }));
      kpis.commMaturate = totalMaturate;
    } catch (err) {
      console.error("Error fetching finalized commissions", err);
    }

    // 2. Fetch global directional KPIs if admin/direzione
    if (role !== 'commerciale') {
      const [
        clientsCountSnap, approvedContractsValSnap, paymentsValSnap,
        nncfCountSnap, contractsCountSnap, pendingContractsSnap
      ] = await Promise.all([
        getCountFromServer(collection(db, 'clients')),
        getAggregateFromServer(query(collection(db, 'contracts'), where('original.status', '==', 'approved')), { val: sum('original.totalPrice') }),
        getAggregateFromServer(collection(db, 'payments'), { val: sum('original.amount') }),
        getCountFromServer(query(collection(db, 'clients'), where('derived.nncfOrderId', '!=', null))),
        getCountFromServer(collection(db, 'contracts')),
        getCountFromServer(query(collection(db, 'contracts'), where('original.status', '==', 'pending')))
      ]);

      kpis.totalClienti = clientsCountSnap.data().count;
      kpis.totalVenduto = approvedContractsValSnap.data().val || 0;
      kpis.totalIncassato = paymentsValSnap.data().val || 0;
      kpis.totalNNCF = nncfCountSnap.data().count;
      kpis.totalContratti = contractsCountSnap.data().count;
      kpis.pendingContratti = pendingContractsSnap.data().count;

      const usersSnap = await getDocs(query(collection(db, 'users'), where('original.roles', 'array-contains', 'commerciale')));
      usersSnap.forEach((d: any) => kpis.usersList.push({ uid: d.id, ...d.data()?.original }));
    }

    // 3. Fetch activity counts
    if (role === 'commerciale') {
      const [callsSnap, meetingsSnap, apptsSnap, naSnap] = await Promise.all([
        getCountFromServer(query(collectionGroup(db, 'activities'), where('original.loggedBy', '==', myUid), where('original.type', 'in', ['Telefonata', 'Sollecito Telefonico']))),
        getCountFromServer(query(collectionGroup(db, 'activities'), where('original.loggedBy', '==', myUid), where('original.type', 'in', ['Incontro', 'Sollecito PEC']))),
        getCountFromServer(query(collectionGroup(db, 'activities'), where('original.loggedBy', '==', myUid), where('original.type', 'in', ['Appuntamento', 'Sollecito Email']))),
        getCountFromServer(query(collection(db, 'clients'), where('original.createdBy', '==', myUid)))
      ]);
      kpis.activityCalls = callsSnap.data().count;
      kpis.activityMeetings = meetingsSnap.data().count;
      kpis.activityAppointments = apptsSnap.data().count;
      kpis.commTotalNA = naSnap.data().count;
    } else {
      const [callsSnap, meetingsSnap, apptsSnap] = await Promise.all([
        getCountFromServer(query(collectionGroup(db, 'activities'), where('original.type', 'in', ['Telefonata', 'Sollecito Telefonico']))),
        getCountFromServer(query(collectionGroup(db, 'activities'), where('original.type', 'in', ['Incontro', 'Sollecito PEC']))),
        getCountFromServer(query(collectionGroup(db, 'activities'), where('original.type', 'in', ['Appuntamento', 'Sollecito Email'])))
      ]);
      kpis.activityCalls = callsSnap.data().count;
      kpis.activityMeetings = meetingsSnap.data().count;
      kpis.activityAppointments = apptsSnap.data().count;
    }

    if (role === 'commerciale') {
      let commIncassato = 0;
      try {
        const [pSnap, sSnap] = await Promise.all([
          getDocs(query(collection(db, 'contracts'), where('original.vendorUid', '==', myUid))),
          getDocs(query(collection(db, 'contracts'), where('original.secondVendorUid', '==', myUid)))
        ]);
        const myContractIds = new Set<string>();
        pSnap.forEach((d: any) => myContractIds.add(d.id));
        sSnap.forEach((d: any) => myContractIds.add(d.id));

        const idsArray = Array.from(myContractIds);
        for (let i = 0; i < idsArray.length; i += 10) {
          const chunk = idsArray.slice(i, i + 10);
          const chunkSnap = await getDocs(query(collectionGroup(db, 'contractsPaid'), where('original.contractId', 'in', chunk)));
          chunkSnap.forEach(d => commIncassato += (d.data()?.original?.amount || 0));
        }
      } catch (e) {
        console.error("Error GI comm", e);
      }
      kpis.commIncassato = commIncassato;
    }

    return kpis;
  }

  static async fetchAdminTables(todayStr: string): Promise<AdminTables> {
    const res: AdminTables = {
      adminPendingContracts: [], adminOverdueInstallments: [], adminPendingCommissions: [],
      adminFinalizedCommissions: [], adminUndistributedPayments: []
    };

    try {
      const pendingContrSnap = await getDocs(query(collection(db, 'contracts'), where('original.status', '==', 'pending'), orderBy('edits.createdAt', 'desc')));
      pendingContrSnap.forEach((d: any) => res.adminPendingContracts.push({ id: d.id, ...d.data().original, ...d.data().edits }));
    } catch (e) { console.error("Error pending contracts", e); }

    try {
      const overdueInstSnap = await getDocs(query(collectionGroup(db, 'installments'), where('original.status', '==', 'pending'), where('original.dueDate', '<', todayStr.split('T')[0])));
      overdueInstSnap.forEach((d: any) => res.adminOverdueInstallments.push({ id: d.id, ...d.data()?.original }));
      res.adminOverdueInstallments.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    } catch (e) { console.error("Error overdue installments", e); }

    try {
      const allCommSnap = await getDocs(collection(db, 'commissions_closings'));
      allCommSnap.forEach((d: any) => {
        const data = d.data();
        const status = data.latestStatus || 'draft';
        if (status === 'finalized') {
          if (!data.isPaid) res.adminFinalizedCommissions.push({ id: d.id, ...data });
        } else {
          res.adminPendingCommissions.push({ id: d.id, ...data });
        }
      });
      res.adminPendingCommissions.sort((a, b) => b.id.localeCompare(a.id));
      res.adminFinalizedCommissions.sort((a, b) => b.id.localeCompare(a.id));
    } catch (e) { console.error("Error commissions", e); }

    try {
      const paymentsSnap = await getDocs(query(collection(db, 'payments'), where('derived.remainingToDistribute', '>', 0)));
      paymentsSnap.forEach((d: any) => res.adminUndistributedPayments.push({ id: d.id, ...d.data()?.original, ...d.data()?.derived }));
    } catch (e) { console.error("Error undistributed payments", e); }

    return res;
  }

  static async markCommissionPaid(periodId: string, uid: string) {
    await updateDoc(doc(db, 'commissions_closings', periodId), {
      isPaid: true,
      paidAt: new Date().toISOString(),
      paidBy: uid
    });
  }

  static generateChartPeriods(endDateString: string, granularity: 'settimanale' | 'mensile' | 'annuale') {
    const end = new Date(endDateString);
    const periods: Array<{ start: Date; end: Date; label: string }> = [];

    if (granularity === 'settimanale') {
      for (let i = 11; i >= 0; i--) {
        const pEnd = new Date(end.getTime() - i * 7 * 24 * 60 * 60 * 1000);
        const pStart = new Date(pEnd.getTime() - 7 * 24 * 60 * 60 * 1000 + 1);
        periods.push({ start: pStart, end: pEnd, label: `${pEnd.getDate()}/${pEnd.getMonth() + 1}` });
      }
    } else if (granularity === 'mensile') {
      for (let i = 11; i >= 0; i--) {
        const d = new Date(end.getFullYear(), end.getMonth() - i, 1);
        const pStart = new Date(d.getFullYear(), d.getMonth(), 1);
        const pEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
        const monthNames = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];
        periods.push({ start: pStart, end: pEnd, label: `${monthNames[pStart.getMonth()]} ${String(pStart.getFullYear()).slice(2)}` });
      }
    } else {
      for (let i = 4; i >= 0; i--) {
        const year = end.getFullYear() - i;
        const pStart = new Date(year, 0, 1);
        const pEnd = new Date(year, 11, 31, 23, 59, 59, 999);
        periods.push({ start: pStart, end: pEnd, label: String(year) });
      }
    }
    return periods;
  }

  static async fetchChartAggregations(periods: any[], role: string, myUid: string, activeChartTab: string) {
    const isComm = role === 'commerciale';
    const getChartAggregations = httpsCallable(functions, 'getChartAggregations');
    
    let filters: any = {};
    if (isComm) {
      if (['Telefonata', 'Incontro', 'Appuntamento'].includes(activeChartTab)) filters.loggedBy = myUid;
      else if (activeChartTab === 'nuove_anagrafiche' || activeChartTab === 'nncf') filters.createdBy = myUid;
      else filters.vendorUid = myUid;
    }
    
    if (['Telefonata', 'Incontro', 'Appuntamento'].includes(activeChartTab)) {
      if (activeChartTab === 'Telefonata') filters.type = 'Telefonata'; // TODO: handle multiple types in CF if needed, for now we will send 'Telefonata' and 'Sollecito Telefonico' separately or update CF.
      // Wait, let's keep it simple: the cloud function checks `filters.type === filters.type`
      filters.type = activeChartTab; 
    }

    // Call Cloud function
    // Map periods for CF
    const payload = {
      entity: activeChartTab,
      periods: periods.map(p => ({ start: p.start.toISOString(), end: p.end.toISOString() })),
      filters
    };
    
    try {
      const res = await getChartAggregations(payload);
      return (res.data as any).data || periods.map(() => 0);
    } catch (e) {
      console.error("Aggregation error", e);
      return periods.map(() => 0);
    }
  }

  static async fetchDrillDownItems(
    period: any, 
    activeChartTab: string, 
    role: string, 
    myUid: string, 
    clientFilter: string, 
    vendorFilter: string, 
    productFilter: string
  ) {
    if (!period) return [];

    const isComm = role === 'commerciale';
    const matchQuery = (val: string | undefined, q: string) => !q || (val?.toLowerCase().includes(q.toLowerCase()) || false);
    let items: any[] = [];
    
    // 1. Fetch data directly for the period
    if (activeChartTab === 'vss') {
      if (isComm) {
        const [pSnap, sSnap] = await Promise.all([
          getDocs(query(collection(db, 'contracts'), where('original.vendorUid', '==', myUid), where('edits.createdAt', '>=', period.start.toISOString()), where('edits.createdAt', '<=', period.end.toISOString()))),
          getDocs(query(collection(db, 'contracts'), where('original.secondVendorUid', '==', myUid), where('edits.createdAt', '>=', period.start.toISOString()), where('edits.createdAt', '<=', period.end.toISOString())))
        ]);
        pSnap.forEach((d: any) => items.push({ id: d.id, ...d.data() }));
        sSnap.forEach((d: any) => { if (!items.some(x => x.id === d.id)) items.push({ id: d.id, ...d.data() }); });
      } else {
        const snap = await getDocs(query(collection(db, 'contracts'), where('edits.createdAt', '>=', period.start.toISOString()), where('edits.createdAt', '<=', period.end.toISOString())));
        snap.forEach((d: any) => items.push({ id: d.id, ...d.data() }));
      }
    } else if (activeChartTab === 'gi' || activeChartTab === 'payments') {
      const snap = await getDocs(query(collection(db, 'payments'), where('original.date', '>=', period.start.toISOString()), where('original.date', '<=', period.end.toISOString())));
      snap.forEach((d: any) => items.push({ id: d.id, ...d.data() }));

      if (isComm) {
        const [pSnap, sSnap] = await Promise.all([
          getDocs(query(collection(db, 'contracts'), where('original.vendorUid', '==', myUid))),
          getDocs(query(collection(db, 'contracts'), where('original.secondVendorUid', '==', myUid)))
        ]);
        const myContractIds = new Set<string>();
        pSnap.forEach((d: any) => myContractIds.add(d.id));
        sSnap.forEach((d: any) => myContractIds.add(d.id));

        const allocSnapDocs: any[] = [];
        const idsArray = Array.from(myContractIds);
        for (let i = 0; i < idsArray.length; i += 30) {
          const chunk = idsArray.slice(i, i + 30);
          const chunkSnap = await getDocs(query(collectionGroup(db, 'contractsPaid'), where('original.contractId', 'in', chunk), where('original.date', '>=', period.start.toISOString()), where('original.date', '<=', period.end.toISOString())));
          chunkSnap.forEach(d => allocSnapDocs.push(d));
        }
        
        const validPaymentIds = new Set(allocSnapDocs.map((doc: any) => doc.data()?.original?.paymentId));
        items = items.filter(pay => validPaymentIds.has(pay.id)).map(pay => {
          const alloc = allocSnapDocs.find((a: any) => a.data()?.original?.paymentId === pay.id);
          return { ...pay, original: { ...pay.original, amount: alloc ? alloc.data().original.amount : pay.original.amount } };
        });
      }
    } else if (activeChartTab === 'provvigioni_maturate') {
      const snap = await getDocs(query(collection(db, 'commissions_closings'), where('latestStatus', '==', 'finalized'), where('periodEnd', '>=', period.start.toISOString()), where('periodEnd', '<=', period.end.toISOString())));
      await Promise.all(snap.docs.map(async (d: any) => {
        const vSnap = await getDocs(query(collection(db, 'commissions_closings', d.id, 'versions'), where('status', '==', 'finalized')));
        if (!vSnap.empty) {
          const version = vSnap.docs[0].data();
          const generatedAt = version.generatedAt || new Date(d.id + "-01").toISOString();
          let amount = 0;
          if (isComm) {
            const myBreakdown = version.breakdown?.find((b: any) => b.uid === myUid);
            if (myBreakdown) amount = myBreakdown.commission || 0;
          } else {
            amount = version.totalCommissions || 0;
          }
          if (amount > 0) {
            items.push({ id: d.id, original: { date: generatedAt, amount } });
          }
        }
      }));
    } else if (activeChartTab === 'nuove_anagrafiche') {
      const q = isComm ? query(collection(db, 'clients'), where('original.createdBy', '==', myUid), where('edits.createdAt', '>=', period.start.toISOString()), where('edits.createdAt', '<=', period.end.toISOString())) 
                       : query(collection(db, 'clients'), where('edits.createdAt', '>=', period.start.toISOString()), where('edits.createdAt', '<=', period.end.toISOString()));
      const snap = await getDocs(q);
      snap.forEach((d: any) => items.push({ id: d.id, ...d.data() }));
    } else if (activeChartTab === 'nncf') {
      const q = isComm ? query(collection(db, 'clients'), where('original.createdBy', '==', myUid), where('derived.nncfDate', '>=', period.start.toISOString()), where('derived.nncfDate', '<=', period.end.toISOString())) 
                       : query(collection(db, 'clients'), where('derived.nncfDate', '>=', period.start.toISOString()), where('derived.nncfDate', '<=', period.end.toISOString()));
      const snap = await getDocs(q);
      snap.forEach((d: any) => items.push({ id: d.id, ...d.data() }));
    } else {
      let q = isComm ? query(collectionGroup(db, 'activities'), where('original.loggedBy', '==', myUid), where('edits.createdAt', '>=', period.start.toISOString()), where('edits.createdAt', '<=', period.end.toISOString())) 
                     : query(collectionGroup(db, 'activities'), where('edits.createdAt', '>=', period.start.toISOString()), where('edits.createdAt', '<=', period.end.toISOString()));
                     
      if (['Telefonata', 'Incontro', 'Appuntamento'].includes(activeChartTab)) {
        // Unfortunately, Firestore doesn't support inequality with equality on different fields easily if we don't have composite indexes for all permutations.
        // We will filter type in-memory since we already limited by date.
      }
      
      const snap = await getDocs(q);
      snap.forEach((d: any) => {
        if (['Telefonata', 'Incontro', 'Appuntamento'].includes(activeChartTab)) {
          const type = d.data().original?.type || '';
          let match = false;
          if (activeChartTab === 'Telefonata') match = type === 'Telefonata' || type === 'Sollecito Telefonico';
          else if (activeChartTab === 'Incontro') match = type === 'Incontro' || type === 'Sollecito PEC';
          else if (activeChartTab === 'Appuntamento') match = type === 'Appuntamento' || type === 'Sollecito Email';
          
          if (match) items.push({ id: d.id, ...d.data() });
        } else {
           items.push({ id: d.id, ...d.data() });
        }
      });
    }

    if (clientFilter) items = items.filter(i => matchQuery(i.original?.clientName || i.original?.nome, clientFilter));
    if (vendorFilter) items = items.filter(i => i.original?.vendorUid === vendorFilter || i.original?.createdBy === vendorFilter || i.original?.loggedBy === vendorFilter);
    if (productFilter) items = items.filter(i => (i.original?.products || i.original?.items || []).some((p: any) => matchQuery(p.name, productFilter)));

    return items.map((item) => {
      const isComm = role === 'commerciale';
      if (activeChartTab === 'vss') {
        const orig = item.original || {};
        let displayVal = orig.totalPrice || 0;
        let info = 'Quota Primario (100%)';
        if (orig.secondVendorUid) {
          if (isComm) {
            if (orig.vendorUid === myUid) {
              displayVal = displayVal * (100 - orig.secondVendorShare) / 100;
              info = `Quota Primario (${100 - orig.secondVendorShare}%)`;
            } else {
              displayVal = displayVal * orig.secondVendorShare / 100;
              info = `Quota Co-selling (${orig.secondVendorShare}%)`;
            }
          } else {
            info = `Ripartito: ${100 - orig.secondVendorShare}% / ${orig.secondVendorShare}%`;
          }
        }
        return {
          id: item.id, cliente: orig.clientName, consulente: orig.vendorEmail + (orig.secondVendorEmail ? ` / ${orig.secondVendorEmail}` : ''),
          data: formatDate(item.edits?.createdAt || orig.createdAt), valore: displayVal, dettaglio: info, status: orig.status === 'approved' ? 'Approvato' : 'In attesa', link: `/dashboard/contracts/${item.id}`
        };
      } else if (activeChartTab === 'gi') {
        const orig = item.original || {};
        return { id: item.id, cliente: orig.clientName, consulente: orig.recordedEmail || 'Cassa', data: formatDate(orig.date), valore: orig.amount, dettaglio: 'Riscossione fattura', status: 'Incassato', link: `/dashboard/payments` };
      } else if (activeChartTab === 'provvigioni_maturate') {
        const orig = item.original || {};
        return { id: item.id, cliente: `Chiusura ${item.id}`, consulente: isComm ? 'Personali' : 'Rete', data: formatDate(orig.date), valore: orig.amount, dettaglio: 'Provvigioni Maturate', status: 'Finalizzato', link: `/dashboard/my-commissions` };
      } else if (activeChartTab === 'nuove_anagrafiche' || activeChartTab === 'nncf') {
        const orig = item.original || {};
        return { id: item.id, cliente: `${orig.nome} ${orig.cognome || ''}`.trim(), consulente: orig.email || 'N/A', data: formatDate(item.derived?.nncfDate || item.edits?.createdAt), valore: activeChartTab === 'nncf' ? 'NNCF Attivo' : 'Nuovo Lead', dettaglio: orig.phone || 'N/D', status: 'Anagrafica', link: `/dashboard/clients/${item.id}` };
      } else {
        const orig = item.original || {};
        return { id: item.id, cliente: orig.clientName || 'N/D', consulente: orig.loggedEmail || 'Commerciale', data: formatDate(item.edits?.createdAt || orig.date), valore: '-', dettaglio: orig.notes || 'Registrazione attività', status: orig.type || 'Attività', link: `/dashboard/clients/${orig.clientId}?tab=activities` };
      }
    });
  }
}
