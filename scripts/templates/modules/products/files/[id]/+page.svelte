<script lang="ts">
  import { projectStore } from '$lib/stores/project';
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { authState, activeRoleState } from '$lib/auth.svelte';
  import { ProductsService } from '../products.service';
  import type { ProductItem, ProductUsageType } from '../schema';
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
    CheckCircle2,
    ArrowLeftRight,
    ArrowUpRight,
    ArrowDownLeft
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

  function getUsageBadge(usage?: ProductUsageType) {
    switch (usage) {
      case 'sale':
        return { label: 'Solo Vendita (Clienti)', class: 'usage-sale', icon: ArrowUpRight };
      case 'purchase':
        return { label: 'Solo Acquisto (Fornitori)', class: 'usage-purchase', icon: ArrowDownLeft };
      case 'both':
      default:
        return { label: 'Vendita & Acquisto (Entrambi)', class: 'usage-both', icon: ArrowLeftRight };
    }
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
    {@const usageBadge = getUsageBadge(product.usageType)}
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

          <span class="usage-badge {usageBadge.class}">
            <usageBadge.icon size={13} /> {usageBadge.label}
          </span>

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
        <span class="info-label">Prezzo di Vendita Listino</span>
        <span class="info-val font-bold text-primary">€ {(product.price || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })} / {product.unit}</span>
      </div>

      <div class="info-row">
        <span class="info-label">Costo Indicativo d'Acquisto</span>
        <span class="info-val font-semibold text-slate-700">
          {#if product.purchasePrice !== undefined && product.purchasePrice > 0}
            € {product.purchasePrice.toLocaleString('it-IT', { minimumFractionDigits: 2 })} / {product.unit}
          {:else}
            Non specificato (Usa prezzo base)
          {/if}
        </span>
      </div>

      <div class="info-row">
        <span class="info-label">Destinazione d'Uso</span>
        <span class="info-val font-medium">
          {product.usageType === 'sale' ? 'Solo Vendita a Clienti' : product.usageType === 'purchase' ? 'Solo Acquisto da Fornitori' : 'Vendita a Clienti & Acquisto Fornitori (Entrambi)'}
        </span>
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

        <div class="info-row">
          <span class="info-label">Soglia Minima Alert</span>
          <span class="info-val font-semibold">{product.minStockThreshold || 0} {product.unit}</span>
        </div>

        <div class="info-row">
          <span class="info-label">Politica Esaurito</span>
          <span class="info-val">
            {product.allowOutOfStockSale !== false ? 'Vendita consentita anche se <= 0 (Backorder abilitato)' : 'Vendita bloccata a disponibilità zero'}
          </span>
        </div>
      {/if}
    </div>

    <!-- AUDIT TRAIL / TIMELINE (Principio 22) -->
    <div class="card info-card">
      <h3 class="card-title">
        <History size={18} /> Cronologia Modifiche & Audit Trail (Ledger)
      </h3>
      <VersionTimeline 
        {timelineList} 
        entityId={productId} 
        entityCollection="products" 
        entityLabel={product.name} 
        fieldLabelMap={PRODUCT_FIELD_LABELS} 
        onreverted={loadData}
      />
    </div>
  {/if}
</div>

<style>
  .product-detail-page {
    display: flex;
    flex-direction: column;
    gap: 20px;
    width: 100%;
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

  .card {
    background: #ffffff;
    border: 1px solid var(--color-neutral-200, #e2e8f0);
    border-radius: var(--radius-lg, 12px);
    padding: 20px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  }

  .detail-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 16px;
  }

  .header-badges {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
    flex-wrap: wrap;
  }

  .type-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
  }

  .product-badge { background-color: #e0e7ff; color: #4338ca; }
  .service-badge { background-color: #fef3c7; color: #b45309; }
  .digital-badge { background-color: #ede9fe; color: #6d28d9; }

  .usage-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 8px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
  }

  .usage-both { background-color: #d1fae5; color: #047857; }
  .usage-sale { background-color: #dbeafe; color: #1d4ed8; }
  .usage-purchase { background-color: #ffedd5; color: #c2410c; }

  .sku-tag {
    font-family: monospace;
    font-size: 12px;
    background-color: var(--color-neutral-100, #f1f5f9);
    padding: 2px 6px;
    border-radius: 4px;
    color: var(--color-neutral-600, #475569);
  }

  .page-title {
    font-size: 22px;
    font-weight: 700;
    margin: 0;
    color: var(--color-neutral-900, #0f172a);
  }

  .page-subtitle {
    font-size: 14px;
    color: var(--color-neutral-500, #64748b);
    margin: 4px 0 0 0;
  }

  .header-actions {
    display: flex;
    gap: 10px;
  }

  .btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 14px;
    border-radius: var(--radius-md, 8px);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    text-decoration: none;
    border: none;
  }

  .btn-primary { background-color: var(--color-primary-600, #2563eb); color: #ffffff; }
  .btn-secondary { background-color: #ffffff; border: 1px solid var(--color-neutral-300, #cbd5e1); color: var(--color-neutral-700, #334155); }

  .info-card {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .card-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 16px;
    font-weight: 600;
    color: var(--color-neutral-800, #1e293b);
    margin: 0 0 4px 0;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--color-neutral-100, #f1f5f9);
  }

  .info-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 6px 0;
    font-size: 14px;
  }

  .info-label {
    color: var(--color-neutral-500, #64748b);
  }

  .info-val {
    color: var(--color-neutral-900, #0f172a);
  }

  .text-primary { color: var(--color-primary-600, #2563eb); }
  .font-bold { font-weight: 700; }
  .font-semibold { font-weight: 600; }
  .font-medium { font-weight: 500; }
  .uppercase { text-transform: uppercase; }

  .stock-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 8px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 600;
  }

  .stock-ok { background-color: #d1fae5; color: #065f46; }
  .stock-warning { background-color: #fef3c7; color: #92400e; }
  .stock-danger { background-color: #fee2e2; color: #991b1b; }

  .untracked-pill {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 13px;
    color: var(--color-neutral-400, #94a3b8);
  }

  .highlight-minimo {
    background-color: #fffbeb;
    padding: 8px 12px;
    border-radius: 6px;
    border-left: 3px solid #f59e0b;
  }

  .icon-amber { color: #f59e0b; }
  .text-amber { color: #b45309; }
  .flex-align-gap { display: flex; align-items: center; gap: 6px; }

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
