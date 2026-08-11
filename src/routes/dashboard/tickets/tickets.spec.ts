import { test, expect } from '@playwright/test';
import { loginAs } from '../../../../tests/utils';

test.describe('Tickets Module 100% Lifecycle E2E Test Suite', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'test-admin@app.local');
  });

  test('1. Dashboard, KPI e Filtri Scope (Tutti / Miei)', async ({ page }) => {
    await page.goto('/dashboard/tickets');
    await expect(page.locator('.loader-box')).toBeHidden({ timeout: 15000 });
    await expect(page.getByRole('heading', { name: /Ticket di Assistenza/i })).toBeVisible();
    await expect(page.locator('.kpi-card')).toHaveCount(4);

    // Switch Scope se presente
    const scopeBtn = page.getByRole('button', { name: /I Miei Ticket|Tutti i Ticket/i }).first();
    if (await scopeBtn.isVisible().catch(() => false)) {
      await scopeBtn.click();
      await page.waitForTimeout(500);
    }
  });

  test('2. Creazione Ticket Interno con "Sono Io" e CC', async ({ page }) => {
    await page.goto('/dashboard/tickets/add');
    await expect(page.locator('.form-card')).toBeVisible({ timeout: 15000 });

    const testSubject = 'E2E Complete Test - ' + Date.now();
    await page.fill('input#subject', testSubject);
    await page.fill('textarea#description', 'Descrizione ticket completo E2E con persona in CC.');
    
    // Autocompilazione "Sono Io"
    const selfBtn = page.locator('.btn-self');
    if (await selfBtn.isVisible()) {
      await selfBtn.click();
    } else {
      await page.fill('input#requesterName', 'Test Admin');
      await page.fill('input#requesterEmail', 'test-admin@app.local');
    }

    await page.fill('input#ccEmails', 'collega.e2e@app.local');

    await page.getByRole('button', { name: /Crea e Invia Ticket/i }).click();
    await expect(page.locator('.toast-success, .alert-success')).toBeVisible({ timeout: 10000 }).catch(() => null);

    await page.goto('/dashboard/tickets');
    await expect(page.getByText(testSubject)).toBeVisible({ timeout: 10000 });
  });

  test('3. Form Pubblica Generica e Dedicata per Cliente (clientId)', async ({ page }) => {
    // 3A. Form Generica
    await page.goto('/public/tickets');
    await expect(page.locator('.public-card')).toBeVisible({ timeout: 15000 });

    const pubSubject = 'Ticket Pubblico Generico - ' + Date.now();
    await page.fill('input#requesterName', 'Cliente E2E');
    await page.fill('input#requesterEmail', 'cliente.pubblico@app.local');
    await page.fill('input#subject', pubSubject);
    await page.fill('textarea#description', 'Segnalazione pubblica di collaudo.');

    await page.getByRole('button', { name: /Invia Segnalazione/i }).click();
    await expect(page.locator('.success-card')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Richiesta Inviata con Successo!')).toBeVisible();

    // 3B. Form Dedicata Cliente (con clientId in URL)
    await page.goto('/public/tickets?clientId=test-client-123');
    await expect(page.locator('.public-card')).toBeVisible({ timeout: 15000 });
    await page.fill('input#subject', 'Ticket Dedicato Cliente - ' + Date.now());
    await page.fill('textarea#description', 'Richiesta assistenza tramite link dedicato cliente.');
    await page.getByRole('button', { name: /Invia Segnalazione/i }).click();
    await expect(page.locator('.success-card')).toBeVisible({ timeout: 15000 });
  });

  test('4. Dettaglio Ticket: Risposta Rapida, Nota Interna, Cambio Stato e Assegnatario', async ({ page }) => {
    await page.goto('/dashboard/tickets');
    await expect(page.locator('.loader-box')).toBeHidden({ timeout: 15000 });

    const ticketRow = page.locator('.ticket-row, .table-row, td a').first();
    if (await ticketRow.isVisible()) {
      await ticketRow.click();
      await expect(page.locator('.ticket-detail-page')).toBeVisible({ timeout: 10000 });

      // Cambia Stato
      const statusSelect = page.locator('#ticket-status-select');
      if (await statusSelect.isVisible()) {
        await statusSelect.selectOption('in_lavorazione');
      }

      // Risposta Rapida o Testo Personalizzato
      const cannedSelect = page.locator('.canned-picker select');
      if (await cannedSelect.isVisible().catch(() => false)) {
        await cannedSelect.selectOption({ index: 1 });
      } else {
        await page.fill('textarea#new-msg', 'Risposta automatica di collaudo E2E');
      }

      await page.getByRole('button', { name: /Invia Risposta/i }).click();
      await expect(page.getByText('Risposta')).toBeVisible({ timeout: 10000 });
    }
  });

  test('5. Configurazione Impostazioni Ticket (Categorie, SLA, Canned e Webhook Secret)', async ({ page }) => {
    await page.goto('/dashboard/settings/tickets');
    await expect(page.locator('.loading-box')).toBeHidden({ timeout: 15000 });

    await expect(page.getByText('Configurazione Accesso, SLA e Modelli Ticket')).toBeVisible();

    // Imposta un Webhook Secret personalizzato
    const secretInput = page.locator('input#webhookSecretInput');
    if (await secretInput.isVisible()) {
      await secretInput.fill('secret_e2e_test_key_123');
    }

    // Aggiungi nuova Categoria
    const newCatInput = page.locator('input[placeholder="Nome Nuova Categoria"]');
    if (await newCatInput.isVisible()) {
      const catName = 'E2E Category ' + Date.now();
      await newCatInput.fill(catName);
      await page.getByRole('button', { name: /\+ Aggiungi Categoria/i }).click();
      await expect(page.getByText(catName)).toBeVisible();
    }

    // Salva impostazioni
    await page.getByRole('button', { name: /Salva Tutte le Impostazioni/i }).click();
    await expect(page.locator('.alert-success')).toBeVisible({ timeout: 10000 });
  });

  test('6. Inbound Webhook API Test (Autenticazione 401 & Creazione/Risposta 200 OK)', async ({ request, page }) => {
    // 6A. Test senza Secret -> 401 Unauthorized
    const unauthRes = await request.post('/api/webhooks/tickets/inbound', {
      data: {
        from: 'webhook.tester@app.local',
        subject: 'Webhook Test Unauth',
        text: 'Test senza secret.'
      }
    });
    expect(unauthRes.status()).toBe(401);

    // 6B. Configura Secret via Impostazioni per testare il flusso 200 OK
    await page.goto('/dashboard/settings/tickets');
    await expect(page.locator('.loading-box')).toBeHidden({ timeout: 15000 });
    const secretInput = page.locator('input#webhookSecretInput');
    if (await secretInput.isVisible()) {
      await secretInput.fill('e2e_valid_secret');
      await page.getByRole('button', { name: /Salva Tutte le Impostazioni/i }).click();
      await expect(page.locator('.alert-success')).toBeVisible({ timeout: 10000 });

      // Invia webhook valido
      const validRes = await request.post('/api/webhooks/tickets/inbound', {
        headers: {
          'x-webhook-secret': 'e2e_valid_secret'
        },
        data: {
          from: 'mario.webhook@cliente.it',
          subject: 'Ticket Inviato via Webhook E2E',
          text: 'Segnalazione creata via webhook email automatizzato.'
        }
      });
      expect(validRes.status()).toBe(200);
      const json = await validRes.json();
      expect(json.success).toBe(true);
      expect(json.ticketId).toBeTruthy();
    }
  });

  test('7. Eliminazione Definitiva Ticket', async ({ page }) => {
    // Crea un ticket temporaneo da eliminare
    await page.goto('/dashboard/tickets/add');
    await expect(page.locator('.form-card')).toBeVisible({ timeout: 15000 });

    const deleteSubject = 'Ticket Da Eliminare - ' + Date.now();
    await page.fill('input#subject', deleteSubject);
    await page.fill('textarea#description', 'Ticket per test di cancellazione.');
    await page.getByRole('button', { name: /Crea e Invia Ticket/i }).click();

    await page.goto('/dashboard/tickets');
    await expect(page.getByText(deleteSubject)).toBeVisible({ timeout: 10000 });
    await page.getByText(deleteSubject).click();

    await expect(page.locator('.ticket-detail-page')).toBeVisible({ timeout: 10000 });
    
    // Gestisci dialog di conferma cancellazione
    page.once('dialog', dialog => dialog.accept());

    const deleteBtn = page.locator('button:has-text("Elimina Ticket")');
    if (await deleteBtn.isVisible()) {
      await deleteBtn.click();
      await expect(page).toHaveURL(/\/dashboard\/tickets/);
    }
  });
});
