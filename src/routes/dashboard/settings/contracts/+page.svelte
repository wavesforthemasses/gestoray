<script lang="ts">
  import { onMount } from 'svelte';
  import { ContractSettingsService } from '../../contracts/contractSettingsService';
  import type { ContractSettings } from '../../contracts/schema';

  import { toast } from '$lib/stores/toast.svelte';
  import { Card, FormField, Button } from '$lib';
  import { FileText, Save, RefreshCw, Hash, Settings } from '@lucide/svelte';

  let settings = $state<ContractSettings>({
    entityNaming: 'contract',
    prefix: 'CTR-',
    includeYear: true,
    numberPadding: 4,
    lastNumber: 0,
    resetCounterAnnually: true,
    lastCounterYear: new Date().getFullYear()
  });

  let loading = $state(true);
  let saving = $state(false);

  onMount(async () => {
    try {
      settings = await ContractSettingsService.getSettings();
    } catch (e) {
      console.error('Errore caricamento impostazioni contratti:', e);
      toast.error('Impossibile caricare le impostazioni');
    } finally {
      loading = false;
    }
  });

  async function handleSave(e: Event) {
    e.preventDefault();
    saving = true;
    try {
      await ContractSettingsService.saveSettings(settings);
      toast.success('Impostazioni salvate con successo!');
    } catch (err: any) {
      console.error('Errore salvataggio impostazioni:', err);
      toast.error('Errore salvataggio impostazioni: ' + err.message);
    } finally {
      saving = false;
    }
  }

  function handleResetCounter() {
    if (confirm('Sei sicuro di voler azzerare il contatore numerico progressivo a 0?')) {
      settings.lastNumber = 0;
      toast.info('Contatore azzerato. Salva le impostazioni per confermare.');
    }
  }
</script>

<svelte:head>
  <title>Impostazioni Contratti e Preventivi | Gestoray</title>
</svelte:head>

