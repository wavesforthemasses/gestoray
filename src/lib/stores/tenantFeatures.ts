import { writable } from 'svelte/store';
import { TenantFeaturesService, DEFAULT_TENANT_FEATURES } from '$lib/services/tenantFeaturesService';

const defaultFlags: Record<string, boolean> = {};
Object.keys(DEFAULT_TENANT_FEATURES).forEach(k => {
  defaultFlags[k] = DEFAULT_TENANT_FEATURES[k].enabled;
});

export const tenantFeaturesStore = writable<Record<string, boolean>>(defaultFlags);

export async function initTenantFeatures() {
  const flags = await TenantFeaturesService.getTenantFeatures();
  tenantFeaturesStore.set(flags);
}
