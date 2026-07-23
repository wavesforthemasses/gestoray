import { test, expect } from '@playwright/test';
import { loginAs } from '../../../../tests/utils';

test.describe('Products Page', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'test-admin@gestoray.local');
    await page.goto('/dashboard/products');
  });

  test('carica la pagina catalogo prodotti', async ({ page }) => {
    await expect(page.locator('.loader-box')).toBeHidden({ timeout: 15000 });
  });

  test('aggiunge un nuovo prodotto', async ({ page }) => {
    await expect(page.locator('.loader-box')).toBeHidden({ timeout: 15000 });
    const addBtn = page.getByRole('button', { name: /aggiungi|nuov/i });
    await addBtn.click();
    
    await page.locator('#prod-name').fill('Test Product');
    await page.locator('#prod-list-price').fill('1500');
    await page.locator('#prod-min-price').fill('1000');
    
    await page.getByRole('button', { name: /Aggiungi al Catalogo/i }).click();
    
    await expect(page.locator('.toast-success')).toBeVisible({ timeout: 10000 });
  });

  test('modifica un prodotto esistente', async ({ page }) => {
    await expect(page.locator('.loader-box')).toBeHidden({ timeout: 15000 });
    
    const editBtn = page.getByRole('button', { name: /Modifica/i }).first();
    if (await editBtn.isVisible()) {
      await editBtn.click();
      await page.fill('input#prod-name', 'Prodotto Modificato E2E');
      await page.getByRole('button', { name: /Salva/i }).first().click();
      await expect(page.locator('.toast-success')).toBeVisible({ timeout: 10000 });
    }
  });

  test('elimina un prodotto dal listino', async ({ page }) => {
    await expect(page.locator('.loader-box')).toBeHidden({ timeout: 15000 });
    
    const deleteBtn = page.getByRole('button', { name: /Elimina/i }).first();
    if (await deleteBtn.isVisible()) {
      await deleteBtn.click();
      const confirmBtn = page.getByRole('button', { name: 'Conferma', exact: true });
      if (await confirmBtn.isVisible()) {
        await confirmBtn.click();
        await expect(page.locator('.toast-success')).toBeVisible({ timeout: 10000 });
      }
    }
  });
});
