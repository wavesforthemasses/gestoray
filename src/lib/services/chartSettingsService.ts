import { db, doc, getDoc, setDoc } from '$lib/firebase';
import modulesRegistry from '$lib/config/modules.registry.json';

export interface KPISettingSpec {
  id: string;
  name: string;
  acronym: string;
  description: string;
  isCurrency?: boolean;
  enabled: boolean;
  exportToDashboard: boolean;
  requiredModule?: string | null;
}

export interface EntityChartConfig {
  id: string;
  label: string;
  isCore: boolean;
  enabled: boolean;
  showSideKpis: boolean;
  exportToDashboard: boolean;
  kpis: KPISettingSpec[];
}

export interface ChartGlobalSettings {
  defaultKpisPosition: 'right' | 'top' | 'bottom' | 'none';
  defaultGranularity: 'settimanale' | 'mensile' | 'annuale';
  enableFullscreen: boolean;
  entities: Record<string, EntityChartConfig>;
}

const STORAGE_KEY = 'gestoray_chart_settings_v2';

const KNOWN_ACRONYMS: Record<string, string> = {
  nuove_anagrafiche: 'NA',
  vss: 'VSS',
  nncf: 'NNCF',
  gi: 'GI',
  total_products: 'PRD',
  ticket_aperti: 'TA',
  tmr: 'TMR',
  active_places: 'CA',
  places_attivi: 'CA',
  new_places: 'NL',
  completed_tasks: 'AS',
  pending_tasks: 'TS',
  provvigioni_maturate: 'PM',
  interventi_pending: 'INT',
  teams_attivi: 'SQD',
  projects_attivi: 'PRG',
  portafoglio_lavori: 'PL',
  total_vehicles: 'MT'
};

function deriveAcronym(title: string, id: string): string {
  if (KNOWN_ACRONYMS[id]) return KNOWN_ACRONYMS[id];
  const words = title.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return words.slice(0, 3).map(w => w[0].toUpperCase()).join('');
  }
  return title.slice(0, 3).toUpperCase();
}

/**
 * Dynamically builds the default ChartGlobalSettings from:
 * 1. Base Core entities ('clients', 'dashboard')
 * 2. All active modules registered in modules.registry.json having declared kpiTiles
 */
export function buildDynamicDefaultConfig(): ChartGlobalSettings {
  const modulesList = (modulesRegistry.modules || []) as any[];

  // 1. Base Core Entities
  const entities: Record<string, EntityChartConfig> = {
    clients: {
      id: 'clients',
      label: 'Clienti (CRM)',
      isCore: true,
      enabled: true,
      showSideKpis: true,
      exportToDashboard: true,
      kpis: [
        {
          id: 'nuove_anagrafiche',
          name: 'Nuove Anagrafiche',
          acronym: 'NA',
          description: 'Conteggio dei nuovi clienti e lead registrati nel periodo selezionato.',
          enabled: true,
          exportToDashboard: true,
          requiredModule: null
        }
      ]
    },
    dashboard: {
      id: 'dashboard',
      label: 'Dashboard Principale',
      isCore: true,
      enabled: true,
      showSideKpis: true,
      exportToDashboard: true,
      kpis: [
        {
          id: 'nuove_anagrafiche',
          name: 'Nuove Anagrafiche Aziendali',
          acronym: 'NA',
          description: 'Panoramica storica delle nuove anagrafiche sul totale aziendale.',
          enabled: true,
          exportToDashboard: true,
          requiredModule: null
        }
      ]
    }
  };

  // 2. Discover KPIs dynamically from modules.registry.json
  for (const mod of modulesList) {
    if (mod.id === 'chart') continue;

    const modKpis: KPISettingSpec[] = [];

    if (Array.isArray(mod.kpiTiles) && mod.kpiTiles.length > 0) {
      for (const tile of mod.kpiTiles) {
        if (!tile.id) continue;
        const kpiSpec: KPISettingSpec = {
          id: tile.id,
          name: tile.title || tile.id,
          acronym: deriveAcronym(tile.title || tile.id, tile.id),
          description: tile.subtitle || tile.title || '',
          isCurrency: tile.format === 'currency' || tile.isCurrency === true,
          enabled: true,
          exportToDashboard: true,
          requiredModule: mod.id
        };
        modKpis.push(kpiSpec);

        // Also add to dashboard master list if not already present
        if (!entities.dashboard.kpis.some(k => k.id === tile.id)) {
          entities.dashboard.kpis.push({
            ...kpiSpec,
            name: `${kpiSpec.name} Aziendale`
          });
        }
      }
    }

    if (modKpis.length > 0) {
      entities[mod.id] = {
        id: mod.id,
        label: mod.label || mod.name || mod.id,
        isCore: false,
        enabled: true,
        showSideKpis: true,
        exportToDashboard: true,
        kpis: modKpis
      };
    }
  }

  return {
    defaultKpisPosition: 'right',
    defaultGranularity: 'mensile',
    enableFullscreen: true,
    entities
  };
}

