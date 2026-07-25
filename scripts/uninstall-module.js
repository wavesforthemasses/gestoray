#!/usr/bin/env node

/**
 * Gestoray Module Uninstaller (Frontend + Backend Micro-Services)
 * 
 * Usage: npm run module:uninstall -- --name <moduleName>
 * Example: npm run module:uninstall -- --name contracts
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
    console.error('   Moduli disponibili: contracts, payments, commissions, activities, products');
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

function removeFromMenuConfig(menuSnippet) {
  const menuPath = path.resolve(__dirname, '../src/lib/stores/menu.ts');
  if (!fs.existsSync(menuPath)) return false;

  let content = fs.readFileSync(menuPath, 'utf-8');
  const cleanSnippet = menuSnippet.trim();
  const idMatch = cleanSnippet.match(/id:\s*['"]([^'"]+)['"]/);

  if (idMatch) {
    const id = idMatch[1];
    const lines = content.split('\n');
    const filteredLines = lines.filter(line => !line.includes(`id: '${id}'`) && !line.includes(`id: "${id}"`));
    if (filteredLines.length !== lines.length) {
      fs.writeFileSync(menuPath, filteredLines.join('\n'), 'utf-8');
      return true;
    }
  }

  return false;
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

  // Fallback if no block tag: remove comment line header and specific collection match
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

function removeFromFunctionsExports(functionsSnippet) {
  const functionsIndexPath = path.resolve(__dirname, '../functions/index.ts');
  if (!fs.existsSync(functionsIndexPath)) return false;

  let content = fs.readFileSync(functionsIndexPath, 'utf-8');
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
        removeFilesFromSrc(srcPath, destPath);
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
  const extraDir = path.join(moduleTplDir, 'extra_routes');
  if (fs.existsSync(extraDir)) {
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
        } else {
          extraDest = path.resolve(__dirname, `../src/routes/dashboard/${entry.name}`);
        }

        if (removeDirRecursive(extraDest)) {
          console.log(`🗑️  Rotta extra rimossa: ${path.relative(path.resolve(__dirname, '..'), extraDest)}`);
        }
      }
    }
  }

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

  // 3. Remove Backend Cloud Functions
  removeBackendFunctions(moduleTplDir);

  // 4. Remove Menu Snippet
  const menuSnippetFile = path.join(moduleTplDir, 'menu.snippet.ts');
  if (fs.existsSync(menuSnippetFile)) {
    const snippet = fs.readFileSync(menuSnippetFile, 'utf-8');
    const removed = removeFromMenuConfig(snippet);
    if (removed) console.log('🗑️  Voce di menu rimossa da src/lib/stores/menu.ts');
  }

  // 5. Remove Firestore Rules Snippet
  const rulesSnippetFile = path.join(moduleTplDir, 'firestore.snippet.rules');
  if (fs.existsSync(rulesSnippetFile)) {
    const snippet = fs.readFileSync(rulesSnippetFile, 'utf-8');
    const removed = removeFromFirestoreRules(snippet, name);
    if (removed) console.log('🗑️  Regole Firestore rimosse da firestore.rules');
  }

  // 6. Remove Functions Export Snippet
  const functionsSnippetFile = path.join(moduleTplDir, 'functions.snippet.ts');
  if (fs.existsSync(functionsSnippetFile)) {
    const snippet = fs.readFileSync(functionsSnippetFile, 'utf-8');
    const removed = removeFromFunctionsExports(snippet);
    if (removed) console.log('🗑️  Export Cloud Functions rimossi da functions/index.ts');
  }

  console.log('');
  console.log('─'.repeat(60));
  console.log('✨ Modulo disinstallato con successo in modo sicuro!');
  console.log('💡 Nota: I dati esistenti in Firestore NON sono stati toccati.');
  console.log('   Esegui `npm run check` per verificare i tipi.');
  console.log('─'.repeat(60));
  console.log('');
}

main();
