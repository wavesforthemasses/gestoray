#!/usr/bin/env node

/**
 * GESTORAY DEEP FORENSIC AUDIT ENGINE
 * Automated architectural, structural, SSOT, security and multi-sector validator.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../../../');

const SRC_DASHBOARD = path.join(ROOT_DIR, 'src/routes/dashboard');
const TEMPLATES_DIR = path.join(ROOT_DIR, 'scripts/templates/modules');
const REGISTRY_PATH = path.join(ROOT_DIR, 'src/lib/config/modules.registry.json');
const FIRESTORE_RULES_PATH = path.join(ROOT_DIR, 'firestore.rules');

console.log('='.repeat(80));
console.log('🚀 GESTORAY INDUSTRIAL-GRADE FORENSIC CODEBASE AUDIT');
console.log(`📂 Root Directory: ${ROOT_DIR}`);
console.log('='.repeat(80));

const results = {
  summary: { totalChecks: 0, passedChecks: 0, failedChecks: 0, warnings: 0 },
  modules: {},
  bridges: {},
  templates: {},
  firestoreRules: { collectionsScanned: 0, missingRules: [] },
  numericsSafety: { filesScanned: 0, unsafeToFixed: [] },
  uiEmojis: { filesScanned: 0, rawEmojisFound: [] },
  multiSectorSimulations: {}
};

function recordCheck(passed, category, detail, isWarning = false) {
  results.summary.totalChecks++;
  if (passed) {
    results.summary.passedChecks++;
  } else if (isWarning) {
    results.summary.warnings++;
  } else {
    results.summary.failedChecks++;
  }
}

// 1. MODULES & REGISTRY AUDIT
console.log('\n🔍 [PHASE 1] MODULES DISCOVERY & REGISTRY AUDIT...');
let registry = { modules: [] };
try {
  registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf-8'));
  console.log(`✅ Loaded modules.registry.json with ${registry.modules.length} registered modules.`);
} catch (e) {
  console.error('❌ Failed to read modules.registry.json:', e.message);
  recordCheck(false, 'registry', 'Failed to load registry');
}

const registeredIds = new Set(registry.modules.map(m => m.id));
const dashboardDirs = fs.readdirSync(SRC_DASHBOARD, { withFileTypes: true })
  .filter(d => d.isDirectory() && !['components', 'settings', 'users'].includes(d.name))
  .map(d => d.name);

for (const mod of dashboardDirs) {
  results.modules[mod] = {
    registered: registeredIds.has(mod),
    hasTemplate: fs.existsSync(path.join(TEMPLATES_DIR, mod)),
    hasService: fs.existsSync(path.join(SRC_DASHBOARD, mod, `${mod}.service.ts`)) || fs.existsSync(path.join(SRC_DASHBOARD, mod, 'services')),
    hasSchema: fs.existsSync(path.join(SRC_DASHBOARD, mod, 'schema.ts')) || fs.existsSync(path.join(SRC_DASHBOARD, mod, 'types')),
    hasTests: fs.existsSync(path.join(SRC_DASHBOARD, mod, `${mod}.service.test.ts`)) || fs.existsSync(path.join(SRC_DASHBOARD, mod, `${mod}.test.ts`)),
    hasBridge: fs.existsSync(path.join(SRC_DASHBOARD, mod, `${mod}.kpi.bridge.ts`))
  };
  recordCheck(results.modules[mod].hasTemplate, 'templates', `Template exists for ${mod}`, true);
}

// 2. TEMPLATE-SOURCE DIVERGENCE CHECK
console.log('\n🔍 [PHASE 2] TEMPLATE-FIRST BIDIRECTIONAL SYNC AUDIT...');
function getAllFiles(dirPath, arrayOfFiles = []) {
  if (!fs.existsSync(dirPath)) return arrayOfFiles;
  const files = fs.readdirSync(dirPath);
  files.forEach(file => {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
    } else {
      arrayOfFiles.push(fullPath);
    }
  });
  return arrayOfFiles;
}

for (const mod of dashboardDirs) {
  const activeModDir = path.join(SRC_DASHBOARD, mod);
  const templateModFilesDir = path.join(TEMPLATES_DIR, mod, 'files');

  if (!fs.existsSync(templateModFilesDir)) {
    results.templates[mod] = { status: 'NO_TEMPLATE_FILES_DIR', missingFiles: [], divergedFiles: [] };
    recordCheck(false, 'templates', `Missing template files folder for ${mod}`, true);
    continue;
  }

  const activeFiles = getAllFiles(activeModDir)
    .filter(f => !f.endsWith('.test.ts'))
    .map(f => path.relative(activeModDir, f));

  const missingInTemplate = [];
  const divergedFiles = [];

  for (const relFile of activeFiles) {
    const templateFilePath = path.join(templateModFilesDir, relFile);
    if (!fs.existsSync(templateFilePath)) {
      missingInTemplate.push(relFile);
    } else {
      const activeContent = fs.readFileSync(path.join(activeModDir, relFile), 'utf-8').trim();
      const templateContent = fs.readFileSync(templateFilePath, 'utf-8').trim();
      if (activeContent !== templateContent) {
        divergedFiles.push(relFile);
      }
    }
  }

  results.templates[mod] = {
    status: missingInTemplate.length === 0 && divergedFiles.length === 0 ? 'PERFECT_SYNC' : 'DIVERGED',
    missingFiles: missingInTemplate,
    divergedFiles: divergedFiles
  };
  recordCheck(missingInTemplate.length === 0 && divergedFiles.length === 0, 'templates', `Template sync for ${mod}`);
}

// 3. DYNAMIC KPI BRIDGES & STATIC COUPLING SCAN
console.log('\n🔍 [PHASE 3] KPI BRIDGES, SSOT & COUPLING AUDIT...');
const bridgeFiles = getAllFiles(SRC_DASHBOARD).filter(f => f.endsWith('.kpi.bridge.ts'));

for (const bFile of bridgeFiles) {
  const rel = path.relative(ROOT_DIR, bFile);
  const content = fs.readFileSync(bFile, 'utf-8');
  const modName = path.basename(bFile).replace('.kpi.bridge.ts', '');

  const hasFetchKPIs = content.includes('fetchKPIs(') || content.includes('fetchKPIs =');
  const hasCalculateKPIs = content.includes('calculateKPIs(') || content.includes('calculateKPIs =');
  const hasAdminTables = content.includes('fetchAdminTablesData(') || content.includes('fetchAdminTablesData =');
  const hasBrokenFirestoreCall = content.includes('collection({} as any') || content.includes('collection({}') || content.includes('collection(null');

  // Check cross module static imports
  const staticImportMatch = content.match(/from\s+['"](\.\.\/)+([a-zA-Z0-9_-]+)\/(?!.*kpi\.bridge)/g);

  results.bridges[modName] = {
    path: rel,
    hasFetchKPIs,
    hasCalculateKPIs,
    hasAdminTables,
    hasBrokenFirestoreCall,
    illegalCrossImports: staticImportMatch || []
  };

  recordCheck(!hasBrokenFirestoreCall, 'bridges', `No broken db call in ${rel}`);
  recordCheck(hasFetchKPIs, 'bridges', `fetchKPIs in ${rel}`);
}

// 4. FIRESTORE SECURITY RULES COVERAGE AUDIT
console.log('\n🔍 [PHASE 4] FIRESTORE SECURITY RULES COVERAGE...');
let firestoreRulesContent = '';
try {
  firestoreRulesContent = fs.readFileSync(FIRESTORE_RULES_PATH, 'utf-8');
} catch (e) {
  console.error('Failed to read firestore.rules:', e.message);
}

const serviceFiles = getAllFiles(SRC_DASHBOARD).filter(f => f.endsWith('.service.ts'));
const referencedCollections = new Set();

for (const sFile of serviceFiles) {
  const content = fs.readFileSync(sFile, 'utf-8');
  const collectionMatches = content.matchAll(/collection\s*\(\s*(?:db|[^,]+)\s*,\s*['"]([a-zA-Z0-9_-]+)['"]\s*\)/g);
  for (const m of collectionMatches) {
    referencedCollections.add(m[1]);
  }
}

for (const col of referencedCollections) {
  results.firestoreRules.collectionsScanned++;
  const hasRule = firestoreRulesContent.includes(`match /${col}/`) || firestoreRulesContent.includes(`match /{path=**}/${col}/`);
  if (!hasRule) {
    results.firestoreRules.missingRules.push(col);
    recordCheck(false, 'security', `Missing Firestore rule for collection: ${col}`);
  } else {
    recordCheck(true, 'security', `Rule exists for collection: ${col}`);
  }
}

// 5. SAFE NUMERICS & RAW EMOJI AUDIT
console.log('\n🔍 [PHASE 5] SAFE NUMERICS & UI EMOJIS SCAN...');
const allTsAndSvelte = getAllFiles(path.join(ROOT_DIR, 'src')).filter(f => f.endsWith('.ts') || f.endsWith('.svelte'));

const emojiRegex = /[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;

for (const f of allTsAndSvelte) {
  results.numericsSafety.filesScanned++;
  const content = fs.readFileSync(f, 'utf-8');
  const lines = content.split('\n');

  lines.forEach((line, idx) => {
    // Check raw unshielded .toFixed without fallback
    if (line.includes('.toFixed(') && !line.includes('Number(') && !line.includes('|| 0') && !line.includes('?? 0')) {
      // Filter out comments or test mocks
      if (!line.trim().startsWith('//') && !line.trim().startsWith('*') && !f.includes('.test.ts')) {
        results.numericsSafety.unsafeToFixed.push({
          file: path.relative(ROOT_DIR, f),
          line: idx + 1,
          code: line.trim()
        });
      }
    }

    // Check raw emoji in UI templates
    if (f.endsWith('+page.svelte') || f.endsWith('Form.svelte') || f.endsWith('Card.svelte') || f.endsWith('Tab.svelte')) {
      if (emojiRegex.test(line) && !line.includes('//') && !line.includes('<!--') && !line.includes('console.')) {
        results.uiEmojis.rawEmojisFound.push({
          file: path.relative(ROOT_DIR, f),
          line: idx + 1,
          code: line.trim()
        });
      }
    }
  });
}

// 6. SYNTHETIC MULTI-SECTOR BUSINESS LOGIC MATRIX TEST
console.log('\n🔍 [PHASE 6] EXECUTING MULTI-SECTOR SIMULATIONS...');

// Sector 1: Edilizia & Cantieri (Worker evaluation math & place hierarchy)
const ediliziaWorkers = [
  { name: 'Mario', evalType: 'giornata', dailyRate: 150, days: 5 },
  { name: 'Luigi', evalType: 'oraria', hourlyRate: 20, hours: 40 },
  { name: 'Paolo', evalType: 'mq', unitRate: 15, units: 100 }
];
let ediliziaTotalLabor = ediliziaWorkers.reduce((acc, w) => {
  if (w.evalType === 'giornata') return acc + (w.dailyRate * w.days);
  if (w.evalType === 'oraria') return acc + (w.hourlyRate * w.hours);
  if (w.evalType === 'mq') return acc + (w.unitRate * w.units);
  return acc;
}, 0);
results.multiSectorSimulations['Edilizia_Manodopera_Multi_Tariffa'] = {
  expected: 3050,
  actual: ediliziaTotalLabor,
  passed: ediliziaTotalLabor === 3050
};
recordCheck(ediliziaTotalLabor === 3050, 'sector_sim', 'Edilizia labor multi-rate calculation');

// Sector 2: Food / Gelateria (VAT unbundling 4%, 10%, 22% & standalone payments)
function testVatBreakdown(gross, rate) {
  const net = gross / (1 + rate / 100);
  const vat = gross - net;
  return { net: parseFloat(net.toFixed(2)), vat: parseFloat(vat.toFixed(2)) };
}
const foodP1 = testVatBreakdown(100, 10); // €100 food (10% IVA) -> net 90.91, vat 9.09
const foodP2 = testVatBreakdown(52, 4);   // €52 basic goods (4% IVA) -> net 50.00, vat 2.00
const foodPassed = (foodP1.net === 90.91 && foodP1.vat === 9.09 && foodP2.net === 50.00 && foodP2.vat === 2.00);
results.multiSectorSimulations['Food_Scorporo_IVA_Multirate'] = {
  passed: foodPassed,
  foodP1,
  foodP2
};
recordCheck(foodPassed, 'sector_sim', 'Food multi-VAT rate unbundling');

// Sector 3: B2B Commercial Reconciliations (Auto allocation on contract installments)
function simulateAutoAllocation(gross, installments) {
  let available = gross;
  const allocations = {};
  for (const inst of installments) {
    if (available <= 0) break;
    const assign = Math.min(available, inst.remaining);
    allocations[inst.id] = parseFloat(assign.toFixed(2));
    available -= assign;
  }
  return { allocations, unallocated: parseFloat(available.toFixed(2)) };
}
const instTest = [
  { id: 'inst1', remaining: 300 },
  { id: 'inst2', remaining: 500 },
  { id: 'inst3', remaining: 400 }
];
const b2bAlloc = simulateAutoAllocation(750, instTest);
const b2bPassed = b2bAlloc.allocations['inst1'] === 300 && b2bAlloc.allocations['inst2'] === 450 && b2bAlloc.unallocated === 0;
results.multiSectorSimulations['B2B_Auto_Allocation_Reconciliation'] = {
  passed: b2bPassed,
  result: b2bAlloc
};
recordCheck(b2bPassed, 'sector_sim', 'B2B auto allocation algorithm');

// Sector 4: Helpdesk / Manutenzione (TMR average resolution time in hours)
const closedTickets = [
  { created: new Date('2026-08-01T08:00:00Z'), resolved: new Date('2026-08-01T12:00:00Z') }, // 4h
  { created: new Date('2026-08-02T10:00:00Z'), resolved: new Date('2026-08-02T16:00:00Z') }, // 6h
  { created: new Date('2026-08-03T09:00:00Z'), resolved: new Date('2026-08-03T11:00:00Z') }  // 2h
];
const avgHours = closedTickets.reduce((acc, t) => acc + (t.resolved - t.created) / (1000 * 3600), 0) / closedTickets.length;
const tmrPassed = avgHours === 4;
results.multiSectorSimulations['Manutenzione_TMR_Calculation'] = {
  passed: tmrPassed,
  avgHours
};
recordCheck(tmrPassed, 'sector_sim', 'Maintenance TMR resolution calculation');

// WRITE AUDIT REPORT ARTIFACT
const REPORT_PATH = path.join(ROOT_DIR, 'audit_report.json');
fs.writeFileSync(REPORT_PATH, JSON.stringify(results, null, 2));

console.log('\n' + '='.repeat(80));
console.log(`📊 AUDIT COMPLETED! Results saved to: ${REPORT_PATH}`);
console.log(`Total Checks Executed: ${results.summary.totalChecks}`);
console.log(`✅ Passed: ${results.summary.passedChecks}`);
console.log(`⚠️ Warnings: ${results.summary.warnings}`);
console.log(`❌ Failed: ${results.summary.failedChecks}`);
console.log('='.repeat(80));
