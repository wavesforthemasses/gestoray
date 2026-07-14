<script lang="ts">
  import { Card, Table } from '$lib';
  import { ClipboardList, Search } from '@lucide/svelte';
  import type { ActivityItem } from '../activities.service';
  import { formatDateTime } from '$lib/utils/formatters';
  import { activitiesConfigStore } from '$lib/stores/activities';

  interface Props {
    filteredActivities: ActivityItem[];
    activeRole: string | null;
    searchQuery: string;
    filterType: string;
    onSearchChange: (q: string) => void;
    onFilterChange: (t: string) => void;
    onRowClick: (row: any) => void;
  }

  let {
    filteredActivities,
    activeRole,
    searchQuery,
    filterType,
    onSearchChange,
    onFilterChange,
    onRowClick
  }: Props = $props();

  const columns = $derived.by(() => {
    const list = [
      { key: 'date', header: 'Data Attività' },
      { key: 'clientName', header: 'Cliente' },
      { key: 'type', header: 'Tipo Attività' },
      { key: 'notes', header: 'Descrizione / Note' }
    ];

    if (activeRole !== 'commerciale') {
      list.push({ key: 'loggedEmail', header: 'Eseguito Da' });
    }

    return list;
  });
</script>

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
          value={searchQuery}
          oninput={(e) => onSearchChange(e.currentTarget.value)}
          class="filter-search-input"
        />
      </div>

      <!-- Type Selector -->
      <div class="type-filter-tabs">
        <button class="tab-btn" class:active={filterType === 'all'} onclick={() => onFilterChange('all')}>Tutte</button>
        {#each $activitiesConfigStore.filter(kpi => kpi.rolesView.includes(activeRole || '')) as kpi}
          <button class="tab-btn" class:active={filterType === kpi.id} onclick={() => onFilterChange(kpi.id)}>{kpi.name}</button>
        {/each}
      </div>
    </div>
  {/snippet}

  {#snippet cell(col: any, row: any)}
    {#if col.key === 'date'}
      <span class="date-txt">{formatDateTime(row.date)}</span>
    {:else if col.key === 'clientName'}
      <span class="client-name">{row.clientName}</span>
    {:else if col.key === 'type'}
      <span class="badge badge-inc">
        {row.type}
      </span>
    {:else if col.key === 'notes'}
      <p class="notes-txt" title={row.notes}>{row.notes || 'Nessuna nota registrata.'}</p>
    {:else if col.key === 'loggedEmail'}
      <span class="logged-txt">{row.loggedEmail}</span>
    {/if}
  {/snippet}

  <div class="table-wrapper">
    <Table
      {columns}
      data={filteredActivities}
      cellSnippet={cell}
      onRowClick={onRowClick}
      emptyText="Nessuna attività registrata corrispondente ai filtri impostati."
    />
  </div>
</Card>

<style>
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
    box-shadow: 0 0 0 2px hsla(var(--brand-h), var(--brand-s), var(--brand-l), 0.1);
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

  .badge-tel { background: var(--color-info-600, #0284c7); }
  .badge-inc { background: var(--color-success-600, #0d9488); }
  .badge-app { background: var(--color-primary-600, #4f46e5); }

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

  .table-wrapper {
    width: 100%;
    overflow-x: auto;
  }

  :global(.icon-accent) {
    color: var(--color-primary-500);
  }
</style>
