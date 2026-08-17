import { chromium } from 'playwright';

async function run() {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const context = browser.contexts()[0] || await browser.newContext();
  const page = context.pages()[0] || await context.newPage();

  await page.setViewportSize({ width: 1440, height: 900 });

  console.log('Navigating to http://localhost:5173/dashboard/places ...');
  await page.goto('http://localhost:5173/dashboard/places', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  await page.screenshot({ path: 'scratch/places-active-kpi.png', fullPage: false });
  console.log('Saved scratch/places-active-kpi.png');

  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
