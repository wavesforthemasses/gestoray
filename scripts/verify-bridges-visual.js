import { chromium } from 'playwright';
import * as path from 'path';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  // 1. Visit settings/activities
  await page.goto('http://localhost:5173/dashboard/settings/activities', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.resolve('static/test_screenshots/activities_settings_table.png'), fullPage: true });
  console.log('Saved activities_settings_table.png');

  // 2. Click "Nuovo Tipo Attività" to open modal
  await page.click('button:has-text("Nuovo Tipo Attività")');
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.resolve('static/test_screenshots/activities_settings_modal_new.png') });
  console.log('Saved activities_settings_modal_new.png');

  // 3. Close modal and click "Modifica" on first row
  await page.click('.close-btn');
  await page.waitForTimeout(400);
  await page.click('.edit-btn >> nth=0');
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.resolve('static/test_screenshots/activities_settings_modal_edit.png') });
  console.log('Saved activities_settings_modal_edit.png');

  // 4. Visit settings/modules
  await page.goto('http://localhost:5173/dashboard/settings/modules', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.resolve('static/test_screenshots/modules_bridges_settings.png'), fullPage: true });
  console.log('Saved modules_bridges_settings.png');

  await browser.close();
}

main().catch(console.error);
