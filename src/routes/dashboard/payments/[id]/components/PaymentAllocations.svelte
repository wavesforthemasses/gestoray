<script lang="ts">
  import { Card } from '$lib';
  import { DollarSign, FileText } from '@lucide/svelte';

  interface Props {
    allocationsList: any[];
    onOpenDistributionModal: (alloc: any) => void;
  }

  let { allocationsList, onOpenDistributionModal } = $props();
</script>

<Card title="Contratti Saldati / Quote Allocate" description="Questo incasso copre o riduce l'importo dei seguenti contratti commerciali.">
  {#snippet icon()}
    <DollarSign size={20} class="icon-accent" />
  {/snippet}

  {#if allocationsList.length === 0}
    <div class="empty-panel">Nessuna quota di questo incasso è stata allocata su contratti commerciali.</div>
  {:else}
    <div class="table-wrapper">
      <table class="widescreen-table">
        <thead>
          <tr>
            <th>Contratto Assegnato</th>
            <th>Importo Quota Allocata</th>
            <th>Azioni</th>
          </tr>
        </thead>
        <tbody>
          {#each allocationsList as alloc}
            <tr>
              <td><span class="contract-id-text">Contratto #{alloc.contractId.slice(-6).toUpperCase()}</span></td>
              <td><strong>€ {alloc.amount?.toFixed(2)}</strong></td>
              <td>
                <div class="actions-cell">
                  <a href={`/dashboard/contracts/${alloc.contractId}`} class="back-link-btn outline-btn action-link">
                    <FileText size={12} /> Vedi Contratto
                  </a>
                  <button onclick={() => onOpenDistributionModal(alloc)} class="back-link-btn primary-outline-btn">
                    Distribuisci sui Servizi
                  </button>
                </div>
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

  .actions-cell {
    display: flex;
    gap: 8px;
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

  .outline-btn:hover {
    background: var(--color-neutral-100);
    color: var(--color-neutral-800);
  }

  .primary-outline-btn {
    color: var(--color-primary-600);
    border-color: var(--color-primary-600);
  }

  .primary-outline-btn:hover {
    background: var(--color-primary-50);
  }

  .contract-id-text {
    font-weight: 600;
    color: var(--color-neutral-800);
  }

  .action-link {
    text-decoration: none;
  }
</style>
