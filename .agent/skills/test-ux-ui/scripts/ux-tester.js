#!/usr/bin/env node

/**
 * GESTORAY UX/UI TEST ENGINE & VISUAL INSPECTOR
 * Autonomous Headless Playwright Engine for Visual Verification, Layout Auditing & Action Pipelines
 * 
 * Location: .agent/skills/test-ux-ui/scripts/ux-tester.js
 * Isolated agent tooling - Not part of production application code.
 */

import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SKILL_DIR = path.resolve(__dirname, '..');
const SCREENSHOTS_DIR = path.resolve(SKILL_DIR, 'screenshots');

const PRESETS = {
  'desktop': { width: 1440, height: 900, isMobile: false, hasTouch: false, scale: 1 },
  'desktop-wide': { width: 1920, height: 1080, isMobile: false, hasTouch: false, scale: 1 },
  'laptop': { width: 1280, height: 800, isMobile: false, hasTouch: false, scale: 1 },
  'tablet': { width: 768, height: 1024, isMobile: true, hasTouch: true, scale: 2 },
  'mobile': { width: 390, height: 844, isMobile: true, hasTouch: true, scale: 3 }, // iPhone 14
  'mobile-small': { width: 360, height: 640, isMobile: true, hasTouch: true, scale: 2 } // Standard Android
};

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    url: '',
    route: '',
    name: '',
    preset: 'desktop',
    width: null,
    height: null,
    scale: 1,
    mode: 'full', // 'full' | 'viewport' | 'selector'
    selector: null,
    wait: 1000,
    actions: [],
    clean: false,
    cdp: false,
    cdpUrl: 'http://localhost:9222',
    outputDir: SCREENSHOTS_DIR
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--url' && args[i + 1]) {
      options.url = args[++i];
    } else if (arg === '--route' && args[i + 1]) {
      options.route = args[++i];
    } else if (arg === '--name' && args[i + 1]) {
      options.name = args[++i];
    } else if (arg === '--preset' && args[i + 1]) {
      options.preset = args[++i].toLowerCase();
    } else if (arg === '--width' && args[i + 1]) {
      options.width = parseInt(args[++i], 10);
    } else if (arg === '--height' && args[i + 1]) {
      options.height = parseInt(args[++i], 10);
    } else if (arg === '--scale' && args[i + 1]) {
      options.scale = parseFloat(args[++i]);
    } else if (arg === '--mode' && args[i + 1]) {
      options.mode = args[++i].toLowerCase();
    } else if (arg === '--selector' && args[i + 1]) {
      options.selector = args[++i];
      options.mode = 'selector';
    } else if (arg === '--wait' && args[i + 1]) {
      options.wait = parseInt(args[++i], 10);
    } else if (arg === '--action' && args[i + 1]) {
      options.actions.push(args[++i]);
    } else if (arg === '--actions-json' && args[i + 1]) {
      try {
        const parsed = JSON.parse(args[++i]);
        if (Array.isArray(parsed)) options.actions.push(...parsed);
      } catch (e) {
        console.warn('⚠️ Impossibile parsare --actions-json:', e.message);
      }
    } else if (arg === '--clean' || arg === '--cleanup') {
      options.clean = true;
    } else if (arg === '--cdp') {
      options.cdp = true;
    } else if (arg === '--cdp-url' && args[i + 1]) {
      options.cdp = true;
      options.cdpUrl = args[++i];
    } else if (arg === '--output' && args[i + 1]) {
      options.outputDir = path.resolve(args[++i]);
    } else if (!options.url && !options.route && arg.startsWith('/')) {
      options.route = arg;
    } else if (!options.url && !options.route && arg.startsWith('http')) {
      options.url = arg;
    }
  }

  return options;
}

/**
 * Probe local ports to discover active Vite dev server (5174, 5173, 4173, 3000)
 */
async function discoverBaseUrl() {
  const ports = [5174, 5173, 4173, 3000, 5000];
  for (const p of ports) {
    const isUp = await new Promise((resolve) => {
      const req = http.get(`http://127.0.0.1:${p}/`, { timeout: 800 }, (res) => {
        resolve(true);
      });
      req.on('error', () => resolve(false));
      req.on('timeout', () => { req.destroy(); resolve(false); });
    });
    if (isUp) {
      return `http://localhost:${p}`;
    }
  }
  return 'http://localhost:5174';
}

/**
 * Execute an action pipeline against the active Playwright Page
 */
