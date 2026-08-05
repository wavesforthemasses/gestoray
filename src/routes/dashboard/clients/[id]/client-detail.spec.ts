import { test, expect } from '@playwright/test';
import { loginAs, seedFirestoreDoc, deleteFirestoreDoc } from '../../../../../tests/utils';

test.describe('Client Detail Page - Ruolo: Amministrazione', () => {
  const clientId = 'test-client-123';

  test.beforeEach(async ({ page }) => {
    // Seed a test client
    await seedFirestoreDoc('clients', clientId, {
      original: {
        mapValue: {
          fields: {
            nome: { stringValue: 'Test Detail Srl' },
            cognome: { stringValue: 'Rossi' },
            email: { stringValue: 'detail@test.com' },
            phone: { stringValue: '3331234567' },
            fiscalId: { stringValue: 'ITDETAIL123' },
            status: { stringValue: 'prospect' },
            notes: { arrayValue: { values: [] } },
            createdBy: { stringValue: 'test-uid' }
          }
        }
      },
      derived: {
        mapValue: {
          fields: {}
        }
      }
    });

    await loginAs(page, 'test-admin@app.local');
    await page.goto(`/dashboard/clients/${clientId}`);
  });

  test.afterEach(async () => {
    await deleteFirestoreDoc('clients', clientId);
    await deleteFirestoreDoc('products', 'test-product-123');
  });

  test('carica il dettaglio del cliente con i dati corretti', async ({ page }) => {
    await expect(page.locator('.loader-box')).toBeHidden({ timeout: 15000 });
    
    // Verifica che l'intestazione mostri il nome del cliente
    await expect(page.getByRole('heading', { name: 'Test Detail Srl' })).toBeVisible();
    
    // Verifica le informazioni di contatto (sono nei campi di input)
    await expect(page.locator('#c-email')).toHaveValue('detail@test.com');
    await expect(page.locator('#c-phone')).toHaveValue('3331234567');
  });

  test('modifica e salva le informazioni del cliente', async ({ page }) => {
    await expect(page.locator('.loader-box')).toBeHidden({ timeout: 15000 });
    
    // Il campo nome dovrebbe avere il valore attuale
    const nameInput = page.locator('#c-nome');
    await expect(nameInput).toHaveValue('Test Detail Srl');

    // Modifica il nome
    await nameInput.fill('Test Detail Edit Srl');
    
    // Salva modifiche
    await page.getByRole('button', { name: /salva/i }).click();

    // Attendi un attimo per dare il tempo al salvataggio
    await page.waitForTimeout(2000);
    const toasts = await page.locator('.toast').allTextContents();
    console.log('TOASTS PRESENTI SULLA PAGINA:', toasts);

    // Verifica toast di successo
    const successToast = page.locator('.toast-success');
    await expect(successToast).toBeVisible({ timeout: 10000 });

    // Verifica che il nuovo nome sia visibile
    await expect(page.getByRole('heading', { name: 'Test Detail Edit Srl' })).toBeVisible();
  });

  test('compila e salva un preventivo nella scheda preventivatore', async ({ page }) => {
    // Need to seed a product to test the quote builder
    await seedFirestoreDoc('products', 'test-product-123', {
      original: {
        mapValue: {
          fields: {
            name: { stringValue: 'Test Product E2E' },
            listPrice: { integerValue: '1000' },
            minPrice: { integerValue: '800' }
          }
        }
      }
    });

    await expect(page.locator('.loader-box')).toBeHidden({ timeout: 15000 });

    // Clicca sul tab Preventivatore
    await page.getByRole('button', { name: /Preventivatore/ }).click();
    
    // Seleziona il prodotto
    await page.locator('select#q-product').selectOption('test-product-123');

    // Il prezzo dovrebbe essere popolato a 1000, verifichiamo che input#q-price sia compilato
    await expect(page.locator('#q-price')).toHaveValue('1000');

    // Inseriamo quantità 2
    await page.locator('#q-qty').fill('2');

    // Aggiungi
    await page.getByRole('button', { name: /Inserisci Prodotto/i }).click();

    // Verifichiamo che l'elemento sia stato aggiunto
    await expect(page.locator('.items-table-container')).toContainText('Test Product E2E');
    await expect(page.locator('.items-table-container')).toContainText('€ 2000.00');

    // Salva in Bozza
    await page.getByRole('button', { name: /Salva Bozza/i }).click();

    // Verifica alert di successo
    await expect(page.locator('.status-alert-box')).toBeVisible({ timeout: 10000 });
  });
  test('converte preventivo in contratto dalla scheda preventivatore', async ({ page }) => {
    await seedFirestoreDoc('products', 'test-product-123', {
      original: {
        mapValue: {
          fields: {
            name: { stringValue: 'Test Product E2E' },
            listPrice: { integerValue: '1000' },
            minPrice: { integerValue: '800' }
          }
        }
      }
    });

    await expect(page.locator('.loader-box')).toBeHidden({ timeout: 15000 });

    await page.getByRole('button', { name: /Preventivatore/ }).click();
    await page.locator('select#q-product').selectOption('test-product-123');
    await expect(page.locator('#q-price')).toHaveValue('1000');
    await page.locator('#q-qty').fill('2');
    await page.getByRole('button', { name: /Inserisci Prodotto/i }).click();
    await expect(page.locator('.items-table-container')).toContainText('Test Product E2E');
    
    // Click Converti in Contratto instead of Salva Bozza
    await page.getByRole('button', { name: 'Converti in Contratto', exact: true }).click();

    // Verifica messaggio di successo (in alert verde)
    await expect(page.locator('.status-alert-box').filter({ hasText: 'convertito in contratto' })).toBeVisible({ timeout: 10000 });
  });

  test('elimina cliente (solo superadmin) e reindirizza alla lista', async ({ page }) => {
    // Prima verifichiamo che l'admin non abbia il pulsante elimina (per sicurezza)
    await expect(page.locator('.loader-box')).toBeHidden({ timeout: 15000 });
    
    // Admin normale non dovrebbe vedere il pulsante 'Elimina Anagrafica Cliente'
    await expect(page.getByRole('button', { name: /Elimina questa Anagrafica Cliente/i })).toBeHidden();

    // Per testare l'eliminazione entriamo come superadmin
    await loginAs(page, 'test-super@app.local');
    await page.goto(`/dashboard/clients/${clientId}`);
    await expect(page.locator('.loader-box')).toBeHidden({ timeout: 15000 });

    // Intercetta il modale nativo/custom di conferma
    page.on('dialog', dialog => dialog.accept('ELIMINA'));

    // Clicca elimina
    await page.getByRole('button', { name: /Elimina questa Anagrafica Cliente/i }).click();

    // Inseriamo "ELIMINA" se il modale è quello custom requireMatch (che ha un suo prompt html)
    // Se è il modale SweetAlert o confirmStore nativo che aspetta input "ELIMINA"
    const confirmInput = page.locator('.confirm-input');
    if (await confirmInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await confirmInput.fill('ELIMINA');
      await page.getByRole('button', { name: 'Conferma', exact: true }).click();
    }

    // Verifica toast eliminazione avvenuta e reindirizzamento
    await expect(page.locator('.toast-success')).toBeVisible({ timeout: 10000 });
    await page.waitForURL('**/dashboard/clients');
  });

  test('impedisce eliminazione cliente se ci sono contratti attivi', async ({ page }) => {
    // Aggiungi un contratto al cliente
    await seedFirestoreDoc('contracts', 'test-contract-block', {
      original: {
        mapValue: {
          fields: {
            clientId: { stringValue: clientId },
            status: { stringValue: 'approved' },
            totalPrice: { integerValue: '1000' }
          }
        }
      },
      derived: { mapValue: { fields: {} } }
    });

    await loginAs(page, 'test-super@app.local');
    await page.goto(`/dashboard/clients/${clientId}`);
    await expect(page.locator('.loader-box')).toBeHidden({ timeout: 15000 });

    // Clicca elimina
    await page.getByRole('button', { name: /Elimina questa Anagrafica Cliente/i }).click();

    // Poiché ci sono contratti attivi, il sistema mostra un avviso o richiede di digitare ELIMINA (Azione 13)
    // Verifichiamo che appaia il testo di avviso sui dati collegati
    await expect(page.getByText('possiede dati collegati')).toBeVisible();

    // Rifiuta o annulla il modale
    const cancelButton = page.getByRole('button', { name: 'Annulla' });
    if (await cancelButton.isVisible()) {
      await cancelButton.click();
    }
    
    // Cleanup
    await deleteFirestoreDoc('contracts', 'test-contract-block');
  });
});
