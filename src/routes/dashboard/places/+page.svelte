<script lang="ts">
  import { onMount } from 'svelte';
  import { authState } from '$lib/auth.svelte';
  import { projectStore } from '$lib/stores/project';
  import { pageTitle } from '$lib/stores/page';
  import { PlacesState, setPlacesContext } from './application/places.svelte';
  import { PlaceSettingsService } from './placeSettingsService';
  import type { PlaceSettings, PlaceType } from './schema';
  import { UniversalAnalyticsChart, ChartSettingsService } from '$lib';
  import PlaceMapViewer from './ui/components/PlaceMapViewer.svelte';
  import PlaceHierarchyTree from './ui/components/PlaceHierarchyTree.svelte';
  import PlaceCard from './ui/components/PlaceCard.svelte';
  import TodayPlacesBanner from './ui/components/TodayPlacesBanner.svelte';
  import { presenceState } from './application/presenceState.svelte';
  import { 
    MapPin, 
    Plus, 
    Search, 
    List, 
    LayoutGrid, 
    Map as MapIcon, 
    Layers, 
    Building2, 
    Warehouse, 
    Store,
    Eye,
    Pencil,
    X,
    Filter
  } from '@lucide/svelte';

  const placesState = setPlacesContext();

  let settings = $state<PlaceSettings>({
    entityNaming: 'cantiere',
    customSingularLabel: '',
    customPluralLabel: '',
    prefix: 'LUG-',
    includeYear: true,
    numberPadding: 3,
    lastNumber: 0,
    lastCounterYear: new Date().getFullYear(),
    defaultStatus: 'active'
  });

  let labels = $derived(PlaceSettingsService.getLabels(settings));

  // --- CHART ANALYTICS STATE ---
  let activeChartTab = $state<string>('active_places');
  let granularity = $state<'settimanale' | 'mensile' | 'annuale'>('mensile');
  let endDateString = $state(new Date().toISOString().split('T')[0]);
  let isGraphExpanded = $state(false);
  let selectedPointIdx = $state<number | null>(null);

  import { PlacesKPIBridge } from './places.kpi.bridge';

  let activeEntityConfig = $derived(ChartSettingsService.getEntityConfigSync('places'));
  let sideKpisPosition = $derived<'right' | 'none'>(
    activeEntityConfig && activeEntityConfig.showSideKpis !== false ? 'right' : 'none'
  );

  let calculatedKPIs = $derived(PlacesKPIBridge.calculateKPIs(placesState.places));

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

  onMount(async () => {
    pageTitle.set(labels.plural);
    try {
      const s = await PlaceSettingsService.getSettings();
      settings = s;
      pageTitle.set(labels.plural);
      await placesState.loadPlaces();
      if (authState.user?.uid) {
        presenceState.loadUserTodayData(authState.user.uid, (authState.user as any)?.teamIds || []);
      }
    } catch (e) {
      console.error('Errore onMount Places:', e);
    }
  });

  $effect(() => {
    if (authState.user?.uid) {
      presenceState.loadUserTodayData(authState.user.uid, (authState.user as any)?.teamIds || []);
    }
  });

  function clearSearch() {
    placesState.searchQuery = '';
  }

  function handleTypeFilter(t: PlaceType | 'all') {
    placesState.filterType = t;
  }
</script>

<svelte:head>
  <title>{labels.plural} | {$projectStore?.projectName || 'Gestoray'}</title>
</svelte:head>

