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

  // 4. Update generated_menu.ts if menu.snippet.ts exists
  const menuSnippetPath = path.join(moduleDir, 'menu.snippet.ts');
  if (fs.existsSync(menuSnippetPath)) {
    const snippet = fs.readFileSync(menuSnippetPath, 'utf-8').trim();
    updateGeneratedMenu(snippet, moduleName);
  }

  // 5. Update generated_roles.ts if roles.snippet.ts exists
  const rolesSnippetPath = path.join(moduleDir, 'roles.snippet.ts');
  if (fs.existsSync(rolesSnippetPath)) {
    const snippet = fs.readFileSync(rolesSnippetPath, 'utf-8').trim();
    updateGeneratedRoles(snippet, moduleName);
  }

  // 6. Update generated_features.ts if features.snippet.ts exists
  const featuresSnippetPath = path.join(moduleDir, 'features.snippet.ts');
  if (fs.existsSync(featuresSnippetPath)) {
    const snippet = fs.readFileSync(featuresSnippetPath, 'utf-8').trim();
    updateGeneratedFeatures(snippet, moduleName);
  }

  // 7. Update firestore.indexes.json if firestore.snippet.indexes.json exists
  const indexesSnippetPath = path.join(moduleDir, 'firestore.snippet.indexes.json');
  if (fs.existsSync(indexesSnippetPath)) {
    const snippetContent = fs.readFileSync(indexesSnippetPath, 'utf-8').trim();
    updateFirestoreIndexes(snippetContent);
  }

  // 8. Update firestore.rules if snippet exists
  const rulesSnippetPath = path.join(moduleDir, 'firestore.snippet.rules');
  if (fs.existsSync(rulesSnippetPath)) {
    const snippet = fs.readFileSync(rulesSnippetPath, 'utf-8').trim();
    updateFirestoreRules(snippet, moduleName);
  }

  // 9. Update functions/index.ts if functions.snippet.ts exists
  const functionsSnippetPath = path.join(moduleDir, 'functions.snippet.ts');
  if (fs.existsSync(functionsSnippetPath)) {
    const snippet = fs.readFileSync(functionsSnippetPath, 'utf-8').trim();
    updateFunctionsConfig(snippet, moduleName);
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

function updateGeneratedMenu(menuSnippet, moduleName) {
  const genMenuPath = path.resolve(__dirname, '../src/lib/config/auto_generated/generated_menu.ts');
  let content = fs.readFileSync(genMenuPath, 'utf-8');

  if (content.includes(`id: '${moduleName}'`)) return false;

  let cleanSnippet = menuSnippet.trim();
  if (!cleanSnippet.endsWith(',')) cleanSnippet += ',';

  const insertIdx = content.indexOf('export const MODULE_MENU_SNIPPETS: MenuItemConfig[] = [');
  if (insertIdx === -1) return false;

  const bracketClose = content.indexOf('];', insertIdx);
  if (bracketClose === -1) return false;

  content = content.slice(0, bracketClose) + `  ${cleanSnippet}\n` + content.slice(bracketClose);
  fs.writeFileSync(genMenuPath, content, 'utf-8');
  console.log(`  ✅ Registrato menu in auto_generated/generated_menu.ts`);
  return true;
}

function updateGeneratedRoles(rolesSnippet, moduleName) {
  const genRolesPath = path.resolve(__dirname, '../src/lib/config/auto_generated/generated_roles.ts');
  let content = fs.readFileSync(genRolesPath, 'utf-8');

  if (content.includes(`module: '${moduleName}'`)) return false;

  let cleanSnippet = rolesSnippet.trim();
  if (!cleanSnippet.endsWith(',')) cleanSnippet += ',';

  const insertIdx = content.indexOf('export const MODULE_ROLES_SNIPPETS: any[] = [');
  if (insertIdx === -1) return false;

  const bracketClose = content.indexOf('];', insertIdx);
  if (bracketClose === -1) return false;

  content = content.slice(0, bracketClose) + `  ${cleanSnippet}\n` + content.slice(bracketClose);
  fs.writeFileSync(genRolesPath, content, 'utf-8');
  console.log(`  ✅ Registrati permessi in auto_generated/generated_roles.ts`);
  return true;
}

function updateGeneratedFeatures(featuresSnippet, moduleName) {
  const genFeaturesPath = path.resolve(__dirname, '../src/lib/config/auto_generated/generated_features.ts');
  let content = fs.readFileSync(genFeaturesPath, 'utf-8');

  if (content.includes(`moduleKey: '${moduleName}'`)) return false;

  let cleanSnippet = featuresSnippet.trim();
  if (!cleanSnippet.endsWith(',')) cleanSnippet += ',';

  const insertIdx = content.indexOf('export const MODULE_FEATURE_SNIPPETS: Record<string, any> = {');
  if (insertIdx === -1) return false;

  const braceClose = content.indexOf('};', insertIdx);
  if (braceClose === -1) return false;

  content = content.slice(0, braceClose) + `  ${cleanSnippet}\n` + content.slice(braceClose);
  fs.writeFileSync(genFeaturesPath, content, 'utf-8');
  console.log(`  ✅ Registrata feature flag in auto_generated/generated_features.ts`);
  return true;
}

function updateFirestoreIndexes(snippetContent) {
  const indexesPath = path.resolve(__dirname, '../firestore.indexes.json');
  try {
    const mainIndexes = JSON.parse(fs.readFileSync(indexesPath, 'utf-8'));
    const snippetObj = JSON.parse(snippetContent);

    if (snippetObj.indexes && Array.isArray(snippetObj.indexes)) {
      for (const idx of snippetObj.indexes) {
        const exists = mainIndexes.indexes.some(m => 
          m.collectionGroup === idx.collectionGroup &&
          JSON.stringify(m.fields) === JSON.stringify(idx.fields)
        );
        if (!exists) {
          mainIndexes.indexes.push(idx);
        }
      }
    }

    if (snippetObj.fieldOverrides && Array.isArray(snippetObj.fieldOverrides)) {
      for (const ov of snippetObj.fieldOverrides) {
        const exists = mainIndexes.fieldOverrides.some(m => 
          m.collectionGroup === ov.collectionGroup &&
          m.fieldPath === ov.fieldPath
        );
        if (!exists) {
          mainIndexes.fieldOverrides.push(ov);
        }
      }
    }

    fs.writeFileSync(indexesPath, JSON.stringify(mainIndexes, null, 2), 'utf-8');
    console.log(`  ✅ Indici aggiunti in firestore.indexes.json`);
  } catch (err) {
    console.warn('⚠️ Avviso aggiunta indici firestore:', err.message);
  }
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

const { name, isBridge } = parseArgs();
if (isBridge) {
  installBridge(name);
} else {
  installModule(name);
}
