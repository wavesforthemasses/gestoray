#!/usr/bin/env node

/**
 * Gestoray Module Installer (Frontend + Backend Micro-Services with Dependency Resolution)
 * 
 * Usage: npm run module:install -- --name <moduleName>
 * Example: npm run module:install -- --name commissions
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Module Dependency Map ──────────────────────────────────────────────────
const MODULE_DEPENDENCIES = {
  contracts: ['products'],    // Contratti require Prodotti (items sold)
  commissions: ['contracts'], // Provvigioni require Contratti (sales attribution)
};

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
    console.error('   Uso: npm run module:install -- --name <moduleName>');
    console.error('   Moduli disponibili: contracts, payments, commissions, activities, products');
    process.exit(1);
  }

  return { name };
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

function updateMenuConfig(menuSnippet) {
  const menuPath = path.resolve(__dirname, '../src/lib/stores/menu.ts');
  let content = fs.readFileSync(menuPath, 'utf-8');

  let cleanSnippet = menuSnippet.trim();
  if (!cleanSnippet.endsWith(',')) {
    cleanSnippet += ',';
  }

  const idMatch = cleanSnippet.match(/id:\s*['"]([^'"]+)['"]/);
  if (idMatch && content.includes(`id: '${idMatch[1]}'`)) {
    console.log(`ℹ️  La voce di menu '${idMatch[1]}' è già presente in menu.ts.`);
    return false;
  }

  const closingBracketIdx = content.lastIndexOf('];');
  if (closingBracketIdx === -1) {
    console.warn('⚠️  Non riesco a trovare DEFAULT_MENU_CONFIG in menu.ts.');
    return false;
  }

  content = content.slice(0, closingBracketIdx) + `  ${cleanSnippet}\n` + content.slice(closingBracketIdx);
  fs.writeFileSync(menuPath, content, 'utf-8');
  return true;
}

function updateFirestoreRules(rulesSnippet, moduleName) {
  const rulesPath = path.resolve(__dirname, '../firestore.rules');
  let content = fs.readFileSync(rulesPath, 'utf-8');

  const tagBegin = `// --- MODULE: ${moduleName} BEGIN ---`;
  const tagEnd = `// --- MODULE: ${moduleName} END ---`;

  if (content.includes(tagBegin)) {
    console.log(`ℹ️  Le regole Firestore per il modulo '${moduleName}' sono già presenti.`);
    return false;
  }

  const lastClosingIdx = content.lastIndexOf('  }');
  if (lastClosingIdx === -1) {
    console.warn('⚠️  Non riesco a modificare firestore.rules.');
    return false;
  }

  const cleanSnippet = rulesSnippet.trim();
  const wrappedSnippet = `${tagBegin}\n    ${cleanSnippet.replaceAll('\n', '\n    ')}\n    ${tagEnd}`;

  content = content.slice(0, lastClosingIdx) + `\n    ${wrappedSnippet}\n` + content.slice(lastClosingIdx);
  fs.writeFileSync(rulesPath, content, 'utf-8');
  return true;
}

function updateFunctionsExports(functionsSnippet) {
  const functionsIndexPath = path.resolve(__dirname, '../functions/index.ts');
  if (!fs.existsSync(functionsIndexPath)) return false;

  let content = fs.readFileSync(functionsIndexPath, 'utf-8');
  const cleanSnippet = functionsSnippet.trim();
  const firstLine = cleanSnippet.split('\n')[0];

  if (content.includes(firstLine)) {
    console.log('ℹ️  Gli export delle Cloud Functions per questo modulo sono già presenti in functions/index.ts.');
    return false;
  }

  content = content.trimEnd() + `\n\n// Module Exports\n${cleanSnippet}\n`;
  fs.writeFileSync(functionsIndexPath, content, 'utf-8');
  return true;
}

function installSingleModule(moduleName) {
  const moduleTplDir = path.resolve(__dirname, `templates/modules/${moduleName}`);

  if (!fs.existsSync(moduleTplDir)) {
    console.error(`❌ Modulo '${moduleName}' non trovato nel Registro Moduli (${moduleTplDir}).`);
    return false;
  }

  console.log('');
  console.log('📦 Gestoray Module Installer (Frontend + Backend Micro-Services)');
  console.log('─'.repeat(60));
  console.log(`   Modulo: ${moduleName}`);
  console.log('─'.repeat(60));

  // Check dependencies first
  const deps = MODULE_DEPENDENCIES[moduleName] || [];
  for (const dep of deps) {
    const depRoute = path.resolve(__dirname, `../src/routes/dashboard/${dep}`);
    if (!fs.existsSync(depRoute)) {
      console.log(`⚠️  Il modulo '${moduleName}' richiede l'attribuzione commerciale del modulo '${dep}'.`);
      console.log(`📦 Installazione automatica della dipendenza '${dep}' in corso...`);
      installSingleModule(dep);
    }
  }

  // 1. Copy Frontend primary files
  const filesDir = path.join(moduleTplDir, 'files');
  const destDir = path.resolve(__dirname, `../src/routes/dashboard/${moduleName}`);

  if (fs.existsSync(filesDir)) {
    copyDirRecursive(filesDir, destDir);
    console.log(`✅ File Frontend copiati in src/routes/dashboard/${moduleName}/`);
  }

  // 2. Copy extra routes if present
  const extraDir = path.join(moduleTplDir, 'extra_routes');
  if (fs.existsSync(extraDir)) {
    const extraEntries = fs.readdirSync(extraDir, { withFileTypes: true });
    for (const entry of extraEntries) {
      if (entry.isDirectory()) {
        const extraSrc = path.join(extraDir, entry.name);
        let extraDest = '';

        if (entry.name.startsWith('settings_')) {
          const subName = entry.name.replace('settings_', '');
          extraDest = path.resolve(__dirname, `../src/routes/dashboard/settings/${subName}`);
        } else {
          extraDest = path.resolve(__dirname, `../src/routes/dashboard/${entry.name}`);
        }

        copyDirRecursive(extraSrc, extraDest);
        console.log(`✅ Rotta extra copiata: ${path.relative(path.resolve(__dirname, '..'), extraDest)}`);
      }
    }
  }

  // 3. Copy Backend Cloud Functions if present
  const functionsDir = path.join(moduleTplDir, 'functions');
  if (fs.existsSync(functionsDir)) {
    const destFunctionsDir = path.resolve(__dirname, '../functions/src');
    copyDirRecursive(functionsDir, destFunctionsDir);
    console.log(`✅ Cloud Functions Backend copiate in functions/src/`);
  }

  // 4. Update Menu snippet
  const menuSnippetFile = path.join(moduleTplDir, 'menu.snippet.ts');
  if (fs.existsSync(menuSnippetFile)) {
    const snippet = fs.readFileSync(menuSnippetFile, 'utf-8');
    const updated = updateMenuConfig(snippet);
    if (updated) console.log('✅ Menu di navigazione aggiornato in src/lib/stores/menu.ts');
  }

  // 5. Update Firestore rules snippet
  const rulesSnippetFile = path.join(moduleTplDir, 'firestore.snippet.rules');
  if (fs.existsSync(rulesSnippetFile)) {
    const snippet = fs.readFileSync(rulesSnippetFile, 'utf-8');
    const updated = updateFirestoreRules(snippet, moduleName);
    if (updated) console.log('✅ Regole Firestore aggiornate in firestore.rules');
  }

  // 6. Update Functions index snippet
  const functionsSnippetFile = path.join(moduleTplDir, 'functions.snippet.ts');
  if (fs.existsSync(functionsSnippetFile)) {
    const snippet = fs.readFileSync(functionsSnippetFile, 'utf-8');
    const updated = updateFunctionsExports(snippet);
    if (updated) console.log('✅ Export Cloud Functions aggiunti in functions/index.ts');
  }

  console.log('');
  console.log('─'.repeat(60));
  console.log(`✨ Modulo '${moduleName}' installato con successo!`);
  console.log('─'.repeat(60));
  console.log('');
  return true;
}

function main() {
  const { name } = parseArgs();
  installSingleModule(name);
}

main();
