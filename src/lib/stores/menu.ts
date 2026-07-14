import { writable } from 'svelte/store';
import { db, doc, onSnapshot } from '$lib/firebase';

export interface MenuItemConfig {
  id: string; // e.g. 'activities', 'contracts', 'products', 'users'
  rolesView: string[];
}

export const menuConfigStore = writable<MenuItemConfig[]>([]);

export const DEFAULT_MENU_CONFIG: MenuItemConfig[] = [
  { id: 'todo', rolesView: ['superadmin', 'direzione', 'commerciale', 'amministrazione'] },
  { id: 'clients', rolesView: ['superadmin', 'direzione', 'commerciale'] },
  { id: 'activities', rolesView: ['superadmin', 'direzione', 'commerciale', 'amministrazione'] },
  { id: 'contracts', rolesView: ['superadmin', 'direzione', 'commerciale', 'amministrazione'] },
  { id: 'my-commissions', rolesView: ['commerciale'] },
  { id: 'payments', rolesView: ['superadmin', 'direzione', 'amministrazione'] },
  { id: 'commissions', rolesView: ['superadmin', 'direzione', 'amministrazione'] },
  { id: 'products', rolesView: ['superadmin', 'amministrazione'] },
  { id: 'users', rolesView: ['superadmin'] },
  { id: 'qualifications', rolesView: ['superadmin'] },
  { id: 'settings', rolesView: ['superadmin'] }
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
