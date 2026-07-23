import { test, expect } from '@playwright/test';
import { loginAs } from '../../../../tests/utils';

test.describe('My Commissions Page', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'test-comm@gestoray.local');
    await page.goto('/dashboard/my-commissions');
  });

  test('carica la pagina le mie provvigioni', async ({ page }) => {
    await expect(page.locator('.loader-box')).toBeHidden({ timeout: 15000 });
    await expect(page.getByRole('heading', { name: /Le Mie Provvigioni/i })).toBeVisible();
  });

  test('mostra il selettore del periodo', async ({ page }) => {
    await expect(page.locator('.loader-box')).toBeHidden({ timeout: 15000 });
    await expect(page.locator('select').first()).toBeVisible();
  });
});
