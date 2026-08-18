<script lang="ts">
  import { Table, Card } from '$lib';
  import { Users } from '@lucide/svelte';
  import { exportToCSV, exportToExcel, triggerPrint } from '$lib/export-utils';
  import StatusBadge from '$lib/components/StatusBadge.svelte';
  import { projectStore } from '$lib/stores/project';
  import { menuConfigStore } from '$lib/stores/menu';
  import type { ClientListItem } from '../schema';

  interface Props {
    clientsList: ClientListItem[];
    selectedPeriod: { start: Date; end: Date } | null;
  }

  let { 
    clientsList,
    selectedPeriod
  }: Props = $props();

  const dynamicClientActions = $derived(
    $menuConfigStore
      .filter((m: any) => m.clientQuickAction)
      .map((m: any) => ({
        label: m.clientQuickAction.label,
        title: m.clientQuickAction.title,
        href: (row: any) => `/dashboard/clients/${row.id}?tab=${m.clientQuickAction.tab}`
      }))
  );

  let filteredClients = $derived.by(() => {
    let list = clientsList;

    if (selectedPeriod) {
      list = list.filter((c: any) => {
        const creationDate = new Date(c.createdAt);
        return creationDate >= selectedPeriod.start && creationDate <= selectedPeriod.end;
      });
    }

    return list;
  });

  const columns = [
    { key: 'nome', header: 'Nome Azienda' },
    { key: 'cognome', header: 'Referente' },
    { key: 'email', header: 'Indirizzo Email' },
    { key: 'status', header: 'Stato Funnel' },
    { key: 'notesCount', header: 'Note' },
    { key: 'activitiesCount', header: 'Attività' },
    { key: 'actions', header: 'Azioni' }
  ];

</script>

