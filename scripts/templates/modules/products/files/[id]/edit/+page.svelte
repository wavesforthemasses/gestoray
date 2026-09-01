<script lang="ts">
  import { projectStore } from '$lib/stores/project';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { authState } from '$lib/auth.svelte';
  import { ProductsService } from '../../products.service';
  import type { ProductItem, ProductType, ProductUsageType, BillingType, RecurrenceInterval } from '../../schema';
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
    CheckCircle2,
    ArrowLeftRight,
    ArrowUpRight,
    ArrowDownLeft
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
  let usageType = $state<ProductUsageType>('both');
  let sku = $state('');
  let name = $state('');
  let category = $state('Ricambi');
  let price = $state<number>(0);
  let purchasePrice = $state<number>(0);
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
          usageType = product.usageType || 'both';
          sku = product.sku || '';
          name = product.name || '';
          category = product.category || 'Ricambi';
          price = product.price || 0;
          purchasePrice = product.purchasePrice || 0;
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
        usageType,
        canBeSold: usageType !== 'purchase',
        canBePurchased: usageType !== 'sale',
        category: fieldSettings.category.visible ? category.trim() : '',
        price: Number(price) || 0,
        purchasePrice: Number(purchasePrice) || 0,
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
        tenantId
      });

      toast.success('Articolo aggiornato con successo!');
      goto(`/dashboard/products/${productId}`);
    } catch (err: any) {
      console.error('Errore aggiornamento articolo:', err);
      errorMsg = err.message || 'Errore durante l\'aggiornamento dell\'articolo.';
    } finally {
      saving = false;
    }
  }
</script>

<svelte:head>
  <title>Modifica {product ? product.name : 'Articolo'} | {$projectStore?.projectName || 'ERP'}</title>
</svelte:head>

