<script lang="ts">
  import { onMount } from 'svelte';
  import { 
    ProductSettingsService, 
    DEFAULT_PRODUCT_FIELDS_SETTINGS, 
    type ProductFieldsSettings 
  } from '$lib/services/productSettingsService';
  import { toast } from '$lib/stores/toast.svelte';
  import { pageTitle } from '$lib/stores/page';
  import { 
    Package, 
    Save, 
    Settings, 
    Check, 
    Info, 
    Sliders,
    Barcode,
    Layers,
    Boxes,
    Receipt,
    FileText
  } from '@lucide/svelte';

  pageTitle.set('Impostazioni Scheda Prodotto');

  let settings = $state<ProductFieldsSettings>({ ...DEFAULT_PRODUCT_FIELDS_SETTINGS });
  let loading = $state(true);
  let saving = $state(false);

  onMount(async () => {
    try {
      settings = await ProductSettingsService.getSettings();
    } catch (err) {
      toast.error('Errore durante il caricamento delle impostazioni');
    } finally {
      loading = false;
    }
  });

  async function handleSave() {
    saving = true;
    try {
      await ProductSettingsService.saveSettings(settings);
      toast.success('Impostazioni campi prodotto salvate con successo!');
    } catch (err) {
      console.error(err);
      toast.error('Impossibile salvare le impostazioni');
    } finally {
      saving = false;
    }
  }
</script>