async function executeAction(page, actionStr) {
  const parts = actionStr.split(':');
  const type = parts[0].trim();
  const rest = parts.slice(1).join(':').trim();

  switch (type) {
    case 'click':
      console.log(`  🖱️ Action: click -> "${rest}"`);
      await page.waitForSelector(rest, { state: 'visible', timeout: 10000 });
      await page.click(rest);
      break;

    case 'fill': {
      const [selector, ...valParts] = rest.split(':');
      const textToFill = valParts.join(':');
      console.log(`  ⌨️ Action: fill -> "${selector}" with "${textToFill}"`);
      await page.waitForSelector(selector, { state: 'visible', timeout: 10000 });
      await page.fill(selector, textToFill);
      break;
    }

    case 'wait': {
      const ms = parseInt(rest, 10) || 1000;
      console.log(`  ⏳ Action: wait -> ${ms}ms`);
      await page.waitForTimeout(ms);
      break;
    }

    case 'waitForSelector':
    case 'waitFor':
      console.log(`  👀 Action: waitForSelector -> "${rest}"`);
      await page.waitForSelector(rest, { state: 'visible', timeout: 15000 });
      break;

    case 'hover':
      console.log(`  👉 Action: hover -> "${rest}"`);
      await page.waitForSelector(rest, { state: 'visible', timeout: 10000 });
      await page.hover(rest);
      break;

    case 'press':
      console.log(`  🔘 Action: press key -> "${rest}"`);
      await page.keyboard.press(rest);
      break;

    default:
      console.warn(`  ⚠️ Azione non riconosciuta: ${actionStr}`);
  }
}

/**
 * Clean up existing screenshots
 */
function cleanupDirectory(dir) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  let count = 0;
  for (const f of files) {
    if (f.endsWith('.png') || f.endsWith('.json')) {
      fs.unlinkSync(path.join(dir, f));
      count++;
    }
  }
  console.log(`🧹 Pulizia completata: eliminati ${count} file temporanei in ${dir}`);
}

