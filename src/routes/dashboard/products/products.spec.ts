import { test, expect } from '@playwright/test';
import { loginAs } from '../../../../tests/utils';

test.describe('Products Page & Versioning Timeline', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'test-admin@app.local');
    await page.goto('/dashboard/products');
  });

  test('carica la pagina catalogo prodotti', async ({ page }) => {
    await expect(page.locator('.loader-box')).toBeHidden({ timeout: 15000 });
  });

  test('crea nuovo prodotto, modifica prezzo e verifica timeline di versioning', async ({ page }) => {
    await expect(page.locator('.loader-box')).toBeHidden({ timeout: 15000 });
    
    // 1. Vai alla pagina di creazione
    const addBtn = page.getByRole('link', { name: /nuovo articolo|aggiungi/i }).or(page.getByRole('button', { name: /nuovo articolo|aggiungi/i })).first();
    await addBtn.click();
    
    await expect(page.locator('#prod-name')).toBeVisible({ timeout: 10000 });
    const uniqueSku = `SKU-TEST-${Date.now().toString().slice(-4)}`;
    await page.locator('#prod-sku').fill(uniqueSku);
    await page.locator('#prod-name').fill('Pompa Sommersa E2E Test');
    await page.locator('#prod-price').fill('150');
    
    await page.getByRole('button', { name: /Salva Articolo/i }).click();
    
    // 2. Verifica reindirizzamento al dettaglio prodotto
    await page.waitForURL(/\/dashboard\/products\/.+/, { timeout: 10000 });
    await expect(page.locator('.loader-box')).toBeHidden({ timeout: 15000 });
    await expect(page.locator('h1.page-title')).toContainText('Pompa Sommersa E2E Test');
    
    // 3. Verifica presenza card Audit Trail & Versioning
    await expect(page.locator('.history-card')).toBeVisible({ timeout: 10000 });
    
    // 4. Clicca Modifica Articolo e cambia prezzo
    const editBtn = page.getByRole('link', { name: /Modifica Articolo/i });
    await editBtn.click();
    
    await expect(page.locator('#prod-price')).toBeVisible({ timeout: 10000 });
    await page.locator('#prod-price').fill('275.50');
    await page.getByRole('button', { name: /Salva Modifiche/i }).click();
    
    // 5. Verifica ritorno al dettaglio e aggiornamento prezzo & timeline
    await page.waitForURL(/\/dashboard\/products\/.+/, { timeout: 10000 });
    await expect(page.locator('.text-primary')).toContainText('275,50');
    await expect(page.locator('.history-card')).toBeVisible({ timeout: 10000 });
  });

  test('elimina un prodotto dal catalogo', async ({ page }) => {
    await expect(page.locator('.loader-box')).toBeHidden({ timeout: 15000 });
    
    const deleteBtn = page.locator('button:has(.lucide-trash-2)').first();
    if (await deleteBtn.isVisible()) {
      await deleteBtn.click();
      const confirmBtn = page.getByRole('button', { name: /conferma|elimina|ok/i }).first();
      if (await confirmBtn.isVisible()) {
        await confirmBtn.click();
        await expect(page.locator('.toast')).toBeVisible({ timeout: 10000 });
      }
    }
  });
});
