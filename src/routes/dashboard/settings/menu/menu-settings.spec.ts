import { test, expect } from '@playwright/test';
import { loginAs } from '../../../../../tests/utils';

test.describe('Menu Settings Page', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'test-admin@app.local');
    await page.goto('/dashboard/settings/menu');
  });

  test('carica la configurazione del menu', async ({ page }) => {
    await expect(page.locator('.loader-box')).toBeHidden({ timeout: 15000 });
  });

  test('salva la configurazione del menu', async ({ page }) => {
    await expect(page.locator('.loader-box')).toBeHidden({ timeout: 15000 });
    
    // Assumiamo ci sia un bottone Salva Modifiche
    await page.getByRole('button', { name: /Salva/i }).first().click();
    
    await expect(page.locator('.toast-success')).toBeVisible({ timeout: 10000 });
  });
});
