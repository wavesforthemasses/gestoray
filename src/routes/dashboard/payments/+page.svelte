<script lang="ts">
  import { activeRole, auth } from '$lib/auth';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { Plus } from '@lucide/svelte';

  import { PaymentsService } from './payments.service';
  import PaymentAddForm from './components/PaymentAddForm.svelte';
  import PaymentsChart from './components/PaymentsChart.svelte';
  import PaymentsTable from './components/PaymentsTable.svelte';

  let paymentsList = $state<any[]>([]);
  let clientsList = $state<any[]>([]);
  let loading = $state(true);
  
  let showAddForm = $state(false);
  let successMsg = $state('');

  let isGraphExpanded = $state(false);
  let selectedPointIdx = $state<number | null>(null);
  let chartPeriods = $state<Array<{ start: Date; end: Date; label: string }>>([]);

  onMount(() => {
    const unsubscribe = activeRole.subscribe(($activeRole) => {
      if ($activeRole && $activeRole !== 'superadmin' && $activeRole !== 'amministrazione' && $activeRole !== 'direzione') {
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
      paymentsList = await PaymentsService.fetchPayments();
    } catch (e) {
      console.error('Error fetching payments data:', e);
    } finally {
      loading = false;
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
    loadData(); // refresh the list
  }
</script>

<svelte:head>
  <title>Gestione Incassi Cassa | Gestoray</title>
</svelte:head>

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
      bind:isGraphExpanded 
      onToggle={toggleGraph}
      bind:selectedPointIdx
      onPointSelect={(idx: number | null) => selectedPointIdx = idx}
      bind:chartPeriods
    />

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
    opacity: 0.9;
    transform: translateY(-1px);
    box-shadow: 0 6px 15px hsla(var(--brand-h), var(--brand-s), var(--brand-l), 0.25);
  }

  .alert {
    padding: 12px 16px;
    border-radius: var(--radius-md);
    font-size: 14px;
    font-weight: 500;
    margin-bottom: 24px;
  }
  .alert.success {
    background: var(--color-success-100);
    color: var(--color-success-700);
    border-left: 4px solid var(--color-success-500);
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
