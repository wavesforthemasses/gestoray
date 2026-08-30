<script lang="ts">
  import { projectStore } from '$lib/stores/project';
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { authState, activeRoleState } from '$lib/auth.svelte';
  import { ProductsService } from '../products.service';
  import type { ProductItem } from '../schema';
  import { UnitsOfMeasureService } from '$lib/services/unitsOfMeasureService';
  import { CustomFieldsService } from '$lib/services/customFieldsService';
  import { ProductSettingsService, type ProductFieldsSettings, DEFAULT_PRODUCT_FIELDS_SETTINGS } from '$lib/services/productSettingsService';
  import type { CustomFieldDefinition } from '$lib/types/customFields';
  import CustomFieldsRenderer from '$lib/components/CustomFieldsRenderer.svelte';
  import VersionTimeline from '$lib/components/versioning/VersionTimeline.svelte';
  import { VersioningService, type SystemLedgerEntry } from '$lib/services/versioningService';
  import { PRODUCT_FIELD_LABELS, ProductsVersioningBridge } from '../products.versioning.bridge';
  import { 
    List, 
    Printer, 
    Pencil, 
    Info, 
    SlidersHorizontal, 
    AlertCircle, 
    Zap, 
    History, 
    Package, 
    Briefcase, 
    Boxes, 
    CreditCard, 
    Minus,
    AlertTriangle,
    CheckCircle2
  } from '@lucide/svelte';

  const productId = $page.params.id as string;
  let product = $state<ProductItem | null>(null);
  let loading = $state(true);
  let customFieldsList = $state<CustomFieldDefinition[]>([]);
  let fieldSettings = $state<ProductFieldsSettings>({ ...DEFAULT_PRODUCT_FIELDS_SETTINGS });
  let timelineList = $state<SystemLedgerEntry[]>([]);

  async function loadData() {
    try {
      const [prod, cFields, loadedSettings, timeline] = await Promise.all([
        ProductsService.getProductById(productId),
        CustomFieldsService.getFieldsForModule('products'),
        ProductSettingsService.getSettings(),
        VersioningService.getEntityTimeline(productId)
      ]);
      product = prod;
      customFieldsList = cFields;
      fieldSettings = loadedSettings;
      timelineList = timeline;
    } catch (e) {
      console.error('Errore caricamento scheda prodotto:', e);
    } finally {
      loading = false;
    }
  }

  onMount(async () => {
    await loadData();
  });

  function printDetails() {
    if (typeof window !== 'undefined') window.print();
  }
</script>

<svelte:head>
  <title>{product ? product.name : 'Dettaglio Articolo'} | {$projectStore?.projectName || 'ERP'}</title>
</svelte:head>

