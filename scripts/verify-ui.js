import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const SCREENSHOTS_DIR = path.resolve(ROOT_DIR, 'screenshots');

if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

(async () => {
  console.log('🚀 Avvio browser per test di navigazione e verifica visuale...');
  let browser;
  try {
    browser = await chromium.connectOverCDP('http://localhost:9222');
    console.log('🔌 Connesso a Chrome CDP live!');
  } catch (e) {
    console.log('ℹ️ Chrome CDP non attivo, avvio istanza Chromium...');
    browser = await chromium.launch({ headless: true });
  }

  const context = browser.contexts()[0] || await browser.newContext();
  const page = (await context.pages())[0] || await context.newPage();

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));

  console.log('🌐 Navigazione a /login...');
  await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle' });
  
  if (await page.$('#email')) {
    console.log('🔑 Inserimento email di test...');
    await page.fill('#email', 'test-super@app.local');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
    
    const pinEl = await page.$('.pin-code');
    if (pinEl) {
      const pin = await pinEl.innerText();
      console.log('🔑 PIN ottenuto:', pin);
      await page.fill('#pin', pin.trim());
      await page.click('button[type="submit"]');
      await page.waitForURL(url => !url.href.includes('/login'), { timeout: 10000 });
      console.log('✅ Login riuscito! URL attuale:', page.url());
    } else {
      console.log('⚠️ Nessun PIN mostrato a schermo. Verifico errori...');
      const errEl = await page.$('.alert.error');
      if (errEl) console.log('Errore login:', await errEl.innerText());
    }
  }

  // 1. Screenshot Catalog List Page
  console.log('📸 Navigazione a /dashboard/products...');
  await page.goto('http://localhost:5173/dashboard/products', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  const catalogShot = path.join(SCREENSHOTS_DIR, 'catalog_live_proof.png');
  await page.screenshot({ path: catalogShot, fullPage: true });
  console.log('✅ Screenshot catalogo salvato in:', catalogShot);

  // 2. Screenshot Add Form
  console.log('📸 Navigazione a /dashboard/products/add...');
  await page.goto('http://localhost:5173/dashboard/products/add', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  const addShot = path.join(SCREENSHOTS_DIR, 'add_product_live_proof.png');
  await page.screenshot({ path: addShot, fullPage: true });
  console.log('✅ Screenshot form aggiunta salvato in:', addShot);

  // 3. Test Create Service
  console.log('🛠️ Creazione test: Prestazione di Servizio...');
  const btns = await page.$$('.type-card');
  if (btns.length >= 2) {
    await btns[1].click(); // Clicca Servizio
  }
  await page.fill('#prod-name', 'Consulenza & Diagnosi Specialistica');
  await page.fill('#prod-price', '95');
  await page.waitForTimeout(500);

  console.log('💾 Salvataggio articolo...');
  await page.click('button[type="submit"]');
  await page.waitForURL(url => url.href.includes('/dashboard/products/'), { timeout: 10000 });
  await page.waitForTimeout(2000);
  
  const detailShot = path.join(SCREENSHOTS_DIR, 'detail_product_live_proof.png');
  await page.screenshot({ path: detailShot, fullPage: true });
  console.log('✅ Screenshot scheda dettaglio salvato in:', detailShot);

  await browser.close();
  console.log('🎉 Verifica completata con successo!');
})();
