import { db, collection, query, where, getCountFromServer, getAggregateFromServer, average, getDocs } from '$lib/firebase';
import type { KPIFetchParams, DrillDownFetchParams } from '$lib/types/moduleKPIBridge';
import { formatDate } from '$lib/utils/formatters';

export class TicketsKPIBridge {
  static async fetchKPIs({ role, uid }: KPIFetchParams) {
    let ticketsCount = 0;
    let ticketsOpenCount = 0;
    let avgTmrHours = 0;

    try {
      const ticketsRef = collection(db, 'tickets');

      // 1. Ticket Aperti (Count aggregation)
      const qOpen = query(ticketsRef, where('status', 'in', ['aperto', 'in_lavorazione']));
      const snapOpen = await getCountFromServer(qOpen);
      ticketsOpenCount = snapOpen.data().count;

      // 2. TMR: Tempo Medio Risoluzione (Average aggregation on resolved/closed tickets)
      // Since resolutionTimeHours is only set on resolved/closed tickets, we can just aggregate over all tickets where resolutionTimeHours > 0.
      const qResolved = query(ticketsRef, where('resolutionTimeHours', '>', 0));
      const snapAgg = await getAggregateFromServer(qResolved, {
        tmr: average('resolutionTimeHours')
      });
      avgTmrHours = snapAgg.data().tmr || 0;
      
    } catch (e) {
      console.error('Error fetching tickets KPIs in bridge:', e);
    }

    return { 
      ticket_aperti: ticketsOpenCount,
      tmr: Number(avgTmrHours.toFixed(1))
    };
  }

  static async fetchDrillDownItems({ period, tab, role, uid }: DrillDownFetchParams) {
    if (tab !== 'tickets') return [];

    let items: any[] = [];
    try {
      const snap = await getDocs(collection(db, 'tickets'));
      snap.forEach((d: any) => {
        const data = d.data();
        const dt = data.createdAt || data.edits?.createdAt || data.original?.createdAt;
        let ms = 0;
        if (dt) {
          if (typeof dt === 'string') ms = new Date(dt).getTime();
          else if (typeof dt.toDate === 'function') ms = dt.toDate().getTime();
          else if (typeof dt.seconds === 'number') ms = dt.seconds * 1000;
          else if (dt instanceof Date) ms = dt.getTime();
        }
        if (ms > 0 && ms >= period.start.getTime() && ms <= period.end.getTime()) {
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

  static async fetchChartAggregations({ periods, role, uid, tab }: any) {
    if (tab !== 'ticket_aperti' && tab !== 'tmr') return periods.map(() => 0);
    
    let allTickets: any[] = [];
    try {
      const snap = await getDocs(collection(db, 'tickets'));
      snap.forEach(d => allTickets.push(d.data()));
    } catch (e) {
      console.error('Error fetching tickets for chart aggregations:', e);
      return periods.map(() => 0);
    }

    console.log("ALL TICKETS IN BRIDGE:", allTickets.length, "TAB:", tab);

    return periods.map((p: any) => {
      const startMs = new Date(p.start).getTime();
      const endMs = new Date(p.end).getTime();
      
      const ticketsInPeriod = allTickets.filter(data => {
        const dt = data.createdAt || data.edits?.createdAt || data.original?.createdAt;
        let ms = 0;
        if (dt) {
          if (typeof dt === 'string') ms = new Date(dt).getTime();
          else if (typeof dt.toDate === 'function') ms = dt.toDate().getTime();
          else if (typeof dt.seconds === 'number') ms = dt.seconds * 1000;
          else if (dt instanceof Date) ms = dt.getTime();
        }
        if (ms > 0 && ms >= startMs && ms <= endMs) {
          console.log("TICKET FOUND IN PERIOD:", new Date(ms), "PERIOD:", new Date(startMs), "TO", new Date(endMs));
          return true;
        }
        return false;
      });

      if (tab === 'ticket_aperti') {
        console.log("RETURNING ticket_aperti:", ticketsInPeriod.length);
        return ticketsInPeriod.length; 
      }
      if (tab === 'tmr') {
        const resolved = ticketsInPeriod.filter(t => t.resolutionTimeHours > 0);
        if (resolved.length === 0) return 0;
        const sum = resolved.reduce((acc, t) => acc + t.resolutionTimeHours, 0);
        return Number((sum / resolved.length).toFixed(1));
      }
      return 0;
    });
  }
}
