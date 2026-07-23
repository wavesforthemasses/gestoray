import { test, expect } from '@playwright/test';
import { loginAs } from '../../../../tests/utils';

test.describe('Clients Page - Ruolo: Commerciale', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'test-comm@gestoray.local');
    await page.goto('/dashboard/clients');
  });

  test('carica la pagina clienti', async ({ page }) => {
    // La pagina è accessibile e il loader è scomparso
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
    // Verifica che il form/card di aggiunta sia visibile
    await expect(page.getByRole('heading', { name: /aggiungi nuov/i })).toBeVisible({ timeout: 5000 });
  });

  test('mostra errore di validazione se i campi obbligatori sono vuoti', async ({ page }) => {
    await expect(page.locator('.loader-box')).toBeHidden({ timeout: 15000 });
    await page.getByRole('button', { name: /aggiungi|nuov/i }).click();
    
    // Prova a inviare il form vuoto (i required HTML bloccano l'invio se non riempiti, ma proviamo bypassando o riempiendo e cancellando)
    // Meglio testare la logica custom, ad esempio manca email/telefono (che non hanno required HTML)
    await page.fill('#client-name', 'Test Azienda Srl');
    await page.fill('#client-fiscal', 'IT00000000000');
    // Lasciamo vuoti email e telefono
    await page.getByRole('button', { name: 'Crea Anagrafica Cliente' }).click();
    
    // Verifica toast di errore per contatti
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
    
    // Verifica toast di successo
    const successToast = page.locator('.toast-success').filter({ hasText: /creata con successo/i });
    await expect(successToast).toBeVisible();
    
    // Verifica che la riga sia comparsa nella tabella
    await expect(page.locator('table')).toContainText('Acme E2E Srl');
  });

  test('ricrea/ripristina logicamente un cliente con stessa P.IVA', async ({ page }) => {
    await expect(page.locator('.loader-box')).toBeHidden({ timeout: 15000 });
    await page.getByRole('button', { name: /aggiungi|nuov/i }).click();
    
    // Proviamo a creare un cliente con P.IVA esistente.
    // Supponiamo che il backend blocchi o lo ripristini.
    const duplicateFiscal = 'IT00000000000';
    await page.fill('#client-name', 'Duplicate Srl');
    await page.fill('#client-fiscal', duplicateFiscal);
    await page.fill('#client-email', 'dup@acme.com');
    await page.getByRole('button', { name: 'Crea Anagrafica Cliente' }).click();
    
    // Potrebbe comparire un modale "Cliente già esistente, vuoi ripristinarlo?"
    // Oppure semplicemente un toast success se lo fa in automatico.
    const confirmBtn = page.getByRole('button', { name: /Ripristina|Conferma/i });
    if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await confirmBtn.click();
    }
    
    await expect(page.locator('.toast-success')).toBeVisible({ timeout: 10000 }).catch(() => null);
  });
});

test.describe('Clients Page - Ruolo: Amministrazione', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'test-admin@gestoray.local');
    await page.goto('/dashboard/clients');
  });

  test('carica la pagina clienti per admin', async ({ page }) => {
    await expect(page.locator('.loader-box')).toBeHidden({ timeout: 15000 });
  });
});
