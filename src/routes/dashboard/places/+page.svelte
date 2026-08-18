<script lang="ts">
  import { projectStore } from '$lib/stores/project';
  import { onMount } from 'svelte';
  import { PlacesService } from './places.service';
  import { PlaceSettingsService } from './placeSettingsService';
  import type { PlaceItem, PlaceSettings } from './schema';
  import { Card, StatusBadge, UniversalAnalyticsChart, ChartSettingsService } from '$lib';
  import { DashboardService } from '../dashboard.service';
  import { pageTitle } from '$lib/stores/page';
  import { authState, activeRoleState } from '$lib/auth.svelte';
  import { 
    MapPin, 
    Plus, 
    Search, 
    User, 
    CheckCircle2, 
    CalendarPlus,
    Activity,
    Eye
  } from '@lucide/svelte';

  let settings = $state<PlaceSettings>({
    entityNaming: 'cantiere',
    customSingularLabel: '',
    customPluralLabel: '',
    prefix: 'LUG-',
    includeYear: true,
    numberPadding: 3,
    lastNumber: 0,
    lastCounterYear: new Date().getFullYear(),
    defaultStatus: 'attivo'
  });

  let places = $state<PlaceItem[]>([]);
  let loading = $state(true);
  let searchFilter = $state('');
  let statusFilter = $state<string>('all');

  let labels = $derived(PlaceSettingsService.getLabels(settings));

  let filteredPlaces = $derived(
    places.filter(p => {
      const matchSearch = searchFilter === '' || 
        p.code.toLowerCase().includes(searchFilter.toLowerCase()) ||
        p.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
        (p.clientName || '').toLowerCase().includes(searchFilter.toLowerCase()) ||
        (p.address?.city || '').toLowerCase().includes(searchFilter.toLowerCase());
      
      const matchStatus = statusFilter === 'all' || p.status === statusFilter;
      return matchSearch && matchStatus;
    })
  );

  let activePlacesCount = $derived(
    places.filter(p => p.status === 'attivo').length
  );

  let newPlacesThisMonth = $derived.by(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    return places.filter(p => {
      const dt = (p as any).createdAt || (p as any).edits?.createdAt || (p as any).original?.createdAt;
      let ms = 0;
      if (dt) {
        if (typeof dt === 'string') ms = new Date(dt).getTime();
        else if (typeof dt.toDate === 'function') ms = dt.toDate().getTime();
        else if (typeof dt.seconds === 'number') ms = dt.seconds * 1000;
        else if (dt instanceof Date) ms = dt.getTime();
      }
      return ms >= startOfMonth;
    }).length;
  });

  let activeRate = $derived(
    places.length > 0 ? Math.round((activePlacesCount / places.length) * 100) : 0
  );

  // --- CHART STATE ---
  let activeChartTab = $state<string>('active_places');
  let granularity = $state<'settimanale' | 'mensile' | 'annuale'>('mensile');
  let endDateString = $state(new Date().toISOString().split('T')[0]);
  let isGraphExpanded = $state(false);
  let selectedPointIdx = $state<number | null>(null);
  let chartPeriods = $state<Array<{ start: Date; end: Date; label: string }>>([]);
  let loadingChart = $state(false);
  let computedChartPoints = $state<number[]>([]);

  let activeEntityConfig = $derived(ChartSettingsService.getEntityConfigSync('places'));
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
      console.error('Error loading places chart data:', e);
      computedChartPoints = chartPeriods.map(() => 0);
    } finally {
      loadingChart = false;
    }
  }

  $effect(() => {
    if (isGraphExpanded || granularity || endDateString || activeChartTab) {
      loadChartData();
    }
  });

  $effect(() => {
    if (authState.initialized && authState.user) {
      loadPlacesData();
    }
  });

  async function loadPlacesData() {
    loading = true;
    try {
      const [s, list] = await Promise.all([
        PlaceSettingsService.getSettings(),
        PlacesService.getPlaces()
      ]);
      settings = s;
      places = list;
      pageTitle.set(labels.plural);
    } catch (e) {
      console.error('Errore caricamento luoghi:', e);
    } finally {
      loading = false;
    }
  }
</script>

<svelte:head>
  <title>{labels.plural} | {$projectStore?.projectName || 'ERP'}</title>
</svelte:head>

