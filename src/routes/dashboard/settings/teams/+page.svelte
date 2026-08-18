<script lang="ts">
  import { projectStore } from '$lib/stores/project';
  import { onMount } from 'svelte';
  import { TeamSettingsService } from '../../teams/teamSettingsService';
  import type { TeamSettings } from '../../teams/schema';
  import { pageTitle } from '$lib/stores/page';
  import { Card, Button } from '$lib';
  import { toast } from '$lib/stores/toast.svelte';
  import { Users, Save, Settings } from '@lucide/svelte';

  pageTitle.set('Impostazioni Squadre & Risorse');

  let settings = $state<TeamSettings>({
    entityNaming: 'squadra',
    customSingularLabel: '',
    customPluralLabel: '',
    prefix: 'SQD-',
    includeYear: true,
    numberPadding: 3,
    lastNumber: 0,
    lastCounterYear: new Date().getFullYear(),
    defaultStatus: 'attiva'
  });

  let loading = $state(true);
  let saving = $state(false);

  onMount(async () => {
    try {
      settings = await TeamSettingsService.getSettings();
    } catch (e) {
      console.error('Errore caricamento impostazioni squadre:', e);
      toast.error('Errore caricamento impostazioni');
    } finally {
      loading = false;
    }
  });

  async function handleSave() {
    saving = true;
    try {
      await TeamSettingsService.saveSettings(settings);
      toast.success('Impostazioni salvate con successo');
    } catch (e) {
      console.error('Errore salvataggio impostazioni:', e);
      toast.error('Errore durante il salvataggio');
    } finally {
      saving = false;
    }
  }
</script>

<svelte:head>
  <title>Impostazioni Squadre | {$projectStore?.projectName || 'ERP'}</title>
</svelte:head>

<div class="settings-page-container">
  <header class="page-header">
    <div class="header-title-box">
      <a href="/dashboard/settings" class="btn-module-list" title="Vai a Impostazioni" aria-label="Vai a Impostazioni">
        <Settings size={20} />
      </a>
      <div class="header-icon">
        <Users size={24} color="var(--color-primary-500)" />
      </div>
      <div>
        <h1 class="page-main-title">Configurazione Squadre & Risorse</h1>
        <p class="page-main-subtitle">Personalizza la denominazione agnostica, la numerazione ed i prefissi.</p>
      </div>
    </div>

    <Button variant="primary" onclick={handleSave} disabled={saving}>
      <Save size={18} />
      <span>{saving ? 'Salvataggio...' : 'Salva Impostazioni'}</span>
    </Button>
  </header>

  {#if loading}
    <div class="loading-state">Caricamento impostazioni in corso...</div>
  {:else}
    <div class="settings-grid">
      <Card class="settings-card">
        <h2 class="section-title">Denominazione Agnostica Entità</h2>
        <p class="section-desc">Scegli come deve essere chiamata la struttura dei team in tutta l'applicazione.</p>

        <div class="form-group">
          <label for="entityNaming">Tipo Denominazione</label>
          <select id="entityNaming" bind:value={settings.entityNaming} class="form-control">
            <option value="squadra">Squadra (Squadre)</option>
            <option value="team">Team (Team)</option>
            <option value="gruppo">Gruppo (Gruppi)</option>
            <option value="risorsa">Risorsa (Risorse)</option>
            <option value="custom">Personalizzata (Custom)</option>
          </select>
        </div>

        {#if settings.entityNaming === 'custom'}
          <div class="form-row">
            <div class="form-group">
              <label for="customSingular">Etichetta Singolare</label>
              <input id="customSingular" type="text" bind:value={settings.customSingularLabel} placeholder="es. Unità" class="form-control" />
            </div>
            <div class="form-group">
              <label for="customPlural">Etichetta Plurale</label>
              <input id="customPlural" type="text" bind:value={settings.customPluralLabel} placeholder="es. Unità" class="form-control" />
            </div>
          </div>
        {/if}
      </Card>

      <Card class="settings-card">
        <h2 class="section-title">Formattazione Codice Squadra</h2>
        <p class="section-desc">Configura il prefisso e la numerazione sequenziale per le nuove squadre.</p>

        <div class="form-row">
          <div class="form-group">
            <label for="prefix">Prefisso Codice</label>
            <input id="prefix" type="text" bind:value={settings.prefix} placeholder="es. SQD-" class="form-control" />
          </div>
          <div class="form-group">
            <label for="numberPadding">Cifre Zeri (Padding)</label>
            <input id="numberPadding" type="number" min="1" max="6" bind:value={settings.numberPadding} class="form-control" />
          </div>
        </div>

        <div class="form-group checkbox-group">
          <label class="checkbox-label">
            <input type="checkbox" bind:checked={settings.includeYear} />
            <span>Includi anno nel codice (es. SQD-2026-001)</span>
          </label>
        </div>
      </Card>
    </div>
  {/if}
</div>

<style>
  .settings-page-container {
    display: flex;
    flex-direction: column;
    gap: 20px;
    width: 100%;
  }
  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .header-title-box {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .btn-back {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: var(--radius-md);
    background: var(--color-neutral-100);
    color: var(--color-neutral-700);
    text-decoration: none;
  }
  .header-icon {
    width: 44px;
    height: 44px;
    border-radius: var(--radius-lg);
    background: var(--color-primary-50);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .page-main-title {
    font-size: 20px;
    font-weight: 700;
    margin: 0;
  }
  .page-main-subtitle {
    font-size: 13px;
    color: var(--color-neutral-500);
    margin: 2px 0 0 0;
  }
  .settings-grid {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
  .section-title {
    font-size: 16px;
    font-weight: 600;
    margin: 0 0 4px 0;
  }
  .section-desc {
    font-size: 13px;
    color: var(--color-neutral-500);
    margin: 0 0 16px 0;
  }
  .form-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 14px;
  }
  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }
  .form-control {
    padding: 8px 12px;
    border: 1px solid var(--color-neutral-200);
    border-radius: var(--radius-md);
    font-size: 14px;
  }
  .checkbox-group {
    flex-direction: row;
    align-items: center;
  }
  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    cursor: pointer;
  }
  .loading-state {
    padding: 30px;
    text-align: center;
    color: var(--color-neutral-500);
  }
</style>
