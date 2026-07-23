<script lang="ts">
  import { Card } from '$lib';
  import { Clock } from '@lucide/svelte';

  interface Props {
    allocationsList: any[];
  }

  let { allocationsList } = $props();
</script>

<div class="mt-24">
  <Card title="Dettaglio Distribuzione Incassi del Mese" description="Elenco di tutti i singoli incassi inclusi in questo calcolo salvato.">
    {#snippet icon()}
      <Clock size={20} class="icon-accent" />
    {/snippet}

    {#if allocationsList.length === 0}
      <div class="empty-txt empty-panel-padding center-text subdued-text">Nessuna transazione incassata in questo periodo.</div>
    {:else}
      <table class="widescreen-table">
        <thead>
          <tr>
            <th>ID Incasso</th>
            <th>Contratto Padre</th>
            <th>Cliente</th>
            <th>Importo Allocato</th>
            <th>Consulente Primario</th>
            <th>Split Co-selling</th>
          </tr>
        </thead>
        <tbody>
          {#each allocationsList as alloc}
            <tr>
              <td>
                <a href="/dashboard/payments/{alloc.paymentId}" class="link-btn-text text-sm">Vedi Incasso</a>
              </td>
              <td>
                <a href="/dashboard/contracts/{alloc.contractId}" class="link-btn-text text-sm">Vedi Contratto</a>
              </td>
              <td>{alloc.clientName}</td>
              <td><strong>€ {alloc.amount.toFixed(2)}</strong></td>
              <td>{alloc.primaryName || alloc.primaryEmail}</td>
              <td>
                {#if alloc.secondVendorName || alloc.secondVendorEmail}
                  <span class="co-seller-badge">{alloc.secondVendorName || alloc.secondVendorEmail} ({alloc.secondVendorShare}%)</span>
                {:else}
                  <span class="no-co-seller">Nessuno (100% primario)</span>
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </Card>
</div>

<style>
  :global(.icon-accent) {
    color: var(--color-primary-500);
  }

  .widescreen-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 8px;
  }

  .widescreen-table th {
    text-align: left;
    padding: 12px;
    font-size: 12px;
    text-transform: uppercase;
    color: var(--color-neutral-500);
    border-bottom: 1px solid var(--color-neutral-200);
    letter-spacing: 0.05em;
  }

  .widescreen-table td {
    padding: 14px 12px;
    border-bottom: 1px solid var(--color-neutral-100);
    font-size: 13px;
  }

  .link-btn-text {
    color: var(--color-primary-600);
    text-decoration: none;
    font-weight: 500;
  }

  .link-btn-text:hover {
    text-decoration: underline;
  }

  .co-seller-badge {
    background: hsla(270, 100%, 97%, 1);
    color: #7c3aed;
    font-size: 11px;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: var(--radius-xs);
  }

  .no-co-seller {
    color: var(--color-neutral-400);
    font-size: 11.5px;
  }

  .mt-24 {
    margin-top: 24px;
  }

  .empty-panel-padding {
    padding: 24px;
  }

  .center-text {
    text-align: center;
  }

  .subdued-text {
    color: var(--color-neutral-500);
  }

  .text-sm {
    font-size: 11px;
  }
</style>
