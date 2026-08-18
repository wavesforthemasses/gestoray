import { db, collection, collectionGroup, getDocs, query, where } from '$lib/firebase';
import type { KPIFetchParams, DrillDownFetchParams } from '$lib/types/moduleKPIBridge';
import { formatDate } from '$lib/utils/formatters';

export class ActivitiesKPIBridge {
  static async fetchKPIs({ role, uid }: KPIFetchParams) {
    const activityCounts: Record<string, number> = {};
    let commTotalNA = 0;

    try {
      if (role === 'commerciale') {
        const qAct = query(collectionGroup(db, 'activities'), where('original.loggedBy', '==', uid));
        const snap = await getDocs(qAct);
        snap.forEach((d: any) => {
          const t = d.data()?.original?.type || d.data()?.type;
          if (t) activityCounts[t] = (activityCounts[t] || 0) + 1;
        });

        const qNA = query(collection(db, 'clients'), where('original.createdBy', '==', uid));
        const naSnap = await getDocs(qNA);
        commTotalNA = naSnap.size;
      } else {
        const snap = await getDocs(collectionGroup(db, 'activities'));
        snap.forEach((d: any) => {
          const t = d.data()?.original?.type || d.data()?.type;
          if (t) activityCounts[t] = (activityCounts[t] || 0) + 1;
        });
      }
    } catch (e) {
      console.error('Error fetching activities KPIs in bridge:', e);
    }

    return { activityCounts, commTotalNA };
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
        consulente: item.loggedEmail || orig.loggedEmail || 'Operatore',
        data: formatDate(item.createdAt || item.edits?.createdAt || orig.createdAt || item.date),
        valore: '-',
        dettaglio: item.notes || orig.notes || 'Registrazione attività',
        status: item.type || orig.type || 'Attività',
        link: `/dashboard/clients/${item.clientId || orig.clientId}?tab=activities`
      };
    });
  }

  static async getClientActivities(clientId: string) {
    try {
      const subCol = collection(db, 'clients', clientId, 'activities');
      const snap = await getDocs(subCol);
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) {
      return [];
    }
  }
}
