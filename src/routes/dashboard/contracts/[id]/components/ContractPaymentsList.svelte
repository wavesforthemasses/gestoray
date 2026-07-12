<script lang="ts">
  import { Card } from '$lib';
  import { Wallet } from '@lucide/svelte';
  import { goto } from '$app/navigation';
  import { formatDate } from '$lib/utils/formatters';

  interface Props {
    paymentsList: any[];
  }

  let { paymentsList } = $props();
</script>

<Card title="Incassi e Riscossioni collegate" description="Dettaglio dei pagamenti effettivamente incassati e registrati a valere su questo contratto.">
  {#snippet icon()}
    <Wallet size={20} class="icon-accent" />
  {/snippet}

  {#if paymentsList.length === 0}
    <div class="empty-panel">
      Nessun pagamento registrato per questo contratto.
    </div>
  {:else}
    <div class="table-wrapper">
      <table class="widescreen-table">
        <thead>
          <tr>
            <th>Data Incasso</th>
            <th>ID Incasso</th>
            <th>Quota Ricevuta</th>
            <th>Azioni</th>
          </tr>
        </thead>
        <tbody>
          {#each paymentsList as pay}
            <tr>
              <td>
                <span style="font-weight: 600;">
                  {pay.edits?.createdAt ? formatDate(pay.edits.createdAt) : 'N/D'}
                </span>
              </td>
              <td><code>{pay.paymentId}</code></td>
              <td><strong>€ {pay.amount?.toFixed(2)}</strong></td>
              <td>
                <button 
                  onclick={() => goto(`/dashboard/payments/${pay.paymentId}`)} 
                  class="back-link-btn" 
                >
                  <Wallet size={12} /> Dettaglio Incasso
                </button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</Card>

<style>
  :global(.icon-accent) {
    color: var(--color-primary-500);
  }

  .empty-panel {
    padding: 20px; 
    text-align: center; 
    color: var(--color-neutral-400); 
    background: var(--color-neutral-50); 
    border-radius: var(--radius-md);
  }

  .table-wrapper {
    overflow-x: auto;
  }

  .widescreen-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
    text-align: left;
  }

  .widescreen-table th {
    background: var(--color-neutral-50);
    padding: 12px 16px;
    font-weight: 600;
    color: var(--color-neutral-600);
    border-bottom: 1px solid var(--color-neutral-200);
  }

  .widescreen-table td {
    padding: 14px 16px;
    border-bottom: 1px solid var(--color-neutral-200);
    color: var(--color-neutral-700);
  }

  .back-link-btn {
    background: var(--color-white);
    border: 1px solid var(--color-neutral-300);
    color: var(--color-neutral-600);
    padding: 4px 8px;
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-family: inherit;
    font-size: 11px;
    font-weight: 600;
    transition: all 0.2s;
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  .back-link-btn:hover {
    background: var(--color-neutral-100);
    color: var(--color-neutral-800);
  }
</style>
