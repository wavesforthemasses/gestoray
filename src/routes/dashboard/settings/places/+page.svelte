<script lang="ts">
  import { projectStore } from '$lib/stores/project';
  import { onMount } from 'svelte';
  import { PlaceSettingsService } from '../../places/placeSettingsService';
  import type { PlaceSettings, PlaceStatus } from '../../places/schema';
  import { toast } from '$lib/stores/toast.svelte';
  import { MapPin, Save, Layers, Hash, CheckCircle2 } from '@lucide/svelte';

  let settings = $state<PlaceSettings>({
    entityNaming: 'luogo',
    customSingularLabel: '',
    customPluralLabel: '',
    prefix: 'LUG-',
    includeYear: true,
    numberPadding: 3,
    lastNumber: 0,
    lastCounterYear: new Date().getFullYear(),
    defaultStatus: 'attivo'
  });

  let loading = $state(true);
  let saving = $state(false);

  let labels = $derived(PlaceSettingsService.getLabels(settings));

  onMount(async () => {
    try {
      settings = await PlaceSettingsService.getSettings();
    } catch (e) {
      console.error('Errore caricamento impostazioni luoghi:', e);
    } finally {
      loading = false;
    }
  });

  async function handleSave() {
    saving = true;
    try {
      await PlaceSettingsService.saveSettings(settings);
      toast.success(`Impostazioni modulo ${labels.plural} salvate con successo!`);
    } catch (err: any) {
      toast.error('Errore salvataggio impostazioni: ' + err.message);
    } finally {
      saving = false;
    }
  }
</script>

<svelte:head>
  <title>Configurazione {labels.plural} | {$projectStore?.projectName || 'ERP'}</title>
</svelte:head>