export class ChartSettingsService {
  static getInstalledModuleIds(): string[] {
    return (modulesRegistry.modules || []).map((m: any) => m.id);
  }

  private static mergeSettings(saved: Partial<ChartGlobalSettings>): ChartGlobalSettings {
    const defaultConfig = buildDynamicDefaultConfig();
    const merged: ChartGlobalSettings = { ...defaultConfig, ...saved } as ChartGlobalSettings;
    merged.entities = { ...defaultConfig.entities };

    if (saved.entities) {
      for (const [entId, defaultEnt] of Object.entries(defaultConfig.entities)) {
        const savedEnt = saved.entities[entId];
        if (savedEnt) {
          const mergedKpis = [...defaultEnt.kpis];
          for (let i = 0; i < mergedKpis.length; i++) {
            const currentId = mergedKpis[i].id;
            const sKpi = savedEnt.kpis?.find(k => k.id === currentId || (currentId === 'active_places' && k.id === 'places_attivi'));
            if (sKpi) {
              mergedKpis[i] = {
                ...mergedKpis[i],
                name: sKpi.name ?? mergedKpis[i].name,
                acronym: sKpi.acronym ?? mergedKpis[i].acronym,
                description: sKpi.description ?? mergedKpis[i].description,
                enabled: sKpi.enabled ?? mergedKpis[i].enabled,
                exportToDashboard: sKpi.exportToDashboard ?? mergedKpis[i].exportToDashboard
              };
            }
          }
          merged.entities[entId] = {
            ...defaultEnt,
            ...savedEnt,
            kpis: mergedKpis
          };
        }
      }
      // Preserve any saved custom entities not in defaultConfig
      for (const [entId, savedEnt] of Object.entries(saved.entities)) {
        if (!defaultConfig.entities[entId]) {
          merged.entities[entId] = savedEnt as EntityChartConfig;
        }
      }
    }
    return merged;
  }