<div class="edit-product-page animate-fade-in">
  <div class="page-top">
    <a href="/dashboard/products/{productId}" class="btn-module-list" title="Annulla e torna al dettaglio" aria-label="Annulla e torna al dettaglio">
      <List size={20} />
    </a>
    <h2>
      <Pencil size={22} class="header-icon" /> Modifica Articolo Catalogo
    </h2>
  </div>

  {#if loading}
    <div class="loader-box">
      <span class="spinner"></span>
      Caricamento articolo...
    </div>
  {:else if !product}
    <div class="alert error-box">
      <AlertCircle size={16} /> Articolo non trovato o eliminato.
    </div>
  {:else}
    {#if errorMsg}
      <div class="alert error-box">
        <AlertCircle size={16} /> {errorMsg}
      </div>
    {/if}

    <form onsubmit={handleSubmit} class="product-form">
      <!-- 1. TIPO ARTICOLO -->
      <div class="card form-card">
        <div class="card-header">
          <h3 class="card-title">
            <Boxes size={18} /> 1. Tipologia Articolo
          </h3>
          <p class="card-subtitle">Cambia la classificazione se necessario.</p>
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
              <div class="type-card-desc">Beni materiali con tracciamento scorte a magazzino.</div>
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
              <div class="type-card-desc">Attività professionali o manodopera (a ore o a corpo).</div>
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
              <div class="type-card-desc">Software o licenze digitali.</div>
            </div>
            {#if productType === 'digital'}
              <CheckCircle2 size={18} class="check-badge" />
            {/if}
          </button>
        </div>
      </div>

      <!-- 2. DESTINAZIONE D'USO (VENDITA / ACQUISTO / ENTRAMBI) -->
      <div class="card form-card">
        <div class="card-header">
          <h3 class="card-title">
            <ArrowLeftRight size={18} /> 2. Destinazione d'Uso Commerciale
          </h3>
          <p class="card-subtitle">Specifica la disponibilità dell'articolo tra Preventivi/Contratti clienti e Ordini Fornitore.</p>
        </div>

        <div class="usage-cards-grid">
          <button 
            type="button" 
            class="usage-card {usageType === 'both' ? 'active' : ''}" 
            onclick={() => usageType = 'both'}
          >
            <div class="usage-icon both-color">
              <ArrowLeftRight size={20} />
            </div>
            <div class="usage-content">
              <div class="usage-title">Vendita & Acquisto (Entrambi)</div>
              <div class="usage-desc">Comprato da fornitori e venduto ai clienti.</div>
            </div>
            {#if usageType === 'both'}
              <CheckCircle2 size={16} class="check-badge" />
            {/if}
          </button>

          <button 
            type="button" 
            class="usage-card {usageType === 'sale' ? 'active' : ''}" 
            onclick={() => usageType = 'sale'}
          >
            <div class="usage-icon sale-color">
              <ArrowUpRight size={20} />
            </div>
            <div class="usage-content">
              <div class="usage-title">Solo Vendita (Clienti)</div>
              <div class="usage-desc">Offerto solo nei preventivi/contratti (non in PO fornitore).</div>
            </div>
            {#if usageType === 'sale'}
              <CheckCircle2 size={16} class="check-badge" />
            {/if}
          </button>

          <button 
            type="button" 
            class="usage-card {usageType === 'purchase' ? 'active' : ''}" 
            onclick={() => usageType = 'purchase'}
          >
            <div class="usage-icon purchase-color">
              <ArrowDownLeft size={20} />
            </div>
            <div class="usage-content">
              <div class="usage-title">Solo Acquisto (Fornitori)</div>
              <div class="usage-desc">Materie prime/consumabili (non a listino vendita clienti).</div>
            </div>
            {#if usageType === 'purchase'}
              <CheckCircle2 size={16} class="check-badge" />
            {/if}
          </button>
        </div>
      </div>

      <!-- 3. ANAGRAFICA ARTICOLO -->
      <div class="card form-card">
        <div class="card-header">
          <h3 class="card-title">
            <Info size={18} /> 3. Dettagli Anagrafici & Prezzi
          </h3>
          <p class="card-subtitle">Codice, denominazione e valori economici.</p>
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
                placeholder="es. Ricambi, Consulenza..." 
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
          <input id="prod-name" type="text" bind:value={name} required class="form-control" />
        </div>

        <div class="grid-3 mb-16">
          <div class="form-group">
            <label for="prod-price">Prezzo di Vendita Listino (€) *</label>
            <input id="prod-price" type="number" step="0.01" bind:value={price} required class="form-control" />
          </div>

          <div class="form-group">
            <label for="prod-purchase-price">Costo Indicativo d'Acquisto (€)</label>
            <input id="prod-purchase-price" type="number" step="0.01" bind:value={purchasePrice} class="form-control" placeholder="Costo fornitore" />
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
            <label for="prod-desc">Descrizione & Specifiche</label>
            <textarea id="prod-desc" bind:value={description} rows="3" class="form-control"></textarea>
          </div>
        {/if}
      </div>

      <!-- 4. MODELLO DI TARIFFAZIONE -->
      <div class="card form-card">
        <div class="card-header">
          <h3 class="card-title">
            <CreditCard size={18} /> 4. Modello di Tariffazione
          </h3>
          <p class="card-subtitle">Frequenza e modalità di fatturazione.</p>
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

      <!-- 5. GESTIONE SCORTE & MAGAZZINO -->
      <div class="card form-card">
        <div class="card-header flex-between">
          <div>
            <h3 class="card-title">
              <Boxes size={18} /> 5. Gestione Scorte & Magazzino
            </h3>
            <p class="card-subtitle">
              {trackStock ? 'Monitoraggio attivo delle quantità fisiche.' : 'Nessun monitoraggio per questo articolo.'}
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
              <label for="prod-stock">Giacenza a Magazzino</label>
              <div class="input-with-addon">
                <input id="prod-stock" type="number" step={UnitsOfMeasureService.getStepForUnit(unit)} bind:value={stockQty} class="form-control" />
                <span class="addon">{unit}</span>
              </div>
            </div>

            <div class="form-group">
              <label for="prod-threshold">Soglia Scorta Minima</label>
              <div class="input-with-addon">
                <input id="prod-threshold" type="number" step={UnitsOfMeasureService.getStepForUnit(unit)} bind:value={minStockThreshold} class="form-control" />
                <span class="addon">{unit}</span>
              </div>
            </div>

            <div class="form-group flex-center-y">
              <label class="checkbox-label">
                <input type="checkbox" bind:checked={allowOutOfStockSale} />
                <span>Consenti vendita in sottoscorta (Backorder)</span>
              </label>
            </div>
          </div>
        {/if}
      </div>

      <!-- BOTTONI AZIONE -->
      <div class="form-actions">
        <a href="/dashboard/products/{productId}" class="btn btn-secondary">Annulla</a>
        <button type="submit" class="btn btn-primary" disabled={saving}>
          <Save size={16} /> {saving ? 'Salvataggio...' : 'Salva Modifiche'}
        </button>
      </div>
    </form>
  {/if}
</div>

<style>
  .edit-product-page {
    display: flex;
    flex-direction: column;
    gap: 20px;
    width: 100%;
  }

  .page-top {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .btn-module-list {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: var(--radius-md, 8px);
    background: #ffffff;
    border: 1px solid var(--color-neutral-200, #e2e8f0);
    color: var(--color-neutral-600, #475569);
    cursor: pointer;
    text-decoration: none;
  }

  .btn-module-list:hover {
    background: var(--color-neutral-50, #f8fafc);
    color: var(--color-neutral-900, #0f172a);
  }

  h2 {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 20px;
    font-weight: 700;
    margin: 0;
    color: var(--color-neutral-900, #0f172a);
  }

  .header-icon {
    color: var(--color-primary-600, #2563eb);
  }

  .product-form {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .form-card {
    background: #ffffff;
    border: 1px solid var(--color-neutral-200, #e2e8f0);
    border-radius: var(--radius-lg, 12px);
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  }

  .card-header {
    border-bottom: 1px solid var(--color-neutral-100, #f1f5f9);
    padding-bottom: 12px;
  }

  .card-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 16px;
    font-weight: 600;
    color: var(--color-neutral-800, #1e293b);
    margin: 0;
  }

  .card-subtitle {
    font-size: 13px;
    color: var(--color-neutral-500, #64748b);
    margin: 4px 0 0 0;
  }

  .type-cards-grid, .usage-cards-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 12px;
  }

  .type-card, .usage-card {
    position: relative;
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 14px;
    border: 1.5px solid var(--color-neutral-200, #e2e8f0);
    border-radius: var(--radius-md, 8px);
    background: #ffffff;
    cursor: pointer;
    text-align: left;
    transition: all 0.15s ease;
  }

  .type-card:hover, .usage-card:hover {
    border-color: var(--color-neutral-300, #cbd5e1);
    background-color: var(--color-neutral-50, #f8fafc);
  }

  .type-card.active, .usage-card.active {
    border-color: var(--color-primary-600, #2563eb);
    background-color: var(--color-primary-50, #eff6ff);
  }

  .type-card-icon, .usage-icon {
    padding: 8px;
    border-radius: 8px;
    flex-shrink: 0;
  }

  .product-color { background-color: #e0e7ff; color: #4338ca; }
  .service-color { background-color: #fef3c7; color: #b45309; }
  .digital-color { background-color: #ede9fe; color: #6d28d9; }

  .both-color { background-color: #d1fae5; color: #047857; }
  .sale-color { background-color: #dbeafe; color: #1d4ed8; }
  .purchase-color { background-color: #ffedd5; color: #c2410c; }

  .type-card-title, .usage-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--color-neutral-900, #0f172a);
  }

  .type-card-desc, .usage-desc {
    font-size: 12px;
    color: var(--color-neutral-500, #64748b);
    margin-top: 2px;
    line-height: 1.3;
  }

  :global(.check-badge) {
    position: absolute;
    top: 10px;
    right: 10px;
    color: var(--color-primary-600, #2563eb);
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .form-group label {
    font-size: 13px;
    font-weight: 600;
    color: var(--color-neutral-700, #334155);
  }

  .form-control {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid var(--color-neutral-300, #cbd5e1);
    border-radius: var(--radius-md, 8px);
    font-size: 14px;
    color: var(--color-neutral-900, #0f172a);
    background: #ffffff;
  }

  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }

  @media (max-width: 768px) {
    .grid-2, .grid-3 { grid-template-columns: 1fr; }
  }

  .mb-16 { margin-bottom: 16px; }
  .font-mono { font-family: monospace; }

  .flex-between { display: flex; justify-content: space-between; align-items: center; }
  .flex-center-y { display: flex; align-items: center; height: 100%; }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: var(--color-neutral-700, #334155);
    cursor: pointer;
    margin-top: 20px;
  }

  .input-with-addon {
    display: flex;
    align-items: center;
  }

  .input-with-addon input {
    border-top-right-radius: 0;
    border-bottom-right-radius: 0;
  }

  .input-with-addon .addon {
    padding: 8px 12px;
    background: var(--color-neutral-100, #f1f5f9);
    border: 1px solid var(--color-neutral-300, #cbd5e1);
    border-left: none;
    border-top-right-radius: var(--radius-md, 8px);
    border-bottom-right-radius: var(--radius-md, 8px);
    font-size: 13px;
    color: var(--color-neutral-600, #475569);
  }

  /* Toggle switch */
  .toggle-switch {
    position: relative;
    display: inline-block;
    width: 44px;
    height: 24px;
  }

  .toggle-switch input { opacity: 0; width: 0; height: 0; }

  .slider {
    position: absolute;
    cursor: pointer;
    inset: 0;
    background-color: var(--color-neutral-300, #cbd5e1);
    transition: 0.2s;
    border-radius: 24px;
  }

  .slider:before {
    position: absolute;
    content: "";
    height: 18px;
    width: 18px;
    left: 3px;
    bottom: 3px;
    background-color: white;
    transition: 0.2s;
    border-radius: 50%;
  }

  input:checked + .slider { background-color: var(--color-primary-600, #2563eb); }
  input:checked + .slider:before { transform: translateX(20px); }

  .form-actions {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    margin-top: 10px;
  }

  .btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 18px;
    border-radius: var(--radius-md, 8px);
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    border: none;
    text-decoration: none;
  }

  .btn-primary {
    background-color: var(--color-primary-600, #2563eb);
    color: #ffffff;
  }

  .btn-secondary {
    background-color: #ffffff;
    border: 1px solid var(--color-neutral-300, #cbd5e1);
    color: var(--color-neutral-700, #334155);
  }

  .error-box {
    padding: 12px 16px;
    background-color: #fee2e2;
    color: #991b1b;
    border-radius: var(--radius-md, 8px);
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .loader-box {
    padding: 40px;
    text-align: center;
    color: var(--color-neutral-500, #64748b);
  }

  .spinner {
    display: inline-block;
    width: 20px;
    height: 20px;
    border: 2px solid var(--color-neutral-200, #e2e8f0);
    border-top-color: var(--color-primary-600, #2563eb);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>
