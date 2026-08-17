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
const FIRESTORE_DOC_PATH = 'settings/chart';

const DEFAULT_CONFIG: ChartGlobalSettings = {
  defaultKpisPosition: 'right',
  defaultGranularity: 'mensile',
  enableFullscreen: true,
  entities: {
    clients: {
      id: 'clients',
      label: 'Clienti (CRM)',
      isCore: true,
      enabled: true,
      showSideKpis: true,
      exportToDashboard: true,
      kpis: [
        { id: 'nuove_anagrafiche', name: 'Nuove Anagrafiche', acronym: 'NA', description: 'Conteggio dei nuovi clienti e lead registrati nel periodo selezionato.', enabled: true, exportToDashboard: true, requiredModule: null },
        { id: 'nncf', name: 'Primi Ordini NNCF', acronym: 'NNCF', description: 'Primi contratti ed ordini stipulati da nuovi clienti.', enabled: true, exportToDashboard: true, requiredModule: 'contracts' },
        { id: 'vss', name: 'Valore Venduto', acronym: 'VSS', description: 'Totale del valore economico venduto contrattualizzato.', isCurrency: true, enabled: true, exportToDashboard: true, requiredModule: 'contracts' },
        { id: 'gi', name: 'Incassato Effettivo', acronym: 'GI', description: 'Totale dei pagamenti effettivamente incassati nel periodo.', isCurrency: true, enabled: true, exportToDashboard: true, requiredModule: 'payments' }
      ]
    },
    contracts: {
      id: 'contracts',
      label: 'Contratti & Preventivi',
      isCore: false,
      enabled: true,
      showSideKpis: true,
      exportToDashboard: true,
      kpis: [
        { id: 'nncf', name: 'Primi Ordini NNCF', acronym: 'NNCF', description: 'Primi contratti ed ordini stipulati da nuovi clienti.', enabled: true, exportToDashboard: true, requiredModule: 'contracts' },
        { id: 'vss', name: 'Valore Contratti', acronym: 'VSS', description: 'Valore totale economico dei contratti approvati.', isCurrency: true, enabled: true, exportToDashboard: true, requiredModule: 'contracts' },
        { id: 'provvigioni_maturate', name: 'Provvigioni Maturate', acronym: 'PM', description: 'Provvigioni commerciali maturate dagli agenti.', isCurrency: true, enabled: true, exportToDashboard: true, requiredModule: 'payments' },
        { id: 'gi', name: 'Incassato Contratti', acronym: 'GI', description: 'Totale delle rate e canoni incassati sui contratti.', isCurrency: true, enabled: true, exportToDashboard: true, requiredModule: 'payments' }
      ]
    },
    activities: {
      id: 'activities',
      label: 'Attività & Task',
      isCore: false,
      enabled: true,
      showSideKpis: true,
      exportToDashboard: true,
      kpis: [
        { id: 'completed_tasks', name: 'Attività Svolte', acronym: 'AS', description: 'Volume di appuntamenti, chiamate ed attività completate.', enabled: true, exportToDashboard: true, requiredModule: 'activities' },
        { id: 'pending_tasks', name: 'Task in Sospeso', acronym: 'TS', description: 'Attività commerciali ed appuntamenti in programma.', enabled: true, exportToDashboard: true, requiredModule: 'activities' }
      ]
    },
    places: {
      id: 'places',
      label: 'Cantieri & Luoghi',
      isCore: false,
      enabled: true,
      showSideKpis: true,
      exportToDashboard: true,
      kpis: [
        { id: 'active_places', name: 'Cantieri Attivi', acronym: 'CA', description: 'Cantieri e sedi attualmente operativi sul campo.', enabled: true, exportToDashboard: true, requiredModule: 'places' },
        { id: 'new_places', name: 'Nuove Aperture', acronym: 'NL', description: 'Nuovi cantieri e luoghi registrati nel periodo selezionato.', enabled: true, exportToDashboard: true, requiredModule: 'places' }
      ]
    },
    products: {
      id: 'products',
      label: 'Prodotti & Servizi',
      isCore: false,
      enabled: true,
      showSideKpis: false,
      exportToDashboard: false,
      kpis: [
        { id: 'total_products', name: 'Articoli a Catalogo', acronym: 'PRD', description: 'Numero totale di prodotti e servizi a catalogo.', enabled: false, exportToDashboard: false, requiredModule: 'products' }
      ]
    },
    vehicles: {
      id: 'vehicles',
      label: 'Mezzi & Attrezzature',
      isCore: false,
      enabled: true,
      showSideKpis: false,
      exportToDashboard: false,
      kpis: [
        { id: 'total_vehicles', name: 'Mezzi Totali', acronym: 'MT', description: 'Numero totale di veicoli e attrezzature aziendali.', enabled: false, exportToDashboard: false, requiredModule: 'vehicles' }
      ]
    },
    tickets: {
      id: 'tickets',
      label: 'Ticket',
      isCore: false,
      enabled: true,
      showSideKpis: true,
      exportToDashboard: true,
      kpis: [
        { id: 'ticket_aperti', name: 'Ticket Aperti', acronym: 'TA', description: 'Numero totale di ticket attualmente aperti o in lavorazione.', enabled: true, exportToDashboard: true, requiredModule: 'tickets' },
        { id: 'tmr', name: 'Tempo Medio Risoluzione', acronym: 'TMR', description: 'Tempo medio di risoluzione (in ore) dei ticket chiusi.', enabled: true, exportToDashboard: true, requiredModule: 'tickets' }
      ]
    },
    teams: {
      id: 'teams',
      label: 'Squadre & Risorse',
      isCore: false,
      enabled: true,
      showSideKpis: false,
      exportToDashboard: false,
      kpis: [
        { id: 'teams_attivi', name: 'Squadre Attive', acronym: 'SQD', description: 'Team e squadre di lavoro operativi sul campo.', enabled: false, exportToDashboard: false, requiredModule: 'teams' }
      ]
    },
    projects: {
      id: 'projects',
      label: 'Gestione Progetti',
      isCore: false,
      enabled: true,
      showSideKpis: false,
      exportToDashboard: false,
      kpis: [
        { id: 'projects_attivi', name: 'Progetti Attivi', acronym: 'PRG', description: 'Progetti e commesse attualmente in corso.', enabled: false, exportToDashboard: false, requiredModule: 'projects' },
        { id: 'portafoglio_lavori', name: 'Portafoglio Lavori', acronym: 'PL', description: 'Valore totale stimato dei progetti a portafoglio.', isCurrency: true, enabled: false, exportToDashboard: false, requiredModule: 'projects' }
      ]
    },
    interventi: {
      id: 'interventi',
      label: 'Interventi Operativi',
      isCore: false,
      enabled: true,
      showSideKpis: false,
      exportToDashboard: false,
      kpis: [
        { id: 'interventi_pending', name: 'Interventi in Corso', acronym: 'INT', description: 'Interventi tecnici pianificati o in lavorazione.', enabled: false, exportToDashboard: false, requiredModule: 'interventi' }
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
        { id: 'nuove_anagrafiche', name: 'Nuove Anagrafiche Aziendali', acronym: 'NA', description: 'Panoramica storica delle nuove anagrafiche sul totale aziendale.', enabled: true, exportToDashboard: true, requiredModule: null },
        { id: 'vss', name: 'Valore Venduto Aziendale', acronym: 'VSS', description: 'Andamento del valore economico totale venduto dall\'azienda.', isCurrency: true, enabled: true, exportToDashboard: true, requiredModule: 'contracts' },
        { id: 'nncf', name: 'Primi Ordini Aziendali', acronym: 'NNCF', description: 'Andamento dei primi ordini e conversioni nuovi clienti.', enabled: true, exportToDashboard: true, requiredModule: 'contracts' },
        { id: 'total_products', name: 'Articoli a Catalogo', acronym: 'PRD', description: 'Numero totale di prodotti e servizi a catalogo.', enabled: true, exportToDashboard: true, requiredModule: 'products' },
        { id: 'ticket_aperti', name: 'Ticket Aperti', acronym: 'TA', description: 'Numero totale di ticket attualmente aperti o in lavorazione.', enabled: true, exportToDashboard: true, requiredModule: 'tickets' },
        { id: 'tmr', name: 'Tempo Medio Risoluzione', acronym: 'TMR', description: 'Tempo medio di risoluzione (in ore) dei ticket chiusi.', enabled: true, exportToDashboard: true, requiredModule: 'tickets' },
        { id: 'active_places', name: 'Cantieri Attivi', acronym: 'CA', description: 'Cantieri e sedi attualmente operativi sul campo.', enabled: true, exportToDashboard: true, requiredModule: 'places' },
        { id: 'new_places', name: 'Nuove Aperture', acronym: 'NL', description: 'Nuovi cantieri e luoghi registrati nel periodo selezionato.', enabled: true, exportToDashboard: true, requiredModule: 'places' },
        { id: 'teams_attivi', name: 'Squadre Attive', acronym: 'SQD', description: 'Team e squadre di lavoro operativi sul campo.', enabled: true, exportToDashboard: true, requiredModule: 'teams' },
        { id: 'projects_attivi', name: 'Progetti Attivi', acronym: 'PRG', description: 'Progetti e commesse attualmente in corso.', enabled: true, exportToDashboard: true, requiredModule: 'projects' },
        { id: 'portafoglio_lavori', name: 'Portafoglio Lavori', acronym: 'PL', description: 'Valore totale stimato dei progetti a portafoglio.', isCurrency: true, enabled: true, exportToDashboard: true, requiredModule: 'projects' },
        { id: 'interventi_pending', name: 'Interventi in Corso', acronym: 'INT', description: 'Interventi tecnici pianificati o in lavorazione.', enabled: true, exportToDashboard: true, requiredModule: 'interventi' },
        { id: 'gi', name: 'Incassato Aziendale', acronym: 'GI', description: 'Andamento del flusso di cassa ed incassi effettivi.', isCurrency: true, enabled: true, exportToDashboard: true, requiredModule: 'payments' }
      ]
    }
  }
};

export class ChartSettingsService {
  static getInstalledModuleIds(): string[] {
    return (modulesRegistry.modules || []).map((m: any) => m.id);
  }

  private static mergeSettings(saved: Partial<ChartGlobalSettings>): ChartGlobalSettings {
    const merged: ChartGlobalSettings = { ...DEFAULT_CONFIG, ...saved } as ChartGlobalSettings;
    merged.entities = { ...DEFAULT_CONFIG.entities };

    if (saved.entities) {
      for (const [entId, defaultEnt] of Object.entries(DEFAULT_CONFIG.entities)) {
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
      // Check if there are saved entities not present in DEFAULT_CONFIG (legacy or custom)
      for (const [entId, savedEnt] of Object.entries(saved.entities)) {
        if (!DEFAULT_CONFIG.entities[entId]) {
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

    return DEFAULT_CONFIG;
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
    return DEFAULT_CONFIG;
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

