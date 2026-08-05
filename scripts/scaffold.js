#!/usr/bin/env node

/**
 * Module Scaffolder
 * 
 * Usage: npm run generate -- --name <ModuleName> --collection <firestore_collection>
 * Example: npm run generate -- --name Tickets --collection tickets
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── CLI Args ───────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  let name = '';
  let collection = '';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--name' && args[i + 1]) {
      name = args[i + 1];
      i++;
    } else if (args[i] === '--collection' && args[i + 1]) {
      collection = args[i + 1];
      i++;
    }
  }

  if (!name) {
    console.error('❌ Errore: --name è obbligatorio.');
    console.error('   Uso: npm run generate -- --name <ModuleName> --collection <collection>');
    console.error('   Esempio: npm run generate -- --name Tickets --collection tickets');
    process.exit(1);
  }

  // Default collection to kebab-case name
  if (!collection) {
    collection = toKebab(name);
  }

  return { name, collection };
}

// ─── Name Transformations ───────────────────────────────────────────────────

function toPascal(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function toKebab(str) {
  // PascalCase/camelCase → kebab-case
  return str
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();
}

function toCamel(str) {
  return str.charAt(0).toLowerCase() + str.slice(1);
}

// ─── Template Processing ────────────────────────────────────────────────────

function processTemplate(content, pascalName, kebabName, collectionName) {
  return content
    .replaceAll('__Name__', pascalName)
    .replaceAll('__name__', kebabName)
    .replaceAll('__COLLECTION__', collectionName);
}

function copyTemplateDir(srcDir, destDir, pascalName, kebabName, collectionName) {
  const createdFiles = [];

  function walk(currentSrc, currentDest) {
    const entries = fs.readdirSync(currentSrc, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(currentSrc, entry.name);

      // Process directory/file name placeholders
      let destName = entry.name
        .replaceAll('__Name__', pascalName)
        .replaceAll('__name__', kebabName);

      // Remove .tpl extension
      if (destName.endsWith('.tpl')) {
        destName = destName.slice(0, -4);
      }

      const destPath = path.join(currentDest, destName);

      if (entry.isDirectory()) {
        fs.mkdirSync(destPath, { recursive: true });
        walk(srcPath, destPath);
      } else {
        const content = fs.readFileSync(srcPath, 'utf-8');
        const processed = processTemplate(content, pascalName, kebabName, collectionName);
        fs.writeFileSync(destPath, processed, 'utf-8');
        createdFiles.push(destPath);
      }
    }
  }

  fs.mkdirSync(destDir, { recursive: true });
  walk(srcDir, destDir);
  return createdFiles;
}

// ─── Menu Config Update ─────────────────────────────────────────────────────

function updateMenuConfig(kebabName, pascalName) {
  const menuPath = path.resolve(__dirname, '../src/lib/stores/menu.ts');
  let content = fs.readFileSync(menuPath, 'utf-8');

  // Find the closing bracket of DEFAULT_MENU_CONFIG array
  const newEntry = `  { id: '${kebabName}', rolesView: ['superadmin', 'amministrazione'] },`;

  // Insert before the last closing bracket of the array
  const closingBracketIdx = content.lastIndexOf('];');
  if (closingBracketIdx === -1) {
    console.warn('⚠️  Non riesco a trovare DEFAULT_MENU_CONFIG. Aggiungi manualmente la voce di menu.');
    return false;
  }

  content = content.slice(0, closingBracketIdx) + newEntry + '\n' + content.slice(closingBracketIdx);
  fs.writeFileSync(menuPath, content, 'utf-8');
  return true;
}

// ─── Firestore Rules Update ─────────────────────────────────────────────────

function updateFirestoreRules(collectionName) {
  const rulesPath = path.resolve(__dirname, '../firestore.rules');
  let content = fs.readFileSync(rulesPath, 'utf-8');

  const newRule = `
    // ${collectionName.toUpperCase()}
    match /${collectionName}/{docId} {
      allow read: if isAuth();
      allow write: if isAdmin();
    }`;

  // Insert before the last two closing braces (}} at end of file)
  // Find the login_pins block or the last match block before closing
  const lastClosingIdx = content.lastIndexOf('  }');
  if (lastClosingIdx === -1) {
    console.warn('⚠️  Non riesco a modificare firestore.rules. Aggiungi manualmente le regole.');
    return false;
  }

  content = content.slice(0, lastClosingIdx) + newRule + '\n' + content.slice(lastClosingIdx);
  fs.writeFileSync(rulesPath, content, 'utf-8');
  return true;
}

// ─── Main ───────────────────────────────────────────────────────────────────

function main() {
  const { name, collection } = parseArgs();

  const pascalName = toPascal(name);
  const kebabName = toKebab(name);
  const camelName = toCamel(name);

  const destDir = path.resolve(__dirname, `../src/routes/dashboard/${kebabName}`);

  // Validate destination doesn't exist
  if (fs.existsSync(destDir)) {
    console.error(`❌ La cartella ${destDir} esiste già. Scegli un nome diverso.`);
    process.exit(1);
  }

  console.log('');
  console.log('🚀 Module Scaffolder');
  console.log('─'.repeat(50));
  console.log(`   Modulo:      ${pascalName}`);
  console.log(`   Cartella:    src/routes/dashboard/${kebabName}/`);
  console.log(`   Collection:  ${collection}`);
  console.log('─'.repeat(50));
  console.log('');

  // 1. Copy templates
  const templatesDir = path.resolve(__dirname, 'templates/module');
  const createdFiles = copyTemplateDir(templatesDir, destDir, pascalName, kebabName, collection);

  console.log(`✅ Creati ${createdFiles.length} file:`);
  for (const f of createdFiles) {
    const relative = path.relative(path.resolve(__dirname, '..'), f);
    console.log(`   📄 ${relative}`);
  }
  console.log('');

  // 2. Update menu config
  const menuUpdated = updateMenuConfig(kebabName, pascalName);
  if (menuUpdated) {
    console.log('✅ Aggiunto a DEFAULT_MENU_CONFIG in src/lib/stores/menu.ts');
  }

  // 3. Update firestore rules
  const rulesUpdated = updateFirestoreRules(collection);
  if (rulesUpdated) {
    console.log('✅ Aggiunta regola Firestore in firestore.rules');
  }

  console.log('');
  console.log('─'.repeat(50));
  console.log('📋 Prossimi passi:');
  console.log(`   1. Personalizza i campi in ${kebabName}.service.ts (interfaccia e CRUD)`);
  console.log(`   2. Aggiorna il form in components/${pascalName}Form.svelte`);
  console.log(`   3. Aggiorna la tabella in components/${pascalName}Table.svelte`);
  console.log(`   4. Cambia l'icona nel menu (DEFAULT_MENU_CONFIG → icon)`);
  console.log(`   5. Configura i ruoli di accesso nella pagina e nel menu`);
  console.log(`   6. Esegui: npm run check`);
  console.log('─'.repeat(50));
  console.log('');
}

main();
