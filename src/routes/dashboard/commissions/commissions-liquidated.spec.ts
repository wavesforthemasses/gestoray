import { test, expect } from '@playwright/test';
import { loginAs, seedFirestoreDoc, deleteFirestoreDoc } from '../../../../tests/utils';

test.describe('Commissions Liquidated Page', () => {
  const periodId = '2026_07';
  const versionId = 'test-version-123';

  test.beforeEach(async ({ page }) => {
    await seedFirestoreDoc('commissions_closings', periodId, {
      periodId: { stringValue: periodId },
      latestStatus: { stringValue: 'draft' }
    });

    // Seed a commission version
    await seedFirestoreDoc(`commissions_closings/${periodId}/versions`, versionId, {
      periodId: { stringValue: periodId },
      status: { stringValue: 'draft' },
      totalIncassi: { integerValue: '1000' },
      totalAllocated: { integerValue: '1000' },
      totalCommissions: { integerValue: '200' },
      breakdown: {
        arrayValue: {
          values: [
            {
              mapValue: {
                fields: {
                  vendorEmail: { stringValue: 'test-comm@gestoray.local' },
                  name: { stringValue: 'Test Comm' },
                  qualification: { stringValue: 'agente' },
                  sales: { integerValue: '1000' },
                  commission: { integerValue: '200' }
                }
              }
            }
          ]
        }
      },
      allocations: { arrayValue: { values: [] } }
    });

    await loginAs(page, 'test-admin@gestoray.local');
    await page.goto(`/dashboard/commissions/${periodId}/${versionId}`);
  });

  test.afterEach(async () => {
    await deleteFirestoreDoc(`commissions_closings/${periodId}/versions`, versionId);
    await deleteFirestoreDoc(`commissions_closings`, periodId);
  });

  test('carica il dettaglio della versione e la rende definitiva', async ({ page }) => {
    await expect(page.locator('.loader-box')).toBeHidden({ timeout: 15000 });
    
    // Verifica KPIs
    const kpiVal = await page.locator('.kpi-val').first().textContent();
    console.log('KPI VAL:', kpiVal);
    await expect(page.locator('.kpi-val').first()).toBeVisible();

    // Rende definitiva
    await page.getByRole('button', { name: /Approva e Rendi Definitive/i }).click();

    // Verifica toast success
    await expect(page.locator('.toast-success')).toBeVisible({ timeout: 10000 });

    // Verifica che il pulsante sparisca o cambi e appaia lo stato
    await expect(page.getByText('Pronta per Fatturazione').first()).toBeVisible();
  });
});
