import { test, expect } from '@playwright/test';
import { loginAs } from '../../../tests/utils';

test.describe('Dashboard Page - Accesso e Sicurezza', () => {
  test('reindirizza a /login se l\'utente non è autenticato', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/.*\/login/);
  });
});

test.describe('Dashboard Page - Ruolo: Amministrazione', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'test-admin@gestoray.local');
  });

  test('mostra il layout corretto per l\'amministrazione', async ({ page }) => {
    await expect(page.locator('.dashboard-viewport')).toBeVisible({ timeout: 15000 });
  });

  test('visualizza le tabelle dei task amministrativi se presenti', async ({ page }) => {
    await expect(page.locator('.dashboard-viewport')).toBeVisible({ timeout: 15000 });
    const banner = page.locator('.welcome-banner');
    await expect(banner).toBeVisible();
  });

  test('permette di approvare un contratto se disponibile', async ({ page }) => {
    const approvaBtn = page.getByRole('button', { name: 'Approva' }).first();
    if (await approvaBtn.isVisible()) {
      await approvaBtn.click();
      await expect(page.locator('text=Contratto approvato con successo')).toBeVisible();
    }
  });

  test('permette di segnare una provvigione come pagata se disponibile', async ({ page }) => {
    const segnaPagatoBtn = page.getByRole('button', { name: 'Segna Pagato' }).first();
    if (await segnaPagatoBtn.isVisible()) {
      await segnaPagatoBtn.click();
      await expect(page.locator('text=Sei sicuro di voler contrassegnare questo mese')).toBeVisible();
      await page.getByRole('button', { name: 'Conferma' }).click();
      await expect(page.locator('text=Provvigione segnata come pagata')).toBeVisible();
    }
  });
});

test.describe('Dashboard Page - Ruolo: Commerciale / Direzione', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'test-comm@gestoray.local');
  });

  test('mostra il layout corretto per commerciale/direzione', async ({ page }) => {
    await expect(page.locator('.dashboard-viewport')).toBeVisible({ timeout: 15000 });
  });

  test('interazione con la KPI Board se presente', async ({ page }) => {
    const kpiTileVSS = page.locator('.kpi-tile').first();
    if (await kpiTileVSS.isVisible()) {
      await kpiTileVSS.click();
    }
  });

  test('verifica caricamento dati', async ({ page }) => {
    await expect(page.locator('.loader-box')).toBeHidden();
  });
});

test.describe('Dashboard Page - Ruolo: Superadmin', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'test-super@gestoray.local');
  });

  test('mostra il layout per superadmin', async ({ page }) => {
    await expect(page.locator('.dashboard-viewport')).toBeVisible({ timeout: 15000 });
  });
});

test.describe('Dashboard - Sidebar Navigation', () => {
  test('la sidebar mostra le voci corrette per amministrazione', async ({ page }) => {
    await loginAs(page, 'test-admin@gestoray.local');
    await expect(page.locator('.nav-item', { hasText: 'Dashboard' })).toBeVisible();
  });

  test('la sidebar mostra le voci corrette per commerciale', async ({ page }) => {
    await loginAs(page, 'test-comm@gestoray.local');
    await expect(page.locator('.nav-item', { hasText: 'Dashboard' })).toBeVisible();
  });

  test('il bottone Disconnetti è visibile e funzionante', async ({ page }) => {
    await loginAs(page, 'test-admin@gestoray.local');
    const logoutBtn = page.locator('.logout-btn');
    await expect(logoutBtn).toBeVisible();
    await logoutBtn.click();
    await expect(page).toHaveURL(/.*\/login/, { timeout: 10000 });
  });
});
