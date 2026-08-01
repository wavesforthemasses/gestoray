<script lang="ts">
  import { hasAccess } from '$lib/utils/authCheck';
  import { activeRoleState, authState } from '$lib/auth.svelte';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { ArrowLeft, Users, Plus } from '@lucide/svelte';
  import { Card, SearchToolbar } from '$lib';

  import ClientAddForm from './components/ClientAddForm.svelte';
  import ClientsChart from './components/ClientsChart.svelte';
  import ClientsTable from './components/ClientsTable.svelte';
  import { ClientsService } from './clients.service';
  import { pageTitle } from '$lib/stores/page';
  pageTitle.set('Gestione Clienti CRM');


  $effect(() => {
    const currentRole = activeRoleState.role;
    if (currentRole && !hasAccess(currentRole, ['superadmin', 'commerciale', 'amministrazione', 'direzione'])) {
      goto('/dashboard');
    }
  });

  onMount(() => {

    if (typeof window !== 'undefined') {
      isGraphExpanded = localStorage.getItem('subpage_graph_expanded') === 'true';
    }

    fetchClients();
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
  {#if !showAddForm}
    <div class="page-top-actions">
      <div>
        <h2 class="title-header">
          <Users size={28} color="var(--color-primary-600)" />
          Gestione Clienti CRM
        </h2>
        <p class="subtitle">Database dei contatti e dei lead commerciali.</p>
      </div>

      {#if activeRoleState.role !== 'direzione'}
        <button class="btn-primary" onclick={() => showAddForm = true}>
          <Plus size={18} /> Aggiungi Cliente
        </button>
      {/if}
    </div>

    <ClientsChart 
      bind:isGraphExpanded 
      onToggle={toggleGraph}
      bind:selectedPointIdx
      onPointSelect={(idx: number | null) => selectedPointIdx = idx}
      bind:chartPeriods
    />

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
