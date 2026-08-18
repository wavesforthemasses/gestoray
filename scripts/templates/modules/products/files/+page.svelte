<script lang="ts">
  import { projectStore } from '$lib/stores/project';
  import { onMount } from 'svelte';
  import { ProductsService } from './products.service';
  import type { ProductItem, ProductType } from './schema';
  import { UnitsOfMeasureService } from '$lib/services/unitsOfMeasureService';
  import { ProductSettingsService, type ProductFieldsSettings, DEFAULT_PRODUCT_FIELDS_SETTINGS } from '$lib/services/productSettingsService';
  import { toast } from '$lib/stores/toast.svelte';
  import { confirmStore } from '$lib/stores/confirm.svelte';
  import { 
    Package, 
    Briefcase, 
    Zap, 
    Euro, 
    Search, 
    Plus, 
    Eye, 
    Pencil, 
    Trash2, 
    Boxes, 
    Minus, 
    CheckCircle2, 
    AlertTriangle, 
    AlertCircle, 
    Layers 
  } from '@lucide/svelte';
  import { UniversalAnalyticsChart, ChartSettingsService } from '$lib';
  import { DashboardService } from '../dashboard.service';
  import { activeRoleState, authState } from '$lib/auth.svelte';

  let products = $state<ProductItem[]>([]);
  let loading = $state(true);
  let searchQuery = $state('');
  let selectedTypeFilter = $state<ProductType | 'all'>('all');
  let fieldSettings = $state<ProductFieldsSettings>({ ...DEFAULT_PRODUCT_FIELDS_SETTINGS });

  $effect(() => {
    if (authState.initialized && authState.user) {
      loadProductsData();
    }
  });

  async function loadProductsData() {
    loading = true;
    try {
      const [prods, loadedSettings] = await Promise.all([
        ProductsService.getProducts(),
        ProductSettingsService.getSettings()
      ]);
      products = prods;
      fieldSettings = loadedSettings;
    } catch (e) {
      console.error('Errore caricamento prodotti:', e);
    } finally {
      loading = false;
    }
  }

  let filteredProducts = $derived(
    products.filter(p => {
      const pType = p.type || 'product';
      if (selectedTypeFilter !== 'all' && pType !== selectedTypeFilter) {
        return false;
      }

      if (!searchQuery.trim()) return true;

      const q = searchQuery.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        (fieldSettings.sku.visible && p.sku && p.sku.toLowerCase().includes(q)) ||
        (fieldSettings.category.visible && p.category && p.category.toLowerCase().includes(q)) ||
        (p.minimoFatturabile?.displayText && p.minimoFatturabile.displayText.toLowerCase().includes(q))
      );
    })
  );

  let totalProducts = $derived(products.length);
  let physicalProductsCount = $derived(products.filter(p => (p.type || 'product') === 'product').length);
  let servicesAndDigitalCount = $derived(products.filter(p => p.type === 'service' || p.type === 'digital').length);
  
  // Total stock value calculated only for items with active stock tracking
  let totalStockValue = $derived(
    products
      .filter(p => p.trackStock !== false)
      .reduce((acc, curr) => acc + ((curr.price || 0) * Math.max(0, curr.stockQty || 0)), 0)
  );

  async function handleDelete(id?: string) {
    if (!id) return;
    const confirmed = await confirmStore.prompt('Sei sicuro di voler eliminare questo articolo dal catalogo?');
    if (!confirmed) return;
    try {
      const tenantId = (authState.user as any)?.tenantId || 'default';
      await ProductsService.deleteProduct(id, {
        uid: authState.user?.uid || 'system',
        userEmail: authState.user?.email || undefined,
        tenantId
      });
      products = products.filter(p => p.id !== id);
      toast.success('Articolo eliminato con successo');
    } catch (err: any) {
      toast.error('Errore eliminazione articolo: ' + err.message);
    }
  }

  let activeChartTab = $state('total_products');
  let granularity = $state<'settimanale' | 'mensile' | 'annuale'>('mensile');
  let endDateString = $state(new Date().toISOString().split('T')[0]);
  let isGraphExpanded = $state(false);
  let selectedPointIdx = $state<number | null>(null);
  let chartPeriods = $state<Array<{ start: Date; end: Date; label: string }>>([]);
  let loadingChart = $state(false);
  let computedChartPoints = $state<number[]>([]);

  let activeEntityConfig = $derived(ChartSettingsService.getEntityConfigSync('products'));
  let sideKpisPosition = $derived<'right' | 'none'>(
    activeEntityConfig && activeEntityConfig.showSideKpis !== false ? 'right' : 'none'
  );
  let availableChartMetrics = $derived(
    (activeEntityConfig?.enabled ? activeEntityConfig.kpis || [] : [])
      .filter(k => k.enabled)
      .map(k => ({
        id: k.id,
        label: k.name,
        shortLabel: k.acronym,
        isCurrency: k.isCurrency
      }))
  );

  $effect(() => {
    chartPeriods = DashboardService.generateChartPeriods(endDateString, granularity);
  });

  async function loadChartData() {
    if (!isGraphExpanded || chartPeriods.length === 0) return;
    loadingChart = true;
    try {
      const roleToUse = activeRoleState.role || '';
      const uidToUse = authState.user?.uid || '';
      const results = await DashboardService.fetchChartAggregations(chartPeriods, roleToUse, uidToUse, activeChartTab);
      computedChartPoints = results || chartPeriods.map(() => 0);
    } catch (e) {
      console.error('Errore caricamento dati grafico prodotti:', e);
      computedChartPoints = chartPeriods.map(() => 0);
    } finally {
      loadingChart = false;
    }
  }

  $effect(() => {
    if (isGraphExpanded && (granularity || endDateString || activeChartTab)) {
      loadChartData();
    }
  });
