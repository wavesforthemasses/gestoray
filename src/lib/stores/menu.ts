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
  { id: 'contracts', label: 'Gestione Contratti', icon: 'FileText', path: '/dashboard/contracts', rolesView: ['superadmin', 'amministrazione', 'commerciale', 'direzione'] },
  { id: 'payments', label: 'Incassi & Pagamenti', icon: 'CreditCard', path: '/dashboard/payments', rolesView: ['superadmin', 'amministrazione', 'commerciale', 'direzione'] },
  { id: 'commissions', label: 'Provvigioni Agenti', icon: 'DollarSign', path: '/dashboard/commissions', rolesView: ['superadmin', 'amministrazione', 'commerciale', 'direzione'] },
  { id: 'products', label: 'Catalogo Prodotti', icon: 'Package', path: '/dashboard/products', rolesView: ['superadmin', 'amministrazione', 'commerciale', 'direzione', 'operaio', 'tecnico'] },
  { id: 'activities', label: 'Attività & Task', icon: 'CheckSquare', path: '/dashboard/activities', rolesView: ['superadmin', 'amministrazione', 'commerciale', 'direzione', 'operaio', 'tecnico'] },
  { id: 'tickets', label: 'Ticket Assistenza', icon: 'Ticket', path: '/dashboard/tickets', rolesView: ['superadmin', 'amministrazione', 'commerciale', 'direzione', 'operaio', 'tecnico'] },
  { id: 'interventi', label: 'Interventi & Rapportini', icon: 'Tool', path: '/dashboard/interventi', rolesView: ['superadmin', 'amministrazione', 'commerciale', 'direzione', 'operaio', 'tecnico'] },
  { id: 'teams', label: 'Squadre di Lavoro', icon: 'Users', path: '/dashboard/interventi/teams', rolesView: ['superadmin', 'amministrazione', 'commerciale', 'direzione', 'tecnico'] },
  { id: 'vehicles', label: 'Parco Mezzi', icon: 'Truck', path: '/dashboard/interventi/vehicles', rolesView: ['superadmin', 'amministrazione', 'commerciale', 'direzione', 'tecnico'] },
];

let unsubscribe: (() => void) | null = null;
let unsubscribeInterventiSettings: (() => void) | null = null;

export function initMenuStore() {
  if (unsubscribe) return;
  const docRef = doc(db, 'settings', 'menu');
  unsubscribe = onSnapshot(docRef, (snap: any) => {
    let list = DEFAULT_MENU_CONFIG;
    if (snap.exists()) {
      const data = snap.data();
      list = data.list || DEFAULT_MENU_CONFIG;
    }
    menuConfigStore.set(list);
  });

  const intSettingsRef = doc(db, 'settings', 'interventi');
  unsubscribeInterventiSettings = onSnapshot(intSettingsRef, (snap: any) => {
    if (snap.exists()) {
      const data = snap.data();
      const locLabel = data.locationLabel;
      if (locLabel) {
        menuConfigStore.update(currentList => 
          currentList.map(item => {
            if (item.id === 'interventi') {
              return { ...item, label: `Interventi & ${locLabel}` };
            }
            return item;
          })
        );
      }
    }
  });
}

export function destroyMenuStore() {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
  if (unsubscribeInterventiSettings) {
    unsubscribeInterventiSettings();
    unsubscribeInterventiSettings = null;
  }
}
