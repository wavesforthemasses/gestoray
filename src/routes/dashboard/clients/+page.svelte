<script lang="ts">
  import { hasAccess } from '$lib/utils/authCheck';
  import { activeRoleState, authState } from '$lib/auth.svelte';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { Users, Plus } from '@lucide/svelte';
  import { SearchToolbar, UniversalAnalyticsChart } from '$lib';
  import { DashboardService } from '../dashboard.service';

  import ClientsTable from './components/ClientsTable.svelte';
  import { ClientsService } from './clients.service';
  import { pageTitle } from '$lib/stores/page';
  pageTitle.set('Gestione Clienti CRM');

  let activeChartTab = $state<string>('nuove_anagrafiche');
  let granularity = $state<'settimanale' | 'mensile' | 'annuale'>('mensile');
  let endDateString = $state(new Date().toISOString().split('T')[0]);
  let loadingChart = $state(false);
  let computedChartPoints = $state<number[]>([]);

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
      console.error("Error loading clients chart data:", e);
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
    const currentRole = activeRoleState.role;
    if (currentRole && !hasAccess(currentRole, ['superadmin', 'commerciale', 'amministrazione', 'direzione'])) {
      goto('/dashboard');
    }
  });

  import { ChartSettingsService } from '$lib';

  let clientChartConfig = $state(ChartSettingsService.getEntityConfig('clients'));

  let isChartEnabled = $derived(clientChartConfig ? clientChartConfig.enabled : true);
  let sideKpisPosition = $derived<"right" | "none">(
    clientChartConfig && clientChartConfig.showSideKpis ? 'right' : 'none'
  );

  let activeMetrics = $derived.by(() => {
    if (!clientChartConfig) return [];
    return clientChartConfig.kpis
      .filter(k => k.enabled)
      .map(k => ({
        id: k.id,
        label: k.name,
        shortLabel: k.acronym,
        isCurrency: k.isCurrency
      }));
  });

  onMount(async () => {
    if (typeof window !== 'undefined') {
      isGraphExpanded = localStorage.getItem('subpage_graph_expanded') === 'true';
    }
    try {
      await ChartSettingsService.getSettings();
      const c = ChartSettingsService.getEntityConfigSync('clients');
      if (c) clientChartConfig = c;
    } catch (e) {
      console.error('Errore caricamento impostazioni grafico clienti:', e);
    }
    fetchClients();
  });

  let clientsList = $state<any[]>([]);
  let loadingClients = $state(true);
  let loadingMore = $state(false);
  let hasMore = $state(true);
  let lastVisible = $state<any>(null);
  
  let searchQuery = $state('');

  let isGraphExpanded = $state(false);
  let selectedPointIdx = $state<number | null>(null);
  let chartPeriods = $state<Array<{ start: Date; end: Date; label: string }>>([]);

  let selectedPeriod = $derived(
    selectedPointIdx !== null && selectedPointIdx >= 0 && selectedPointIdx < chartPeriods.length
      ? chartPeriods[selectedPointIdx]
      : null
  );

  async function fetchClients(searchVal?: string, reset = true) {
    if (reset) {
      loadingClients = true;
      lastVisible = null;
      clientsList = [];
    } else {
      loadingMore = true;
    }
    
    try {
      const result = await ClientsService.fetchClients(searchVal, activeRoleState.role || '', authState.user?.uid, 50, lastVisible);
      
      if (reset) {
        clientsList = result.list;
      } else {
        clientsList = [...clientsList, ...result.list];
      }
      
      lastVisible = result.lastDoc;
      hasMore = result.hasMore;
    } catch (e) {
      console.error('Error fetching clients:', e);
    } finally {
      loadingClients = false;
      loadingMore = false;
    }
  }

  function toggleGraph() {
    isGraphExpanded = !isGraphExpanded;
    if (typeof window !== 'undefined') {
      localStorage.setItem('subpage_graph_expanded', String(isGraphExpanded));
    }
  }
</script>

