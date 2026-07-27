import { writable } from 'svelte/store';
import { db, doc, onSnapshot } from '$lib/firebase';
import { MODULE_MENU_SNIPPETS } from '$lib/config/auto_generated/generated_menu';

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
  { id: 'clients', label: 'Gestione Clienti', icon: 'Briefcase', path: '/dashboard/clients', rolesView: ['superadmin', 'direzione', 'commerciale'] },
  { id: 'contacts', label: 'Gestione Contatti', icon: 'UserCheck', path: '/dashboard/contacts', rolesView: ['superadmin', 'direzione', 'commerciale', 'amministrazione'] },
  { id: 'qualifications', label: 'Gestione Qualifiche', icon: 'Award', path: '/dashboard/qualifications', rolesView: ['superadmin'] },
  { id: 'users', label: 'Gestione Utenti', icon: 'Users', path: '/dashboard/users', rolesView: ['superadmin'] },
  { id: 'settings', label: 'Impostazioni', icon: 'Settings', path: '/dashboard/settings', matchExact: true, rolesView: ['superadmin'] },
];

export const DEFAULT_MENU_CONFIG: MenuItemConfig[] = [
  ...BASE_MENU_CONFIG,
  ...MODULE_MENU_SNIPPETS
];

let unsubscribe: (() => void) | null = null;

export function initMenuStore() {
  if (unsubscribe) return;
  const docRef = doc(db, 'settings', 'menu');
  unsubscribe = onSnapshot(docRef, (snap: any) => {
    let list = DEFAULT_MENU_CONFIG;
    if (snap.exists()) {
      const data = snap.data();
      const savedList: MenuItemConfig[] = data.list || [];
      const validIds = new Set(DEFAULT_MENU_CONFIG.map(item => item.id));
      const filteredSaved = savedList.filter(item => validIds.has(item.id));
      const savedIds = new Set(filteredSaved.map(item => item.id));
      const missingItems = DEFAULT_MENU_CONFIG.filter(item => !savedIds.has(item.id));
      list = [...filteredSaved, ...missingItems];
    }
    menuConfigStore.set(list);
  });
}

export function destroyMenuStore() {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
}
