import { chromium } from 'playwright';

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

  // 1. Initial screenshot with default active tab (VSS)
  await page.screenshot({ path: 'scratch/active-kpi-vss.png', fullPage: false });
  console.log('Saved scratch/active-kpi-vss.png');

  // 2. Click on NA card (first side card)
  const firstCard = page.locator('.kpi-side-col .kpi-tile').first();
  if (await firstCard.count() > 0) {
    console.log('Clicking on first side KPI tile (NA)...');
    await firstCard.click();
    await page.waitForTimeout(500);
    // Move mouse away to avoid hover overlay in screenshot
    await page.mouse.move(100, 100);
    await page.waitForTimeout(300);
    await page.screenshot({ path: 'scratch/active-kpi-na.png', fullPage: false });
    console.log('Saved scratch/active-kpi-na.png');
  }

  // 3. Click on NNCF card (third side card)
  const thirdCard = page.locator('.kpi-side-col .kpi-tile').nth(2);
  if (await thirdCard.count() > 0) {
    console.log('Clicking on third side KPI tile (NNCF)...');
    await thirdCard.click();
    await page.waitForTimeout(500);
    await page.mouse.move(100, 100);
    await page.waitForTimeout(300);
    await page.screenshot({ path: 'scratch/active-kpi-nncf.png', fullPage: false });
    console.log('Saved scratch/active-kpi-nncf.png');
  }

  console.log('Done verification!');
  process.exit(0);
}

run().catch(err => {
  console.error('Error during CDP test:', err);
  process.exit(1);
});
