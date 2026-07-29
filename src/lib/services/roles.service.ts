import { db, doc, getDoc, setDoc, onSnapshot } from '$lib/firebase';
import { writable, get } from 'svelte/store';
import modulesRegistry from '$lib/config/modules.registry.json';

export type ActionKey = 'list' | 'read' | 'create' | 'update' | 'delete';

export interface ModulePermissionSpec {
  module: string;
  label: string;
  actions: { key: ActionKey; label: string }[];
}

export const BASE_MODULE_PERMISSIONS: ModulePermissionSpec[] = [
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
    module: 'qualifications',
    label: 'Gestione Qualifiche',
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
  },
  {
    module: 'settings',
    label: 'Impostazioni Generali',
    actions: [
      { key: 'list', label: 'Elenco' },
      { key: 'read', label: 'Dettaglio' },
      { key: 'create', label: 'Creazione' },
      { key: 'update', label: 'Modifica' },
      { key: 'delete', label: 'Eliminazione' },
    ]
  }
];

const MODULE_ROLE_SPECS: ModulePermissionSpec[] = (modulesRegistry.modules || []).map((m: any) => ({
  module: m.id,
  label: m.label,
  actions: [
    { key: 'list', label: 'Elenco' },
    { key: 'read', label: 'Dettaglio' },
    { key: 'create', label: 'Creazione' },
    { key: 'update', label: 'Modifica' },
    { key: 'delete', label: 'Eliminazione' }
  ]
}));

export const ALL_MODULE_PERMISSIONS: ModulePermissionSpec[] = [
  ...BASE_MODULE_PERMISSIONS,
  ...MODULE_ROLE_SPECS
];

export const MODULE_PERMISSIONS_REGISTRY = ALL_MODULE_PERMISSIONS;

export interface RoleConfig {
  id: string;
  label: string;
  description: string;
  isSystem?: boolean;
  permissions: Record<string, boolean>;
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
        perms[permKey] = false;
      }
    }
  }
  return perms;
}

export const DEFAULT_ROLES_CONFIG: RoleConfig[] = [
  {
    id: 'superadmin',
    label: 'Super Admin',
    description: 'Accesso completo e illimitato a tutte le sezioni, configurazioni aziendali e permessi.',
    isSystem: true,
    permissions: generateDefaultPermissions(true, false, false)
  },
  {
    id: 'direzione',
    label: 'Direzione / CEO',
    description: 'Visione completa di dati commerciali, operativi ed economico-finanziari senza gestione utenti di sistema.',
    isSystem: true,
    permissions: generateDefaultPermissions(true, false, false)
  },
  {
    id: 'amministrazione',
    label: 'Amministrazione',
    description: 'Gestione incassi, contratti, scadenze e anagrafica clienti con restrizioni su eliminazione utenti.',
    isSystem: true,
    permissions: generateDefaultPermissions(true, false, false)
  },
  {
    id: 'commerciale',
    label: 'Commerciale / Agente',
    description: 'Accesso all anagrafica clienti assegnata, inserimento contratti e tracciamento proprie provvigioni.',
    isSystem: true,
    permissions: generateDefaultPermissions(false, true, false)
  },
  {
    id: 'tecnico',
    label: 'Tecnico / Operaio Campo',
    description: 'Accesso limitato alla consultazione dei clienti e compilazione interventi tecnici o to-do operativi.',
    isSystem: true,
    permissions: generateDefaultPermissions(false, false, true)
  }
];

export const rolesConfigStore = writable<RoleConfig[]>(DEFAULT_ROLES_CONFIG);
export const rolesStore = rolesConfigStore;

let rolesUnsubscribe: (() => void) | null = null;

export function initRolesStore() {
  if (rolesUnsubscribe) return;
  const docRef = doc(db, 'settings', 'roles');
  rolesUnsubscribe = onSnapshot(docRef, (snap: any) => {
    if (snap.exists() && snap.data().list) {
      rolesConfigStore.set(snap.data().list);
    } else {
      rolesConfigStore.set(DEFAULT_ROLES_CONFIG);
    }
  });
}

export function destroyRolesStore() {
  if (rolesUnsubscribe) {
    rolesUnsubscribe();
    rolesUnsubscribe = null;
  }
}

export async function saveRolesConfig(roles: RoleConfig[]): Promise<void> {
  const docRef = doc(db, 'settings', 'roles');
  await setDoc(docRef, { list: roles, updatedAt: new Date().toISOString() }, { merge: true });
}

export const saveRolesToFirestore = saveRolesConfig;

export function can(arg1: string, arg2?: string | null): boolean {
  if (!arg1) return false;
  let permKey = arg1;
  let roleId = arg2;

  if (arg1.includes(':')) {
    permKey = arg1;
    roleId = arg2 || null;
  } else if (arg2 && arg2.includes(':')) {
    permKey = arg2;
    roleId = arg1;
  }

  if (!roleId) return false;
  if (roleId === 'superadmin') return true;
  const roles = get(rolesConfigStore);
  const roleObj = roles.find((r) => r.id === roleId);
  if (!roleObj) return false;
  return roleObj.permissions[permKey] !== false;
}
