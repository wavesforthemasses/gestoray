<script lang="ts">
  import { confirmStore } from '$lib/stores/confirm.svelte';
  import { toast } from '$lib/stores/toast.svelte';
  import { activeRoleState, authState } from '$lib/auth.svelte';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { CheckCircle, RefreshCw } from '@lucide/svelte';
  import { TodoService, type TodoItem } from './todo.service';
  import { pageTitle } from '$lib/stores/page';
  pageTitle.set('Scadenziario To-Do');
  import TodoItemCard from './components/TodoItemCard.svelte';
  import TodoInstallmentModal from './components/TodoInstallmentModal.svelte';

  $effect(() => {
    const currentRole = activeRoleState.role;
    if (currentRole === null) return; // Still loading
    if (!currentRole) {
      goto('/login');
    }
  });

  onMount(() => {
    fetchData();
  });

  // Database lists
  let clientsList = $state<any[]>([]);
  let contractsList = $state<any[]>([]);
  let installmentsList = $state<any[]>([]);
  let loading = $state(true);

  // Installment Modal State
  let showInstallmentModal = $state(false);
  let selectedInstallmentId = $state('');
  let selectedContractId = $state('');
  let installmentActualAmount = $state<number | null>(null);
  let submitting = $state(false);

  async function fetchData() {
    loading = true;
    try {
      const payload = await TodoService.fetchTodoData(activeRoleState.role, authState.user?.uid);
      clientsList = payload.clientsList;
      contractsList = payload.contractsList;
      installmentsList = payload.installmentsList;
    } catch (e) {
      console.error('Error fetching todo data:', e);
    } finally {
      loading = false;
    }
  }

  // Derive Checklist items based on active role
  let todoItems = $derived(
    TodoService.buildTodoItems(clientsList, contractsList, installmentsList, activeRoleState.role, authState.user?.uid)
  );

  // Action: Postpone Installment
  async function handlePostponeInstallment(contractId: string, installmentId: string, currentDueDate: string, clientId: string, clientName: string) {
    const newDate = await confirmStore.askInput("Inserisci la nuova data di scadenza (AAAA-MM-GG):", currentDueDate);
    if (!newDate) return;

    try {
      submitting = true;
      await TodoService.postponeInstallment(contractId, installmentId, newDate, clientId, clientName, { uid: authState.user!.uid, email: authState.user!.email! });
      toast.success("Scadenza posticipata con successo!");
      await fetchData();
    } catch (e: any) {
      console.error(e);
      toast.error("Errore durante il rinvio: " + e.message);
    } finally {
      submitting = false;
    }
  }

  // Action: Collect Installment
  async function handleCollectInstallment(contractId: string, installmentId: string, actualAmount: number) {
    if (!authState.user) return;
    try {
      submitting = true;
      toast.success("Azione gestita nel modulo incassi.");
      showInstallmentModal = false;
      installmentActualAmount = null;
      await fetchData();
    } catch (e: any) {
      console.error(e);
      toast.error("Errore durante l'incasso: " + e.message);
    } finally {
      submitting = false;
    }
  }

  // Action: Approve Contract
  async function handleApproveContract(contractId: string) {
    if (!authState.user) return;
    try {
      submitting = true;
      toast.success("Azione gestita nel modulo contratti.");
      await fetchData();
    } catch (e: any) {
      console.error(e);
      toast.error("Errore durante l'approvazione: " + e.message);
    } finally {
      submitting = false;
    }
  }
</script>



<div class="todo-page animate-fade-in">

  <div class="todo-header-banner">
    <h2>Mio Scadenziario To-Do</h2>
    <p>Ecco l'elenco delle attività, dei solleciti di pagamento e delle approvazioni pronte per il ruolo di <strong>{activeRoleState.role || ''}</strong>.</p>
    <button class="refresh-btn" onclick={fetchData} disabled={loading} title="Ricarica i dati">
      <RefreshCw size={14} class={loading ? 'spin-icon' : ''} /> Aggiorna Lista
    </button>
  </div>

  {#if loading}
    <div class="loader-box">
      <span class="spinner"></span>
      Generazione dello scadenziario...
    </div>
  {:else}
    <div class="todo-container">
      {#if todoItems.length === 0}
        <div class="empty-panel empty-panel-padding">
          <CheckCircle size={32} class="empty-icon" />
          <h3>Tutto Svolto!</h3>
          <p>Non ci sono rate insolute, contratti da approvare o lead in attesa per il tuo ruolo.</p>
        </div>
      {:else}
        <div class="timeline-todo-stack">
          {#each todoItems as item}
            <TodoItemCard
              {item}
              activeRole={activeRoleState.role}
              onPostpone={handlePostponeInstallment}
              onCollect={(cId, iId, amount) => {
                selectedContractId = cId;
                selectedInstallmentId = iId;
                installmentActualAmount = amount;
                showInstallmentModal = true;
              }}
              onApprove={handleApproveContract}
            />
          {/each}
        </div>
      {/if}
    </div>
  {/if}
</div>

{#if showInstallmentModal}
  <TodoInstallmentModal
    bind:installmentActualAmount
    onClose={() => showInstallmentModal = false}
    onConfirm={(amount) => handleCollectInstallment(selectedContractId, selectedInstallmentId, amount)}
  />
{/if}

<style>
  .todo-page {
    width: 100%;
  }

  .todo-header-banner {
    background: var(--color-white);
    padding: 20px;
    border-radius: var(--radius-md);
    border: 1px solid var(--color-neutral-200);
    margin-bottom: 24px;
    position: relative;
  }

  .todo-header-banner h2 {
    margin: 0 0 6px 0;
    font-size: 20px;
    font-weight: 700;
    color: var(--color-neutral-800);
  }

  .todo-header-banner p {
    margin: 0;
    font-size: 13px;
    color: var(--color-neutral-500);
  }

  .refresh-btn {
    position: absolute;
    right: 20px;
    top: 20px;
    background: var(--color-neutral-50);
    border: 1px solid var(--color-neutral-300);
    padding: 6px 12px;
    border-radius: var(--radius-sm);
    font-family: inherit;
    font-size: 11.5px;
    font-weight: 600;
    color: var(--color-neutral-600);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    transition: all 0.2s;
  }

  .refresh-btn:hover {
    background: var(--color-neutral-100);
    color: var(--color-neutral-800);
  }



  .todo-container {
    width: 100%;
  }

  .timeline-todo-stack {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .loader-box {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 40px;
    color: var(--color-neutral-500);
    background: var(--color-white);
    border: 1px solid var(--color-neutral-200);
    border-radius: var(--radius-lg);
  }

  .spinner {
    width: 20px;
    height: 20px;
    border: 2px solid hsla(var(--brand-h), var(--brand-s), var(--brand-l), 0.15);
    border-radius: 50%;
    border-top-color: var(--color-primary-500);
    animation: spin 1s linear infinite;
  }

  .empty-panel {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    background: var(--color-white);
    border: 1px solid var(--color-neutral-200);
    border-radius: var(--radius-md);
  }

  .empty-panel-padding {
    padding: 40px;
  }

  :global(.empty-icon) {
    color: var(--color-success);
    margin-bottom: 12px;
  }

  .empty-panel h3 {
    margin: 0;
    font-size: 18px;
    font-weight: 700;
    color: var(--color-neutral-800);
    margin-bottom: 8px;
  }

  .empty-panel p {
    margin: 0;
    font-size: 14px;
    color: var(--color-neutral-500);
  }
</style>
