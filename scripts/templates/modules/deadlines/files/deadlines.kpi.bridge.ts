import { db, collection, getDocs } from '$lib/firebase';

export class DeadlinesKPIBridge {
  static async fetchKPIs(context: { role: string; uid: string }): Promise<Record<string, any>> {
    try {
      const snap = await getDocs(collection(db, 'deadlines'));
      const list = snap.docs.map(d => d.data());
      const now = new Date();
      const next30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      const upcomingCount = list.filter(item => {
        if (item.status === 'archiviata' || item.status === 'rinnovata') return false;
        if (!item.expiryDate) return false;
        const d = new Date(item.expiryDate);
        return d >= now && d <= next30Days;
      }).length;

      return {
        upcomingDeadlinesCount: upcomingCount
      };
    } catch (e) {
      console.warn('[DeadlinesKPIBridge] Error fetching KPIs:', e);
      return { upcomingDeadlinesCount: 0 };
    }
  }

  static async fetchAdminTablesData(todayStr: string): Promise<Record<string, any>> {
    return {};
  }
}
