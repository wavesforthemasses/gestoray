import { chromium } from 'playwright';

async function testHover() {
  try {
    const browser = await chromium.connectOverCDP('http://localhost:9222');
    const contexts = browser.contexts();
    const pages = contexts[0].pages();
    const page = pages.length > 0 ? pages[0] : await contexts[0].newPage();

    await page.goto('http://localhost:5173/dashboard/places', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    // Make sure chart is expanded
    const toggleBtn = await page.$('.toggle-chart-btn');
    if (toggleBtn) {
      const text = await toggleBtn.innerText();
      if (text.includes('Mostra')) {
        await toggleBtn.click();
        await page.waitForTimeout(800);
      }
    }

    // 1. Hover on the first tab button
    const firstTab = await page.$('.chart-tab-btn');
    if (firstTab) {
      console.log('Hovering over chart tab button...');
      await firstTab.hover();
      await page.waitForTimeout(400);
      await page.screenshot({ path: 'scratch/tab-hover.png' });
      console.log('Saved scratch/tab-hover.png');
    }

    // 2. Hover on the first side KPI label
    const sideKpiLbl = await page.$('.kpi-side-col .kpi-lbl');
    if (sideKpiLbl) {
      console.log('Hovering over side KPI label...');
      await sideKpiLbl.hover();
      await page.waitForTimeout(400);
      await page.screenshot({ path: 'scratch/kpi-label-hover.png' });
      console.log('Saved scratch/kpi-label-hover.png');
    }

    // 3. Hover on the side KPI subtitle
    const sideKpiSub = await page.$('.kpi-side-col .kpi-sub');
    if (sideKpiSub) {
      console.log('Hovering over side KPI subtitle...');
      await sideKpiSub.hover();
      await page.waitForTimeout(400);
      await page.screenshot({ path: 'scratch/kpi-sub-hover.png' });
      console.log('Saved scratch/kpi-sub-hover.png');
    }

    console.log('Hover tests completed successfully!');
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

testHover();
