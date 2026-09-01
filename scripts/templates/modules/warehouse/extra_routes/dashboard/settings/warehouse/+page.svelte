<script lang="ts">
  import { onMount } from 'svelte';
  import { WarehouseSettingsService, DEFAULT_WAREHOUSE_SETTINGS } from '../../warehouse/warehouseSettingsService';
  import type { WarehouseSettings } from '../../warehouse/schema';
  import { toast } from '$lib/stores/toast.svelte';
  import { Warehouse, Save, RefreshCw, Hash, AlertTriangle, Settings, DollarSign, List } from '@lucide/svelte';

  let settings = $state<WarehouseSettings>({ ...DEFAULT_WAREHOUSE_SETTINGS });
  let loading = $state(true);
  let saving = $state(false);

  onMount(async () => {
    try {
      const s = await WarehouseSettingsService.getSettings();
      settings = { ...s };
    } catch (e) {
      console.error('Errore caricamento impostazioni magazzino:', e);
      toast.error('Impossibile caricare le impostazioni');
    } finally {
      loading = false;
    }
  });

  async function handleSave(e: Event) {
    e.preventDefault();
    saving = true;
    try {
      await WarehouseSettingsService.saveSettings(settings);
      toast.success('Impostazioni magazzino salvate con successo');
    } catch (err: any) {
      toast.error('Errore salvataggio: ' + err.message);
    } finally {
      saving = false;
    }
  }
</script>

<svelte:head>
  <title>Configurazione Magazzino & Acquisti - Gestoray</title>
</svelte:head>

