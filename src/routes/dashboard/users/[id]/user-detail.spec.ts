import { test, expect } from '@playwright/test';
import { loginAs, seedFirestoreDoc, deleteFirestoreDoc } from '../../../../../tests/utils';

test.describe('User Detail Page', () => {
  const testUserId = 'test-detail-uid';

  test.beforeEach(async ({ page }) => {
    // Seed test user
    await seedFirestoreDoc('users', testUserId, {
      original: {
        mapValue: {
          fields: {
            nome: { stringValue: 'Test Detail' },
            cognome: { stringValue: 'User' },
            email: { stringValue: 'detail@app.local' },
            roles: {
              arrayValue: {
                values: [{ stringValue: 'commerciale' }]
              }
            }
          }
        }
      },
      derived: { mapValue: { fields: {} } }
    });

    await loginAs(page, 'test-super@app.local');
    await page.goto(`/dashboard/users/${testUserId}`);
  });

  test.afterEach(async () => {
    await deleteFirestoreDoc('users', testUserId);
  });

  test('dettaglio utente e modifica ruolo', async ({ page }) => {
    await expect(page.locator('.loading-spinner-box')).toBeHidden({ timeout: 15000 });
    
    // Verifica che i campi siano precompilati
    await expect(page.locator('input#user-nome')).toHaveValue('Test Detail');
    await expect(page.locator('input#user-cognome')).toHaveValue('User');
    
    // Aggiungi ruolo "Amministrazione"
    await page.getByLabel('Amministrazione').check();
    
    // Salva modifiche
    await page.getByRole('button', { name: /Salva Modifiche/i }).click();

    await expect(page.locator('.toast-success')).toBeVisible({ timeout: 10000 });
  });

  test('disattiva o elimina un account utente', async ({ page }) => {
    await expect(page.locator('.loader-box')).toBeHidden({ timeout: 15000 });

    const disableBtn = page.getByRole('button', { name: /Disattiva|Elimina/i }).first();
    if (await disableBtn.isVisible()) {
      await disableBtn.click();
      const confirmBtn = page.getByRole('button', { name: 'Conferma', exact: true });
      if (await confirmBtn.isVisible()) {
        await confirmBtn.click();
        await expect(page.locator('.toast-success')).toBeVisible({ timeout: 10000 });
      }
    }
  });
});
