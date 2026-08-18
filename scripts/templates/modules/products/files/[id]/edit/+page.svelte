<script lang="ts">
  import { projectStore } from '$lib/stores/project';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { authState } from '$lib/auth.svelte';
  import { ProductsService } from '../../products.service';
  import type { ProductItem, ProductType, BillingType, RecurrenceInterval } from '../../schema';
  import { CustomFieldsService } from '$lib/services/customFieldsService';
  import { UnitsOfMeasureService, type UnitOfMeasure } from '$lib/services/unitsOfMeasureService';
  import { ProductSettingsService, type ProductFieldsSettings, DEFAULT_PRODUCT_FIELDS_SETTINGS } from '$lib/services/productSettingsService';
  import type { CustomFieldDefinition, CustomFieldValues } from '$lib/types/customFields';
  import CustomFieldsRenderer from '$lib/components/CustomFieldsRenderer.svelte';
  import { toast } from '$lib/stores/toast.svelte';
  import { 
    List, 
    Pencil, 
    Package, 
    Briefcase, 
    Zap, 
    Info, 
    SlidersHorizontal, 
    Save, 
    AlertCircle, 
    Boxes, 
    CreditCard, 
    CheckCircle2 
  } from '@lucide/svelte';

  let productId = $derived($page.params.id);
  let product = $state<ProductItem | null>(null);

  let customFieldsList = $state<CustomFieldDefinition[]>([]);
  let customFieldsValues = $state<CustomFieldValues>({});
  let unitsCatalog = $state<UnitOfMeasure[]>([]);
  let fieldSettings = $state<ProductFieldsSettings>({ ...DEFAULT_PRODUCT_FIELDS_SETTINGS });

  let loading = $state(true);
  let saving = $state(false);
  let errorMsg = $state('');

  // Form State - Identity & Type
  let productType = $state<ProductType>('product');
  let sku = $state('');
  let name = $state('');
  let category = $state('Ricambi');
  let price = $state<number>(0);
  let unit = $state('pz');
  let description = $state('');

  // Stock Management (Decoupled)
  let trackStock = $state(true);
  let stockQty = $state<number>(0);
  let minStockThreshold = $state<number>(0);
  let allowOutOfStockSale = $state(true);

  // Billing Model
  let billingType = $state<BillingType>('one_off');
  let recurrenceInterval = $state<RecurrenceInterval>('monthly');

  // Minimo Fatturabile State
  let minimoEnabled = $state(false);
  let minQuantity = $state<number | null>(20);
  let flatPrice = $state<number | null>(7000);
  let displayText = $state('');

  function handleTypeSelect(type: ProductType) {
    productType = type;
    if (type === 'product') {
      if (!trackStock) trackStock = true;
      if (unit === 'ora' || unit === 'licenza') unit = 'pz';
    } else if (type === 'service') {
      trackStock = false;
      if (unit === 'pz') unit = 'ora';
      if (billingType === 'one_off') billingType = 'hourly';
    } else if (type === 'digital') {
      trackStock = false;
    }
  }

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

      if (productId) {
        product = await ProductsService.getProductById(productId);
        if (product) {
          productType = product.type || 'product';
          sku = product.sku || '';
          name = product.name || '';
          category = product.category || 'Ricambi';
          price = product.price || 0;
          unit = product.unit || 'pz';
          
          trackStock = product.trackStock !== undefined ? product.trackStock : (productType === 'product');
          stockQty = product.stockQty || 0;
          minStockThreshold = product.minStockThreshold || 0;
          allowOutOfStockSale = product.allowOutOfStockSale !== undefined ? product.allowOutOfStockSale : true;

          billingType = product.billingType || (productType === 'service' ? 'hourly' : 'one_off');
          recurrenceInterval = product.recurrenceInterval || 'monthly';

          description = product.description || '';
          customFieldsValues = product.customFields ? { ...product.customFields } : {};

          const mf = ProductsService.parseMinimoFatturabile(product.minimoFatturabile);
          if (mf) {
            minimoEnabled = mf.enabled !== false;
            minQuantity = mf.minQuantity ?? null;
            flatPrice = mf.flatPrice ?? null;
            displayText = mf.displayText || '';
          }
        }
      }
    } catch (e) {
      console.error('Errore caricamento dati modifica prodotto:', e);
    } finally {
      loading = false;
    }
  });

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();

    if (!productId || !name.trim()) {
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
      const tenantId = (authState.user as any)?.tenantId || 'default';

      await ProductsService.updateProduct(productId, {
        sku: sku.trim(),
        name: name.trim(),
        type: productType,
        category: fieldSettings.category.visible ? category.trim() : '',
        price: Number(price) || 0,
        unit,
        trackStock,
        stockQty: trackStock ? (Number(stockQty) || 0) : (product?.stockQty ?? 0),
        minStockThreshold: trackStock ? (Number(minStockThreshold) || 0) : 0,
        allowOutOfStockSale,
        billingType,
        recurrenceInterval: billingType === 'recurring' ? recurrenceInterval : undefined,
        description: fieldSettings.description.visible ? description.trim() : '',
        minimoFatturabile: (fieldSettings.minimoFatturabile.visible && minimoEnabled) ? {
          enabled: true,
          minQuantity: minQuantity ? Number(minQuantity) : null,
          flatPrice: flatPrice ? Number(flatPrice) : null,
          displayText: displayText.trim() || (minQuantity && flatPrice ? `Sotto i ${minQuantity} ${unit} ${flatPrice}€` : '')
        } : { enabled: false },
        customFields: customFieldsValues
      }, {
        uid: authState.user?.uid || 'system',
        userEmail: authState.user?.email || undefined,
        tenantId,
        expectedBaseVersion: (product as any)?.edits?.aggregateVersion ?? 0,
        reason: 'Modifica scheda articolo catalogo'
      });

      toast.success('Articolo aggiornato con successo!');
      goto(`/dashboard/products/${productId}`);
    } catch (err: any) {
      console.error('Errore salvataggio articolo:', err);
      errorMsg = err.message || 'Errore durante il salvataggio delle modifiche.';
    } finally {
      saving = false;
    }
  }
