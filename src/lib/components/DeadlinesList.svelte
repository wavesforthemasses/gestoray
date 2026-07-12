<script lang="ts">
  import { Card } from '$lib';
  import { AlertTriangle } from 'lucide-svelte';
  import { goto } from '$app/navigation';
  
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
    <AlertTriangle size={20} class="icon-error-accent" style="color: var(--color-error);" />
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
            <tr style="background-color: var(--color-error-light);">
              <td>
                <strong>{inst.clientName}</strong>
                <span class="warning-badge-inline" style="background: var(--color-error); color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 700; margin-left: 8px;">SOLLECITARE CLIENTE!</span>
              </td>
              <td><span style="font-weight: 600; color: var(--color-error-text);">{formatDate(inst.dueDate)}</span></td>
              <td><strong>€ {inst.expectedAmount.toFixed(2)}</strong></td>
              <td>
                <button onclick={() => goto(`/dashboard/contracts/${inst.contractId}`)} class="back-link-btn" style="padding: 4px 10px; font-size: 11px;">
                  Dettaglio
                </button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</Card>
