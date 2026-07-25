#!/usr/bin/env node

/**
 * Gestoray Module & Bridge Installer (1-Click CLI Scaffolder)
 * 
 * Usage:
 *   npm run module:install -- --name contracts
 *   npm run bridge:install -- --name contractsInterventiBridge
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function parseArgs() {
  const args = process.argv.slice(2);
  let name = '';
  let isBridge = false;

  for (let i = 0; i < args.length; i++) {
    if ((args[i] === '--name' || args[i] === '--module') && args[i + 1]) {
      name = args[i + 1];
      i++;
    } else if (args[i] === '--bridge' && args[i + 1]) {
      name = args[i + 1];
      isBridge = true;
      i++;
    }
  }

  if (process.argv[1].includes('install-bridge') || process.argv.includes('--is-bridge')) {
    isBridge = true;
  }

  if (!name) {
    console.error('❌ Errore: Specifica il nome del modulo o bridge da installare.');
    console.error('   Uso: npm run module:install -- --name contracts');
    console.error('   Uso: npm run bridge:install -- --name contractsInterventiBridge');
    process.exit(1);
  }

  return { name, isBridge };
}

function copyDirRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function installModule(moduleName) {
  const moduleDir = path.resolve(__dirname, 'templates/modules', moduleName);
  if (!fs.existsSync(moduleDir)) {
    console.error(`❌ Errore: Modulo '${moduleName}' non trovato nel Registro Moduli.`);
    process.exit(1);
  }

  console.log(`📦 Installazione Modulo Puro '${moduleName}' in corso...`);

  // 1. Copy dashboard routes
  const srcFilesDir = path.join(moduleDir, 'files');
  const destRouteDir = path.resolve(__dirname, '../src/routes/dashboard', moduleName);
  if (fs.existsSync(srcFilesDir)) {
    copyDirRecursive(srcFilesDir, destRouteDir);
    console.log(`  ✅ File di rotta copiati in src/routes/dashboard/${moduleName}/`);
  }

  // 2. Copy lib services if present
  const srcLibServices = path.join(moduleDir, 'lib_services');
  const destLibServices = path.resolve(__dirname, '../src/lib/services');
  if (fs.existsSync(srcLibServices)) {
    copyDirRecursive(srcLibServices, destLibServices);
    console.log(`  ✅ Servizi registrati in src/lib/services/`);
  }

  // 3. Copy extra routes if present
  const srcExtraRoutes = path.join(moduleDir, 'extra_routes');
  const destRoutesDir = path.resolve(__dirname, '../src/routes');
  if (fs.existsSync(srcExtraRoutes)) {
    copyDirRecursive(srcExtraRoutes, destRoutesDir);
    console.log(`  ✅ Rotte aggiuntive registrate in src/routes/`);
  }

  // 4. Update menu.ts if snippet exists
  const menuSnippetPath = path.join(moduleDir, 'menu.snippet.ts');
  if (fs.existsSync(menuSnippetPath)) {
    const snippet = fs.readFileSync(menuSnippetPath, 'utf-8').trim();
    updateMenuConfig(snippet);
  }

  // 5. Update firestore.rules if snippet exists
  const rulesSnippetPath = path.join(moduleDir, 'firestore.snippet.rules');
  if (fs.existsSync(rulesSnippetPath)) {
    const snippet = fs.readFileSync(rulesSnippetPath, 'utf-8').trim();
    updateFirestoreRules(snippet, moduleName);
  }

  // 6. Update functions/index.ts if functions.snippet.ts exists
  const functionsSnippetPath = path.join(moduleDir, 'functions.snippet.ts');
  if (fs.existsSync(functionsSnippetPath)) {
    const snippet = fs.readFileSync(functionsSnippetPath, 'utf-8').trim();
    updateFunctionsConfig(snippet, moduleName);
  }

  // 7. Update src/routes/dashboard/settings/+page.svelte if settings_card.snippet.svelte exists
  const settingsSnippetPath = path.join(moduleDir, 'settings_card.snippet.svelte');
  if (fs.existsSync(settingsSnippetPath)) {
    const snippet = fs.readFileSync(settingsSnippetPath, 'utf-8');
    updateSettingsPage(snippet, moduleName);
  }

  console.log(`✨ Modulo '${moduleName}' installato con successo!`);
}

function installBridge(bridgeName) {
  const bridgeDir = path.resolve(__dirname, 'templates/bridges', bridgeName);
  if (!fs.existsSync(bridgeDir)) {
    console.error(`❌ Errore: Bridge Connector '${bridgeName}' non trovato nel registro.`);
    process.exit(1);
  }

  console.log(`🌁 Installazione Bridge Connector '${bridgeName}' in corso...`);
  const destBridgeDir = path.resolve(__dirname, '../src/lib/services/bridges');
  fs.mkdirSync(destBridgeDir, { recursive: true });

  const entries = fs.readdirSync(bridgeDir);
  for (const file of entries) {
    fs.copyFileSync(path.join(bridgeDir, file), path.join(destBridgeDir, file));
  }

  console.log(`✨ Bridge '${bridgeName}' installato in src/lib/services/bridges/!`);
}

function updateMenuConfig(menuSnippet) {
  const menuPath = path.resolve(__dirname, '../src/lib/stores/menu.ts');
  let content = fs.readFileSync(menuPath, 'utf-8');

  let cleanSnippet = menuSnippet.trim();
  if (!cleanSnippet.endsWith(',')) {
    cleanSnippet += ',';
  }

  const idMatch = cleanSnippet.match(/id:\s*['"]([^'"]+)['"]/);
  if (idMatch && content.includes(`id: '${idMatch[1]}'`)) {
    return false;
  }

  const closingBracketIdx = content.lastIndexOf('];');
  if (closingBracketIdx === -1) return false;

  content = content.slice(0, closingBracketIdx) + `  ${cleanSnippet}\n` + content.slice(closingBracketIdx);
  fs.writeFileSync(menuPath, content, 'utf-8');
  console.log(`  ✅ Voce inserita in src/lib/stores/menu.ts`);
  return true;
}

function updateFirestoreRules(rulesSnippet, moduleName) {
  const rulesPath = path.resolve(__dirname, '../firestore.rules');
  let content = fs.readFileSync(rulesPath, 'utf-8');

  const tagBegin = `// --- MODULE: ${moduleName} BEGIN ---`;
  if (content.includes(tagBegin)) return false;

  const lastClosingIdx = content.lastIndexOf('  }');
  if (lastClosingIdx === -1) return false;

  const formattedSnippet = `\n    ${tagBegin}\n    ${rulesSnippet}\n    // --- MODULE: ${moduleName} END ---\n`;
  content = content.slice(0, lastClosingIdx) + formattedSnippet + content.slice(lastClosingIdx);
  fs.writeFileSync(rulesPath, content, 'utf-8');
  console.log(`  ✅ Regole aggiunte in firestore.rules`);
  return true;
}

function updateFunctionsConfig(functionsSnippet, moduleName) {
  const functionsIndexPath = path.resolve(__dirname, '../functions/index.ts');
  let content = fs.readFileSync(functionsIndexPath, 'utf-8');

  const tagBegin = `// --- MODULE FUNCTIONS: ${moduleName} BEGIN ---`;
  if (content.includes(tagBegin)) return false;

  const formattedSnippet = `\n${tagBegin}\n${functionsSnippet}\n// --- MODULE FUNCTIONS: ${moduleName} END ---\n`;
  content += formattedSnippet;
  fs.writeFileSync(functionsIndexPath, content, 'utf-8');
  console.log(`  ✅ Cloud Functions aggiunte in functions/index.ts`);
  return true;
}

function updateSettingsPage(settingsSnippet, moduleName) {
  const settingsPath = path.resolve(__dirname, '../src/routes/dashboard/settings/+page.svelte');
  let content = fs.readFileSync(settingsPath, 'utf-8');

  const tagBegin = `<!-- MODULE SETTINGS CARD: ${moduleName} BEGIN -->`;
  if (content.includes(tagBegin)) return false;

  const gridClosingIdx = content.indexOf('</div>\n</div>');
  if (gridClosingIdx === -1) return false;

  const formattedSnippet = `\n  ${tagBegin}\n${settingsSnippet}  <!-- MODULE SETTINGS CARD: ${moduleName} END -->\n`;
  content = content.slice(0, gridClosingIdx) + formattedSnippet + content.slice(gridClosingIdx);
  fs.writeFileSync(settingsPath, content, 'utf-8');
  console.log(`  ✅ Card Impostazioni aggiunta in src/routes/dashboard/settings/+page.svelte`);
  return true;
}

const { name, isBridge } = parseArgs();
if (isBridge) {
  installBridge(name);
} else {
  installModule(name);
}
