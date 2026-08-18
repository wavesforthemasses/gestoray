import type { ModuleActivitiesBridgeSpec, TargetSearchResult, TargetSummary } from '$lib/types/moduleActivitiesBridge';
import { ClientsService } from '../../routes/dashboard/clients/clients.service';
import type { ClientItem } from '../../routes/dashboard/clients/schema';

export const ClientsActivitiesBridge: ModuleActivitiesBridgeSpec<ClientItem> = {
  moduleId: 'clients',
  targetType: 'client',
  targetLabel: 'Cliente / Azienda',
  targetIcon: 'Building2',

  async searchTargets(searchVal: string, tenantId?: string): Promise<TargetSearchResult<ClientItem>[]> {
    try {
      const clients = await ClientsService.getClients();
      let filtered = clients;
      if (searchVal && searchVal.trim()) {
        const queryTerm = searchVal.trim().toLowerCase();
        filtered = clients.filter(c => {
          const name = (c.original?.name || c.name || '').toLowerCase();
          const vat = (c.original?.vatNumber || c.vatNumber || '').toLowerCase();
          const city = (c.original?.city || c.city || '').toLowerCase();
          return name.includes(queryTerm) || vat.includes(queryTerm) || city.includes(queryTerm);
        });
      }
      return filtered.slice(0, 30).map(c => {
        const name = c.original?.name || c.name || 'Cliente';
        const city = c.original?.city || c.city;
        const piva = c.original?.vatNumber || c.vatNumber;
        const subtext = [city, piva].filter(Boolean).join(' • ');
        return {
          id: c.id,
          label: name,
          subtext,
          phone: c.original?.phone || c.phone,
          email: c.original?.email || c.email,
          address: c.original?.address || c.address,
          raw: c
        };
      });
    } catch (e) {
      console.warn('[ClientsActivitiesBridge] Errore ricerca clienti:', e);
      return [];
    }
  },

  async getTargetSummary(id: string, tenantId?: string): Promise<TargetSummary | null> {
    try {
      const client = await ClientsService.getClient(id);
      if (!client) return null;
      const name = client.original?.name || client.name || 'Cliente';
      return {
        id: client.id,
        name,
        targetType: 'client',
        email: client.original?.email || client.email,
        phone: client.original?.phone || client.phone,
        address: client.original?.address || client.address,
        meta: {
          vatNumber: client.original?.vatNumber || client.vatNumber,
          city: client.original?.city || client.city
        }
      };
    } catch (e) {
      console.warn('[ClientsActivitiesBridge] Errore lettura cliente:', e);
      return null;
    }
  }
};
