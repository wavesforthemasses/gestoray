import { db, collection, getDocs } from '$lib/firebase';
import type { KPIFetchParams, DrillDownFetchParams } from '$lib/types/moduleKPIBridge';
import { formatDate } from '$lib/utils/formatters';

export class InterventiKPIBridge {
  static async fetchKPIs({ role, uid }: KPIFetchParams) {
    let interventiCount = 0;
    let interventiPendingCount = 0;

    try {
      let docs: any[] = [];
      try {
        const snap = await getDocs(collection(db, 'interventions'));
        docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      } catch (e) {}

      if (docs.length === 0) {
        try {
          const snapLegacy = await getDocs(collection(db, 'interventi'));
          docs = snapLegacy.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (e) {}
      }

      docs.forEach((data: any) => {
        if (data?.derived?.deleted || data?.deleted) return;
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
      let docs: any[] = [];
      try {
        const snap = await getDocs(collection(db, 'interventions'));
        docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      } catch (e) {}

      if (docs.length === 0) {
        try {
          const snapLegacy = await getDocs(collection(db, 'interventi'));
          docs = snapLegacy.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (e) {}
      }

      docs.forEach((data: any) => {
        if (data?.derived?.deleted || data?.deleted) return;
        const dt = data.date || data.scheduledDate || data.original?.date || data.createdAt;
        if (dt && dt >= period.start.toISOString() && dt <= period.end.toISOString()) {
          items.push(data);
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
        data: formatDate(item.date || item.scheduledDate || orig.date),
        valore: '-',
        dettaglio: item.notes || item.description || orig.notes || 'Intervento Tecnico',
        status: item.status || orig.status || 'Pianificato',
        link: `/dashboard/interventi`
      };
    });
  }
}