<div class="clients-page animate-fade-in">
  <div class="page-top-actions">
      <div>
        <h2 class="title-header">
          <Users size={28} color="var(--color-primary-600)" />
          Gestione Clienti CRM
        </h2>
        <p class="subtitle">Database dei contatti e dei lead commerciali.</p>
      </div>

      {#if activeRoleState.role !== 'direzione'}
        <a href="/dashboard/clients/add" class="btn-primary">
          <Plus size={18} /> Aggiungi Cliente
        </a>
      {/if}
    </div>

    {#if isChartEnabled}
      <UniversalAnalyticsChart 
        title="Andamento Nuovi Lead e Performance Clienti"
        description="Visualizza il trend e clicca su un punto del grafico per filtrare l'elenco dei clienti in base al periodo selezionato."
        metrics={activeMetrics}
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

    <SearchToolbar
      bind:searchQuery
      placeholder="Cerca cliente per nome, partita IVA o codice fiscale..."
      onSearch={(q) => fetchClients(q, true)}
      onReset={() => { searchQuery = ''; fetchClients(undefined, true); }}
    />

    {#if loadingClients}
      <div class="loader-box">
        <span class="spinner"></span>
        Caricamento clienti...
      </div>
    {:else}
      <ClientsTable 
        {clientsList}
        bind:searchQuery
        onSearch={(q: string) => fetchClients(q, true)}
        onReset={() => { searchQuery = ''; fetchClients(undefined, true); }}
        onAddClick={() => goto('/dashboard/clients/add')}
        {selectedPeriod}
      />

      {#if hasMore}
        <div class="load-more-container">
          <button class="btn-load-more" onclick={() => fetchClients(searchQuery, false)} disabled={loadingMore}>
            {#if loadingMore}
              <span class="spinner-small"></span> Caricamento...
            {:else}
              Carica Altri Risultati
            {/if}
          </button>
        </div>
      {/if}
    {/if}
</div>

<style>
  .clients-page {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .page-top-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }

  .title-header {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 24px;
    font-weight: 700;
    color: var(--color-neutral-900, #111827);
    margin: 0 0 4px 0;
  }

  .subtitle {
    font-size: 14px;
    color: var(--color-neutral-500, #6b7280);
    margin: 0;
  }

  .btn-primary {
    display: flex;
    align-items: center;
    gap: 8px;
    background: var(--color-primary-600, #2563eb);
    color: white;
    padding: 10px 18px;
    border: none;
    border-radius: var(--radius-md, 8px);
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
  }

  .btn-primary:hover {
    background: var(--color-primary-700, #1d4ed8);
  }


  .back-link {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: transparent;
    border: none;
    color: var(--color-neutral-500);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: color 0.2s;
  }

  .back-link:hover {
    color: var(--color-neutral-800);
  }

  .loader-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px 0;
    color: var(--color-neutral-500);
    font-size: 14px;
    font-weight: 500;
    background: var(--color-white);
    border-radius: var(--radius-lg);
    border: 1px solid var(--color-neutral-200);
  }

  .spinner {
    width: 30px;
    height: 30px;
    border: 3px solid var(--color-neutral-200);
    border-top-color: var(--color-primary-500);
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 16px;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .spinner-small {
    width: 14px;
    height: 14px;
    border: 2px solid hsla(var(--brand-h), var(--brand-s), var(--brand-l), 0.15);
    border-radius: 50%;
    border-top-color: var(--color-primary-500);
    animation: spin 1s linear infinite;
  }

  .load-more-container {
    display: flex;
    justify-content: center;
    padding: 24px 0 40px;
  }

  .btn-load-more {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 24px;
    background: var(--color-white);
    border: 1px solid var(--color-neutral-300);
    border-radius: var(--radius-full);
    font-size: 14px;
    font-weight: 600;
    color: var(--color-neutral-700);
    cursor: pointer;
    transition: all 0.2s;
    box-shadow: var(--shadow-sm);
  }

  .btn-load-more:hover:not(:disabled) {
    background: var(--color-neutral-100);
    color: var(--color-primary-600);
  }

  .btn-load-more:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
</style>
