import { db, doc, getDoc, setDoc } from '$lib/firebase';
import { MODULE_FEATURE_SNIPPETS } from '$lib/config/auto_generated/generated_features';

export interface TenantFeatureConfig {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
  moduleKey: string;
}

export const BASE_TENANT_FEATURES: Record<string, TenantFeatureConfig> = {
  clients: { id: 'clients', label: 'Gestione Clienti', description: 'Anagrafica clienti e siti', enabled: true, moduleKey: 'clients' },
  users: { id: 'users', label: 'Gestione Utenti', description: 'Utenti di sistema e ruoli', enabled: true, moduleKey: 'users' },
  settings: { id: 'settings', label: 'Impostazioni generali', description: 'Configurazioni piattaforma', enabled: true, moduleKey: 'settings' }
};

export const DEFAULT_TENANT_FEATURES: Record<string, TenantFeatureConfig> = {
  ...BASE_TENANT_FEATURES,
  ...MODULE_FEATURE_SNIPPETS
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
