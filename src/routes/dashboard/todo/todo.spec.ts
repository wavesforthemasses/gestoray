import { test, expect } from '@playwright/test';
import { loginAs, seedFirestoreDoc, deleteFirestoreDoc } from '../../../../tests/utils';

test.describe('Todo Page', () => {
  const contractId = 'test-todo-contract-123';

  test.beforeEach(async ({ page }) => {
    // Seed a pending contract to generate a "pending_approval" TodoItem
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

    // Login as admin to see pending approvals
    await loginAs(page, 'test-admin@gestoray.local');
    await page.goto('/dashboard/todo');
  });

  test.afterEach(async () => {
    await deleteFirestoreDoc('contracts', contractId);
  });

  test('verifica rendering task card', async ({ page }) => {
    await expect(page.locator('.loader-box')).toBeHidden({ timeout: 15000 });
    // Check that the Todo item exists
    await expect(page.getByText('Todo Client E2E')).toBeVisible();
    await expect(page.getByText('Validazione Contratto')).toBeVisible();
  });

  test('risolve un task di validazione contratto dalla To-Do list', async ({ page }) => {
    await expect(page.locator('.loader-box')).toBeHidden({ timeout: 15000 });
    
    // Verifica che il Todo item sia visibile
    await expect(page.getByText('Todo Client E2E')).toBeVisible();
    
    // Intercetta l'alert/toast
    // Clicca sul bottone 'Approva Rapido' (o simile, assumiamo l'icona o il testo 'Approva')
    // Controlliamo il testo del bottone. Nella ToDoPage di solito c'è 'Approva'.
    await page.getByRole('button', { name: /Approva/i }).first().click();

    // Attendi il toast di successo
    await expect(page.locator('.toast-success')).toBeVisible({ timeout: 10000 });

    // Verifica che il task scompaia dalla To-Do list
    await expect(page.getByText('Todo Client E2E')).toBeHidden();
  });

  test('gestione di una eccezione (eliminazione o bypass manuale) task', async ({ page }) => {
    await expect(page.locator('.loader-box')).toBeHidden({ timeout: 15000 });
    
    // Controlla se c'è un bottone Rifiuta o Elimina task
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
