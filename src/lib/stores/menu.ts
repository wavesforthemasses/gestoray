import { writable } from 'svelte/store';
import { db, doc, onSnapshot } from '$lib/firebase';
import modulesRegistry from '$lib/config/modules.registry.json';

export interface MenuItemConfig {
  id: string;
  label: string;
  icon: string;
  path: string;
  matchExact?: boolean;
  rolesView: string[];
  kpiTiles?: any[];
  settingsCard?: any;
}

export const menuConfigStore = writable<MenuItemConfig[]>([]);

export const BASE_MENU_CONFIG: MenuItemConfig[] = [
  { id: 'todo', label: 'Cose da Fare', icon: 'CheckSquare', path: '/dashboard/todo', rolesView: ['superadmin', 'direzione', 'commerciale', 'amministrazione'] },
  { id: 'clients', label: 'Clienti', icon: 'Briefcase', path: '/dashboard/clients', rolesView: ['superadmin', 'direzione', 'commerciale'] },
  { id: 'contacts', label: 'Contatti', icon: 'UserCheck', path: '/dashboard/contacts', rolesView: ['superadmin', 'direzione', 'commerciale', 'amministrazione'] },
  { id: 'qualifications', label: 'Qualifiche', icon: 'Award', path: '/dashboard/qualifications', rolesView: ['superadmin'] },
  { id: 'users', label: 'Utenti', icon: 'Users', path: '/dashboard/users', rolesView: ['superadmin'] },
  { id: 'settings', label: 'Impostazioni', icon: 'Settings', path: '/dashboard/settings', matchExact: true, rolesView: ['superadmin'] },
];

const MODULE_MENU_ITEMS: MenuItemConfig[] = (modulesRegistry.modules || []).map((m: any) => ({
  ...m,
  id: m.id,
  label: m.label,
  icon: m.icon,
  path: m.path,
  rolesView: m.rolesView || ['superadmin', 'direzione']
}));

export const DEFAULT_MENU_CONFIG: MenuItemConfig[] = [
  ...BASE_MENU_CONFIG,
  ...MODULE_MENU_ITEMS
];

let unsubscribeMenu: (() => void) | null = null;
const moduleSettingsUnsubscribers: Record<string, () => void> = {};

// Helper mapping for agnostic naming resolution per module
const NAMING_RESOLVERS: Record<string, (d: any) => string> = {
  projects: (d) => {
    const naming = d.entityNaming || 'progetto';
    if (naming === 'cantiere') return 'Cantieri';
    if (naming === 'commessa') return 'Commesse';
    if (naming === 'pratica') return 'Pratiche';
    if (naming === 'custom' && d.customPluralLabel) return d.customPluralLabel;
    return 'Progetti';
  },
  places: (d) => {
    const naming = d.entityNaming || 'luogo';
    if (naming === 'cantiere') return 'Cantieri';
    if (naming === 'sede') return 'Sedi Operative';
    if (naming === 'destinazione') return 'Destinazioni';
    if (naming === 'custom' && d.customPluralLabel) return d.customPluralLabel;
    return 'Luoghi';
  },
  vehicles: (d) => {
    const naming = d.entityNaming || 'mezzo';
    if (naming === 'furgone') return 'Parco Furgoni';
    if (naming === 'macchinario') return 'Macchinari';
    if (naming === 'attrezzatura') return 'Attrezzatura';
    if (naming === 'strumento') return 'Strumentazione';
    if (naming === 'custom' && d.customPluralLabel) return d.customPluralLabel;
    return 'Mezzi & Attrezzature';
  },
  teams: (d) => {
    const naming = d.entityNaming || 'squadra';
    if (naming === 'team') return 'Team di Lavoro';
    if (naming === 'gruppo') return 'Gruppi Operativi';
    if (naming === 'risorsa') return 'Risorse Umane';
    if (naming === 'custom' && d.customPluralLabel) return d.customPluralLabel;
    return 'Squadre & Risorse';
  },
  interventi: (d) => {
    const naming = d.entityNaming || 'intervento';
    if (naming === 'bolla') return 'Bolle di Lavoro';
    if (naming === 'erogazione') return 'Erogazioni Servizi';
    if (naming === 'rapporto') return 'Rapporti Tecnici';
    if (naming === 'consuntivo') return 'Consuntivi';
    if (naming === 'custom' && d.customPluralLabel) return d.customPluralLabel;
    return 'Interventi Operativi';
  }
};

export function initMenuStore() {
  if (unsubscribeMenu) return;

  // Listen to menu custom order/visibility settings
  const docRef = doc(db, 'settings', 'menu');
  unsubscribeMenu = onSnapshot(docRef, (snap: any) => {
    let list = DEFAULT_MENU_CONFIG;
    if (snap.exists()) {
      const data = snap.data();
      const savedList: MenuItemConfig[] = data.list || [];
      const defaultConfigMap = new Map(DEFAULT_MENU_CONFIG.map(item => [item.id, item]));
      const filteredSaved = savedList
        .filter(item => defaultConfigMap.has(item.id))
        .map(item => ({ ...defaultConfigMap.get(item.id), ...item }));
      const savedIds = new Set(filteredSaved.map(item => item.id));
      const missingItems = DEFAULT_MENU_CONFIG.filter(item => !savedIds.has(item.id));
      list = [...filteredSaved, ...missingItems];
    }

    // Dynamic registry-driven naming listeners for active modules
    Object.keys(NAMING_RESOLVERS).forEach(modId => {
      const isInstalled = (modulesRegistry.modules || []).some((m: any) => m.id === modId);
      if (isInstalled && !moduleSettingsUnsubscribers[modId]) {
        const settingsRef = doc(db, 'settings', modId);
        moduleSettingsUnsubscribers[modId] = onSnapshot(settingsRef, (sSnap: any) => {
          if (!sSnap.exists()) return;
          const resolver = NAMING_RESOLVERS[modId];
          const newPluralLabel = resolver(sSnap.data());

          menuConfigStore.update(items =>
            items.map(item =>
              item.id === modId
                ? {
                    ...item,
                    label: newPluralLabel,
                    kpiTiles: (item.kpiTiles || []).map((tile: any) =>
                      tile.id.startsWith(modId)
                        ? { ...tile, title: `${newPluralLabel} Attivi` }
                        : tile
                    )
                  }
                : item
            )
          );
        });
      }
    });

    menuConfigStore.set(list);
  });
}

export function destroyMenuStore() {
  if (unsubscribeMenu) {
    unsubscribeMenu();
    unsubscribeMenu = null;
  }
  Object.keys(moduleSettingsUnsubscribers).forEach(key => {
    moduleSettingsUnsubscribers[key]();
    delete moduleSettingsUnsubscribers[key];
  });
}
