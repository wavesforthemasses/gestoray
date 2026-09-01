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

  private static cache: { data: any[]; timestamp: number } | null = null;
  private static readonly TTL_MS = 30000;

  static async fetchRawData(): Promise<any[]> {
    const now = Date.now();
    if (this.cache && (now - this.cache.timestamp) < this.TTL_MS) {
      return this.cache.data;
    }
    try {
      const snap = await getDocs(collection(db, 'deadlines'));
      const list: any[] = [];
      snap.forEach((d: any) => {
        const data = d.data();
        if (data?.derived?.deleted || data?.deleted) return;
        list.push({ id: d.id, ...data });
      });
      this.cache = { data: list, timestamp: now };
      return list;
    } catch (e) {
      console.warn('[DeadlinesKPIBridge] Error fetching deadlines in bridge:', e);
      return this.cache ? this.cache.data : [];
    }
  }

  static invalidateCache() {
    this.cache = null;
  }

  static async fetchKPIs(context?: KPIFetchParams): Promise<Record<string, any>> {
    try {
      const list = await this.fetchRawData();
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
