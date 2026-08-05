<script lang="ts">
  import { projectStore } from '$lib/stores/project';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { ProductsService } from '../products.service';
  import { CustomFieldsService } from '$lib/services/customFieldsService';
  import { UnitsOfMeasureService, type UnitOfMeasure } from '$lib/services/unitsOfMeasureService';
  import { ProductSettingsService, type ProductFieldsSettings, DEFAULT_PRODUCT_FIELDS_SETTINGS } from '$lib/services/productSettingsService';
  import type { CustomFieldDefinition, CustomFieldValues } from '$lib/types/customFields';
  import CustomFieldsRenderer from '$lib/components/CustomFieldsRenderer.svelte';
  import { toast } from '$lib/stores/toast.svelte';
  import { ArrowLeft, Package, Info, SlidersHorizontal, Save, AlertCircle, Zap } from '@lucide/svelte';

  let customFieldsList = $state<CustomFieldDefinition[]>([]);
  let customFieldsValues = $state<CustomFieldValues>({});
  let unitsCatalog = $state<UnitOfMeasure[]>([]);
  let fieldSettings = $state<ProductFieldsSettings>({ ...DEFAULT_PRODUCT_FIELDS_SETTINGS });

  let loading = $state(true);
  let saving = $state(false);
  let errorMsg = $state('');

  // Form State
  let sku = $state(`ART-${Math.floor(1000 + Math.random() * 9000)}`);
  let name = $state('');
  let category = $state('Ricambi');
  let price = $state<number>(25);
  let unit = $state('pz');
  let stockQty = $state<number>(10);
  let description = $state('');

  // Minimo Fatturabile State
  let minimoEnabled = $state(false);
  let minQuantity = $state<number | null>(20);
  let flatPrice = $state<number | null>(7000);
  let displayText = $state('');

  onMount(async () => {
    try {
      const [fields, units, loadedSettings] = await Promise.all([
        CustomFieldsService.getFieldsForModule('products'),
        UnitsOfMeasureService.getUnits(),
        ProductSettingsService.getSettings()
      ]);
      customFieldsList = fields;
      unitsCatalog = units;
      fieldSettings = loadedSettings;
    } catch (e) {
      console.error('Errore caricamento dati prodotti:', e);
    } finally {
      loading = false;
    }
  });

  $effect(() => {
    if (minimoEnabled && minQuantity && flatPrice && !displayText) {
      displayText = `Sotto i ${minQuantity} ${unit} ${flatPrice}€`;
    }
  });

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();

    if (!name.trim()) {
      errorMsg = 'Compila il nome dell\'articolo.';
      return;
    }

    if (fieldSettings.sku.visible && fieldSettings.sku.required && !sku.trim()) {
      errorMsg = 'Il Codice SKU è obbligatorio.';
      return;
    }

    saving = true;
    errorMsg = '';

    try {
      const finalSku = sku.trim() || `ART-${Date.now().toString().slice(-6)}`;

      const prodId = await ProductsService.createProduct({
        sku: finalSku,
        name: name.trim(),
        category: fieldSettings.category.visible ? category.trim() : '',
        price,
        unit,
        stockQty: fieldSettings.stockQty.visible ? stockQty : 0,
        description: fieldSettings.description.visible ? description.trim() : '',
        minimoFatturabile: (fieldSettings.minimoFatturabile.visible && minimoEnabled) ? {
          enabled: true,
          minQuantity: minQuantity ? Number(minQuantity) : null,
          flatPrice: flatPrice ? Number(flatPrice) : null,
          displayText: displayText.trim() || (minQuantity && flatPrice ? `Sotto i ${minQuantity} ${unit} ${flatPrice}€` : '')
        } : undefined,
        customFields: customFieldsValues
      });

      toast.success('Prodotto aggiunto al catalogo con successo!');
      goto(`/dashboard/products/${prodId}`);
    } catch (err: any) {
      console.error('Errore salvataggio prodotto:', err);
      errorMsg = err.message || 'Errore durante la creazione del prodotto.';
    } finally {
      saving = false;
    }
  }
</script>

<svelte:head>
  <title>Nuovo Articolo | {$projectStore?.projectName || 'ERP'}</title>
</svelte:head>

