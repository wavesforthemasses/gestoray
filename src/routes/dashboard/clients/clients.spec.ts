import { test, expect } from '@playwright/test';
import { loginAs } from '../../../../tests/utils';

test.describe('Clients Page - Ruolo: Commerciale', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'test-comm@app.local');
    await page.goto('/dashboard/clients');
  });

  test('carica la pagina clienti', async ({ page }) => {
    await expect(page.locator('.loader-box')).toBeHidden({ timeout: 15000 });
  });

  test('mostra il bottone per aggiungere un nuovo cliente', async ({ page }) => {
    await expect(page.locator('.loader-box')).toBeHidden({ timeout: 15000 });
    const addBtn = page.getByRole('button', { name: /aggiungi|nuov/i });
    await expect(addBtn).toBeVisible();
  });

  test('apre il form di aggiunta cliente', async ({ page }) => {
    await expect(page.locator('.loader-box')).toBeHidden({ timeout: 15000 });
    const addBtn = page.getByRole('button', { name: /aggiungi|nuov/i });
    await addBtn.click();
    await expect(page.getByRole('heading', { name: /aggiungi nuov/i })).toBeVisible({ timeout: 5000 });
  });

  test('mostra errore di validazione se i campi obbligatori sono vuoti', async ({ page }) => {
    await expect(page.locator('.loader-box')).toBeHidden({ timeout: 15000 });
    await page.getByRole('button', { name: /aggiungi|nuov/i }).click();
    
    await page.fill('#client-name', 'Test Azienda Srl');
    await page.fill('#client-fiscal', 'IT00000000000');
    await page.getByRole('button', { name: 'Crea Anagrafica Cliente' }).click();
    
    const errorToast = page.locator('.toast-error').filter({ hasText: /Inserire almeno un contatto/i });
    await expect(errorToast).toBeVisible();
  });

  test('compila e salva un nuovo cliente con successo', async ({ page }) => {
    await expect(page.locator('.loader-box')).toBeHidden({ timeout: 15000 });
    await page.getByRole('button', { name: /aggiungi|nuov/i }).click();
    
    const randomFiscal = `IT${Math.floor(Math.random() * 10000000000)}`;
    
    await page.fill('#client-name', 'Acme E2E Srl');
    await page.fill('#client-fiscal', randomFiscal);
    await page.fill('#client-email', 'e2e@acme.com');
    await page.fill('#client-phone', '02123456');
    
    await page.getByRole('button', { name: 'Crea Anagrafica Cliente' }).click();
    
    const successToast = page.locator('.toast-success').filter({ hasText: /creata con successo/i });
    await expect(successToast).toBeVisible();
    
    await expect(page.locator('table')).toContainText('Acme E2E Srl');
  });

  test('carica la scheda dettaglio cliente ed i dati anagrafici senza errori ed apre il QR Code', async ({ page }) => {
    await expect(page.locator('.loader-box')).toBeHidden({ timeout: 15000 });
    const gestisciBtn = page.locator('table a').first();
    if (await gestisciBtn.isVisible()) {
      await gestisciBtn.click();
      await page.waitForURL('**/dashboard/clients/*');
      await expect(page.locator('.client-details-page')).toBeVisible({ timeout: 15000 });
      await expect(page.getByText('Scheda Anagrafica Cliente')).toBeVisible();

      // Verifica che non ci siano messaggi di errore permission o allow statements
      await expect(page.getByText('No matching allow statements')).toBeHidden();

      // Verifica apertura e chiusura del QR Code Assistenza
      const qrBtn = page.getByRole('button', { name: /QR Code Assistenza/i });
      await expect(qrBtn).toBeVisible();
      await qrBtn.click();
      await expect(page.getByText('QR Code & Link Assistenza Dedicato')).toBeVisible();
      await page.getByRole('button', { name: 'Chiudi' }).click();
    }
  });
});

test.describe('Clients Page - Ruolo: Amministrazione', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'test-admin@app.local');
    await page.goto('/dashboard/clients');
  });

  test('carica la pagina clienti per admin', async ({ page }) => {
    await expect(page.locator('.loader-box')).toBeHidden({ timeout: 15000 });
  });

  test('carica il dettaglio cliente per admin e apre la modale QR Code', async ({ page }) => {
    await expect(page.locator('.loader-box')).toBeHidden({ timeout: 15000 });
    const gestisciBtn = page.locator('table a').first();
    if (await gestisciBtn.isVisible()) {
      await gestisciBtn.click();
      await page.waitForURL('**/dashboard/clients/*');
      await expect(page.locator('.client-details-page')).toBeVisible({ timeout: 15000 });
      await expect(page.getByText('Scheda Anagrafica Cliente')).toBeVisible();

      // Verifica modale QR Code
      const qrBtn = page.getByRole('button', { name: /QR Code Assistenza/i });
      await expect(qrBtn).toBeVisible();
      await qrBtn.click();
      await expect(page.getByText('QR Code & Link Assistenza Dedicato')).toBeVisible();
      await page.getByRole('button', { name: 'Chiudi' }).click();
    }
  });
});
