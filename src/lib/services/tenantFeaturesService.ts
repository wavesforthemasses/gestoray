import { db, doc, getDoc, setDoc } from '$lib/firebase';
import modulesRegistry from '$lib/config/modules.registry.json';

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

const MODULE_FEATURE_MAP: Record<string, TenantFeatureConfig> = {};
(modulesRegistry.modules || []).forEach((m: any) => {
  const f = m.featureFlag || {
    moduleKey: m.id,
    name: m.label,
    description: m.description || `Abilita il modulo ${m.label}.`
  };
  MODULE_FEATURE_MAP[m.id] = {
    id: m.id,
    label: f.name || m.label,
    description: f.description || `Abilita il modulo ${m.label}.`,
    enabled: m.enabled !== false,
    moduleKey: m.id
  };
});

export const DEFAULT_TENANT_FEATURES: Record<string, TenantFeatureConfig> = {
  ...BASE_TENANT_FEATURES,
  ...MODULE_FEATURE_MAP
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
