<script lang="ts">
  import { projectStore } from '$lib/stores/project';
  import { onMount } from 'svelte';
  import { ProductsService } from './products.service';
  import type { ProductItem, ProductType, ProductUsageType } from './schema';
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
    Layers,
    ArrowDownLeft,
    ArrowUpRight,
    ArrowLeftRight
  } from '@lucide/svelte';
  import { UniversalAnalyticsChart, ChartSettingsService } from '$lib';
  import SearchToolbar from '$lib/components/SearchToolbar.svelte';
  import FilterSelect from '$lib/components/FilterSelect.svelte';
  import { DashboardService } from '../dashboard.service';
  import { activeRoleState, authState } from '$lib/auth.svelte';

  let products = $state<ProductItem[]>([]);
  let loading = $state(true);
  let searchQuery = $state('');
  let selectedTypeFilter = $state<ProductType | 'all'>('all');
  let selectedUsageFilter = $state<ProductUsageType | 'all'>('all');
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

      const pUsage = p.usageType || 'both';
      if (selectedUsageFilter !== 'all' && pUsage !== selectedUsageFilter) {
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

  import { ProductsKPIBridge } from './products.kpi.bridge';

  let activeEntityConfig = $derived(ChartSettingsService.getEntityConfigSync('products'));
  let sideKpisPosition = $derived<'right' | 'none'>(
    activeEntityConfig && activeEntityConfig.showSideKpis !== false ? 'right' : 'none'
  );

  let calculatedKPIs = $derived(ProductsKPIBridge.calculateKPIs(products));

  let availableChartMetrics = $derived(
    (activeEntityConfig?.enabled ? activeEntityConfig.kpis || [] : [])
      .filter(k => k.enabled)
      .map(k => ({
        id: k.id,
        label: k.name,
        shortLabel: k.acronym,
        isCurrency: k.isCurrency !== false,
        value: (calculatedKPIs as any)[k.id] ?? (calculatedKPIs as any)[k.acronym?.toLowerCase()] ?? 0
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

  function getUsageBadge(usage?: ProductUsageType) {
    switch (usage) {
      case 'sale':
        return { label: 'Solo Vendita', class: 'usage-sale', icon: ArrowUpRight };
      case 'purchase':
        return { label: 'Solo Acquisto', class: 'usage-purchase', icon: ArrowDownLeft };
      case 'both':
      default:
        return { label: 'Vendita & Acquisto', class: 'usage-both', icon: ArrowLeftRight };
    }
  }
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
      <div class="kpi-icon-wrapper amber-bg">
        <Briefcase size={22} />
      </div>
      <div>
        <div class="kpi-value">{servicesAndDigitalCount}</div>
        <div class="kpi-label">Servizi & Licenze</div>
      </div>
    </div>

    <div class="kpi-card">
      <div class="kpi-icon-wrapper emerald-bg">
        <Euro size={22} />
      </div>
      <div>
        <div class="kpi-value">€ {totalStockValue.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        <div class="kpi-label">Valore Giacenze</div>
      </div>
    </div>
  </div>

  <!-- CHART ANALYTICS INTERATTIVO -->
  {#if activeEntityConfig?.enabled && availableChartMetrics.length > 0}
    <UniversalAnalyticsChart
      title="Andamento Catalogo & Valorizzazione Merci"
      description="Analisi temporale del listino prezzi, giacenze a magazzino e composizione dell'offerta commerciale."
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

  <!-- SEARCH & FILTER TOOLBAR (Principio 12) -->
  <SearchToolbar
    bind:searchQuery
    placeholder="Cerca per codice SKU, denominazione articolo o categoria..."
  >
    {#snippet filtersSnippet()}
      <div class="filters-row">
        <FilterSelect
          bind:value={selectedTypeFilter}
          icon={Layers}
          options={[
            { value: 'all', label: `Tutti i tipi (${totalProducts})` },
            { value: 'product', label: `Prodotti fisici (${physicalProductsCount})` },
            { value: 'service', label: 'Prestazioni di Servizio' },
            { value: 'digital', label: 'Licenze / Digitali' }
          ]}
        />

        <FilterSelect
          bind:value={selectedUsageFilter}
          icon={ArrowLeftRight}
          options={[
            { value: 'all', label: 'Tutte le Destinazioni' },
            { value: 'both', label: 'Vendita & Acquisto' },
            { value: 'sale', label: 'Solo Vendita (Clienti)' },
            { value: 'purchase', label: 'Solo Acquisto (Fornitori)' }
          ]}
        />
      </div>
    {/snippet}
  </SearchToolbar>

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
        {#if searchQuery || selectedTypeFilter !== 'all' || selectedUsageFilter !== 'all'}
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
            <th>Destinazione</th>
            <th>Nome Articolo</th>
            {#if fieldSettings.category.visible}
              <th>Categoria</th>
            {/if}
            <th>Prezzo Vendita</th>
            <th>Costo Acquisto</th>
            {#if fieldSettings.stockQty.visible}
              <th>Giacenza</th>
            {/if}
            <th class="text-right">Azioni</th>
          </tr>
        </thead>
        <tbody>
          {#each filteredProducts as p (p.id)}
            {@const usageBadge = getUsageBadge(p.usageType)}
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
                  <span class="type-badge digital-badge" title="Licenza o Bene Digitale">
                    <Zap size={12} /> Digitale
                  </span>
                {/if}
              </td>

              <td>
                <span class="usage-badge {usageBadge.class}">
                  <usageBadge.icon size={11} />
                  <span>{usageBadge.label}</span>
                </span>
              </td>

              <td>
                <a href="/dashboard/products/{p.id}" class="item-link">
                  <strong>{p.name}</strong>
                </a>
              </td>

              {#if fieldSettings.category.visible}
                <td>
                  <span class="category-tag">{p.category || 'Generale'}</span>
                </td>
              {/if}

              <td class="font-semibold text-slate-900">
                € {(p.price || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                <span class="unit-label">/ {p.unit || 'pz'}</span>
              </td>

              <td class="text-slate-600">
                {#if p.purchasePrice !== undefined && p.purchasePrice > 0}
                  € {p.purchasePrice.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                {:else}
                  <span class="text-slate-400 text-xs">-</span>
                {/if}
              </td>

              {#if fieldSettings.stockQty.visible}
                <td>
                  {#if p.trackStock !== false}
                    <div class="stock-cell">
                      {#if (p.stockQty || 0) <= 0}
                        <span class="stock-badge out-of-stock" title="Esaurito a magazzino">
                          <AlertCircle size={12} /> {p.stockQty || 0} {p.unit}
                        </span>
                      {:else if (p.stockQty || 0) <= (p.minStockThreshold || 2)}
                        <span class="stock-badge low-stock" title="Sottoscorta">
                          <AlertTriangle size={12} /> {p.stockQty} {p.unit}
                        </span>
                      {:else}
                        <span class="stock-badge in-stock" title="Disponibilità regolare">
                          <CheckCircle2 size={12} /> {p.stockQty} {p.unit}
                        </span>
                      {/if}
                    </div>
                  {:else}
                    <span class="no-stock-badge" title="Giacenza non gestita per servizi o beni immateriali">
                      <Minus size={12} /> Illimitato
                    </span>
                  {/if}
                </td>
              {/if}

              <td class="text-right">
                <div class="action-buttons">
                  <a href="/dashboard/products/{p.id}" class="action-btn" title="Visualizza / Modifica" aria-label="Visualizza / Modifica">
                    <Pencil size={15} />
                  </a>
                  <button 
                    type="button" 
                    class="action-btn text-danger" 
                    title="Elimina Articolo"
                    aria-label="Elimina Articolo"
                    onclick={() => handleDelete(p.id)}
                  >
                    <Trash2 size={15} />
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
  .products-page {
    display: flex;
    flex-direction: column;
    gap: 20px;
    width: 100%;
  }

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 16px;
  }

  .page-title {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 24px;
    font-weight: 700;
    color: var(--color-neutral-900, #0f172a);
    margin: 0;
  }

  :global(.title-icon) {
    color: var(--color-primary-600, #2563eb);
  }

  .page-subtitle {
    font-size: 14px;
    color: var(--color-neutral-500, #64748b);
    margin: 4px 0 0 0;
  }

  .btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    border-radius: var(--radius-md, 8px);
    font-size: 14px;
    font-weight: 600;
    text-decoration: none;
    cursor: pointer;
    border: none;
    transition: background-color 0.2s, transform 0.1s;
  }

  .btn-primary {
    background-color: var(--color-primary-600, #2563eb);
    color: #ffffff;
  }

  .btn-primary:hover {
    background-color: var(--color-primary-700, #1d4ed8);
  }

  .kpi-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 16px;
  }

  .kpi-card {
    background: #ffffff;
    border: 1px solid var(--color-neutral-200, #e2e8f0);
    border-radius: var(--radius-lg, 12px);
    padding: 16px;
    display: flex;
    align-items: center;
    gap: 16px;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  }

  .kpi-icon-wrapper {
    width: 48px;
    height: 48px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .primary-bg { background-color: var(--color-primary-50, #eff6ff); color: var(--color-primary-600, #2563eb); }
  .indigo-bg { background-color: #e0e7ff; color: #4338ca; }
  .amber-bg { background-color: #fef3c7; color: #b45309; }
  .emerald-bg { background-color: #d1fae5; color: #047857; }

  .kpi-value {
    font-size: 20px;
    font-weight: 700;
    color: var(--color-neutral-900, #0f172a);
  }

  .kpi-label {
    font-size: 12px;
    font-weight: 500;
    color: var(--color-neutral-500, #64748b);
  }

  .filters-row {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .table-card {
    background: #ffffff;
    border: 1px solid var(--color-neutral-200, #e2e8f0);
    border-radius: var(--radius-lg, 12px);
    overflow-x: auto;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  }

  .data-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
    text-align: left;
  }

  .data-table th {
    background-color: var(--color-neutral-50, #f8fafc);
    padding: 12px 16px;
    font-weight: 600;
    color: var(--color-neutral-600, #475569);
    border-bottom: 1px solid var(--color-neutral-200, #e2e8f0);
    white-space: nowrap;
  }

  .data-table td {
    padding: 14px 16px;
    border-bottom: 1px solid var(--color-neutral-100, #f1f5f9);
    color: var(--color-neutral-700, #334155);
    vertical-align: middle;
  }

  .item-link {
    color: var(--color-neutral-900, #0f172a);
    text-decoration: none;
  }

  .item-link:hover {
    color: var(--color-primary-600, #2563eb);
    text-decoration: underline;
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

  .product-badge { background-color: #e0e7ff; color: #3730a3; }
  .service-badge { background-color: #fef3c7; color: #92400e; }
  .digital-badge { background-color: #ede9fe; color: #5b21b6; }

  .usage-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 7px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 600;
  }

  .usage-both { background-color: #ecfdf5; color: #047857; }
  .usage-sale { background-color: #eff6ff; color: #1d4ed8; }
  .usage-purchase { background-color: #fff7ed; color: #c2410c; }

  .category-tag {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 4px;
    background-color: var(--color-neutral-100, #f1f5f9);
    font-size: 12px;
    color: var(--color-neutral-600, #475569);
  }

  .unit-label {
    font-size: 12px;
    color: var(--color-neutral-400, #94a3b8);
    font-weight: normal;
  }

  .stock-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 8px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
  }

  .in-stock { background-color: #d1fae5; color: #065f46; }
  .low-stock { background-color: #fef3c7; color: #92400e; }
  .out-of-stock { background-color: #fee2e2; color: #991b1b; }
  .no-stock-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    color: var(--color-neutral-400, #94a3b8);
  }

  .action-buttons {
    display: flex;
    justify-content: flex-end;
    gap: 6px;
  }

  .action-btn {
    padding: 6px;
    border-radius: 6px;
    color: var(--color-neutral-500, #64748b);
    border: 1px solid var(--color-neutral-200, #e2e8f0);
    background: #ffffff;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    text-decoration: none;
  }

  .action-btn:hover {
    background-color: var(--color-neutral-50, #f8fafc);
    color: var(--color-neutral-800, #1e293b);
  }

  .text-danger:hover {
    background-color: #fee2e2;
    color: #b91c1c;
    border-color: #fca5a5;
  }

  .text-right { text-align: right; }
  .font-mono { font-family: monospace; }

  .loading-state, .empty-state {
    background: #ffffff;
    border: 1px solid var(--color-neutral-200, #e2e8f0);
    border-radius: var(--radius-lg, 12px);
    padding: 48px 24px;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    color: var(--color-neutral-500, #64748b);
  }

  .empty-icon-wrapper {
    color: var(--color-neutral-300, #cbd5e1);
  }

  .empty-state h3 {
    font-size: 18px;
    font-weight: 600;
    color: var(--color-neutral-800, #1e293b);
    margin: 0;
  }

  .empty-state p {
    font-size: 14px;
    max-width: 420px;
    margin: 0 0 8px 0;
  }

  .spinner {
    width: 24px;
    height: 24px;
    border: 3px solid var(--color-neutral-200, #e2e8f0);
    border-top-color: var(--color-primary-600, #2563eb);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>
