import { test, expect } from '@playwright/test';
import { loginAs } from '../../../../../tests/utils';

test.describe('Project Settings Page', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'test-admin@gestoray.local');
    await page.goto('/dashboard/settings/project');
  });

  test('carica il form delle impostazioni di progetto', async ({ page }) => {
    await expect(page.locator('.loader-box')).toBeHidden({ timeout: 15000 });
  });

  test('salva le impostazioni di progetto', async ({ page }) => {
    await expect(page.locator('.loader-box')).toBeHidden({ timeout: 15000 });
    
    await page.fill('input#projectName', 'Gestoray E2E Test');
    await page.fill('input#projectEmail', 'no-reply@gestoray.test');
    
    await page.getByRole('button', { name: /Salva Modifiche/i }).click();
    
    await expect(page.locator('.toast-success')).toBeVisible({ timeout: 10000 });
  });
});
