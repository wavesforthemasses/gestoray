import { chromium } from 'playwright';
import path from 'path';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  // Go to login / dashboard
  await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle' });
  const emailInput = await page.$('#email');
  if (emailInput) {
    await page.fill('#email', 'test-super@app.local');
    await page.fill('#password', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(1000);
    const pinInputs = await page.$$('.pin-digit');
    if (pinInputs.length > 0) {
      const pin = '759393';
      for (let i = 0; i < pinInputs.length; i++) {
        await pinInputs[i].fill(pin[i]);
      }
      await page.waitForTimeout(1000);
    }
  }

  // 1. Settings Activities - Edit Modal
  await page.goto('http://localhost:5173/dashboard/settings/activities', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  
  // Click first edit button
  await page.click('.edit-btn >> nth=0');
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.resolve('screenshots/activities_settings_modal_edit.png') });
  console.log('Saved screenshots/activities_settings_modal_edit.png');

  // 2. Settings Modules - Bridges
  await page.goto('http://localhost:5173/dashboard/settings/modules', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.resolve('screenshots/settings_modules_bridges.png'), fullPage: true });
  console.log('Saved screenshots/settings_modules_bridges.png');

  await browser.close();
}

main().catch(console.error);