  /**
   * Reads settings from Firestore Database with fallback to LocalStorage and Defaults
   */
  static async getSettings(): Promise<ChartGlobalSettings> {
    try {
      const snap = await getDoc(doc(db, 'settings', 'chart'));
      if (snap.exists()) {
        const data = snap.data() as Partial<ChartGlobalSettings>;
        const merged = this.mergeSettings(data);
        if (typeof window !== 'undefined') {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
        }
        return merged;
      }
    } catch (e) {
      console.warn('Lettura impostazioni Firestore fallita, uso cache locale:', e);
    }

    // Fallback to LocalStorage
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          return this.mergeSettings(parsed);
        }
      } catch (e) { }
    }

    return buildDynamicDefaultConfig();
  }

  /**
   * Synchronous cached reader for immediate UI rendering
   */
  static getSettingsSync(): ChartGlobalSettings {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          return this.mergeSettings(parsed);
        }
      } catch (e) { }
    }
    return buildDynamicDefaultConfig();
  }

  static getActiveEntitiesSync(): EntityChartConfig[] {
    const settings = this.getSettingsSync();
    const installedModuleIds = this.getInstalledModuleIds();

    const activeEntities = Object.values(settings.entities).filter(ent => {
      if (ent.isCore) return true;
      return installedModuleIds.includes(ent.id);
    });

    // Prune KPIs whose requiredModule is not currently installed
    return activeEntities.map(ent => ({
      ...ent,
      kpis: ent.kpis.filter(kpi => {
        if (!kpi.requiredModule) return true;
        return installedModuleIds.includes(kpi.requiredModule);
      })
    }));
  }

  static getAllKpisMasterListSync(): KPISettingSpec[] {
    const activeEntities = this.getActiveEntitiesSync();
    const map = new Map<string, KPISettingSpec>();

    for (const ent of activeEntities) {
      for (const kpi of ent.kpis) {
        if (!map.has(kpi.id)) {
          map.set(kpi.id, kpi);
        }
      }
    }

    return Array.from(map.values());
  }

  /**
   * Persists settings to Firestore Database doc(db, 'settings', 'chart')
   */
  static async saveSettings(settings: ChartGlobalSettings): Promise<void> {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      } catch (e) { }
    }

    try {
      await setDoc(doc(db, 'settings', 'chart'), settings, { merge: true });
    } catch (e) {
      console.error('Errore salvataggio impostazioni in Firestore:', e);
      throw e;
    }
  }

  static getEntityConfigSync(entityId: string): EntityChartConfig | null {
    const activeEntities = this.getActiveEntitiesSync();
    return activeEntities.find(e => e.id === entityId) || null;
  }

  static getEntityConfig(entityId: string): EntityChartConfig | null {
    return this.getEntityConfigSync(entityId);
  }

  static getKpiDescriptionSync(kpiId: string): string | undefined {
    const master = this.getAllKpisMasterListSync();
    const found = master.find(k => k.id === kpiId);
    return found?.description;
  }

  static getDashboardChartMetricsSync(): Array<{ id: string; label: string; shortLabel: string; description?: string; isCurrency?: boolean }> {
    const activeEntities = this.getActiveEntitiesSync();
    const metricsMap = new Map<string, any>();

    // 1. Process dashboard core entity
    const dashboardEnt = activeEntities.find(e => e.id === 'dashboard');
    if (dashboardEnt && dashboardEnt.enabled) {
      for (const kpi of dashboardEnt.kpis) {
        if (kpi.enabled) {
          metricsMap.set(kpi.id, {
            id: kpi.id,
            label: kpi.name,
            shortLabel: kpi.acronym,
            description: kpi.description,
            isCurrency: kpi.isCurrency
          });
        }
      }
    }

    // 2. Process all other exported entities
    for (const ent of activeEntities) {
      if (ent.id === 'dashboard') continue;
      if (ent.enabled && ent.exportToDashboard) {
        for (const kpi of ent.kpis) {
          if (kpi.enabled) {
            if (!metricsMap.has(kpi.id)) {
              metricsMap.set(kpi.id, {
                id: kpi.id,
                label: kpi.name,
                shortLabel: kpi.acronym,
                description: kpi.description,
                isCurrency: kpi.isCurrency
              });
            }
          }
        }
      }
    }

    return Array.from(metricsMap.values());
  }

  static getDashboardEnabledKpiIdsSync(): Set<string> {
    const metrics = this.getDashboardChartMetricsSync();
    const ids = new Set<string>(metrics.map(m => m.id));

    // Also include any KPI that is enabled in an active entity with exportToDashboard or dashboard
    const activeEntities = this.getActiveEntitiesSync();
    for (const ent of activeEntities) {
      if (ent.enabled && (ent.id === 'dashboard' || ent.exportToDashboard)) {
        for (const kpi of ent.kpis) {
          if (kpi.enabled) {
            ids.add(kpi.id);
          }
        }
      }
    }

    return ids;
  }
}
