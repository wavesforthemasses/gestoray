import { writable } from 'svelte/store';
import { db, doc, onSnapshot } from '$lib/firebase';

export interface MenuItemConfig {
  id: string; // e.g. 'activities', 'contracts', 'products', 'users'
  label: string;
  icon: string;
  path: string;
  matchExact?: boolean;
  rolesView: string[];
}

export const menuConfigStore = writable<MenuItemConfig[]>([]);

export const DEFAULT_MENU_CONFIG: MenuItemConfig[] = [
  { id: 'todo', label: 'Cose da Fare', icon: 'CheckSquare', path: '/dashboard/todo', rolesView: ['superadmin', 'direzione', 'commerciale', 'amministrazione'] },
  { id: 'clients', label: 'Gestione Clienti', icon: 'Briefcase', path: '/dashboard/clients', rolesView: ['superadmin', 'direzione', 'commerciale'] },
  { id: 'qualifications', label: 'Gestione Qualifiche', icon: 'Award', path: '/dashboard/qualifications', rolesView: ['superadmin'] },
  { id: 'users', label: 'Gestione Utenti', icon: 'Users', path: '/dashboard/users', rolesView: ['superadmin'] },
  { id: 'settings', label: 'Impostazioni', icon: 'Settings', path: '/dashboard/settings', matchExact: true, rolesView: ['superadmin'] },
];

let unsubscribe: (() => void) | null = null;

export function initMenuStore() {
  if (unsubscribe) return;
  const docRef = doc(db, 'settings', 'menu');
  unsubscribe = onSnapshot(docRef, (snap: any) => {
    if (snap.exists()) {
      const data = snap.data();
      menuConfigStore.set(data.list || DEFAULT_MENU_CONFIG);
    } else {
      menuConfigStore.set(DEFAULT_MENU_CONFIG);
    }
  });
}

export function destroyMenuStore() {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
}
