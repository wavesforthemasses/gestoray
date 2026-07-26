<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { ContractsService } from '../contracts.service';
  import type { ContractItem, ContractInstallment, ContractStatus } from '../schema';
  import { CustomFieldsService } from '$lib/services/customFieldsService';
  import type { CustomFieldDefinition } from '$lib/types/customFields';
  import CustomFieldsRenderer from '$lib/components/CustomFieldsRenderer.svelte';
  import { toast } from '$lib/stores/toast.svelte';

  let contractId = $derived(page.params.id);
  let contract = $state<ContractItem | null>(null);
  let installments = $state<ContractInstallment[]>([]);
  let customFieldsList = $state<CustomFieldDefinition[]>([]);
  let loading = $state(true);

  // New Installment Form
  let showInstallmentModal = $state(false);
  let instDueDate = $state(new Date().toISOString().slice(0, 10));
  let instAmount = $state<number>(100);
  let instNotes = $state('');
  let savingInst = $state(false);

  onMount(async () => {
    try {
      customFieldsList = await CustomFieldsService.getFieldsForModule('contracts');
      if (contractId) {
        contract = await ContractsService.getContractById(contractId);
        if (contract) {
          installments = await ContractsService.getInstallments(contractId);
        }
      }
    } catch (e) {
      console.error('Errore caricamento dettaglio contratto:', e);
    } finally {
      loading = false;
    }
  });

  async function handleAddInstallment(e: SubmitEvent) {
    e.preventDefault();
    if (!contractId || instAmount <= 0) return;

    savingInst = true;
    try {
      const nextNum = installments.length + 1;
      await ContractsService.addInstallment(contractId, {
        installmentNumber: nextNum,
        dueDate: instDueDate,
        amount: instAmount,
        status: 'in_attesa',
        notes: instNotes.trim()
      });
      installments = await ContractsService.getInstallments(contractId);
      showInstallmentModal = false;
      instNotes = '';
      toast.success('Rata dello scadenzario aggiunta con successo');
    } catch (err: any) {
      toast.error('Errore aggiunta rata: ' + err.message);
    } finally {
      savingInst = false;
    }
  }

  function getStatusBadge(status: ContractStatus) {
    switch (status) {
      case 'attivo': return { label: '🟢 Attivo', class: 'badge-success' };
      case 'in_scadenza': return { label: '⚠️ In Scadenza', class: 'badge-warning' };
      case 'scaduto': return { label: '🔴 Scaduto', class: 'badge-danger' };
      case 'sospeso': return { label: '⏸️ Sospeso', class: 'badge-neutral' };
      default: return { label: status, class: 'badge-neutral' };
    }
  }

  function printContract() {
    window.print();
  }
</script>

<svelte:head>
  <title>{contract ? contract.title : 'Dettaglio Contratto'} | Gestoray</title>
</svelte:head>

