import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('http://localhost:5173/dashboard/settings/targets');
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
    await page.goto('http://localhost:5173/dashboard/settings/targets');
  }

  await page.waitForTimeout(2000);

  // Click on '+ Aggiungi Piano Target'
  await page.click('button:has-text("+ Aggiungi Piano Target")');
  await page.waitForTimeout(1000);

  await page.screenshot({ path: 'screenshots/plan_modal_permissions_user.png', fullPage: true });

  // Switch to 'team' subject
  await page.selectOption('#pSubject', 'team');
  await page.waitForTimeout(500);

  await page.screenshot({ path: 'screenshots/plan_modal_permissions_team.png', fullPage: true });

  await browser.close();
  console.log('✅ Plan modal screenshots captured successfully!');
})();
