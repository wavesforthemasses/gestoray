import { test, expect } from '@playwright/test';
import { loginAs, seedFirestoreDoc, deleteFirestoreDoc } from '../../../../tests/utils';

test.describe('Contracts Page - Ruolo: Commerciale', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'test-comm@gestoray.local');
    await page.goto('/dashboard/contracts');
  });

  test('carica la pagina contratti', async ({ page }) => {
    await expect(page.locator('.loader-box')).toBeHidden({ timeout: 15000 });
    // Verify the page has loaded by checking for the tabs
    await expect(page.getByRole('button', { name: /Tutti/ })).toBeVisible();
  });

  test('cambia tab filtro tra In Attesa e Approvati', async ({ page }) => {
    await expect(page.locator('.loader-box')).toBeHidden({ timeout: 15000 });
    
    // Click su In Attesa
    await page.getByRole('button', { name: /In Attesa/ }).click();
    await expect(page.getByRole('button', { name: /In Attesa/ })).toHaveClass(/active/);
    
    // Click su Approvati
    await page.getByRole('button', { name: /Approvati/ }).click();
    await expect(page.getByRole('button', { name: /Approvati/ })).toHaveClass(/active/);
  });
});

test.describe('Contracts Page - Ruolo: Amministrazione', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'test-admin@gestoray.local');
    await page.goto('/dashboard/contracts');
  });

  test('carica la pagina contratti per admin', async ({ page }) => {
    await expect(page.locator('.loader-box')).toBeHidden({ timeout: 15000 });
  });

  test('esporta registro contratti in CSV', async ({ page }) => {
    await seedFirestoreDoc('contracts', 'test-export-csv', {
      createdAt: { timestampValue: "2026-07-22T10:00:00Z" },
      edits: {
        mapValue: {
          fields: {
            createdAt: { stringValue: "2026-07-22T10:00:00Z" }
          }
        }
      },
      original: {
        mapValue: {
          fields: {
            clientId: { stringValue: 'client-123' },
            clientName: { stringValue: 'Test Client CSV' },
            status: { stringValue: 'approved' },
            totalPrice: { integerValue: '1000' },
            vendorEmail: { stringValue: 'test@gestoray.local' }
          }
        }
      },
      derived: { mapValue: { fields: {} } }
    });

    // Ricarichiamo la pagina per avere i dati
    await page.goto('/dashboard/contracts');
    await expect(page.locator('.loader-box')).toBeHidden({ timeout: 15000 });
    await expect(page.getByText('Test Client CSV')).toBeVisible({ timeout: 10000 });
    
    // Attendi il download event dal browser
    const downloadPromise = page.waitForEvent('download');
    
    // Clicca sul pulsante o voce di menu "Esporta CSV"
    await page.locator('.export-btn[title*="CSV"]').first().click();
    
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('.csv');

    // Cleanup
    await deleteFirestoreDoc('contracts', 'test-export-csv');
  });
});
