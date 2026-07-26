<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { ProductsService } from '../../products.service';
  import type { ProductItem } from '../../schema';
  import { CustomFieldsService } from '$lib/services/customFieldsService';
  import type { CustomFieldDefinition, CustomFieldValues } from '$lib/types/customFields';
  import CustomFieldsRenderer from '$lib/components/CustomFieldsRenderer.svelte';
  import { toast } from '$lib/stores/toast.svelte';
  import { ArrowLeft, Pencil, Info, SlidersHorizontal, Save, AlertCircle } from '@lucide/svelte';

  let productId = $derived(page.params.id);
  let product = $state<ProductItem | null>(null);

  let customFieldsList = $state<CustomFieldDefinition[]>([]);
  let customFieldsValues = $state<CustomFieldValues>({});

  let loading = $state(true);
  let saving = $state(false);
  let errorMsg = $state('');

  // Form State
  let sku = $state('');
  let name = $state('');
  let category = $state('Ricambi');
  let price = $state<number>(0);
  let unit = $state('pz');
  let stockQty = $state<number>(0);
  let description = $state('');

  onMount(async () => {
    try {
      customFieldsList = await CustomFieldsService.getFieldsForModule('products');

      if (productId) {
        product = await ProductsService.getProductById(productId);
        if (product) {
          sku = product.sku || '';
          name = product.name || '';
          category = product.category || 'Ricambi';
          price = product.price || 0;
          unit = product.unit || 'pz';
          stockQty = product.stockQty || 0;
          description = product.description || '';
          customFieldsValues = product.customFields ? { ...product.customFields } : {};
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
    if (!productId || !sku.trim() || !name.trim()) {
      errorMsg = 'Compila i campi obbligatori (SKU e Nome Articolo).';
      return;
    }

    saving = true;
    errorMsg = '';

    try {
      await ProductsService.updateProduct(productId, {
        sku: sku.trim(),
        name: name.trim(),
        category: category.trim(),
        price,
        unit,
        stockQty,
        description: description.trim(),
        customFields: customFieldsValues
      });

      toast.success('Articolo aggiornato con successo!');
      goto(`/dashboard/products/${productId}`);
    } catch (err: any) {
      console.error('Errore salvataggio prodotto:', err);
      errorMsg = err.message || 'Errore durante il salvataggio delle modifiche.';
    } finally {
      saving = false;
    }
  }
</script>

<svelte:head>
  <title>Modifica Articolo | Gestoray</title>
</svelte:head>

<div class="add-product-page animate-fade-in">
  <div class="page-top">
    <a href="/dashboard/products/{productId}" class="back-link">
      <ArrowLeft size={14} /> Torna al Dettaglio Articolo
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
      <!-- 1. INFORMAZIONI ARTICOLO -->
      <div class="card form-card">
        <div class="card-header">
          <h3 class="card-title">
            <Info size={18} /> Anagrafica Articolo
          </h3>
          <p class="card-subtitle">Codice identificativo SKU, denominazione e categoria.</p>
        </div>

        <div class="grid-2 mb-16">
          <div class="form-group">
            <label for="prod-sku">Codice SKU / Codice Articolo *</label>
            <input id="prod-sku" type="text" bind:value={sku} required class="form-control" />
          </div>

          <div class="form-group">
            <label for="prod-category">Categoria</label>
            <select id="prod-category" bind:value={category} class="form-control">
              <option value="Ricambi">Ricambi & Componenti</option>
              <option value="Materiale Elettrico">Materiale Elettrico</option>
              <option value="Materiale Idraulico">Materiale Idraulico</option>
              <option value="Materiale di Consumo">Materiale di Consumo</option>
              <option value="Servizi & Manodopera">Servizi & Manodopera</option>
            </select>
          </div>
        </div>

        <div class="form-group mb-16">
          <label for="prod-name">Nome / Denominazione Articolo *</label>
          <input id="prod-name" type="text" bind:value={name} placeholder="es. Filtro Aria Condizionata R32" required class="form-control" />
        </div>

        <div class="grid-3 mb-16">
          <div class="form-group">
            <label for="prod-price">Prezzo Unitario (€) *</label>
            <input id="prod-price" type="number" step="0.01" bind:value={price} required class="form-control" />
          </div>

          <div class="form-group">
            <label for="prod-unit">Unità di Misura</label>
            <select id="prod-unit" bind:value={unit} class="form-control">
              <option value="pz">Pezzi (pz)</option>
              <option value="kg">Chilogrammi (kg)</option>
              <option value="m">Metri (m)</option>
              <option value="l">Litri (l)</option>
              <option value="ora">Ore (ora)</option>
            </select>
          </div>

          <div class="form-group">
            <label for="prod-stock">Giacenza a Magazzino *</label>
            <input id="prod-stock" type="number" bind:value={stockQty} required class="form-control" />
          </div>
        </div>

        <div class="form-group">
          <label for="prod-desc">Descrizione & Specifiche Tecniche</label>
          <textarea id="prod-desc" bind:value={description} rows="3" placeholder="Specifiche, dimensioni o note tecniche..." class="form-control"></textarea>
        </div>
      </div>

      <!-- 2. CAMPI PERSONALIZZATI -->
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
          <Save size={16} /> {saving ? 'Salvataggio...' : 'Aggiorna Articolo'}
        </button>
      </div>
    </form>
  {/if}
</div>

<style>
  .add-product-page { padding: 1.5rem; max-width: 900px; margin: 0 auto; display: flex; flex-direction: column; gap: 1.5rem; }
  .page-top { display: flex; flex-direction: column; gap: 0.4rem; }
  .back-link { color: var(--color-neutral-500); font-size: 0.85rem; text-decoration: none; font-weight: 600; display: inline-flex; align-items: center; gap: 6px; }
  .back-link:hover { color: var(--color-primary-600); }
  h2 { font-size: 1.5rem; font-weight: 800; margin: 0; color: var(--color-neutral-900); display: flex; align-items: center; gap: 8px; }
  :global(.header-icon) { color: var(--color-primary-500); }

  .product-form { display: flex; flex-direction: column; gap: 1.5rem; }
  .card { background: white; border: 1px solid var(--color-neutral-200); border-radius: var(--radius-lg); padding: 1.5rem; box-shadow: var(--shadow-sm); }
  .card-header { margin-bottom: 1.2rem; border-bottom: 1px solid var(--color-neutral-100); padding-bottom: 0.8rem; }
  .card-title { font-size: 1.1rem; font-weight: 700; margin: 0; color: var(--color-neutral-900); display: flex; align-items: center; gap: 8px; }
  .card-subtitle { font-size: 0.82rem; color: var(--color-neutral-500); margin: 0.2rem 0 0 0; }

  .form-group { display: flex; flex-direction: column; gap: 0.4rem; }
  .form-group label { font-size: 0.82rem; font-weight: 700; color: var(--color-neutral-700); }
  .form-control { padding: 0.65rem 0.9rem; border: 1px solid var(--color-neutral-300); border-radius: var(--radius-md); font-size: 0.9rem; outline: none; box-sizing: border-box; }
  .form-control:focus { border-color: var(--color-primary-600); box-shadow: 0 0 0 3px var(--color-primary-100); }

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