<div class="places-page-container">
  <header class="page-header">
    <div class="header-title-box">
      <div class="header-icon">
        <MapPin size={26} color="var(--color-primary-500)" />
      </div>
      <div>
        <h1 class="page-main-title">{labels.plural}</h1>
        <p class="page-main-subtitle">Anagrafica e mappatura dei luoghi fisici, cantieri ed impianti di lavoro.</p>
      </div>
    </div>

    <a href="/dashboard/places/add" class="btn-create-place">
      <Plus size={18} />
      <span>{labels.newBtn}</span>
    </a>
  </header>

  <!-- Top KPI Grid -->
  <div class="kpi-grid">
    <div class="kpi-card">
      <div class="kpi-icon-wrapper kpi-primary">
        <MapPin size={22} />
      </div>
      <div>
        <div class="kpi-value">{places.length}</div>
        <div class="kpi-label">{labels.plural} Totali</div>
      </div>
    </div>

    <div class="kpi-card">
      <div class="kpi-icon-wrapper kpi-success">
        <CheckCircle2 size={22} />
      </div>
      <div>
        <div class="kpi-value">{activePlacesCount}</div>
        <div class="kpi-label">{labels.plural} Attivi</div>
      </div>
    </div>

    <div class="kpi-card">
      <div class="kpi-icon-wrapper kpi-warning">
        <CalendarPlus size={22} />
      </div>
      <div>
        <div class="kpi-value">{newPlacesThisMonth}</div>
        <div class="kpi-label">Nuove Aperture (Mese)</div>
      </div>
    </div>

    <div class="kpi-card">
      <div class="kpi-icon-wrapper kpi-info">
        <Activity size={22} />
      </div>
      <div>
        <div class="kpi-value">{activeRate}%</div>
        <div class="kpi-label">Tasso di Attività</div>
      </div>
    </div>
  </div>

  <!-- Collapsible Analytics Chart -->
  {#if activeEntityConfig?.enabled && availableChartMetrics.length > 0}
    <div class="chart-wrapper">
      <UniversalAnalyticsChart
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
    </div>
  {/if}

  <div class="filter-bar">
    <div class="search-box">
      <Search size={18} class="search-icon" />
      <input 
        type="text" 
        bind:value={searchFilter} 
        placeholder="Cerca per codice, nome, cliente o città..." 
        class="search-input"
      />
    </div>

    <div class="status-filters">
      <button 
        class="filter-chip" 
        class:active={statusFilter === 'all'} 
        onclick={() => statusFilter = 'all'}
      >
        Tutti ({places.length})
      </button>
      <button 
        class="filter-chip" 
        class:active={statusFilter === 'attivo'} 
        onclick={() => statusFilter = 'attivo'}
      >
        Attivi ({activePlacesCount})
      </button>
      <button 
        class="filter-chip" 
        class:active={statusFilter === 'inattivo'} 
        onclick={() => statusFilter = 'inattivo'}
      >
        Inattivi ({places.length - activePlacesCount})
      </button>
    </div>
  </div>

  {#if loading}
    <div class="loading-box">
      <p>Caricamento {labels.plural.toLowerCase()} in corso...</p>
    </div>
  {:else if filteredPlaces.length === 0}
    <div class="empty-state">
      <MapPin size={48} color="var(--color-neutral-400)" />
      <h3>Nessun {labels.singular} Trovato</h3>
      <p>Non ci sono elementi corrispondenti ai criteri di ricerca selezionati.</p>
      <a href="/dashboard/places/add" class="btn-create-place-empty">
        <Plus size={16} />
        <span>Crea {labels.singular}</span>
      </a>
    </div>
  {:else}
    <div class="places-grid">
      {#each filteredPlaces as p}
        <div class="place-card">
          <div class="place-card-header">
            <span class="place-code">{p.code}</span>
            <span class="status-badge {p.status}">{p.status}</span>
          </div>

          <h3 class="place-title">{p.name}</h3>

          <div class="place-meta">
            {#if p.clientName}
              <div class="meta-item">
                <User size={14} />
                <span>{p.clientName}</span>
              </div>
            {/if}

            {#if p.address?.city}
              <div class="meta-item">
                <MapPin size={14} />
                <span>{p.address.city} {p.address.street ? `(${p.address.street})` : ''}</span>
              </div>
            {/if}
          </div>

          <div class="place-card-footer">
            <a href="/dashboard/places/{p.id}" class="btn-detail">
              <Eye size={15} />
              <span>Dettaglio</span>
            </a>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .places-page-container {
    padding: 24px;
    width: 100%;
    max-width: none;
  }

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
  }

  .header-title-box {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .header-icon {
    width: 48px;
    height: 48px;
    border-radius: 12px;
    background: var(--color-primary-50);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .page-main-title {
    font-size: 24px;
    font-weight: 700;
    margin: 0;
  }

  .page-main-subtitle {
    font-size: 13px;
    color: var(--color-neutral-500);
    margin: 2px 0 0 0;
  }

  .btn-create-place {
    display: flex;
    align-items: center;
    gap: 8px;
    background: var(--color-primary-600);
    color: white;
    padding: 10px 18px;
    border-radius: 8px;
    text-decoration: none;
    font-weight: 600;
    font-size: 14px;
    transition: background 0.15s ease;
  }

  .btn-create-place:hover {
    background: var(--color-primary-700);
  }

  .kpi-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 16px;
    margin-bottom: 24px;
  }

  .kpi-card {
    background: var(--color-surface, #ffffff);
    border: 1px solid var(--color-neutral-200, #e2e8f0);
    border-radius: 12px;
    padding: 16px 20px;
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .kpi-icon-wrapper {
    width: 44px;
    height: 44px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .kpi-primary { background: #eff6ff; color: #2563eb; }
  .kpi-success { background: #f0fdf4; color: #16a34a; }
  .kpi-warning { background: #fefce8; color: #ca8a04; }
  .kpi-info { background: #eef2ff; color: #4f46e5; }

  .kpi-value {
    font-size: 22px;
    font-weight: 700;
    color: var(--color-neutral-900, #0f172a);
    line-height: 1.2;
  }

  .kpi-label {
    font-size: 12px;
    font-weight: 500;
    color: var(--color-neutral-500, #64748b);
    margin-top: 2px;
  }

  .chart-wrapper {
    margin-bottom: 24px;
  }

  .filter-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    margin-bottom: 24px;
    flex-wrap: wrap;
  }

  .search-box {
    position: relative;
    flex: 1;
    min-width: 280px;
  }

  :global(.search-icon) {
    position: absolute;
    left: 12px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--color-neutral-400);
    pointer-events: none;
  }

  .search-input {
    width: 100%;
    padding: 10px 14px 10px 40px;
    border-radius: 8px;
    border: 1px solid var(--color-neutral-300);
    font-size: 14px;
  }

  .search-input:focus {
    outline: none;
    border-color: var(--color-primary-500);
  }

  .status-filters {
    display: flex;
    gap: 8px;
  }

  .filter-chip {
    padding: 8px 14px;
    border-radius: 8px;
    border: 1px solid var(--color-neutral-300);
    background: white;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .filter-chip.active {
    background: var(--color-primary-600);
    color: white;
    border-color: var(--color-primary-600);
  }

  .loading-box {
    text-align: center;
    padding: 40px;
    color: var(--color-neutral-500);
  }

  .empty-state {
    text-align: center;
    padding: 60px 20px;
    background: white;
    border-radius: 12px;
    border: 1px dashed var(--color-neutral-300);
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .empty-state h3 {
    margin: 16px 0 8px;
    font-size: 18px;
    color: var(--color-neutral-800);
  }

  .empty-state p {
    color: var(--color-neutral-500);
    font-size: 14px;
    margin: 0 0 20px;
  }

  .btn-create-place-empty {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: var(--color-primary-600);
    color: white;
    padding: 10px 18px;
    border-radius: 8px;
    text-decoration: none;
    font-weight: 600;
    font-size: 14px;
  }

  .places-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 18px;
  }

  .place-card {
    background: white;
    border: 1px solid var(--color-neutral-200);
    border-radius: 12px;
    padding: 20px;
    display: flex;
    flex-direction: column;
    box-shadow: 0 1px 3px rgba(0,0,0,0.04);
    transition: transform 0.15s ease, box-shadow 0.15s ease;
  }

  .place-card:hover {
    box-shadow: 0 4px 12px rgba(0,0,0,0.08);
  }

  .place-card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }

  .place-code {
    font-family: monospace;
    font-weight: 700;
    font-size: 13px;
    color: var(--color-primary-700);
    background: var(--color-primary-50);
    padding: 2px 8px;
    border-radius: 4px;
  }

  .status-badge {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    padding: 3px 8px;
    border-radius: 6px;
    background: var(--color-neutral-100);
    color: var(--color-neutral-700);
  }

  .status-badge.attivo {
    background: #dcfce7;
    color: #15803d;
  }

  .status-badge.inattivo {
    background: #fee2e2;
    color: #b91c1c;
  }

  .place-title {
    font-size: 16px;
    font-weight: 700;
    margin: 0 0 12px 0;
    color: var(--color-neutral-900);
  }

  .place-meta {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 20px;
  }

  .meta-item {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: var(--color-neutral-600);
  }

  .place-card-footer {
    margin-top: auto;
    display: flex;
    justify-content: flex-end;
  }

  .btn-detail {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    border-radius: 8px;
    background: var(--color-neutral-100);
    color: var(--color-neutral-800);
    text-decoration: none;
    font-size: 13px;
    font-weight: 600;
    transition: background 0.15s ease;
  }

  .btn-detail:hover {
    background: var(--color-neutral-200);
  }
</style>
