import { db, collection, collectionGroup, getDocs, query, where } from '$lib/firebase';
import type { KPIFetchParams, DrillDownFetchParams } from '$lib/types/moduleKPIBridge';
import { formatDate } from '$lib/utils/formatters';

export class CommissionsKPIBridge {
  static async fetchKPIs({ role, uid }: KPIFetchParams) {
    let commMaturate = 0;

    try {
      const versionsSnap = await getDocs(query(collectionGroup(db, 'versions'), where('status', '==', 'finalized')));
      versionsSnap.docs.forEach((vDoc: any) => {
        const version = vDoc.data();
        if (role === 'commerciale') {
          const myBreakdown = version.breakdown?.find((b: any) => b.uid === uid);
          if (myBreakdown) commMaturate += (myBreakdown.commission || 0);
        } else {
          commMaturate += (version.totalCommissions || 0);
        }
      });
    } catch (e) {
      console.error('Error fetching commissions KPIs in bridge:', e);
    }

    return { commMaturate };
  }

  static async fetchAdminTablesData() {
    const adminPendingCommissions: any[] = [];
    const adminFinalizedCommissions: any[] = [];

    try {
      const allCommSnap = await getDocs(collection(db, 'commissions_closings'));
      allCommSnap.forEach((d: any) => {
        const data = d.data();
        const status = data.latestStatus || 'draft';
        if (status === 'finalized') {
          if (!data.isPaid) adminFinalizedCommissions.push({ id: d.id, ...data });
        } else {
          adminPendingCommissions.push({ id: d.id, ...data });
        }
      });
      adminPendingCommissions.sort((a, b) => b.id.localeCompare(a.id));
      adminFinalizedCommissions.sort((a, b) => b.id.localeCompare(a.id));
    } catch (e) {
      console.error('Error fetching admin commissions in bridge:', e);
    }

    return { adminPendingCommissions, adminFinalizedCommissions };
  }

  static async markCommissionPaid(periodId: string, uid: string) {
    const { updateDoc, doc } = await import('$lib/firebase');
    await updateDoc(doc(db, 'commissions_closings', periodId), {
      isPaid: true,
      paidAt: new Date().toISOString(),
      paidBy: uid
    });
  }

  static async fetchDrillDownItems({ period, tab, role, uid }: DrillDownFetchParams) {
    if (tab !== 'provvigioni_maturate') return [];

    const isComm = role === 'commerciale';
    let items: any[] = [];

    try {
      const snap = await getDocs(query(collection(db, 'commissions_closings'), where('latestStatus', '==', 'finalized'), where('periodEnd', '>=', period.start.toISOString()), where('periodEnd', '<=', period.end.toISOString())));
      await Promise.all(snap.docs.map(async (d: any) => {
        const vSnap = await getDocs(query(collection(db, 'commissions_closings', d.id, 'versions'), where('status', '==', 'finalized')));
        if (!vSnap.empty) {
          const version = vSnap.docs[0].data();
          const generatedAt = version.generatedAt || new Date(d.id + "-01").toISOString();
          let amount = 0;
          if (isComm) {
            const myBreakdown = version.breakdown?.find((b: any) => b.uid === uid);
            if (myBreakdown) amount = myBreakdown.commission || 0;
          } else {
            amount = version.totalCommissions || 0;
          }
          if (amount > 0) {
            items.push({ id: d.id, original: { date: generatedAt, amount } });
          }
        }
      }));
    } catch (e) {
      console.error('Error fetching commissions drill down in bridge:', e);
    }

    return items.map((item) => {
      const orig = item.original || {};
      return {
        id: item.id,
        cliente: `Chiusura ${item.id}`,
        consulente: isComm ? 'Personali' : 'Rete Commerciale',
        data: formatDate(orig.date),
        valore: orig.amount || 0,
        dettaglio: 'Provvigioni Maturate',
        status: 'Finalizzato',
        link: `/dashboard/commissions`
      };
    });
  }
}