<div class="settings-page-container">
  <!-- Page Top Actions Bar -->
  <div class="page-top-actions">
    <div class="header-left">
      <div class="title-row">
        <div class="icon-bubble">
          <Warehouse size={24} class="text-primary-600" />
        </div>
        <div>
          <h1 class="page-title">Configurazione Magazzino & Acquisti</h1>
          <p class="page-subtitle">Prefissi di numerazione, valorizzazione fiscale giacenze e regole sottoscorta</p>
        </div>
      </div>
    </div>

    <div class="header-right">
      <a href="/dashboard/settings" class="btn-module-list">
        <List size={16} />
        <span>Tutte le Impostazioni</span>
      </a>
    </div>
  </div>

  {#if loading}
    <div class="loading-state">
      <RefreshCw size={28} class="animate-spin text-primary-500" />
      <p>Caricamento impostazioni...</p>
    </div>
  {:else}
    <form onsubmit={handleSave} class="settings-form">
      <!-- Prefissi di Numerazione -->
      <div class="settings-card">
        <div class="card-header">
          <div class="card-icon-bubble">
            <Hash size={18} class="text-primary-600" />
          </div>
          <div>
            <h3 class="card-title">Prefissi di Numerazione Automatica</h3>
            <p class="card-desc">Personalizza i codici identificativi generati per ordini, movimenti e fornitori.</p>
          </div>
        </div>

        <div class="fields-grid">
          <div class="form-group">
            <label for="poPrefix">Prefisso Ordini Fornitore (PO)</label>
            <input type="text" id="poPrefix" bind:value={settings.poPrefix} class="form-input" placeholder="PO-" />
            <span class="field-help">Es: {settings.poPrefix}2026-0001</span>
          </div>

          <div class="form-group">
            <label for="movPrefix">Prefisso Movimentazioni</label>
            <input type="text" id="movPrefix" bind:value={settings.movementPrefix} class="form-input" placeholder="MOV-" />
            <span class="field-help">Es: {settings.movementPrefix}2026-1045</span>
          </div>

          <div class="form-group">
            <label for="supPrefix">Prefisso Codice Fornitori</label>
            <input type="text" id="supPrefix" bind:value={settings.supplierPrefix} class="form-input" placeholder="FOR-" />
            <span class="field-help">Es: {settings.supplierPrefix}0001</span>
          </div>
        </div>
      </div>

      <!-- Valorizzazione & Giacenze -->
      <div class="settings-card">
        <div class="card-header">
          <div class="card-icon-bubble">
            <DollarSign size={18} class="text-emerald-600" />
          </div>
          <div>
            <h3 class="card-title">Metodo di Valorizzazione & Regole Scorte</h3>
            <p class="card-desc">Definisci l'algoritmo di calcolo del costo merci e la tolleranza sulle giacenze.</p>
          </div>
        </div>

        <div class="fields-grid">
          <div class="form-group">
            <label for="valMethod">Metodo di Valorizzazione Primario</label>
            <select id="valMethod" bind:value={settings.valuationMethod} class="form-select">
              <option value="CMP">Costo Medio Ponderato (CMP - Consigliato)</option>
              <option value="FIFO">First-In, First-Out (FIFO a lotti)</option>
            </select>
            <span class="field-help">Determina il costo unitario attribuito alle merci in giacenza e agli scarichi.</span>
          </div>

          <div class="form-group">
            <label for="minThreshold">Soglia Predefinita Sottoscorta</label>
            <input type="number" id="minThreshold" bind:value={settings.defaultMinThreshold} min="0" step="1" class="form-input" />
            <span class="field-help">Valore minimo di unità per attivare l'alert di riordino.</span>
          </div>

          <div class="form-group col-span-2">
            <div class="checkbox-group">
              <input type="checkbox" id="allowNeg" bind:checked={settings.allowNegativeStock} class="form-checkbox" />
              <div>
                <label for="allowNeg" class="cursor-pointer font-semibold text-slate-800">Consenti Giacenze Negative</label>
                <p class="checkbox-desc">Se abilitato, permette lo scarico di magazzino anche se la disponibilità è zero (utile per retail o cantieri con registrazione differita).</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="form-actions">
        <button type="submit" class="btn-primary" disabled={saving}>
          {#if saving}
            <RefreshCw size={16} class="animate-spin" />
            <span>Salvataggio...</span>
          {:else}
            <Save size={16} />
            <span>Salva Impostazioni</span>
          {/if}
        </button>
      </div>
    </form>
  {/if}
</div>

<style>
  .settings-page-container {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .page-top-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 1rem;
  }

  .header-left .title-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .icon-bubble {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    background: var(--color-primary-50, #eff6ff);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .page-title {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--color-slate-900, #0f172a);
    margin: 0;
  }

  .page-subtitle {
    font-size: 0.875rem;
    color: var(--color-slate-500, #64748b);
    margin: 0.125rem 0 0 0;
  }

  .btn-module-list {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.5rem 0.875rem;
    border-radius: 8px;
    border: 1px solid var(--color-slate-300, #cbd5e1);
    background: #ffffff;
    color: var(--color-slate-700, #334155);
    font-size: 0.875rem;
    font-weight: 500;
    text-decoration: none;
  }

  .settings-form {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .settings-card {
    background: #ffffff;
    border-radius: 12px;
    border: 1px solid var(--color-slate-200, #e2e8f0);
    padding: 1.5rem 2rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .card-header {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid var(--color-slate-100, #f1f5f9);
  }

  .card-icon-bubble {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    background: var(--color-slate-100, #f1f5f9);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .card-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--color-slate-800, #1e293b);
    margin: 0;
  }

  .card-desc {
    font-size: 0.8125rem;
    color: var(--color-slate-500, #64748b);
    margin: 0.125rem 0 0 0;
  }

  .fields-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: 1.25rem;
  }

  .col-span-2 { grid-column: span 2; }
  @media (max-width: 640px) { .col-span-2 { grid-column: span 1; } }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .form-group label {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--color-slate-700, #334155);
  }

  .field-help {
    font-size: 0.75rem;
    color: var(--color-slate-400, #94a3b8);
  }

  .form-input, .form-select {
    width: 100%;
    padding: 0.625rem 0.875rem;
    border-radius: 8px;
    border: 1px solid var(--color-slate-300, #cbd5e1);
    font-size: 0.875rem;
    color: var(--color-slate-900, #0f172a);
    background: #ffffff;
  }

  .checkbox-group {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 1rem;
    background: var(--color-slate-50, #f8fafc);
    border-radius: 8px;
    border: 1px solid var(--color-slate-200, #e2e8f0);
  }

  .form-checkbox {
    width: 18px;
    height: 18px;
    margin-top: 0.125rem;
  }

  .checkbox-desc {
    font-size: 0.75rem;
    color: var(--color-slate-500, #64748b);
    margin: 0.25rem 0 0 0;
  }

  .form-actions {
    display: flex;
    justify-content: flex-end;
  }

  .btn-primary {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1.25rem;
    background: var(--color-primary-600, #2563eb);
    color: #ffffff;
    border-radius: 8px;
    font-weight: 600;
    font-size: 0.875rem;
    border: none;
    cursor: pointer;
  }

  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4rem 2rem;
    text-align: center;
    gap: 0.75rem;
    color: var(--color-slate-500, #64748b);
  }
</style>