<div class="contract-detail-page animate-fade-in">
  <a href="/dashboard/contracts" class="back-link">← Torna alla Gestione Contratti</a>

  {#if loading}
    <div class="loader-box">
      <span class="spinner"></span>
      Caricamento contratto...
    </div>
  {:else if !contract}
    <div class="alert error-box">⚠️ Contratto non trovato o eliminato.</div>
  {:else}
    {@const badge = getStatusBadge(contract.status)}

    <!-- HEADER MAIN -->
    <header class="detail-header card">
      <div>
        <div class="header-tag">Contratto N° {contract.contractNumber}</div>
        <h1 class="page-title">{contract.title}</h1>
        <p class="page-subtitle">👤 Cliente Intestatario: <strong>{contract.clientName}</strong></p>
      </div>

      <div class="header-actions">
        <button type="button" class="btn btn-secondary" onclick={printContract}>🖨️ Stampa</button>
        <a href="/dashboard/contracts/{contractId}/edit" class="btn btn-secondary">✏️ Modifica Contratto</a>
      </div>
    </header>

    <!-- GRID INFO -->
    <div class="info-grid">
      <!-- SUMMARY CARD -->
      <div class="card info-card">
        <h3 class="card-title">ℹ️ Informazioni Generali</h3>
        
        <div class="info-row">
          <span class="info-label">Stato Contratto</span>
          <span class="badge {badge.class}">{badge.label}</span>
        </div>

        <div class="info-row">
          <span class="info-label">Tipologia</span>
          <span class="info-val">{contract.type}</span>
        </div>

        <div class="info-row">
          <span class="info-label">Frequenza Fatturazione</span>
          <span class="info-val capitalize">{contract.billingFrequency}</span>
        </div>

        <div class="info-row">
          <span class="info-label">Valore Totale Contratto</span>
          <span class="info-val font-bold">€ {(contract.totalAmount || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}</span>
        </div>

        <div class="info-row">
          <span class="info-label">Data Decorrenza</span>
          <span class="info-val">{contract.startDate}</span>
        </div>

        <div class="info-row">
          <span class="info-label">Data Scadenza</span>
          <span class="info-val">{contract.endDate}</span>
        </div>

        {#if contract.notes}
          <div class="notes-box">
            <strong>Note Riservate:</strong>
            <p>{contract.notes}</p>
          </div>
        {/if}
      </div>

      <!-- INSTALLMENTS CARD -->
      <div class="card info-card">
        <div class="card-header-flex">
          <h3 class="card-title">💶 Scadenzario & Rateizzazioni ({installments.length})</h3>
          <button type="button" class="btn-small-primary" onclick={() => showInstallmentModal = true}>+ Aggiungi Rata</button>
        </div>

        {#if installments.length === 0}
          <div class="empty-subtext">Nessuna rata ancora registrata nello scadenzario di questo contratto.</div>
        {:else}
          <div class="installments-list">
            {#each installments as inst}
              <div class="installment-item">
                <div class="inst-info">
                  <span class="inst-num">Rata #{inst.installmentNumber}</span>
                  <span class="inst-date">Scadenza: {inst.dueDate}</span>
                </div>
                <div class="inst-amount">
                  € {inst.amount.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>

    <!-- CUSTOM FIELDS -->
    {#if customFieldsList.length > 0 && contract.customFields}
      <div class="card form-card">
        <h3 class="card-title">🧩 Campi Personalizzati</h3>
        <CustomFieldsRenderer fields={customFieldsList} values={contract.customFields} readonly={true} />
      </div>
    {/if}

    <!-- MODALE NUOVA RATA -->
    {#if showInstallmentModal}
      <div class="modal-backdrop" onclick={() => showInstallmentModal = false} role="presentation">
        <div class="modal-card" onclick={(e) => e.stopPropagation()} role="presentation">
          <div class="modal-header">
            <h3>+ Nuova Rata Scadenzario</h3>
            <button type="button" class="btn-close" onclick={() => showInstallmentModal = false}>✕</button>
          </div>

          <form onsubmit={handleAddInstallment} class="modal-body">
            <div class="form-group">
              <label for="inst-date">Data Scadenza Rata *</label>
              <input id="inst-date" type="date" bind:value={instDueDate} required class="form-control" />
            </div>

            <div class="form-group">
              <label for="inst-amt">Importo Rata (€) *</label>
              <input id="inst-amt" type="number" step="0.01" bind:value={instAmount} required class="form-control" />
            </div>

            <div class="form-group">
              <label for="inst-notes">Note Rata (Opzionale)</label>
              <input id="inst-notes" type="text" bind:value={instNotes} placeholder="es. Rata 1/4 acconto iniziale" class="form-control" />
            </div>

            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" onclick={() => showInstallmentModal = false}>Annulla</button>
              <button type="submit" class="btn btn-primary" disabled={savingInst}>
                {savingInst ? 'Salvataggio...' : 'Aggiungi Rata'}
              </button>
            </div>
          </form>
        </div>
      </div>
    {/if}
  {/if}
</div>

<style>
  .contract-detail-page {
    width: 100%;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .back-link {
    color: var(--color-neutral-600);
    text-decoration: none;
    font-size: 0.85rem;
    font-weight: 600;
  }

  .detail-header {
    background: var(--color-white);
    border: 1px solid var(--color-neutral-200);
    border-radius: var(--radius-lg);
    padding: 1.5rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    box-shadow: var(--shadow-sm);
  }

  .header-tag {
    font-family: monospace;
    font-size: 0.85rem;
    color: var(--color-primary-600);
    font-weight: 700;
  }

  .page-title {
    font-size: 1.5rem;
    font-weight: 800;
    margin: 0.2rem 0;
    color: var(--color-neutral-900);
  }

  .page-subtitle {
    font-size: 0.9rem;
    color: var(--color-neutral-600);
    margin: 0;
  }

  .header-actions {
    display: flex;
    gap: 0.8rem;
  }

  .info-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.5rem;
  }

  .card {
    background: var(--color-white);
    border: 1px solid var(--color-neutral-200);
    border-radius: var(--radius-lg);
    padding: 1.5rem;
    box-shadow: var(--shadow-sm);
  }

  .card-title {
    font-size: 1.1rem;
    font-weight: 700;
    margin: 0 0 1rem 0;
    color: var(--color-neutral-800);
  }

  .card-header-flex {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .info-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.6rem 0;
    border-bottom: 1px solid var(--color-neutral-100);
    font-size: 0.9rem;
  }

  .info-label {
    color: var(--color-neutral-500);
    font-weight: 600;
  }

  .info-val {
    font-weight: 600;
    color: var(--color-neutral-900);
  }

  .notes-box {
    margin-top: 1rem;
    background: var(--color-neutral-50);
    padding: 0.8rem;
    border-radius: var(--radius-md);
    font-size: 0.85rem;
  }

  .installments-list {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }

  .installment-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.6rem 0.8rem;
    border: 1px solid var(--color-neutral-200);
    border-radius: var(--radius-md);
    background: var(--color-neutral-50);
  }

  .inst-num { font-weight: 700; font-size: 0.85rem; color: var(--color-neutral-800); display: block; }
  .inst-date { font-size: 0.78rem; color: var(--color-neutral-500); }
  .inst-amount { font-weight: 800; font-size: 0.95rem; color: var(--color-primary-700); }

  .badge { font-size: 0.78rem; padding: 0.2rem 0.6rem; border-radius: 12px; font-weight: 600; }
  .badge-success { background: #dcfce7; color: #15803d; }
  .badge-warning { background: #fef3c7; color: #b45309; }
  .badge-danger { background: #fee2e2; color: #b91c1c; }
  .badge-neutral { background: #f1f5f9; color: #475569; }

  .btn { padding: 0.6rem 1.2rem; border-radius: var(--radius-md); font-weight: 600; cursor: pointer; border: none; text-decoration: none; font-size: 0.88rem; }
  .btn-primary { background: var(--color-primary-600); color: white; }
  .btn-secondary { background: var(--color-neutral-100); color: var(--color-neutral-700); border: 1px solid var(--color-neutral-300); }
  .btn-small-primary { background: var(--color-primary-600); color: white; border: none; padding: 0.4rem 0.8rem; border-radius: var(--radius-md); font-size: 0.8rem; font-weight: 600; cursor: pointer; }

  .modal-backdrop { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.4); display: flex; align-items: center; justify-content: center; z-index: 9999; }
  .modal-card { background: white; border-radius: var(--radius-lg); width: 100%; max-width: 450px; padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem; }
  .modal-header { display: flex; justify-content: space-between; align-items: center; }
  .btn-close { background: none; border: none; font-size: 1.2rem; cursor: pointer; }
  .modal-body { display: flex; flex-direction: column; gap: 1rem; }
  .modal-footer { display: flex; justify-content: flex-end; gap: 0.8rem; margin-top: 1rem; }
  .form-control { padding: 8px 12px; font-size: 13px; border: 1px solid var(--color-neutral-300); border-radius: var(--radius-md); outline: none; width: 100%; box-sizing: border-box; }
  .loader-box { padding: 40px; text-align: center; color: var(--color-neutral-500); }
  .font-bold { font-weight: 700; }
  .capitalize { text-transform: capitalize; }
  .empty-subtext { font-size: 0.85rem; color: var(--color-neutral-400); font-style: italic; }
</style>
