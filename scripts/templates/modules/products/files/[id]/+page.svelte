<script lang="ts">
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { ProductsService } from '../products.service';
  import type { ProductItem } from '../schema';
  import { UnitsOfMeasureService } from '$lib/services/unitsOfMeasureService';
  import { CustomFieldsService } from '$lib/services/customFieldsService';
  import { ProductSettingsService, type ProductFieldsSettings, DEFAULT_PRODUCT_FIELDS_SETTINGS } from '$lib/services/productSettingsService';
  import type { CustomFieldDefinition } from '$lib/types/customFields';
  import CustomFieldsRenderer from '$lib/components/CustomFieldsRenderer.svelte';
  import { ArrowLeft, Printer, Pencil, Info, SlidersHorizontal, AlertCircle, Zap } from '@lucide/svelte';

  const productId = $page.params.id as string;
  let product = $state<ProductItem | null>(null);
  let loading = $state(true);
  let customFieldsList = $state<CustomFieldDefinition[]>([]);
  let fieldSettings = $state<ProductFieldsSettings>({ ...DEFAULT_PRODUCT_FIELDS_SETTINGS });

  onMount(async () => {
    try {
      const [prod, cFields, loadedSettings] = await Promise.all([
        ProductsService.getProductById(productId),
        CustomFieldsService.getFieldsForModule('products'),
        ProductSettingsService.getSettings()
      ]);
      product = prod;
      customFieldsList = cFields;
      fieldSettings = loadedSettings;
    } catch (e) {
      console.error('Errore caricamento scheda prodotto:', e);
    } finally {
      loading = false;
    }
  });

  function printDetails() {
    if (typeof window !== 'undefined') window.print();
  }
</script>

<svelte:head>
  <title>{product ? product.name : 'Dettaglio Prodotto'} | Gestoray</title>
</svelte:head>