<div class="settings-page-container">
  <header class="settings-header">
    <div class="header-title-group">
      <div class="header-icon-box">
        <MapPin size={24} color="var(--color-primary-500)" />
      </div>
      <div>
        <h1 class="page-title">Configurazione {labels.plural}</h1>
        <p class="page-subtitle">Personalizza denominazione agnostica (Luogo, Cantiere, Sede), prefissi di codifica ed imposta i parametri generali.</p>
      </div>
    </div>
    <button class="btn-save" onclick={handleSave} disabled={saving || loading}>
      <Save size={18} />
      <span>{saving ? 'Salvataggio...' : 'Salva Impostazioni'}</span>
    </button>
  </header>

  {#if loading}
    <div class="loading-state">
      <p>Caricamento configurazione...</p>
    </div>
  {:else}
    <div class="settings-grid">
      <!-- Card 1: Nomenclatura Agnostica del Modulo -->
      <div class="settings-card">
        <div class="card-header">
          <Layers size={20} class="card-icon" />
          <h2>Denominazione Agnostica del Modulo</h2>
        </div>
        <p class="card-desc">Scegli come chiamare questo elemento nell'intero sistema (es. Luogo, Cantiere, Sede Operativa, Destinazione).</p>

        <div class="form-group">
          <label for="entityNaming">Tipo Denominazione Predefinita</label>
          <select id="entityNaming" bind:value={settings.entityNaming} class="form-select">
            <option value="luogo">Luogo (Luoghi)</option>
            <option value="cantiere">Cantiere (Cantieri)</option>
            <option value="sede">Sede Operativa (Sedi Operative)</option>
            <option value="destinazione">Destinazione (Destinazioni)</option>
            <option value="custom">Personalizzata...</option>
          </select>
        </div>

        {#if settings.entityNaming === 'custom'}
          <div class="form-row-2">
            <div class="form-group">
              <label for="customSingular">Nome Singolare</label>
              <input 
                type="text" 
                id="customSingular" 
                bind:value={settings.customSingularLabel} 
                placeholder="es. Punto Vendita" 
                class="form-input" 
              />
            </div>
            <div class="form-group">
              <label for="customPlural">Nome Plurale</label>
              <input 
                type="text" 
                id="customPlural" 
                bind:value={settings.customPluralLabel} 
                placeholder="es. Punti Vendita" 
                class="form-input" 
              />
            </div>
          </div>
        {/if}

        <div class="naming-preview">
          <span class="preview-label">Anteprima etichette UI:</span>
          <div class="preview-chips">
            <span class="chip">Singolare: <strong>{labels.singular}</strong></span>
            <span class="chip">Plurale: <strong>{labels.plural}</strong></span>
            <span class="chip">Pulsante: <strong>{labels.newBtn}</strong></span>
          </div>
        </div>
      </div>

      <!-- Card 2: Numerazione Automatica & Codice -->
      <div class="settings-card">
        <div class="card-header">
          <Hash size={20} class="card-icon" />
          <h2>Numerazione & Codice Identificativo</h2>
        </div>
        <p class="card-desc">Definisci il formato del codice univoco generato automaticamente.</p>

        <div class="form-group">
          <label for="prefix">Prefisso Codice</label>
          <input type="text" id="prefix" bind:value={settings.prefix} class="form-input" placeholder="es. LUG- o CANT-" />
        </div>

        <div class="form-row-2">
          <div class="form-group">
            <label for="numberPadding">Zeri di riempimento</label>
            <input type="number" id="numberPadding" bind:value={settings.numberPadding} min="1" max="6" class="form-input" />
          </div>

          <div class="form-group checkbox-group">
            <label class="checkbox-label">
              <input type="checkbox" bind:checked={settings.includeYear} />
              <span>Includi Anno Corrente nel codice</span>
            </label>
          </div>
        </div>
      </div>

      <!-- Card 3: Stati Predefiniti -->
      <div class="settings-card">
        <div class="card-header">
          <CheckCircle2 size={20} class="card-icon" />
          <h2>Stato Iniziale Predefinito</h2>
        </div>
        <p class="card-desc">Stato assegnato automaticamente ai nuovi luoghi creati.</p>

        <div class="form-group">
          <label for="defaultStatus">Stato Iniziale</label>
          <select id="defaultStatus" bind:value={settings.defaultStatus} class="form-select">
            <option value="attivo">Attivo</option>
            <option value="inattivo">Inattivo / Concluso</option>
          </select>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .settings-page-container {
    padding: 24px;
    max-width: 1000px;
    margin: 0 auto;
  }
  .settings-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
  }
  .header-title-group {
    display: flex;
    align-items: center;
    gap: 16px;
  }
  .header-icon-box {
    width: 48px;
    height: 48px;
    border-radius: 12px;
    background: var(--color-primary-50, #eff6ff);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .page-title {
    font-size: 20px;
    font-weight: 700;
    margin: 0;
    color: var(--color-neutral-900);
  }
  .page-subtitle {
    font-size: 13px;
    color: var(--color-neutral-500);
    margin: 4px 0 0 0;
  }
  .btn-save {
    display: flex;
    align-items: center;
    gap: 8px;
    background: var(--color-primary-600);
    color: white;
    padding: 10px 18px;
    border-radius: 8px;
    border: none;
    font-weight: 600;
    font-size: 14px;
    cursor: pointer;
    transition: background 0.2s;
  }
  .btn-save:hover:not(:disabled) {
    background: var(--color-primary-700);
  }
  .btn-save:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  .settings-grid {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
  .settings-card {
    background: white;
    border-radius: 12px;
    border: 1px solid var(--color-neutral-200);
    padding: 20px;
  }
  .card-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 6px;
  }
  .card-header h2 {
    font-size: 16px;
    font-weight: 600;
    margin: 0;
    color: var(--color-neutral-800);
  }
  .card-desc {
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
  .form-group label {
    font-size: 13px;
    font-weight: 500;
    color: var(--color-neutral-700);
  }
  .form-select, .form-input {
    padding: 10px 12px;
    border-radius: 8px;
    border: 1px solid var(--color-neutral-300);
    font-size: 14px;
  }
  .form-row-2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }
  .checkbox-group {
    justify-content: center;
  }
  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    cursor: pointer;
  }
  .naming-preview {
    background: var(--color-neutral-50);
    border-radius: 8px;
    padding: 12px;
    margin-top: 10px;
  }
  .preview-label {
    font-size: 12px;
    color: var(--color-neutral-500);
    display: block;
    margin-bottom: 6px;
  }
  .preview-chips {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }
  .chip {
    font-size: 12px;
    background: white;
    border: 1px solid var(--color-neutral-200);
    padding: 4px 10px;
    border-radius: 6px;
  }
</style>
