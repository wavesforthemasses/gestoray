<script lang="ts">
  import { hasAccess } from '$lib/utils/authCheck';
  import { activeRole, auth } from '$lib/auth';
  import { ActivitiesService, type ActivityItem } from './activities.service';
  import { DashboardService } from '../dashboard.service';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import ActivitiesChart from './components/ActivitiesChart.svelte';
  import ActivitiesTable from './components/ActivitiesTable.svelte';
  import { httpsCallable } from 'firebase/functions';
  import { functions } from '$lib/firebase';

  onMount(() => {
    const unsubscribe = activeRole.subscribe(($activeRole) => {
      if ($activeRole && !hasAccess($activeRole, ['superadmin', 'commerciale', 'amministrazione', 'direzione'])) {
        goto('/dashboard');
      }
    });

    if (typeof window !== 'undefined') {
      isGraphExpanded = localStorage.getItem('subpage_graph_expanded') === 'true';
    }

    // Initial load
    fetchActivitiesData(true);
    
    return () => unsubscribe();
  });

  let activitiesList = $state<ActivityItem[]>([]);
  let chartData = $state<number[]>([]);
  let loading = $state(true);
  let loadingMore = $state(false);
  let hasMore = $state(true);
  let lastVisible = $state<any>(null);

  // Collapse/Expand state for chart
  let isGraphExpanded = $state(false);
  let selectedPointIdx = $state<number | null>(null);
  let granularity = $state<'settimanale' | 'mensile' | 'annuale'>('mensile');
  let endDateString = $state(new Date().toISOString().split('T')[0]);

  // Filters state
  let filterType = $state<'all' | 'Telefonata' | 'Incontro' | 'Appuntamento' | 'Sollecito Telefonico' | 'Sollecito Email' | 'Sollecito PEC'>('all');
  let searchQuery = $state('');

  // Let svelte react to parameter changes and trigger fetch
  $effect(() => {
    if (filterType || searchQuery) {
      // Small debounce
      const t = setTimeout(() => fetchActivitiesData(true), 300);
      return () => clearTimeout(t);
    }
  });
  
  $effect(() => {
    if (granularity || endDateString || filterType) {
      const t2 = setTimeout(() => fetchChartData(), 300);
      return () => clearTimeout(t2);
    }
  });

  async function fetchActivitiesData(reset = false) {
    if (reset) {
      loading = true;
      lastVisible = null;
      activitiesList = [];
    } else {
      loadingMore = true;
    }
    
    try {
      const myUid = $activeRole === 'commerciale' ? $auth?.uid : undefined;
      const result = await ActivitiesService.fetchActivities(
        50, 
        lastVisible, 
        searchQuery, 
        filterType,
        myUid
      );
      
      if (reset) {
        activitiesList = result.list;
      } else {
        activitiesList = [...activitiesList, ...result.list];
      }
      
      lastVisible = result.lastDoc;
      hasMore = result.hasMore;
    } catch (e) {
      console.error('Error fetching activities:', e);
    } finally {
      loading = false;
      loadingMore = false;
    }
  }
  
  async function fetchChartData() {
    try {
      const getChartAggregations = httpsCallable(functions, 'getChartAggregations');
      const myUid = $activeRole === 'commerciale' ? $auth?.uid : undefined;
      
      const periods = DashboardService.generateChartPeriods(endDateString, granularity);
      const reqData = {
        entity: 'activities',
        periods: periods.map(p => ({
          start: p.start.toISOString(),
          end: p.end.toISOString()
        })),
        filters: {
          type: filterType,
          loggedBy: myUid
        }
      };
      
      const res: any = await getChartAggregations(reqData);
      chartData = res.data.data;
    } catch (e) {
      console.error('Error fetching chart data:', e);
    }
  }

  function toggleGraph() {
    isGraphExpanded = !isGraphExpanded;
    if (typeof window !== 'undefined') {
      localStorage.setItem('subpage_graph_expanded', String(isGraphExpanded));
    }
  }

  let chartPeriods = $derived(DashboardService.generateChartPeriods(endDateString, granularity));

  // Client side filtering for selected point (since pagination affects it)
  // It's acceptable for the selected point to only filter the current loaded chunk.
  let filteredActivities = $derived.by(() => {
    let result = activitiesList;
    if (selectedPointIdx !== null && selectedPointIdx >= 0 && selectedPointIdx < chartPeriods.length) {
      const period = chartPeriods[selectedPointIdx];
      result = result.filter(a => {
        const d = new Date(a.date);
        return d >= period.start && d <= period.end;
      });
    }
    return result;
  });

  function handleSelectRow(row: any) {
    goto(`/dashboard/clients/${row.clientId}?tab=activities`);
  }
</script>

<svelte:head>
  <title>Registro Attività | Gestoray</title>
</svelte:head>

<div class="activities-page animate-fade-in">
  <ActivitiesChart
    {chartData}
    activeRole={$activeRole}
    myUid={$auth?.uid}
    {filterType}
    {granularity}
    {endDateString}
    {selectedPointIdx}
    {isGraphExpanded}
    onToggleGraph={toggleGraph}
    onFilterChange={(type) => { filterType = type as any; selectedPointIdx = null; }}
    onGranularityChange={(g) => granularity = g}
    onEndDateChange={(date) => endDateString = date}
    onSelectPoint={(idx) => selectedPointIdx = idx}
    {chartPeriods}
  />

  <ActivitiesTable
    {filteredActivities}
    activeRole={$activeRole}
    {searchQuery}
    {filterType}
    onSearchChange={(q) => { searchQuery = q; selectedPointIdx = null; }}
    onFilterChange={(t) => { filterType = t as any; selectedPointIdx = null; }}
    onRowClick={handleSelectRow}
  />
  
  {#if loading}
    <div class="loader-box">
      <span class="spinner"></span>
      Caricamento...
    </div>
  {:else if hasMore}
    <div class="load-more-container">
      <button class="btn-load-more" onclick={() => fetchActivitiesData(false)} disabled={loadingMore}>
        {#if loadingMore}
          <span class="spinner-small"></span> Caricamento...
        {:else}
          Carica Altri Risultati
        {/if}
      </button>
    </div>
  {/if}
</div>

<style>
  .activities-page {
    width: 100%;
  }

  .loader-box {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 40px;
    color: var(--color-neutral-500);
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

  .spinner {
    width: 20px;
    height: 20px;
    border: 2px solid hsla(var(--brand-h), var(--brand-s), var(--brand-l), 0.15);
    border-radius: 50%;
    border-top-color: var(--color-primary-500);
    animation: spin 1s linear infinite;
  }

  .spinner-small {
    width: 14px;
    height: 14px;
    border: 2px solid hsla(var(--brand-h), var(--brand-s), var(--brand-l), 0.15);
    border-radius: 50%;
    border-top-color: var(--color-primary-500);
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .animate-fade-in {
    animation: fadeIn 0.3s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  }
</style>
