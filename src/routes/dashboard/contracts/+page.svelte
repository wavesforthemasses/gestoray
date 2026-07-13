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
  let loadingMore = $state(false);
  let hasMore = $state(true);
  let lastVisible = $state<any>(null);

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

  async function loadData(reset = true) {
    if (reset) {
      loading = true;
      lastVisible = null;
      contractsList = [];
    } else {
      loadingMore = true;
    }
    
    try {
      if (usersList.length === 0) {
        usersList = await ContractsService.fetchUsers();
      }
      const result = await ContractsService.fetchContracts($activeRole || '', activeTab, $auth?.uid, 50, lastVisible);
      
      if (reset) {
        contractsList = result.list;
      } else {
        contractsList = [...contractsList, ...result.list];
      }
      
      lastVisible = result.lastDoc;
      hasMore = result.hasMore;
    } catch (e) {
      console.error('Error fetching contracts data:', e);
    } finally {
      loading = false;
      loadingMore = false;
    }
  }

  // Effect removed to prevent infinite loop

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
      onTabChange={(t: string) => {
        activeTab = t as any;
        if ($activeRole !== 'commerciale') {
          loadData();
        }
      }}
      {selectedPeriod}
    />
    
    {#if hasMore}
      <div class="load-more-container">
        <button class="btn-load-more" onclick={() => loadData(false)} disabled={loadingMore}>
          {#if loadingMore}
            <span class="spinner-small"></span> Caricamento...
          {:else}
            Carica Altri Contratti
          {/if}
        </button>
      </div>
    {/if}
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
