import { db, collection, getDocs, query, where } from '$lib/firebase';

export class SchedulingKPIBridge {
  static async fetchKPIs(context: { role: string; uid: string }): Promise<Record<string, any>> {
    try {
      let activeCount = 0;

      // 1. Count active/planned interventions
      try {
        const snapInterventions = await getDocs(collection(db, 'interventions'));
        const interventions = snapInterventions.docs.map(d => d.data());
        activeCount += interventions.filter(
          item => !item.derived?.deleted && (item.status === 'pianificato' || item.status === 'in_corso' || item.phase === 'pianificato' || item.phase === 'in_corso')
        ).length;
      } catch (e) {
        // Interventions collection might be empty or not yet created
      }

      // 2. Count active activities
      try {
        const snapActivities = await getDocs(collection(db, 'activities'));
        const activities = snapActivities.docs.map(d => d.data());
        activeCount += activities.filter(
          item => !item.derived?.deleted && (item.status === 'pianificato' || item.status === 'in_corso')
        ).length;
      } catch (e) {
        // Activities collection might be empty
      }

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
