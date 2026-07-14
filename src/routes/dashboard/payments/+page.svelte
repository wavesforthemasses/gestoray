<script lang="ts">
  import { activeRole, auth } from '$lib/auth';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { Plus } from '@lucide/svelte';
  import { httpsCallable } from 'firebase/functions';
  import { functions } from '$lib/firebase';
  import { DashboardService } from '../dashboard.service';

  import { PaymentsService } from './payments.service';
  import { pageTitle } from '$lib/stores/page';
  pageTitle.set('Gestione Incassi Cassa');
  import PaymentAddForm from './components/PaymentAddForm.svelte';
  import PaymentsChart from './components/PaymentsChart.svelte';
  import PaymentsTable from './components/PaymentsTable.svelte';

  let paymentsList = $state<any[]>([]);
  let clientsList = $state<any[]>([]);
  let chartData = $state<number[]>([]);
  
  let loading = $state(true);
  let loadingMore = $state(false);
  let hasMore = $state(true);
  let lastVisible = $state<any>(null);
  
  let showAddForm = $state(false);
  let successMsg = $state('');

  let isGraphExpanded = $state(false);
  let selectedPointIdx = $state<number | null>(null);
  let chartPeriods = $state<Array<{ start: Date; end: Date; label: string }>>([]);
  let searchQuery = $state('');

  onMount(() => {
    const unsubscribe = activeRole.subscribe(($activeRole) => {
      if ($activeRole && $activeRole !== 'superadmin' && $activeRole !== 'amministrazione' && $activeRole !== 'direzione') {
        goto('/dashboard');
      }
    });

    if (typeof window !== 'undefined') {
      isGraphExpanded = localStorage.getItem('subpage_graph_expanded') === 'true';
    }

    loadData(true);
    return () => unsubscribe();
  });

  $effect(() => {
    if (searchQuery) {
      const t = setTimeout(() => loadData(true), 300);
      return () => clearTimeout(t);
    }
  });

  $effect(() => {
    if (isGraphExpanded && chartPeriods.length > 0) {
      const t2 = setTimeout(() => fetchChartData(), 300);
      return () => clearTimeout(t2);
    }
  });

  async function loadData(reset = false) {
    if (reset) {
      loading = true;
      lastVisible = null;
      paymentsList = [];
    } else {
      loadingMore = true;
    }
    
    try {
      const result = await PaymentsService.fetchPayments(50, lastVisible, searchQuery);
      
      if (reset) {
        paymentsList = result.list;
      } else {
        paymentsList = [...paymentsList, ...result.list];
      }
      
      lastVisible = result.lastDoc;
      hasMore = result.hasMore;
    } catch (e) {
      console.error('Error fetching payments data:', e);
    } finally {
      loading = false;
      loadingMore = false;
    }
  }

  async function fetchChartData() {
    try {
      const getChartAggregations = httpsCallable(functions, 'getChartAggregations');
      const reqData = {
        entity: 'payments',
        periods: chartPeriods.map(p => ({
          start: p.start.toISOString(),
          end: p.end.toISOString()
        })),
        filters: {} // No specific filters for payments chart currently
      };
      
      const res: any = await getChartAggregations(reqData);
      chartData = res.data.data;
    } catch (e) {
      console.error('Error fetching chart data:', e);
    }
  }

  // Fetch clients only when adding a new payment
  $effect(() => {
    if (showAddForm && clientsList.length === 0) {
      PaymentsService.fetchClients().then(res => {
        clientsList = res;
      });
    }
  });

  let selectedPeriod = $derived(
    selectedPointIdx !== null && selectedPointIdx >= 0 && selectedPointIdx < chartPeriods.length
      ? chartPeriods[selectedPointIdx]
      : null
  );

  function toggleGraph() {
    isGraphExpanded = !isGraphExpanded;
    if (typeof window !== 'undefined') {
      localStorage.setItem('subpage_graph_expanded', String(isGraphExpanded));
    }
  }

  function handleAddSuccess(msg: string) {
    successMsg = msg;
    showAddForm = false;
    loadData(true); // refresh the list
  }
</script>



<div class="payments-page animate-fade-in">
  {#if successMsg}
    <div class="alert success animate-fade-in">{successMsg}</div>
  {/if}

  {#if showAddForm}
    <PaymentAddForm 
      {clientsList} 
      onCancel={() => { showAddForm = false; successMsg = ''; }} 
      onSuccess={handleAddSuccess}
      authUser={$auth}
    />
  {:else}
    {#if $activeRole !== 'direzione'}
      <div class="actions-header">
        <button onclick={() => { showAddForm = true; successMsg = ''; }} class="add-payment-btn">
          <Plus size={16} /> Registra Nuovo Incasso
        </button>
      </div>
    {/if}

    <PaymentsChart 
      {chartData}
      bind:isGraphExpanded 
      onToggle={toggleGraph}
      bind:selectedPointIdx
      onPointSelect={(idx: number | null) => selectedPointIdx = idx}
      bind:chartPeriods
    />

    <div class="search-bar" style="margin-bottom: 20px;">
       <input 
          type="text" 
          placeholder="Cerca incassi (es. nome cliente)..." 
          bind:value={searchQuery}
          style="padding: 10px; width: 100%; max-width: 400px; border: 1px solid var(--color-neutral-300); border-radius: var(--radius-sm);"
       />
    </div>

    {#if loading}
      <div class="loader-box">
        <span class="spinner"></span>
        Caricamento registro incassi...
      </div>
    {:else}
      <PaymentsTable 
        {paymentsList} 
        {selectedPeriod}
      />
      
      {#if hasMore}
        <div class="load-more-container">
          <button class="btn-load-more" onclick={() => loadData(false)} disabled={loadingMore}>
            {#if loadingMore}
              <span class="spinner-small"></span> Caricamento...
            {:else}
              Carica Altri Risultati
            {/if}
          </button>
        </div>
      {/if}
    {/if}
  {/if}
</div>

<style>
  .payments-page {
    width: 100%;
  }

  .actions-header {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 16px;
  }

  .add-payment-btn {
    background: linear-gradient(135deg, var(--color-primary-500), var(--color-primary-600));
    color: var(--color-white);
    border: none;
    padding: 8px 14px;
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-family: inherit;
    font-size: 13px;
    font-weight: 600;
    transition: all 0.2s;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    box-shadow: 0 4px 10px hsla(var(--brand-h), var(--brand-s), var(--brand-l), 0.15);
  }

  .add-payment-btn:hover {
    transform: translateY(-1px);
    box-shadow: 0 6px 14px hsla(var(--brand-h), var(--brand-s), var(--brand-l), 0.25);
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
