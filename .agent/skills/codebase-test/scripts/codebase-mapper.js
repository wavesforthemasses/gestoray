#!/usr/bin/env node

/**
 * GESTORAY CODEBASE STRUCTURAL MAPPER & AUDIT DISPATCHER
 * Generates deterministic subsystem trees, dependency graphs, template pairings, and file manifests.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../../../');

const SRC_DIR = path.join(ROOT_DIR, 'src');
const DASHBOARD_DIR = path.join(SRC_DIR, 'routes/dashboard');
const TEMPLATES_DIR = path.join(ROOT_DIR, 'scripts/templates/modules');
const REGISTRY_PATH = path.join(SRC_DIR, 'lib/config/modules.registry.json');
const RULES_PATH = path.join(ROOT_DIR, 'firestore.rules');
const MANIFEST_OUT = path.join(__dirname, '../audit-manifest.json');

console.log('🔍 Generating Gestoray Forensic Audit Manifest...');

function getAllFiles(dir, exts = ['.ts', '.svelte']) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getAllFiles(filePath, exts));
    } else {
      if (exts.some(ext => file.endsWith(ext))) {
        results.push(filePath);
      }
    }
  });
  return results;
}

// 1. Subsystems Taxonomy
const SUBSYSTEMS = {
  CORE_FOUNDATION: {
    title: '1. Core CRM, Identity & Tenant Foundation',
    modules: ['clients', 'users', 'contacts', 'profile', 'qualifications', 'settings']
  },
  FINANCE_COMMERCIAL: {
    title: '2. Commercial Pipelines & Financial Reconciliation',
    modules: ['contracts', 'payments', 'commissions']
  },
  OPERATIONS_LOGISTICS: {
    title: '3. Field Operations, Resources & Logistics',
    modules: ['places', 'teams', 'vehicles', 'scheduling', 'interventi']
  },
  PRODUCTS_HELPDESK_ACTIVITY: {
    title: '4. Products Catalog, Service Desk & Tasks',
    modules: ['products', 'tickets', 'activities', 'deadlines', 'todo']
  },
  ANALYTICS_INTELLIGENCE: {
    title: '5. Business Intelligence & Dynamic KPI Dispatcher',
    modules: ['chart']
  }
};

const manifest = {
  generatedAt: new Date().toISOString(),
  rootDir: ROOT_DIR,
  subsystems: {},
  firestoreCollections: [],
  templatesRegistry: {}
};

// 2. Map Subsystems
for (const [subKey, subDef] of Object.entries(SUBSYSTEMS)) {
  manifest.subsystems[subKey] = {
    title: subDef.title,
    modules: {}
  };

  for (const mod of subDef.modules) {
    const modDir = path.join(DASHBOARD_DIR, mod);
    const modExists = fs.existsSync(modDir);
    const tplDir = path.join(TEMPLATES_DIR, mod);
    const tplFilesDir = path.join(tplDir, 'files');

    const liveFiles = modExists ? getAllFiles(modDir).map(f => path.relative(ROOT_DIR, f)) : [];
    const tplFiles = fs.existsSync(tplFilesDir) ? getAllFiles(tplFilesDir).map(f => path.relative(ROOT_DIR, f)) : [];

    const serviceFile = path.join(modDir, `${mod}.service.ts`);
    const bridgeFile = path.join(modDir, `${mod}.kpi.bridge.ts`);
    const schemaFile = path.join(modDir, 'schema.ts');
    const testFile = path.join(modDir, `${mod}.service.test.ts`);

    manifest.subsystems[subKey].modules[mod] = {
      existsInSrc: modExists,
      hasTemplate: fs.existsSync(tplDir),
      keyFiles: {
        service: fs.existsSync(serviceFile) ? path.relative(ROOT_DIR, serviceFile) : null,
        bridge: fs.existsSync(bridgeFile) ? path.relative(ROOT_DIR, bridgeFile) : null,
        schema: fs.existsSync(schemaFile) ? path.relative(ROOT_DIR, schemaFile) : null,
        test: fs.existsSync(testFile) ? path.relative(ROOT_DIR, testFile) : null
      },
      liveFilesCount: liveFiles.length,
      liveFiles,
      templateFilesCount: tplFiles.length,
      templateFiles: tplFiles
    };
  }
}

// 3. Extract Firestore Collections from Rules
if (fs.existsSync(RULES_PATH)) {
  const rulesCode = fs.readFileSync(RULES_PATH, 'utf-8');
  const matches = rulesCode.matchAll(/match\s+\/([a-zA-Z0-9_-]+)\/\{/g);
  for (const m of matches) {
    manifest.firestoreCollections.push(m[1]);
  }
}

fs.writeFileSync(MANIFEST_OUT, JSON.stringify(manifest, null, 2));
console.log(`✅ Audit Manifest successfully generated at: ${MANIFEST_OUT}`);
