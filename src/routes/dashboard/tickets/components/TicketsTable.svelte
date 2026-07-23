<script lang="ts">
  import { Table, Card } from '$lib';
  import { FileText, Plus } from '@lucide/svelte';
  import type { TicketsItem } from '../tickets.service';

  interface Props {
    itemsList: TicketsItem[];
    onAddNew: () => void;
    onSelectRow: (item: TicketsItem) => void;
  }

  let { itemsList, onAddNew, onSelectRow } = $props();

  const columns = [
    { key: 'name', header: 'Nome' }
  ];
</script>

{#snippet cell(col: any, row: any)}
  {#if col.key === 'name'}
    <span class="item-name">{row.name}</span>
  {/if}
{/snippet}

<Card
  title="Gestione Tickets"
  description="Gestisci l'elenco degli elementi."
  class="list-card"
>
  {#snippet icon()}
    <FileText size={20} class="icon-accent" />
  {/snippet}

  {#snippet headerSnippet()}
    <div class="header-actions">
      <button onclick={onAddNew} class="add-btn">
        <Plus size={16} /> Aggiungi Nuovo
      </button>
    </div>
  {/snippet}

  <div class="table-wrapper">
    <Table
      {columns}
      data={itemsList}
      cellSnippet={cell}
      onRowClick={onSelectRow}
      emptyText="Nessun elemento trovato. Creane uno nuovo."
    />
  </div>
</Card>

<style>
  :global(.icon-accent) {
    color: var(--color-primary-500);
  }

  .add-btn {
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

  .add-btn:hover {
    opacity: 0.9;
  }

  .table-wrapper {
    width: 100%;
    overflow-x: auto;
  }

  .item-name {
    font-weight: 600;
    color: var(--color-neutral-800);
  }

  .header-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    align-items: center;
  }
</style>
