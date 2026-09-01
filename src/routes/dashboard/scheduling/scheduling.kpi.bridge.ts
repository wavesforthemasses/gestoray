import { db, collection, getDocs, query, where } from '$lib/firebase';

export class SchedulingKPIBridge {
  /**
   * Pure domain function: Single Source of Truth (SSOT) for all Scheduling / Interventions KPIs.
   */
  static calculateKPIs(
    interventionsList: any[] = [], 
    activitiesList: any[] = [], 
    params: { role?: string | null; uid?: string | null; tenantId?: string } = {}
  ) {
    let activeInterventions = 0;
    let activeActivities = 0;

    for (const item of interventionsList) {
      if (!item || item.derived?.deleted || item.deleted) continue;
      const data = item.data ? item.data() : item;
      const status = data.status || data.phase || '';
      if (status === 'pianificato' || status === 'in_corso') {
        activeInterventions++;
      }
    }

    for (const item of activitiesList) {
      if (!item || item.derived?.deleted || item.deleted) continue;
      const data = item.data ? item.data() : item;
      const status = data.status || '';
      if (status === 'pianificato' || status === 'in_corso') {
        activeActivities++;
      }
    }

    const activeSchedulingCount = activeInterventions + activeActivities;

    return {
      activeSchedulingCount,
      activeInterventions,
      activeActivities,
      active_scheduling: activeSchedulingCount
    };
  }

  static async fetchKPIs(context: { role: string; uid: string; tenantId?: string }): Promise<Record<string, any>> {
    try {
      const interventionsList: any[] = [];
      const activitiesList: any[] = [];

      try {
        const interventionsColName = 'interventions';
        const constraints = context?.tenantId ? [where('tenantId', '==', context.tenantId)] : [];
        const q = constraints.length > 0 ? query(collection(db, interventionsColName), ...constraints) : collection(db, interventionsColName);
        const snapInterventions = await getDocs(q);
        snapInterventions.forEach(d => interventionsList.push({ id: d.id, ...d.data() }));
      } catch (e) {
        // collection might be empty or missing
      }

      try {
        const constraints = context?.tenantId ? [where('tenantId', '==', context.tenantId)] : [];
        const q = constraints.length > 0 ? query(collection(db, 'activities'), ...constraints) : collection(db, 'activities');
        const snapActivities = await getDocs(q);
        snapActivities.forEach(d => activitiesList.push({ id: d.id, ...d.data() }));
      } catch (e) {
        // collection might be empty
      }

      return this.calculateKPIs(interventionsList, activitiesList, context);
    } catch (e) {
      console.warn('[SchedulingKPIBridge] Error fetching KPIs:', e);
      return this.calculateKPIs([], [], context);
    }
  }

  static async fetchAdminTablesData(todayStr: string): Promise<Record<string, any>> {
    return {};
  }
}
