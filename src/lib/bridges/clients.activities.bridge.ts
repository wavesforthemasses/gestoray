import type { ModuleActivitiesBridgeSpec, TargetSearchResult, TargetSummary } from '$lib/types/moduleActivitiesBridge';
import { ClientsService } from '../../routes/dashboard/clients/clients.service';
import type { ClientItem } from '../../routes/dashboard/clients/schema';

function extractClientDisplayName(client: ClientItem): string {
  const orig = client.original || {};
  return `${orig.nome || ''} ${orig.cognome || ''}`.trim() || 'Cliente';
}

function extractClientFiscalId(client: ClientItem): string {
  const orig = client.original || {};
  return orig.partitaIva || orig.codiceFiscale || orig.fiscalId || '';
}

export const ClientsActivitiesBridge: ModuleActivitiesBridgeSpec<ClientItem> = {
  moduleId: 'clients',
  targetType: 'client',
  targetLabel: 'Cliente / Azienda',
  targetIcon: 'Building2',

  async searchTargets(searchVal: string, _tenantId?: string): Promise<TargetSearchResult<ClientItem>[]> {
    try {
      const clients = await ClientsService.getClients();
      let filtered = clients;
      if (searchVal && searchVal.trim()) {
        const queryTerm = searchVal.trim().toLowerCase();
        filtered = clients.filter(c => {
          const name = extractClientDisplayName(c).toLowerCase();
          const vat = extractClientFiscalId(c).toLowerCase();
          return name.includes(queryTerm) || vat.includes(queryTerm);
        });
      }
      return filtered.slice(0, 30).map(c => {
        const orig = c.original || {};
        const name = extractClientDisplayName(c);
        const piva = extractClientFiscalId(c);
        const subtext = piva ? `P.IVA/CF: ${piva}` : (orig.email || '');
        return {
          id: c.id,
          label: name,
          subtext,
          phone: orig.phone || orig.mainPhone || '',
          email: orig.email || orig.emailContatto || '',
          address: '',
          raw: c
        };
      });
    } catch (e) {
      console.warn('[ClientsActivitiesBridge] Errore ricerca clienti:', e);
      return [];
    }
  },

  async getTargetSummary(id: string, _tenantId?: string): Promise<TargetSummary | null> {
    try {
      const client = await ClientsService.getClient(id);
      if (!client) return null;
      const orig = client.original || {};
      const name = extractClientDisplayName(client);
      return {
        id: client.id,
        name,
        targetType: 'client',
        url: `/dashboard/clients/${client.id}`,
        email: orig.email || orig.emailContatto || '',
        phone: orig.phone || orig.mainPhone || '',
        address: '',
        meta: {
          vatNumber: extractClientFiscalId(client),
          clientCode: orig.clientCode || ''
        }
      };
    } catch (e) {
      console.warn('[ClientsActivitiesBridge] Errore lettura cliente:', e);
      return null;
    }
  }
};
