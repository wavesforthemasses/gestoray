import { test, expect } from '@playwright/test';
import { loginAs } from '../../../tests/utils';

test.describe('Login Page', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);
  });

  test('mostra il form di login con campo email e bottone', async ({ page }) => {
    await expect(page.locator('h2', { hasText: 'Benvenuto' })).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Invia codice PIN' })).toBeVisible();
  });

  test('il campo email è obbligatorio', async ({ page }) => {
    // Il campo email ha "required", quindi submit senza compilarlo non deve navigare
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toHaveAttribute('required', '');
  });

  test('flusso completo: email → PIN → redirect a /dashboard', async ({ page }) => {
    const email = 'test-admin@app.local';
    const pinDocUrl = `http://127.0.0.1:8080/v1/projects/gesto-ray/databases/(default)/documents/login_pins/${email}`;

    // Pulisci PIN vecchio
    await fetch(pinDocUrl, { method: 'DELETE', headers: { 'Authorization': 'Bearer owner' } });

    // Step 1: Inserisci email e invia
    await page.fill('input[type="email"]', email);
    await page.click('button[type="submit"]');

    // Step 2: Attendi che appaia il form del PIN
    await expect(page.locator('h2', { hasText: 'Verifica PIN' })).toBeVisible({ timeout: 15000 });
    await expect(page.locator('input[name="pin"]')).toBeVisible();

    // Leggi il PIN dall'emulatore
    let pin = '';
    for (let i = 0; i < 30; i++) {
      const res = await fetch(pinDocUrl, { headers: { 'Authorization': 'Bearer owner' } });
      if (res.ok) {
        const data = await res.json();
        if (data.fields?.pin?.stringValue) {
          pin = data.fields.pin.stringValue;
          break;
        }
      }
      await page.waitForTimeout(500);
    }
    expect(pin).toBeTruthy();

    // Step 3: Inserisci il PIN e accedi
    await page.fill('input[name="pin"]', pin);
    await page.click('button[type="submit"]');

    // Step 4: Verifica redirect a /dashboard
    await page.waitForURL('/dashboard', { timeout: 15000 });
    await expect(page).toHaveURL(/.*\/dashboard/);
  });

  test('mostra errore se si inserisce un PIN errato', async ({ page }) => {
    const email = 'test-admin@app.local';
    
    // Step 1: Inserisci email e invia
    await page.fill('input[type="email"]', email);
    await page.click('button[type="submit"]');

    // Step 2: Attendi il form del PIN
    await expect(page.locator('h2', { hasText: 'Verifica PIN' })).toBeVisible({ timeout: 15000 });

    // Step 3: Inserisci un PIN volutamente errato
    await page.fill('input[name="pin"]', '000000');
    await page.click('button[type="submit"]');

    // Step 4: Verifica il messaggio di errore (Toast o Banner)
    // Se c'è un toast error, cerchiamo .toast-error o .error-msg
    await expect(page.locator('.alert.error').first()).toBeVisible({ timeout: 10000 });
  });

  test('il bottone "Indietro" torna allo step email', async ({ page }) => {
    const email = 'test-admin@app.local';
    const pinDocUrl = `http://127.0.0.1:8080/v1/projects/gesto-ray/databases/(default)/documents/login_pins/${email}`;
    await fetch(pinDocUrl, { method: 'DELETE', headers: { 'Authorization': 'Bearer owner' } });

    await page.fill('input[type="email"]', email);
    await page.click('button[type="submit"]');

    await expect(page.locator('h2', { hasText: 'Verifica PIN' })).toBeVisible({ timeout: 15000 });

    // Click "Indietro"
    await page.getByRole('button', { name: 'Indietro' }).click();

    // Verifica che siamo tornati allo step 1
    await expect(page.locator('h2', { hasText: 'Benvenuto' })).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });
});

test.describe('Login Page - Protezione Accesso', () => {
  test('redirect a /login se si accede a /dashboard senza autenticazione', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/.*\/login/, { timeout: 10000 });
  });
});
