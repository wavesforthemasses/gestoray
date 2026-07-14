<script lang="ts">
  import { Card, Button, FormField, StatusBadge } from '$lib';
  import { confirmStore } from '$lib/stores/confirm.svelte';
  import { DollarSign, CheckCircle } from 'lucide-svelte';

  interface Props {
    installmentsList: any[];
    contract: any;
    activeRole: string | null;
    formatDate: (d: any) => string;
    selectedInstallmentId: string | null;
    installmentActualAmount: number | null;
    productAllocations: any[];
    showInstallmentModal: boolean;
    installmentDueDate: string;
    installmentExpectedAmount: number | null;
    handlePostponeInstallment: (id: string, newDate: string) => void;
    handleDeleteInstallment: (id: string) => void;
    handleAddInstallment: (e: any) => void;
  }

  let {
    installmentsList,
    contract,
    activeRole,
    formatDate,
    selectedInstallmentId = $bindable(),
    installmentActualAmount = $bindable(),
    productAllocations = $bindable(),
    showInstallmentModal = $bindable(),
    installmentDueDate = $bindable(),
    installmentExpectedAmount = $bindable(),
    handlePostponeInstallment,
    handleDeleteInstallment,
    handleAddInstallment
  }: Props = $props();
</script>

<div id="scadenziario-pagamenti">
  <Card title="Piano di Rientro / Scadenziario Pagamenti" description="Verifica lo stato dei pagamenti dovuti o pianifica un piano rateizzato per la riscossione del credito di questo contratto.">
    {#snippet icon()}
      <DollarSign size={20} class="icon-accent" />
    {/snippet}

    <div class="vertical-layout-stack" style="gap: 16px;">
      {#if installmentsList.length === 0}
        <div class="empty-panel">Nessuna rata o piano di rientro pianificato per questo contratto.</div>
      {:else}
        <div class="table-wrapper">
          <table class="widescreen-table">
            <thead>
              <tr>
                <th>Data Scadenza</th>
                <th>Importo Dovuto</th>
                <th>Stato</th>
                <th>Incassato</th>
                <th>Data Incasso</th>
                {#if activeRole === 'superadmin' || activeRole === 'amministrazione'}
                  <th>Azioni</th>
                {/if}
              </tr>
            </thead>
            <tbody>
              {#each installmentsList as inst}
                {@const isOverdue = inst.status === 'pending' && new Date(inst.dueDate) < new Date()}
                <tr class:is-overdue={isOverdue}>
                  <td>
                    <span class="due-date-text" class:overdue-text={isOverdue}>
                      {formatDate(inst.dueDate)}
                    </span>
                    {#if isOverdue}
                      <span class="overdue-warning">
                        SOLLECITARE CLIENTE!
                      </span>
                    {/if}
                  </td>
                  <td><strong>€ {inst.expectedAmount.toFixed(2)}</strong></td>
                  <td>
                    <StatusBadge status={inst.status} />
                  </td>
                  <td>{inst.paidAmount ? `€ ${inst.paidAmount.toFixed(2)}` : 'N/D'}</td>
                  <td>{inst.paidAt ? formatDate(inst.paidAt) : 'N/D'}</td>
                  {#if activeRole === 'superadmin' || activeRole === 'amministrazione'}
                    <td>
                      {#if inst.status === 'pending'}
                        <div class="action-buttons-group">
                          <button 
                            onclick={async () => {
                              const newDate = await confirmStore.askInput("Inserisci la nuova data di scadenza (AAAA-MM-GG):", inst.dueDate);
                              if (newDate) handlePostponeInstallment(inst.id, newDate);
                            }}
                            class="back-link-btn action-btn" 
                          >
                            Posticipa
                          </button>
                          <button 
                            onclick={() => {
                              selectedInstallmentId = inst.id;
                              installmentActualAmount = inst.expectedAmount;
                              productAllocations = contract.original?.products?.map((p: any) => ({ productId: p.productId, amount: 0 })) || [];
                              showInstallmentModal = true;
                            }}
                            class="approve-collect-btn action-btn action-btn-wide" 
                          >
                            Segna Incassato
                          </button>
                          <button 
                            onclick={() => handleDeleteInstallment(inst.id)}
                            class="back-link-btn action-btn danger-btn" 
                          >
                            Elimina
                          </button>
                        </div>
                      {:else}
                        <span class="success-status-label">
                          <CheckCircle size={12} /> Riscossione Completata
                        </span>
                      {/if}
                    </td>
                  {/if}
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}

      <!-- Form to add new installment (Admin only) -->
      {#if activeRole === 'superadmin' || activeRole === 'amministrazione'}
        <div class="add-installment-panel">
          <h4 class="panel-title">Pianifica Nuova Scadenza Pagamento</h4>
          <form onsubmit={handleAddInstallment} class="add-installment-form">
            <FormField id="inst-due" label="Data Scadenza">
              <input type="date" id="inst-due" bind:value={installmentDueDate} required />
            </FormField>
            <FormField id="inst-amount" label="Importo Dovuto (€)">
              <input type="number" id="inst-amount" bind:value={installmentExpectedAmount} min="1" step="0.01" required placeholder="es. 500" />
            </FormField>
            <Button type="submit" variant="success" class="submit-plan-btn">
              Pianifica Scadenza
            </Button>
          </form>
        </div>
      {/if}
    </div>
  </Card>
</div>

<style>
  .empty-panel {
    padding: 20px;
    text-align: center;
    color: var(--color-neutral-400);
    background: var(--color-neutral-50);
    border-radius: var(--radius-md);
  }

  .is-overdue {
    background-color: hsla(0, 100%, 98%, 1);
    border-left: 4px solid var(--color-error);
  }

  .due-date-text {
    font-weight: 600;
    color: var(--color-neutral-800);
  }

  .overdue-text {
    color: var(--color-error-text);
  }

  .overdue-warning {
    display: block;
    font-size: 10px;
    font-weight: 700;
    color: var(--color-error-text);
    margin-top: 2px;
  }

  .action-buttons-group {
    display: flex;
    gap: 8px;
  }

  .action-btn {
    padding: 4px 8px;
    font-size: 11px;
  }

  .action-btn-wide {
    padding: 4px 12px;
  }

  .danger-btn {
    color: var(--color-error);
  }

  .success-status-label {
    color: var(--color-success-text);
    font-weight: 600;
    font-size: 12px;
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  .add-installment-panel {
    margin-top: 10px;
    padding-top: 16px;
    border-top: 1px solid var(--color-neutral-200);
  }

  .panel-title {
    font-size: 13.5px;
    font-weight: 700;
    color: var(--color-neutral-800);
    margin-bottom: 8px;
  }

  .add-installment-form {
    display: flex;
    gap: 16px;
    align-items: flex-end;
    flex-wrap: wrap;
  }

  :global(.submit-plan-btn) {
    height: 46px;
    padding: 0 16px;
  }
</style>
