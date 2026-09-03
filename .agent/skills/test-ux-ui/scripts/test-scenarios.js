#!/usr/bin/env node

/**
 * GESTORAY UX/UI BATCH SCENARIO RUNNER
 * Automated Full-Navigation & Responsive Suite for Comprehensive UI Audits
 * 
 * Location: .agent/skills/test-ux-ui/scripts/test-scenarios.js
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

const DEFAULT_SCENARIOS = [
  { name: 'dashboard_overview', route: '/dashboard', preset: 'desktop', mode: 'full' },
  { name: 'clients_list', route: '/dashboard/clients', preset: 'desktop', mode: 'full' },
  { name: 'contracts_list', route: '/dashboard/contracts', preset: 'desktop', mode: 'full' },
  { name: 'invoices_list', route: '/dashboard/invoices', preset: 'desktop', mode: 'full' },
  { name: 'places_list', route: '/dashboard/places', preset: 'desktop', mode: 'full' },
  { name: 'job_costing_list', route: '/dashboard/job_costing', preset: 'desktop', mode: 'full' },
  { name: 'job_costing_add_wizard', route: '/dashboard/job_costing/add', preset: 'desktop', mode: 'full' },
  { name: 'job_costing_mobile_view', route: '/dashboard/job_costing', preset: 'mobile', mode: 'full' },
  { name: 'warehouse_dashboard', route: '/dashboard/warehouse', preset: 'desktop', mode: 'full' },
  { name: 'tickets_service_desk', route: '/dashboard/tickets', preset: 'desktop', mode: 'full' }
];

async function runBatch(scenarios = DEFAULT_SCENARIOS) {
  console.log(`🚀 Avvio Suite Scenari UX/UI (${scenarios.length} test pianificati)...\n`);
  const results = [];

  for (let i = 0; i < scenarios.length; i++) {
    const s = scenarios[i];
    console.log(`[${i + 1}/${scenarios.length}] Esecuzione scenario: ${s.name} (${s.route}) [${s.preset}]...`);

    let cmd = `node "${TESTER_SCRIPT}" --route "${s.route}" --name "${s.name}" --preset "${s.preset}" --mode "${s.mode || 'full'}"`;
    if (s.actions) {
      for (const act of s.actions) {
        cmd += ` --action "${act}"`;
      }
    }
    if (s.selector) {
      cmd += ` --selector "${s.selector}"`;
    }

    try {
      const output = execSync(cmd, { encoding: 'utf-8', timeout: 45000 });
      console.log(`  ✅ Completato`);
      results.push({ scenario: s.name, status: 'PASSED', output });
    } catch (err) {
      console.error(`  ❌ Fallito:`, err.message);
      results.push({ scenario: s.name, status: 'FAILED', error: err.message });
    }
  }

  const passed = results.filter(r => r.status === 'PASSED').length;
  console.log(`\n══════════════════════════════════════════════════════════════`);
  console.log(`🏁 Suite Scenari UX/UI Completata: ${passed}/${scenarios.length} passati.`);
  console.log(`📁 Screenshot salvati in: ${SCREENSHOTS_DIR}`);
  console.log(`══════════════════════════════════════════════════════════════\n`);

  return results;
}

runBatch().catch(console.error);
