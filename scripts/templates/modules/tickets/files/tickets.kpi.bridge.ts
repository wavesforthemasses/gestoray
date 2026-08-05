import { db, collection, getDocs, query, where } from '$lib/firebase';
import type { KPIFetchParams, DrillDownFetchParams } from '$lib/types/moduleKPIBridge';
import { formatDate } from '$lib/utils/formatters';

export class TicketsKPIBridge {
  static async fetchKPIs({ role, uid }: KPIFetchParams) {
    let ticketsCount = 0;
    let ticketsOpenCount = 0;

    try {
      const snap = await getDocs(collection(db, 'tickets'));
      snap.forEach((d: any) => {
        const data = d.data();
        const status = data.status || data.original?.status;

        ticketsCount++;
        if (status === 'aperto' || status === 'in_lavorazione') {
          ticketsOpenCount++;
        }
      });
    } catch (e) {
      console.error('Error fetching tickets KPIs in bridge:', e);
    }

    return { ticketsCount, ticketsOpenCount };
  }

  static async fetchDrillDownItems({ period, tab, role, uid }: DrillDownFetchParams) {
    if (tab !== 'tickets') return [];

    let items: any[] = [];
    try {
      const snap = await getDocs(collection(db, 'tickets'));
      snap.forEach((d: any) => {
        const data = d.data();
        const dt = data.createdAt || data.edits?.createdAt || data.original?.createdAt;
        if (dt && dt >= period.start.toISOString() && dt <= period.end.toISOString()) {
          items.push({ id: d.id, ...data });
        }
      });
    } catch (e) {
      console.error('Error fetching tickets drill down in bridge:', e);
    }

    return items.map((item) => {
      const orig = item.original || {};
      return {
        id: item.id,
        cliente: item.clientName || orig.clientName || 'Cliente',
        consulente: item.assignedName || orig.assignedName || 'Supporto',
        data: formatDate(item.createdAt || orig.createdAt),
        valore: item.priority || orig.priority || 'Normale',
        dettaglio: item.subject || orig.subject || 'Ticket Assistenza',
        status: item.status || orig.status || 'Aperto',
        link: `/dashboard/tickets`
      };
    });
  }
}
