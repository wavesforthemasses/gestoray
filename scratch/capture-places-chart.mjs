import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

(async () => {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const context = browser.contexts()[0] || await browser.newContext();
  const page = context.pages()[0] || await context.newPage();

  await page.goto('http://localhost:5173/dashboard/places');
  await page.waitForTimeout(1000);

  // Click on "Mostra Grafico Andamento"
  const toggleBtn = page.locator('button:has-text("Mostra Grafico")');
  if (await toggleBtn.count() > 0) {
    await toggleBtn.first().click();
    await page.waitForTimeout(2000);
  }

  const timestamp = Date.now();
  const filePath = `/home/vincenzo/Code/gestoray/screenshots/${timestamp}_places_chart_expanded.png`;
  await page.screenshot({ path: filePath, fullPage: true });
  console.log(`Saved screenshot: ${filePath}`);

  await browser.close();
})();