</script>

<svelte:head>
  <title>Modifica Articolo | {$projectStore?.projectName || 'ERP'}</title>
</svelte:head>

<div class="add-product-page animate-fade-in">
  <div class="page-top">
    <a href="/dashboard/products" class="btn-module-list" title="Vai al catalogo prodotti" aria-label="Vai al catalogo prodotti">
      <List size={20} />
    </a>
    <h2>
      <Pencil size={22} class="header-icon" /> Modifica Articolo Catalogo
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
      <!-- 1. TIPO ARTICOLO (SELECTOR CARDS) -->
      <div class="card form-card">
        <div class="card-header">
          <h3 class="card-title">
            <Boxes size={18} /> Tipologia Articolo
          </h3>
          <p class="card-subtitle">Natura dell'articolo nel catalogo aziendale.</p>
        </div>

        <div class="type-cards-grid">
          <button 
            type="button" 
            class="type-card {productType === 'product' ? 'active' : ''}" 
            onclick={() => handleTypeSelect('product')}
          >
            <div class="type-card-icon product-color">
              <Package size={24} />
            </div>
            <div class="type-card-content">
              <div class="type-card-title">Prodotto Fisico / Ricambio</div>
              <div class="type-card-desc">Beni materiali con tracciamento di giacenza a magazzino, sottoscorta e unità fisica.</div>
            </div>
            {#if productType === 'product'}
              <CheckCircle2 size={18} class="check-badge" />
            {/if}
          </button>

          <button 
            type="button" 
            class="type-card {productType === 'service' ? 'active' : ''}" 
            onclick={() => handleTypeSelect('service')}
          >
            <div class="type-card-icon service-color">
              <Briefcase size={24} />
            </div>
            <div class="type-card-content">
              <div class="type-card-title">Prestazione di Servizio</div>
              <div class="type-card-desc">Attività professionali, manodopera o consulenze senza giacenza fisica (a ore o a corpo).</div>
            </div>
            {#if productType === 'service'}
              <CheckCircle2 size={18} class="check-badge" />
            {/if}
          </button>

          <button 
            type="button" 
            class="type-card {productType === 'digital' ? 'active' : ''}" 
            onclick={() => handleTypeSelect('digital')}
          >
            <div class="type-card-icon digital-color">
              <Zap size={24} />
            </div>
            <div class="type-card-content">
              <div class="type-card-title">Bene Digitale / Licenza</div>
              <div class="type-card-desc">Software, abbonamenti o beni immateriali con erogazione digitale immediata.</div>
            </div>
            {#if productType === 'digital'}
              <CheckCircle2 size={18} class="check-badge" />
            {/if}
          </button>
        </div>
      </div>

      <!-- 2. ANAGRAFICA ARTICOLO -->
      <div class="card form-card">
        <div class="card-header">
          <h3 class="card-title">
            <Info size={18} /> Dettagli Anagrafici
          </h3>
          <p class="card-subtitle">Denominazione, codice univoco e classificazione.</p>
        </div>

        <div class="grid-2 mb-16">
          {#if fieldSettings.sku.visible}
            <div class="form-group">
              <label for="prod-sku">
                Codice SKU / Articolo {fieldSettings.sku.required ? '*' : '(Opzionale)'}
              </label>
              <input 
                id="prod-sku" 
                type="text" 
                bind:value={sku} 
                required={fieldSettings.sku.required} 
                class="form-control font-mono" 
                placeholder="es. ART-001"
              />
            </div>
          {/if}

          {#if fieldSettings.category.visible}
            <div class="form-group">
              <label for="prod-category">Categoria</label>
              <input 
                id="prod-category" 
                type="text" 
                bind:value={category} 
                class="form-control" 
                placeholder="es. Ricambi, Consulenza, Impianti..." 
                list="category-suggestions"
              />
              <datalist id="category-suggestions">
                <option value="Ricambi & Componenti"></option>
                <option value="Materiale Elettrico"></option>
                <option value="Materiale Idraulico"></option>
                <option value="Materiale di Consumo"></option>
                <option value="Servizi & Manodopera"></option>
                <option value="Consulenza Tecnica"></option>
                <option value="Software & Licenze"></option>
              </datalist>
            </div>
          {/if}
        </div>

        <div class="form-group mb-16">
          <label for="prod-name">Nome / Denominazione Articolo *</label>
          <input 
            id="prod-name" 
            type="text" 
            bind:value={name} 
            placeholder={productType === 'service' ? 'es. Manutenzione Impianto Oraria' : 'es. Alleggerito Gmix 43 EVO'} 
            required 
            class="form-control" 
          />
        </div>

        <div class="grid-2 mb-16">
          <div class="form-group">
            <label for="prod-price">Prezzo Listino / Base (€) *</label>
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
        </div>

        {#if fieldSettings.description.visible}
          <div class="form-group">
            <label for="prod-desc">Descrizione & Specifiche Tecniche</label>
            <textarea id="prod-desc" bind:value={description} rows="3" placeholder="Specifiche, dimensioni, termini di servizio o note tecniche..." class="form-control"></textarea>
          </div>
        {/if}
      </div>

      <!-- 3. MODELLO DI TARIFFAZIONE -->
      <div class="card form-card">
        <div class="card-header">
          <h3 class="card-title">
            <CreditCard size={18} /> Modello di Tariffazione
          </h3>
          <p class="card-subtitle">Specifica come viene calcolato e fatturato il corrispettivo.</p>
        </div>

        <div class="grid-2 mb-16">
          <div class="form-group">
            <label for="billing-type">Modalità di Calcolo</label>
            <select id="billing-type" bind:value={billingType} class="form-control">
              <option value="one_off">A Corpo / Prezzo Unitario Fisso (Una Tantum)</option>
              <option value="hourly">A Ore / Tariffa Oraria a Tempo</option>
              <option value="recurring">Ricorrente / Canone Periodico</option>
            </select>
          </div>

          {#if billingType === 'recurring'}
            <div class="form-group animate-fade-in">
              <label for="recurrence-interval">Frequenza Ricorrenza</label>
              <select id="recurrence-interval" bind:value={recurrenceInterval} class="form-control">
                <option value="weekly">Settimanale</option>
                <option value="monthly">Mensile</option>
                <option value="quarterly">Trimestrale</option>
                <option value="yearly">Annuale</option>
              </select>
            </div>
          {/if}
        </div>
      </div>

      <!-- 4. GESTIONE SCORTE & MAGAZZINO (DECOUPLED) -->
      <div class="card form-card">
        <div class="card-header flex-between">
          <div>
            <h3 class="card-title">
              <Boxes size={18} /> Gestione Scorte & Magazzino
            </h3>
            <p class="card-subtitle">
              {trackStock ? 'Monitoraggio attivo delle quantità fisiche e soglie sottoscorta.' : 'Nessun monitoraggio di giacenza per questo articolo.'}
            </p>
          </div>
          <label class="toggle-switch" title="Abilita Monitoraggio Giacenza">
            <input type="checkbox" bind:checked={trackStock} />
            <span class="slider"></span>
          </label>
        </div>

        {#if trackStock}
          <div class="grid-3 mb-16 animate-fade-in">
            <div class="form-group">
              <label for="prod-stock">Giacenza Attuale</label>
              <div class="input-with-addon">
                <input id="prod-stock" type="number" step={UnitsOfMeasureService.getStepForUnit(unit)} bind:value={stockQty} class="form-control" />
                <span class="addon">{unit}</span>
              </div>
            </div>

            <div class="form-group">
              <label for="prod-min-stock">Soglia Scorta Minima (Alert)</label>
              <div class="input-with-addon">
                <input id="prod-min-stock" type="number" step={UnitsOfMeasureService.getStepForUnit(unit)} bind:value={minStockThreshold} class="form-control" />
                <span class="addon">{unit}</span>
              </div>
            </div>

            <div class="form-group checkbox-group-container">
              <label class="checkbox-label" for="allow-backorder">
                <input id="allow-backorder" type="checkbox" bind:checked={allowOutOfStockSale} />
                <span>Consenti vendita sottoscorta / preordine (Backorder)</span>
              </label>
            </div>
          </div>
        {:else}
          <div class="untracked-banner">
            <Info size={16} /> 
            <span><strong>Giacenza non gestita</strong>: L'articolo è sempre disponibile alla vendita o erogazione senza restrizioni quantitative di magazzino.</span>
          </div>
        {/if}
      </div>

      <!-- 5. MINIMO FATTURABILE -->
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

      <!-- 6. CAMPI PERSONALIZZATI -->
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
        <a href="/dashboard/products/{productId}" class="btn-cancel">Annulla</a>
        <button type="submit" class="btn-submit" disabled={saving}>
          <Save size={16} /> {saving ? 'Salvataggio...' : 'Salva Modifiche'}
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

  /* TYPE CARDS GRID */
  .type-cards-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 1rem; }
  .type-card {
    background: var(--color-neutral-50);
    border: 2px solid var(--color-neutral-200);
    border-radius: var(--radius-lg);
    padding: 1.2rem;
    display: flex;
    align-items: flex-start;
    gap: 1rem;
    cursor: pointer;
    text-align: left;
    transition: all 0.2s ease;
    position: relative;
  }
  .type-card:hover { border-color: var(--color-primary-300); background: white; }
  .type-card.active {
    border-color: var(--color-primary-600);
    background: var(--color-primary-50);
    box-shadow: 0 0 0 1px var(--color-primary-600);
  }

  .type-card-icon {
    width: 44px;
    height: 44px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .product-color { background: #e0e7ff; color: #4338ca; }
  .service-color { background: #dbeafe; color: #1d4ed8; }
  .digital-color { background: #fef3c7; color: #b45309; }

  .type-card-content { flex: 1; }
  .type-card-title { font-size: 0.95rem; font-weight: 700; color: var(--color-neutral-900); margin-bottom: 0.2rem; }
  .type-card-desc { font-size: 0.8rem; color: var(--color-neutral-600); line-height: 1.35; }
  :global(.check-badge) { color: var(--color-primary-600); position: absolute; top: 12px; right: 12px; }

  .form-group { display: flex; flex-direction: column; gap: 0.4rem; }
  .form-group label { font-size: 0.82rem; font-weight: 700; color: var(--color-neutral-700); }
  .form-control { padding: 0.65rem 0.9rem; border: 1px solid var(--color-neutral-300); border-radius: var(--radius-md); font-size: 0.9rem; outline: none; box-sizing: border-box; width: 100%; }
  .form-control:focus { border-color: var(--color-primary-600); box-shadow: 0 0 0 3px var(--color-primary-100); }

  .input-with-addon { display: flex; align-items: center; position: relative; }
  .input-with-addon input { padding-right: 3.5rem; }
  .addon { position: absolute; right: 0.8rem; font-size: 0.82rem; font-weight: 700; color: var(--color-neutral-500); background: var(--color-neutral-100); padding: 0.2rem 0.5rem; border-radius: var(--radius-sm); pointer-events: none; }

  .checkbox-group-container { justify-content: center; }
  .checkbox-label { display: flex; align-items: center; gap: 8px; font-size: 0.85rem; font-weight: 600; color: var(--color-neutral-800); cursor: pointer; margin-top: 1.2rem; }
  .checkbox-label input { width: 16px; height: 16px; accent-color: var(--color-primary-600); cursor: pointer; }

  .untracked-banner { background: var(--color-neutral-50); border: 1px dashed var(--color-neutral-300); border-radius: var(--radius-md); padding: 0.9rem 1.2rem; display: flex; align-items: center; gap: 10px; font-size: 0.88rem; color: var(--color-neutral-700); }

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
  .font-mono { font-family: monospace; font-weight: 600; }

  .form-actions-bar { display: flex; justify-content: flex-end; align-items: center; gap: 1rem; padding-top: 1rem; }
  .btn-cancel { color: var(--color-neutral-600); text-decoration: none; font-size: 0.9rem; font-weight: 600; }
  .btn-submit { background: var(--color-primary-600); color: white; border: none; padding: 0.7rem 1.5rem; border-radius: var(--radius-md); font-weight: 700; font-size: 0.9rem; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; }
  .btn-submit:disabled { opacity: 0.6; cursor: not-allowed; }

  .alert { padding: 0.8rem 1rem; border-radius: var(--radius-md); font-size: 0.88rem; font-weight: 600; display: flex; align-items: center; gap: 8px; }
  .error-box { background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; }
  .loader-box { text-align: center; padding: 3rem; background: white; border-radius: var(--radius-lg); border: 1px solid var(--color-neutral-200); }
</style>
