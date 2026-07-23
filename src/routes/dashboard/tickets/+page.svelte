<script lang="ts">
  import { hasAccess } from '$lib/utils/authCheck';
  import { activeRoleState } from '$lib/auth.svelte';
  import { pageTitle } from '$lib/stores/page';
  pageTitle.set('Gestione Tickets');
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { TicketsService, type TicketsItem } from './tickets.service';
  
  import TicketsTable from './components/TicketsTable.svelte';

  let itemsList = $state<TicketsItem[]>([]);
  let loading = $state(true);

  $effect(() => {
    const currentRole = activeRoleState.role;
    if (currentRole && !hasAccess(currentRole, ['superadmin', 'amministrazione'])) {
      goto('/dashboard');
    }
  });

  onMount(() => {
    fetchAll();
  });

  async function fetchAll() {
    loading = true;
    try {
      itemsList = await TicketsService.getAll();
    } catch (e) {
      console.error('Error fetching tickets:', e);
    } finally {
      loading = false;
    }
  }

  function handleAddNew() {
    goto('/dashboard/tickets/add');
  }

  function handleSelectRow(item: TicketsItem) {
    goto(`/dashboard/tickets/${item.id}`);
  }
</script>



<div class="tickets-page animate-fade-in">
  {#if loading}
    <div class="loader-box">
      <span class="spinner"></span>
      Caricamento...
    </div>
  {:else}
    <TicketsTable 
      {itemsList} 
      onAddNew={handleAddNew} 
      onSelectRow={handleSelectRow} 
    />
  {/if}
</div>

<style>
  .tickets-page {
    width: 100%;
  }

  .loader-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 14px;
    padding: 40px;
  }

  .spinner {
    width: 24px;
    height: 24px;
    border: 3px solid hsla(var(--brand-h), var(--brand-s), var(--brand-l), 0.15);
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
