<script lang="ts">
  import { hasAccess } from '$lib/utils/authCheck';
  import { activeRole, auth } from '$lib/auth';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { ArrowLeft } from '@lucide/svelte';
  import { Card } from '$lib';

  import ClientAddForm from './components/ClientAddForm.svelte';
  import ClientsChart from './components/ClientsChart.svelte';
  import ClientsTable from './components/ClientsTable.svelte';
  import { ClientsService } from './clients.service';
  import { pageTitle } from '$lib/stores/page';
  pageTitle.set('Gestione Clienti CRM');

  onMount(() => {
    const unsubscribe = activeRole.subscribe(($activeRole) => {
      if ($activeRole && !hasAccess($activeRole, ['superadmin', 'commerciale', 'amministrazione', 'direzione'])) {
        goto('/dashboard');
      }
    });

    if (typeof window !== 'undefined') {
      isGraphExpanded = localStorage.getItem('subpage_graph_expanded') === 'true';
    }

    fetchClients();
    return () => unsubscribe();
  });

  let clientsList = $state<any[]>([]);
  let loadingClients = $state(true);
  let loadingMore = $state(false);
  let hasMore = $state(true);
  let lastVisible = $state<any>(null);
  
  let showAddForm = $state(false);
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
      const result = await ClientsService.fetchClients(searchVal, $activeRole || '', $auth?.uid, 50, lastVisible);
      
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
  {#if !showAddForm}
    <ClientsChart 
      bind:isGraphExpanded 
      onToggle={toggleGraph}
      bind:selectedPointIdx
      onPointSelect={(idx) => selectedPointIdx = idx}
      bind:chartPeriods
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
        onSearch={(q) => fetchClients(q, true)}
        onReset={() => { searchQuery = ''; fetchClients(undefined, true); }}
        onAddClick={() => showAddForm = true}
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
  {:else}
    <Card
      title="Aggiungi Nuova Anagrafica"
      description="Crea una nuova scheda cliente. Nome Azienda, Identificativo Fiscale e almeno un recapito (Email o Telefono) sono obbligatori."
      class="form-card"
    >
      {#snippet headerSnippet()}
        <button onclick={() => { showAddForm = false; }} class="back-link">
          <ArrowLeft size={14} /> Annulla e torna all'elenco
        </button>
      {/snippet}

      <ClientAddForm on:created={() => { showAddForm = false; fetchClients(); }} />
    </Card>
  {/if}
</div>

<style>
  .clients-page {
    width: 100%;
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
