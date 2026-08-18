import type { ModuleActivitiesBridgeSpec, TargetSearchResult, TargetSummary } from '$lib/types/moduleActivitiesBridge';
import { ContractsService } from './contracts.service';
import type { ContractItem } from './schema';

export const ContractsActivitiesBridge: ModuleActivitiesBridgeSpec<ContractItem> = {
  moduleId: 'contracts',
  targetType: 'contract',
  targetLabel: 'Contratto / Preventivo',
  targetIcon: 'FileText',

  async searchTargets(searchVal: string, tenantId?: string): Promise<TargetSearchResult<ContractItem>[]> {
    try {
      const contracts = await ContractsService.getContracts();
      let filtered = contracts;
      if (searchVal && searchVal.trim()) {
        const queryTerm = searchVal.trim().toLowerCase();
        filtered = contracts.filter(c => {
          const title = (c.title || '').toLowerCase();
          const num = (c.contractNumber || '').toLowerCase();
          const client = (c.clientName || '').toLowerCase();
          return title.includes(queryTerm) || num.includes(queryTerm) || client.includes(queryTerm);
        });
      }
      return filtered.slice(0, 30).map(c => {
        const subtext = [c.clientName, c.status].filter(Boolean).join(' • ');
        return {
          id: c.id,
          label: `${c.contractNumber ? `[${c.contractNumber}] ` : ''}${c.title || 'Contratto'}`,
          subtext,
          badge: c.status,
          raw: c
        };
      });
    } catch (e) {
      console.warn('[ContractsActivitiesBridge] Errore ricerca contratti:', e);
      return [];
    }
  },

  async getTargetSummary(id: string, tenantId?: string): Promise<TargetSummary | null> {
    try {
      const contract = await ContractsService.getContractById(id);
      if (!contract) return null;
      return {
        id: contract.id,
        name: `${contract.contractNumber ? `[${contract.contractNumber}] ` : ''}${contract.title || 'Contratto'}`,
        targetType: 'contract',
        meta: {
          contractNumber: contract.contractNumber,
          clientId: contract.clientId,
          clientName: contract.clientName,
          status: contract.status,
          totalAmount: contract.totalAmount
        }
      };
    } catch (e) {
      console.warn('[ContractsActivitiesBridge] Errore lettura contratto:', e);
      return null;
    }
  }
};
