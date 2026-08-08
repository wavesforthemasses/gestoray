import { ImportRegistry } from './importRegistry';
import { clientsImportSpec } from './specs/clientsImportSpec';
import { productsImportSpec } from './specs/productsImportSpec';
import { activitiesImportSpec } from './specs/activitiesImportSpec';
import { teamsImportSpec } from './specs/teamsImportSpec';
import { usersImportSpec } from './specs/usersImportSpec';

/**
 * Initializes and registers default built-in module import specs.
 */
export function initImportRegistry(): void {
  ImportRegistry.register(clientsImportSpec);
  ImportRegistry.register(productsImportSpec);
  ImportRegistry.register(activitiesImportSpec);
  ImportRegistry.register(teamsImportSpec);
  ImportRegistry.register(usersImportSpec);
}
