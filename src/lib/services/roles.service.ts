import { db, doc, getDoc, setDoc, onSnapshot } from '$lib/firebase';
import { writable, get } from 'svelte/store';

export type ActionKey = 'list' | 'read' | 'create' | 'update' | 'delete';

export interface ModulePermissionSpec {
  module: string;
  label: string;
  actions: { key: ActionKey; label: string }[];
}

export const MODULE_PERMISSIONS_REGISTRY: ModulePermissionSpec[] = [
  {
    module: 'clients',
    label: 'Anagrafica Clienti',
    actions: [
      { key: 'list', label: 'Elenco' },
      { key: 'read', label: 'Dettaglio' },
      { key: 'create', label: 'Creazione' },
      { key: 'update', label: 'Modifica' },
      { key: 'delete', label: 'Eliminazione' },
    ]
  },
  {
    module: 'todo',
    label: 'Cose da Fare (Task)',
    actions: [
      { key: 'list', label: 'Elenco' },
      { key: 'read', label: 'Dettaglio' },
      { key: 'create', label: 'Creazione' },
      { key: 'update', label: 'Modifica' },
      { key: 'delete', label: 'Eliminazione' },
    ]
  },
  {
    module: 'contracts',
    label: 'Gestione Contratti',
    actions: [
      { key: 'list', label: 'Elenco' },
      { key: 'read', label: 'Dettaglio' },
      { key: 'create', label: 'Creazione' },
      { key: 'update', label: 'Modifica' },
      { key: 'delete', label: 'Eliminazione' },
    ]
  },
  {
    module: 'payments',
    label: 'Gestione Incassi',
    actions: [
      { key: 'list', label: 'Elenco' },
      { key: 'read', label: 'Dettaglio' },
      { key: 'create', label: 'Registrazione' },
      { key: 'update', label: 'Modifica' },
      { key: 'delete', label: 'Eliminazione' },
    ]
  },
  {
    module: 'commissions',
    label: 'Provvigioni Maturate',
    actions: [
      { key: 'list', label: 'Elenco' },
      { key: 'read', label: 'Dettaglio' },
      { key: 'create', label: 'Calcolo' },
      { key: 'update', label: 'Modifica' },
      { key: 'delete', label: 'Eliminazione' },
    ]
  },
  {
    module: 'products',
    label: 'Catalogo Prodotti',
    actions: [
      { key: 'list', label: 'Elenco' },
      { key: 'read', label: 'Dettaglio' },
      { key: 'create', label: 'Creazione' },
      { key: 'update', label: 'Modifica' },
      { key: 'delete', label: 'Eliminazione' },
    ]
  },
  {
    module: 'users',
    label: 'Gestione Utenti',
    actions: [
      { key: 'list', label: 'Elenco' },
      { key: 'read', label: 'Dettaglio' },
      { key: 'create', label: 'Creazione' },
      { key: 'update', label: 'Modifica' },
      { key: 'delete', label: 'Eliminazione' },
    ]
  }
];

export interface RoleConfig {
  id: string; // e.g. 'superadmin', 'amministrazione', 'commerciale', 'direzione', 'operaio', 'tecnico'
  label: string;
  description: string;
  isSystem?: boolean;
  permissions: Record<string, boolean>; // e.g. { 'clients:list': true, 'clients:create': false }
}

function generateDefaultPermissions(isFull: boolean, isCommercial: boolean, isOperaio: boolean): Record<string, boolean> {
  const perms: Record<string, boolean> = {};
  for (const modSpec of MODULE_PERMISSIONS_REGISTRY) {
    for (const act of modSpec.actions) {
      const permKey = `${modSpec.module}:${act.key}`;
      if (isFull) {
        perms[permKey] = true;
      } else if (isCommercial) {
        if (modSpec.module === 'users' || modSpec.module === 'qualifications') {
          perms[permKey] = false;
        } else if (act.key === 'delete') {
          perms[permKey] = false;
        } else {
          perms[permKey] = true;
        }
      } else if (isOperaio) {
        if ((modSpec.module === 'clients' || modSpec.module === 'todo') && (act.key === 'list' || act.key === 'read')) {
          perms[permKey] = true;
        } else {
          perms[permKey] = false;
        }
      } else {
        if (act.key === 'delete') {
          perms[permKey] = false;
        } else {
          perms[permKey] = true;
        }
      }
    }
  }
  return perms;
}

export const DEFAULT_ROLES: RoleConfig[] = [
  {
    id: 'superadmin',
    label: 'Superadmin',
    description: 'Accesso completo e illimitato a tutte le azioni CRUD e sezioni di sistema.',
    isSystem: true,
    permissions: generateDefaultPermissions(true, false, false)
  },
  {
    id: 'amministrazione',
    label: 'Amministrazione',
    description: 'Gestione contabile, incassi, contratti e anagrafiche.',
    isSystem: true,
    permissions: generateDefaultPermissions(false, false, false)
  },
  {
    id: 'commerciale',
    label: 'Commerciale',
    description: 'Gestione trattative clienti, contratti e consultazione proprie provvigioni.',
    isSystem: true,
    permissions: generateDefaultPermissions(false, true, false)
  },
  {
    id: 'direzione',
    label: 'Direzione',
    description: 'Visione strategica e reportistica di vertice.',
    isSystem: true,
    permissions: generateDefaultPermissions(false, false, false)
  },
  {
    id: 'operaio',
    label: 'Operaio / Installatore',
    description: 'Consultazione lista task assegnati e anagrafica clienti di cantiere.',
    isSystem: false,
    permissions: generateDefaultPermissions(false, false, true)
  },
  {
    id: 'tecnico',
    label: 'Tecnico di Assistenza',
    description: 'Gestione interventi tecnici e manutenzione clienti.',
    isSystem: false,
    permissions: generateDefaultPermissions(false, false, true)
  }
];

export const rolesStore = writable<RoleConfig[]>(DEFAULT_ROLES);

let unsubRoles: (() => void) | null = null;

export function initRolesStore() {
  if (unsubRoles) return;
  const docRef = doc(db, 'settings', 'roles');
  unsubRoles = onSnapshot(docRef, (snap: any) => {
    if (snap.exists() && snap.data()?.list) {
      rolesStore.set(snap.data().list);
    } else {
      rolesStore.set(DEFAULT_ROLES);
    }
  });
}

export async function saveRolesToFirestore(rolesList: RoleConfig[]) {
  const docRef = doc(db, 'settings', 'roles');
  await setDoc(docRef, { list: rolesList, updatedAt: new Date().toISOString() }, { merge: true });
}

export function can(actionKey: string, activeRole: string | null): boolean {
  if (!activeRole) return false;
  if (activeRole === 'superadmin') return true;

  const currentRoles = get(rolesStore);
  const roleConfig = currentRoles.find(r => r.id === activeRole);
  if (!roleConfig) return false;

  return !!roleConfig.permissions?.[actionKey];
}
