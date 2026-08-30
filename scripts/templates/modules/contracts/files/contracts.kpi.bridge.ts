import { db, collection, getDocs } from '$lib/firebase';
import type { KPIFetchParams, DrillDownFetchParams } from '$lib/types/moduleKPIBridge';
import { formatDate } from '$lib/utils/formatters';

export class ContractsKPIBridge {
  /**
   * Pure domain function: Single Source of Truth (SSOT) for all Contract KPIs.
   */
  static calculateKPIs(contractsList: any[], params: { role?: string | null; uid?: string | null } = {}) {
    const { role = '', uid = '' } = params;
    const isComm = role === 'commerciale';

    let commContractsCount = 0;
    let commTotalSold = 0;
    let commApprovedSold = 0;
    let totalVenduto = 0;
    let totalContratti = 0;
    let pendingContratti = 0;

    for (const d of contractsList) {
      if (!d || d?.derived?.deleted || d?.deleted) continue;
      const data = d.data ? d.data() : d;
      const val = Number(data.totalAmount ?? data.original?.totalPrice ?? data.totalPrice ?? 0);
      const status = data.status ?? data.original?.status ?? 'bozza';
      const isMyDoc = data.agentId === uid || data.original?.vendorUid === uid || data.original?.secondVendorUid === uid;

      totalContratti++;
      totalVenduto += val;

      if (['bozza', 'inviato', 'pending', 'in_attesa'].includes(status)) {
        pendingContratti++;
      }

      if (isMyDoc) {
        commContractsCount++;
        commTotalSold += val;
        if (['attivo', 'accettato', 'approved', 'firmato'].includes(status)) {
          commApprovedSold += val;
        }
      }
    }

    const vss = isComm ? commTotalSold : totalVenduto;

    return {
      commContractsCount,
      commTotalSold,
      commApprovedSold,
      totalVenduto,
      totalContratti,
      pendingContratti,
      vss,
      total_contracts: totalContratti
    };
  }

  static async fetchKPIs({ role, uid }: KPIFetchParams) {
    try {
      const snap = await getDocs(collection(db, 'contracts'));
      const list: any[] = [];
      snap.forEach((d: any) => {
        list.push({ id: d.id, ...d.data() });
      });
      return this.calculateKPIs(list, { role, uid });
    } catch (e) {
      console.error('Error fetching contracts KPIs in bridge:', e);
      return this.calculateKPIs([], { role, uid });
    }
  }

  static async fetchChartAggregations({ periods, role, uid, tab }: any) {
    let allContracts: any[] = [];
    try {
      const snap = await getDocs(collection(db, 'contracts'));
      snap.forEach(d => {
        const data = d.data();
        if (data?.derived?.deleted || data?.deleted) return;
        allContracts.push({ id: d.id, ...data });
      });
    } catch (e) {
      console.error('Error fetching contracts for chart aggregations:', e);
      return periods.map(() => 0);
    }

    return periods.map((p: any) => {
      const startMs = new Date(p.start).getTime();
      const endMs = new Date(p.end).getTime();

      const periodContracts = allContracts.filter(data => {
        const dt = data.createdAt || data.edits?.createdAt || data.original?.createdAt;
        let ms = 0;
        if (dt) {
          if (typeof dt === 'string') {
            const parsed = dt.includes('T') ? new Date(dt).getTime() : new Date(`${dt}T12:00:00Z`).getTime();
            ms = isNaN(parsed) ? 0 : parsed;
          } else if (typeof dt.toDate === 'function') {
            ms = dt.toDate().getTime();
          } else if (typeof dt.seconds === 'number') {
            ms = dt.seconds * 1000;
          } else if (dt instanceof Date) {
            ms = dt.getTime();
          }
        }
        return ms >= startMs && ms <= endMs;
      });

      const periodKpis = this.calculateKPIs(periodContracts, { role, uid });

      if (tab === 'vss' || tab === 'venduto_netto' || tab === 'total_venduto') {
        return periodKpis.vss;
      }
      if (tab === 'total_contratti' || tab === 'contratti') {
        return periodKpis.totalContratti;
      }
      if (tab === 'pending_contratti') {
        return periodKpis.pendingContratti;
      }

      return periodKpis.vss;
    });
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