<div class="settings-container animate-fade-in">
  <!-- HEADER -->
  <div class="page-top-actions">
    <div>
      <a href="/dashboard/settings" class="btn-module-list" title="Vai a Impostazioni" aria-label="Vai a Impostazioni">
        <Settings size={20} />
      </a>
      <h2 class="title-header">
        <Package size={28} color="var(--color-primary-600)" />
        Configurazione Campi Scheda Prodotto
      </h2>
      <p class="subtitle">
        Scegli quali campi rendere visibili ed obbligatori nei form di Aggiunta/Modifica e nelle tabelle del catalogo.
      </p>
    </div>
    <div class="actions">
      <button type="button" class="btn btn-primary" onclick={handleSave} disabled={saving || loading}>
        <Save size={18} />
        {saving ? 'Salvataggio...' : 'Salva Impostazioni'}
      </button>
    </div>
  </div>

  {#if loading}
    <div class="loading-state">
      <div class="spinner"></div>
      <p>Caricamento configurazione...</p>
    </div>
  {:else}
    <div class="settings-grid">
      <!-- SKU / CODICE ARTICOLO -->
      <div class="setting-card">
        <div class="card-header">
          <div class="icon-badge primary">
            <Barcode size={22} />
          </div>
          <div>
            <h3>Codice SKU / Articolo</h3>
            <p>Identificativo univoco del prodotto (es. ART-001)</p>
          </div>
        </div>
        <div class="card-body">
          <label class="toggle-control">
            <input type="checkbox" bind:checked={settings.sku.visible} />
            <span class="toggle-slider"></span>
            <span class="toggle-label">Mostra campo Codice SKU nei form e nelle tabelle</span>
          </label>

          {#if settings.sku.visible}
            <div class="sub-option">
              <label class="toggle-control">
                <input type="checkbox" bind:checked={settings.sku.required} />
                <span class="toggle-slider"></span>
                <span class="toggle-label">Rendi il Codice SKU obbligatorio (Se disattivato, è opzionale)</span>
              </label>
            </div>
          {/if}
        </div>
      </div>

      <!-- GIACENZA MAGAZZINO -->
      <div class="setting-card">
        <div class="card-header">
          <div class="icon-badge info">
            <Boxes size={22} />
          </div>
          <div>
            <h3>Giacenza Magazzino</h3>
            <p>Quantità disponibile in magazzino per l'articolo</p>
          </div>
        </div>
        <div class="card-body">
          <label class="toggle-control">
            <input type="checkbox" bind:checked={settings.stockQty.visible} />
            <span class="toggle-slider"></span>
            <span class="toggle-label">Mostra campo Giacenza Magazzino nei form e nel catalogo</span>
          </label>
        </div>
      </div>

      <!-- MINIMO FATTURABILE -->
      <div class="setting-card">
        <div class="card-header">
          <div class="icon-badge warning">
            <Receipt size={22} />
          </div>
          <div>
            <h3>Minimo Fatturabile</h3>
            <p>Soglia minima di ore o quantità fatturabili per l'articolo</p>
          </div>
        </div>
        <div class="card-body">
          <label class="toggle-control">
            <input type="checkbox" bind:checked={settings.minimoFatturabile.visible} />
            <span class="toggle-slider"></span>
            <span class="toggle-label">Mostra campo Minimo Fatturabile nei form, nel catalogo e nel dettaglio</span>
          </label>
        </div>
      </div>

      <!-- CATEGORIA -->
      <div class="setting-card">
        <div class="card-header">
          <div class="icon-badge success">
            <Layers size={22} />
          </div>
          <div>
            <h3>Categoria Prodotto</h3>
            <p>Raggruppamento per tipologia (es. Hardware, Servizi, Consulenza)</p>
          </div>
        </div>
        <div class="card-body">
          <label class="toggle-control">
            <input type="checkbox" bind:checked={settings.category.visible} />
            <span class="toggle-slider"></span>
            <span class="toggle-label">Mostra campo Categoria nei form e nel catalogo</span>
          </label>
        </div>
      </div>

      <!-- DESCRIZIONE -->
      <div class="setting-card">
        <div class="card-header">
          <div class="icon-badge neutral">
            <FileText size={22} />
          </div>
          <div>
            <h3>Descrizione Estesa</h3>
            <p>Note e dettagli estesi del prodotto/servizio</p>
          </div>
        </div>
        <div class="card-body">
          <label class="toggle-control">
            <input type="checkbox" bind:checked={settings.description.visible} />
            <span class="toggle-slider"></span>
            <span class="toggle-label">Mostra campo Descrizione nei form e nella scheda dettaglio</span>
          </label>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .settings-products-page {
    width: 100%;
    box-sizing: border-box;
    padding: 1.5rem;
  }

  .page-top-actions {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 2rem;
  }

  .btn-back {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--color-neutral-600);
    text-decoration: none;
    font-size: 0.875rem;
    font-weight: 500;
    margin-bottom: 0.75rem;
    transition: color 0.2s;
  }

  .btn-back:hover {
    color: var(--color-primary-600);
  }

  .title-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--color-neutral-900);
    margin: 0 0 0.35rem 0;
  }

  .subtitle {
    color: var(--color-neutral-600);
    font-size: 0.95rem;
    margin: 0;
  }

  .settings-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(480px, 1fr));
    gap: 1.5rem;
  }

  .setting-card {
    background: #ffffff;
    border: 1px solid var(--color-neutral-200, #e2e8f0);
    border-radius: 12px;
    padding: 1.5rem;
    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .card-header {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .card-header h3 {
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--color-neutral-900);
    margin: 0 0 0.25rem 0;
  }

  .card-header p {
    font-size: 0.85rem;
    color: var(--color-neutral-500);
    margin: 0;
  }

  .icon-badge {
    width: 44px;
    height: 44px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .icon-badge.primary { background: #eff6ff; color: #2563eb; }
  .icon-badge.info { background: #f0fdf4; color: #16a34a; }
  .icon-badge.warning { background: #fffbeb; color: #d97706; }
  .icon-badge.success { background: #f0fdf4; color: #16a34a; }
  .icon-badge.neutral { background: #f8fafc; color: #64748b; }

  .card-body {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .toggle-control {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    cursor: pointer;
    user-select: none;
  }

  .toggle-control input[type="checkbox"] {
    display: none;
  }

  .toggle-slider {
    width: 42px;
    height: 24px;
    background-color: var(--color-neutral-300, #cbd5e1);
    border-radius: 24px;
    position: relative;
    transition: background-color 0.2s;
    flex-shrink: 0;
  }

  .toggle-slider::before {
    content: '';
    position: absolute;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background-color: white;
    top: 3px;
    left: 3px;
    transition: transform 0.2s;
  }

  .toggle-control input:checked + .toggle-slider {
    background-color: var(--color-primary-600, #2563eb);
  }

  .toggle-control input:checked + .toggle-slider::before {
    transform: translateX(18px);
  }

  .toggle-label {
    font-size: 0.925rem;
    font-weight: 500;
    color: var(--color-neutral-800);
  }

  .sub-option {
    margin-left: 2.75rem;
    padding-top: 0.5rem;
    border-top: 1px dashed var(--color-neutral-200);
  }

  .btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.65rem 1.25rem;
    border-radius: 8px;
    font-weight: 600;
    font-size: 0.9rem;
    cursor: pointer;
    border: none;
    transition: all 0.2s;
  }

  .btn-primary {
    background-color: var(--color-primary-600, #2563eb);
    color: white;
  }

  .btn-primary:hover {
    background-color: var(--color-primary-700, #1d4ed8);
  }

  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4rem;
    gap: 1rem;
    color: var(--color-neutral-600);
  }

  .spinner {
    width: 36px;
    height: 36px;
    border: 3px solid var(--color-neutral-200);
    border-top-color: var(--color-primary-600);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  @media (max-width: 640px) {
    .settings-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