<div class="contracts-settings-page animate-fade-in">
  <div class="page-top-actions">
    <div>
      <h2 class="title-header">
        <Settings size={28} color="var(--color-primary-600)" />
        Impostazioni Contratti & Preventivi
      </h2>
      <p class="subtitle">Configura la denominazione ufficiale, il formato di numerazione automatica ed i contatori progressivi.</p>
    </div>
  </div>

  {#if loading}
    <div class="loading-box">Caricamento impostazioni in corso...</div>
  {:else}
    <form onsubmit={handleSave} class="settings-form">
      <!-- 1. DENOMINAZIONE E TERMINOLOGIA -->
      <Card title="Denominazione Ufficiale Modulo" description="Scegli se chiamare questo modulo 'Contratti' o 'Preventivi' in tutta l'applicazione.">
        <div class="form-grid">
          <div class="radio-group">
            <label class="radio-label {settings.entityNaming === 'contract' ? 'active' : ''}">
              <input type="radio" name="entityNaming" value="contract" bind:group={settings.entityNaming} />
              <div>
                <strong>📄 Contratti & Canoni (Predefinito)</strong>
                <p>Terminologia incentrata su Contratti, Canoni ricorrenti e Scadenze aziendali.</p>
              </div>
            </label>

            <label class="radio-label {settings.entityNaming === 'quote' ? 'active' : ''}">
              <input type="radio" name="entityNaming" value="quote" bind:group={settings.entityNaming} />
              <div>
                <strong>🏷️ Preventivi & Quotazioni</strong>
                <p>Terminologia incentrata su Preventivi commercializzati, Offerte e Quotazioni ai clienti.</p>
              </div>
            </label>
          </div>
        </div>
      </Card>

      <!-- 2. FORMATO NUMERAZIONE AUTOMATICA -->
      <Card title="Formato Numerazione Automatica" description="Personalizza il prefisso, l'anno e la lunghezza delle cifre del numero sequenziale.">
        <div class="grid-2">
          <FormField id="prefix" label="PREFISSO NUMERAZIONE">
            <input type="text" id="prefix" bind:value={settings.prefix} placeholder="es. CTR- oppure PREV-" />
          </FormField>

          <FormField id="numberPadding" label="NUMERO DI CIFRE (ZERO PADDING)">
            <input type="number" id="numberPadding" bind:value={settings.numberPadding} min="1" max="8" />
          </FormField>
        </div>

        <div class="toggles-grid">
          <label class="checkbox-label">
            <input type="checkbox" bind:checked={settings.includeYear} />
            <span>Includi l'anno corrente nel numero (es. {settings.prefix || ''}{new Date().getFullYear()}-0001)</span>
          </label>

          <label class="checkbox-label">
            <input type="checkbox" bind:checked={settings.resetCounterAnnually} />
            <span>Azzera automaticamente il contatore progressivo ad ogni nuovo anno solare</span>
          </label>
        </div>
      </Card>

      <!-- 3. GESTIONE CONTATORE PROGRESSIVO -->
      <Card title="Contatore Progressivo Attuale" description="Visualizza e modifica manualmente l'ultimo numero progressivo generato.">
        <div class="grid-2 align-end">
          <FormField id="lastNumber" label="ULTIMO NUMERO PROGRESSIVO GENERATO">
            <input type="number" id="lastNumber" bind:value={settings.lastNumber} min="0" />
          </FormField>

          <div class="actions-row">
            <button type="button" class="btn-secondary" onclick={handleResetCounter}>
              <RefreshCw size={16} /> Azzerati Contatore a 0
            </button>
          </div>
        </div>
      </Card>

      <!-- BOTTONE SALVATAGGIO -->
      <div class="submit-bar">
        <button type="submit" class="btn-primary" disabled={saving}>
          <Save size={18} /> {saving ? 'Salvataggio in corso...' : 'Salva Impostazioni'}
        </button>
      </div>
    </form>
  {/if}
</div>

<style>
  .contracts-settings-page {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .title-header {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 24px;
    font-weight: 700;
    margin: 0 0 4px 0;
  }

  .subtitle {
    font-size: 14px;
    color: var(--color-neutral-500, #6b7280);
    margin: 0;
  }

  .settings-form {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .radio-group {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 16px;
    margin-top: 8px;
  }

  .radio-label {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 16px;
    border: 1px solid var(--color-neutral-300, #d1d5db);
    border-radius: var(--radius-md, 8px);
    background: var(--color-surface, #ffffff);
    cursor: pointer;
    transition: all 0.2s;
  }

  .radio-label.active {
    border-color: var(--color-primary-600, #2563eb);
    background: #eff6ff;
  }

  .radio-label strong {
    display: block;
    font-size: 15px;
    margin-bottom: 4px;
  }

  .radio-label p {
    font-size: 13px;
    color: var(--color-neutral-600, #4b5563);
    margin: 0;
  }

  .grid-2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }

  .align-end {
    align-items: flex-end;
  }

  .toggles-grid {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid var(--color-neutral-200, #e5e7eb);
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 14px;
    cursor: pointer;
  }

  .btn-primary {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: var(--color-primary-600, #2563eb);
    color: white;
    padding: 10px 24px;
    border-radius: var(--radius-md, 8px);
    font-weight: 600;
    border: none;
    cursor: pointer;
    font-size: 14px;
  }

  .btn-secondary {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: var(--color-neutral-100, #f3f4f6);
    color: var(--color-neutral-800, #1f2937);
    padding: 10px 16px;
    border-radius: var(--radius-md, 8px);
    font-weight: 600;
    border: 1px solid var(--color-neutral-300, #d1d5db);
    cursor: pointer;
  }

  .submit-bar {
    display: flex;
    justify-content: flex-end;
    margin-top: 12px;
  }

  .loading-box {
    padding: 40px;
    text-align: center;
    background: white;
    border-radius: 12px;
  }

  input[type="text"], input[type="number"] {
    width: 100%;
    padding: 9px 12px;
    border: 1px solid var(--color-neutral-300, #d1d5db);
    border-radius: 8px;
    font-size: 14px;
    outline: none;
    box-sizing: border-box;
  }

  input[type="text"]:focus, input[type="number"]:focus {
    border-color: var(--color-primary-500, #3b82f6);
  }
</style>
