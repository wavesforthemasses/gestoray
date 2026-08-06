<script lang="ts">
  import { projectStore } from '$lib/stores/project';
  import { onMount } from 'svelte';
  import { PlacesService } from './places.service';
  import { PlaceSettingsService } from './placeSettingsService';
  import type { PlaceItem, PlaceSettings } from './schema';
  import { Card, StatusBadge } from '$lib';
  import { pageTitle } from '$lib/stores/page';
  import { 
    MapPin, 
    Plus, 
    Search, 
    User, 
    CheckCircle2, 
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

  onMount(async () => {
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
  });
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

  <div class="kpi-grid">
    <Card class="stat-card">
      <div class="kpi-card">
        <div class="kpi-icon-wrapper active">
          <MapPin size={20} />
        </div>
        <div class="kpi-content">
          <span class="kpi-label">{labels.plural} Totali</span>
          <span class="kpi-value">{places.length}</span>
        </div>
      </div>
    </Card>

    <Card class="stat-card">
      <div class="kpi-card">
        <div class="kpi-icon-wrapper success">
          <CheckCircle2 size={20} />
        </div>
        <div class="kpi-content">
          <span class="kpi-label">{labels.plural} Attivi</span>
          <span class="kpi-value">{activePlacesCount}</span>
        </div>
      </div>
    </Card>
  </div>

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
  }

  .kpi-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 16px;
    margin-bottom: 24px;
  }

  .kpi-card {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .kpi-icon-wrapper {
    width: 42px;
    height: 42px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .kpi-icon-wrapper.active { background: #e0f2fe; color: #0284c7; }
  .kpi-icon-wrapper.success { background: #dcfce7; color: #16a34a; }

  .kpi-content {
    display: flex;
    flex-direction: column;
  }

  .kpi-label {
    font-size: 12px;
    color: var(--color-neutral-500);
  }

  .kpi-value {
    font-size: 20px;
    font-weight: 700;
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

  .search-input {
    width: 100%;
    padding: 10px 14px 10px 40px;
    border-radius: 8px;
    border: 1px solid var(--color-neutral-300);
    font-size: 14px;
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
    cursor: pointer;
  }

  .filter-chip.active {
    background: var(--color-primary-600);
    color: white;
    border-color: var(--color-primary-600);
  }

  .empty-state {
    text-align: center;
    padding: 60px 20px;
    background: white;
    border-radius: 12px;
    border: 1px dashed var(--color-neutral-300);
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
  }

  .status-badge {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    padding: 3px 8px;
    border-radius: 6px;
    background: var(--color-neutral-100);
  }

  .place-title {
    font-size: 16px;
    font-weight: 700;
    margin: 0 0 12px 0;
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
  }
</style>
