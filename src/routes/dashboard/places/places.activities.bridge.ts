import type { ModuleActivitiesBridgeSpec, TargetSearchResult, TargetSummary } from '$lib/types/moduleActivitiesBridge';
import { PlacesService } from './places.service';
import type { PlaceItem } from './schema';

export const PlacesActivitiesBridge: ModuleActivitiesBridgeSpec<PlaceItem> = {
  moduleId: 'places',
  targetType: 'place',
  targetLabel: 'Luogo / Impianto / Sede',
  targetIcon: 'MapPin',

  async searchTargets(searchVal: string, tenantId?: string): Promise<TargetSearchResult<PlaceItem>[]> {
    try {
      const places = await PlacesService.getPlaces();
      let filtered = places;
      if (searchVal && searchVal.trim()) {
        const queryTerm = searchVal.trim().toLowerCase();
        filtered = places.filter(p => {
          const name = (p.name || '').toLowerCase();
          const client = (p.clientName || '').toLowerCase();
          const address = (p.address || '').toLowerCase();
          const city = (p.city || '').toLowerCase();
          return name.includes(queryTerm) || client.includes(queryTerm) || address.includes(queryTerm) || city.includes(queryTerm);
        });
      }
      return filtered.slice(0, 30).map(p => {
        const subtext = [p.clientName, p.city || p.address].filter(Boolean).join(' • ');
        return {
          id: p.id,
          label: p.name,
          subtext,
          address: p.address,
          raw: p
        };
      });
    } catch (e) {
      console.warn('[PlacesActivitiesBridge] Errore ricerca luoghi:', e);
      return [];
    }
  },

  async getTargetSummary(id: string, tenantId?: string): Promise<TargetSummary | null> {
    try {
      const place = await PlacesService.getPlace(id);
      if (!place) return null;
      return {
        id: place.id,
        name: place.name,
        targetType: 'place',
        address: place.address,
        meta: {
          clientId: place.clientId,
          clientName: place.clientName,
          typeId: place.typeId
        }
      };
    } catch (e) {
      console.warn('[PlacesActivitiesBridge] Errore lettura luogo:', e);
      return null;
    }
  }
};