<div class="add-product-page animate-fade-in">
  <div class="page-top">
    <a href="/dashboard/products" class="back-link">
      <ArrowLeft size={14} /> Torna al Catalogo Prodotti
    </a>
    <h2>
      <Package size={22} class="header-icon" /> Aggiungi Articolo al Catalogo
    </h2>
  </div>

  {#if loading}
    <div class="loader-box">
      <span class="spinner"></span>
      Caricamento in corso...
    </div>
  {:else}
    {#if errorMsg}
      <div class="alert error-box">
        <AlertCircle size={16} /> {errorMsg}
      </div>
    {/if}

    <form onsubmit={handleSubmit} class="product-form">
      <!-- 1. INFORMAZIONI ARTICOLO -->
      <div class="card form-card">
        <div class="card-header">
          <h3 class="card-title">
            <Info size={18} /> Anagrafica Articolo
          </h3>
          <p class="card-subtitle">Denominazione, codice e dettagli principali.</p>
        </div>

        <div class="grid-2 mb-16">
          {#if fieldSettings.sku.visible}
            <div class="form-group">
              <label for="prod-sku">
                Codice SKU / Codice Articolo {fieldSettings.sku.required ? '*' : '(Opzionale)'}
              </label>
              <input 
                id="prod-sku" 
                type="text" 
                bind:value={sku} 
                required={fieldSettings.sku.required} 
                class="form-control" 
                placeholder="es. ART-001"
              />
            </div>
          {/if}

          {#if fieldSettings.category.visible}
            <div class="form-group">
              <label for="prod-category">Categoria</label>
              <select id="prod-category" bind:value={category} class="form-control">
                <option value="Ricambi">Ricambi & Componenti</option>
                <option value="Materiale Elettrico">Materiale Elettrico</option>
                <option value="Materiale Idraulico">Materiale Idraulico</option>
                <option value="Materiale di Consumo">Materiale di Consumo</option>
                <option value="Alleggeriti">Alleggeriti</option>
                <option value="Servizi & Manodopera">Servizi & Manodopera</option>
              </select>
            </div>
          {/if}
        </div>

        <div class="form-group mb-16">
          <label for="prod-name">Nome / Denominazione Articolo *</label>
          <input id="prod-name" type="text" bind:value={name} placeholder="es. Alleggerito Gmix 43 EVO" required class="form-control" />
        </div>

        <div class="grid-3 mb-16">
          <div class="form-group">
            <label for="prod-price">Prezzo Unitario (€) *</label>
            <input id="prod-price" type="number" step="0.01" bind:value={price} required class="form-control" />
          </div>

          <div class="form-group">
            <label for="prod-unit">Unità di Misura</label>
            <select id="prod-unit" bind:value={unit} class="form-control">
              {#each unitsCatalog as u (u.code)}
                <option value={u.code}>{u.label}</option>
              {/each}
            </select>
          </div>

          {#if fieldSettings.stockQty.visible}
            <div class="form-group">
              <label for="prod-stock">Giacenza Iniziale</label>
              <input id="prod-stock" type="number" step={UnitsOfMeasureService.getStepForUnit(unit)} bind:value={stockQty} class="form-control" />
            </div>
          {/if}
        </div>

        {#if fieldSettings.description.visible}
          <div class="form-group">
            <label for="prod-desc">Descrizione & Specifiche Tecniche</label>
            <textarea id="prod-desc" bind:value={description} rows="3" placeholder="Specifiche, dimensioni o note tecniche..." class="form-control"></textarea>
          </div>
        {/if}
      </div>

      <!-- 2. MINIMO FATTURABILE -->
      {#if fieldSettings.minimoFatturabile.visible}
        <div class="card form-card">
          <div class="card-header flex-between">
            <div>
              <h3 class="card-title">
                <Zap size={18} class="icon-amber" /> Minimo Fatturabile
              </h3>
              <p class="card-subtitle">Condizione matematica e tariffa fissa applicata sotto la quantità minima.</p>
            </div>
            <label class="toggle-switch" title="Abilita Minimo Fatturabile">
              <input type="checkbox" bind:checked={minimoEnabled} />
              <span class="slider"></span>
            </label>
          </div>

          {#if minimoEnabled}
            <div class="grid-3 mb-16 animate-fade-in">
              <div class="form-group">
                <label for="min-qty">Quantità Soglia (Sotto i...)</label>
                <div class="input-with-addon">
                  <input id="min-qty" type="number" step="0.01" bind:value={minQuantity} placeholder="es. 20" class="form-control" />
                  <span class="addon">{unit}</span>
                </div>
              </div>

              <div class="form-group">
                <label for="min-price">Prezzo Minimo Fisso (€)</label>
                <input id="min-price" type="number" step="0.01" bind:value={flatPrice} placeholder="es. 7000" class="form-control" />
              </div>

              <div class="form-group">
                <label for="min-display">Descrizione / Note Fatturazione</label>
                <input id="min-display" type="text" bind:value={displayText} placeholder="es. Sotto i 20 mc 7000€" class="form-control" />
              </div>
            </div>
          {/if}
        </div>
      {/if}

      <!-- 3. CAMPI PERSONALIZZATI -->
      {#if customFieldsList.length > 0}
        <div class="card form-card">
          <div class="card-header">
            <h3 class="card-title">
              <SlidersHorizontal size={18} /> Campi Personalizzati
            </h3>
          </div>
          <CustomFieldsRenderer fields={customFieldsList} bind:values={customFieldsValues} />
        </div>
      {/if}

      <!-- FORM ACTIONS -->
      <div class="form-actions-bar">
        <a href="/dashboard/products" class="btn-cancel">Annulla</a>
        <button type="submit" class="btn-submit" disabled={saving}>
          <Save size={16} /> {saving ? 'Salvataggio...' : 'Salva Articolo'}
        </button>
      </div>
    </form>
  {/if}
</div>

<style>
  .add-product-page { width: 100%; box-sizing: border-box; display: flex; flex-direction: column; gap: 1.5rem; }
  .page-top { display: flex; flex-direction: column; gap: 0.4rem; }
  .back-link { color: var(--color-neutral-500); font-size: 0.85rem; text-decoration: none; font-weight: 600; display: inline-flex; align-items: center; gap: 6px; }
  .back-link:hover { color: var(--color-primary-600); }
  h2 { font-size: 1.5rem; font-weight: 800; margin: 0; color: var(--color-neutral-900); display: flex; align-items: center; gap: 8px; }
  :global(.header-icon) { color: var(--color-primary-500); }
  :global(.icon-amber) { color: #d97706; }

  .product-form { display: flex; flex-direction: column; gap: 1.5rem; }
  .card { background: white; border: 1px solid var(--color-neutral-200); border-radius: var(--radius-lg); padding: 1.5rem; box-shadow: var(--shadow-sm); }
  .card-header { margin-bottom: 1.2rem; border-bottom: 1px solid var(--color-neutral-100); padding-bottom: 0.8rem; }
  .flex-between { display: flex; justify-content: space-between; align-items: center; }
  .card-title { font-size: 1.1rem; font-weight: 700; margin: 0; color: var(--color-neutral-900); display: flex; align-items: center; gap: 8px; }
  .card-subtitle { font-size: 0.82rem; color: var(--color-neutral-500); margin: 0.2rem 0 0 0; }

  .form-group { display: flex; flex-direction: column; gap: 0.4rem; }
  .form-group label { font-size: 0.82rem; font-weight: 700; color: var(--color-neutral-700); }
  .form-control { padding: 0.65rem 0.9rem; border: 1px solid var(--color-neutral-300); border-radius: var(--radius-md); font-size: 0.9rem; outline: none; box-sizing: border-box; width: 100%; }
  .form-control:focus { border-color: var(--color-primary-600); box-shadow: 0 0 0 3px var(--color-primary-100); }

  .input-with-addon { display: flex; align-items: center; position: relative; }
  .input-with-addon input { padding-right: 3rem; }
  .addon { position: absolute; right: 0.8rem; font-size: 0.82rem; font-weight: 700; color: var(--color-neutral-500); background: var(--color-neutral-100); padding: 0.2rem 0.5rem; border-radius: var(--radius-sm); pointer-events: none; }

  /* TOGGLE SWITCH */
  .toggle-switch { position: relative; display: inline-block; width: 44px; height: 24px; cursor: pointer; }
  .toggle-switch input { opacity: 0; width: 0; height: 0; }
  .slider { position: absolute; top: 0; left: 0; right: 0; bottom: 0; background-color: var(--color-neutral-300); transition: .3s; border-radius: 24px; }
  .slider:before { position: absolute; content: ""; height: 18px; width: 18px; left: 3px; bottom: 3px; background-color: white; transition: .3s; border-radius: 50%; }
  input:checked + .slider { background-color: var(--color-primary-600); }
  input:checked + .slider:before { transform: translateX(20px); }

  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
  .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem; }
  @media (max-width: 640px) { .grid-2, .grid-3 { grid-template-columns: 1fr; } }

  .mb-16 { margin-bottom: 1rem; }

  .form-actions-bar { display: flex; justify-content: flex-end; align-items: center; gap: 1rem; padding-top: 1rem; }
  .btn-cancel { color: var(--color-neutral-600); text-decoration: none; font-size: 0.9rem; font-weight: 600; }
  .btn-submit { background: var(--color-primary-600); color: white; border: none; padding: 0.7rem 1.5rem; border-radius: var(--radius-md); font-weight: 700; font-size: 0.9rem; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; }
  .btn-submit:disabled { opacity: 0.6; cursor: not-allowed; }

  .alert { padding: 0.8rem 1rem; border-radius: var(--radius-md); font-size: 0.88rem; font-weight: 600; display: flex; align-items: center; gap: 8px; }
  .error-box { background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; }
  .loader-box { text-align: center; padding: 3rem; background: white; border-radius: var(--radius-lg); border: 1px solid var(--color-neutral-200); }
</style>
