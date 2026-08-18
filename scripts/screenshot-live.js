#!/usr/bin/env node

/**
 * Chrome CDP Live Navigation, Full-Page Screenshot & Debug Metadata Tool
 * 
 * Usage:
 *   node scripts/screenshot-live.js
 *   node scripts/screenshot-live.js --url http://localhost:5173/dashboard/settings/chart --wait 2500
 *   node scripts/screenshot-live.js --url http://localhost:5173/dashboard/clients --name clients_page
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const SCREENSHOTS_DIR = path.resolve(ROOT_DIR, 'screenshots');

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    url: '',
    wait: 2000,
    fullPage: true,
    name: '',
    click: '',
    cdpUrl: 'http://localhost:9222'
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--url' && args[i + 1]) {
      options.url = args[++i];
    } else if (arg === '--wait' && args[i + 1]) {
      options.wait = parseInt(args[++i], 10) || 2000;
    } else if (arg === '--name' && args[i + 1]) {
      options.name = args[++i];
    } else if (arg === '--click' && args[i + 1]) {
      options.click = args[++i];
    } else if (arg === '--cdp' && args[i + 1]) {
      options.cdpUrl = args[++i];
    } else if (arg === '--no-full') {
      options.fullPage = false;
    } else if (!options.url && arg.startsWith('http')) {
      options.url = arg;
    }
  }

  return options;
}

(async () => {
  const opts = parseArgs();

  if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  }

  const timestampNumeric = Date.now();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const baseName = opts.name 
    ? `${timestampNumeric}_${opts.name}_${timestamp}`
    : `${timestampNumeric}_screenshot_${timestamp}`;

  const pngPath = path.join(SCREENSHOTS_DIR, `${baseName}.png`);
  const jsonPath = path.join(SCREENSHOTS_DIR, `${baseName}.json`);

  console.log(`🔌 Connessione a Google Chrome CDP (${opts.cdpUrl})...`);

  let browser;
  let isCdp = true;
  try {
    browser = await chromium.connectOverCDP(opts.cdpUrl);
  } catch (err) {
    console.log(`ℹ️ Chrome CDP (${opts.cdpUrl}) non attivo, avvio istanza headless Chromium...`);
    try {
      browser = await chromium.launch({ headless: true });
      isCdp = false;
    } catch (launchErr) {
      console.error(`❌ Impossibile avviare Chromium:`, launchErr.message);
      process.exit(1);
    }
  }

  const contexts = browser.contexts();
  const context = contexts[0] || await browser.newContext();
  const pages = context.pages();
  let page = pages[0] || await context.newPage();

  // Navigation if URL specified
  if (opts.url) {
    console.log(`🌐 Navigazione a: ${opts.url}`);
    await page.goto(opts.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  }

  // Wait a moment for any client-side auth redirects
  await page.waitForTimeout(1000);

  // Check if login form is present and auto-authenticate
  const isLoginForm = await page.$('#email');
  if (isLoginForm) {
    console.log(`🔑 Rilevata schermata di login (#email), esecuzione auto-login con test-super@app.local...`);
    try {
      await page.fill('#email', 'test-super@app.local');
      await page.click('button[type="submit"]');
      await page.waitForSelector('.pin-code', { timeout: 10000 });
      const pin = await page.innerText('.pin-code');
      console.log(`🔑 PIN rilevato: ${pin}, inserimento per verifica...`);
      await page.fill('#pin', pin.trim());
      await page.click('button[type="submit"]');
      await page.waitForURL(url => !url.href.includes('/login'), { timeout: 15000 });
      console.log(`✅ Login effettuato con successo. Navigazione alla destinazione: ${opts.url}`);
      await page.waitForSelector('.sidebar, nav, .topbar, a[href*="/dashboard"]', { timeout: 10000 }).catch(() => {});
      if (opts.url && page.url() !== opts.url) {
        await page.goto(opts.url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      }
    } catch (authErr) {
      console.warn(`⚠️ Auto-login non completato:`, authErr.message);
    }
  }

  // Wait for rendering / Svelte hydration
  if (opts.wait > 0) {
    console.log(`⏳ Attesa rendering per ${opts.wait}ms...`);
    await page.waitForTimeout(opts.wait);
  }

  if (opts.click) {
    console.log(`🖱️ Esecuzione click su selettore: ${opts.click}...`);
    try {
      await page.waitForSelector(opts.click, { timeout: 5000 });
      await page.click(opts.click);
      await page.waitForTimeout(800);
    } catch (clickErr) {
      console.warn(`⚠️ Errore click: ${clickErr.message}`);
    }
  }

  const currentUrl = page.url();
  const title = await page.title();
  const viewport = page.viewportSize() || { width: 1280, height: 800 };

  // Page dimensions
  const scrollDimensions = await page.evaluate(() => ({
    width: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
    height: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight),
    devicePixelRatio: window.devicePixelRatio || 1
  }));

  console.log(`📸 Acquisizione screenshot (${opts.fullPage ? 'Pagina Intera / Full-Page' : 'Viewport'})...`);
  await page.screenshot({ path: pngPath, fullPage: opts.fullPage });

  // Generate Debug Metadata JSON
  const metadata = {
    timestamp: new Date().toISOString(),
    url: currentUrl,
    title: title,
    screenshotFile: pngPath,
    dimensions: {
      viewport,
      scrollDimensions
    },
    options: {
      waitMs: opts.wait,
      fullPage: opts.fullPage
    }
  };

  fs.writeFileSync(jsonPath, JSON.stringify(metadata, null, 2), 'utf-8');

  console.log(`✅ Screenshot salvato con successo: ${pngPath}`);
  console.log(`📄 Metadata salvati: ${jsonPath}`);

  await browser.close();
})();
