import { db, doc, getDoc, setDoc } from '$lib/firebase';
import type { TeamItem, VehicleItem, PricingUnit } from '../../routes/dashboard/interventi/schema';

export interface InterventionTypeConfig {
  id: string;
  label: string;
  defaultHourlyRate?: number;
  defaultPricingUnit?: PricingUnit;
}

export interface InterventionSettingsConfig {
  locationLabel: string; // 'Luoghi di Intervento' | 'Cantieri' | 'Sedi & Impianti'
  defaultHourlyRate: number;
  requireSignatureForBilling: boolean;
  enableABolla: boolean;
  enableAdErogazione: boolean;
  defaultMode: 'a_bolla' | 'ad_erogazione';
  enabledPricingUnits: PricingUnit[];
  interventionTypes: InterventionTypeConfig[];
  teams: TeamItem[];
  vehicles: VehicleItem[];
}

export const DEFAULT_INTERVENTION_SETTINGS: InterventionSettingsConfig = {
  locationLabel: 'Luoghi di Intervento',
  defaultHourlyRate: 45,
  requireSignatureForBilling: false,
  enableABolla: true,
  enableAdErogazione: true,
  defaultMode: 'a_bolla',
  enabledPricingUnits: ['ora', 'mq', 'mc', 'quantita', 'corpo'],
  interventionTypes: [
    { id: 'manutenzione', label: 'Manutenzione Ordinaria', defaultHourlyRate: 45, defaultPricingUnit: 'ora' },
    { id: 'riparazione', label: 'Riparazione Straordinaria', defaultHourlyRate: 55, defaultPricingUnit: 'ora' },
    { id: 'consulenza', label: 'Consulenza Tecnico/Operativa', defaultHourlyRate: 65, defaultPricingUnit: 'ora' },
    { id: 'consegna', label: 'Consegna Merci / Attrezzature', defaultHourlyRate: 35, defaultPricingUnit: 'corpo' },
    { id: 'sopralluogo', label: 'Sopralluogo / Preventivazione', defaultHourlyRate: 40, defaultPricingUnit: 'corpo' }
  ],
  teams: [
    { id: 'team_alpha', name: 'Squadra Alpha (Impianti)', memberUids: [], color: '#3b82f6', active: true },
    { id: 'team_beta', name: 'Squadra Beta (Edilizia)', memberUids: [], color: '#10b981', active: true }
  ],
  vehicles: [
    { id: 'veh_furgone1', name: 'Furgone Iveco Daily 35C', plate: 'AB123CD', type: 'Furgone', status: 'disponibile' },
    { id: 'veh_camion1', name: 'Camion Mercedes Atego', plate: 'EF456GH', type: 'Camion', status: 'disponibile' }
  ]
};

export class InterventionSettingsService {
  private static DOC_PATH = doc(db, 'settings', 'interventi');

  static async getSettings(): Promise<InterventionSettingsConfig> {
    try {
      const snap = await getDoc(this.DOC_PATH);
      if (snap.exists()) {
        const data = snap.data();
        return {
          locationLabel: data.locationLabel || DEFAULT_INTERVENTION_SETTINGS.locationLabel,
          defaultHourlyRate: data.defaultHourlyRate ?? DEFAULT_INTERVENTION_SETTINGS.defaultHourlyRate,
          requireSignatureForBilling: !!data.requireSignatureForBilling,
          enableABolla: data.enableABolla !== undefined ? !!data.enableABolla : DEFAULT_INTERVENTION_SETTINGS.enableABolla,
          enableAdErogazione: data.enableAdErogazione !== undefined ? !!data.enableAdErogazione : DEFAULT_INTERVENTION_SETTINGS.enableAdErogazione,
          defaultMode: data.defaultMode || DEFAULT_INTERVENTION_SETTINGS.defaultMode,
          enabledPricingUnits: data.enabledPricingUnits || DEFAULT_INTERVENTION_SETTINGS.enabledPricingUnits,
          interventionTypes: data.interventionTypes || DEFAULT_INTERVENTION_SETTINGS.interventionTypes,
          teams: data.teams || DEFAULT_INTERVENTION_SETTINGS.teams,
          vehicles: data.vehicles || DEFAULT_INTERVENTION_SETTINGS.vehicles
        };
      }
    } catch (e) {
      console.warn('Errore lettura impostazioni interventi, utilizzo defaults:', e);
    }
    return { ...DEFAULT_INTERVENTION_SETTINGS };
  }

  static async saveSettings(config: InterventionSettingsConfig): Promise<void> {
    await setDoc(this.DOC_PATH, {
      ...config,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  }
}
