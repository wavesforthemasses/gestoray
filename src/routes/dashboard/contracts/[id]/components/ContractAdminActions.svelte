<script lang="ts">
  import { Card, Button } from '$lib';
  import { CheckCircle, Calendar, DollarSign, Trash2, Clock } from '@lucide/svelte';

  interface Props {
    contract: any;
    activeRole: string;
    submitting: boolean;
    onApproveOnly: () => void;
    onApproveAndPlan: () => void;
    onApproveAndCollect: () => void;
    onDeleteContract: () => void;
    onReopenContract: () => void;
  }

  let {
    contract,
    activeRole,
    submitting,
    onApproveOnly,
    onApproveAndPlan,
    onApproveAndCollect,
    onDeleteContract,
    onReopenContract
  } = $props();
</script>

{#if (activeRole === 'superadmin' || activeRole === 'amministrazione' || activeRole === 'direzione')}
  <Card title="Azioni Amministrative di Controllo" description="Gestione dell'approvazione del contratto e della registrazione del saldo.">
    {#snippet icon()}
      <CheckCircle size={20} class="icon-accent" />
    {/snippet}

    <div class="admin-actions-pane">
      {#if contract.original?.status === 'pending'}
        <div class="pane-instruction">
          <p>Questo contratto è <strong>in attesa di validazione</strong>. Scegli come procedere con l'approvazione:</p>
        </div>
        <div style="display: flex; gap: 12px; flex-wrap: wrap; margin-top: 12px; justify-content: space-between; align-items: center; width: 100%;">
          <div style="display: flex; gap: 12px; flex-wrap: wrap;">
            <Button 
              onclick={onApproveOnly} 
              variant="primary"
              disabled={submitting}
            >
              <CheckCircle size={16} /> Solo Approva
            </Button>
            <Button 
              onclick={onApproveAndPlan} 
              style="background: var(--color-primary-600);"
              disabled={submitting}
            >
              <Calendar size={16} /> Approva e Pianifica Rate
            </Button>
            <Button 
              onclick={onApproveAndCollect} 
              variant="success"
              disabled={submitting}
            >
              <DollarSign size={16} /> Approva e Incassa Saldo Completo
            </Button>
          </div>
          {#if (activeRole === 'superadmin' || activeRole === 'amministrazione')}
            <Button 
              onclick={onDeleteContract} 
              variant="danger"
              disabled={submitting}
            >
              <Trash2 size={16} /> Elimina Contratto
            </Button>
          {/if}
        </div>
      {:else}
        <div style="display: flex; flex-direction: column; gap: 16px; width: 100%;">
          <div class="pane-success-msg" style="margin: 0; width: 100%;">
            <CheckCircle size={24} class="success-icon" />
            <div>
              <h4>Contratto Approvato</h4>
              <p>La transazione è stata validata con successo ed è attiva. Lo stato degli incassi e del rientro crediti è riportato in basso.</p>
            </div>
          </div>
          {#if (activeRole === 'superadmin' || activeRole === 'amministrazione')}
            <div style="display: flex; gap: 12px; flex-wrap: wrap; margin-top: 4px; width: 100%; border-top: 1px solid var(--color-neutral-200); padding-top: 16px;">
              <Button 
                onclick={onReopenContract} 
                variant="secondary"
                disabled={submitting}
              >
                <Clock size={16} /> Ripristina Stato di Attesa (Riapri)
              </Button>
              <Button 
                onclick={onDeleteContract} 
                variant="danger"
                disabled={submitting}
              >
                <Trash2 size={16} /> Elimina Contratto Definitivamente
              </Button>
            </div>
          {/if}
        </div>
      {/if}
    </div>
  </Card>
{/if}

<style>
  :global(.icon-accent) {
    color: var(--color-primary-500);
  }

  .admin-actions-pane {
    padding: 8px 0;
  }

  .pane-instruction {
    font-size: 13.5px;
    color: var(--color-neutral-600);
    margin-bottom: 20px;
    line-height: 1.5;
  }

  .pane-instruction strong {
    color: var(--color-neutral-800);
  }

  .pane-success-msg {
    display: flex;
    gap: 16px;
    align-items: flex-start;
  }

  :global(.success-icon) {
    color: var(--color-success);
    flex-shrink: 0;
    margin-top: 2px;
  }

  .pane-success-msg h4 {
    margin: 0;
    font-size: 15px;
    font-weight: 700;
    color: var(--color-neutral-800);
  }

  .pane-success-msg p {
    margin: 4px 0 0 0;
    font-size: 13px;
    color: var(--color-neutral-500);
  }
</style>
