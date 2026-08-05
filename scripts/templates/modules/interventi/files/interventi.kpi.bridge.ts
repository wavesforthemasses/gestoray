import { db, collection, getDocs, query, where } from '$lib/firebase';
import type { KPIFetchParams, DrillDownFetchParams } from '$lib/types/moduleKPIBridge';
import { formatDate } from '$lib/utils/formatters';

export class InterventiKPIBridge {
  static async fetchKPIs({ role, uid }: KPIFetchParams) {
    let interventiCount = 0;
    let interventiPendingCount = 0;

    try {
      const snap = await getDocs(collection(db, 'interventi'));
      snap.forEach((d: any) => {
        const data = d.data();
        const status = data.status || data.original?.status;
        const isMyDoc = data.technicianId === uid || data.original?.technicianId === uid;

        if (role !== 'tecnico' || isMyDoc) {
          interventiCount++;
          if (status === 'pianificato' || status === 'in_corso') {
            interventiPendingCount++;
          }
        }
      });
    } catch (e) {
      console.error('Error fetching interventi KPIs in bridge:', e);
    }

    return { interventiCount, interventiPendingCount };
  }

  static async fetchDrillDownItems({ period, tab, role, uid }: DrillDownFetchParams) {
    if (tab !== 'interventi') return [];

    let items: any[] = [];
    try {
      const snap = await getDocs(collection(db, 'interventi'));
      snap.forEach((d: any) => {
        const data = d.data();
        const dt = data.date || data.original?.date || data.createdAt;
        if (dt && dt >= period.start.toISOString() && dt <= period.end.toISOString()) {
          items.push({ id: d.id, ...data });
        }
      });
    } catch (e) {
      console.error('Error fetching interventi drill down in bridge:', e);
    }

    return items.map((item) => {
      const orig = item.original || {};
      return {
        id: item.id,
        cliente: item.clientName || orig.clientName || 'Cliente',
        consulente: item.technicianName || orig.technicianName || 'Tecnico',
        data: formatDate(item.date || orig.date),
        valore: '-',
        dettaglio: item.notes || orig.notes || 'Intervento Tecnico',
        status: item.status || orig.status || 'Pianificato',
        link: `/dashboard/interventi`
      };
    });
  }
}
