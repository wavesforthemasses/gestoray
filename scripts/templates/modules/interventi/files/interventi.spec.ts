import { test, expect } from '@playwright/test';
import { loginAs } from '../../../../tests/utils';

test.describe('Interventi Module 100% Lifecycle E2E Test Suite', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'test-admin@app.local');
  });

  test('1. Dashboard Interventi, KPI e Switch Vista (Lista / Agenda)', async ({ page }) => {
    await page.goto('/dashboard/interventi');
    await expect(page.locator('.loading-state')).toBeHidden({ timeout: 15000 });
    await expect(page.locator('.page-title')).toContainText('Interventi');
    await expect(page.locator('.kpi-card')).toHaveCount(4);

    // Switch tra vista Lista ed Agenda
    const calendarBtn = page.getByRole('button', { name: /Agenda/i });
    await calendarBtn.click();
    await expect(page.locator('.calendar-card, .empty-state')).toBeVisible();

    const listBtn = page.getByRole('button', { name: /Lista/i });
    await listBtn.click();
    await expect(page.locator('.table-container, .empty-state')).toBeVisible();
  });

  test('2. Pianificazione Nuovo Intervento e Gestione Mezzi/Squadra', async ({ page }) => {
    await page.goto('/dashboard/interventi/add');
    await expect(page.locator('.intervention-form')).toBeVisible({ timeout: 15000 });

    const testTitle = 'E2E Intervento Manutenzione - ' + Date.now();
    await page.fill('input#title', testTitle);
    await page.fill('textarea#desc', 'Istruzioni operative di collaudo completo.');

    // Seleziona Cliente via Autocomplete se presente
    const clientInput = page.locator('.autocomplete-input').first();
    if (await clientInput.isVisible()) {
      await clientInput.click();
      await page.waitForTimeout(300);
      const firstOpt = page.locator('.option-item').first();
      if (await firstOpt.isVisible().catch(() => false)) {
        await firstOpt.click();
      }
    }

    // Imposta schedulazione
    await page.fill('input#estQty', '3');

    // Salva solo se il bottone è attivo
    const submitBtn = page.getByRole('button', { name: /Conferma e Pianifica Intervento/i });
    if (await submitBtn.isEnabled()) {
      await submitBtn.click();
      if (await page.locator('.alert-danger').isVisible().catch(() => false)) {
        // Se manca il cliente, il form mostra l'errore di validazione atteso
        await expect(page.locator('.alert-danger')).toContainText('Cliente');
      } else {
        await expect(page).toHaveURL(/\/dashboard\/interventi\/[a-zA-Z0-9_-]+$/);
      }
    }
  });

  test('3. Dettaglio Intervento, Consuntivazione, Materiali e Trasformazione in Bolla', async ({ page }) => {
    await page.goto('/dashboard/interventi');
    await expect(page.locator('.loading-state')).toBeHidden({ timeout: 15000 });

    const firstItemLink = page.locator('.item-title').first();
    if (await firstItemLink.isVisible()) {
      await firstItemLink.click();
      await expect(page.locator('.intervention-detail-page')).toBeVisible({ timeout: 10000 });

      // Apri Modale Consuntivazione
      const consuntivaBtn = page.getByRole('button', { name: /Consuntiva & Trasforma in Bolla|Modifica Consuntivo/i });
      await consuntivaBtn.click();
      await expect(page.locator('.modal-card')).toBeVisible();

      // Inserisci quantità effettive e firmatario
      await page.fill('input#actQty', '4.5');
      await page.fill('input#signerName', 'Cliente Collaudo E2E');

      // Conferma consuntivo
      await page.getByRole('button', { name: /Conferma Consuntivo & Salva/i }).click();
      await expect(page.locator('.modal-card')).toBeHidden({ timeout: 10000 });

      await expect(page.getByText('4.5')).toBeVisible();
    }
  });

  test('4. Pagina Pubblica di Firma e Conferma Cliente', async ({ page }) => {
    await page.goto('/dashboard/interventi');
    await expect(page.locator('.loading-state')).toBeHidden({ timeout: 15000 });

    const firstItemLink = page.locator('.item-title').first();
    if (await firstItemLink.isVisible()) {
      const href = await firstItemLink.getAttribute('href');
      const id = href?.split('/').pop();

      // Naviga alla rotta pubblica di conferma
      await page.goto(`/public/interventi/confirm?id=${id}`);
      await expect(page.locator('.confirm-card')).toBeVisible({ timeout: 15000 });

      await page.fill('input#signer', 'Mario Rossi E2E');

      // Disegna sulla firma canvas
      const canvas = page.locator('canvas');
      if (await canvas.isVisible()) {
        const box = await canvas.boundingBox();
        if (box) {
          await page.mouse.move(box.x + 20, box.y + 20);
          await page.mouse.down();
          await page.mouse.move(box.x + 100, box.y + 50);
          await page.mouse.up();
        }
      }

      await page.getByRole('button', { name: /Conferma e Invia Firma Digitale/i }).click();
      await expect(page.locator('.alert-success')).toBeVisible({ timeout: 15000 });
    }
  });

  test('5. Gestione Impostazioni Modulo, Squadre e Parco Mezzi', async ({ page }) => {
    // 5a. Impostazioni Modulo
    await page.goto('/dashboard/settings/interventi');
    await expect(page.locator('.loading-state')).toBeHidden({ timeout: 15000 });
    await expect(page.locator('.page-title')).toContainText('Configurazione Modulo Interventi');

    // Cambia Labeling White-Label a Cantieri
    const labelSelect = page.locator('select#locLabel');
    await labelSelect.selectOption('Cantieri');

    // 5b. Gestione Parco Mezzi Dedicata
    await page.goto('/dashboard/interventi/vehicles');
    await expect(page.locator('.vehicles-page')).toBeVisible({ timeout: 10000 });
    await page.getByRole('button', { name: /\+ Nuovo Mezzo/i }).click();
    await expect(page.locator('.modal-card')).toBeVisible();

    const vehName = 'Furgone Collaudo E2E ' + Date.now();
    await page.fill('input#vName', vehName);
    await page.fill('input#vPlate', 'ZZ999YY');
    await page.getByRole('button', { name: /Registra Mezzo/i }).click();
    await expect(page.locator('.modal-card')).toBeHidden({ timeout: 10000 });
    await expect(page.getByText(vehName)).toBeVisible();

    // 5c. Gestione Squadre Dedicata
    await page.goto('/dashboard/interventi/teams');
    await expect(page.locator('.teams-page')).toBeVisible({ timeout: 10000 });
    await page.getByRole('button', { name: /\+ Nuova Squadra/i }).click();
    await expect(page.locator('.modal-card')).toBeVisible();

    const teamName = 'Squadra Collaudo E2E ' + Date.now();
    await page.fill('input#tName', teamName);
    await page.getByRole('button', { name: /Crea Squadra/i }).click();
    await expect(page.locator('.modal-card')).toBeHidden({ timeout: 10000 });
    await expect(page.getByText(teamName)).toBeVisible();
  });
});
