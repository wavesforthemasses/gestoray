import type { 
  ActivityTargetType, 
  ModuleActivitiesBridgeSpec, 
  TargetSearchResult, 
  TargetSummary 
} from '$lib/types/moduleActivitiesBridge';
import type { ActivityType } from './schema';

export interface TargetTypeOption {
  targetType: ActivityTargetType;
  targetLabel: string;
  targetIcon: string;
  moduleId: string;
  isCore: boolean;
}

export const KNOWN_TARGET_TYPES: TargetTypeOption[] = [
  { targetType: 'contact', targetLabel: 'Contatto / Persona', targetIcon: 'UserCheck', moduleId: 'contacts', isCore: true },
  { targetType: 'client', targetLabel: 'Cliente / Azienda', targetIcon: 'Building2', moduleId: 'clients', isCore: true },
  { targetType: 'user', targetLabel: 'Utente Interno / Dipendente', targetIcon: 'Users', moduleId: 'users', isCore: true },
  { targetType: 'place', targetLabel: 'Luogo / Impianto', targetIcon: 'MapPin', moduleId: 'places', isCore: false },
  { targetType: 'vehicle', targetLabel: 'Mezzo Aziendale', targetIcon: 'Truck', moduleId: 'vehicles', isCore: false },
  { targetType: 'contract', targetLabel: 'Contratto / Offerta', targetIcon: 'FileText', moduleId: 'contracts', isCore: false }
];

export class ActivitiesBridgeOrchestrator {
  /**
   * Restituisce i tipi di target disponibili filtrati in base ai moduli attivi correntemente.
   */
  static getAvailableTargetTypes(activeModuleIds: string[] = []): TargetTypeOption[] {
    return KNOWN_TARGET_TYPES.filter(t => t.isCore || activeModuleIds.includes(t.moduleId));
  }

  /**
   * Carica dinamicamente il bridge del modulo target richiesto solo se installato/attivo.
   * L'uso di variabile specifier + @vite-ignore garantisce zero errori di analisi statica di Vite.
   */
  static async loadBridgeForTarget(
    targetType: ActivityTargetType, 
    activeModuleIds: string[] = []
  ): Promise<ModuleActivitiesBridgeSpec | null> {
    try {
      if (targetType === 'contact') {
        const bridgePath = '/src/lib/bridges/contacts.activities.bridge.ts';
        // @ts-ignore
        const mod = await import(/* @vite-ignore */ bridgePath);
        return mod.ContactsActivitiesBridge || null;
      }
      if (targetType === 'client') {
        const bridgePath = '/src/lib/bridges/clients.activities.bridge.ts';
        // @ts-ignore
        const mod = await import(/* @vite-ignore */ bridgePath);
        return mod.ClientsActivitiesBridge || null;
      }
      if (targetType === 'user') {
        const bridgePath = '/src/lib/bridges/users.activities.bridge.ts';
        // @ts-ignore
        const mod = await import(/* @vite-ignore */ bridgePath);
        return mod.UsersActivitiesBridge || null;
      }
      if (targetType === 'place' && (activeModuleIds.includes('places') || activeModuleIds.length === 0)) {
        const bridgePath = '/src/routes/dashboard/places/places.activities.bridge.ts';
        // @ts-ignore
        const mod = await import(/* @vite-ignore */ bridgePath);
        return mod.PlacesActivitiesBridge || null;
      }
      if (targetType === 'vehicle' && (activeModuleIds.includes('vehicles') || activeModuleIds.length === 0)) {
        const bridgePath = '/src/routes/dashboard/vehicles/vehicles.activities.bridge.ts';
        // @ts-ignore
        const mod = await import(/* @vite-ignore */ bridgePath);
        return mod.VehiclesActivitiesBridge || null;
      }
      if (targetType === 'contract' && (activeModuleIds.includes('contracts') || activeModuleIds.length === 0)) {
        const bridgePath = '/src/routes/dashboard/contracts/contracts.activities.bridge.ts';
        // @ts-ignore
        const mod = await import(/* @vite-ignore */ bridgePath);
        return mod.ContractsActivitiesBridge || null;
      }
    } catch (e) {
      console.warn(`[ActivitiesBridgeOrchestrator] Impossibile caricare il bridge per '${targetType}':`, e);
    }
    return null;
  }

  /**
   * Cerca le entità target delegando al bridge corrispondente.
   */
  static async searchTargets(
    targetType: ActivityTargetType,
    searchVal: string,
    tenantId?: string,
    activeModuleIds: string[] = []
  ): Promise<TargetSearchResult[]> {
    const bridge = await this.loadBridgeForTarget(targetType, activeModuleIds);
    if (!bridge) return [];
    return bridge.searchTargets(searchVal, tenantId);
  }

  /**
   * Risolve il summary dettagliato di un target con fallback sicuro per attività orfane da moduli disinstallati.
   */
  static async resolveTargetSummary(
    targetType: ActivityTargetType,
    targetId: string,
    fallbackSnapshotName?: string,
    tenantId?: string,
    activeModuleIds: string[] = []
  ): Promise<TargetSummary> {
    const bridge = await this.loadBridgeForTarget(targetType, activeModuleIds);
    if (bridge) {
      const summary = await bridge.getTargetSummary(targetId, tenantId);
      if (summary) return summary;
    }

    // Fallback Graceful se il modulo è disinstallato o l'entità non è più trovata
    return {
      id: targetId,
      name: fallbackSnapshotName || targetId,
      targetType,
      isModuleDisabled: !bridge
    };
  }

  /**
   * Filtra i tipi di attività abilitati per uno specifico target.
   */
  static filterActivityTypesForTarget(types: ActivityType[], targetType?: ActivityTargetType | null): ActivityType[] {
    if (!targetType) return types;
    return types.filter(t => {
      if (!Array.isArray(t.allowedTargets) || t.allowedTargets.length === 0) return true;
      return t.allowedTargets.includes(targetType);
    });
  }
}
