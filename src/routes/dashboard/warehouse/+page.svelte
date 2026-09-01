<script lang="ts">
  import { onMount } from 'svelte';
  import { fade, scale } from 'svelte/transition';
  import { WarehouseService } from './warehouse.service';
  import type { WarehouseInventoryItem, StockMovementType } from './schema';
  import { toast } from '$lib/stores/toast.svelte';
  import { confirmStore } from '$lib/stores/confirm.svelte';
  import { authState } from '$lib/auth.svelte';
  import { 
    Warehouse, 
    Truck, 
    Boxes, 
    ArrowDownLeft, 
    ArrowUpRight, 
    RefreshCw, 
    AlertTriangle, 
    Plus, 
    Search, 
    FileText, 
    CheckCircle2, 
    Building2, 
    Layers, 
    List, 
    Filter,
    X,
    TrendingUp,
    MapPin
  } from '@lucide/svelte';
  import SearchToolbar from '$lib/components/SearchToolbar.svelte';
  import FilterSelect from '$lib/components/FilterSelect.svelte';

  let inventory = $state<WarehouseInventoryItem[]>([]);
  let loading = $state(true);
  let searchQuery = $state('');
  let selectedPlaceFilter = $state<string>('all');
  let onlyLowStock = $state(false);

  // Quick movement modal state
  let showMovementModal = $state(false);
  let movementType = $state<StockMovementType>('IN_INITIAL');
  let selectedItem = $state<WarehouseInventoryItem | null>(null);
  let movQuantity = $state<number>(1);
  let movUnitCost = $state<number>(0);
  let movDestinationPlace = $state<string>('default');
  let movNotes = $state<string>('');
  let isSavingMovement = $state(false);

  // Available places lookup (from loaded inventory or default)
  let availablePlaces = $derived.by(() => {
    const placesMap = new Map<string, string>();
    placesMap.set('all', 'Tutti i Depositi & Cantieri');
    placesMap.set('default', 'Magazzino Centrale');
    for (const item of inventory) {
      if (item.placeId && item.placeId !== 'default') {
        placesMap.set(item.placeId, item.placeName || item.placeId);
      }
    }
    return Array.from(placesMap.entries()).map(([value, label]) => ({ value, label }));
  });

  $effect(() => {
    if (authState.initialized && authState.user) {
      loadInventoryData();
    }
  });

  async function loadInventoryData() {
    loading = true;
    try {
      inventory = await WarehouseService.getInventory();
    } catch (err) {
      console.error('Errore caricamento giacenze:', err);
      toast.error('Errore durante il caricamento del magazzino');
    } finally {
      loading = false;
    }
  }

  let filteredInventory = $derived(
    inventory.filter(item => {
      if (selectedPlaceFilter !== 'all' && item.placeId !== selectedPlaceFilter) {
        return false;
      }
      if (onlyLowStock && !item.isLowStock) {
        return false;
      }
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        item.productName.toLowerCase().includes(q) ||
        (item.sku && item.sku.toLowerCase().includes(q)) ||
        (item.category && item.category.toLowerCase().includes(q)) ||
        (item.placeName && item.placeName.toLowerCase().includes(q))
      );
    })
  );

  let totalStockValue = $derived(
    inventory.reduce((acc, item) => acc + (item.totalValuation || 0), 0)
  );

  let lowStockCount = $derived(
    inventory.filter(item => item.isLowStock).length
  );

  let totalUnitsCount = $derived(
    inventory.reduce((acc, item) => acc + (item.stockQty || 0), 0)
  );

  function openMovementModal(item?: WarehouseInventoryItem, type: StockMovementType = 'IN_INITIAL') {
    selectedItem = item || null;
    movementType = type;
    movQuantity = 1;
    movUnitCost = item ? item.avgUnitCost : 0;
    movDestinationPlace = item ? item.placeId : 'default';
    movNotes = '';
    showMovementModal = true;
  }

  async function handleSaveMovement() {
    if (!selectedItem) {
      toast.error('Seleziona un articolo');
      return;
    }
    if (movQuantity <= 0) {
      toast.error('Inserisci una quantità valida maggiore di 0');
      return;
    }

    isSavingMovement = true;
    try {
      await WarehouseService.recordManualMovement({
        movementType,
        productId: selectedItem.productId,
        productName: selectedItem.productName,
        sku: selectedItem.sku,
        unit: selectedItem.unit,
        quantity: movQuantity,
        unitCost: movUnitCost,
        fromPlaceId: movementType === 'TRANSFER' || movementType.startsWith('OUT_') ? selectedItem.placeId : undefined,
        fromPlaceName: movementType === 'TRANSFER' || movementType.startsWith('OUT_') ? selectedItem.placeName : undefined,
        toPlaceId: movementType === 'TRANSFER' || movementType.startsWith('IN_') ? movDestinationPlace : undefined,
        performedByUid: authState.user?.uid || 'system',
        performedByName: authState.user?.displayName || authState.user?.email || 'Operatore',
        notes: movNotes
      });

      toast.success('Movimentazione registrata con successo');
      showMovementModal = false;
      await loadInventoryData();
    } catch (err: any) {
      console.error('Errore registrazione movimento:', err);
      toast.error(err.message || 'Errore durante la registrazione del movimento');
    } finally {
      isSavingMovement = false;
    }
  }
