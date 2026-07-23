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
  { id: 'activities', label: 'Gestione Attività', icon: 'ClipboardList', path: '/dashboard/activities', rolesView: ['superadmin', 'direzione', 'commerciale', 'amministrazione'] },
  { id: 'contracts', label: 'Gestione Contratti', icon: 'FileText', path: '/dashboard/contracts', rolesView: ['superadmin', 'direzione', 'commerciale', 'amministrazione'] },
  { id: 'my-commissions', label: 'Le Mie Provvigioni', icon: 'Award', path: '/dashboard/my-commissions', rolesView: ['commerciale'] },
  { id: 'payments', label: 'Gestione Incassi', icon: 'Wallet', path: '/dashboard/payments', rolesView: ['superadmin', 'direzione', 'amministrazione'] },
  { id: 'commissions', label: 'Gestione Provvigioni', icon: 'Award', path: '/dashboard/commissions', rolesView: ['superadmin', 'direzione', 'amministrazione'] },
  { id: 'products', label: 'Catalogo Prodotti', icon: 'Tag', path: '/dashboard/products', rolesView: ['superadmin', 'amministrazione'] },
  { id: 'users', label: 'Gestione Utenti', icon: 'Users', path: '/dashboard/users', rolesView: ['superadmin'] },
  { id: 'qualifications', label: 'Gestione Qualifiche', icon: 'Award', path: '/dashboard/qualifications', rolesView: ['superadmin'] },
  { id: 'settings', label: 'Impostazioni', icon: 'Settings', path: '/dashboard/settings', matchExact: true, rolesView: ['superadmin'] },
  { id: 'tickets', label: 'Gestione Tickets', icon: 'FileText', path: '/dashboard/tickets', rolesView: ['superadmin', 'amministrazione'] },
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
