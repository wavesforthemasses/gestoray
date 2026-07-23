import { test, expect } from '@playwright/test';
import { loginAs } from '../../../../../tests/utils';

test.describe('Commissions Settings Page', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'test-super@gestoray.local');
    await page.goto('/dashboard/settings/commissions');
  });

  test('carica i parametri provvigionali', async ({ page }) => {
    await expect(page.locator('.loader-box')).toBeHidden({ timeout: 15000 });
  });

  test('salva le impostazioni provvigionali', async ({ page }) => {
    await expect(page.locator('.loader-box')).toBeHidden({ timeout: 15000 });
    
    // Assumiamo ci sia un campo numerico, es: percentage
    // Troviamo il pulsante di salvataggio
    await page.getByRole('button', { name: /Salva/i }).first().click();
    
    await expect(page.locator('.toast-success')).toBeVisible({ timeout: 10000 });
  });
});
