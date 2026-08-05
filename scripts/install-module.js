#!/usr/bin/env node

/**
 * Module & Bridge Installer (1-Click CLI Scaffolder)
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
      const now = new Date();
      try {
        fs.utimesSync(destPath, now, now);
      } catch (e) {}
    }
  }
}

function checkRequirements(moduleName) {
  const jsonPath = path.resolve(__dirname, 'templates/modules', moduleName, 'module.json');
  if (!fs.existsSync(jsonPath)) return;

  let requirements = [];
  try {
    const meta = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    requirements = meta.requirements || [];
  } catch (e) {
    return;
  }

  if (requirements.length === 0) return;

  const installedModules = [];
  const routesDir = path.resolve(__dirname, '../src/routes/dashboard');
  if (fs.existsSync(routesDir)) {
    const entries = fs.readdirSync(routesDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        installedModules.push(entry.name);
      }
    }
  }

  const missingReqs = requirements.filter(req => !installedModules.includes(req));

  if (missingReqs.length > 0) {
    console.error('');
    console.error(`❌ Impossibile installare il modulo '${moduleName}':`);
    console.error(`   Prima di installare questo modulo, installa i seguenti moduli richiesti: ${missingReqs.map(m => `'${m}'`).join(', ')}.`);
    console.error(`   Esegui prima: npm run module:install -- --name ${missingReqs[0]}`);
    console.error('');
    process.exit(1);
  }
}

function installModule(moduleName) {
  const moduleDir = path.resolve(__dirname, 'templates/modules', moduleName);
  if (!fs.existsSync(moduleDir)) {
    console.error(`❌ Errore: Modulo '${moduleName}' non trovato nel Registro Moduli.`);
    process.exit(1);
  }

  checkRequirements(moduleName);

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

  // 3.5. Copy functions if present
  const srcFunctions = path.join(moduleDir, 'functions');
  const destFunctionsDir = path.resolve(__dirname, '../functions/src');
  if (fs.existsSync(srcFunctions)) {
    copyDirRecursive(srcFunctions, destFunctionsDir);
    console.log(`  ⚡ Cloud Functions registrate in functions/src/`);
  }

  // 4. Update modules.registry.json (MANDATORY module.json check)
  const moduleJsonPath = path.join(moduleDir, 'module.json');
  if (!fs.existsSync(moduleJsonPath)) {
    console.error(`❌ Errore critico: Il modulo '${moduleName}' non contiene il file 'module.json' obbligatorio per la registrazione nel menu!`);
    process.exit(1);
  }
  const snippet = fs.readFileSync(moduleJsonPath, 'utf-8').trim();
  updateModulesRegistry(snippet);


  // 5. Update firestore.indexes.json if firestore.snippet.indexes.json exists
  const indexesSnippetPath = path.join(moduleDir, 'firestore.snippet.indexes.json');
  if (fs.existsSync(indexesSnippetPath)) {
    const snippetContent = fs.readFileSync(indexesSnippetPath, 'utf-8').trim();
    updateFirestoreIndexes(snippetContent);
  }

  // 6. Update firestore.rules if snippet exists
  const rulesSnippetPath = path.join(moduleDir, 'firestore.snippet.rules');
  if (fs.existsSync(rulesSnippetPath)) {
    const snippet = fs.readFileSync(rulesSnippetPath, 'utf-8').trim();
    updateFirestoreRules(snippet, moduleName);
  }

  // 7. Update functions/index.ts if functions.snippet.ts exists
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

function updateModulesRegistry(moduleJsonContent) {
  const paths = [
    path.resolve(__dirname, '../src/lib/config/modules.registry.json'),
    path.resolve(__dirname, '../functions/src/config/modules.registry.json')
  ];

  try {
    const modConfig = typeof moduleJsonContent === 'string' ? JSON.parse(moduleJsonContent) : moduleJsonContent;

    for (const regPath of paths) {
      if (!fs.existsSync(regPath)) continue;
      const data = JSON.parse(fs.readFileSync(regPath, 'utf-8'));
      if (!data.modules) data.modules = [];

      const existingIdx = data.modules.findIndex(m => m.id === modConfig.id);
      if (existingIdx !== -1) {
        data.modules[existingIdx] = { ...data.modules[existingIdx], ...modConfig };
      } else {
        data.modules.push(modConfig);
      }

      fs.writeFileSync(regPath, JSON.stringify(data, null, 2), 'utf-8');
    }
    console.log(`  ✅ Modulo registrato in modules.registry.json`);
    return true;
  } catch (err) {
    console.error(`❌ Errore durante l'aggiornamento di modules.registry.json:`, err);
    return false;
  }
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
