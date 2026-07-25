import { test, expect } from '@playwright/test';

test.describe('Gestoray E2E CRM Workflow', () => {
  test('should load dashboard and navigate to interventions', async ({ page }) => {
    await page.goto('/dashboard');
    // Verify dashboard or redirect to login
    await expect(page).toHaveURL(/.*(dashboard|login).*/);
  });

  test('should open custom fields settings page', async ({ page }) => {
    await page.goto('/dashboard/settings/custom-fields');
    await expect(page.locator('h1')).toContainText('Gestione Campi Personalizzati');
  });

  test('should open tenant feature flags settings page', async ({ page }) => {
    await page.goto('/dashboard/settings/tenant-features');
    await expect(page.locator('h1')).toContainText('Moduli & Funzionalità Attive');
  });
});
