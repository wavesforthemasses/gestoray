<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { ProductsService } from '../products.service';
  import { CustomFieldsService } from '$lib/services/customFieldsService';
  import type { CustomFieldDefinition, CustomFieldValues } from '$lib/types/customFields';
  import CustomFieldsRenderer from '$lib/components/CustomFieldsRenderer.svelte';
  import { toast } from '$lib/stores/toast.svelte';

  let customFieldsList = $state<CustomFieldDefinition[]>([]);
  let customFieldsValues = $state<CustomFieldValues>({});

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

  onMount(async () => {
    try {
      customFieldsList = await CustomFieldsService.getFieldsForModule('products');
    } catch (e) {
      console.error('Errore caricamento custom fields prodotti:', e);
    } finally {
      loading = false;
    }
  });

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (!sku.trim() || !name.trim()) {
      errorMsg = 'Compila i campi obbligatori (SKU e Nome Articolo).';
      return;
    }

    saving = true;
    errorMsg = '';

    try {
      const prodId = await ProductsService.createProduct({
        sku: sku.trim(),
        name: name.trim(),
        category: category.trim(),
        price,
        unit,
        stockQty,
        description: description.trim(),
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
  <title>Nuovo Articolo | Gestoray</title>
</svelte:head>

<div class="add-product-page animate-fade-in">
  <div class="page-top">
    <a href="/dashboard/products" class="back-link">← Torna al Catalogo Prodotti</a>
    <h2>📦 Aggiungi Articolo al Catalogo</h2>
  </div>

  {#if loading}
    <div class="loader-box">
      <span class="spinner"></span>
      Caricamento in corso...
    </div>
  {:else}
    {#if errorMsg}
      <div class="alert error-box">⚠️ {errorMsg}</div>
    {/if}

    <form onsubmit={handleSubmit} class="product-form">
      <!-- 1. INFORMAZIONI ARTICOLO -->
      <div class="card form-card">
        <div class="card-header">
          <h3 class="card-title">ℹ️ Anagrafica Articolo</h3>
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
            <label for="prod-stock">Giacenza Iniziale *</label>
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
            <h3 class="card-title">🧩 Campi Personalizzati</h3>
          </div>
          <CustomFieldsRenderer fields={customFieldsList} bind:values={customFieldsValues} />
        </div>
      {/if}

      <!-- FORM ACTIONS -->
      <div class="form-actions-bar">
        <a href="/dashboard/products" class="btn-cancel">Annulla</a>
        <button type="submit" class="btn-submit" disabled={saving}>
          {saving ? 'Salvataggio...' : '💾 Salva Articolo'}
        </button>
      </div>
    </form>
  {/if}
</div>

<style>
  .add-product-page { max-width: 900px; margin: 0 auto; padding: 24px 16px; }
  .page-top { margin-bottom: 20px; }
  .back-link { color: var(--color-neutral-600); text-decoration: none; font-size: 13px; font-weight: 600; }
  .back-link:hover { color: var(--color-primary-600); }
  .page-top h2 { margin: 6px 0 0 0; font-size: 22px; font-weight: 700; color: var(--color-neutral-900); }

  .form-card { background: white; border: 1px solid var(--color-neutral-200); border-radius: var(--radius-lg); padding: 24px; margin-bottom: 24px; box-shadow: var(--shadow-sm); }
  .card-title { margin: 0 0 4px 0; font-size: 16px; font-weight: 600; color: var(--color-neutral-800); }
  .card-subtitle { margin: 0 0 16px 0; font-size: 13px; color: var(--color-neutral-500); }

  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }
  .mb-16 { margin-bottom: 16px; }

  .form-group { display: flex; flex-direction: column; gap: 6px; }
  .form-group label { font-size: 13px; font-weight: 600; color: var(--color-neutral-700); }

  .form-control { padding: 10px 14px; font-size: 14px; border: 1px solid var(--color-neutral-300); border-radius: var(--radius-md); background: white; outline: none; width: 100%; box-sizing: border-box; }

  .form-actions-bar { display: flex; justify-content: flex-end; align-items: center; gap: 16px; margin-top: 32px; }
  .btn-cancel { padding: 12px 24px; font-size: 14px; font-weight: 600; color: var(--color-neutral-600); background: var(--color-neutral-100); border: 1px solid var(--color-neutral-300); border-radius: var(--radius-md); text-decoration: none; }
  .btn-submit { padding: 12px 28px; font-size: 14px; font-weight: 700; color: white; background: var(--color-primary-600); border: none; border-radius: var(--radius-md); cursor: pointer; }

  .alert { padding: 14px 18px; border-radius: var(--radius-md); margin-bottom: 20px; font-weight: 600; }
  .error-box { background: #fef2f2; color: #991b1b; border: 1px solid #fca5a5; }
  .loader-box { padding: 40px; text-align: center; color: var(--color-neutral-500); }
</style>
