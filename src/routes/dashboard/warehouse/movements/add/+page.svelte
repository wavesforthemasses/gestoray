<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { WarehouseService } from '../../warehouse.service';
  import type { StockMovementType, WarehouseInventoryItem } from '../../schema';
  import { toast } from '$lib/stores/toast.svelte';
  import { authState } from '$lib/auth.svelte';
  import { menuConfigStore } from '$lib/stores/menu';
  import { 
    RefreshCw, 
    List, 
    CheckCircle2, 
    Package, 
    ArrowDownLeft, 
    ArrowUpRight, 
    ArrowLeftRight 
  } from '@lucide/svelte';
  import { roundCurrency } from '$lib/utils/math';
  import { Autocomplete, type AutocompleteOption } from '$lib';

  let movementType = $state<StockMovementType>('IN_INITIAL');
  let selectedProductId = $state('');
  let quantity = $state<number>(1);
  let unitCost = $state<number>(0);
  let fromPlaceId = $state('default');
  let fromPlaceName = $state('Magazzino Centrale');
  let toPlaceId = $state('default');
  let toPlaceName = $state('Magazzino Centrale');
  let batchNumber = $state('');
  let expiryDate = $state('');
  let notes = $state('');

  let productsCatalog = $state<Array<{ id: string; name: string; sku?: string; unit?: string; price?: number }>>([]);
  let placesList = $state<Array<{ id: string; name: string }>>([
    { id: 'default', name: 'Magazzino Centrale' }
  ]);
  let isSaving = $state(false);

  let productOptions = $derived<AutocompleteOption[]>(
    productsCatalog.map(p => ({
      id: p.id,
      label: p.name,
      sublabel: `${p.sku ? p.sku + ' • ' : ''}${p.unit || 'pz'}`
    }))
  );

  let placeOptions = $derived<AutocompleteOption[]>(
    placesList.map(pl => ({
      id: pl.id,
      label: pl.name
    }))
  );

  onMount(async () => {
    try {
      if ($menuConfigStore.some(m => m.id === 'products')) {
        const mod: any = await import('../../../products/products.service');
        const prods = await mod.ProductsService.getProducts();
        productsCatalog = (prods as any[])
          .filter((p: any) => p.trackStock !== false && p.type !== 'service' && p.type !== 'digital')
          .map((p: any) => ({
            id: p.id,
            name: p.name,
            sku: p.sku || '',
            unit: p.unit || 'pz',
            price: roundCurrency(p.purchasePrice !== undefined && p.purchasePrice > 0 ? p.purchasePrice : (p.price ?? 0))
          }));
        if (productsCatalog.length > 0) {
          selectedProductId = productsCatalog[0].id;
          unitCost = productsCatalog[0].price || 0;
        }
      }

      if ($menuConfigStore.some(m => m.id === 'places')) {
        const mod: any = await import('../../../places/places.service');
        const places = await mod.PlacesService.getPlaces();
        const customPlaces = (places as any[]).map((p: any) => ({
          id: p.id,
          name: p.name || p.code || p.id
        }));
        placesList = [{ id: 'default', name: 'Magazzino Centrale' }, ...customPlaces];
      }
    } catch (err) {
      console.error('Errore caricamento prodotti / luoghi:', err);
    }
  });

  function handleProductSelect(prodId: string) {
    selectedProductId = prodId;
    const found = productsCatalog.find(p => p.id === prodId);
    if (found) {
      unitCost = found.price || 0;
    }
  }

  async function handleSubmit(e: Event) {
    e.preventDefault();
    if (!selectedProductId) {
      toast.error('Seleziona un articolo da movimentare');
      return;
    }
    if (quantity <= 0) {
      toast.error('Inserisci una quantità valida maggiore di 0');
      return;
    }

    const prod = productsCatalog.find(p => p.id === selectedProductId);
    if (!prod) return;

    const fromPlaceObj = placesList.find(p => p.id === fromPlaceId);
    const toPlaceObj = placesList.find(p => p.id === toPlaceId);

    isSaving = true;
    try {
      await WarehouseService.recordManualMovement({
        movementType,
        productId: prod.id,
        productName: prod.name,
        sku: prod.sku || '',
        unit: prod.unit || 'pz',
        quantity,
        unitCost,
        fromPlaceId: movementType === 'TRANSFER' || movementType.startsWith('OUT_') ? fromPlaceId : undefined,
        fromPlaceName: movementType === 'TRANSFER' || movementType.startsWith('OUT_') ? (fromPlaceObj?.name || fromPlaceId) : undefined,
        toPlaceId: movementType === 'TRANSFER' || movementType.startsWith('IN_') ? toPlaceId : undefined,
        toPlaceName: movementType === 'TRANSFER' || movementType.startsWith('IN_') ? (toPlaceObj?.name || toPlaceId) : undefined,
        batchNumber,
        expiryDate,
        performedByUid: authState.user?.uid || 'system',
        performedByName: authState.user?.displayName || authState.user?.email || 'Operatore',
        notes
      });

      toast.success('Movimentazione registrata con successo');
      goto('/dashboard/warehouse/movements');
    } catch (err: any) {
      console.error('Errore registrazione movimento:', err);
      toast.error(err.message || 'Errore durante la registrazione');
    } finally {
      isSaving = false;
    }
  }
