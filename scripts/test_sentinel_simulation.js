import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  // Coordinate iniziali: Duomo di Milano (45.4642, 9.1900)
  const context = await browser.newContext({
    permissions: ['geolocation'],
    geolocation: { latitude: 45.4642, longitude: 9.1900, accuracy: 10 }
  });

  const page = await context.newPage();
  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
  page.on('pageerror', err => console.log('BROWSER PAGE ERROR STACK:', err.stack || err.message));

  console.log('Navigating to http://localhost:5173/dashboard...');
  await page.goto('http://localhost:5173/dashboard', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  // Auto-login se necessario
  if (page.url().includes('/login') || (await page.$('#email'))) {
    console.log('Logging in with test-super@app.local...');
    await page.waitForSelector('#email', { timeout: 10000 });
    await page.fill('#email', 'test-super@app.local');
    await page.click('button[type="submit"]');
    await page.waitForSelector('.pin-code', { timeout: 10000 });
    const pin = await page.innerText('.pin-code');
    console.log('Got PIN:', pin);
    await page.fill('#pin', pin.trim());
    await page.click('button[type="submit"]');
    await page.waitForURL(url => !url.href.includes('/login'), { timeout: 15000 });
    await page.waitForSelector('.sidebar, nav, .topbar, a[href*="/dashboard"]', { timeout: 10000 }).catch(() => {});
  }

  console.log('Navigating to /dashboard...');
  await page.goto('http://localhost:5173/dashboard', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  // 1. Se c'è una pillola di turno attivo pre-esistente, facciamo check-out per iniziare da stato neutro
  const existingActivePill = await page.$('.active-shift-sticky-pill');
  if (existingActivePill) {
    console.log('Active pill detected, executing check-out to reset state...');
    const checkoutBtn = await page.$('.btn-pill-checkout');
    if (checkoutBtn) {
      await checkoutBtn.click();
      await page.waitForTimeout(2500);
    }
  }

  // 2. Simuliamo l'avvicinamento al Cantiere Duomo (45.4642, 9.1900)
  console.log('Simulating GPS inside place boundary: 45.4642, 9.1900...');
  await context.setGeolocation({ latitude: 45.4642, longitude: 9.1900, accuracy: 10 });
  await page.waitForTimeout(3500);

  // Cattura Toast di Ingresso (Entry Prompt)
  const entryPrompt = await page.$('.sentinel-prompt-overlay.entry-glow');
  console.log('Entry prompt toast visible:', !!entryPrompt);

  const shot1 = '/home/vincenzo/.gemini/antigravity-ide/brain/d061e6f0-7148-4e85-876f-3a6530a51a24/sentinel_entry_toast_live.png';
  await page.screenshot({ path: shot1, fullPage: true });
  console.log('Saved entry toast screenshot:', shot1);

  // 3. Clic su "Registra Check-in"
  const checkinBtn = await page.$('.checkin-btn');
  if (checkinBtn) {
    console.log('Clicking Registra Check-in on Entry Toast...');
    await checkinBtn.click();
    await page.waitForTimeout(3000);

    // Cattura Pillola Sticky Turno Attivo (Active Shift Pill)
    const activePill = await page.$('.active-shift-sticky-pill');
    console.log('Active shift sticky pill visible:', !!activePill);

    const shot2 = '/home/vincenzo/.gemini/antigravity-ide/brain/d061e6f0-7148-4e85-876f-3a6530a51a24/sentinel_active_pill_live.png';
    await page.screenshot({ path: shot2, fullPage: true });
    console.log('Saved active pill screenshot:', shot2);

    // 4. Simuliamo l'uscita dal perimetro (a 2 km di distanza, oltre soglia di isteresi)
    console.log('Simulating movement outside geofence: 45.4800, 9.2100...');
    await context.setGeolocation({ latitude: 45.4800, longitude: 9.2100, accuracy: 10 });
    await page.evaluate(() => window.__presenceRadar?.requestImmediatePosition());
    await page.waitForTimeout(3500);

    // Cattura Toast di Uscita (Exit Prompt)
    const exitPrompt = await page.$('.sentinel-prompt-overlay.exit-glow');
    console.log('Exit prompt toast visible:', !!exitPrompt);

    const shot3 = '/home/vincenzo/.gemini/antigravity-ide/brain/d061e6f0-7148-4e85-876f-3a6530a51a24/sentinel_exit_toast_live.png';
    await page.screenshot({ path: shot3, fullPage: true });
    console.log('Saved exit toast screenshot:', shot3);
  }

  await browser.close();
  console.log('All sentinel simulation steps completed!');
})();