</script>

<svelte:head>
  <title>Catalogo Prodotti & Servizi | {$projectStore?.projectName || 'ERP'}</title>
</svelte:head>

<div class="products-page animate-fade-in">
  <header class="page-header">
    <div>
      <h1 class="page-title">
        <Boxes size={26} class="title-icon" /> Catalogo Prodotti & Servizi
      </h1>
      <p class="page-subtitle">Gestisci beni materiali, prestazioni di servizio, licenze digitali e listini prezzi.</p>
    </div>
    <div class="header-actions">
      <a href="/dashboard/products/add" class="btn btn-primary">
        <Plus size={16} /> Nuovo Articolo
      </a>
    </div>
  </header>

  <!-- KPI CARDS -->
  <div class="kpi-grid">
    <div class="kpi-card">
      <div class="kpi-icon-wrapper primary-bg">
        <Boxes size={22} />
      </div>
      <div>
        <div class="kpi-value">{totalProducts}</div>
        <div class="kpi-label">Articoli Totali</div>
      </div>
    </div>

    <div class="kpi-card">
      <div class="kpi-icon-wrapper indigo-bg">
        <Package size={22} />
      </div>
      <div>
        <div class="kpi-value">{physicalProductsCount}</div>
        <div class="kpi-label">Prodotti Fisici</div>
      </div>
    </div>

    <div class="kpi-card">
      <div class="kpi-icon-wrapper blue-bg">
        <Briefcase size={22} />
      </div>
      <div>
        <div class="kpi-value">{servicesAndDigitalCount}</div>
        <div class="kpi-label">Servizi & Digitali</div>
      </div>
    </div>

    {#if fieldSettings.stockQty.visible}
      <div class="kpi-card">
        <div class="kpi-icon-wrapper success-bg">
          <Euro size={22} />
        </div>
        <div>
          <div class="kpi-value">€ {totalStockValue.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</div>
          <div class="kpi-label">Valore Scorte a Magazzino</div>
        </div>
      </div>
    {/if}
  </div>

  {#if activeEntityConfig?.enabled && availableChartMetrics.length > 0}
    <UniversalAnalyticsChart 
      title="Andamento Catalogo & Scorte"
      description="Visualizza il trend del catalogo articoli e della valorizzazione nel tempo."
      metrics={availableChartMetrics}
      bind:activeMetric={activeChartTab}
      bind:granularity
      bind:endDateString
      {chartPeriods}
      {computedChartPoints}
      bind:selectedPointIdx
      {loadingChart}
      collapsible={true}
      bind:isExpanded={isGraphExpanded}
      kpisPosition={sideKpisPosition}
    />
  {/if}

  <!-- CONTROLS & FILTER BAR -->
  <div class="controls-card">
    <!-- TYPE FILTER TABS -->
    <div class="type-filter-tabs">
      <button 
        type="button" 
        class="filter-tab {selectedTypeFilter === 'all' ? 'active' : ''}"
        onclick={() => selectedTypeFilter = 'all'}
      >
        <Layers size={14} /> Tutti ({totalProducts})
      </button>
      <button 
        type="button" 
        class="filter-tab {selectedTypeFilter === 'product' ? 'active' : ''}"
        onclick={() => selectedTypeFilter = 'product'}
      >
        <Package size={14} /> Prodotti ({physicalProductsCount})
      </button>
      <button 
        type="button" 
        class="filter-tab {selectedTypeFilter === 'service' ? 'active' : ''}"
        onclick={() => selectedTypeFilter = 'service'}
      >
        <Briefcase size={14} /> Servizi
      </button>
      <button 
        type="button" 
        class="filter-tab {selectedTypeFilter === 'digital' ? 'active' : ''}"
        onclick={() => selectedTypeFilter = 'digital'}
      >
        <Zap size={14} /> Digitali
      </button>
    </div>

    <!-- SEARCH BOX -->
    <div class="search-box">
      <Search size={16} class="search-icon" />
      <input 
        type="text" 
        placeholder="Cerca per codice SKU, denominazione articolo o categoria..." 
        bind:value={searchQuery} 
        class="search-input"
      />
    </div>
  </div>

  <!-- TABLE -->
  {#if loading}
    <div class="loading-state">
      <span class="spinner"></span>
      Caricamento catalogo in corso...
    </div>
  {:else if filteredProducts.length === 0}
    <div class="empty-state">
      <div class="empty-icon-wrapper">
        <Package size={42} />
      </div>
      <h3>Nessun articolo trovato</h3>
      <p>
        {#if searchQuery || selectedTypeFilter !== 'all'}
          Nessun articolo corrisponde ai filtri impostati. Prova a modificare la ricerca.
        {:else}
          Aggiungi il tuo primo articolo al catalogo per gestire prezzi, servizi e scorte.
        {/if}
      </p>
      <a href="/dashboard/products/add" class="btn btn-primary">
        <Plus size={16} /> Nuovo Articolo
      </a>
    </div>
  {:else}
    <div class="table-card">
      <table class="data-table">
        <thead>
          <tr>
            {#if fieldSettings.sku.visible}
              <th>SKU</th>
            {/if}
            <th>Tipo</th>
            <th>Nome Articolo</th>
            {#if fieldSettings.category.visible}
              <th>Categoria</th>
            {/if}
            <th>Tariffazione</th>
            <th>Prezzo Base</th>
            {#if fieldSettings.minimoFatturabile.visible}
              <th>Minimo Fatturabile</th>
            {/if}
            {#if fieldSettings.stockQty.visible}
              <th>Giacenza / Magazzino</th>
            {/if}
            <th class="text-right">Azioni</th>
          </tr>
        </thead>
        <tbody>
          {#each filteredProducts as p (p.id)}
            <tr>
              {#if fieldSettings.sku.visible}
                <td class="font-mono">{p.sku || '-'}</td>
              {/if}

              <td>
                {#if (p.type || 'product') === 'product'}
                  <span class="type-badge product-badge" title="Prodotto Fisico">
                    <Package size={12} /> Prodotto
                  </span>
                {:else if p.type === 'service'}
                  <span class="type-badge service-badge" title="Prestazione di Servizio">
                    <Briefcase size={12} /> Servizio
                  </span>
                {:else if p.type === 'digital'}
                  <span class="type-badge digital-badge" title="Bene Digitale">
                    <Zap size={12} /> Digitale
                  </span>
                {/if}
              </td>

              <td><strong class="text-neutral-800">{p.name}</strong></td>

              {#if fieldSettings.category.visible}
                <td><span class="category-pill">{p.category || 'Generale'}</span></td>
              {/if}

              <td>
                <span class="billing-pill">
                  {#if p.billingType === 'hourly'}
                    A Ore
                  {:else if p.billingType === 'recurring'}
                    Ricorrente ({p.recurrenceInterval === 'weekly' ? 'Sett.' : p.recurrenceInterval === 'quarterly' ? 'Trim.' : p.recurrenceInterval === 'yearly' ? 'Ann.' : 'Mens.'})
                  {:else}
                    A Corpo
                  {/if}
                </span>
              </td>

              <td class="font-bold text-primary">
                € {(p.price || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })} / <span class="uppercase">{p.unit}</span>
              </td>

              {#if fieldSettings.minimoFatturabile.visible}
                <td>
                  {#if p.minimoFatturabile && (p.minimoFatturabile.enabled || p.minimoFatturabile.displayText)}
                    <span class="minimo-pill" title={p.minimoFatturabile.displayText || `Sotto i ${p.minimoFatturabile.minQuantity} ${p.unit}`}>
                      <Zap size={12} class="icon-amber" />
                      {#if p.minimoFatturabile.displayText}
                        {p.minimoFatturabile.displayText}
                      {:else if p.minimoFatturabile.minQuantity && p.minimoFatturabile.flatPrice}
                        &lt; {p.minimoFatturabile.minQuantity} {p.unit} ({p.minimoFatturabile.flatPrice}€)
                      {/if}
                    </span>
                  {:else}
                    <span class="text-muted">-</span>
                  {/if}
                </td>
              {/if}

              {#if fieldSettings.stockQty.visible}
                <td>
                  {#if p.trackStock === false}
                    <span class="untracked-pill" title="Nessun monitoraggio giacenza">
                      <Minus size={12} /> Non gestita
                    </span>
                  {:else if (p.stockQty ?? 0) > (p.minStockThreshold || 0)}
                    <span class="stock-badge stock-ok" title="Disponibile a magazzino">
                      <CheckCircle2 size={12} /> {UnitsOfMeasureService.formatQuantity(p.stockQty ?? 0, p.unit)} {p.unit}
                    </span>
                  {:else if (p.stockQty ?? 0) > 0}
                    <span class="stock-badge stock-warning" title="Sottoscorta / Scorta bassa">
                      <AlertTriangle size={12} /> {UnitsOfMeasureService.formatQuantity(p.stockQty ?? 0, p.unit)} {p.unit}
                    </span>
                  {:else}
                    <span class="stock-badge stock-danger" title={p.allowOutOfStockSale !== false ? 'Esaurito - Backorder abilitato' : 'Esaurito'}>
                      <AlertCircle size={12} /> {UnitsOfMeasureService.formatQuantity(p.stockQty ?? 0, p.unit)} {p.unit} ({p.allowOutOfStockSale !== false ? 'Backorder' : 'Esaurito'})
                    </span>
                  {/if}
                </td>
              {/if}

              <td class="text-right">
                <div class="action-buttons">
                  <a href="/dashboard/products/{p.id}" class="btn-icon" title="Dettaglio Articolo">
                    <Eye size={16} />
                  </a>
                  <a href="/dashboard/products/{p.id}/edit" class="btn-icon" title="Modifica Articolo">
                    <Pencil size={16} />
                  </a>
                  <button type="button" class="btn-icon-danger" onclick={() => handleDelete(p.id)} title="Elimina Articolo">
                    <Trash2 size={16} />
                  </button>
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>

<style>
  .products-page { width: 100%; box-sizing: border-box; display: flex; flex-direction: column; gap: 1.5rem; }
  .page-header { display: flex; justify-content: space-between; align-items: center; }
  .page-title { font-size: 1.6rem; font-weight: 800; margin: 0; color: var(--color-neutral-900); display: flex; align-items: center; gap: 10px; }
  :global(.title-icon) { color: var(--color-primary-500); }
  :global(.icon-amber) { color: #d97706; }
  .page-subtitle { color: var(--color-neutral-500); font-size: 0.9rem; margin: 0.2rem 0 0 0; }

  .header-actions { display: flex; gap: 0.75rem; align-items: center; }

  .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; }
  .kpi-card { background: white; border: 1px solid var(--color-neutral-200); border-radius: var(--radius-lg); padding: 1rem 1.2rem; display: flex; align-items: center; gap: 1rem; box-shadow: var(--shadow-sm); }
  
  .kpi-icon-wrapper { width: 44px; height: 44px; border-radius: 10px; display: flex; align-items: center; justify-content: center; }
  .primary-bg { background: var(--color-primary-100); color: var(--color-primary-600); }
  .indigo-bg { background: #e0e7ff; color: #4338ca; }
  .blue-bg { background: #dbeafe; color: #1d4ed8; }
  .success-bg { background: #dcfce7; color: #15803d; }

  .kpi-value { font-size: 1.35rem; font-weight: 800; color: var(--color-neutral-900); }
  .kpi-label { font-size: 0.78rem; color: var(--color-neutral-500); font-weight: 600; }

  .controls-card { background: white; border: 1px solid var(--color-neutral-200); border-radius: var(--radius-lg); padding: 1rem; display: flex; flex-direction: column; gap: 0.8rem; box-shadow: var(--shadow-sm); }
  
  .type-filter-tabs { display: flex; gap: 0.5rem; flex-wrap: wrap; }
  .filter-tab {
    background: var(--color-neutral-100);
    border: 1px solid var(--color-neutral-200);
    padding: 0.45rem 0.9rem;
    border-radius: var(--radius-md);
    font-size: 0.82rem;
    font-weight: 600;
    color: var(--color-neutral-700);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    transition: all 0.2s ease;
  }
  .filter-tab:hover { background: var(--color-neutral-200); color: var(--color-neutral-900); }
  .filter-tab.active {
    background: var(--color-primary-600);
    border-color: var(--color-primary-600);
    color: white;
  }

  .search-box { position: relative; width: 100%; display: flex; align-items: center; }
  :global(.search-icon) { position: absolute; left: 12px; color: var(--color-neutral-400); top: 50%; transform: translateY(-50%); }
  .search-input { width: 100%; padding: 0.6rem 0.9rem 0.6rem 2.4rem; border: 1px solid var(--color-neutral-300); border-radius: var(--radius-md); font-size: 0.9rem; outline: none; box-sizing: border-box; }

  .table-card { background: white; border: 1px solid var(--color-neutral-200); border-radius: var(--radius-lg); overflow: hidden; box-shadow: var(--shadow-sm); }
  .data-table { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
  .data-table th, .data-table td { padding: 0.8rem 1rem; text-align: left; border-bottom: 1px solid var(--color-neutral-200); }
  .data-table th { background: var(--color-neutral-50); font-weight: 700; color: var(--color-neutral-700); font-size: 0.78rem; text-transform: uppercase; }

  .type-badge { font-size: 0.75rem; font-weight: 700; padding: 0.2rem 0.5rem; border-radius: 6px; display: inline-flex; align-items: center; gap: 4px; }
  .product-badge { background: #e0e7ff; color: #4338ca; }
  .service-badge { background: #dbeafe; color: #1d4ed8; }
  .digital-badge { background: #fef3c7; color: #b45309; }

  .category-pill { font-size: 0.78rem; background: var(--color-neutral-100); padding: 0.2rem 0.5rem; border-radius: 6px; color: var(--color-neutral-700); }
  .billing-pill { font-size: 0.75rem; background: #f1f5f9; color: #475569; padding: 0.2rem 0.5rem; border-radius: 4px; font-weight: 600; }
  .minimo-pill { font-size: 0.78rem; background: #fffbeb; color: #b45309; border: 1px solid #fde68a; padding: 0.2rem 0.5rem; border-radius: 6px; font-weight: 700; display: inline-flex; align-items: center; gap: 4px; }
  
  .stock-badge { font-size: 0.78rem; font-weight: 700; padding: 0.25rem 0.55rem; border-radius: 6px; display: inline-flex; align-items: center; gap: 4px; }
  .stock-ok { background: #dcfce7; color: #15803d; }
  .stock-warning { background: #fef3c7; color: #b45309; }
  .stock-danger { background: #fee2e2; color: #b91c1c; }
  .untracked-pill { font-size: 0.78rem; font-weight: 600; background: var(--color-neutral-100); color: var(--color-neutral-600); padding: 0.25rem 0.55rem; border-radius: 6px; display: inline-flex; align-items: center; gap: 4px; }
  .text-muted { color: var(--color-neutral-400); }

  .action-buttons { display: flex; gap: 0.4rem; justify-content: flex-end; }
  .btn { padding: 0.6rem 1.2rem; border-radius: var(--radius-md); font-weight: 600; cursor: pointer; border: none; text-decoration: none; font-size: 0.88rem; display: inline-flex; align-items: center; gap: 6px; }
  .btn-primary { background: var(--color-primary-600); color: white; }
  .btn-secondary { background: var(--color-neutral-100); color: var(--color-neutral-800); border: 1px solid var(--color-neutral-300); }
  .btn-secondary:hover { background: var(--color-neutral-200); }
  .btn-icon, .btn-icon-danger { background: none; border: none; cursor: pointer; color: var(--color-neutral-600); text-decoration: none; padding: 4px; border-radius: 4px; display: inline-flex; align-items: center; }
  .btn-icon:hover { color: var(--color-primary-600); background: var(--color-neutral-100); }
  .btn-icon-danger:hover { color: #dc2626; background: #fee2e2; }

  .loading-state, .empty-state { text-align: center; padding: 3rem; background: white; border-radius: var(--radius-lg); border: 1px solid var(--color-neutral-200); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.8rem; }
  .empty-icon-wrapper { width: 64px; height: 64px; border-radius: 16px; background: var(--color-primary-50); color: var(--color-primary-600); display: flex; align-items: center; justify-content: center; margin-bottom: 0.5rem; }
  .font-mono { font-family: monospace; font-weight: 600; }
  .font-bold { font-weight: 700; }
  .text-right { text-align: right; }
  .uppercase { text-transform: uppercase; }
  .text-primary { color: var(--color-primary-600); }
</style>
