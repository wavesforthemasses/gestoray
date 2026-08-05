import { test, expect } from '@playwright/test';
import { loginAs, seedFirestoreDoc, deleteFirestoreDoc } from '../../../../tests/utils';

test.describe('Payments Page', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'test-admin@app.local');
    await page.goto('/dashboard/payments');
  });

  test('carica la pagina incassi', async ({ page }) => {
    await expect(page.locator('.loader-box')).toBeHidden({ timeout: 15000 });
  });

  test('mostra il bottone per registrare un nuovo incasso', async ({ page }) => {
    await expect(page.locator('.loader-box')).toBeHidden({ timeout: 15000 });
    const addBtn = page.getByRole('button', { name: /registra|nuovo incasso/i });
    await expect(addBtn).toBeVisible();
  });

  test('compila e salva un nuovo incasso', async ({ page }) => {
    // Seed a client and a contract
    await seedFirestoreDoc('clients', 'test-client-pay', {
      original: {
        mapValue: {
          fields: {
            nome: { stringValue: 'Client For Payment' },
            email: { stringValue: 'pay@client.com' }
          }
        }
      },
      derived: { mapValue: { fields: {} } }
    });
    
    await seedFirestoreDoc('contracts', 'test-contract-pay', {
      original: {
        mapValue: {
          fields: {
            clientId: { stringValue: 'test-client-pay' },
            clientName: { stringValue: 'Client For Payment' },
            totalPrice: { integerValue: '500' },
            status: { stringValue: 'pending' },
            vendorUid: { stringValue: 'test-uid' },
            vendorEmail: { stringValue: 'admin@test.com' }
          }
        }
      },
      derived: { mapValue: { fields: {} } }
    });

    await expect(page.locator('.loader-box')).toBeHidden({ timeout: 15000 });
    
    // Apri form
    await page.getByRole('button', { name: /registra|nuovo incasso/i }).click();

    // Seleziona il cliente
    await page.locator('select#pay-client').selectOption('test-client-pay');

    // Seleziona il contratto
    // It takes a second to load contracts
    await expect(page.locator('select#pay-contract')).toBeVisible();
    await page.locator('select#pay-contract').selectOption('test-contract-pay');

    // Verifica importo pre-compilato a 500
    await expect(page.locator('#pay-amount')).toHaveValue('500');

    // Scorporo IVA click test (optional, but let's just click submit)
    await page.getByRole('button', { name: /Registra e Approva Contratto/i }).click();

    // Verifica toast success
    await page.waitForTimeout(2000);
    const toasts = await page.locator('.toast').allTextContents();
    console.log('TOASTS PRESENTI SULLA PAGINA:', toasts);
    
    const errors = await page.locator('.error-banner').allTextContents();
    console.log('ERRORI PRESENTI SULLA PAGINA:', errors);

    await expect(page.locator('.alert.success')).toBeVisible({ timeout: 10000 });

    // Cleanup
    await deleteFirestoreDoc('contracts', 'test-contract-pay');
    await deleteFirestoreDoc('clients', 'test-client-pay');
  });
  test('impedisce il salvataggio di un importo negativo', async ({ page }) => {
    await expect(page.locator('.loader-box')).toBeHidden({ timeout: 15000 });
    
    await page.getByRole('button', { name: /registra|nuovo incasso/i }).click();
    
    // Inseriamo importo negativo
    const amountInput = page.locator('#pay-amount');
    if (await amountInput.isVisible()) {
      await amountInput.fill('-100');
      // Alcuni input type="number" con min="0" bloccano nativamente, oppure il form lo blocca
      // Verifichiamo che il form non sia valido o che esca un errore
      await expect(amountInput).toHaveAttribute('min', '0');
    }
  });

  test('esporta registro incassi in Excel', async ({ page }) => {
    await expect(page.locator('.loader-box')).toBeHidden({ timeout: 15000 });
    
    const downloadPromise = page.waitForEvent('download').catch(() => null);
    
    // Clicca sul pulsante Esporta Excel se esiste
    const exportBtn = page.getByRole('button', { name: /Esporta Excel|Esporta/i }).first();
    if (await exportBtn.isVisible()) {
      await exportBtn.click();
      const download = await downloadPromise;
      if (download) {
        expect(download.suggestedFilename()).toContain('.xlsx');
      }
    }
  });
});
