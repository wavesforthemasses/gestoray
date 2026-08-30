import { db, collection, getDocs } from '$lib/firebase';
import type { KPIFetchParams, DrillDownFetchParams } from '$lib/types/moduleKPIBridge';
import { formatDate } from '$lib/utils/formatters';

export class PaymentsKPIBridge {
  /**
   * Pure domain function: Single Source of Truth (SSOT) for all KPI calculations in Payments.
   * Shared identically between Dashboard Global KPI Aggregator and Module Subpage.
   */
  static calculateKPIs(paymentsList: any[]) {
    let totalIncassato = 0;       // Imponibile netto incassato (generico)
    let totalIncassatoLordo = 0;  // Lordo totale incassato
    let totalVat = 0;             // Quota IVA totale
    let incassatoContratti = 0;   // Quota incassata allocata a contratti (GI)
    let paymentsCount = 0;

    for (const data of paymentsList) {
      if (!data || data?.derived?.deleted || data?.deleted) continue;

      const status = data.status || data.original?.status || 'registrato';
      // Regola aziendale condivisa: consideriamo solo movimenti accertati (registrato / pagato)
      if (status === 'annullato' || status === 'stornato') continue;

      const net = Number(data.netAmount ?? data.original?.netAmount ?? data.grossAmount ?? data.amount ?? 0);
      const gross = Number(data.grossAmount ?? data.amount ?? data.original?.amount ?? 0);
      const vat = Number(data.vatAmount ?? 0);

      totalIncassato += net;
      totalIncassatoLordo += gross;
      totalVat += vat;
      paymentsCount += 1;

      // Quote allocate su contratti
      if (Array.isArray(data.contractAllocations)) {
        for (const alloc of data.contractAllocations) {
          incassatoContratti += Number(alloc.amount || 0);
        }
      }
    }

    return {
      totalIncassato,
      total_incassato: totalIncassato,
      totalIncassatoLordo,
      totalVat,
      incassatoContratti,
      incassato_contratti: incassatoContratti,
      gi: incassatoContratti,
      ti: totalIncassato,
      paymentsCount
    };
  }

  static async fetchKPIs({ role, uid }: KPIFetchParams) {
    try {
      const snap = await getDocs(collection(db, 'payments'));
      const list: any[] = [];
      snap.forEach((d: any) => {
        list.push({ id: d.id, ...d.data() });
      });
      return this.calculateKPIs(list);
    } catch (e) {
      console.error('Error fetching payments KPIs in bridge:', e);
      return this.calculateKPIs([]);
    }
  }

  static async fetchChartAggregations({ periods, role, uid, tab }: any) {
    let allPayments: any[] = [];
    try {
      const snap = await getDocs(collection(db, 'payments'));
      snap.forEach(d => {
        const data = d.data();
        if (data?.derived?.deleted || data?.deleted) return;
        allPayments.push({ id: d.id, ...data });
      });
    } catch (e) {
      console.error('Error fetching payments for chart aggregations:', e);
      return periods.map(() => 0);
    }

    return periods.map((p: any) => {
      const startMs = new Date(p.start).getTime();
      const endMs = new Date(p.end).getTime();

      const periodPayments = allPayments.filter(data => {
        const status = data.status || data.original?.status || 'registrato';
        if (status === 'annullato' || status === 'stornato') return false;

        const dt = data.paymentDate || data.createdAt || data.edits?.createdAt || data.original?.createdAt;
        let ms = 0;
        if (dt) {
          if (typeof dt === 'string') {
            // Support YYYY-MM-DD or ISO
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

      const periodKpis = this.calculateKPIs(periodPayments);

      if (tab === 'incassato_contratti' || tab === 'gi') {
        return periodKpis.incassatoContratti;
      }
      if (tab === 'total_incassato_lordo' || tab === 'til') {
        return periodKpis.totalIncassatoLordo;
      }
      if (tab === 'movimenti_incasso' || tab === 'mi') {
        return periodKpis.paymentsCount;
      }
      // Default: total_incassato / ti (Imponibile Netto)
      return periodKpis.totalIncassato;
    });
  }

  static async fetchDrillDownItems({ period, tab, role, uid }: DrillDownFetchParams) {
    let items: any[] = [];
    try {
      const snap = await getDocs(collection(db, 'payments'));
      snap.forEach((d: any) => {
        const data = d.data();
        if (data?.derived?.deleted || data?.deleted) return;

        const status = data.status || data.original?.status || 'registrato';
        if (status === 'annullato' || status === 'stornato') return;

        const dt = data.paymentDate || data.createdAt || data.edits?.createdAt || data.original?.createdAt;
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
        if (ms > 0 && ms >= period.start.getTime() && ms <= period.end.getTime()) {
          items.push({ id: d.id, ...data });
        }
      });
    } catch (e) {
      console.error('Error fetching payments drill down in bridge:', e);
    }

    return items.map((item) => {
      const net = Number(item.netAmount ?? item.grossAmount ?? item.amount ?? 0);
      return {
        id: item.id,
        cliente: item.clientName || 'Cliente non specificato',
        consulente: item.method ? item.method.replace('_', ' ').toUpperCase() : 'Cassa',
        data: formatDate(item.paymentDate || item.createdAt),
        valore: `€ ${(Number(net) || 0).toFixed(2)}`,
        dettaglio: `Incasso N° ${item.paymentNumber || item.id}`,
        status: item.status || 'registrato',
        link: `/dashboard/payments/${item.id}`
      };
    });
  }

  static async fetchAdminTablesData(todayStr: string) {
    return {
      adminUndistributedPayments: []
    };
  }
}
