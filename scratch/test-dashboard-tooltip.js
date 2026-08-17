import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

async function run() {
  console.log('Connecting to Chrome CDP on port 9222...');
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const contexts = browser.contexts();
  const context = contexts[0] || await browser.newContext();
  const page = context.pages()[0] || await context.newPage();

  await page.setViewportSize({ width: 1440, height: 900 });

  console.log('Navigating to http://localhost:5173/dashboard ...');
  await page.goto('http://localhost:5173/dashboard', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  // Take screenshot of homepage dashboard with chart
  await page.screenshot({ path: 'scratch/dashboard-home-clean.png', fullPage: false });
  console.log('Saved scratch/dashboard-home-clean.png');

  // Hover over the first tab in UniversalAnalyticsChart
  const tabBtn = page.locator('.chart-tab-btn').first();
  if (await tabBtn.count() > 0) {
    console.log('Hovering over first chart tab button...');
    await tabBtn.hover();
    await page.waitForTimeout(600);
    await page.screenshot({ path: 'scratch/dashboard-tab-tooltip.png', fullPage: false });
    console.log('Saved scratch/dashboard-tab-tooltip.png');
  }

  // Hover over a side KPI tile
  const kpiTile = page.locator('.kpi-side-col .kpi-tile').first();
  if (await kpiTile.count() > 0) {
    console.log('Hovering over first side KPI tile in dashboard...');
    const kpiText = kpiTile.locator('.kpi-text');
    await kpiText.hover();
    await page.waitForTimeout(600);
    await page.screenshot({ path: 'scratch/dashboard-side-kpi-tooltip.png', fullPage: false });
    console.log('Saved scratch/dashboard-side-kpi-tooltip.png');
  }

  // Hover over another KPI tile (e.g. second tile)
  const secondKpiTile = page.locator('.kpi-side-col .kpi-tile').nth(1);
  if (await secondKpiTile.count() > 0) {
    console.log('Hovering over second side KPI tile in dashboard...');
    const kpiText2 = secondKpiTile.locator('.kpi-text');
    await kpiText2.hover();
    await page.waitForTimeout(600);
    await page.screenshot({ path: 'scratch/dashboard-side-kpi2-tooltip.png', fullPage: false });
    console.log('Saved scratch/dashboard-side-kpi2-tooltip.png');
  }

  console.log('Done!');
  process.exit(0);
}

run().catch(err => {
  console.error('Error during CDP test:', err);
  process.exit(1);
});
