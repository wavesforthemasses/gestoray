import { db, collection, getDocs, query, where } from '$lib/firebase';
import type { KPIFetchParams, DrillDownFetchParams } from '$lib/types/moduleKPIBridge';
import { formatDate } from '$lib/utils/formatters';

export class ContractsKPIBridge {
  static async fetchKPIs({ role, uid }: KPIFetchParams) {
    let commContractsCount = 0;
    let commTotalSold = 0;
    let commApprovedSold = 0;
    let totalVenduto = 0;
    let totalContratti = 0;
    let pendingContratti = 0;

    try {
      const snap = await getDocs(collection(db, 'contracts'));
      totalContratti = snap.size;

      snap.forEach((d: any) => {
        const data = d.data();
        const val = data.totalAmount ?? data.original?.totalPrice ?? 0;
        const status = data.status ?? data.original?.status ?? 'bozza';
        const isMyDoc = data.agentId === uid || data.original?.vendorUid === uid || data.original?.secondVendorUid === uid;

        totalVenduto += val;

        if (status === 'bozza' || status === 'inviato' || status === 'pending') {
          pendingContratti++;
        }

        if (isMyDoc) {
          commContractsCount++;
          commTotalSold += val;
          if (status === 'attivo' || status === 'accettato' || status === 'approved') {
            commApprovedSold += val;
          }
        }
      });
    } catch (e) {
      console.error('Error fetching contracts KPIs in bridge:', e);
    }

    return {
      commContractsCount,
      commTotalSold,
      commApprovedSold,
      totalVenduto,
      totalContratti,
      pendingContratti
    };
  }

  static async fetchDrillDownItems({ period, tab, role, uid, clientFilter, vendorFilter, productFilter }: DrillDownFetchParams) {
    if (tab !== 'vss') return [];

    const isComm = role === 'commerciale';
    const matchQuery = (val: string | undefined, q: string) => !q || (val?.toLowerCase().includes(q.toLowerCase()) || false);
    let items: any[] = [];

    try {
      const snap = await getDocs(collection(db, 'contracts'));
      snap.forEach((d: any) => {
        const data = d.data();
        const dt = data.createdAt || data.edits?.createdAt || data.original?.createdAt;
        if (dt && dt >= period.start.toISOString() && dt <= period.end.toISOString()) {
          const isMyDoc = data.agentId === uid || data.original?.vendorUid === uid || data.original?.secondVendorUid === uid;
          if (!isComm || isMyDoc) {
            items.push({ id: d.id, ...data });
          }
        }
      });
    } catch (e) {
      console.error('Error fetching contracts drill down in bridge:', e);
    }

    if (clientFilter) items = items.filter(i => matchQuery(i.clientName || i.original?.clientName, clientFilter));
    if (vendorFilter) items = items.filter(i => i.agentId === vendorFilter || i.original?.vendorUid === vendorFilter);
    if (productFilter) items = items.filter(i => (i.items || i.original?.items || []).some((p: any) => matchQuery(p.productName || p.name, productFilter)));

    return items.map((item) => {
      const orig = item.original || {};
      const totalVal = item.totalAmount ?? orig.totalPrice ?? 0;
      const statusVal = item.status ?? orig.status ?? 'bozza';
      const clientNameVal = item.clientName || orig.clientName || 'Cliente';
      const agentNameVal = item.agentName || orig.vendorEmail || orig.createdBy || 'Commerciale';
      const createdDateVal = item.createdAt || item.edits?.createdAt || orig.createdAt;

      return {
        id: item.id,
        cliente: clientNameVal,
        consulente: agentNameVal,
        data: formatDate(createdDateVal),
        valore: totalVal,
        dettaglio: `Tipo: ${item.type || 'Contratto'}`,
        status: statusVal,
        link: `/dashboard/contracts/${item.id}`
      };
    });
  }
}
