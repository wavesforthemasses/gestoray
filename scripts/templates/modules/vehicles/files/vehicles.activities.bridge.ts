import type { ModuleActivitiesBridgeSpec, TargetSearchResult, TargetSummary } from '$lib/types/moduleActivitiesBridge';
import { VehiclesService } from './vehicles.service';
import type { VehicleItem } from './schema';

export const VehiclesActivitiesBridge: ModuleActivitiesBridgeSpec<VehicleItem> = {
  moduleId: 'vehicles',
  targetType: 'vehicle',
  targetLabel: 'Mezzo Aziendale',
  targetIcon: 'Truck',

  async searchTargets(searchVal: string, _tenantId?: string): Promise<TargetSearchResult<VehicleItem>[]> {
    try {
      const vehicles = await VehiclesService.getVehicles();
      let filtered = vehicles;
      if (searchVal && searchVal.trim()) {
        const queryTerm = searchVal.trim().toLowerCase();
        filtered = vehicles.filter(v => {
          const name = (v.name || '').toLowerCase();
          const plate = (v.licensePlate || '').toLowerCase();
          const code = (v.code || '').toLowerCase();
          return name.includes(queryTerm) || plate.includes(queryTerm) || code.includes(queryTerm);
        });
      }
      return filtered.slice(0, 30).map(v => {
        const subtext = [v.type, v.code].filter(Boolean).join(' • ');
        return {
          id: v.id,
          label: `${v.name}${v.licensePlate ? ` (${v.licensePlate})` : ''}`,
          subtext,
          badge: v.status,
          raw: v
        };
      });
    } catch (e) {
      console.warn('[VehiclesActivitiesBridge] Errore ricerca mezzi:', e);
      return [];
    }
  },

  async getTargetSummary(id: string, _tenantId?: string): Promise<TargetSummary | null> {
    try {
      const vehicle = await VehiclesService.getVehicleById(id);
      if (!vehicle) return null;
      return {
        id: vehicle.id,
        name: `${vehicle.name}${vehicle.licensePlate ? ` (${vehicle.licensePlate})` : ''}`,
        targetType: 'vehicle',
        meta: {
          licensePlate: vehicle.licensePlate || '',
          code: vehicle.code || '',
          type: vehicle.type,
          status: vehicle.status
        }
      };
    } catch (e) {
      console.warn('[VehiclesActivitiesBridge] Errore lettura mezzo:', e);
      return null;
    }
  }
};
