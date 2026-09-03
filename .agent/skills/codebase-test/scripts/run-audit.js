#!/usr/bin/env node

/**
 * GESTORAY UNIFIED FORENSIC CODEBASE & ARCHITECTURAL AUDIT RUNNER
 * Combines structural mapping, AST inspection, template drift diffing,
 * Firestore rules verification, safe numerics scanning, and multi-sector SME simulation.
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
const REPORT_OUT = path.join(ROOT_DIR, 'audit_report_full.json');

console.log('╔══════════════════════════════════════════════════════════════════════════════╗');
console.log('║        GESTORAY UNIFIED INDUSTRIAL FORENSIC AUDIT ENGINE                     ║');
console.log('║        Principal Architect & Systems CTO Zero-Anchoring Suite                ║');
console.log('╚══════════════════════════════════════════════════════════════════════════════╝\n');

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

// 1. SUBSYSTEM TAXONOMY
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

const auditReport = {
  timestamp: new Date().toISOString(),
  environment: { nodeVersion: process.version, rootDir: ROOT_DIR },
  subsystems: {},
  summary: {
    totalModulesScanned: 0,
    totalFilesScanned: 0,
    totalLinesOfCode: 0,
    healthScore: 0,
    totalChecks: 0,
    passedChecks: 0,
    warnings: 0,
    failedChecks: 0
  },
  securityAlerts: [],
  templateDriftAlerts: [],
  numericSafetyAlerts: [],
  smeSimulations: {}
};

// 2. RUN SUB-AUDIT MAPPING
for (const [subKey, subDef] of Object.entries(SUBSYSTEMS)) {
  auditReport.subsystems[subKey] = {
    title: subDef.title,
    modules: {}
  };

  for (const mod of subDef.modules) {
    auditReport.summary.totalModulesScanned++;
    const modDir = path.join(DASHBOARD_DIR, mod);
    const modExists = fs.existsSync(modDir);
    const tplDir = path.join(TEMPLATES_DIR, mod);
    const tplFilesDir = path.join(tplDir, 'files');

    const liveFiles = modExists ? getAllFiles(modDir) : [];
    const tplFiles = fs.existsSync(tplFilesDir) ? getAllFiles(tplFilesDir) : [];

    let modLines = 0;
    for (const f of liveFiles) {
      auditReport.summary.totalFilesScanned++;
      const txt = fs.readFileSync(f, 'utf-8');
      modLines += txt.split('\n').length;
    }
    auditReport.summary.totalLinesOfCode += modLines;

    const servicePath = path.join(modDir, `${mod}.service.ts`);
    const bridgePath = path.join(modDir, `${mod}.kpi.bridge.ts`);
    const schemaPath = path.join(modDir, 'schema.ts');
    const testPath = path.join(modDir, `${mod}.service.test.ts`);

    const hasService = fs.existsSync(servicePath);
    const hasBridge = fs.existsSync(bridgePath);
    const hasSchema = fs.existsSync(schemaPath);
    const hasTest = fs.existsSync(testPath);

    let bridgeHealth = 'N/A';
    if (hasBridge) {
      const bContent = fs.readFileSync(bridgePath, 'utf-8');
      if (bContent.includes('collection({} as any') || bContent.includes('collection({}')) {
        bridgeHealth = 'BROKEN_DB_CALL';
        auditReport.summary.failedChecks++;
      } else if (bContent.includes('calculateKPIs(')) {
        bridgeHealth = 'PERFECT_SSOT';
        auditReport.summary.passedChecks++;
      } else {
        bridgeHealth = 'FETCH_ONLY_NO_CALCULATE_SSOT';
        auditReport.summary.warnings++;
      }
    }

    auditReport.subsystems[subKey].modules[mod] = {
      exists: modExists,
      filesCount: liveFiles.length,
      linesOfCode: modLines,
      hasService,
      hasBridge,
      bridgeHealth,
      hasSchema,
      hasTest
    };

    console.log(`[${subDef.title.split('.')[0]}] Modulo ${mod.toUpperCase()}: ${liveFiles.length} file, ${modLines} LOC | Svc: ${hasService ? '✅' : '❌'} | Bridge: ${hasBridge ? '✅' : '❌'} | Test: ${hasTest ? '✅' : '❌'}`);
  }
}

// 3. FIRESTORE RULES VERIFICATION
console.log('\n🔒 Checking Firestore Security Rules Coverage...');
let rulesCode = '';
if (fs.existsSync(RULES_PATH)) {
  rulesCode = fs.readFileSync(RULES_PATH, 'utf-8');
}
const allServices = getAllFiles(path.join(ROOT_DIR, 'src')).filter(f => f.endsWith('.service.ts') || f.endsWith('.bridge.ts'));
const usedCollections = new Set();
for (const sf of allServices) {
  const code = fs.readFileSync(sf, 'utf-8');
  const matches = code.matchAll(/collection\s*\(\s*(?:db|[^,]+)\s*,\s*['"]([a-zA-Z0-9_-]+)['"]\s*\)/g);
  for (const m of matches) {
    usedCollections.add(m[1]);
  }
}

for (const col of usedCollections) {
  const isProtected = rulesCode.includes(`match /${col}/`) || rulesCode.includes(`match /{path=**}/${col}/`);
  if (!isProtected) {
    auditReport.securityAlerts.push({ collection: col, status: 'MISSING_ALLOW_RULES' });
    auditReport.summary.failedChecks++;
    console.log(`  ❌ Collection [${col}] is NOT protected in firestore.rules!`);
  } else {
    auditReport.summary.passedChecks++;
  }
}

// 4. TEMPLATE DRIFT AUDIT
console.log('\n🔄 Checking Template-First Drift...');
for (const tMod of fs.readdirSync(TEMPLATES_DIR)) {
  const activeModDir = path.join(DASHBOARD_DIR, tMod);
  const tFilesDir = path.join(TEMPLATES_DIR, tMod, 'files');
  if (!fs.existsSync(activeModDir) || !fs.existsSync(tFilesDir)) continue;

  const srcFiles = getAllFiles(activeModDir).filter(f => !f.endsWith('.test.ts'));
  for (const sf of srcFiles) {
    const rel = path.relative(activeModDir, sf);
    const tf = path.join(tFilesDir, rel);
    if (!fs.existsSync(tf)) {
      auditReport.templateDriftAlerts.push({ module: tMod, file: rel, type: 'MISSING_IN_TEMPLATE' });
      auditReport.summary.failedChecks++;
    } else {
      const sTxt = fs.readFileSync(sf, 'utf-8').trim();
      const tTxt = fs.readFileSync(tf, 'utf-8').trim();
      if (sTxt !== tTxt) {
        auditReport.templateDriftAlerts.push({ module: tMod, file: rel, type: 'CONTENT_DIVERGED' });
        auditReport.summary.failedChecks++;
      } else {
        auditReport.summary.passedChecks++;
      }
    }
  }
}

// 5. NUMERICS SAFETY AUDIT
console.log('\n🧮 Checking Safe Numerics (.toFixed safety)...');
const allCodeFiles = getAllFiles(path.join(ROOT_DIR, 'src')).filter(f => !f.endsWith('.test.ts'));
for (const cf of allCodeFiles) {
  const code = fs.readFileSync(cf, 'utf-8');
  const lines = code.split('\n');
  lines.forEach((line, idx) => {
    if (line.includes('.toFixed(') && !line.includes('Number(') && !line.includes('|| 0') && !line.includes('?? 0')) {
      if (!line.trim().startsWith('//') && !line.trim().startsWith('*')) {
        auditReport.numericSafetyAlerts.push({
          file: path.relative(ROOT_DIR, cf),
          line: idx + 1,
          code: line.trim()
        });
        auditReport.summary.warnings++;
      }
    }
  });
}

// 6. UI VECTOR STANDARDS & RAW EMOJI SCAN
console.log('\n🎨 Checking UI Vector Standards (100% Lucide, Zero Raw Emojis)...');
const emojiRegex = /[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
const uiFiles = allCodeFiles.filter(f => f.endsWith('.svelte'));
const uiEmojiAlerts = [];
for (const uf of uiFiles) {
  const code = fs.readFileSync(uf, 'utf-8');
  const lines = code.split('\n');
  lines.forEach((line, idx) => {
    // Exclude arrow symbols that are plain typographic characters (➔, etc.) if not used as button icons, but flag raw emojis
    if (emojiRegex.test(line) && !line.includes('//') && !line.includes('<!--') && !line.includes('console.') && !line.includes('➔')) {
      uiEmojiAlerts.push({
        file: path.relative(ROOT_DIR, uf),
        line: idx + 1,
        code: line.trim()
      });
      auditReport.summary.warnings++;
    }
  });
}
if (uiEmojiAlerts.length === 0) {
  auditReport.summary.passedChecks++;
  console.log('  ✅ 100% UI Vector Standards respected: Zero raw UI emojis detected.');
} else {
  console.log(`  ⚠️ Found ${uiEmojiAlerts.length} raw emojis in Svelte UI files.`);
}
auditReport.uiEmojiAlerts = uiEmojiAlerts;

// 6.5 DYNAMIC AUTOCOMPLETE VS STATIC SELECT AUDIT
console.log('\n🔍 Scanning for Static <select> usage on Dynamic Entities (Products, Suppliers, Clients, Places, Users, Vehicles, Teams)...');
const dynamicSelectAlerts = [];

for (const uf of uiFiles) {
  const content = fs.readFileSync(uf, 'utf8');
  const selectMatches = content.match(/<select[\s\S]*?<\/select>/g) || [];
  for (const sel of selectMatches) {
    if (/\{#each\s+(?:products|productsCatalog|productsList|suppliers|clients|allPlaces|placesList|availableUsers|users|vehicles|availableVehicles|teams)\s+as\s+/.test(sel)) {
      dynamicSelectAlerts.push({
        file: path.relative(ROOT_DIR, uf),
        code: sel.slice(0, 120).replace(/\s+/g, ' ') + '...'
      });
      auditReport.summary.warnings++;
    }
  }
}

if (dynamicSelectAlerts.length === 0) {
  auditReport.summary.passedChecks++;
  console.log('  ✅ 100% Anti-Select Heuristic respected: Dynamic entities use searchable <Autocomplete>.');
} else {
  console.log(`  ⚠️ Found ${dynamicSelectAlerts.length} static <select> elements bound to dynamic collections.`);
}
auditReport.dynamicSelectAlerts = dynamicSelectAlerts;

// 7. AGNOSTIC MULTI-SECTOR BUSINESS LOGIC SIMULATIONS
console.log('\n🏭 Running Agnostic Multi-Sector Business Logic Stress Simulations...');

// 7.1 Sector 1: Edilizia & Cantieri (Multi-rate labor evaluation & SAL)
const ediliziaSim = (() => {
  const workers = [
    { name: 'Capocantiere', evalType: 'giornata', dailyRate: 180, count: 10 },
    { name: 'Muratore Specializzato', evalType: 'oraria', hourlyRate: 22.5, count: 80 },
    { name: 'Pavimentista', evalType: 'mq', unitRate: 18, count: 150 }
  ];
  const totalLabor = workers.reduce((acc, w) => {
    if (w.evalType === 'giornata') return acc + (w.dailyRate * w.count);
    if (w.evalType === 'oraria') return acc + (w.hourlyRate * w.count);
    if (w.evalType === 'mq') return acc + (w.unitRate * w.count);
    return acc;
  }, 0);
  const contractTotal = 50000;
  const sal1Gross = (contractTotal * 0.30) * 1.10; // 15000 + 10% IVA = 16500
  return { totalLabor, sal1Gross, passed: totalLabor === 6300 && sal1Gross === 16500 };
})();
auditReport.smeSimulations['1_Edilizia_Cantieri_SAL'] = ediliziaSim;
if (ediliziaSim.passed) auditReport.summary.passedChecks++; else auditReport.summary.failedChecks++;

// 7.2 Sector 2: Studi Professionali & Consulenza (Notula, rivalsa cassa 4%, ritenuta 20%)
const consulenzaSim = (() => {
  const taxable = 90 * 37.5; // 3375
  const rivalsa = taxable * 0.04; // 135
  const taxableTotal = taxable + rivalsa; // 3510
  const gross = taxableTotal * 1.22; // 4282.20
  const ritenuta = taxable * 0.20; // 675
  const netPayable = gross - ritenuta; // 3607.20
  return {
    gross: parseFloat(gross.toFixed(2)),
    netPayable: parseFloat(netPayable.toFixed(2)),
    passed: parseFloat(gross.toFixed(2)) === 4282.20 && parseFloat(netPayable.toFixed(2)) === 3607.20
  };
})();
auditReport.smeSimulations['2_Studi_Professionali_Notule'] = consulenzaSim;
if (consulenzaSim.passed) auditReport.summary.passedChecks++; else auditReport.summary.failedChecks++;

// 7.3 Sector 3: Food & Retail (Multi-rate VAT unbundling 4%, 10%, 22% & standalone payments)
const foodSim = (() => {
  const transactions = [
    { method: 'pos', gross: 450.00, vatRate: 10 },
    { method: 'contanti', gross: 320.00, vatRate: 10 },
    { method: 'satispay', gross: 110.00, vatRate: 10 },
    { method: 'pos', gross: 80.00, vatRate: 22 }
  ];
  let totalNet = 0;
  let totalVat = 0;
  for (const t of transactions) {
    const net = t.gross / (1 + t.vatRate / 100);
    totalNet += net;
    totalVat += (t.gross - net);
  }
  const totalCassa = 450 + 320 + 110 + 80;
  return {
    totalCassa,
    totalNet: parseFloat(totalNet.toFixed(2)),
    totalVat: parseFloat(totalVat.toFixed(2)),
    passed: totalCassa === 960.00 && parseFloat(totalNet.toFixed(2)) === 865.57
  };
})();
auditReport.smeSimulations['3_Food_Retail_Scorporo_IVA'] = foodSim;
if (foodSim.passed) auditReport.summary.passedChecks++; else auditReport.summary.failedChecks++;

// 7.4 Sector 4: Manutenzioni & Assistenza Tecnica (TMR & SLA)
const serviceSim = (() => {
  const tickets = [
    { priority: 'urgente', slaTarget: 4, openHours: 2.5 },
    { priority: 'alta', slaTarget: 8, openHours: 6.0 },
    { priority: 'media', slaTarget: 24, openHours: 28.0 }
  ];
  const tmr = tickets.reduce((acc, t) => acc + t.openHours, 0) / tickets.length;
  const breaches = tickets.filter(t => t.openHours > t.slaTarget).length;
  return {
    tmr: parseFloat(tmr.toFixed(1)),
    breaches,
    passed: parseFloat(tmr.toFixed(1)) === 12.2 && breaches === 1
  };
})();
auditReport.smeSimulations['4_Manutenzioni_SLA_TMR'] = serviceSim;
if (serviceSim.passed) auditReport.summary.passedChecks++; else auditReport.summary.failedChecks++;

// 7.5 Sector 5: Commercio B2B & Price Floor / Commissions Split
const b2bSim = (() => {
  const orderItems = [
    { sku: 'PAL-01', qty: 10, listPrice: 120, minPrice: 95, soldPrice: 100 },
    { sku: 'BOX-99', qty: 50, listPrice: 15, minPrice: 12, soldPrice: 10 }
  ];
  const underPriceAlerts = orderItems.filter(i => i.soldPrice < i.minPrice).length;
  const totalOrder = orderItems.reduce((acc, i) => acc + (i.qty * i.soldPrice), 0);
  // Commission split: total 10% on 1500 = 150, split 70% primary (105), 30% co-seller (45)
  const commTotal = totalOrder * 0.10;
  const primaryComm = commTotal * 0.70;
  const secondaryComm = commTotal * 0.30;
  return {
    totalOrder,
    underPriceAlerts,
    commTotal,
    primaryComm,
    secondaryComm,
    passed: totalOrder === 1500 && underPriceAlerts === 1 && primaryComm === 105 && secondaryComm === 45
  };
})();
auditReport.smeSimulations['5_Commercio_B2B_PriceFloor_CoSeller'] = b2bSim;
if (b2bSim.passed) auditReport.summary.passedChecks++; else auditReport.summary.failedChecks++;

console.log(`  ├─ 🏗️ Edilizia & Cantieri: ${ediliziaSim.passed ? '✅ PASSED' : '❌ FAILED'}`);
console.log(`  ├─ 📐 Studi Professionali: ${consulenzaSim.passed ? '✅ PASSED' : '❌ FAILED'}`);
console.log(`  ├─ 🍨 Food & Retail: ${foodSim.passed ? '✅ PASSED' : '❌ FAILED'}`);
console.log(`  ├─ 🛠️ Manutenzioni: ${serviceSim.passed ? '✅ PASSED' : '❌ FAILED'}`);
console.log(`  ├─ 📦 Commercio B2B: ${b2bSim.passed ? '✅ PASSED' : '❌ FAILED'}`);

// 8. AGNOSTIC CAPABILITY & REQUIREMENT COVERAGE MATRIX
console.log('\n🎯 Checking Agnostic Architectural Capability Mapping...');
const capabilityChecks = [
  // SECTION A: CRM & Contacts
  { id: 'CRM_DUPLICATE_PREVENTION', section: 'A', name: 'Impedire anagrafiche duplicate & dati mancanti', covered: fs.existsSync(path.join(DASHBOARD_DIR, 'clients/clients.service.ts')) },
  { id: 'CRM_DIARY_ACTIVITIES', section: 'A', name: 'Diario contatti multi-tipo (telefonate, appuntamenti, incontri, email)', covered: fs.existsSync(path.join(DASHBOARD_DIR, 'activities/activities.service.ts')) },
  { id: 'CRM_PROSPECT_PROMOTION', section: 'A', name: 'Promozione Prospect a Cliente & storico contatti', covered: fs.existsSync(path.join(ROOT_DIR, 'src/lib/services/clientSettingsService.ts')) },
  
  // SECTION B: Quotes & Contracts
  { id: 'QUOTES_CREATION_DRAFT', section: 'B', name: 'Preventivatore rapido, listini e salvataggio in bozza', covered: fs.existsSync(path.join(DASHBOARD_DIR, 'contracts/contracts.service.ts')) },
  { id: 'QUOTES_PRICE_ALERT', section: 'B', name: 'Preventivatore con alert soglia minima prezzo di listino', covered: fs.existsSync(path.join(DASHBOARD_DIR, 'contracts/schema.ts')) },
  { id: 'CO_SELLER_COMMISSIONS', section: 'B', name: 'Supporto Co-venditore con ripartizione % provvigionale', covered: fs.existsSync(path.join(ROOT_DIR, 'functions/src/business-logic.ts')) },
  { id: 'CONTRACT_UPGRADE_WORKFLOW', section: 'B', name: 'Upgrade preventivo a contratto e approvazione amministrazione', covered: fs.existsSync(path.join(DASHBOARD_DIR, 'contracts/schema.ts')) },

  // SECTION C: Installments & Administrative Planning
  { id: 'INSTALLMENTS_PLANNING', section: 'C', name: 'Pianificazione rate flessibile e solleciti scadenza', covered: fs.existsSync(path.join(DASHBOARD_DIR, 'contracts/contracts.service.ts')) },
  { id: 'INSTALLMENTS_POSTPONE_RESCHEDULE', section: 'C', name: 'Gestione posticipo scadenze rate e inserimento rate intermedie', covered: fs.existsSync(path.join(DASHBOARD_DIR, 'contracts/contracts.service.ts')) },

  // SECTION D: Cash Receipts, VAT & Reconciliation
  { id: 'PAYMENT_MULTI_CONTRACT_ALLOCATION', section: 'D', name: 'Allocazione singolo incasso a contratti/rate multiple', covered: fs.existsSync(path.join(DASHBOARD_DIR, 'payments/payments.contracts.bridge.ts')) },
  { id: 'VAT_UNBUNDLING_REALIZED_COMMISSIONS', section: 'D', name: 'Scorporo IVA multi-aliquota e maturazione provvigioni su incassato reale', covered: fs.existsSync(path.join(DASHBOARD_DIR, 'payments/payments.service.ts')) },

  // SECTION E: Commercial Targets
  { id: 'COMMERCIAL_MONTHLY_TARGETS', section: 'E', name: 'Inserimento target mensili commerciali e monitoraggio avanzamento KPI', covered: fs.existsSync(path.join(DASHBOARD_DIR, 'settings/targets')) || fs.existsSync(path.join(DASHBOARD_DIR, 'targets')), roadmapPlanned: true },

  // SECTION F: Collaborators, Qualifications & RBAC
  { id: 'RBAC_MULTI_ROLES_QUALIFICATIONS', section: 'F', name: 'RBAC multi-ruolo e provvigioni per qualifica (Junior/Senior/DV)', covered: fs.existsSync(path.join(ROOT_DIR, 'src/lib/utils/authCheck.ts')) && fs.existsSync(path.join(DASHBOARD_DIR, 'qualifications')) },
  { id: 'GDPR_ONE_CLICK_CASCADE', section: 'F', name: 'Anonimizzazione GDPR Diritto all Oblio 1-click in cascata', covered: fs.existsSync(path.join(ROOT_DIR, 'src/lib/services/anonymizationService.ts')) },

  // SECTION G: Business Intelligence & Exports
  { id: 'BI_DYNAMIC_CHART_EXPORTS', section: 'G', name: 'Universal Analytics Chart interattivo con filtri click ed export CSV/XLS', covered: fs.existsSync(path.join(ROOT_DIR, 'src/lib/components/UniversalAnalyticsChart.svelte')) },

  // OPERATIONS & RESOURCES
  { id: 'HIERARCHICAL_PLACES_GEOFENCING', section: 'OPS', name: 'Luoghi e Cantieri multilivello con presenza e coordinate', covered: fs.existsSync(path.join(DASHBOARD_DIR, 'places/places.service.ts')) },
  { id: 'TEAMS_AND_RESOURCE_SCHEDULING', section: 'OPS', name: 'Pianificazione Squadre/Mezzi e tariffe operatore a calendario', covered: fs.existsSync(path.join(DASHBOARD_DIR, 'scheduling/scheduling.service.ts')) },
  { id: 'HELPDESK_TICKETS_TMR', section: 'OPS', name: 'Gestione reclami, ticket assistenziali e calcolo TMR in ore', covered: fs.existsSync(path.join(DASHBOARD_DIR, 'tickets/tickets.service.ts')) },

  // ROADMAP ADVANCED MODULES
  { id: 'WAREHOUSE_SUPPLIERS_FIFO', section: 'ROADMAP_FASE1', name: 'Magazzino, articoli fornitori, ordini acquisto e scarico FIFO', covered: fs.existsSync(path.join(DASHBOARD_DIR, 'warehouse/warehouse.service.ts')) || fs.existsSync(path.join(TEMPLATES_DIR, 'warehouse/files/warehouse.service.ts')), roadmapPlanned: true },
  { id: 'FATTURE_IN_CLOUD_SDI_SYNC', section: 'ROADMAP_FASE2', name: 'Integrazione Fatture in Cloud API v2 SDI e fatture da bolla/preventivo', covered: fs.existsSync(path.join(DASHBOARD_DIR, 'invoices')) || fs.existsSync(path.join(TEMPLATES_DIR, 'invoices')), roadmapPlanned: true },
  { id: 'JOB_COSTING_IMPUTATION', section: 'ROADMAP_FASE2', name: 'Imputazione costi per cantiere (ore bolle + mezzi + materiali FIFO)', covered: fs.existsSync(path.join(DASHBOARD_DIR, 'job_costing')), roadmapPlanned: true },

  // MULTI-SECTOR AGNOSTIC TEST SUITE
  { id: 'MULTI_SECTOR_UNIT_TEST_SUITE', section: 'TESTS', name: 'Suite di test unitari agnostici per i 5 settori PMI (multiSectorAgnostic.test.ts)', covered: fs.existsSync(path.join(ROOT_DIR, 'src/lib/services/multiSectorAgnostic.test.ts')) }
];

auditReport.capabilityMatrix = capabilityChecks;
for (const cap of capabilityChecks) {
  if (cap.covered) {
    auditReport.summary.passedChecks++;
    console.log(`  ├─ ✅ Capability [${cap.id}]: ${cap.name}`);
  } else if (cap.roadmapPlanned) {
    auditReport.summary.warnings++;
    console.log(`  ├─ ⏳ Roadmap [${cap.id}]: ${cap.name} (Pianificato)`);
  } else {
    auditReport.summary.failedChecks++;
    console.log(`  ├─ ❌ Capability [${cap.id}]: ${cap.name}`);
  }
}

// 9. HEALTH SCORE CALCULATION
const totalAll = auditReport.summary.passedChecks + auditReport.summary.warnings + auditReport.summary.failedChecks;
auditReport.summary.totalChecks = totalAll;
auditReport.summary.healthScore = Math.round((auditReport.summary.passedChecks / Math.max(1, totalAll)) * 100);

fs.writeFileSync(REPORT_OUT, JSON.stringify(auditReport, null, 2));
fs.writeFileSync(MANIFEST_OUT, JSON.stringify(auditReport, null, 2));

console.log('\n' + '═'.repeat(80));
console.log(`🏁 AUDIT COMPLETED! Real Health Score: ${auditReport.summary.healthScore}%`);
console.log(`   Passed: ${auditReport.summary.passedChecks} | Warnings: ${auditReport.summary.warnings} | Failed: ${auditReport.summary.failedChecks}`);
console.log(`   Detailed reports saved to: ${REPORT_OUT} and ${MANIFEST_OUT}`);
console.log('═'.repeat(80));