<div class="places-page-wrapper">
  <!-- 1. PAGE TOP ACTIONS BAR (Rule 12) -->
  <header class="page-top-actions">
    <div class="header-left">
      <div class="header-icon-badge">
        <MapPin size={24} class="text-blue-600" />
      </div>
      <div>
        <h1 class="page-main-title">{labels.plural}</h1>
        <p class="page-subtitle">Gestione anagrafica luoghi fisici, cantieri, sedi operative, magazzini e geofencing radar.</p>
      </div>
    </div>

    <div class="header-actions">
      <a href="/dashboard/places/add" class="btn-primary-action">
        <Plus size={18} />
        <span>+ Nuovo {labels.singular}</span>
      </a>
    </div>
  </header>

  <!-- 2. TODAY PLACES & SMART PRESENCE BANNER -->
  <TodayPlacesBanner currentUser={authState.user ? { uid: authState.user.uid, displayName: authState.user.displayName || undefined, email: authState.user.email || undefined } : null} />

  <!-- 3. ANALYTICS & KPIS CHART (Optional/Expanded) -->
  {#if activeEntityConfig?.enabled && availableChartMetrics.length > 0}
    <div class="analytics-section">
      <UniversalAnalyticsChart
        title="Trend & Distribuzione {labels.plural}"
        metrics={availableChartMetrics}
        bind:activeMetric={activeChartTab}
        bind:granularity={granularity}
        bind:endDateString={endDateString}
        bind:isExpanded={isGraphExpanded}
        bind:selectedPointIdx={selectedPointIdx}
        kpisPosition={sideKpisPosition}
      />
    </div>
  {/if}

  <!-- 4. CENTRALIZED SEARCH & FILTER TOOLBAR (Rule 12) -->
  <div class="search-toolbar-card">
    <div class="search-input-group">
      <Search size={18} class="search-icon text-slate-400" />
      <input
        type="text"
        bind:value={placesState.searchQuery}
        placeholder="Cerca per nome, codice cantiere, città, cliente o referente..."
        class="main-search-input"
      />
      {#if placesState.searchQuery}
        <button type="button" class="btn-clear-search" onclick={clearSearch} aria-label="Cancella ricerca">
          <X size={16} />
        </button>
      {/if}
    </div>

    <div class="toolbar-controls">
      <!-- Filter By Status -->
      <select bind:value={placesState.filterStatus} class="select-filter">
        <option value="all">Tutti gli stati</option>
        <option value="active">Attivo</option>
        <option value="temporary">Temporaneo</option>
        <option value="completed">Completato</option>
        <option value="archived">Archiviato</option>
      </select>

      <!-- View Mode Switcher -->
      <div class="view-mode-tabs" role="tablist" aria-label="Modalità di visualizzazione">
        <button
          type="button"
          class="mode-tab-btn {placesState.viewMode === 'table' ? 'active' : ''}"
          onclick={() => { placesState.viewMode = 'table'; }}
          title="Vista Tabella"
        >
          <List size={16} />
          <span class="tab-label">Tabella</span>
        </button>
        <button
          type="button"
          class="mode-tab-btn {placesState.viewMode === 'cards' ? 'active' : ''}"
          onclick={() => { placesState.viewMode = 'cards'; }}
          title="Vista Schede"
        >
          <LayoutGrid size={16} />
          <span class="tab-label">Schede</span>
        </button>
        <button
          type="button"
          class="mode-tab-btn {placesState.viewMode === 'map' ? 'active' : ''}"
          onclick={() => { placesState.viewMode = 'map'; }}
          title="Mappa Geospaziale con Radar Geofence"
        >
          <MapIcon size={16} />
          <span class="tab-label">Mappa</span>
        </button>
        <button
          type="button"
          class="mode-tab-btn {placesState.viewMode === 'tree' ? 'active' : ''}"
          onclick={() => { placesState.viewMode = 'tree'; }}
          title="Albero Gerarchico Sotto-Aree"
        >
          <Layers size={16} />
          <span class="tab-label">Albero</span>
        </button>
      </div>
    </div>
  </div>

  <!-- Role Chips Filter Bar -->
  <div class="type-chips-bar">
    <button 
      type="button" 
      class="filter-chip {placesState.filterType === 'all' ? 'active' : ''}"
      onclick={() => handleTypeFilter('all')}
    >
      Tutti ({placesState.places.length})
    </button>
    <button 
      type="button" 
      class="filter-chip {placesState.filterType === 'site' ? 'active' : ''}"
      onclick={() => handleTypeFilter('site')}
    >
      <MapPin size={13} />
      <span>Cantieri</span>
    </button>
    <button 
      type="button" 
      class="filter-chip {placesState.filterType === 'warehouse' ? 'active' : ''}"
      onclick={() => handleTypeFilter('warehouse')}
    >
      <Warehouse size={13} />
      <span>Magazzini</span>
    </button>
    <button 
      type="button" 
      class="filter-chip {placesState.filterType === 'headquarters' ? 'active' : ''}"
      onclick={() => handleTypeFilter('headquarters')}
    >
      <Building2 size={13} />
      <span>Sedi Legali</span>
    </button>
    <button 
      type="button" 
      class="filter-chip {placesState.filterType === 'branch' ? 'active' : ''}"
      onclick={() => handleTypeFilter('branch')}
    >
      <Building2 size={13} />
      <span>Filiali</span>
    </button>
    <button 
      type="button" 
      class="filter-chip {placesState.filterType === 'store' ? 'active' : ''}"
      onclick={() => handleTypeFilter('store')}
    >
      <Store size={13} />
      <span>Showroom</span>
    </button>
  </div>

  <!-- 4. DATA PRESENTATION CONTENT (Rule 12) -->
  {#if placesState.isLoading}
    <div class="loading-state-card">
      <div class="spinner"></div>
      <p>Caricamento {labels.plural} in corso...</p>
    </div>
  {:else if placesState.filteredPlaces.length === 0}
    <div class="empty-state-card">
      <MapPin size={48} class="empty-icon text-slate-300" />
      <h3 class="empty-title">Nessun {labels.singular} trovato</h3>
      <p class="empty-desc">Non ci sono elementi corrispondenti ai criteri di ricerca o ai filtri applicati.</p>
      <a href="/dashboard/places/add" class="btn-create-empty">
        <Plus size={16} />
        <span>Crea Nuovo {labels.singular}</span>
      </a>
    </div>
  {:else}
    <!-- VIEW MODE: TABLE -->
    {#if placesState.viewMode === 'table'}
      <div class="data-table-card">
        <div class="table-responsive">
          <table class="places-table">
            <thead>
              <tr>
                <th>Codice</th>
                <th>Denominazione</th>
                <th>Tipologia / Ruolo</th>
                <th>Indirizzo & Città</th>
                <th>Cliente Titolare</th>
                <th>Stato</th>
                <th class="text-right">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {#each placesState.filteredPlaces as place (place.id)}
                <tr>
                  <td>
                    <span class="code-badge-table">{place.code || '—'}</span>
                  </td>
                  <td>
                    <div class="place-name-cell">
                      <a href="/dashboard/places/{place.id}" class="place-link font-semibold">
                        {place.name}
                      </a>
                      {#if place.depth > 0}
                        <span class="depth-sub-tag">Livello {place.depth}</span>
                      {/if}
                    </div>
                  </td>
                  <td>
                    <div class="types-tags-cell">
                      {#each (place.types || ['site']) as t}
                        <span class="type-tag">{t}</span>
                      {/each}
                    </div>
                  </td>
                  <td>
                    <div class="address-cell">
                      <MapPin size={13} class="text-slate-400 flex-shrink-0" />
                      <span>{place.summary?.shortAddress || place.address?.formattedAddress || '—'}</span>
                    </div>
                  </td>
                  <td>
                    <span class="client-cell">{place.clientName || '—'}</span>
                  </td>
                  <td>
                    <span class="table-status-pill status-{place.status}">
                      {place.status === 'active' || place.status === 'attivo' ? 'Attivo' : place.status}
                    </span>
                  </td>
                  <td class="text-right">
                    <div class="table-action-buttons">
                      <a href="/dashboard/places/{place.id}" class="btn-tbl-action" title="Dettaglio">
                        <Eye size={15} />
                      </a>
                      <a href="/dashboard/places/{place.id}/edit" class="btn-tbl-action" title="Modifica">
                        <Pencil size={15} />
                      </a>
                    </div>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>

    <!-- VIEW MODE: CARDS GRID -->
    {:else if placesState.viewMode === 'cards'}
      <div class="cards-grid">
        {#each placesState.filteredPlaces as place (place.id)}
          <PlaceCard place={place} />
        {/each}
      </div>

    <!-- VIEW MODE: MAP VIEWER WITH GEOFENCING -->
    {:else if placesState.viewMode === 'map'}
      <div class="map-view-layout">
        <PlaceMapViewer 
          places={placesState.filteredPlaces} 
          height="600px"
          onSelectPlace={(p) => placesState.selectPlace(p.id)}
        />
      </div>

    <!-- VIEW MODE: HIERARCHY TREE -->
    {:else if placesState.viewMode === 'tree'}
      <div class="tree-view-layout">
        <PlaceHierarchyTree
          nodes={placesState.hierarchyTree}
          allPlaces={placesState.places}
          selectedPlaceId={placesState.selectedPlaceId}
          onSelectPlace={(p) => placesState.selectPlace(p.id)}
          onReparent={(targetId, newParent) => placesState.reparentPlace(targetId, newParent)}
        />
      </div>
    {/if}
  {/if}
</div>

<style>
  .places-page-wrapper {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  /* 1. Page Top Actions */
  .page-top-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .header-icon-badge {
    width: 48px;
    height: 48px;
    border-radius: 12px;
    background: #eff6ff;
    border: 1px solid #dbeafe;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .page-main-title {
    font-size: 24px;
    font-weight: 800;
    color: #0f172a;
    margin: 0;
    letter-spacing: -0.02em;
  }

  .page-subtitle {
    font-size: 13px;
    color: #64748b;
    margin: 2px 0 0 0;
  }

  .btn-primary-action {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 20px;
    border-radius: 10px;
    background: #2563eb;
    color: #ffffff;
    font-size: 14px;
    font-weight: 600;
    text-decoration: none;
    box-shadow: 0 2px 8px rgba(37, 99, 235, 0.25);
    transition: all 0.15s ease;
  }

  .btn-primary-action:hover {
    background: #1d4ed8;
    transform: translateY(-1px);
  }

  /* 2. Analytics Section */
  .analytics-section {
    width: 100%;
  }

  /* 3. Search Toolbar */
  .search-toolbar-card {
    background: #ffffff;
    border: 1px solid var(--border-color, #e2e8f0);
    border-radius: 12px;
    padding: 12px 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.02);
    flex-wrap: wrap;
  }

  .search-input-group {
    flex: 1;
    min-width: 280px;
    position: relative;
    display: flex;
    align-items: center;
  }

  .search-icon {
    position: absolute;
    left: 12px;
    pointer-events: none;
  }

  .main-search-input {
    width: 100%;
    padding: 9px 36px 9px 38px;
    border-radius: 8px;
    border: 1px solid #cbd5e1;
    font-size: 14px;
    color: #0f172a;
    background: #f8fafc;
    transition: all 0.15s ease;
  }

  .main-search-input:focus {
    outline: none;
    border-color: #2563eb;
    background: #ffffff;
    box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15);
  }

  .btn-clear-search {
    position: absolute;
    right: 10px;
    background: none;
    border: none;
    color: #94a3b8;
    cursor: pointer;
    padding: 2px;
  }

  .btn-clear-search:hover {
    color: #0f172a;
  }

  .toolbar-controls {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .select-filter {
    padding: 8px 12px;
    border-radius: 8px;
    border: 1px solid #cbd5e1;
    font-size: 13px;
    background: #ffffff;
    color: #334155;
  }

  .view-mode-tabs {
    display: flex;
    background: #f1f5f9;
    padding: 3px;
    border-radius: 8px;
    gap: 2px;
  }

  .mode-tab-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border-radius: 6px;
    border: none;
    background: transparent;
    color: #64748b;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .mode-tab-btn:hover {
    color: #0f172a;
  }

  .mode-tab-btn.active {
    background: #ffffff;
    color: #2563eb;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  }

  /* Type Chips Bar */
  .type-chips-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    overflow-x: auto;
    padding-bottom: 2px;
  }

  .filter-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border-radius: 20px;
    border: 1px solid #e2e8f0;
    background: #ffffff;
    color: #475569;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.15s ease;
  }

  .filter-chip:hover {
    background: #f8fafc;
    border-color: #cbd5e1;
  }

  .filter-chip.active {
    background: #eff6ff;
    border-color: #3b82f6;
    color: #1d4ed8;
    font-weight: 600;
  }

  /* Data Table */
  .data-table-card {
    background: #ffffff;
    border: 1px solid var(--border-color, #e2e8f0);
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.02);
  }

  .table-responsive {
    width: 100%;
    overflow-x: auto;
  }

  .places-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
    text-align: left;
  }

  .places-table th {
    padding: 12px 16px;
    background: #f8fafc;
    color: #475569;
    font-weight: 600;
    border-bottom: 1px solid #e2e8f0;
    white-space: nowrap;
  }

  .places-table td {
    padding: 14px 16px;
    border-bottom: 1px solid #f1f5f9;
    color: #1e293b;
    vertical-align: middle;
  }

  .places-table tr:hover td {
    background: #f8fafc;
  }

  .code-badge-table {
    font-family: monospace;
    font-weight: 700;
    color: #2563eb;
    background: #eff6ff;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 11px;
  }

  .place-name-cell {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .place-link {
    color: #0f172a;
    text-decoration: none;
  }

  .place-link:hover {
    color: #2563eb;
    text-decoration: underline;
  }

  .depth-sub-tag {
    font-size: 10px;
    font-weight: 700;
    color: #64748b;
    background: #f1f5f9;
    padding: 1px 5px;
    border-radius: 4px;
  }

  .types-tags-cell {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
  }

  .type-tag {
    font-size: 10px;
    font-weight: 600;
    text-transform: capitalize;
    color: #475569;
    background: #f1f5f9;
    padding: 2px 6px;
    border-radius: 4px;
  }

  .address-cell {
    display: flex;
    align-items: center;
    gap: 6px;
    color: #475569;
  }

  .client-cell {
    font-weight: 500;
    color: #334155;
  }

  .table-status-pill {
    display: inline-block;
    font-size: 11px;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 12px;
    text-transform: capitalize;
  }

  .status-active, .status-attivo { background: #dcfce7; color: #166534; }
  .status-archived, .status-inattivo { background: #f1f5f9; color: #64748b; }
  .status-temporary { background: #fef9c3; color: #854d0e; }

  .table-action-buttons {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 6px;
  }

  .btn-tbl-action {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 6px;
    border: 1px solid #e2e8f0;
    background: #ffffff;
    color: #475569;
    text-decoration: none;
  }

  .btn-tbl-action:hover {
    background: #f1f5f9;
    color: #0f172a;
    border-color: #cbd5e1;
  }

  .text-right { text-align: right; }

  /* Cards Grid */
  .cards-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 16px;
  }

  /* Empty and Loading States */
  .loading-state-card, .empty-state-card {
    background: #ffffff;
    border: 1px solid var(--border-color, #e2e8f0);
    border-radius: 14px;
    padding: 64px 24px;
    text-align: center;
    color: #64748b;
  }

  .empty-icon {
    margin: 0 auto 16px auto;
  }

  .empty-title {
    font-size: 18px;
    font-weight: 700;
    color: #0f172a;
    margin: 0 0 6px 0;
  }

  .empty-desc {
    font-size: 14px;
    margin: 0 0 20px 0;
  }

  .btn-create-empty {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 9px 18px;
    border-radius: 8px;
    background: #2563eb;
    color: #ffffff;
    font-size: 13px;
    font-weight: 600;
    text-decoration: none;
  }

  .spinner {
    width: 36px;
    height: 36px;
    border: 3px solid #e2e8f0;
    border-top-color: #2563eb;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin: 0 auto 16px auto;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>
