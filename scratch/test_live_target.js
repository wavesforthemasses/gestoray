import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('http://localhost:5173/dashboard/targets');
  await page.waitForTimeout(1000);

  const isLoginForm = await page.$('#email');
  if (isLoginForm) {
    await page.fill('#email', 'test-super@app.local');
    await page.click('button[type="submit"]');
    await page.waitForSelector('.pin-code');
    const pin = await page.innerText('.pin-code');
    await page.fill('#pin', pin.trim());
    await page.click('button[type="submit"]');
    await page.waitForURL(url => !url.href.includes('/login'));
    await page.goto('http://localhost:5173/dashboard/targets');
  }

  await page.waitForTimeout(2000);

  // Click on '+ Imposta Target'
  await page.click('button:has-text("+ Imposta Target")');
  await page.waitForTimeout(1000);

  // Focus and click inside autocomplete input
  const input = await page.$('.autocomplete-input');
  if (input) {
    await input.click();
    await page.waitForTimeout(400);
    const firstOption = await page.$('.option-item');
    if (firstOption) {
      await firstOption.click();
    }
  }

  // Fill values for KPI inputs
  const numInputs = await page.$$('.kpi-field-card input[type="number"]');
  for (let i = 0; i < numInputs.length; i++) {
    await numInputs[i].fill(String((i + 1) * 3500));
  }

  await page.screenshot({ path: 'screenshots/target_modal_open.png', fullPage: true });

  // Save Target
  await page.click('button:has-text("Salva Target")');
  await page.waitForTimeout(2000);

  await page.screenshot({ path: 'screenshots/target_with_card.png', fullPage: true });
  await browser.close();
  console.log('✅ Live target created and screenshots captured successfully!');
})();
