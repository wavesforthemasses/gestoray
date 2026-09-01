import { ImportRegistry } from './importRegistry';
import { clientsImportSpec } from './specs/clientsImportSpec';
import { usersImportSpec } from './specs/usersImportSpec';
import modulesRegistry from '$lib/config/modules.registry.json';

/**
 * Initializes and registers module import specs dynamically.
 * Core specs (clients, users) are always registered.
 * Optional module specs are registered only if enabled in modules.registry.json.
 */
export async function initImportRegistry(): Promise<void> {
  // 1. Core specs
  ImportRegistry.register(clientsImportSpec);
  ImportRegistry.register(usersImportSpec);

  const registryList = Array.isArray(modulesRegistry) ? modulesRegistry : (modulesRegistry as any)?.modules || [];
  const enabledModuleIds = new Set(registryList.filter((m: any) => m.enabled !== false).map((m: any) => m.id));

  // 2. Dynamic optional module registration
  if (enabledModuleIds.has('products')) {
    try {
      const { productsImportSpec } = await import('./specs/productsImportSpec');
      ImportRegistry.register(productsImportSpec);
    } catch (e) {
      console.warn('[ImportRegistry] Error loading products import spec:', e);
    }
  }

  if (enabledModuleIds.has('activities')) {
    try {
      const { activitiesImportSpec } = await import('./specs/activitiesImportSpec');
      ImportRegistry.register(activitiesImportSpec);
    } catch (e) {
      console.warn('[ImportRegistry] Error loading activities import spec:', e);
    }
  }

  if (enabledModuleIds.has('teams')) {
    try {
      const { teamsImportSpec } = await import('./specs/teamsImportSpec');
      ImportRegistry.register(teamsImportSpec);
    } catch (e) {
      console.warn('[ImportRegistry] Error loading teams import spec:', e);
    }
  }
}
