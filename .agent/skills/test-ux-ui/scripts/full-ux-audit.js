#!/usr/bin/env node

/**
 * GESTORAY FULL UX/UI COMPREHENSIVE AUDITOR
 * Orchestrates complete visual capture, metrics extraction, and automated UX scoring.
 * 
 * Location: .agent/skills/test-ux-ui/scripts/full-ux-audit.js
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TESTER_SCRIPT = path.join(__dirname, 'ux-tester.js');
const SKILL_DIR = path.resolve(__dirname, '..');
const SCREENSHOTS_DIR = path.resolve(SKILL_DIR, 'screenshots');

const PAGES_TO_AUDIT = [
  { id: 'dashboard', name: 'Dashboard Overview & Universal Chart', route: '/dashboard', testMobile: true },
  { id: 'clients', name: 'Anagrafica Clienti & Ricerca', route: '/dashboard/clients', testMobile: true },
  { id: 'contracts', name: 'Preventivi & Contratti Attivi', route: '/dashboard/contracts', testMobile: true },
  { id: 'payments', name: 'Incassi, Cassa & Riconciliazione', route: '/dashboard/payments', testMobile: true },
  { id: 'targets', name: 'Target Commerciali & Monitoraggio KPI', route: '/dashboard/targets', testMobile: true },
  { id: 'invoices', name: 'Fatturazione Elettronica SDI & Sezionali', route: '/dashboard/invoices', testMobile: true },
  { id: 'invoices_add', name: 'Wizard Creazione Fattura / Bolla TD24', route: '/dashboard/invoices/add', testMobile: false },
  { id: 'places', name: 'Luoghi, Cantieri & Elenco Multilivello', route: '/dashboard/places', testMobile: true },
  { id: 'places_add', name: 'Nuovo Luogo con Mappa Leaflet & Geofencing', route: '/dashboard/places/add', testMobile: true },
  { id: 'job_costing', name: 'Controllo di Gestione & Redditività Commesse', route: '/dashboard/job_costing', testMobile: true },
  { id: 'job_costing_add', name: 'Wizard Budget Preventivo Commessa', route: '/dashboard/job_costing/add', testMobile: false },
  { id: 'warehouse', name: 'Magazzino, Scarico FIFO & Movimenti', route: '/dashboard/warehouse', testMobile: true },
  { id: 'teams', name: 'Squadre & Risorse Umane', route: '/dashboard/teams', testMobile: false },
  { id: 'vehicles', name: 'Parco Mezzi & Scadenzario Manutenzioni', route: '/dashboard/vehicles', testMobile: false },
  { id: 'scheduling', name: 'Pianificazione Calendario Operativo', route: '/dashboard/scheduling', testMobile: false },
  { id: 'tickets', name: 'Assistenza Tecnica & Monitoraggio TMR', route: '/dashboard/tickets', testMobile: true },
  { id: 'activities', name: 'Diario Attività & Contatti', route: '/dashboard/activities', testMobile: false },
  { id: 'deadlines', name: 'Scadenziario Generale Aziendale', route: '/dashboard/deadlines', testMobile: false },
  { id: 'settings_vat', name: 'Configurazione Aliquote IVA & Esenzioni', route: '/dashboard/settings/vat', testMobile: false },
  { id: 'settings_modules', name: 'Gestione Moduli & Micro-Frontend', route: '/dashboard/settings/modules', testMobile: false }
];

async function runFullAudit() {
  console.log(`\n🎨 ══════════════════════════════════════════════════════════════`);
  console.log(`   GESTORAY COMPREHENSIVE UX/UI AUDIT ENGINE`);
  console.log(`   Pagine in esame: ${PAGES_TO_AUDIT.length} | Modalità: Desktop + Responsive Mobile`);
  console.log(`══════════════════════════════════════════════════════════════════\n`);

  const results = [];

  for (let i = 0; i < PAGES_TO_AUDIT.length; i++) {
    const p = PAGES_TO_AUDIT[i];
    console.log(`[${i + 1}/${PAGES_TO_AUDIT.length}] Auditing: ${p.name} (${p.route})...`);

    // Desktop
    const desktopName = `audit_${p.id}_desktop`;
    const cmdDesktop = `node "${TESTER_SCRIPT}" --route "${p.route}" --name "${desktopName}" --preset desktop --mode full`;
    let desktopSuccess = false;
    let desktopMeta = null;

    try {
      execSync(cmdDesktop, { encoding: 'utf-8', timeout: 35000 });
      desktopSuccess = true;
      const metaFiles = fs.readdirSync(SCREENSHOTS_DIR).filter(f => f.includes(desktopName) && f.endsWith('.json'));
      if (metaFiles.length > 0) {
        desktopMeta = JSON.parse(fs.readFileSync(path.join(SCREENSHOTS_DIR, metaFiles[metaFiles.length - 1]), 'utf-8'));
      }
    } catch (e) {
      console.warn(`  ⚠️ Fallito desktop per ${p.id}: ${e.message}`);
    }

    // Mobile (se richiesto)
    let mobileSuccess = null;
    let mobileMeta = null;
    if (p.testMobile) {
      const mobileName = `audit_${p.id}_mobile`;
      const cmdMobile = `node "${TESTER_SCRIPT}" --route "${p.route}" --name "${mobileName}" --preset mobile --mode full`;
      try {
        execSync(cmdMobile, { encoding: 'utf-8', timeout: 35000 });
        mobileSuccess = true;
        const metaFiles = fs.readdirSync(SCREENSHOTS_DIR).filter(f => f.includes(mobileName) && f.endsWith('.json'));
        if (metaFiles.length > 0) {
          mobileMeta = JSON.parse(fs.readFileSync(path.join(SCREENSHOTS_DIR, metaFiles[metaFiles.length - 1]), 'utf-8'));
        }
      } catch (e) {
        console.warn(`  ⚠️ Fallito mobile per ${p.id}: ${e.message}`);
        mobileSuccess = false;
      }
    }

    results.push({
      id: p.id,
      name: p.name,
      route: p.route,
      desktop: {
        success: desktopSuccess,
        meta: desktopMeta
      },
      mobile: p.testMobile ? {
        success: mobileSuccess,
        meta: mobileMeta
      } : null
    });

    console.log(`  ✅ Verificata (Desktop: ${desktopSuccess ? 'OK' : 'ERR'}${p.testMobile ? `, Mobile: ${mobileSuccess ? 'OK' : 'ERR'}` : ''})`);
  }

  const manifestPath = path.join(SKILL_DIR, 'full_ux_audit_manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(results, null, 2), 'utf-8');
  console.log(`\n🎉 Audit completato! Manifest generato in: ${manifestPath}`);
  return results;
}

runFullAudit().catch(console.error);
