import { db, doc, getDoc, setDoc, updateDoc } from '$lib/firebase';

export interface TenantFeatureConfig {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
  moduleKey: string;
}

export const DEFAULT_TENANT_FEATURES: Record<string, TenantFeatureConfig> = {
  interventi: { id: 'interventi', label: 'Interventi & Rapportini', description: 'Gestione interventi tecnici sul campo', enabled: true, moduleKey: 'interventi' },
  tickets: { id: 'tickets', label: 'Ticket Assistenza', description: 'Helpdesk e tracciamento ticket', enabled: true, moduleKey: 'tickets' },
  contracts: { id: 'contracts', label: 'Contratti di Assistenza', description: 'Gestione contratti e monte ore', enabled: true, moduleKey: 'contracts' },
  payments: { id: 'payments', label: 'Scadenzario & Incassi', description: 'Gestione rate e pagamenti', enabled: true, moduleKey: 'payments' },
  commissions: { id: 'commissions', label: 'Provvigioni Commerciali', description: 'Chiusure provvigionali per agenti', enabled: true, moduleKey: 'commissions' },
  activities: { id: 'activities', label: 'Attività & Task', description: 'Tracciamento attività commerciali e operative', enabled: true, moduleKey: 'activities' }
};

export class TenantFeaturesService {
  private static DOC_PATH = 'system_config/tenant_features';

  static async getTenantFeatures(): Promise<Record<string, boolean>> {
    try {
      const snap = await getDoc(doc(db, 'system_config', 'tenant_features'));
      if (snap.exists()) {
        const data = snap.data();
        const features: Record<string, boolean> = {};
        Object.keys(DEFAULT_TENANT_FEATURES).forEach(key => {
          features[key] = data[key] !== undefined ? data[key] : DEFAULT_TENANT_FEATURES[key].enabled;
        });
        return features;
      }
    } catch (e) {
      console.warn('Errore lettura feature flags tenant, uso impostazioni predefinite:', e);
    }
    // Return default enabled status
    const defaults: Record<string, boolean> = {};
    Object.keys(DEFAULT_TENANT_FEATURES).forEach(key => {
      defaults[key] = DEFAULT_TENANT_FEATURES[key].enabled;
    });
    return defaults;
  }

  static async updateTenantFeature(featureKey: string, enabled: boolean): Promise<void> {
    const docRef = doc(db, 'system_config', 'tenant_features');
    await setDoc(docRef, { [featureKey]: enabled }, { merge: true });
  }
}
