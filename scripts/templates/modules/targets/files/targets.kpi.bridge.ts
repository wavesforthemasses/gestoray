import { db, collection, getDocs } from '$lib/firebase';
import type { KPIFetchParams, DrillDownFetchParams } from '$lib/types/moduleKPIBridge';
import { formatDate } from '$lib/utils/formatters';

export class TargetsKPIBridge {
  /**
   * Pure domain function: Single Source of Truth (SSOT) for all Targets KPIs.
   */
  static calculateKPIs(recordsList: any[], params: { role?: string | null; uid?: string | null } = {}) {
    const { role = '', uid = '' } = params;
    const isComm = role === 'commerciale';

    let totalBudget = 0;
    let targetRecordsCount = 0;
    let myBudget = 0;
    let myRecordsCount = 0;

    for (const d of recordsList) {
      if (!d || d?.derived?.deleted || d?.deleted) continue;
      const data = d.data ? d.data() : d;
      
      const vssTarget = Number(data.targetValues?.vss || data.targetValues?.total_incassato || 0);
      const isMyRecord = data.subjectType === 'user' && data.subjectId === uid;

      totalBudget += vssTarget;
      targetRecordsCount++;

      if (isMyRecord) {
        myBudget += vssTarget;
        myRecordsCount++;
      }
    }

    const targets_total_budget = isComm ? myBudget : totalBudget;
    const targets_achievement_rate = targetRecordsCount > 0 ? 100 : 0; // Baseline indicator

    return {
      targets_total_budget,
      targets_achievement_rate,
      total_target_records: targetRecordsCount,
      my_target_records: myRecordsCount
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
      const snap = await getDocs(collection(db, 'targets_records'));
      const list: any[] = [];
      snap.forEach((d: any) => {
        const data = d.data();
        if (data?.derived?.deleted || data?.deleted) return;
        list.push({ id: d.id, ...data });
      });
      this.cache = { data: list, timestamp: now };
      return list;
    } catch (e) {
      console.error('Error fetching targets_records in bridge:', e);
      return this.cache ? this.cache.data : [];
    }
  }

  static invalidateCache() {
    this.cache = null;
  }

  static async fetchKPIs({ role, uid }: KPIFetchParams) {
    try {
      const list = await this.fetchRawData();
      return this.calculateKPIs(list, { role, uid });
    } catch (e) {
      console.error('Error fetching targets KPIs in bridge:', e);
      return this.calculateKPIs([], { role, uid });
    }
  }

  static async fetchChartAggregations({ periods, role, uid, tab }: any) {
    let allRecords: any[] = [];
    try {
      allRecords = await this.fetchRawData();
    } catch (e) {
      console.error('Error fetching targets for chart aggregations:', e);
      return periods.map(() => 0);
    }

    return periods.map((p: any) => {
      const startMs = new Date(p.start).getTime();
      const endMs = new Date(p.end).getTime();

      const periodRecords = allRecords.filter(data => {
        const dt = data.startDate || data.edits?.createdAt;
        let ms = 0;
        if (dt) {
          ms = new Date(dt).getTime();
        }
        return ms >= startMs && ms <= endMs;
      });

      const periodKpis = this.calculateKPIs(periodRecords, { role, uid });

      if (tab === 'targets_total_budget') {
        return periodKpis.targets_total_budget;
      }

      return periodKpis.targets_achievement_rate;
    });
  }

  static async fetchDrillDownItems({ period, tab, role, uid }: DrillDownFetchParams) {
    const isComm = role === 'commerciale';
    let items: any[] = [];

    try {
      const allRecords = await this.fetchRawData();
      allRecords.forEach((data: any) => {
        const dt = data.startDate || data.edits?.createdAt;
        if (dt && new Date(dt) >= period.start && new Date(dt) <= period.end) {
          const isMyDoc = data.subjectId === uid;
          if (!isComm || isMyDoc) {
            items.push(data);
          }
        }
      });
    } catch (e) {
      console.error('Error fetching targets drilldown in bridge:', e);
    }

    return items.map(item => ({
      id: item.id,
      cliente: item.subjectName || 'Soggetto Target',
      consulente: item.planName || 'Piano Target',
      data: formatDate(item.startDate || item.edits?.createdAt),
      valore: Number(item.targetValues?.vss || item.targetValues?.total_incassato || 0),
      dettaglio: `Periodo: ${item.periodLabel || item.periodKey}`,
      status: item.status || 'submitted',
      link: `/dashboard/targets`
    }));
  }
}
