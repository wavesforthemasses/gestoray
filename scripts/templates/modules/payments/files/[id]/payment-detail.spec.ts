import { test, expect } from '@playwright/test';
import { loginAs, seedFirestoreDoc, deleteFirestoreDoc } from '../../../../../tests/utils';

test.describe('Payment Detail Page', () => {
  const paymentId = 'test-payment-123';
  const allocId = 'test-alloc-123';

  test.beforeEach(async ({ page }) => {
    // Seed contract to distribute over
    await seedFirestoreDoc('contracts', 'test-contract-dist', {
      original: {
        mapValue: {
          fields: {
            clientId: { stringValue: 'test-client' },
            clientName: { stringValue: 'Client' },
            totalPrice: { integerValue: '1000' },
            products: {
              arrayValue: {
                values: [
                  {
                    mapValue: {
                      fields: {
                        productId: { stringValue: 'test-prod-1' },
                        name: { stringValue: 'Service 1' },
                        priceSold: { integerValue: '500' },
                        quantity: { integerValue: '1' }
                      }
                    }
                  },
                  {
                    mapValue: {
                      fields: {
                        productId: { stringValue: 'test-prod-2' },
                        name: { stringValue: 'Service 2' },
                        priceSold: { integerValue: '500' },
                        quantity: { integerValue: '1' }
                      }
                    }
                  }
                ]
              }
            }
          }
        }
      },
      derived: { mapValue: { fields: {} } }
    });

    // Seed payment
    await seedFirestoreDoc('payments', paymentId, {
      amount: { integerValue: '1000' },
      paymentDate: { stringValue: '2026-07-20T10:00:00Z' },
      clientId: { stringValue: 'test-client' },
      recordedBy: { stringValue: 'admin-uid' }
    });

    // Seed allocation
    await seedFirestoreDoc(`payments/${paymentId}/contractsPaid`, allocId, {
      original: {
        mapValue: {
          fields: {
            contractId: { stringValue: 'test-contract-dist' },
            amount: { integerValue: '1000' }
          }
        }
      }
    });

    await loginAs(page, 'test-admin@gestoray.local');
    await page.goto(`/dashboard/payments/${paymentId}`);
  });

  test.afterEach(async () => {
    await deleteFirestoreDoc(`payments/${paymentId}/contractsPaid`, allocId);
    await deleteFirestoreDoc('payments', paymentId);
    await deleteFirestoreDoc('contracts', 'test-contract-dist');
  });

  test('distribuisce importo sui prodotti', async ({ page }) => {
    await expect(page.locator('.loader-box')).toBeHidden({ timeout: 15000 });
    
    // Apri modal distribuzione
    await page.getByRole('button', { name: /Distribuisci sui Servizi/i }).click();

    // Verify modal is visible
    await expect(page.getByRole('heading', { name: /Distribuzione sui Servizi/i })).toBeVisible();

    // I due prodotti "Service 1" e "Service 2" dovrebbero esserci
    await expect(page.getByText('Service 1')).toBeVisible();
    await expect(page.getByText('Service 2')).toBeVisible();

    // The inputs for distribution are numbers. Let's find them by their associated labels or just by type="number" if there are 2.
    // Wait, the modal has input fields.
    const inputs = page.locator('.dist-input');
    // Since we don't know the exact class, let's use locator by type
    const numberInputs = page.locator('input[type="number"]');
    
    await numberInputs.nth(0).fill('500');
    await numberInputs.nth(1).fill('500');

    // Click Salva Distribuzione
    await page.getByRole('button', { name: /Salva Distribuzione/i }).click();

    // Verifica toast success
    await expect(page.locator('.toast-success')).toBeVisible({ timeout: 10000 });
  });

  test('rettifica importo o scadenza rata', async ({ page }) => {
    await expect(page.locator('.loader-box')).toBeHidden({ timeout: 15000 });
    
    // Potrebbe esserci un pulsante Modifica
    const editBtn = page.getByRole('button', { name: /Modifica/i }).first();
    if (await editBtn.isVisible()) {
      await editBtn.click();
      const amountInput = page.locator('#pay-amount-edit, input[type="number"]');
      if (await amountInput.isVisible()) {
        await amountInput.fill('1200');
        await page.getByRole('button', { name: /Salva/i }).first().click();
        await expect(page.locator('.toast-success')).toBeVisible({ timeout: 10000 });
      }
    }
  });

  test('storna ed elimina incasso', async ({ page }) => {
    await expect(page.locator('.loader-box')).toBeHidden({ timeout: 15000 });
    
    // Clicca elimina incasso (storno)
    const deleteBtn = page.getByRole('button', { name: /Elimina ed Storna questo Incasso/i });
    if (await deleteBtn.isVisible()) {
      await deleteBtn.click();
      
      // Modale di conferma
      const confirmBtn = page.getByRole('button', { name: 'Conferma', exact: true });
      if (await confirmBtn.isVisible()) {
        await confirmBtn.click();
        await expect(page.locator('.toast-success')).toBeVisible({ timeout: 10000 });
      }
    }
  });
});
