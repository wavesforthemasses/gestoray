<script lang="ts">
  import { hasAccess } from '$lib/utils/authCheck';
  import { activeRole, auth } from '$lib/auth';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';

  import ContractsKPIs from './components/ContractsKPIs.svelte';
  import ContractsChart from './components/ContractsChart.svelte';
  import ContractsTable from './components/ContractsTable.svelte';
  import { ContractsService } from './contracts.service';

  let contractsList = $state<any[]>([]);
  let usersList = $state<any[]>([]);
  let loading = $state(true);

  let activeTab = $state<'all' | 'pending' | 'approved'>('all');
  let isGraphExpanded = $state(false);
  let selectedPointIdx = $state<number | null>(null);
  let chartPeriods = $state<Array<{ start: Date; end: Date; label: string }>>([]);

  onMount(() => {
    const unsubscribe = activeRole.subscribe(($activeRole) => {
      if ($activeRole && !hasAccess($activeRole, ['superadmin', 'amministrazione', 'commerciale', 'direzione'])) {
        goto('/dashboard');
      }
    });

    if (typeof window !== 'undefined') {
      isGraphExpanded = localStorage.getItem('subpage_graph_expanded') === 'true';
    }

    loadData();
    return () => unsubscribe();
  });

  async function loadData() {
    loading = true;
    try {
      usersList = await ContractsService.fetchUsers();
      contractsList = await ContractsService.fetchContracts($activeRole || '', activeTab, $auth?.uid);
    } catch (e) {
      console.error('Error fetching contracts data:', e);
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    if (activeTab && $activeRole !== 'commerciale') {
      loadData();
    }
  });

  let selectedPeriod = $derived(
    selectedPointIdx !== null && selectedPointIdx >= 0 && selectedPointIdx < chartPeriods.length
      ? chartPeriods[selectedPointIdx]
      : null
  );

  let commercialStats = $derived(ContractsService.computeCommercialStats(usersList, $auth?.uid));

  function toggleGraph() {
    isGraphExpanded = !isGraphExpanded;
    if (typeof window !== 'undefined') {
      localStorage.setItem('subpage_graph_expanded', String(isGraphExpanded));
    }
  }
</script>

<svelte:head>
  <title>Gestione Contratti | Gestoray</title>
</svelte:head>

<div class="contracts-page animate-fade-in">
  <ContractsKPIs {commercialStats} />

  <ContractsChart 
    bind:isGraphExpanded 
    onToggle={toggleGraph}
    bind:selectedPointIdx
    onPointSelect={(idx) => selectedPointIdx = idx}
    bind:chartPeriods
  />

  {#if loading}
    <div class="loader-box">
      <span class="spinner"></span>
      Caricamento dati...
    </div>
  {:else}
    <ContractsTable 
      {contractsList} 
      {usersList} 
      {activeTab} 
      onTabChange={(t: string) => activeTab = t}
      {selectedPeriod}
    />
  {/if}
</div>

<style>
  .contracts-page {
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
