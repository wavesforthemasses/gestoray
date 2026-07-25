#!/usr/bin/env node

/**
 * Gestoray Module & Bridge Template Syncing Utility
 * Synchronizes active route files and bridge services back to scripts/templates/
 * to guarantee that all 7 pure modules and 5 bridge connectors are 100% installable CLI packages.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const moduleTemplatesDir = path.resolve(__dirname, 'templates/modules');
const bridgeTemplatesDir = path.resolve(__dirname, 'templates/bridges');

const dashboardDir = path.resolve(__dirname, '../src/routes/dashboard');
const bridgesDir = path.resolve(__dirname, '../src/lib/services/bridges');

function copyDirRecursiveSync(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirRecursiveSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function syncTemplates() {
  console.log('🔄 Sincronizzazione Modelli Moduli & Bridge Connectors in corso...');
  
  // 1. Sync Pure Modules
  if (fs.existsSync(moduleTemplatesDir)) {
    const modules = fs.readdirSync(moduleTemplatesDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);

    for (const moduleName of modules) {
      const activeRouteDir = path.join(dashboardDir, moduleName);
      const templateFilesDir = path.join(moduleTemplatesDir, moduleName, 'files');

      if (fs.existsSync(activeRouteDir)) {
        copyDirRecursiveSync(activeRouteDir, templateFilesDir);
        console.log(`  ✅ Modello Puro '${moduleName}' sincronizzato con src/routes/dashboard/${moduleName}/`);
      }
    }
  }

  // 2. Sync Bridge Connectors
  if (fs.existsSync(bridgesDir)) {
    const bridgeFiles = fs.readdirSync(bridgesDir);
    fs.mkdirSync(bridgeTemplatesDir, { recursive: true });

    for (const file of bridgeFiles) {
      const srcPath = path.join(bridgesDir, file);
      const bridgeName = file.replace('.ts', '').replace('.test', '');
      const destDir = path.join(bridgeTemplatesDir, bridgeName);
      fs.mkdirSync(destDir, { recursive: true });
      fs.copyFileSync(srcPath, path.join(destDir, file));
      console.log(`  🌁 Bridge Connector '${bridgeName}' sincronizzato con scripts/templates/bridges/${bridgeName}/`);
    }
  }

  console.log(`\n✨ Sincronizzazione completata con successo! Moduli e Bridge pronti.`);
}

syncTemplates();
