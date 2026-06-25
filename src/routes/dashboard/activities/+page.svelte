<script lang="ts">
  import { activeRole, auth } from '$lib/auth';
  import { db, collection, getDocs } from '$lib/firebase';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { Card, Table } from '$lib';
  import { 
    ClipboardList, MessageSquare, Phone, Calendar, 
    Users, ArrowRight, Search, Eye 
  } from '@lucide/svelte';

  onMount(() => {
    const unsubscribe = activeRole.subscribe(($activeRole) => {
      if ($activeRole && $activeRole !== 'superadmin' && $activeRole !== 'commerciale' && $activeRole !== 'amministrazione') {
        goto('/dashboard');
      }
    });

    fetchActivities();
    return () => unsubscribe();
  });

  let activitiesList = $state<Array<{ id: string, clientId: string, clientName: string, type: 'Telefonata' | 'Incontro' | 'Appuntamento', notes: string, date: string, loggedBy: string, loggedEmail: string }>>([]);
  let loading = $state(true);

  // Filters state
  let filterType = $state<'all' | 'Telefonata' | 'Incontro' | 'Appuntamento'>('all');
  let searchQuery = $state('');

  const columns = $derived.by(() => {
    const list = [
      { key: 'date', header: 'Data Attività' },
      { key: 'clientName', header: 'Cliente' },
      { key: 'type', header: 'Tipo Attività' },
      { key: 'notes', header: 'Descrizione / Note' }
    ];

    if ($activeRole !== 'commerciale') {
      list.push({ key: 'loggedEmail', header: 'Eseguito Da' });
    }

    list.push({ key: 'actions', header: 'Azioni' });
    return list;
  });

  async function fetchActivities() {
    loading = true;
    try {
      const querySnapshot = await getDocs(collection(db, 'activities'));
      const list: typeof activitiesList = [];
      querySnapshot.forEach((doc: any) => {
        const data = doc.data();
        list.push({
          id: doc.id,
          clientId: data.clientId,
          clientName: data.clientName || 'Sconosciuto',
          type: data.type,
          notes: data.notes || '',
          date: data.date,
          loggedBy: data.loggedBy,
          loggedEmail: data.loggedEmail || 'Sistema'
        });
      });

      // Sort by date descending
      activitiesList = list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    } catch (e) {
      console.error('Error fetching activities:', e);
    } finally {
      loading = false;
    }
  }

  // Filtered activities list
  let filteredActivities = $derived.by(() => {
    let result = activitiesList;

    // Filter by role: Commerciale only sees their own activities
    if ($activeRole === 'commerciale' && $auth) {
      result = result.filter(a => a.loggedBy === $auth.uid);
    }

    // Filter by type
    if (filterType !== 'all') {
      result = result.filter(a => a.type === filterType);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(a => 
        a.clientName.toLowerCase().includes(query) || 
        a.notes.toLowerCase().includes(query) ||
        a.loggedEmail.toLowerCase().includes(query)
      );
    }

    return result;
  });

  function handleSelectRow(row: any) {
    goto(`/dashboard/clients/${row.clientId}?tab=activities`);
  }
</script>

<svelte:head>
  <title>Gestione Attività | Gestoray</title>
</svelte:head>

