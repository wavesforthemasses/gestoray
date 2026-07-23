import { test, expect } from '@playwright/test';
import { loginAs } from '../../../../../tests/utils';

test.describe('Roles & Permissions Settings Page', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'test-admin@gestoray.local');
    await page.goto('/dashboard/settings/roles');
  });

  test('carica la matrice dei ruoli e permessi', async ({ page }) => {
    await expect(page.locator('.matrix-table')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('.role-tabs-bar')).toBeVisible();
    await expect(page.getByText('Matrice Permessi Azioni (CRUD) & Ruoli Aziendali')).toBeVisible();
  });

  test('permette di creare un nuovo ruolo personalizzato e salvare la matrice', async ({ page }) => {
    await expect(page.locator('.matrix-table')).toBeVisible({ timeout: 15000 });

    // Clicca su Aggiungi Nuovo Ruolo
    await page.getByRole('button', { name: /Aggiungi Nuovo Ruolo/i }).click();

    // Compila la modal
    const testRoleId = 'e2e_tester_' + Date.now();
    await page.fill('input#new-role-id', testRoleId);
    await page.fill('input#new-role-label', 'E2E Tester Role');
    await page.fill('input#new-role-desc', 'Ruolo generato da test Playwright');

    // Salva il ruolo nella modal
    await page.getByRole('button', { name: /Crea e Salva Ruolo/i }).click();

    // Verifica toast di successo
    await expect(page.locator('.toast-success')).toBeVisible({ timeout: 10000 });

    // Verifica che la tab del nuovo ruolo sia stata selezionata
    await expect(page.locator('.role-tab-btn.active')).toContainText('E2E Tester Role');
  });
});
