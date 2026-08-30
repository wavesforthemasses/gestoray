import { db, collection, collectionGroup, getDocs, query, where } from '$lib/firebase';
import type { KPIFetchParams, DrillDownFetchParams } from '$lib/types/moduleKPIBridge';
import { formatDate } from '$lib/utils/formatters';

export class ActivitiesKPIBridge {
  /**
   * Pure domain function: Single Source of Truth (SSOT) for Activities KPIs.
   */
  static calculateKPIs(activitiesList: any[], params: { role?: string | null; uid?: string | null } = {}) {
    const { role = '', uid = '' } = params;
    const isComm = role === 'commerciale';

    const activityCounts: Record<string, number> = {};
    let totalActivities = 0;

    for (const d of activitiesList) {
      if (!d || d?.derived?.deleted || d?.deleted) continue;
      const data = d.data ? d.data() : d;
      const orig = data.original || {};
      const logged = orig.loggedBy || data.loggedBy;

      if (isComm && uid && logged !== uid) continue;

      totalActivities++;
      const t = orig.type || data.type;
      if (t) {
        activityCounts[t] = (activityCounts[t] || 0) + 1;
      }
    }

    return {
      activityCounts,
      total_activities: totalActivities,
      totalActivities
    };
  }

  static async fetchKPIs({ role, uid }: KPIFetchParams) {
    let commTotalNA = 0;
    try {
      let snap;
      if (role === 'commerciale') {
        const qAct = query(collectionGroup(db, 'activities'), where('original.loggedBy', '==', uid));
        snap = await getDocs(qAct);

        const qNA = query(collection(db, 'clients'), where('original.createdBy', '==', uid));
        const naSnap = await getDocs(qNA);
        commTotalNA = naSnap.size;
      } else {
        snap = await getDocs(collectionGroup(db, 'activities'));
      }

      const list: any[] = [];
      snap.forEach((d: any) => {
        list.push({ id: d.id, ...d.data() });
      });

      const res = this.calculateKPIs(list, { role, uid });
      return { ...res, commTotalNA };
    } catch (e) {
      console.error('Error fetching activities KPIs in bridge:', e);
      return { ...this.calculateKPIs([], { role, uid }), commTotalNA: 0 };
    }
  }

  static async fetchChartAggregations({ periods, role, uid, tab }: any) {
    let allActivities: any[] = [];
    try {
      const snap = await getDocs(collectionGroup(db, 'activities'));
      snap.forEach(d => {
        const data = d.data();
        if (data?.derived?.deleted || data?.deleted) return;
        allActivities.push({ id: d.id, ...data });
      });
    } catch (e) {
      console.error('Error fetching activities for chart aggregations:', e);
      return periods.map(() => 0);
    }

    return periods.map((p: any) => {
      const startMs = new Date(p.start).getTime();
      const endMs = new Date(p.end).getTime();

      const periodActs = allActivities.filter(data => {
        const orig = data.original || {};
        const dt = data.createdAt || data.edits?.createdAt || orig.createdAt || data.date;
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

      const kpis = this.calculateKPIs(periodActs, { role, uid });
      if (tab && kpis.activityCounts[tab] !== undefined) {
        return kpis.activityCounts[tab];
      }
      return kpis.totalActivities;
    });
  }

  static async fetchDrillDownItems({ period, tab, role, uid, clientFilter, vendorFilter }: DrillDownFetchParams) {
    const isComm = role === 'commerciale';
    const matchQuery = (val: string | undefined, q: string) => !q || (val?.toLowerCase().includes(q.toLowerCase()) || false);
    let items: any[] = [];

    try {
      const snap = await getDocs(collectionGroup(db, 'activities'));
      snap.forEach((d: any) => {
        const data = d.data();
        const orig = data.original || {};
        const dt = data.createdAt || data.edits?.createdAt || orig.createdAt || data.date;
        const actType = orig.type || data.type;
        const logged = orig.loggedBy || data.loggedBy;

        if (actType === tab && dt && dt >= period.start.toISOString() && dt <= period.end.toISOString()) {
          if (!isComm || logged === uid) {
            items.push({ id: d.id, ...data });
          }
        }
      });
    } catch (e) {
      console.error('Error fetching activities drill down in bridge:', e);
    }

    if (clientFilter) items = items.filter(i => matchQuery(i.clientName || i.original?.clientName, clientFilter));
    if (vendorFilter) items = items.filter(i => (i.loggedBy || i.original?.loggedBy) === vendorFilter);

    return items.map((item) => {
      const orig = item.original || {};
      return {
        id: item.id,
        cliente: item.clientName || orig.clientName || 'Cliente',
        consulente: item.loggedByName || orig.loggedByName || 'Commerciale',
        data: formatDate(item.createdAt || item.date || orig.createdAt),
        valore: orig.type || item.type || 'Attività',
        dettaglio: orig.notes || item.notes || 'Note attività',
        status: orig.status || item.status || 'Completata',
        link: `/dashboard/clients/${item.clientId || orig.clientId || ''}`
      };
    });
  }
}