async function main() {
  const opts = parseArgs();

  // If user only wanted cleanup
  if (opts.clean) {
    cleanupDirectory(opts.outputDir);
    if (!opts.url && !opts.route) {
      process.exit(0);
    }
  }

  if (!fs.existsSync(opts.outputDir)) {
    fs.mkdirSync(opts.outputDir, { recursive: true });
  }

  // Resolve target URL
  const baseUrl = await discoverBaseUrl();
  let targetUrl = opts.url;
  if (!targetUrl) {
    const r = opts.route || '/dashboard';
    targetUrl = r.startsWith('http') ? r : `${baseUrl}${r.startsWith('/') ? '' : '/'}${r}`;
  }

  console.log(`🎯 Destinazione test: ${targetUrl}`);

  // Viewport configuration
  const presetConfig = PRESETS[opts.preset] || PRESETS['desktop'];
  const viewport = {
    width: opts.width || presetConfig.width,
    height: opts.height || presetConfig.height
  };
  const isMobile = presetConfig.isMobile;
  const hasTouch = presetConfig.hasTouch;
  const deviceScaleFactor = opts.scale || presetConfig.scale;

  console.log(`📱 Risoluzione: ${viewport.width}x${viewport.height} (Preset: ${opts.preset}, Scale: ${deviceScaleFactor})`);

  let browser;
  let isCdpConnected = false;

  if (opts.cdp) {
    try {
      console.log(`🔌 Tentativo connessione a Chrome CDP (${opts.cdpUrl})...`);
      browser = await chromium.connectOverCDP(opts.cdpUrl);
      isCdpConnected = true;
    } catch (e) {
      console.log(`ℹ️ CDP non disponibile, avvio Playwright Chromium headless dedicato...`);
    }
  }

  const profileDir = path.join(SKILL_DIR, '.profile');
  if (!fs.existsSync(profileDir)) {
    fs.mkdirSync(profileDir, { recursive: true });
  }

  const context = await chromium.launchPersistentContext(profileDir, {
    headless: true,
    viewport,
    deviceScaleFactor,
    isMobile,
    hasTouch,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = (await context.pages())[0] || await context.newPage();

  // Capture console logs and errors
  const consoleMessages = [];
  page.on('console', msg => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    }
  });

  page.on('pageerror', err => {
    consoleMessages.push({ type: 'pageerror', text: err.message });
  });

  // Navigate
  console.log(`🌐 Navigazione a: ${targetUrl}...`);
  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(600);

  // Auto-login check
  const emailInput = await page.$('#email');
  if (emailInput) {
    console.log(`🔑 Rilevata schermata login, avvio autenticazione automatica (test-super@app.local)...`);
    try {
      await page.fill('#email', 'test-super@app.local');
      await page.click('button[type="submit"]');
      await page.waitForSelector('.pin-code', { state: 'visible', timeout: 10000 });
      const pin = await page.innerText('.pin-code');
      console.log(`🔑 PIN rilevato: ${pin.trim()}, inserimento...`);
      await page.waitForSelector('#pin:not([disabled])', { state: 'visible', timeout: 8000 });
      await page.fill('#pin', pin.trim());
      await page.waitForTimeout(300);
      await page.click('button[type="submit"]');
      await page.waitForURL(url => !url.href.includes('/login'), { timeout: 15000 });
      console.log(`✅ Login effettuato! Navigazione alla destinazione: ${targetUrl}`);
      if (page.url() !== targetUrl) {
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
      }
    } catch (authErr) {
      console.warn('⚠️ Auto-login fallback:', authErr.message);
    }
  }

  // Execute custom actions sequence
  if (opts.actions && opts.actions.length > 0) {
    console.log(`⚡ Esecuzione pipeline azioni (${opts.actions.length} step)...`);
    for (const act of opts.actions) {
      await executeAction(page, act);
    }
  }

  // Wait for loading spinners to clear if any
  try {
    await page.waitForSelector('.loading-state .spinner, .spinner', { state: 'detached', timeout: 2500 }).catch(() => {});
  } catch (_) {}

  // Final wait before capture
  if (opts.wait > 0) {
    await page.waitForTimeout(opts.wait);
  }

  // Build naming and paths
  const timestamp = Date.now();
  const safeRoute = (opts.route || path.basename(targetUrl) || 'screen').replace(/[^a-zA-Z0-9_-]/g, '_');
  const baseName = opts.name 
    ? `${timestamp}_${opts.name}_${opts.preset}`
    : `${timestamp}_${safeRoute}_${opts.preset}`;

  const pngPath = path.join(opts.outputDir, `${baseName}.png`);
  const jsonPath = path.join(opts.outputDir, `${baseName}.json`);

  console.log(`📸 Cattura screenshot (Modalità: ${opts.mode.toUpperCase()})...`);

  let screenshotBuffer;
  if (opts.mode === 'selector' && opts.selector) {
    const el = await page.$(opts.selector);
    if (!el) {
      throw new Error(`Elemento selettore non trovato: "${opts.selector}"`);
    }
    screenshotBuffer = await el.screenshot({ path: pngPath });
  } else if (opts.mode === 'viewport') {
    screenshotBuffer = await page.screenshot({ path: pngPath, fullPage: false });
  } else {
    screenshotBuffer = await page.screenshot({ path: pngPath, fullPage: true });
  }

  // Gather page metrics
  const pageTitle = await page.title();
  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    scrollHeight: document.documentElement.scrollHeight,
    bodyWidth: document.body.offsetWidth,
    bodyHeight: document.body.offsetHeight,
    readyState: document.readyState
  }));

  const metadata = {
    timestamp: new Date().toISOString(),
    numericTimestamp: timestamp,
    url: page.url(),
    targetRequested: targetUrl,
    pageTitle,
    preset: opts.preset,
    viewport,
    mode: opts.mode,
    selector: opts.selector || null,
    metrics,
    screenshotFile: pngPath,
    consoleAlertsCount: consoleMessages.length,
    consoleAlerts: consoleMessages
  };

  fs.writeFileSync(jsonPath, JSON.stringify(metadata, null, 2), 'utf-8');

  console.log(`\n🎉 Test UX/UI completato con successo!`);
  console.log(`🖼️ Immagine: ${pngPath}`);
  console.log(`📄 Metadata: ${jsonPath}`);
  if (consoleMessages.length > 0) {
    console.log(`⚠️ Rilevati ${consoleMessages.length} messaggi console (vedi JSON)`);
  }

  if (context) {
    await context.close();
  }

  // Output path for scripts / agents
  return { pngPath, jsonPath, metadata };
}

main().catch(err => {
  console.error(`\n❌ Errore esecuzione UX Tester:`, err.message);
  process.exit(1);
});
