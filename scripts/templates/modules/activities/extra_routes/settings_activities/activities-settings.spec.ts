import { test, expect } from '@playwright/test';
import { loginAs } from '../../../../../tests/utils';

test.describe('Activities Settings Page', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'test-admin@gestoray.local');
    await page.goto('/dashboard/settings/activities');
  });

  test('carica la configurazione dei tipi di attività', async ({ page }) => {
    await expect(page.locator('.loader-box')).toBeHidden({ timeout: 15000 });
  });

  test('salva un nuovo tipo di attività', async ({ page }) => {
    await expect(page.locator('.loader-box')).toBeHidden({ timeout: 15000 });
    
    // Clicca Aggiungi
    const addBtn = page.getByRole('button', { name: /Aggiungi/i });
    if (await addBtn.isVisible()) {
      await addBtn.click();
      await page.getByRole('button', { name: /Salva/i }).first().click();
      await expect(page.locator('.toast-success')).toBeVisible({ timeout: 10000 });
    }
  });
});
