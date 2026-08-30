import { db, collection, getDocs } from '$lib/firebase';
import type { KPIFetchParams } from '$lib/types/moduleKPIBridge';

export class DeadlinesKPIBridge {
  /**
   * Pure domain function: Single Source of Truth (SSOT) for Deadlines KPIs.
   */
  static calculateKPIs(deadlinesList: any[], referenceDate = new Date()) {
    const now = referenceDate;
    const next30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    let upcomingCount = 0;
    let expiredCount = 0;
    let totalCount = 0;

    for (const item of deadlinesList) {
      if (!item || item?.derived?.deleted || item?.deleted) continue;
      const data = item.data ? item.data() : item;
      totalCount++;

      const status = data.status || data.original?.status;
      if (status === 'archiviata' || status === 'rinnovata') continue;

      const expDateStr = data.expiryDate || data.original?.expiryDate;
      if (!expDateStr) continue;

      const d = new Date(expDateStr);
      if (d < now) {
        expiredCount++;
      } else if (d >= now && d <= next30Days) {
        upcomingCount++;
      }
    }

    return {
      upcoming_deadlines: upcomingCount,
      upcomingDeadlinesCount: upcomingCount,
      expiredDeadlinesCount: expiredCount,
      totalDeadlinesCount: totalCount
    };
  }

  static async fetchKPIs(context?: KPIFetchParams): Promise<Record<string, any>> {
    try {
      const snap = await getDocs(collection(db, 'deadlines'));
      const list: any[] = [];
      snap.forEach((d: any) => {
        list.push({ id: d.id, ...d.data() });
      });
      return this.calculateKPIs(list);
    } catch (e) {
      console.warn('[DeadlinesKPIBridge] Error fetching KPIs:', e);
      return this.calculateKPIs([]);
    }
  }

  static async fetchAdminTablesData(todayStr: string): Promise<Record<string, any>> {
    return {};
  }
}
