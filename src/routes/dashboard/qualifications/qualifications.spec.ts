import { test, expect } from '@playwright/test';
import { loginAs } from '../../../../tests/utils';

test.describe('Qualifications Page', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'test-super@app.local');
    await page.goto('/dashboard/qualifications');
  });

  test('carica la pagina gestione qualifiche', async ({ page }) => {
    await expect(page.locator('.loader-box')).toBeHidden({ timeout: 15000 });
  });

  test('aggiunge una nuova qualifica', async ({ page }) => {
    await expect(page.locator('.loader-box')).toBeHidden({ timeout: 15000 });
    
    // Clicca Aggiungi
    await page.getByRole('button', { name: /Nuova Qualifica/i }).click();

    // Compila
    await page.locator('#qual-name').fill('Test Qualifica');
    await page.locator('#qual-percentage').fill('15');
    await page.locator('#qual-super-percentage').fill('5');

    // Submit
    await page.getByRole('button', { name: /Crea Qualifica/i }).click();

    // Aspetta il redirect
    await page.waitForURL('**/dashboard/qualifications');

    // Verifica che la qualifica sia visibile in tabella
    await expect(page.getByText('Test Qualifica').first()).toBeVisible();
  });
});
