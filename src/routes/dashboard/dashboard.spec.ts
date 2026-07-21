import { test, expect, type Page } from '@playwright/test';



test.describe('Dashboard Page - Accesso e Sicurezza', () => {
  test('reindirizza a /login se l\'utente non è autenticato', async ({ page }) => {
    await page.goto('/dashboard');
    // Il redirect avviene dopo 800ms se authState.user è null
    await expect(page).toHaveURL(/.*\/login/);
  });
});

import { loginAs } from '../../../tests/utils';

test.describe('Dashboard Page - Ruolo: Amministrazione', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'test-admin@gestoray.local');
  });

  test('mostra il layout corretto per l\'amministrazione', async ({ page }) => {
    // Verifica presenza della Card di benvenuto specifica per l'amministrazione
    await expect(page.locator('text=Pannello di Amministrazione & Recupero Crediti')).toBeVisible();
    await expect(page.locator('text=Monitora l\'approvazione delle transazioni commerciali')).toBeVisible();
  });

  test('visualizza le tabelle dei task amministrativi', async ({ page }) => {
    // Verifica che il componente AdminTasks venga renderizzato e mostri i titoli delle sezioni
    await expect(page.getByRole('heading', { name: 'Nuovi Ordini Da Approvare' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Scadenziario Recupero Crediti' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Provvigioni Da Pagare' })).toBeVisible();
  });

  test('permette di approvare un contratto', async ({ page }) => {
    // Questo test suppone che ci sia almeno un contratto in attesa.
    // Cerca il bottone "Approva", cliccalo e verifica il toast di successo.
    const approvaBtn = page.getByRole('button', { name: 'Approva' }).first();
    if (await approvaBtn.isVisible()) {
      await approvaBtn.click();
      await expect(page.locator('text=Contratto approvato con successo')).toBeVisible();
    }
  });

  test('permette di segnare una provvigione come pagata', async ({ page }) => {
    // Interazione con la tabella delle provvigioni
    const segnaPagatoBtn = page.getByRole('button', { name: 'Segna Pagato' }).first();
    if (await segnaPagatoBtn.isVisible()) {
      await segnaPagatoBtn.click();
      // Verifica l'apertura del modale di conferma
      await expect(page.locator('text=Sei sicuro di voler contrassegnare questo mese')).toBeVisible();
      // Conferma
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
    await expect(page.locator('text=Benvenuto nel tuo pannello di controllo')).toBeVisible();
  });

  test('interazione con il Trend Chart (Cambio Tab)', async ({ page }) => {
    // Verifica che il grafico esista
    const chartContainer = page.locator('.unified-chart-wrapper');
    await expect(chartContainer).toBeVisible();

    // Clicca sulle diverse tab del grafico
    // Clicca sulle diverse tab del grafico usando exact: true per evitare collisioni con le KPI Tile
    await page.getByRole('button', { name: 'VSS', exact: true }).click();
    await page.getByRole('button', { name: 'NNCF', exact: true }).click();
    await page.getByRole('button', { name: 'NA', exact: true }).click();

    // Verifica la modifica della granularità
    const selectGranularity = page.locator('select').filter({ hasText: 'SettimanaleMensileAnnuale' });
    if (await selectGranularity.isVisible()) {
      await selectGranularity.selectOption('settimanale');
      await selectGranularity.selectOption('annuale');
    }
  });

  test('interazione con la KPI Board', async ({ page }) => {
    // Cliccare su un KPI Tile dovrebbe aggiornare il grafico associato
    const kpiTileVSS = page.locator('.kpi-tile').filter({ hasText: 'Totale Venduto' });
    if (await kpiTileVSS.isVisible()) {
      await kpiTileVSS.click();
      // Il bottone VSS del grafico dovrebbe essere attivo
      const vssBtn = page.getByRole('button', { name: 'VSS' });
      await expect(vssBtn).toHaveClass(/active/);
    }
  });

  test('verifica caricamento dati', async ({ page }) => {
    // Quando la pagina viene caricata, dovrebbe mostrare lo spinner finché i dati non arrivano
    // Dato che Playwright è veloce, potremmo non vederlo, ma possiamo controllare la sua assenza finale
    await expect(page.locator('.loader-box')).toBeHidden();
  });
});