</script>

<svelte:head>
  <title>Magazzino & Giacenze - Gestoray</title>
</svelte:head>

<div class="warehouse-container">
  <!-- Page Top Actions Bar -->
  <div class="page-top-actions">
    <div class="header-left">
      <div class="title-row">
        <div class="icon-bubble">
          <Warehouse size={24} class="text-primary-600" />
        </div>
        <div>
          <h1 class="page-title">Magazzino & Giacenze</h1>
          <p class="page-subtitle">Gestione scorte multi-deposito, valorizzazione CMP e controllo sottoscorte</p>
        </div>
      </div>
    </div>

    <div class="header-right">
      <div class="sub-nav-chips">
        <a href="/dashboard/warehouse" class="nav-chip active">
          <Boxes size={14} />
          <span>Giacenze</span>
        </a>
        <a href="/dashboard/warehouse/orders" class="nav-chip">
          <Truck size={14} />
          <span>Ordini Fornitore</span>
        </a>
        <a href="/dashboard/warehouse/movements" class="nav-chip">
          <RefreshCw size={14} />
          <span>Movimentazioni</span>
        </a>
        <a href="/dashboard/warehouse/suppliers" class="nav-chip">
          <Building2 size={14} />
          <span>Fornitori</span>
        </a>
      </div>
    </div>
  </div>

  <!-- KPI Summary Metrics Grid -->
  <div class="kpi-grid">
    <div class="kpi-card">
      <div class="kpi-icon bg-blue-50 text-blue-600">
        <Warehouse size={20} />
      </div>
      <div class="kpi-content">
        <span class="kpi-label">Valore Totale Stock</span>
        <span class="kpi-value">€ {totalStockValue.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        <span class="kpi-sub">Costo Medio Ponderato (CMP)</span>
      </div>
    </div>

    <div class="kpi-card">
      <div class="kpi-icon bg-emerald-50 text-emerald-600">
        <Boxes size={20} />
      </div>
      <div class="kpi-content">
        <span class="kpi-label">Unità Fisiche Totali</span>
        <span class="kpi-value">{totalUnitsCount.toLocaleString('it-IT')}</span>
        <span class="kpi-sub">{inventory.length} articoli registrati</span>
      </div>
    </div>

    <div class="kpi-card {lowStockCount > 0 ? 'border-amber-300 bg-amber-50/40' : ''}">
      <div class="kpi-icon {lowStockCount > 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}">
        <AlertTriangle size={20} />
      </div>
      <div class="kpi-content">
        <span class="kpi-label">Articoli Sottoscorta</span>
        <span class="kpi-value {lowStockCount > 0 ? 'text-amber-700 font-bold' : ''}">{lowStockCount}</span>
        <span class="kpi-sub">{lowStockCount > 0 ? 'Necessario riordino' : 'Scorte regolari'}</span>
      </div>
    </div>
  </div>

  <!-- Centralized Search Toolbar -->
  <div class="search-section">
    <SearchToolbar
      bind:searchQuery
      placeholder="Cerca articolo per nome, codice SKU o categoria..."
    >
      {#snippet filtersSnippet()}
        <div class="toolbar-filters">
          <FilterSelect
            bind:value={selectedPlaceFilter}
            options={availablePlaces}
          />

          <button 
            type="button"
            class="filter-toggle-btn {onlyLowStock ? 'active' : ''}"
            onclick={() => onlyLowStock = !onlyLowStock}
          >
            <AlertTriangle size={14} />
            <span>Solo Sottoscorte</span>
          </button>
        </div>
      {/snippet}
    </SearchToolbar>
  </div>

  <!-- Data Card (Giacenze Table) -->
  <div class="data-card">
    {#if loading}
      <div class="loading-state">
        <RefreshCw size={28} class="animate-spin text-primary-500" />
        <p>Caricamento giacenze in corso...</p>
      </div>
    {:else if filteredInventory.length === 0}
      <div class="empty-state">
        <Boxes size={48} class="text-slate-300" />
        <h3>Nessun articolo trovato</h3>
        <p>Non sono presenti giacenze corrispondenti ai filtri impostati o il magazzino è vuoto.</p>
        <div class="empty-actions">
          <a href="/dashboard/warehouse/orders/add" class="btn-primary">
            <Plus size={16} />
            <span>Nuovo Ordine Fornitore</span>
          </a>
        </div>
      </div>
    {:else}
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Articolo / SKU</th>
              <th>Deposito / Sede</th>
              <th class="text-right">Giacenza</th>
              <th class="text-right">Disponibile</th>
              <th class="text-right">CMP Unitario</th>
              <th class="text-right">Valore Totale</th>
              <th class="text-center">Stato Scorta</th>
              <th class="text-right">Azioni</th>
            </tr>
          </thead>
          <tbody>
            {#each filteredInventory as item (item.id)}
              <tr class={item.isLowStock ? 'row-warning' : ''}>
                <td>
                  <div class="item-name-cell">
                    <span class="product-name">{item.productName}</span>
                    <span class="product-sku">{item.sku || 'N/D'}</span>
                  </div>
                </td>
                <td>
                  <div class="place-tag">
                    <MapPin size={12} class="text-slate-400" />
                    <span>{item.placeName || 'Magazzino Centrale'}</span>
                  </div>
                </td>
                <td class="text-right font-medium">
                  {item.stockQty} <span class="unit-label">{item.unit || 'pz'}</span>
                </td>
                <td class="text-right font-medium">
                  {item.availableQty} <span class="unit-label">{item.unit || 'pz'}</span>
                </td>
                <td class="text-right">
                  € {(item.avgUnitCost || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td class="text-right font-semibold text-slate-800">
                  € {(item.totalValuation || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td class="text-center">
                  {#if item.isLowStock}
                    <span class="badge badge-warning">
                      <AlertTriangle size={12} />
                      <span>Sottoscorta (Min: {item.minReorderThreshold})</span>
                    </span>
                  {:else}
                    <span class="badge badge-success">
                      <CheckCircle2 size={12} />
                      <span>Regolare</span>
                    </span>
                  {/if}
                </td>
                <td class="text-right">
                  <button 
                    type="button" 
                    class="btn-action"
                    title="Registra Movimento Rapido"
                    onclick={() => openMovementModal(item, 'OUT_SITE_USAGE')}
                  >
                    <RefreshCw size={14} />
                    <span>Movimento</span>
                  </button>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>
</div>

<!-- Modal Movimentazione Rapida -->
{#if showMovementModal && selectedItem}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="modal-overlay" transition:fade={{ duration: 150 }} onclick={() => showMovementModal = false}>
    <div class="modal-content" transition:scale={{ duration: 200, start: 0.95 }} onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <div class="modal-title">
          <RefreshCw size={18} class="text-primary-600" />
          <span>Nuova Movimentazione: {selectedItem.productName}</span>
        </div>
        <button class="close-btn" onclick={() => showMovementModal = false}>
          <X size={18} />
        </button>
      </div>

      <div class="modal-body">
        <div class="form-group">
          <label for="mov-type">Tipo Movimento</label>
          <select id="mov-type" bind:value={movementType} class="form-select">
            <option value="IN_INITIAL">Carico / Rettifica Positiva</option>
            <option value="IN_RETURN">Reso da Cantiere o Cliente</option>
            <option value="OUT_SITE_USAGE">Scarico per Consumo in Cantiere</option>
            <option value="OUT_SALE">Scarico per Vendita Cliente</option>
            <option value="OUT_SCRAP">Scarico per Rottamazione / Difetto</option>
            <option value="TRANSFER">Trasferimento ad Altro Deposito</option>
          </select>
        </div>

        <div class="form-row">
          <div class="form-group flex-1">
            <label for="mov-qty">Quantità ({selectedItem.unit || 'pz'})</label>
            <input 
              type="number" 
              id="mov-qty" 
              bind:value={movQuantity} 
              min="0.1" 
              step="any" 
              class="form-input" 
            />
          </div>

          {#if movementType.startsWith('IN_')}
            <div class="form-group flex-1">
              <label for="mov-cost">Costo Unitario (€)</label>
              <input 
                type="number" 
                id="mov-cost" 
                bind:value={movUnitCost} 
                min="0" 
                step="0.01" 
                class="form-input" 
              />
            </div>
          {/if}
        </div>

        {#if movementType === 'TRANSFER'}
          <div class="form-group">
            <label for="mov-dest">Deposito Destinazione</label>
            <select id="mov-dest" bind:value={movDestinationPlace} class="form-select">
              {#each availablePlaces.filter(p => p.value !== 'all' && p.value !== selectedItem?.placeId) as place}
                <option value={place.value}>{place.label}</option>
              {/each}
            </select>
          </div>
        {/if}

        <div class="form-group">
          <label for="mov-notes">Note Movimento</label>
          <textarea 
            id="mov-notes" 
            bind:value={movNotes} 
            rows="2" 
            placeholder="Riferimento cantiere, commessa o causale..."
            class="form-textarea"
          ></textarea>
        </div>

        <div class="modal-actions">
          <button 
            type="button" 
            class="btn-secondary" 
            onclick={() => showMovementModal = false}
          >
            Annulla
          </button>
          <button 
            type="button" 
            class="btn-primary" 
            disabled={isSavingMovement}
            onclick={handleSaveMovement}
          >
            {#if isSavingMovement}
              <RefreshCw size={14} class="animate-spin" />
              <span>Salvataggio...</span>
            {:else}
              <CheckCircle2 size={14} />
              <span>Conferma Movimento</span>
            {/if}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .warehouse-container {
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

  .sub-nav-chips {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: var(--color-slate-100, #f1f5f9);
    padding: 0.25rem;
    border-radius: 9999px;
  }

  .nav-chip {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.375rem 0.875rem;
    border-radius: 9999px;
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--color-slate-600, #475569);
    text-decoration: none;
    transition: all 0.15s ease;
  }

  .nav-chip:hover {
    color: var(--color-slate-900, #0f172a);
    background: rgba(255, 255, 255, 0.6);
  }

  .nav-chip.active {
    background: #ffffff;
    color: var(--color-primary-600, #2563eb);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
    font-weight: 600;
  }

  .kpi-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 1rem;
  }

  .kpi-card {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1.25rem;
    background: #ffffff;
    border-radius: 12px;
    border: 1px solid var(--color-slate-200, #e2e8f0);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  }

  .kpi-icon {
    width: 44px;
    height: 44px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .kpi-content {
    display: flex;
    flex-direction: column;
  }

  .kpi-label {
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.025em;
    color: var(--color-slate-500, #64748b);
  }

  .kpi-value {
    font-size: 1.375rem;
    font-weight: 700;
    color: var(--color-slate-900, #0f172a);
    line-height: 1.2;
    margin: 0.125rem 0;
  }

  .kpi-sub {
    font-size: 0.75rem;
    color: var(--color-slate-400, #94a3b8);
  }

  .search-section {
    width: 100%;
  }

  .toolbar-filters {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .filter-toggle-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.45rem 0.75rem;
    border-radius: 8px;
    font-size: 0.8125rem;
    font-weight: 500;
    border: 1px solid var(--color-slate-300, #cbd5e1);
    background: #ffffff;
    color: var(--color-slate-700, #334155);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .filter-toggle-btn.active {
    background: var(--color-amber-50, #fffbeb);
    border-color: var(--color-amber-400, #fbbf24);
    color: var(--color-amber-800, #92400e);
    font-weight: 600;
  }

  .data-card {
    background: #ffffff;
    border-radius: 12px;
    border: 1px solid var(--color-slate-200, #e2e8f0);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    overflow: hidden;
  }

  .table-responsive {
    width: 100%;
    overflow-x: auto;
  }

  .data-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;
    text-align: left;
  }

  .data-table th {
    background: var(--color-slate-50, #f8fafc);
    padding: 0.75rem 1rem;
    font-weight: 600;
    color: var(--color-slate-600, #475569);
    border-bottom: 1px solid var(--color-slate-200, #e2e8f0);
    white-space: nowrap;
  }

  .data-table td {
    padding: 0.875rem 1rem;
    border-bottom: 1px solid var(--color-slate-100, #f1f5f9);
    color: var(--color-slate-700, #334155);
  }

  .data-table tr:hover td {
    background: var(--color-slate-50, #f8fafc);
  }

  .data-table tr.row-warning td {
    background: rgba(254, 243, 199, 0.2);
  }

  .item-name-cell {
    display: flex;
    flex-direction: column;
  }

  .product-name {
    font-weight: 600;
    color: var(--color-slate-900, #0f172a);
  }

  .product-sku {
    font-size: 0.75rem;
    color: var(--color-slate-400, #94a3b8);
  }

  .place-tag {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.8125rem;
    color: var(--color-slate-600, #475569);
  }

  .unit-label {
    font-size: 0.75rem;
    color: var(--color-slate-400, #94a3b8);
    font-weight: normal;
  }

  .badge {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.25rem 0.5rem;
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 600;
  }

  .badge-success {
    background: var(--color-emerald-50, #ecfdf5);
    color: var(--color-emerald-700, #047857);
  }

  .badge-warning {
    background: var(--color-amber-50, #fffbeb);
    color: var(--color-amber-700, #b45309);
    border: 1px solid var(--color-amber-200, #fde68a);
  }

  .btn-action {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.375rem 0.625rem;
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 500;
    border: 1px solid var(--color-slate-200, #e2e8f0);
    background: #ffffff;
    color: var(--color-slate-700, #334155);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-action:hover {
    background: var(--color-slate-100, #f1f5f9);
    color: var(--color-slate-900, #0f172a);
  }

  .loading-state, .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4rem 2rem;
    text-align: center;
    gap: 0.75rem;
    color: var(--color-slate-500, #64748b);
  }

  .empty-state h3 {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--color-slate-800, #1e293b);
    margin: 0;
  }

  .empty-state p {
    font-size: 0.875rem;
    margin: 0;
    max-width: 420px;
  }

  .empty-actions {
    margin-top: 0.5rem;
  }

  .btn-primary {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: var(--color-primary-600, #2563eb);
    color: #ffffff;
    border-radius: 8px;
    font-weight: 600;
    font-size: 0.875rem;
    text-decoration: none;
    border: none;
    cursor: pointer;
  }

  .btn-secondary {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: #ffffff;
    color: var(--color-slate-700, #334155);
    border-radius: 8px;
    font-weight: 500;
    font-size: 0.875rem;
    border: 1px solid var(--color-slate-300, #cbd5e1);
    cursor: pointer;
  }

  /* Modal Overlay Styles */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.6);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 999;
    padding: 1rem;
  }

  .modal-content {
    background: #ffffff;
    border-radius: 12px;
    width: 100%;
    max-width: 520px;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
    overflow: hidden;
  }

  .modal-header {
    padding: 1.25rem 1.5rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid var(--color-slate-100, #f1f5f9);
  }

  .modal-title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 1rem;
    font-weight: 600;
    color: var(--color-slate-900, #0f172a);
  }

  .close-btn {
    background: transparent;
    border: none;
    color: var(--color-slate-400, #94a3b8);
    cursor: pointer;
    padding: 0.25rem;
    border-radius: 6px;
  }

  .close-btn:hover {
    color: var(--color-slate-700, #334155);
    background: var(--color-slate-100, #f1f5f9);
  }

  .modal-body {
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

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
    padding: 0.5rem 0.75rem;
    border-radius: 6px;
    border: 1px solid var(--color-slate-300, #cbd5e1);
    font-size: 0.875rem;
    color: var(--color-slate-800, #1e293b);
  }

  .form-row {
    display: flex;
    gap: 1rem;
  }

  .modal-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.75rem;
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid var(--color-slate-100, #f1f5f9);
  }

  .text-right { text-align: right; }
  .text-center { text-align: center; }
  .flex-1 { flex: 1; }
</style>
