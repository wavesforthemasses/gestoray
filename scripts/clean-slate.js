#!/usr/bin/env node

/**
 * Gestoray Clean Slate Reset Utility
 * Resets the active workspace back to Clean Base Core (todo, clients, qualifications, users, settings).
 * All 7 pure modules and 5 bridge connectors remain 100% preserved in scripts/templates/!
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dashboardDir = path.resolve(__dirname, '../src/routes/dashboard');
const settingsDir = path.resolve(__dirname, '../src/routes/dashboard/settings');
const publicDir = path.resolve(__dirname, '../src/routes/public');
const webhooksDir = path.resolve(__dirname, '../src/routes/api/webhooks');
const servicesDir = path.resolve(__dirname, '../src/lib/services');
const bridgesDir = path.resolve(__dirname, '../src/lib/services/bridges');
const functionsDir = path.resolve(__dirname, '../functions');
const functionsLibDir = path.resolve(__dirname, '../functions/lib');
const menuPath = path.resolve(__dirname, '../src/lib/stores/menu.ts');
const rulesPath = path.resolve(__dirname, '../firestore.rules');
const functionsIndexPath = path.resolve(__dirname, '../functions/index.ts');

const OPTIONAL_MODULES = ['contracts', 'payments', 'commissions', 'products', 'activities', 'tickets', 'interventi'];
const OPTIONAL_SETTINGS = ['interventi', 'tickets'];

function removeFileSync(filePath) {
  if (fs.existsSync(filePath)) {
    fs.rmSync(filePath, { force: true });
  }
}

function removeDirSync(dirPath) {
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
}

function resetActiveWorkspace() {
  console.log('🧹 Esecuzione Reset Clean Base Core in corso...');

  // 1. Remove optional route modules from src/routes/dashboard/
  for (const mod of OPTIONAL_MODULES) {
    const targetDir = path.join(dashboardDir, mod);
    if (fs.existsSync(targetDir)) {
      removeDirSync(targetDir);
      console.log(`  🗑️ Rimossa rotta opzionale: src/routes/dashboard/${mod}/`);
    }
  }

  // 2. Remove optional settings sub-routes
  for (const setSub of OPTIONAL_SETTINGS) {
    const targetSetDir = path.join(settingsDir, setSub);
    if (fs.existsSync(targetSetDir)) {
      removeDirSync(targetSetDir);
      console.log(`  🗑️ Rimossa rotta impostazioni opzionale: src/routes/dashboard/settings/${setSub}/`);
    }
  }

  // 3. Remove optional public & webhook routes
  const publicInterventi = path.join(publicDir, 'interventi');
  if (fs.existsSync(publicInterventi)) {
    removeDirSync(publicInterventi);
    console.log(`  🗑️ Rimossa rotta pubblica: src/routes/public/interventi/`);
  }

  const publicTickets = path.join(publicDir, 'tickets');
  if (fs.existsSync(publicTickets)) {
    removeDirSync(publicTickets);
    console.log(`  🗑️ Rimossa rotta pubblica: src/routes/public/tickets/`);
  }

  const webhookTickets = path.join(webhooksDir, 'tickets');
  if (fs.existsSync(webhookTickets)) {
    removeDirSync(webhookTickets);
    console.log(`  🗑️ Rimosso webhook: src/routes/api/webhooks/tickets/`);
  }

  // 4. Remove optional services from src/lib/services/
  removeFileSync(path.join(servicesDir, 'interventionSettings.ts'));
  removeFileSync(path.join(servicesDir, 'ticketSettings.ts'));
  console.log(`  🗑️ Rimosse impostazioni servizi opzionali (interventionSettings, ticketSettings)`);

  // 5. Remove bridge services from src/lib/services/bridges/
  if (fs.existsSync(bridgesDir)) {
    removeDirSync(bridgesDir);
    console.log(`  🗑️ Rimossa cartella bridge opzionali: src/lib/services/bridges/`);
  }

  // 6. Clean compiled Cloud Functions output (functions/lib/)
  if (fs.existsSync(functionsLibDir)) {
    removeDirSync(functionsLibDir);
    console.log(`  🗑️ Rimossi artefatti compilati JS vecchi: functions/lib/`);
  }

  // 7. Reset menu.ts to Clean Base Core
  const cleanMenuContent = `import { writable } from 'svelte/store';
import { db, doc, onSnapshot } from '$lib/firebase';

export interface MenuItemConfig {
  id: string;
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
    let list = DEFAULT_MENU_CONFIG;
    if (snap.exists()) {
      const data = snap.data();
      list = data.list || DEFAULT_MENU_CONFIG;
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
`;

  fs.writeFileSync(menuPath, cleanMenuContent, 'utf-8');
  console.log(`  ✅ Ripristinato src/lib/stores/menu.ts al Base Core.`);

  // 8. Reset firestore.rules to Clean Base Core
  const cleanRulesContent = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    function getUserData() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data;
    }

    function hasRole(role) {
      return request.auth != null && 
             exists(/databases/$(database)/documents/users/$(request.auth.uid)) &&
             (
               ('original' in getUserData() && 'roles' in getUserData().original && getUserData().original.roles.hasAny([role])) ||
               ('roles' in getUserData() && getUserData().roles.hasAny([role])) ||
               ('role' in getUserData() && getUserData().role == role)
             );
    }
    
    function isAuth() {
      return request.auth != null;
    }
    
    function isAdmin() {
      return hasRole('superadmin') || hasRole('amministrazione');
    }

    function isDirezione() {
      return hasRole('direzione');
    }
    
    function notWritingDerived() {
      return (request.resource == null) ||
             !('derived' in request.resource.data) ||
             (resource == null && request.resource.data.derived.keys().hasOnly(['textSearch', 'cacheChunkId'])) ||
             (resource != null && (
                request.resource.data.derived == resource.data.derived ||
                request.resource.data.derived.diff(resource.data.derived).affectedKeys().hasOnly(['textSearch', 'cacheChunkId'])
             ));
    }
    
    // USERS
    match /users/{uid} {
      allow read: if isAuth();
      allow create: if isAdmin();
      allow update: if isAuth() && (request.auth.uid == uid || isAdmin());
      allow delete: if hasRole('superadmin');
    }
    
    // CLIENTS
    match /clients/{clientId} {
      allow read: if isAuth();
      allow create: if isAuth() && notWritingDerived();
      allow update: if isAuth() && notWritingDerived();
      allow delete: if hasRole('superadmin');
      
      match /activities/{activityId} {
        allow read, write: if isAuth();
      }

      match /locations/{locationId} {
        allow read, write: if isAuth();
      }

      match /history/{histId} {
        allow read: if isAuth();
        allow create: if isAuth();
        allow update: if false;
        allow delete: if hasRole('superadmin');
      }
    }
    
    // QUALIFICATIONS
    match /qualifications/{qualId} {
      allow read: if isAuth();
      allow create, update, delete: if hasRole('superadmin');
    }

    // SETTINGS
    match /settings/{settingId} {
      allow read: if isAuth();
      allow write: if isAuth() && (hasRole('superadmin') || isDirezione() || isAdmin());
    }

    // LOGIN PINS
    match /login_pins/{email} {
      allow read, write: if false;
    }

    // SYSTEM CONFIG & TENANT FEATURES
    match /system_config/{configId} {
      allow read: if isAuth();
      allow write: if isAdmin();
    }

    // SYSTEM CACHE
    match /system_cache/{cacheId} {
      allow read, write: if isAuth();
    }

    // CUSTOM FIELDS
    match /custom_fields/{fieldId} {
      allow read: if isAuth();
      allow write: if isAdmin();
    }

    // ANALYTICS & MATERIALIZED VIEWS
    match /analytics_monthly/{monthDoc} {
      allow read: if isAuth();
      allow write: if false;

      match /{subcollection=**} {
        allow read: if isAuth();
        allow write: if false;
      }
    }
  }
}
`;

  fs.writeFileSync(rulesPath, cleanRulesContent, 'utf-8');
  console.log(`  ✅ Ripristinato firestore.rules al Base Core.`);

  // 9. Reset functions/index.ts to Clean Base Core
  const cleanFunctionsIndex = `import * as admin from 'firebase-admin';
import { setGlobalOptions } from 'firebase-functions/v2';

setGlobalOptions({ region: 'europe-west3' });

if (admin.apps.length === 0) {
  admin.initializeApp();
}

export { sendLoginPin, verifyLoginPin } from './src/auth';
export { initSuperAdmin, updateUser } from './src/admin';
export { updateProfile, updateProfileEmail } from './src/profile';
export { sendSystemEmail } from './src/email';
export { getChartAggregations } from './src/aggregations';
export { onClientCreated, onClientUpdated } from './src/triggers/onClientCreated';
`;

  fs.writeFileSync(functionsIndexPath, cleanFunctionsIndex, 'utf-8');
  console.log(`  ✅ Ripristinato functions/index.ts al Base Core.`);

  // 10. Rebuild Clean Base Core functions into functions/lib/index.js
  try {
    console.log('⚡ Compilazione Cloud Functions Base Core...');
    execSync('npm --prefix functions run build', { stdio: 'inherit' });
    console.log('  ✅ Compilazione Cloud Functions completata!');
  } catch (err) {
    console.warn('⚠️ Avviso compilazione functions:', err.message);
  }

  console.log(`\n✨ RESET COMPLETATO! Gestoray è ora in stato Clean Base Core.`);
  console.log(`📌 Puoi installare qualsiasi modulo o bridge on-demand con:`);
  console.log(`   npm run module:install -- --name contracts`);
  console.log(`   npm run bridge:install -- --name contractsInterventiBridge`);
}

resetActiveWorkspace();
