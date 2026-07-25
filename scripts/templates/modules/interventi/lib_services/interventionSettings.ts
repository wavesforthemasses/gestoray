import { db, doc, getDoc, setDoc } from '$lib/firebase';
import type { TeamItem, VehicleItem } from '../../routes/dashboard/interventi/schema';

export interface InterventionTypeConfig {
  id: string;
  label: string;
  defaultHourlyRate?: number;
}

export interface InterventionSettingsConfig {
  locationLabel: string; // 'Luoghi di Intervento' | 'Cantieri' | 'Sedi & Impianti'
  defaultHourlyRate: number;
  requireSignatureForBilling: boolean;
  interventionTypes: InterventionTypeConfig[];
  teams: TeamItem[];
  vehicles: VehicleItem[];
}

export const DEFAULT_INTERVENTION_SETTINGS: InterventionSettingsConfig = {
  locationLabel: 'Luoghi di Intervento',
  defaultHourlyRate: 45,
  requireSignatureForBilling: false,
  interventionTypes: [
    { id: 'manutenzione', label: 'Manutenzione Ordinaria', defaultHourlyRate: 45 },
    { id: 'riparazione', label: 'Riparazione Straordinaria', defaultHourlyRate: 55 },
    { id: 'consulenza', label: 'Consulenza Tecnico/Operativa', defaultHourlyRate: 65 },
    { id: 'consegna', label: 'Consegna Merci / Attrezzature', defaultHourlyRate: 35 },
    { id: 'sopralluogo', label: 'Sopralluogo / Preventivazione', defaultHourlyRate: 40 }
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
