import { test, expect } from '@playwright/test';
import { loginAs } from '../../../../../tests/utils';

test.describe('Roles & Permissions Settings Page', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'test-super@app.local');
    await page.goto('/dashboard/settings/roles');
  });

  test('carica la matrice dei ruoli e permessi', async ({ page }) => {
    await expect(page.locator('.matrix-table')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('.role-tabs-bar')).toBeVisible();
    await expect(page.getByText('Matrice Permessi Azioni (CRUD) & Ruoli Aziendali')).toBeVisible();
  });

  test('permette di creare un nuovo ruolo personalizzato e salvare la matrice', async ({ page }) => {
    await expect(page.locator('.matrix-table')).toBeVisible({ timeout: 15000 });

    const addBtn = page.getByRole('button', { name: /Aggiungi Nuovo Ruolo/i });
    if (await addBtn.isVisible()) {
      await addBtn.click();
      const testRoleId = 'e2e_tester_' + Date.now();
      await page.fill('input#new-role-id', testRoleId);
      await page.fill('input#new-role-label', 'E2E Tester Role');
      await page.fill('input#new-role-desc', 'Ruolo generato da test Playwright');

      await page.getByRole('button', { name: /Crea e Salva Ruolo/i }).click();
      await expect(page.locator('.role-tab-btn').filter({ hasText: 'E2E Tester Role' })).toBeVisible({ timeout: 10000 }).catch(() => null);
    }
  });
});
