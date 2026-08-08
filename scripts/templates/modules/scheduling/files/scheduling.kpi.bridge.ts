import { db, collection, getDocs, query, where } from '$lib/firebase';

export class SchedulingKPIBridge {
  static async fetchKPIs(context: { role: string; uid: string }): Promise<Record<string, any>> {
    try {
      const snap = await getDocs(collection(db, 'scheduling'));
      const list = snap.docs.map(d => d.data());
      const activeCount = list.filter(item => item.status === 'pianificato' || item.status === 'in_corso').length;

      return {
        activeSchedulingCount: activeCount
      };
    } catch (e) {
      console.warn('[SchedulingKPIBridge] Error fetching KPIs:', e);
      return { activeSchedulingCount: 0 };
    }
  }

  static async fetchAdminTablesData(todayStr: string): Promise<Record<string, any>> {
    return {};
  }
}
