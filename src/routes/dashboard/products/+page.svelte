<script lang="ts">
  import { projectStore } from '$lib/stores/project';
  import { onMount } from 'svelte';
  import { ProductsService } from './products.service';
  import type { ProductItem } from './schema';
  import { UnitsOfMeasureService } from '$lib/services/unitsOfMeasureService';
  import { ProductSettingsService, type ProductFieldsSettings, DEFAULT_PRODUCT_FIELDS_SETTINGS } from '$lib/services/productSettingsService';
  import { toast } from '$lib/stores/toast.svelte';
  import { confirmStore } from '$lib/stores/confirm.svelte';
  import { Package, Euro, Search, Plus, Eye, Pencil, Trash2, Zap, Sliders } from '@lucide/svelte';
  import { UniversalAnalyticsChart, ChartSettingsService } from '$lib';
  import { DashboardService } from '../dashboard.service';
  import { activeRoleState, authState } from '$lib/auth.svelte';

  let products = $state<ProductItem[]>([]);
  let loading = $state(true);
  let searchQuery = $state('');
  let fieldSettings = $state<ProductFieldsSettings>({ ...DEFAULT_PRODUCT_FIELDS_SETTINGS });

  onMount(async () => {
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
  });

  let filteredProducts = $derived(
    products.filter(p => {
      return !searchQuery.trim() || 
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (fieldSettings.sku.visible && p.sku && p.sku.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (fieldSettings.category.visible && p.category && p.category.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (p.minimoFatturabile?.displayText && p.minimoFatturabile.displayText.toLowerCase().includes(searchQuery.toLowerCase()));
    })
  );

  let totalProducts = $derived(products.length);
  let totalStockValue = $derived(products.reduce((acc, curr) => acc + ((curr.price || 0) * (curr.stockQty || 0)), 0));

  async function handleDelete(id?: string) {
    if (!id) return;
    const confirmed = await confirmStore.prompt('Sei sicuro di voler eliminare questo articolo dal catalogo?');
    if (!confirmed) return;
    try {
      await ProductsService.deleteProduct(id);
      products = products.filter(p => p.id !== id);
      toast.success('Prodotto eliminato con successo');
    } catch (err: any) {
      toast.error('Errore eliminazione prodotto: ' + err.message);
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
  <title>Catalogo Prodotti & Ricambi | {$projectStore?.projectName || 'ERP'}</title>
</svelte:head>

<div class="products-page animate-fade-in">
  <header class="page-header">
    <div>
      <h1 class="page-title">
        <Package size={26} class="title-icon" /> Catalogo Prodotti & Ricambi
      </h1>
      <p class="page-subtitle">Gestisci gli articoli a magazzino, il listino prezzi ed i componenti di ricambio.</p>
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
        <Package size={22} />
      </div>
      <div>
        <div class="kpi-value">{totalProducts}</div>
        <div class="kpi-label">Articoli a Catalogo</div>
      </div>
    </div>

    {#if fieldSettings.stockQty.visible}
      <div class="kpi-card">
        <div class="kpi-icon-wrapper success-bg">
          <Euro size={22} />
        </div>
        <div>
          <div class="kpi-value">€ {totalStockValue.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</div>
          <div class="kpi-label">Valore Stimato Scorte</div>
        </div>
      </div>
    {/if}
  </div>

  {#if activeEntityConfig?.enabled && availableChartMetrics.length > 0}
    <UniversalAnalyticsChart 
      title="Andamento Prodotti & Catalogo"
      description="Visualizza il trend degli articoli in catalogo nel tempo."
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

  <!-- SEARCH -->
  <div class="filter-card">
    <div class="search-box">
      <Search size={16} class="search-icon" />
      <input 
        type="text" 
        placeholder="Cerca prodotto per codice, nome articolo o categoria..." 
        bind:value={searchQuery} 
        class="search-input"
      />
    </div>
  </div>

  <!-- TABLE -->
  {#if loading}
    <div class="loading-state">
      <span class="spinner"></span>
      Caricamento prodotti...
    </div>
  {:else if filteredProducts.length === 0}
    <div class="empty-state">
      <div class="empty-icon-wrapper">
        <Package size={42} />
      </div>
      <h3>Nessun prodotto trovato</h3>
      <p>Aggiungi il tuo primo articolo al catalogo per gestirne i prezzi e la giacenza.</p>
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
              <th>SKU / Codice</th>
            {/if}
            <th>Nome Articolo</th>
            {#if fieldSettings.category.visible}
              <th>Categoria</th>
            {/if}
            <th>Unità</th>
            <th>Prezzo Unitario</th>
            {#if fieldSettings.minimoFatturabile.visible}
              <th>Minimo Fatturabile</th>
            {/if}
            {#if fieldSettings.stockQty.visible}
              <th>Giacenza</th>
            {/if}
            <th class="text-right">Azioni</th>
          </tr>
        </thead>
        <tbody>
          {#each filteredProducts as p}
            <tr>
              {#if fieldSettings.sku.visible}
                <td class="font-mono">{p.sku || '-'}</td>
              {/if}
              <td><strong class="text-neutral-800">{p.name}</strong></td>
              {#if fieldSettings.category.visible}
                <td><span class="type-pill">{p.category || 'Generale'}</span></td>
              {/if}
              <td class="uppercase">{p.unit}</td>
              <td class="font-bold text-primary">€ {(p.price || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}</td>
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
                  <span class="stock-badge {p.stockQty > 0 ? 'stock-ok' : 'stock-zero'}">
                    {UnitsOfMeasureService.formatQuantity(p.stockQty, p.unit)} {p.unit}
                  </span>
                </td>
              {/if}
              <td class="text-right">
                <div class="action-buttons">
                  <a href="/dashboard/products/{p.id}" class="btn-icon" title="Dettaglio">
                    <Eye size={16} />
                  </a>
                  <a href="/dashboard/products/{p.id}/edit" class="btn-icon" title="Modifica">
                    <Pencil size={16} />
                  </a>
                  <button type="button" class="btn-icon-danger" onclick={() => handleDelete(p.id)} title="Elimina">
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

  .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; }
  .kpi-card { background: white; border: 1px solid var(--color-neutral-200); border-radius: var(--radius-lg); padding: 1rem 1.2rem; display: flex; align-items: center; gap: 1rem; box-shadow: var(--shadow-sm); }
  
  .kpi-icon-wrapper { width: 44px; height: 44px; border-radius: 10px; display: flex; align-items: center; justify-content: center; }
  .primary-bg { background: var(--color-primary-100); color: var(--color-primary-600); }
  .success-bg { background: #dcfce7; color: #15803d; }

  .kpi-value { font-size: 1.4rem; font-weight: 800; color: var(--color-neutral-900); }
  .kpi-label { font-size: 0.8rem; color: var(--color-neutral-500); font-weight: 600; }

  .filter-card { background: white; border: 1px solid var(--color-neutral-200); border-radius: var(--radius-lg); padding: 1rem; }
  
  .search-box { position: relative; width: 100%; display: flex; align-items: center; }
  :global(.search-icon) { position: absolute; left: 12px; color: var(--color-neutral-400); top: 50%; transform: translateY(-50%); }
  .search-input { width: 100%; padding: 0.6rem 0.9rem 0.6rem 2.4rem; border: 1px solid var(--color-neutral-300); border-radius: var(--radius-md); font-size: 0.9rem; outline: none; box-sizing: border-box; }

  .table-card { background: white; border: 1px solid var(--color-neutral-200); border-radius: var(--radius-lg); overflow: hidden; box-shadow: var(--shadow-sm); }
  .data-table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
  .data-table th, .data-table td { padding: 0.8rem 1rem; text-align: left; border-bottom: 1px solid var(--color-neutral-200); }
  .data-table th { background: var(--color-neutral-50); font-weight: 700; color: var(--color-neutral-700); font-size: 0.8rem; text-transform: uppercase; }

  .type-pill { font-size: 0.78rem; background: var(--color-neutral-100); padding: 0.2rem 0.5rem; border-radius: 6px; color: var(--color-neutral-700); }
  .minimo-pill { font-size: 0.78rem; background: #fffbeb; color: #b45309; border: 1px solid #fde68a; padding: 0.2rem 0.5rem; border-radius: 6px; font-weight: 700; display: inline-flex; align-items: center; gap: 4px; }
  .stock-badge { font-size: 0.8rem; font-weight: 700; padding: 0.2rem 0.5rem; border-radius: 6px; }
  .stock-ok { background: #dcfce7; color: #15803d; }
  .stock-zero { background: #fee2e2; color: #b91c1c; }
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
</style>
