import { test, expect } from '@playwright/test';
import { loginAs } from './utils';

test.describe('Access Control - Commerciale non può accedere a pagine admin', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'test-comm@gestoray.local');
  });

  test('commerciale su /dashboard/users → redirect a /dashboard', async ({ page }) => {
    await page.goto('/dashboard/users');
    await expect(page).toHaveURL(/.*\/dashboard$/, { timeout: 10000 });
  });

  test('commerciale su /dashboard/settings → redirect a /dashboard', async ({ page }) => {
    await page.goto('/dashboard/settings');
    await expect(page).toHaveURL(/.*\/dashboard$/, { timeout: 10000 });
  });

  test('commerciale su /dashboard/qualifications → redirect a /dashboard', async ({ page }) => {
    await page.goto('/dashboard/qualifications');
    await expect(page).toHaveURL(/.*\/dashboard$/, { timeout: 10000 });
  });
});

test.describe('Access Control - Utente non autenticato', () => {
  test('non autenticato su /dashboard → redirect a /login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/.*\/login/, { timeout: 10000 });
  });

  test('non autenticato su /dashboard/clients → redirect a /login', async ({ page }) => {
    await page.goto('/dashboard/clients');
    await expect(page).toHaveURL(/.*\/login/, { timeout: 10000 });
  });
});
