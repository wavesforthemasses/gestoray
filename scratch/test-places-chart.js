import { chromium } from 'playwright';

async function run() {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const context = browser.contexts()[0] || await browser.newContext();
  const page = context.pages()[0] || await context.newPage();

  await page.setViewportSize({ width: 1440, height: 900 });

  console.log('Navigating to http://localhost:5173/dashboard/places ...');
  await page.goto('http://localhost:5173/dashboard/places', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  const toggleBtn = page.locator('button:has-text("Mostra Grafico Andamento")');
  if (await toggleBtn.count() > 0) {
    await toggleBtn.click();
    await page.waitForTimeout(1000);
  }

  await page.screenshot({ path: 'scratch/places-expanded-chart.png', fullPage: false });
  console.log('Saved scratch/places-expanded-chart.png');

  // Click on the second side KPI card
  const secondCard = page.locator('.kpi-side-col .kpi-tile').nth(1);
  if (await secondCard.count() > 0) {
    await secondCard.click();
    await page.waitForTimeout(500);
    await page.mouse.move(100, 100);
    await page.waitForTimeout(300);
    await page.screenshot({ path: 'scratch/places-active-kpi-second.png', fullPage: false });
    console.log('Saved scratch/places-active-kpi-second.png');
  }

  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
