import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const SCREENSHOTS_DIR = path.resolve(ROOT_DIR, 'screenshots');

(async () => {
  try {
    const browser = await chromium.connectOverCDP('http://localhost:9222');
    const contexts = browser.contexts();
    const context = contexts[0] || await browser.newContext();
    const pages = context.pages();
    let page = pages.find(p => p.url().includes('tickets')) || pages[0];
    
    await page.goto('http://localhost:5173/dashboard/tickets', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    
    // Find the button that expands the chart and click it
    // Wait, let's just evaluate JS to set the state or click the button.
    // The UniversalAnalyticsChart has a button with text "Mostra Grafico" or something similar if it's collapsible.
    // Or we can just click `.chart-toggle` or whatever the class is.
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const toggle = btns.find(b => b.innerText.toLowerCase().includes('grafico'));
      if (toggle) toggle.click();
    });
    
    await page.waitForTimeout(2000); // let the chart animation finish and render
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `tickets_page_chart_expanded_${timestamp}.png`;
    const filepath = path.join(SCREENSHOTS_DIR, filename);
    
    await page.screenshot({ path: filepath, fullPage: true });
    console.log(`Saved screenshot to ${filepath}`);
    
    await browser.close();
  } catch (e) {
    console.error(e);
  }
})();
