import { db, collection, getDocs } from '$lib/firebase';
import type { KPIFetchParams } from '$lib/types/moduleKPIBridge';

export class TeamsKPIBridge {
  /**
   * Pure domain function: Single Source of Truth (SSOT) for Teams KPIs.
   */
  static calculateKPIs(teamsList: any[]) {
    let activeTeams = 0;
    let totalTeams = 0;
    let totalAssignedWorkers = 0;

    for (const t of teamsList) {
      if (!t || t?.derived?.deleted || t?.deleted) continue;
      const data = t.data ? t.data() : t;
      totalTeams++;

      const status = data.status || data.original?.status || 'attiva';
      if (status === 'attiva') {
        activeTeams++;
      }

      const members = data.members || data.original?.members || [];
      if (Array.isArray(members)) {
        totalAssignedWorkers += members.length;
      }
    }

    return {
      teams_attivi: activeTeams,
      activeTeamsCount: activeTeams,
      totalTeamsCount: totalTeams,
      totalAssignedWorkers
    };
  }

  static async fetchKPIs(context?: KPIFetchParams): Promise<Record<string, any>> {
    try {
      const snap = await getDocs(collection(db, 'teams'));
      const list: any[] = [];
      snap.forEach((d: any) => {
        list.push({ id: d.id, ...d.data() });
      });
      return this.calculateKPIs(list);
    } catch (e) {
      console.warn('[TeamsKPIBridge] Error fetching KPIs:', e);
      return this.calculateKPIs([]);
    }
  }

  static async fetchAdminTablesData(todayStr: string): Promise<Record<string, any>> {
    return {};
  }
}
