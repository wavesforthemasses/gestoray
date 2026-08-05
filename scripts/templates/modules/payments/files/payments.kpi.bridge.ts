import { db, collection, collectionGroup, getDocs, query, where } from '$lib/firebase';
import type { KPIFetchParams, DrillDownFetchParams } from '$lib/types/moduleKPIBridge';
import { formatDate } from '$lib/utils/formatters';

export class PaymentsKPIBridge {
  static async fetchKPIs({ role, uid }: KPIFetchParams) {
    let totalIncassato = 0;
    let commIncassato = 0;

    try {
      if (role !== 'commerciale') {
        const snap = await getDocs(collection(db, 'payments'));
        snap.forEach((d: any) => {
          const data = d.data();
          totalIncassato += (data.amount ?? data.original?.amount ?? 0);
        });
      } else {
        const [pSnap, sSnap] = await Promise.all([
          getDocs(query(collection(db, 'contracts'), where('agentId', '==', uid))),
          getDocs(query(collection(db, 'contracts'), where('original.vendorUid', '==', uid)))
        ]);
        const myContractIds = new Set<string>();
        pSnap.forEach((d: any) => myContractIds.add(d.id));
        sSnap.forEach((d: any) => myContractIds.add(d.id));

        const idsArray = Array.from(myContractIds);
        for (let i = 0; i < idsArray.length; i += 10) {
          const chunk = idsArray.slice(i, i + 10);
          const chunkSnap = await getDocs(query(collectionGroup(db, 'contractsPaid'), where('original.contractId', 'in', chunk)));
          chunkSnap.forEach((d: any) => {
            commIncassato += (d.data()?.amount ?? d.data()?.original?.amount ?? 0);
          });
        }
      }
    } catch (e) {
      console.error('Error fetching payments KPIs in bridge:', e);
    }

    return { totalIncassato, commIncassato };
  }

  static async fetchAdminTablesData(todayStr: string) {
    const adminOverdueInstallments: any[] = [];
    const adminUndistributedPayments: any[] = [];

    try {
      const overdueInstSnap = await getDocs(query(collectionGroup(db, 'installments'), where('status', '==', 'in_attesa'), where('dueDate', '<', todayStr.split('T')[0])));
      overdueInstSnap.forEach((d: any) => {
        const data = d.data();
        adminOverdueInstallments.push({ id: d.id, ...data.original, ...data });
      });
      adminOverdueInstallments.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    } catch (e) {
      console.error('Error fetching overdue installments in bridge:', e);
    }

    try {
      const paymentsSnap = await getDocs(query(collection(db, 'payments'), where('derived.remainingToDistribute', '>', 0)));
      paymentsSnap.forEach((d: any) => {
        const data = d.data();
        adminUndistributedPayments.push({ id: d.id, ...data.original, ...data.derived, ...data });
      });
    } catch (e) {
      console.error('Error fetching undistributed payments in bridge:', e);
    }

    return { adminOverdueInstallments, adminUndistributedPayments };
  }

  static async fetchDrillDownItems({ period, tab, role, uid, clientFilter }: DrillDownFetchParams) {
    if (tab !== 'gi' && tab !== 'payments') return [];

    const isComm = role === 'commerciale';
    const matchQuery = (val: string | undefined, q: string) => !q || (val?.toLowerCase().includes(q.toLowerCase()) || false);
    let items: any[] = [];

    try {
      const snap = await getDocs(collection(db, 'payments'));
      snap.forEach((d: any) => {
        const data = d.data();
        const dt = data.date || data.original?.date || data.createdAt;
        if (dt && dt >= period.start.toISOString() && dt <= period.end.toISOString()) {
          items.push({ id: d.id, ...data });
        }
      });
    } catch (e) {
      console.error('Error fetching payments drill down in bridge:', e);
    }

    if (clientFilter) items = items.filter(i => matchQuery(i.clientName || i.original?.clientName, clientFilter));

    return items.map((item) => {
      const orig = item.original || {};
      return {
        id: item.id,
        cliente: item.clientName || orig.clientName || 'Cliente',
        consulente: item.recordedEmail || orig.recordedEmail || 'Cassa',
        data: formatDate(item.date || orig.date),
        valore: item.amount ?? orig.amount ?? 0,
        dettaglio: 'Riscossione incasso',
        status: 'Incassato',
        link: `/dashboard/payments`
      };
    });
  }
}
