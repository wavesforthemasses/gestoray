<script lang="ts">
  import { Card } from '$lib';
  import { Wallet, CheckCircle } from '@lucide/svelte';
  import { formatDateTime } from '$lib/utils/formatters';

  interface Props {
    payment: any;
    totalDistributedOnProducts: number;
    recordedUserName: string;
  }

  let { payment, totalDistributedOnProducts, recordedUserName } = $props();
</script>

<Card title="Scheda Riepilogativa dell'Incasso" description="Visualizza i dati contabili generali di questo incasso registrato.">
  {#snippet icon()}
    <Wallet size={20} class="icon-accent" />
  {/snippet}

  <div class="grid-cols-2">
    <div class="info-item">
      <span class="info-lbl">Cliente Pagatore</span>
      <span class="info-val">{payment.original?.clientName}</span>
    </div>

    <div class="info-item">
      <span class="info-lbl">Importo Totale Incassato</span>
      <span class="info-val text-success">€ {payment.original?.amount?.toFixed(2)}</span>
    </div>

    <div class="info-item">
      <span class="info-lbl">Data e Ora di Riscossione</span>
      <span class="info-val">{formatDateTime(payment.original?.date)}</span>
    </div>

    <div class="info-item">
      <span class="info-lbl">Operatore</span>
      <span class="info-val">{recordedUserName}</span>
    </div>

    <div class="info-item">
      <span class="info-lbl">Data Inserimento CRM</span>
      <span class="info-val">{payment.edits?.createdAt ? formatDateTime(payment.edits.createdAt) : 'N/D'}</span>
    </div>

    <div class="info-item">
      <span class="info-lbl">Stato Distribuzione (su Contratti)</span>
      <span class="info-val">
        Distribuito: € {(payment.derived?.distributedAmount || 0).toFixed(2)} 
        <span class="info-sub">(Residuo: € {(payment.derived?.remainingToDistribute || 0).toFixed(2)})</span>
      </span>
    </div>

    <div class="info-item full-width mt-8">
      <span class="info-lbl">Stato Distribuzione (sui Servizi)</span>
      <span class="info-val mt-8">
        {#if payment.original?.amount - totalDistributedOnProducts > 0}
          <span class="distribution-warning">
            Mancano € {(payment.original?.amount - totalDistributedOnProducts).toFixed(2)} da allocare
          </span>
        {:else}
          <span class="distribution-success">
            <CheckCircle size={14} /> Completamente distribuito
          </span>
        {/if}
      </span>
    </div>
  </div>
</Card>

<style>
  :global(.icon-accent) {
    color: var(--color-primary-500);
  }

  .grid-cols-2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
  }
  @media (max-width: 500px) {
    .grid-cols-2 { grid-template-columns: 1fr; }
  }

  .info-item {
    display: flex;
    flex-direction: column;
  }

  .info-lbl {
    font-size: 11px;
    font-weight: 600;
    color: var(--color-neutral-400);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .info-val {
    font-size: 14.5px;
    font-weight: 700;
    color: var(--color-neutral-800);
    margin-top: 2px;
  }

  .info-sub {
    font-size: 11px;
    color: var(--color-neutral-500);
    font-weight: 400;
  }

  .text-success {
    color: var(--color-success-text);
  }

  .distribution-warning {
    color: var(--color-warning-dark);
    font-weight: 600;
    font-size: 13px;
    background: var(--color-warning-light);
    padding: 6px 10px;
    border-radius: 4px;
    border: 1px solid var(--color-warning-border);
  }

  .distribution-success {
    color: var(--color-success-text);
    font-weight: 600;
    font-size: 13px;
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  .full-width {
    grid-column: 1 / -1;
  }

  .mt-8 {
    margin-top: 8px;
  }
</style>
