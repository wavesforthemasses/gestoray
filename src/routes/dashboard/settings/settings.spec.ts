import { test, expect } from '@playwright/test';
import { loginAs } from '../../../../tests/utils';

test.describe('Settings Hub Page', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'test-admin@gestoray.local');
    await page.goto('/dashboard/settings');
  });

  test('carica la pagina hub impostazioni', async ({ page }) => {
    await expect(page.locator('.settings-hub')).toBeVisible({ timeout: 15000 });
  });

  test('mostra le card di navigazione verso le sotto-pagine', async ({ page }) => {
    await expect(page.locator('a[href*="/dashboard/settings/"]').first()).toBeVisible({ timeout: 10000 });
  });

  test('naviga alla pagina impostazioni ticket cliccando sulla card', async ({ page }) => {
    await page.getByText(/Configurazione Ticket/i).click();
    await page.waitForURL('**/dashboard/settings/tickets');
    expect(page.url()).toContain('/dashboard/settings/tickets');
  });
});
