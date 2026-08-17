import { chromium } from 'playwright';

async function testScreenshots() {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const contexts = browser.contexts();
  const page = contexts[0].pages()[0];

  await page.goto('http://localhost:5173/dashboard/places', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);

  // Expand chart if collapsed
  const toggleBtn = await page.$('.toggle-chart-btn');
  if (toggleBtn) {
    const text = await toggleBtn.innerText();
    if (text.includes('Mostra')) {
      await toggleBtn.click();
      await page.waitForTimeout(800);
    }
  }

  // Hover first tab button
  const tabBtn = page.locator('.chart-tab-btn').first();
  await tabBtn.waitFor({ state: 'visible', timeout: 5000 });
  await tabBtn.hover();
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'scratch/tab-tooltip-clean.png' });
  console.log('Saved tab-tooltip-clean.png');

  // Hover second tab button (NL)
  const tabBtn2 = page.locator('.chart-tab-btn').nth(1);
  if (await tabBtn2.count() > 0) {
    await tabBtn2.hover();
    await page.waitForTimeout(400);
    await page.screenshot({ path: 'scratch/tab-nl-tooltip-clean.png' });
    console.log('Saved tab-nl-tooltip-clean.png');
  }

  // Hover first side KPI tile label
  const sideKpi = page.locator('.kpi-side-col .kpi-lbl').first();
  await sideKpi.hover();
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'scratch/side-kpi-tooltip-clean.png' });
  console.log('Saved side-kpi-tooltip-clean.png');
}

testScreenshots();