<div class="product-detail-page animate-fade-in">
  <a href="/dashboard/products" class="back-link">
    <ArrowLeft size={14} /> Torna al Catalogo Prodotti
  </a>

  {#if loading}
    <div class="loader-box">
      <span class="spinner"></span>
      Caricamento prodotto...
    </div>
  {:else if !product}
    <div class="alert error-box">
      <AlertCircle size={16} /> Articolo non trovato o eliminato.
    </div>
  {:else}
    <!-- HEADER -->
    <header class="detail-header card">
      <div>
        {#if fieldSettings.sku.visible && product.sku}
          <div class="header-tag">SKU: {product.sku}</div>
        {/if}
        <h1 class="page-title">{product.name}</h1>
        {#if fieldSettings.category.visible && product.category}
          <p class="page-subtitle">Categoria: <strong>{product.category}</strong></p>
        {/if}
      </div>

      <div class="header-actions">
        <button type="button" class="btn btn-secondary" onclick={printDetails}>
          <Printer size={16} /> Stampa Scheda
        </button>
        <a href="/dashboard/products/{productId}/edit" class="btn btn-secondary">
          <Pencil size={16} /> Modifica Articolo
        </a>
      </div>
    </header>

    <!-- INFO CARD -->
    <div class="card info-card">
      <h3 class="card-title">
        <Info size={18} /> Prezzo & Dettagli
      </h3>
      
      <div class="info-row">
        <span class="info-label">Prezzo Unitario</span>
        <span class="info-val font-bold text-primary">€ {(product.price || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })} / {product.unit}</span>
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
              Sotto i {product.minimoFatturabile.minQuantity} {product.unit} ➔ € {product.minimoFatturabile.flatPrice.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
            {/if}
          </span>
        </div>
      {/if}

      {#if fieldSettings.stockQty.visible}
        <div class="info-row">
          <span class="info-label">Giacenza Attuale</span>
          <span class="stock-badge {product.stockQty > 0 ? 'stock-ok' : 'stock-zero'}">
            {UnitsOfMeasureService.formatQuantity(product.stockQty, product.unit)} {product.unit}
          </span>
        </div>
      {/if}

      <div class="info-row">
        <span class="info-label">Unità di Misura</span>
        <span class="info-val uppercase">{product.unit}</span>
      </div>

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
  {/if}
</div>

<style>
  .product-detail-page { width: 100%; box-sizing: border-box; display: flex; flex-direction: column; gap: 1.5rem; }
  .back-link { color: var(--color-neutral-600); text-decoration: none; font-size: 0.85rem; font-weight: 600; display: inline-flex; align-items: center; gap: 6px; }
  .back-link:hover { color: var(--color-primary-600); }

  .detail-header { background: white; border: 1px solid var(--color-neutral-200); border-radius: var(--radius-lg); padding: 1.5rem; display: flex; justify-content: space-between; align-items: center; box-shadow: var(--shadow-sm); }
  .header-tag { font-family: monospace; font-size: 0.85rem; color: var(--color-primary-600); font-weight: 700; }
  .page-title { font-size: 1.6rem; font-weight: 800; margin: 0.2rem 0; color: var(--color-neutral-900); }
  .page-subtitle { font-size: 0.9rem; color: var(--color-neutral-600); margin: 0; }
  .header-actions { display: flex; gap: 0.8rem; }

  .card { background: white; border: 1px solid var(--color-neutral-200); border-radius: var(--radius-lg); padding: 1.5rem; box-shadow: var(--shadow-sm); }
  .card-title { font-size: 1.1rem; font-weight: 700; margin: 0 0 1.2rem 0; color: var(--color-neutral-900); border-bottom: 1px solid var(--color-neutral-100); padding-bottom: 0.8rem; display: flex; align-items: center; gap: 8px; }

  .info-row { display: flex; justify-content: space-between; align-items: center; padding: 0.6rem 0; border-bottom: 1px dashed var(--color-neutral-200); }
  .highlight-minimo { background: #fffbeb; padding: 0.6rem 0.8rem; border-radius: var(--radius-md); border: 1px solid #fef3c7; }
  .flex-align-gap { display: flex; align-items: center; gap: 6px; }
  .icon-amber { color: #d97706; }
  .text-amber { color: #b45309; }

  .info-label { font-size: 0.88rem; color: var(--color-neutral-500); font-weight: 600; }
  .info-val { font-size: 0.92rem; font-weight: 600; color: var(--color-neutral-800); }

  .stock-badge { font-size: 0.8rem; font-weight: 700; padding: 0.2rem 0.6rem; border-radius: 6px; }
  .stock-ok { background: #dcfce7; color: #15803d; }
  .stock-zero { background: #fee2e2; color: #b91c1c; }

  .notes-box { margin-top: 1.2rem; background: var(--color-neutral-50); padding: 1rem; border-radius: var(--radius-md); font-size: 0.88rem; border: 1px solid var(--color-neutral-200); }
  .notes-box p { margin: 0.4rem 0 0 0; color: var(--color-neutral-700); line-height: 1.4; }

  .btn { padding: 0.6rem 1.2rem; border-radius: var(--radius-md); font-weight: 600; cursor: pointer; border: none; text-decoration: none; font-size: 0.88rem; display: inline-flex; align-items: center; gap: 6px; }
  .btn-secondary { background: var(--color-neutral-100); color: var(--color-neutral-800); border: 1px solid var(--color-neutral-300); }
  .btn-secondary:hover { background: var(--color-neutral-200); }

  .alert { padding: 0.8rem 1rem; border-radius: var(--radius-md); font-size: 0.88rem; font-weight: 600; display: flex; align-items: center; gap: 8px; }
  .error-box { background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; }
  .loader-box { text-align: center; padding: 3rem; background: white; border-radius: var(--radius-lg); border: 1px solid var(--color-neutral-200); }
  .font-bold { font-weight: 700; }
  .uppercase { text-transform: uppercase; }
</style>