<div class="product-detail-page animate-fade-in">
  <a href="/dashboard/products" class="btn-module-list" title="Vai al catalogo prodotti" aria-label="Vai al catalogo prodotti">
    <List size={20} />
  </a>

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
    <!-- HEADER -->
    <header class="detail-header card">
      <div class="header-left">
        <div class="header-badges">
          {#if (product.type || 'product') === 'product'}
            <span class="type-badge product-badge">
              <Package size={14} /> Prodotto Fisico
            </span>
          {:else if product.type === 'service'}
            <span class="type-badge service-badge">
              <Briefcase size={14} /> Servizio
            </span>
          {:else if product.type === 'digital'}
            <span class="type-badge digital-badge">
              <Zap size={14} /> Bene Digitale
            </span>
          {/if}

          {#if fieldSettings.sku.visible && product.sku}
            <span class="sku-tag">SKU: {product.sku}</span>
          {/if}
        </div>

        <h1 class="page-title">{product.name}</h1>
        {#if fieldSettings.category.visible && product.category}
          <p class="page-subtitle">Categoria: <strong>{product.category}</strong></p>
        {/if}
      </div>

      <div class="header-actions">
        <button type="button" class="btn btn-secondary" onclick={printDetails}>
          <Printer size={16} /> Stampa Scheda
        </button>
        <a href="/dashboard/products/{productId}/edit" class="btn btn-primary">
          <Pencil size={16} /> Modifica Articolo
        </a>
      </div>
    </header>

    <!-- INFO CARD -->
    <div class="card info-card">
      <h3 class="card-title">
        <Info size={18} /> Prezzo & Dettagli Economici
      </h3>
      
      <div class="info-row">
        <span class="info-label">Prezzo Base / Listino</span>
        <span class="info-val font-bold text-primary">€ {(product.price || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })} / {product.unit}</span>
      </div>

      <div class="info-row">
        <span class="info-label">Modello Tariffazione</span>
        <span class="info-val">
          {#if product.billingType === 'hourly'}
            A Ore / Tariffa Oraria
          {:else if product.billingType === 'recurring'}
            Ricorrente ({product.recurrenceInterval === 'weekly' ? 'Settimanale' : product.recurrenceInterval === 'quarterly' ? 'Trimestrale' : product.recurrenceInterval === 'yearly' ? 'Annuale' : 'Mensile'})
          {:else}
            A Corpo / Prezzo Unitario Fisso
          {/if}
        </span>
      </div>

      {#if fieldSettings.minimoFatturabile.visible && product.minimoFatturabile && (product.minimoFatturabile.enabled || product.minimoFatturabile.displayText)}
        <div class="info-row highlight-minimo">
          <span class="info-label flex-align-gap">
            <Zap size={15} class="icon-amber" /> Minimo Fatturabile
          </span>
          <span class="info-val text-amber font-bold">
            {#if product.minimoFatturabile.displayText}
              {product.minimoFatturabile.displayText}
            {:else if product.minimoFatturabile.minQuantity && product.minimoFatturabile.flatPrice}
              Sotto i {product.minimoFatturabile.minQuantity} {product.unit} -> € {product.minimoFatturabile.flatPrice.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
            {/if}
          </span>
        </div>
      {/if}

      <div class="info-row">
        <span class="info-label">Unità di Misura</span>
        <span class="info-val uppercase">{product.unit}</span>
      </div>
    </div>

    <!-- STOCK & LOGISTICS CARD -->
    <div class="card info-card">
      <h3 class="card-title">
        <Boxes size={18} /> Gestione Giacenza & Magazzino
      </h3>

      {#if product.trackStock === false}
        <div class="info-row">
          <span class="info-label">Stato Monitoraggio</span>
          <span class="untracked-pill">
            <Minus size={14} /> Nessun monitoraggio giacenza
          </span>
        </div>
      {:else}
        <div class="info-row">
          <span class="info-label">Giacenza Attuale</span>
          <div>
            {#if (product.stockQty ?? 0) > (product.minStockThreshold || 0)}
              <span class="stock-badge stock-ok">
                <CheckCircle2 size={13} /> {UnitsOfMeasureService.formatQuantity(product.stockQty ?? 0, product.unit)} {product.unit} (Disponibile)
              </span>
            {:else if (product.stockQty ?? 0) > 0}
              <span class="stock-badge stock-warning">
                <AlertTriangle size={13} /> {UnitsOfMeasureService.formatQuantity(product.stockQty ?? 0, product.unit)} {product.unit} (Sottoscorta)
              </span>
            {:else}
              <span class="stock-badge stock-danger">
                <AlertCircle size={13} /> {UnitsOfMeasureService.formatQuantity(product.stockQty ?? 0, product.unit)} {product.unit} ({product.allowOutOfStockSale !== false ? 'Esaurito / Backorder' : 'Esaurito'})
              </span>
            {/if}
          </div>
        </div>

        {#if product.minStockThreshold !== undefined && product.minStockThreshold > 0}
          <div class="info-row">
            <span class="info-label">Soglia Scorta Minima</span>
            <span class="info-val">{UnitsOfMeasureService.formatQuantity(product.minStockThreshold, product.unit)} {product.unit}</span>
          </div>
        {/if}

        <div class="info-row">
          <span class="info-label">Vendita in Sottoscorta</span>
          <span class="info-val font-semibold {product.allowOutOfStockSale !== false ? 'text-green' : 'text-red'}">
            {product.allowOutOfStockSale !== false ? 'Consentita (Preordine / Backorder)' : 'Bloccata se esaurito'}
          </span>
        </div>
      {/if}

      {#if fieldSettings.description.visible && product.description}
        <div class="notes-box">
          <strong>Descrizione & Specifiche Tecniche:</strong>
          <p>{product.description}</p>
        </div>
      {/if}
    </div>

    <!-- CUSTOM FIELDS -->
    {#if customFieldsList.length > 0 && product.customFields}
      <div class="card form-card">
        <h3 class="card-title">
          <SlidersHorizontal size={18} /> Campi Personalizzati
        </h3>
        <CustomFieldsRenderer fields={customFieldsList} values={product.customFields} readonly={true} />
      </div>
    {/if}

    <!-- SYSTEM LEDGER AUDIT TIMELINE -->
    <div class="card timeline-section">
      <div class="timeline-header">
        <h3 class="card-title">
          <History size={18} class="text-primary" /> Cronologia Modifiche & Audit Trail
        </h3>
        <p class="card-subtitle">Tracciamento immutabile a doppia scrittura nel Ledger di Sistema.</p>
      </div>

      <VersionTimeline 
        timelineList={timelineList} 
        entityId={productId}
        entityCollection="products"
        entityLabel={product.name}
        activeRole={activeRoleState.role || ''}
        currentUid={authState.user?.uid || ''}
        fieldLabelMap={PRODUCT_FIELD_LABELS}
        onreverted={loadData}
      />
    </div>
  {/if}
</div>

<style>
  .product-detail-page { width: 100%; box-sizing: border-box; display: flex; flex-direction: column; gap: 1.5rem; }
  .back-link { color: var(--color-neutral-500); font-size: 0.85rem; text-decoration: none; font-weight: 600; display: inline-flex; align-items: center; gap: 6px; }
  .back-link:hover { color: var(--color-primary-600); }

  .card { background: white; border: 1px solid var(--color-neutral-200); border-radius: var(--radius-lg); padding: 1.5rem; box-shadow: var(--shadow-sm); }
  .card-title { font-size: 1.1rem; font-weight: 700; margin: 0 0 0.8rem 0; color: var(--color-neutral-900); display: flex; align-items: center; gap: 8px; }
  .card-subtitle { font-size: 0.82rem; color: var(--color-neutral-500); margin: 0.2rem 0 1rem 0; }

  .detail-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 1.5rem; }
  .header-left { display: flex; flex-direction: column; gap: 0.4rem; }
  .header-badges { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; }
  
  .type-badge { font-size: 0.78rem; font-weight: 700; padding: 0.25rem 0.6rem; border-radius: 6px; display: inline-flex; align-items: center; gap: 5px; }
  .product-badge { background: #e0e7ff; color: #4338ca; }
  .service-badge { background: #dbeafe; color: #1d4ed8; }
  .digital-badge { background: #fef3c7; color: #b45309; }

  .sku-tag { font-family: monospace; font-size: 0.8rem; font-weight: 700; color: var(--color-neutral-600); background: var(--color-neutral-100); padding: 0.25rem 0.5rem; border-radius: 4px; }
  .page-title { font-size: 1.6rem; font-weight: 800; margin: 0.2rem 0 0 0; color: var(--color-neutral-900); }
  .page-subtitle { color: var(--color-neutral-500); font-size: 0.9rem; margin: 0; }

  .header-actions { display: flex; gap: 0.8rem; align-items: center; }

  .info-card { display: flex; flex-direction: column; gap: 0.8rem; }
  .info-row { display: flex; justify-content: space-between; align-items: center; padding: 0.6rem 0; border-bottom: 1px solid var(--color-neutral-100); }
  .info-row:last-child { border-bottom: none; }
  .info-label { font-size: 0.88rem; color: var(--color-neutral-500); font-weight: 600; }
  .info-val { font-size: 0.95rem; color: var(--color-neutral-800); }
  
  .highlight-minimo { background: #fffbeb; padding: 0.8rem 1rem; border-radius: var(--radius-md); border: 1px solid #fde68a; }
  .text-amber { color: #b45309; }
  .flex-align-gap { display: flex; align-items: center; gap: 6px; }

  .stock-badge { font-size: 0.82rem; font-weight: 700; padding: 0.3rem 0.65rem; border-radius: 6px; display: inline-flex; align-items: center; gap: 5px; }
  .stock-ok { background: #dcfce7; color: #15803d; }
  .stock-warning { background: #fef3c7; color: #b45309; }
  .stock-danger { background: #fee2e2; color: #b91c1c; }
  .untracked-pill { font-size: 0.82rem; font-weight: 600; background: var(--color-neutral-100); color: var(--color-neutral-600); padding: 0.3rem 0.65rem; border-radius: 6px; display: inline-flex; align-items: center; gap: 5px; }

  .notes-box { margin-top: 0.5rem; padding: 1rem; background: var(--color-neutral-50); border-radius: var(--radius-md); border: 1px solid var(--color-neutral-200); }
  .notes-box strong { display: block; font-size: 0.85rem; color: var(--color-neutral-700); margin-bottom: 0.4rem; }
  .notes-box p { margin: 0; font-size: 0.88rem; color: var(--color-neutral-600); white-space: pre-wrap; }

  .timeline-section { border-top: 2px solid var(--color-primary-500); }

  .btn { padding: 0.6rem 1.2rem; border-radius: var(--radius-md); font-weight: 600; cursor: pointer; text-decoration: none; font-size: 0.88rem; display: inline-flex; align-items: center; gap: 6px; }
  .btn-primary { background: var(--color-primary-600); color: white; border: none; }
  .btn-primary:hover { background: var(--color-primary-700); }
  .btn-secondary { background: var(--color-neutral-100); color: var(--color-neutral-800); border: 1px solid var(--color-neutral-300); }
  .btn-secondary:hover { background: var(--color-neutral-200); }

  .alert { padding: 0.8rem 1rem; border-radius: var(--radius-md); font-size: 0.88rem; font-weight: 600; display: flex; align-items: center; gap: 8px; }
  .error-box { background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; }
  .loader-box { text-align: center; padding: 3rem; background: white; border-radius: var(--radius-lg); border: 1px solid var(--color-neutral-200); }
  .font-mono { font-family: monospace; font-weight: 600; }
  .font-bold { font-weight: 700; }
  .font-semibold { font-weight: 600; }
  .uppercase { text-transform: uppercase; }
  .text-primary { color: var(--color-primary-600); }
  .text-green { color: #15803d; }
  .text-red { color: #b91c1c; }
</style>
