import { test, expect } from '@playwright/test';
import { loginAs } from '../../../../tests/utils';

test.describe('Commissions Page', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'test-admin@app.local');
    await page.goto('/dashboard/commissions');
  });

  test('carica la pagina storico provvigioni', async ({ page }) => {
    await expect(page.locator('.loader-box')).toBeHidden({ timeout: 15000 });
  });

  test('mostra il selettore del periodo', async ({ page }) => {
    await expect(page.locator('.loader-box')).toBeHidden({ timeout: 15000 });
    // Il componente PeriodSelector dovrebbe avere i selettori mese/anno
    await expect(page.locator('select').first()).toBeVisible();
  });
});
