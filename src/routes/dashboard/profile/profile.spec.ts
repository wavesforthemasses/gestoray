import { test, expect } from '@playwright/test';
import { loginAs } from '../../../../tests/utils';

test.describe('Profile Page', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'test-admin@app.local');
    await page.goto('/dashboard/profile');
    await page.waitForLoadState('domcontentloaded');
  });

  test('carica la pagina profilo con il titolo corretto', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Impostazioni Profilo Personale' })).toBeVisible();
  });

  test('mostra i dati dell\'utente corrente', async ({ page }) => {
    // Verifica che il campo UID sia presente e disabilitato
    const uidInput = page.locator('#profile-uid');
    await expect(uidInput).toBeVisible();
    await expect(uidInput).toBeDisabled();

    // Verifica che il ruolo dell'utente sia visibile
    await expect(page.locator('.role-tag')).toBeVisible();
  });

  test('mostra i campi nome, cognome e email', async ({ page }) => {
    await expect(page.locator('#profile-nome')).toBeVisible();
    await expect(page.locator('#profile-cognome')).toBeVisible();
    await expect(page.locator('#profile-email')).toBeVisible();
  });

  test('aggiorna i dati del profilo e salva con successo', async ({ page }) => {
    // Rimuovi focus iniziale
    await expect(page.locator('.loader-box')).toBeHidden({ timeout: 15000 }).catch(() => {});
    
    const saveBtn = page.getByRole('button', { name: 'Salva Modifiche' });
    await expect(saveBtn).toBeVisible();

    // Modifica campi
    await page.locator('#profile-nome').fill('Nome Test');
    await page.locator('#profile-cognome').fill('Cognome E2E');

    // Click Salva
    await saveBtn.click();

    // Verifica Toast di successo
    await expect(page.locator('.toast-success')).toBeVisible({ timeout: 10000 });
  });
});
