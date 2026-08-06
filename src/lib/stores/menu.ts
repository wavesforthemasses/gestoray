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
let unsubscribeProjectsSettings: (() => void) | null = null;
let unsubscribePlacesSettings: (() => void) | null = null;

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

    // Apply initial projects dynamic label if projects module exists
    const projectSettingsRef = doc(db, 'settings', 'projects');
    if (!unsubscribeProjectsSettings) {
      unsubscribeProjectsSettings = onSnapshot(projectSettingsRef, (pSnap: any) => {
        let pluralLabel = 'Progetti';
        if (pSnap.exists()) {
          const d = pSnap.data();
          const naming = d.entityNaming || 'progetto';
          if (naming === 'cantiere') pluralLabel = 'Cantieri';
          else if (naming === 'commessa') pluralLabel = 'Commesse';
          else if (naming === 'pratica') pluralLabel = 'Pratiche';
          else if (naming === 'custom' && d.customPluralLabel) pluralLabel = d.customPluralLabel;
        }

        menuConfigStore.update(items =>
          items.map(item =>
            item.id === 'projects'
              ? { ...item, label: `${pluralLabel}` }
              : item
          )
        );
      });
    }

    // Apply initial places dynamic label if places module exists
    const placeSettingsRef = doc(db, 'settings', 'places');
    if (!unsubscribePlacesSettings) {
      unsubscribePlacesSettings = onSnapshot(placeSettingsRef, (plSnap: any) => {
        let pluralLabel = 'Luoghi';
        if (plSnap.exists()) {
          const d = plSnap.data();
          const naming = d.entityNaming || 'luogo';
          if (naming === 'cantiere') pluralLabel = 'Cantieri';
          else if (naming === 'sede') pluralLabel = 'Sedi Operative';
          else if (naming === 'destinazione') pluralLabel = 'Destinazioni';
          else if (naming === 'custom' && d.customPluralLabel) pluralLabel = d.customPluralLabel;
        }

        menuConfigStore.update(items =>
          items.map(item =>
            item.id === 'places'
              ? { ...item, label: `${pluralLabel}` }
              : item
          )
        );
      });
    }

    menuConfigStore.set(list);
  });
}

export function destroyMenuStore() {
  if (unsubscribeMenu) {
    unsubscribeMenu();
    unsubscribeMenu = null;
  }
  if (unsubscribeProjectsSettings) {
    unsubscribeProjectsSettings();
    unsubscribeProjectsSettings = null;
  }
  if (unsubscribePlacesSettings) {
    unsubscribePlacesSettings();
    unsubscribePlacesSettings = null;
  }
}
