<script lang="ts">
  import { hasAccess } from '$lib/utils/authCheck';
  import { activeRole, auth } from '$lib/auth';
  import { ActivitiesService, type ActivityItem } from './activities.service';
  import { DashboardService } from '../dashboard.service';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import ActivitiesChart from './components/ActivitiesChart.svelte';
  import ActivitiesTable from './components/ActivitiesTable.svelte';

  onMount(() => {
    const unsubscribe = activeRole.subscribe(($activeRole) => {
      if ($activeRole && !hasAccess($activeRole, ['superadmin', 'commerciale', 'amministrazione', 'direzione'])) {
        goto('/dashboard');
      }
    });

    if (typeof window !== 'undefined') {
      isGraphExpanded = localStorage.getItem('subpage_graph_expanded') === 'true';
    }

    fetchActivities();
    return () => unsubscribe();
  });

  let activitiesList = $state<ActivityItem[]>([]);
  let loading = $state(true);

  // Collapse/Expand state for chart
  let isGraphExpanded = $state(false);
  let selectedPointIdx = $state<number | null>(null);
  let granularity = $state<'settimanale' | 'mensile' | 'annuale'>('mensile');
  let endDateString = $state(new Date().toISOString().split('T')[0]);

  // Filters state
  let filterType = $state<'all' | 'Telefonata' | 'Incontro' | 'Appuntamento' | 'Sollecito Telefonico' | 'Sollecito Email' | 'Sollecito PEC'>('all');
  let searchQuery = $state('');

  async function fetchActivities() {
    loading = true;
    try {
      activitiesList = await ActivitiesService.fetchActivities();
    } catch (e) {
      console.error('Error fetching activities:', e);
    } finally {
      loading = false;
    }
  }

  function toggleGraph() {
    isGraphExpanded = !isGraphExpanded;
    if (typeof window !== 'undefined') {
      localStorage.setItem('subpage_graph_expanded', String(isGraphExpanded));
    }
  }

  // Generate date ranges backwards from endDateString
  let chartPeriods = $derived(DashboardService.generateChartPeriods(endDateString, granularity));

  // Filtered activities list
  let filteredActivities = $derived.by(() => {
    let result = activitiesList;

    if ($activeRole === 'commerciale' && $auth) {
      result = result.filter(a => a.loggedBy === $auth.uid);
    }

    if (filterType !== 'all') {
      result = result.filter(a => a.type === filterType);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(a => 
        a.clientName.toLowerCase().includes(query) || 
        a.notes.toLowerCase().includes(query) ||
        a.loggedEmail.toLowerCase().includes(query)
      );
    }

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
    {activitiesList}
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

  {#if loading}
    <div class="loader-box">
      <span class="spinner"></span>
      Caricamento storico attività...
    </div>
  {:else}
    <ActivitiesTable
      {filteredActivities}
      activeRole={$activeRole}
      {searchQuery}
      {filterType}
      onSearchChange={(q) => searchQuery = q}
      onFilterChange={(t) => filterType = t as any}
      onRowClick={handleSelectRow}
    />
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

  .spinner {
    width: 20px;
    height: 20px;
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
