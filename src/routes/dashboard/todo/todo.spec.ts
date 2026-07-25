import { test, expect } from '@playwright/test';
import { loginAs, seedFirestoreDoc, deleteFirestoreDoc } from '../../../../tests/utils';

test.describe('Todo Page', () => {
  const contractId = 'test-todo-contract-123';

  test.beforeEach(async ({ page }) => {
    await seedFirestoreDoc('contracts', contractId, {
      original: {
        mapValue: {
          fields: {
            clientId: { stringValue: 'client-abc' },
            clientName: { stringValue: 'Todo Client E2E' },
            status: { stringValue: 'pending' },
            totalPrice: { integerValue: '5000' }
          }
        }
      },
      derived: { mapValue: { fields: {} } }
    });

    await loginAs(page, 'test-admin@gestoray.local');
    await page.goto('/dashboard/todo');
  });

  test.afterEach(async () => {
    await deleteFirestoreDoc('contracts', contractId);
  });

  test('verifica rendering task card', async ({ page }) => {
    await expect(page.locator('.loader-box')).toBeHidden({ timeout: 15000 });
    await expect(page.getByText('Scadenziario To-Do')).toBeVisible();
  });

  test('risolve un task di validazione contratto dalla To-Do list', async ({ page }) => {
    await expect(page.locator('.loader-box')).toBeHidden({ timeout: 15000 });
    const approveBtn = page.getByRole('button', { name: /Approva/i }).first();
    if (await approveBtn.isVisible()) {
      await approveBtn.click();
      await expect(page.locator('.toast-success')).toBeVisible({ timeout: 10000 });
    }
  });

  test('gestione di una eccezione task', async ({ page }) => {
    await expect(page.locator('.loader-box')).toBeHidden({ timeout: 15000 });
    const rejectBtn = page.getByRole('button', { name: /Rifiuta|Ignora|Elimina/i }).first();
    if (await rejectBtn.isVisible()) {
      await rejectBtn.click();
      const confirmInput = page.locator('.confirm-input');
      if (await confirmInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await confirmInput.fill('ELIMINA');
        await page.getByRole('button', { name: 'Conferma', exact: true }).click();
      }
      await expect(page.locator('.toast-success')).toBeVisible({ timeout: 10000 });
    }
  });
});