{#snippet cell(col: any, row: any)}
  {#if col.key === 'nome'}
    <span class="name-cell">{row.nome}</span>
  {:else if col.key === 'cognome'}
    <span>{row.cognome || 'N/D'}</span>
  {:else if col.key === 'email'}
    <span class="mail-cell">{row.email || 'N/D'}</span>
  {:else if col.key === 'status'}
    <StatusBadge status={row.status || 'prospect'} />
  {:else if col.key === 'notesCount'}
    <span class="count-badge">{row.notes?.length || 0}</span>
  {:else if col.key === 'activitiesCount'}
    <span class="count-badge active">{row.derived?.activitiesCount || 0}</span>
  {:else if col.key === 'actions'}
    <div class="row-actions" role="presentation" onclick={(e) => e.stopPropagation()} onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') e.stopPropagation(); }}>
      <a 
        href={`/dashboard/clients/${row.id}`} 
        class="quick-action-btn action-link outline-action"
        title="Dettaglio Cliente"
      >
        Dettagli
      </a>
      {#each dynamicClientActions as act}
        <a 
          href={act.href(row)} 
          class="quick-action-btn action-link"
          title={act.title}
        >
          {act.label}
        </a>
      {/each}
    </div>
  {/if}
{/snippet}

<Card
  title="Anagrafica Clienti"
  description="Database dei contatti e anagrafiche. Fai clic su un cliente per vederne i dettagli, le note e le attività collegate."
  class="list-card"
>
  {#snippet icon()}
    <Users size={20} class="icon-accent" />
  {/snippet}

  {#snippet headerSnippet()}
    <div class="header-actions-group">
      <button onclick={() => exportToCSV(filteredClients, [
        { key: 'nome', header: 'Nome Azienda' },
        { key: 'cognome', header: 'Referente' },
        { key: 'email', header: 'Indirizzo Email' },
        { key: 'phone', header: 'Telefono' },
        { key: 'status', header: 'Stato Funnel' }
      ], `${$projectStore?.projectName.toLowerCase().replace(/\s+/g, '_') || 'crm'}_clienti`)} class="export-btn" title="Esporta in formato CSV">
        CSV
      </button>
      <button onclick={() => exportToExcel(filteredClients, [
        { key: 'nome', header: 'Nome Azienda' },
        { key: 'cognome', header: 'Referente' },
        { key: 'email', header: 'Indirizzo Email' },
        { key: 'phone', header: 'Telefono' },
        { key: 'status', header: 'Stato Funnel' }
      ], `${$projectStore?.projectName.toLowerCase().replace(/\s+/g, '_') || 'crm'}_clienti`)} class="export-btn" title="Esporta in Excel (XLS)">
        Excel
      </button>
      <button onclick={triggerPrint} class="export-btn" title="Stampa l'elenco / Salva PDF">
        Stampa / PDF
      </button>
    </div>
  {/snippet}

  <div class="table-wrapper">
    <Table

      {columns}
      data={filteredClients}
      cellSnippet={cell}
      emptyText="Nessun cliente registrato nel database vendite."
    />
  </div>
</Card>

<style>
  :global(.icon-accent) {
    color: var(--color-primary-500);
  }

  .export-btn {
    background: var(--color-white);
    color: var(--color-neutral-600);
    border: 1px solid var(--color-neutral-300);
    padding: 6px 12px;
    border-radius: var(--radius-sm);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .export-btn:hover {
    background: var(--color-neutral-100);
    color: var(--color-neutral-800);
  }

  .add-client-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: var(--color-primary-600);
    color: var(--color-white);
    border: none;
    padding: 0 16px;
    border-radius: var(--radius-sm);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
  }

  .add-client-btn:hover {
    background: var(--color-primary-700);
  }

  .name-cell {
    font-weight: 600;
    color: var(--color-neutral-800);
  }

  .mail-cell {
    color: var(--color-neutral-500);
  }

  .count-badge {
    background: var(--color-neutral-100);
    color: var(--color-neutral-600);
    font-size: 11px;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: 12px;
  }

  .count-badge.active {
    background: var(--color-primary-100);
    color: var(--color-primary-700);
  }

  .table-wrapper {
    width: 100%;
    overflow-x: auto;
  }

  .search-bar-row {
    display: flex;
    gap: 8px;
    margin-bottom: 16px;
    width: 100%;
  }

  .search-input {
    flex: 1;
    height: 38px;
    padding: 0 12px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--color-neutral-300);
    font-family: inherit;
    font-size: 13px;
    background: var(--color-white);
    color: var(--color-neutral-800);
    transition: border-color 0.2s;
  }

  .search-input:focus {
    outline: none;
    border-color: var(--color-primary-500);
  }

  .search-btn {
    background: var(--color-primary-500);
    color: var(--color-white);
    border: none;
    padding: 0 16px;
    border-radius: var(--radius-sm);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
  }

  .search-btn:hover {
    background: var(--color-primary-600);
  }

  .clear-search-btn {
    background: var(--color-white);
    color: var(--color-neutral-600);
    border: 1px solid var(--color-neutral-300);
    padding: 0 16px;
    border-radius: var(--radius-sm);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
  }

  .clear-search-btn:hover {
    background: var(--color-neutral-100);
    color: var(--color-neutral-800);
  }

  .row-actions {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 8px;
  }

  .quick-action-btn {
    background: var(--color-primary-500);
    color: var(--color-white);
    border: none;
    padding: 5px 11px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
    white-space: nowrap;
  }

  .quick-action-btn:hover, .quick-action-btn:focus {
    background: var(--color-primary-600);
    outline: none;
  }

  .action-link {
    text-decoration: none;
    display: inline-flex;
    align-items: center;
  }

  .outline-action {
    background: var(--color-white);
    color: var(--color-primary-600);
    border: 1px solid var(--color-primary-600);
  }

  .outline-action:hover, .outline-action:focus {
    background: var(--color-primary-50);
    color: var(--color-primary-700);
  }

  .header-actions-group {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    align-items: center;
  }

  .fixed-height-btn {
    height: 34px;
  }
</style>
