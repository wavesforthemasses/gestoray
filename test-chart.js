import { chromium } from 'playwright';

(async () => {
  try {
    const browser = await chromium.connectOverCDP('http://localhost:9222');
    const contexts = browser.contexts();
    const context = contexts[0] || await browser.newContext();
    const pages = context.pages();
    const page = pages.find(p => p.url().includes('tickets')) || pages[0];
    
    await page.goto('http://localhost:5173/dashboard/tickets', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(5000); // let the chart load
    
    const text = await page.evaluate(() => document.body.innerText);
    
    if (text.includes('Massimo: 0') && text.includes('Minimo: 0')) {
      console.log('CHART IS FLATLINE (0-0)');
    } else {
      console.log('CHART HAS DATA!');
      const maxMatch = text.match(/Massimo:\s*(\d+)/);
      if (maxMatch) {
        console.log('MAX FOUND: ' + maxMatch[1]);
      }
    }
    
    await browser.close();
  } catch (e) {
    console.error(e);
  }
})();
