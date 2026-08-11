import { chromium } from 'playwright';

(async () => {
  try {
    const browser = await chromium.connectOverCDP('http://localhost:9222');
    const contexts = browser.contexts();
    const context = contexts[0] || await browser.newContext();
    const pages = context.pages();
    let page = pages.find(p => p.url().includes('tickets')) || pages[0];
    
    page.on('console', msg => {
      if (msg.text().includes('fetchChartAggregations')) {
        console.log('BROWSER:', msg.text());
      }
    });

    await page.goto('http://localhost:5173/dashboard/tickets', { waitUntil: 'domcontentloaded' });
    
    await page.waitForTimeout(2000);
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const toggle = btns.find(b => b.innerText.toLowerCase().includes('grafico'));
      if (toggle) toggle.click();
    });
    
    await page.waitForTimeout(2000);
    
    await browser.close();
  } catch (e) {
    console.error(e);
  }
})();
