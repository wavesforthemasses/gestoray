import { test, expect } from '@playwright/test';
import { loginAs } from '../../../../tests/utils';

test.describe('Users Page', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'test-super@gestoray.local');
    await page.goto('/dashboard/users');
  });

  test('carica la pagina utenti per superadmin', async ({ page }) => {
    await expect(page.locator('.loader-box')).toBeHidden({ timeout: 15000 });
  });

  test('crea un nuovo utente', async ({ page }) => {
    await expect(page.locator('.loader-box')).toBeHidden({ timeout: 15000 });
    
    await page.getByRole('button', { name: /Aggiungi Nuovo Utente/i }).click();

    await page.locator('#new-nome').fill('TestNuovo');
    await page.locator('#new-cognome').fill('Utente E2E');
    await page.locator('#new-email').fill(`new-user-e2e-${Date.now()}@gestoray.local`);
    
    // Seleziona il ruolo commerciale
    await page.getByLabel('Commerciale').check();

    await page.getByRole('button', { name: /Crea Nuovo Account/i }).click();

    await expect(page.getByText(/creato con successo/i)).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Users Page - Accesso Negato', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'test-comm@gestoray.local');
  });

  test('impedisce accesso a non-superadmin e reindirizza alla dashboard', async ({ page }) => {
    await page.goto('/dashboard/users');
    await page.waitForURL('**/dashboard');
    expect(page.url()).not.toContain('/dashboard/users');
  });
});
