<script lang="ts">
  import { Table, Card } from '$lib';
  import { Award, Plus } from '@lucide/svelte';
  import type { Qualification } from '$lib/services/qualifications';

  interface Props {
    qualificationsList: Qualification[];
    onAddNew: () => void;
    onSelectRow: (item: Qualification) => void;
  }

  let { qualificationsList, onAddNew, onSelectRow } = $props();

  const columns = [
    { key: 'name', header: 'Nome Qualifica' },
    { key: 'percentage', header: 'Provvigione Commerciale (%)' },
    { key: 'supervisorPercentage', header: 'Provvigione Supervisore (%)' }
  ];
</script>

{#snippet cell(col: any, row: any)}
  {#if col.key === 'name'}
    <span class="qual-name">{row.name}</span>
  {:else if col.key === 'percentage'}
    <span>{row.percentage}%</span>
  {:else if col.key === 'supervisorPercentage'}
    <span>{row.supervisorPercentage}%</span>
  {/if}
{/snippet}

<Card
  title="Gestione Qualifiche"
  description="Configura le qualifiche dei consulenti e le relative percentuali provvigionali."
  class="list-card"
>
  {#snippet icon()}
    <Award size={20} class="icon-accent" />
  {/snippet}


  <div class="table-wrapper">
    <Table
      {columns}
      data={qualificationsList}
      cellSnippet={cell}
      onRowClick={onSelectRow}
      emptyText="Nessuna qualifica registrata. Creane una nuova."
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

  .qual-name {
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
