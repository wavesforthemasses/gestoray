import { describe, it, expect } from 'vitest';
import { DEFAULT_MENU_CONFIG, BASE_MENU_CONFIG } from './menu';
import modulesRegistry from '$lib/config/modules.registry.json';

describe('Sidebar Menu Configuration Registry', () => {
  it('should include base menu items', () => {
    const ids = BASE_MENU_CONFIG.map(item => item.id);
    expect(ids).toContain('todo');
    expect(ids).toContain('clients');
    expect(ids).toContain('contacts');
    expect(ids).toContain('users');
    expect(ids).toContain('settings');
  });

  it('should dynamically include all installed modules from modules.registry.json', () => {
    const installedModules: any[] = modulesRegistry.modules || [];

    for (const mod of installedModules) {
      const foundInMenu = DEFAULT_MENU_CONFIG.find(item => item.id === mod.id);
      expect(foundInMenu).toBeDefined();
      expect(foundInMenu?.label).toBe(mod.label);
      expect(foundInMenu?.path).toBe(mod.path);
      expect(foundInMenu?.icon).toBe(mod.icon);
      expect(foundInMenu?.rolesView).toEqual(mod.rolesView);
    }
  });

  it('should include products module when products is registered', () => {
    const installedModules: any[] = modulesRegistry.modules || [];
    const isProductsInstalled = installedModules.some(m => m.id === 'products');
    if (isProductsInstalled) {
      const productsMenuItem = DEFAULT_MENU_CONFIG.find(item => item.id === 'products');
      expect(productsMenuItem).toBeDefined();
      expect(productsMenuItem?.path).toBe('/dashboard/products');
      expect(productsMenuItem?.label).toBe('Prodotti');
    }
  });

  it('should include contracts module when contracts is registered', () => {
    const installedModules: any[] = modulesRegistry.modules || [];
    const isContractsInstalled = installedModules.some(m => m.id === 'contracts');
    if (isContractsInstalled) {
      const contractsMenuItem = DEFAULT_MENU_CONFIG.find(item => item.id === 'contracts');
      expect(contractsMenuItem).toBeDefined();
      expect(contractsMenuItem?.path).toBe('/dashboard/contracts');
    }
  });
});
