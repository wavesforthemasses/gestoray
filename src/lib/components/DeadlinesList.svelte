<script lang="ts">
  import { Card, Button } from '$lib';
  import { AlertTriangle } from 'lucide-svelte';
  
  interface Installment {
    clientName: string;
    dueDate: string;
    expectedAmount: number;
    contractId: string;
  }

  interface Props {
    installments: Installment[];
    formatDate: (date: string) => string;
  }

  let { installments, formatDate }: Props = $props();
</script>

<Card title="Scadenziario Recupero Crediti" description="Registro delle rate insolute. Ricorda di sollecitare il cliente se lo stato è overdue.">
  {#snippet icon()}
    <AlertTriangle size={20} class="icon-error-accent deadline-icon" />
  {/snippet}

  {#if installments.length === 0}
    <div class="empty-panel">Nessuna rata o scadenza insoluta rilevata.</div>
  {:else}
    <div class="table-wrapper">
      <table class="widescreen-table admin-table">
        <thead>
          <tr>
            <th>Cliente</th>
            <th>Scadenza</th>
            <th>Importo</th>
            <th>Azioni</th>
          </tr>
        </thead>
        <tbody>
          {#each installments as inst}
            <tr class="overdue-row">
              <td>
                <strong>{inst.clientName}</strong>
                <span class="warning-badge-inline">SOLLECITARE CLIENTE!</span>
              </td>
              <td><span class="due-date-text">{formatDate(inst.dueDate)}</span></td>
              <td><strong>€ {inst.expectedAmount.toFixed(2)}</strong></td>
              <td>
                <Button href={`/dashboard/contracts/${inst.contractId}`} variant="secondary" size="sm">
                  Dettaglio
                </Button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</Card>

<style>
  .deadline-icon {
    color: var(--color-error);
  }

  .overdue-row {
    background-color: var(--color-error-light);
  }

  .warning-badge-inline {
    background: var(--color-error);
    color: white;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 10px;
    font-weight: 700;
    margin-left: 8px;
  }

  .due-date-text {
    font-weight: 600;
    color: var(--color-error-text);
  }
</style>
