<script lang="ts">
  import { Card, Table, Button } from '$lib';


  interface Props {
    myAllocations: any[];
  }

  let { myAllocations } = $props();

  const columns = [
    { key: 'paymentId', header: 'ID Incasso' },
    { key: 'clientName', header: 'Cliente / Contratto' },
    { key: 'productName', header: 'Prodotto / Servizio' },
    { key: 'allocatedAmount', header: 'Quota Incassata' },
    { key: 'commission', header: 'Provvigione Maturata' },
    { key: 'actions', header: 'Azioni' }
  ];
</script>

<Card title="Dettaglio Incassi e Provvigioni" description="Elenco di tutti gli incassi che hanno generato una tua provvigione in questo periodo.">
  <div class="table-wrapper">
    {#snippet customCell(col: any, row: any)}
      {#if col.key === 'paymentId'}
        <span class="contract-id">{row.paymentId}</span>
      {:else if col.key === 'clientName'}
        <div class="client-info">
          <span class="client-name">{row.clientName}</span>
          <span class="contract-id">Contratto: {row.contractId}</span>
        </div>
      {:else if col.key === 'productName'}
        <span class="date-txt">{row.productName}</span>
      {:else if col.key === 'allocatedAmount'}
        <span class="money-txt">€ {row.allocatedAmount.toFixed(2)}</span>
      {:else if col.key === 'commission'}
        <span class="money-txt success">€ {row.commission.toFixed(2)}</span>
      {:else if col.key === 'actions'}
        <div class="actions-group">
          <Button size="sm" variant="secondary" href={`/dashboard/payments/${row.paymentId}`}>
             Incasso
          </Button>
          <Button size="sm" variant="secondary" href={`/dashboard/contracts/${row.contractId}`}>
             Contratto
          </Button>
        </div>
      {/if}
    {/snippet}

    <Table
      {columns}
      data={myAllocations}
      cellSnippet={customCell}
      emptyText="Nessuna provvigione maturata nel periodo selezionato."
    />
  </div>
</Card>

<style>
  .table-wrapper {
    margin-top: 16px;
  }
  .date-txt {
    font-size: 13px;
    color: var(--color-neutral-700);
  }
  .client-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .client-name {
    font-weight: 600;
    color: var(--color-neutral-900);
  }
  .contract-id {
    font-size: 11px;
    color: var(--color-neutral-500);
    font-family: monospace;
  }
  .money-txt {
    font-weight: 600;
    color: var(--color-neutral-800);
  }
  .money-txt.success {
    color: var(--color-success-500);
    font-size: 15px;
  }
  .actions-group {
    display: flex;
    gap: 8px;
  }
</style>
