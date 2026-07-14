<script lang="ts">
  import { Table, Card } from '$lib';
  import { Wallet } from '@lucide/svelte';
  import { goto } from '$app/navigation';
  import { activeRole } from '$lib/auth';
  import { exportToCSV, exportToExcel, triggerPrint } from '$lib/export-utils';
  import { projectStore } from '$lib/stores/project';

  interface Props {
    paymentsList: any[];
    selectedPeriod: { start: Date; end: Date } | null;
  }

  let { paymentsList, selectedPeriod } = $props();

  let filteredPayments = $derived.by(() => {
    let result = paymentsList;

    if (selectedPeriod) {
      result = result.filter((pay: any) => {
        const d = new Date(pay.date);
        return d >= selectedPeriod.start && d <= selectedPeriod.end;
      });
    }

    return result;
  });

  const columns = [
    { key: 'date', header: 'Data Incasso' },
    { key: 'clientName', header: 'Cliente' },
    { key: 'contractId', header: 'ID Contratto' },
    { key: 'amount', header: 'Importo Netto' },
    { key: 'recordedEmail', header: 'Registrato Da' },
    { key: 'actions', header: 'Azioni' }
  ];

  function handleSelectPayment(row: any) {
    goto(`/dashboard/payments/${row.id}`);
  }
</script>

{#snippet cell(col: any, row: any)}
  {#if col.key === 'date'}
    <span class="date-cell">{new Date(row.date).toLocaleString('it-IT')}</span>
  {:else if col.key === 'clientName'}
    <span class="name-cell">{row.clientName}</span>
  {:else if col.key === 'contractId'}
    <span class="contract-id-cell"><code>{row.contractId}</code></span>
  {:else if col.key === 'amount'}
    <span class="amount-cell">€ {row.amount.toFixed(2)}</span>
  {:else if col.key === 'recordedEmail'}
    <span class="recorded-cell">{row.recordedEmail}</span>
  {:else if col.key === 'actions'}
    <button onclick={(e) => { e.stopPropagation(); handleSelectPayment(row); }} class="back-link-btn" style="padding: 4px 8px; font-size: 11px;">
      Dettagli
    </button>
  {/if}
{/snippet}

<Card
  title="Registro Incassi Cassa"
  description="Visualizza lo storico dei pagamenti riscossi. I pagamenti approvano automaticamente i contratti pendenti."
  class="list-card"
>
  {#snippet icon()}
    <Wallet size={20} class="icon-accent" />
  {/snippet}

  {#snippet headerSnippet()}
    <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
      <button onclick={() => exportToCSV(filteredPayments, [
        { key: 'date', header: 'Data Incasso' },
        { key: 'clientName', header: 'Cliente' },
        { key: 'contractId', header: 'ID Contratto' },
        { key: 'amount', header: 'Importo Netto' },
        { key: 'recordedEmail', header: 'Registrato Da' }
      ], `${$projectStore?.projectName.toLowerCase().replace(/\s+/g, '_') || 'crm'}_incassi`)} class="back-link" style="padding: 6px 10px; font-size: 12px; height: 34px;" title="Esporta in formato CSV">
        CSV
      </button>
      <button onclick={() => exportToExcel(filteredPayments, [
        { key: 'date', header: 'Data Incasso' },
        { key: 'clientName', header: 'Cliente' },
        { key: 'contractId', header: 'ID Contratto' },
        { key: 'amount', header: 'Importo Netto' },
        { key: 'recordedEmail', header: 'Registrato Da' }
      ], `${$projectStore?.projectName.toLowerCase().replace(/\s+/g, '_') || 'crm'}_incassi`)} class="back-link" style="padding: 6px 10px; font-size: 12px; height: 34px;" title="Esporta in Excel (XLS)">
        Excel
      </button>
      <button onclick={triggerPrint} class="back-link" style="padding: 6px 10px; font-size: 12px; height: 34px;" title="Stampa l'elenco / Salva PDF">
        Stampa / PDF
      </button>
  </div>
  {/snippet}

  <div class="table-wrapper">
    <Table
      {columns}
      data={filteredPayments}
      cellSnippet={cell}
      onRowClick={handleSelectPayment}
      emptyText="Nessun incasso presente nel registro contabile."
    />
  </div>
</Card>

<style>
  :global(.icon-accent) {
    color: var(--color-primary-500);
  }

  .back-link {
    background: var(--color-white);
    border: 1px solid var(--color-neutral-300);
    color: var(--color-neutral-600);
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-family: inherit;
    font-weight: 600;
    transition: all 0.2s;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .back-link:hover {
    background: var(--color-neutral-100);
    color: var(--color-neutral-800);
  }

  .back-link-btn {
    background: var(--color-white);
    border: 1px solid var(--color-neutral-300);
    color: var(--color-neutral-600);
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-weight: 600;
    transition: all 0.2s;
  }

  .back-link-btn:hover {
    background: var(--color-neutral-100);
    color: var(--color-neutral-800);
  }

  .date-cell {
    font-size: 13px;
    color: var(--color-neutral-500);
  }

  .name-cell {
    font-weight: 600;
    color: var(--color-neutral-800);
  }

  .contract-id-cell code {
    background: var(--color-neutral-100);
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 12px;
    color: var(--color-neutral-600);
    font-family: monospace;
  }

  .amount-cell {
    font-weight: 700;
    color: var(--color-success-600);
    font-family: monospace;
    font-size: 14px;
  }

  .recorded-cell {
    font-size: 12px;
    color: var(--color-neutral-500);
  }

  .table-wrapper {
    width: 100%;
    overflow-x: auto;
  }
</style>