<div class="activities-page animate-fade-in">
  <Card
    title="Registro Attività Commerciali"
    description="Cronologia di tutte le telefonate, incontri ed appuntamenti pianificati con i clienti del database."
  >
    {#snippet icon()}
      <ClipboardList size={20} class="icon-accent" />
    {/snippet}

    {#snippet headerSnippet()}
      <div class="filters-row">
        <!-- Text Search -->
        <div class="search-input-wrapper">
          <Search size={14} class="search-icon" />
          <input 
            type="text" 
            placeholder="Cerca per cliente, note..." 
            bind:value={searchQuery}
            class="filter-search-input"
          />
        </div>

        <!-- Type Selector -->
        <div class="type-filter-tabs">
          <button class="tab-btn" class:active={filterType === 'all'} onclick={() => filterType = 'all'}>Tutte</button>
          <button class="tab-btn" class:active={filterType === 'Telefonata'} onclick={() => filterType = 'Telefonata'}>Telefonate</button>
          <button class="tab-btn" class:active={filterType === 'Incontro'} onclick={() => filterType = 'Incontro'}>Incontri</button>
          <button class="tab-btn" class:active={filterType === 'Appuntamento'} onclick={() => filterType = 'Appuntamento'}>Appuntamenti</button>
        </div>
      </div>
    {/snippet}

    {#if loading}
      <div class="loader-box">
        <span class="spinner"></span>
        Caricamento storico attività...
      </div>
    {:else}
      {#snippet cell(col: any, row: any)}
        {#if col.key === 'date'}
          <span class="date-txt">{new Date(row.date).toLocaleString('it-IT')}</span>
        {:else if col.key === 'clientName'}
          <span class="client-name">{row.clientName}</span>
        {:else if col.key === 'type'}
          <span class="badge" class:badge-tel={row.type === 'Telefonata'} class:badge-inc={row.type === 'Incontro'} class:badge-app={row.type === 'Appuntamento'}>
            {row.type}
          </span>
        {:else if col.key === 'notes'}
          <p class="notes-txt" title={row.notes}>{row.notes || 'Nessuna nota registrata.'}</p>
        {:else if col.key === 'loggedEmail'}
          <span class="logged-txt">{row.loggedEmail}</span>
        {:else if col.key === 'actions'}
          <button onclick={() => goto(`/dashboard/clients/${row.clientId}?tab=activities`)} class="view-client-btn" title="Vai alla scheda cliente">
            <Eye size={14} /> Scheda
          </button>
        {/if}
      {/snippet}

      <div class="table-wrapper">
        <Table
          {columns}
          data={filteredActivities}
          cellSnippet={cell}
          onRowClick={handleSelectRow}
          emptyText="Nessuna attività registrata corrispondente ai filtri impostati."
        />
      </div>
    {/if}
  </Card>
</div>

<style>
  .activities-page {
    width: 100%;
  }

  .filters-row {
    display: flex;
    gap: 16px;
    align-items: center;
    flex-wrap: wrap;
  }

  .search-input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
  }

  :global(.search-icon) {
    position: absolute;
    left: 10px;
    color: var(--color-neutral-400);
  }

  .filter-search-input {
    padding: 6px 10px 6px 30px;
    border: 1px solid var(--color-neutral-300);
    border-radius: var(--radius-sm);
    font-family: inherit;
    font-size: 12.5px;
    width: 200px;
    background: var(--color-white);
  }

  .filter-search-input:focus {
    outline: none;
    border-color: var(--color-primary-500);
    box-shadow: 0 0 0 2px hsla(var(--brand-h), var(--brand-s), 50%, 0.1);
  }

  .type-filter-tabs {
    display: flex;
    gap: 4px;
    background: var(--color-neutral-100);
    padding: 3px;
    border-radius: var(--radius-md);
    border: 1px solid var(--color-neutral-200);
  }

  .tab-btn {
    background: transparent;
    border: none;
    padding: 6px 12px;
    border-radius: var(--radius-sm);
    font-family: inherit;
    font-size: 11.5px;
    font-weight: 600;
    color: var(--color-neutral-500);
    cursor: pointer;
    transition: all 0.2s;
  }

  .tab-btn.active {
    background: var(--color-white);
    color: var(--color-primary-600);
    box-shadow: var(--shadow-sm);
  }

  .date-txt {
    font-size: 13px;
    color: var(--color-neutral-500);
  }

  .client-name {
    font-weight: 600;
    color: var(--color-neutral-800);
  }

  .badge {
    font-size: 10px;
    font-weight: 700;
    padding: 3px 8px;
    border-radius: var(--radius-sm);
    text-transform: uppercase;
    color: var(--color-white);
    display: inline-block;
  }

  .badge-tel { background: #0284c7; }
  .badge-inc { background: #0d9488; }
  .badge-app { background: #4f46e5; }

  .notes-txt {
    margin: 0;
    font-size: 13px;
    color: var(--color-neutral-600);
    white-space: nowrap;
    text-overflow: ellipsis;
    overflow: hidden;
    max-width: 320px;
  }

  .logged-txt {
    font-size: 12px;
    color: var(--color-neutral-500);
  }

  .view-client-btn {
    background: var(--color-white);
    border: 1px solid var(--color-neutral-300);
    color: var(--color-neutral-600);
    padding: 4px 10px;
    border-radius: var(--radius-sm);
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    transition: all 0.2s;
  }

  .view-client-btn:hover {
    background: var(--color-neutral-100);
    color: var(--color-neutral-800);
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
    border: 2px solid hsla(var(--brand-h), var(--brand-s), 50%, 0.15);
    border-radius: 50%;
    border-top-color: var(--color-primary-500);
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .table-wrapper {
    width: 100%;
    overflow-x: auto;
  }

  :global(.icon-accent) {
    color: var(--color-primary-500);
  }

  .animate-fade-in {
    animation: fadeIn 0.3s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  }
</style>