</script>

<svelte:head>
  <title>Nuova Movimentazione Manuale - Gestoray</title>
</svelte:head>

<div class="form-page-container">
  <!-- Page Top Actions Bar -->
  <div class="page-top-actions">
    <div class="header-left">
      <div class="title-row">
        <div class="icon-bubble">
          <RefreshCw size={24} class="text-primary-600" />
        </div>
        <div>
          <h1 class="page-title">Nuova Movimentazione Magazzino</h1>
          <p class="page-subtitle">Registra un carico iniziale, scarico per consumo cantiere o trasferimento interno</p>
        </div>
      </div>
    </div>

    <div class="header-right">
      <a href="/dashboard/warehouse/movements" class="btn-module-list">
        <List size={16} />
        <span>Elenco Movimenti</span>
      </a>
    </div>
  </div>

  <!-- Form Card (100% Full Width) -->
  <div class="form-card">
    <form onsubmit={handleSubmit} class="form-layout">
      <!-- Tipo Movimento -->
      <div class="form-section">
        <h3 class="section-title">Tipologia di Movimentazione</h3>
        <div class="form-group">
          <label for="movementType">Seleziona Tipo di Operazione *</label>
          <select id="movementType" bind:value={movementType} class="form-select">
            <option value="IN_INITIAL">[Carico] Rettifica Positiva / Entrata Merce</option>
            <option value="IN_RETURN">[Reso] Materiale da Cantiere o Cliente</option>
            <option value="OUT_SITE_USAGE">[Scarico] Consumo / Utilizzo in Cantiere</option>
            <option value="OUT_SALE">[Scarico] Vendita Diretta Cliente</option>
            <option value="OUT_SCRAP">[Scarico] Rottamazione / Merce Danneggiata</option>
            <option value="TRANSFER">[Trasferimento] Movimentazione tra Depositi</option>
          </select>
        </div>
      </div>

      <!-- Articolo & Quantità -->
      <div class="form-section">
        <h3 class="section-title">Articolo & Quantità</h3>
        <div class="fields-grid">
          <div class="form-group col-span-2">
            <label for="productSelect">Articolo da Catalogo *</label>
            {#if productsCatalog.length === 0}
              <div class="no-prods-warning">
                <span>Nessun prodotto a catalogo trovato.</span>
                <a href="/dashboard/products" class="text-primary-600 font-semibold underline">Vai a Prodotti</a>
              </div>
            {:else}
              <Autocomplete 
                options={productOptions} 
                bind:value={selectedProductId} 
                onchange={handleProductSelect}
                placeholder="Cerca articolo a catalogo..." 
              />
            {/if}
          </div>

          <div class="form-group">
            <label for="quantity">Quantità da Movimentare *</label>
            <input type="number" id="quantity" bind:value={quantity} min="0.1" step="any" required class="form-input" />
          </div>

          {#if movementType.startsWith('IN_')}
            <div class="form-group">
              <label for="unitCost">Costo d'Acquisto Unitario (€)</label>
              <input type="number" id="unitCost" bind:value={unitCost} min="0" step="0.01" class="form-input" />
            </div>
          {/if}
        </div>
      </div>

      <!-- Depositi & Cantieri -->
      <div class="form-section">
        <h3 class="section-title">Deposito / Sede Coinvolta</h3>
        <div class="fields-grid">
          {#if movementType === 'TRANSFER' || movementType.startsWith('OUT_')}
            <div class="form-group">
              <label for="fromPlace">Deposito di Origine (Da dove si preleva) *</label>
              <Autocomplete 
                options={placeOptions} 
                bind:value={fromPlaceId} 
                placeholder="Seleziona deposito origine..." 
              />
            </div>
          {/if}

          {#if movementType === 'TRANSFER' || movementType.startsWith('IN_')}
            <div class="form-group">
              <label for="toPlace">Deposito di Destinazione (Dove si carica) *</label>
              <Autocomplete 
                options={placeOptions} 
                bind:value={toPlaceId} 
                placeholder="Seleziona deposito destinazione..." 
              />
            </div>
          {/if}

          <div class="form-group">
            <label for="batch">Lotto / Matricola (Opzionale)</label>
            <input type="text" id="batch" bind:value={batchNumber} placeholder="Es. LOTTO-2026-A" class="form-input" />
          </div>

          <div class="form-group">
            <label for="expiry">Data Scadenza Lotto (Opzionale)</label>
            <input type="date" id="expiry" bind:value={expiryDate} class="form-input" />
          </div>
        </div>
      </div>

      <!-- Note -->
      <div class="form-section">
        <h3 class="section-title">Note & Causale Movimento</h3>
        <div class="form-group">
          <textarea id="notes" bind:value={notes} rows="2" placeholder="Riferimento commessa, cantiere o motivazione..." class="form-textarea"></textarea>
        </div>
      </div>

      <div class="form-actions">
        <a href="/dashboard/warehouse/movements" class="btn-secondary">Annulla</a>
        <button type="submit" class="btn-primary" disabled={isSaving}>
          {#if isSaving}
            <RefreshCw size={16} class="animate-spin" />
            <span>Registrazione Movimento...</span>
          {:else}
            <CheckCircle2 size={16} />
            <span>Conferma Movimentazione</span>
          {/if}
        </button>
      </div>
    </form>
  </div>
</div>

<style>
  .form-page-container {
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

  .form-card {
    width: 100%;
    background: #ffffff;
    border-radius: 12px;
    border: 1px solid var(--color-slate-200, #e2e8f0);
    padding: 2rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  }

  .form-layout {
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  .form-section {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding-bottom: 1.5rem;
    border-bottom: 1px solid var(--color-slate-100, #f1f5f9);
  }

  .section-title {
    font-size: 1rem;
    font-weight: 600;
    color: var(--color-slate-800, #1e293b);
    margin: 0;
  }

  .fields-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
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

  .form-select, .form-input, .form-textarea {
    width: 100%;
    padding: 0.625rem 0.875rem;
    border-radius: 8px;
    border: 1px solid var(--color-slate-300, #cbd5e1);
    font-size: 0.875rem;
    color: var(--color-slate-900, #0f172a);
    background: #ffffff;
  }

  .form-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 1rem;
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

  .btn-secondary {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1.25rem;
    background: #ffffff;
    color: var(--color-slate-700, #334155);
    border-radius: 8px;
    font-weight: 500;
    font-size: 0.875rem;
    border: 1px solid var(--color-slate-300, #cbd5e1);
    text-decoration: none;
  }
</style>
