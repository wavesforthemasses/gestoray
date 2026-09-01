import { db, collection, getDocs } from '$lib/firebase';
import type { KPIFetchParams, DrillDownFetchParams } from '$lib/types/moduleKPIBridge';
import { formatDate } from '$lib/utils/formatters';

export class TicketsKPIBridge {
  /**
   * Pure domain function: Single Source of Truth (SSOT) for Tickets KPIs.
   */
  static calculateKPIs(ticketsList: any[]) {
    let ticketsCount = 0;
    let ticketsOpenCount = 0;
    let totalResolutionHours = 0;
    let resolvedCount = 0;

    for (const d of ticketsList) {
      if (!d || d?.derived?.deleted || d?.deleted) continue;
      const data = d.data ? d.data() : d;
      ticketsCount++;

      const status = data.status || data.original?.status || 'aperto';
      if (['aperto', 'in_lavorazione'].includes(status)) {
        ticketsOpenCount++;
      }

      const resHours = Number(data.resolutionTimeHours ?? data.original?.resolutionTimeHours ?? 0);
      if (resHours > 0) {
        totalResolutionHours += resHours;
        resolvedCount++;
      }
    }

    const avgTmrHours = resolvedCount > 0 ? totalResolutionHours / resolvedCount : 0;

    return {
      ticket_aperti: ticketsOpenCount,
      ticketsOpenCount,
      tmr: Number(avgTmrHours.toFixed(1)),
      ticketsCount,
      total_tickets: ticketsCount
    };
  }

  private static cache: { data: any[]; timestamp: number } | null = null;
  private static readonly TTL_MS = 30000;

  static async fetchRawData(): Promise<any[]> {
    const now = Date.now();
    if (this.cache && (now - this.cache.timestamp) < this.TTL_MS) {
      return this.cache.data;
    }
    try {
      const snap = await getDocs(collection(db, 'tickets'));
      const list: any[] = [];
      snap.forEach((d: any) => {
        const data = d.data();
        if (data?.derived?.deleted || data?.deleted) return;
        list.push({ id: d.id, ...data });
      });
      this.cache = { data: list, timestamp: now };
      return list;
    } catch (e) {
      console.error('Error fetching tickets in bridge:', e);
      return this.cache ? this.cache.data : [];
    }
  }

  static invalidateCache() {
    this.cache = null;
  }

  static async fetchKPIs({ role, uid }: KPIFetchParams) {
    try {
      const list = await this.fetchRawData();
      return this.calculateKPIs(list);
    } catch (e) {
      console.error('Error fetching tickets KPIs in bridge:', e);
      return this.calculateKPIs([]);
    }
  }

  static async fetchDrillDownItems({ period, tab, role, uid }: DrillDownFetchParams) {
    if (tab !== 'tickets' && tab !== 'ticket_aperti') return [];

    let items: any[] = [];
    try {
      const allTickets = await this.fetchRawData();
      allTickets.forEach((data: any) => {
        const dt = data.createdAt || data.edits?.createdAt || data.original?.createdAt;
        let ms = 0;
        if (dt) {
          if (typeof dt === 'string') ms = new Date(dt).getTime();
          else if (typeof dt.toDate === 'function') ms = dt.toDate().getTime();
          else if (typeof dt.seconds === 'number') ms = dt.seconds * 1000;
          else if (dt instanceof Date) ms = dt.getTime();
        }
        if (ms > 0 && ms >= period.start.getTime() && ms <= period.end.getTime()) {
          items.push(data);
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

  static async fetchChartAggregations({ periods, role, uid, tab }: any) {
    if (tab !== 'ticket_aperti' && tab !== 'tmr') return periods.map(() => 0);
    
    let allTickets: any[] = [];
    try {
      allTickets = await this.fetchRawData();
    } catch (e) {
      console.error('Error fetching tickets for chart aggregations:', e);
      return periods.map(() => 0);
    }

    return periods.map((p: any) => {
      const startMs = new Date(p.start).getTime();
      const endMs = new Date(p.end).getTime();

      const periodTickets = allTickets.filter(data => {
        const dt = data.createdAt || data.edits?.createdAt || data.original?.createdAt;
        let ms = 0;
        if (dt) {
          if (typeof dt === 'string') ms = new Date(dt).getTime();
          else if (typeof dt.toDate === 'function') ms = dt.toDate().getTime();
          else if (typeof dt.seconds === 'number') ms = dt.seconds * 1000;
          else if (dt instanceof Date) ms = dt.getTime();
        }
        return ms >= startMs && ms <= endMs;
      });

      const periodKpis = this.calculateKPIs(periodTickets);

      if (tab === 'ticket_aperti') {
        return periodKpis.ticket_aperti;
      }
      if (tab === 'tmr') {
        return periodKpis.tmr;
      }
      return 0;
    });
  }
}
