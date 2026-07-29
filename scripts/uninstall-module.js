#!/usr/bin/env node

/**
 * Gestoray Module Uninstaller (Frontend + Backend Micro-Services)
 * 
 * Usage: npm run module:uninstall -- --name <moduleName>
 * Example: npm run module:uninstall -- --name activities
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Module Dependency Map ──────────────────────────────────────────────────
const MODULE_DEPENDENCIES = {
  contracts: ['products'],    // Contratti richiedono Prodotti
  commissions: ['contracts'], // Provvigioni richiedono Contratti
};

function checkDependents(targetModule) {
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

  const blockingModules = [];
  for (const [mod, deps] of Object.entries(MODULE_DEPENDENCIES)) {
    if (deps.includes(targetModule) && installedModules.includes(mod)) {
      blockingModules.push(mod);
    }
  }

  if (blockingModules.length > 0) {
    console.error('');
    console.error(`❌ Impossibile disinstallare il modulo '${targetModule}':`);
    console.error(`   Il modulo '${targetModule}' è richiesto dai seguenti moduli attualmente installati: ${blockingModules.map(m => `'${m}'`).join(', ')}.`);
    console.error(`   Disinstalla prima i moduli dipendenti e poi riprova.`);
    console.error('');
    process.exit(1);
  }
}

// ─── CLI Args ───────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  let name = '';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--name' && args[i + 1]) {
      name = args[i + 1].toLowerCase();
      i++;
    }
  }

  if (!name) {
    console.error('❌ Errore: --name è obbligatorio.');
    console.error('   Uso: npm run module:uninstall -- --name <moduleName>');
    console.error('   Moduli disponibili: contracts, payments, commissions, activities, products, interventi, tickets');
    process.exit(1);
  }

  return { name };
}

function removeDirRecursive(targetDir) {
  if (fs.existsSync(targetDir)) {
    fs.rmSync(targetDir, { recursive: true, force: true });
    return true;
  }
  return false;
}

function removeFromModulesRegistry(moduleName) {
  const paths = [
    path.resolve(__dirname, '../src/lib/config/modules.registry.json'),
    path.resolve(__dirname, '../functions/src/config/modules.registry.json')
  ];

  let removedAny = false;
  try {
    for (const regPath of paths) {
      if (!fs.existsSync(regPath)) continue;
      const data = JSON.parse(fs.readFileSync(regPath, 'utf-8'));
      if (!data.modules) continue;

      const beforeLen = data.modules.length;
      data.modules = data.modules.filter(m => m.id !== moduleName);
      if (data.modules.length !== beforeLen) {
        fs.writeFileSync(regPath, JSON.stringify(data, null, 2), 'utf-8');
        removedAny = true;
      }
    }
  } catch (err) {
    console.error(`❌ Errore durante la rimozione da modules.registry.json:`, err);
  }
  return removedAny;
}

function removeExtraRoutes(moduleTplDir) {
  const extraDir = path.join(moduleTplDir, 'extra_routes');
  if (!fs.existsSync(extraDir)) return;

  function removeFilesFromRoutes(srcDir, destBase) {
    if (!fs.existsSync(srcDir)) return;
    const entries = fs.readdirSync(srcDir, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(srcDir, entry.name);
      const destPath = path.join(destBase, entry.name);

      if (entry.isDirectory()) {
        removeFilesFromRoutes(srcPath, destPath);
        if (fs.existsSync(destPath) && fs.readdirSync(destPath).length === 0) {
          fs.rmdirSync(destPath);
        }
      } else {
        if (fs.existsSync(destPath)) {
          fs.unlinkSync(destPath);
          console.log(`🗑️  Rotta extra rimossa: ${path.relative(path.resolve(__dirname, '..'), destPath)}`);
        }
      }
    }
  }

  removeFilesFromRoutes(extraDir, path.resolve(__dirname, '../src/routes'));

  const extraEntries = fs.readdirSync(extraDir, { withFileTypes: true });
  for (const entry of extraEntries) {
    if (entry.isDirectory()) {
      let extraDest = '';
      if (entry.name.startsWith('settings_')) {
        const subName = entry.name.replace('settings_', '');
        extraDest = path.resolve(__dirname, `../src/routes/dashboard/settings/${subName}`);
      } else if (entry.name.startsWith('public_')) {
        const subName = entry.name.replace('public_', '');
        extraDest = path.resolve(__dirname, `../src/routes/public/${subName}`);
      } else if (entry.name.startsWith('api_')) {
        const subName = entry.name.replace('api_', '').replace(/_/g, '/');
        extraDest = path.resolve(__dirname, `../src/routes/api/${subName}`);
      }

      if (extraDest && removeDirRecursive(extraDest)) {
        console.log(`🗑️  Rotta extra rimossa: ${path.relative(path.resolve(__dirname, '..'), extraDest)}`);
      }
    }
  }
}

function removeFromFirestoreRules(rulesSnippet, moduleName) {
  const rulesPath = path.resolve(__dirname, '../firestore.rules');
  if (!fs.existsSync(rulesPath)) return false;

  let content = fs.readFileSync(rulesPath, 'utf-8');
  const tagBegin = `// --- MODULE: ${moduleName} BEGIN ---`;
  const tagEnd = `// --- MODULE: ${moduleName} END ---`;

  if (content.includes(tagBegin)) {
    const blockRegex = new RegExp(`\\s*${tagBegin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${tagEnd.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g');
    content = content.replace(blockRegex, '');
    fs.writeFileSync(rulesPath, content, 'utf-8');
    return true;
  }

  const cleanSnippet = rulesSnippet.trim();
  const firstHeaderLine = cleanSnippet.split('\n')[0].trim();
  if (firstHeaderLine && content.includes(firstHeaderLine)) {
    const blockIdx = content.indexOf(firstHeaderLine);
    let openBraces = 0;
    let endBlockIdx = -1;
    let foundFirstOpen = false;

    for (let i = blockIdx; i < content.length; i++) {
      if (content[i] === '{') {
        openBraces++;
        foundFirstOpen = true;
      } else if (content[i] === '}') {
        openBraces--;
        if (foundFirstOpen && openBraces === 0) {
          endBlockIdx = i;
          break;
        }
      }
    }

    if (blockIdx !== -1 && endBlockIdx !== -1) {
      content = content.slice(0, blockIdx) + content.slice(endBlockIdx + 1);
      fs.writeFileSync(rulesPath, content, 'utf-8');
      return true;
    }
  }

  return false;
}

function removeFromFunctionsExports(functionsSnippet, moduleName) {
  const functionsIndexPath = path.resolve(__dirname, '../functions/index.ts');
  if (!fs.existsSync(functionsIndexPath)) return false;

  let content = fs.readFileSync(functionsIndexPath, 'utf-8');
  const tagBegin = `// --- MODULE FUNCTIONS: ${moduleName} BEGIN ---`;
  const tagEnd = `// --- MODULE FUNCTIONS: ${moduleName} END ---`;

  if (content.includes(tagBegin)) {
    const blockRegex = new RegExp(`\\s*${tagBegin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${tagEnd.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g');
    content = content.replace(blockRegex, '');
    fs.writeFileSync(functionsIndexPath, content, 'utf-8');
    return true;
  }

  const snippetLines = functionsSnippet.trim().split('\n').map(l => l.trim()).filter(Boolean);
  let modified = false;
  for (const line of snippetLines) {
    if (content.includes(line)) {
      content = content.replace(line, '');
      modified = true;
    }
  }

  if (modified) {
    content = content.replace(/\n\s*\n\s*\n/g, '\n\n');
    fs.writeFileSync(functionsIndexPath, content, 'utf-8');
    return true;
  }

  return false;
}

function removeBackendFunctions(moduleTplDir) {
  const functionsDir = path.join(moduleTplDir, 'functions');
  if (!fs.existsSync(functionsDir)) return;

  function removeFilesFromSrc(srcDir, destBase) {
    const entries = fs.readdirSync(srcDir, { withFileTypes: true });
    for (const entry of entries) {
      const srcPath = path.join(srcDir, entry.name);
      const destPath = path.join(destBase, entry.name);

      if (entry.isDirectory()) {
        removeFilesFromSrc(srcPath, destBase);
        if (fs.existsSync(destPath) && fs.readdirSync(destPath).length === 0) {
          fs.rmdirSync(destPath);
        }
      } else {
        if (fs.existsSync(destPath)) {
          fs.unlinkSync(destPath);
          console.log(`🗑️  Cloud Function rimossa: ${path.relative(path.resolve(__dirname, '..'), destPath)}`);
        }
      }
    }
  }

  removeFilesFromSrc(functionsDir, path.resolve(__dirname, '../functions/src'));
}

function removeFromFirestoreIndexes(moduleTplDir) {
  const snippetPath = path.join(moduleTplDir, 'firestore.snippet.indexes.json');
  if (!fs.existsSync(snippetPath)) return false;

  const indexesPath = path.resolve(__dirname, '../firestore.indexes.json');
  if (!fs.existsSync(indexesPath)) return false;

  try {
    const mainIndexes = JSON.parse(fs.readFileSync(indexesPath, 'utf-8'));
    const snippetObj = JSON.parse(fs.readFileSync(snippetPath, 'utf-8'));

    if (snippetObj.indexes && Array.isArray(snippetObj.indexes)) {
      mainIndexes.indexes = mainIndexes.indexes.filter(m => 
        !snippetObj.indexes.some(s => s.collectionGroup === m.collectionGroup && JSON.stringify(s.fields) === JSON.stringify(m.fields))
      );
    }

    if (snippetObj.fieldOverrides && Array.isArray(snippetObj.fieldOverrides)) {
      mainIndexes.fieldOverrides = mainIndexes.fieldOverrides.filter(m =>
        !snippetObj.fieldOverrides.some(s => s.collectionGroup === m.collectionGroup && s.fieldPath === m.fieldPath)
      );
    }

    fs.writeFileSync(indexesPath, JSON.stringify(mainIndexes, null, 2), 'utf-8');
    return true;
  } catch (e) {
    return false;
  }
}

function main() {
  const { name } = parseArgs();
  checkDependents(name);
  const moduleTplDir = path.resolve(__dirname, `templates/modules/${name}`);

  if (!fs.existsSync(moduleTplDir)) {
    console.error(`❌ Modulo '${name}' non trovato nel Registro Moduli (${moduleTplDir}).`);
    process.exit(1);
  }

  console.log('');
  console.log('🗑️  Gestoray Module Uninstaller (Frontend + Backend Micro-Services)');
  console.log('─'.repeat(60));
  console.log(`   Modulo da disinstallare: ${name}`);
  console.log('─'.repeat(60));
  console.log('');

  // 1. Remove Primary Frontend Route
  const destDir = path.resolve(__dirname, `../src/routes/dashboard/${name}`);
  if (removeDirRecursive(destDir)) {
    console.log(`🗑️  Rotta Frontend rimossa: src/routes/dashboard/${name}/`);
  }

  // 2. Remove Extra Routes if present
  removeExtraRoutes(moduleTplDir);

  // 3. Remove Lib Services if present
  const libDir = path.join(moduleTplDir, 'lib_services');
  if (fs.existsSync(libDir)) {
    const entries = fs.readdirSync(libDir, { withFileTypes: true });
    for (const entry of entries) {
      const destPath = path.resolve(__dirname, `../src/lib/services/${entry.name}`);
      if (fs.existsSync(destPath)) {
        fs.unlinkSync(destPath);
        console.log(`🗑️  Servizio Lib rimosso: src/lib/services/${entry.name}`);
      }
    }
  }

  // 4. Remove Backend Cloud Functions
  removeBackendFunctions(moduleTplDir);

  // 5. Remove from JSON Modules Registry
  if (removeFromModulesRegistry(name)) {
    console.log('🗑️  Modulo rimosso da modules.registry.json');
  }

  // 6. Remove Firestore Rules & Indexes
  const rulesSnippetFile = path.join(moduleTplDir, 'firestore.snippet.rules');
  if (fs.existsSync(rulesSnippetFile)) {
    const snippet = fs.readFileSync(rulesSnippetFile, 'utf-8');
    const removed = removeFromFirestoreRules(snippet, name);
    if (removed) console.log('🗑️  Regole Firestore rimosse da firestore.rules');
  }
  if (removeFromFirestoreIndexes(moduleTplDir)) {
    console.log('🗑️  Indici rimossi da firestore.indexes.json');
  }

  // 7. Remove Functions Export Snippet
  const functionsSnippetFile = path.join(moduleTplDir, 'functions.snippet.ts');
  if (fs.existsSync(functionsSnippetFile)) {
    const snippet = fs.readFileSync(functionsSnippetFile, 'utf-8');
    const removed = removeFromFunctionsExports(snippet, name);
    if (removed) console.log('🗑️  Export Cloud Functions rimossi da functions/index.ts');
  }

  console.log('');
  console.log('─'.repeat(60));
  console.log('✨ Modulo disinstallato con successo in modo sicuro!');
  console.log('💡 Nota: I dati esistenti in Firestore NON sono stati toccati.');
  console.log('─'.repeat(60));
  console.log('');
}

main();
