import { test, expect } from '@playwright/test';
import { loginAs } from '../../../../tests/utils';

test.describe('__Name__ Page', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'test-admin@gestoray.local');
    await page.goto('/dashboard/__name__');
  });

  test('carica la pagina __name__', async ({ page }) => {
    await expect(page.locator('.loader-box')).toBeHidden({ timeout: 15000 });
  });

  test('naviga alla pagina di aggiunta', async ({ page }) => {
    await expect(page.locator('.loader-box')).toBeHidden({ timeout: 15000 });
    const addBtn = page.getByRole('button', { name: /aggiungi|nuov/i });
    await addBtn.click();
    await expect(page).toHaveURL(/\/dashboard\/__name__\/add/);
  });
});
