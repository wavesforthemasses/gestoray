import { db, collection, getDocs, query, where } from '$lib/firebase';
import type { KPIFetchParams } from '$lib/types/moduleKPIBridge';

export class VehiclesKPIBridge {
  /**
   * Pure domain function: Single Source of Truth (SSOT) for Vehicles KPIs.
   */
  static calculateKPIs(vehiclesList: any[]) {
    let availableCount = 0;
    let totalCount = 0;
    let maintenanceCount = 0;
    let inUseCount = 0;

    for (const v of vehiclesList) {
      if (!v || v?.derived?.deleted || v?.deleted) continue;
      const data = v.data ? v.data() : v;
      totalCount++;

      const status = data.status || data.original?.status || 'disponibile';
      if (status === 'disponibile') {
        availableCount++;
      } else if (status === 'in_manutenzione' || status === 'manutenzione') {
        maintenanceCount++;
      } else if (status === 'in_uso' || status === 'assegnato') {
        inUseCount++;
      }
    }

    return {
      available_vehicles: availableCount,
      availableVehiclesCount: availableCount,
      totalVehiclesCount: totalCount,
      maintenanceVehiclesCount: maintenanceCount,
      inUseVehiclesCount: inUseCount
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
      const snap = await getDocs(collection(db, 'vehicles'));
      const list: any[] = [];
      snap.forEach((d: any) => {
        const data = d.data();
        if (data?.derived?.deleted || data?.deleted) return;
        list.push({ id: d.id, ...data });
      });
      this.cache = { data: list, timestamp: now };
      return list;
    } catch (e) {
      console.warn('[VehiclesKPIBridge] Error fetching vehicles in bridge:', e);
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
      console.warn('[VehiclesKPIBridge] Error fetching KPIs:', e);
      return this.calculateKPIs([]);
    }
  }

  static async fetchAdminTablesData(todayStr: string): Promise<Record<string, any>> {
    return {};
  }
}
