<script lang="ts">
  import { page } from '$app/stores';
  import { auth, activeRole } from '$lib/auth';
  import { db, doc, getDoc, getDocs, deleteDoc, collection, updateDoc, deleteField } from '$lib/firebase';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { Card } from '$lib';
  import { 
    Wallet, ArrowLeft, ShieldAlert, CheckCircle, 
    Clock, Award, Trash2, User, DollarSign, FileText 
  } from '@lucide/svelte';

  const paymentId = $page.params.id as string;

  let loading = $state(true);
  let statusMessage = $state('');
  let isError = $state(false);
  let submitting = $state(false);

  // Payment data
  let payment = $state<any>(null);
  let allocationsList = $state<any[]>([]);

  async function fetchPaymentDetails() {
    loading = true;
    isError = false;
    statusMessage = '';
    try {
      // 1. Get payment document
      const payDoc = await getDoc(doc(db, 'payments', paymentId));
      if (!payDoc.exists()) {
        isError = true;
        statusMessage = "Impossibile trovare questo incasso nel database.";
        return;
      }
      payment = payDoc.data();

      // 2. Get all allocations (contractsPaid subcollection)
      const allocSnap = await getDocs(collection(db, 'payments', paymentId, 'contractsPaid'));
      const list: any[] = [];
      allocSnap.forEach((d: any) => {
        list.push({ id: d.id, ...d.data()?.original });
      });
      allocationsList = list;

    } catch (e: any) {
      console.error(e);
      isError = true;
      statusMessage = "Errore nel caricamento dell'incasso: " + e.message;
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    const unsubscribe = activeRole.subscribe(($activeRole) => {
      if ($activeRole && $activeRole !== 'superadmin' && $activeRole !== 'amministrazione' && $activeRole !== 'direzione') {
        goto('/dashboard');
      }
    });

    fetchPaymentDetails();
    return () => unsubscribe();
  });

  async function handleDeletePayment() {
    if (!confirm("Sei sicuro di voler eliminare definitivamente questo incasso? Tutte le quote distribuite sui contratti verranno stornate ed i saldi ricalcolati automaticamente.")) {
      return;
    }

    submitting = true;
    statusMessage = '';
    isError = false;

    try {
      // 1. Delete all allocations under the subcollection (this triggers the CF ricalcolando i contratti)
      for (const alloc of allocationsList) {
        if (alloc.installmentId) {
          try {
            const targetContractId = alloc.contractId || alloc.id;
            await updateDoc(doc(db, 'contracts', targetContractId, 'installments', alloc.installmentId), {
              'original.status': 'pending',
              'original.paidAmount': deleteField(),
              'original.paidAt': deleteField()
            });
          } catch (instErr) {
            console.error("Failed to reset installment in Svelte client: ", instErr);
          }
        }
        await deleteDoc(doc(db, 'payments', paymentId, 'contractsPaid', alloc.id));
      }

      // 2. Delete the payment document itself
      await deleteDoc(doc(db, 'payments', paymentId));

      statusMessage = 'Incasso eliminato correttamente! Reindirizzamento...';
      setTimeout(() => {
        goto('/dashboard/payments');
      }, 1500);

    } catch (err: any) {
      isError = true;
      statusMessage = err.message || "Errore durante l'eliminazione dell'incasso.";
      submitting = false;
    }
  }
</script>

<svelte:head>
  <title>Dettaglio Incasso | Gestoray</title>
</svelte:head>

<div class="payment-details-page animate-fade-in">
  <div class="page-top-actions">
    <button onclick={() => goto('/dashboard/payments')} class="back-link-btn">
      <ArrowLeft size={16} /> Torna al registro incassi
    </button>
    <h2 class="title-header">Gestione Incasso: <code>{paymentId}</code></h2>
  </div>

  {#if statusMessage}
    <div class="status-alert-box animate-fade-in" class:error={isError}>
      {statusMessage}
    </div>
  {/if}

  {#if loading}
    <div class="loading-box">
      <span class="spinner"></span>
      Caricamento dettagli incasso...
    </div>
  {:else if !isError && payment}
    
    <div class="vertical-layout-stack">

      <!-- Payment Summary Card -->
      <Card title="Scheda Riepilogativa dell'Incasso" description="Visualizza i dati contabili generali di questo incasso registrato.">
        {#snippet icon()}
          <Wallet size={20} class="icon-accent" />
        {/snippet}

        <div class="info-grid">
          <div class="info-row">
            <span class="info-label">Cliente Pagatore</span>
            <span class="info-val"><strong>{payment.original?.clientName}</strong></span>
          </div>

          <div class="info-row">
            <span class="info-label">Importo Totale Incassato</span>
            <span class="info-val" style="color: var(--color-success-text); font-weight: 700; font-size: 16px;">
              € {payment.original?.amount?.toFixed(2)}
            </span>
          </div>

          <div class="info-row">
            <span class="info-label">Data e Ora di Riscossione</span>
            <span class="info-val">{new Date(payment.original?.date).toLocaleString('it-IT')}</span>
          </div>

          <div class="info-row">
            <span class="info-label">Operatore che ha Registrato</span>
            <span class="info-val">{payment.original?.recordedEmail} (UID: <code>{payment.original?.recordedBy}</code>)</span>
          </div>

          <div class="info-row">
            <span class="info-label">Data Inserimento CRM</span>
            <span class="info-val">{payment.edits?.createdAt ? new Date(payment.edits.createdAt).toLocaleString('it-IT') : 'N/D'}</span>
          </div>

          <div class="info-row">
            <span class="info-label">Stato Distribuzione Fondi</span>
            <span class="info-val">
              Distribuito: € {(payment.derived?.distributedAmount || 0).toFixed(2)} 
              (Residuo libero: € {(payment.derived?.remainingToDistribute || 0).toFixed(2)})
            </span>
          </div>
        </div>
      </Card>

      <!-- Allocation details (contractsPaid list) -->
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
                  <th>ID Contratto</th>
                  <th>Importo Quota Allocata</th>
                  <th>ID Cliente</th>
                  <th>Azioni</th>
                </tr>
              </thead>
              <tbody>
                {#each allocationsList as alloc}
                  <tr>
                    <td><code>{alloc.contractId}</code></td>
                    <td><strong>€ {alloc.amount?.toFixed(2)}</strong></td>
                    <td><code>{alloc.clientId}</code></td>
                    <td>
                      <button onclick={() => goto(`/dashboard/contracts/${alloc.contractId}`)} class="back-link-btn" style="padding: 4px 8px; font-size: 11px; display: inline-flex; align-items: center; gap: 4px;">
                        <FileText size={12} /> Dettaglio Contratto
                      </button>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      </Card>

      <!-- Danger Delete Panel (Admin only) -->
      {#if $activeRole === 'superadmin' || $activeRole === 'amministrazione'}
        <Card title="Zona Pericolo: Storno / Eliminazione" description="L'eliminazione di questo incasso è irreversibile e comporterà lo storno dei relativi crediti dai contratti.">
          {#snippet icon()}
            <ShieldAlert size={20} style="color: var(--color-error);" />
          {/snippet}

          <div class="vertical-layout-stack" style="gap: 12px; align-items: flex-start;">
            <p style="font-size: 13px; color: var(--color-neutral-500); margin: 0;">
              Se questo incasso è stato inserito erroneamente, puoi stornarlo cliccando sul pulsante sottostante. 
              Tutti i contratti associati vedranno il proprio importo pagato ridursi e, se precedentemente approvati grazie a questo pagamento, torneranno in stato <strong>pending</strong>.
            </p>
            <button 
              onclick={handleDeletePayment} 
              class="approve-collect-btn" 
              style="background: var(--color-error); display: inline-flex; align-items: center; gap: 8px;"
              disabled={submitting}
            >
              <Trash2 size={16} /> Elimina ed Storna questo Incasso
            </button>
          </div>
        </Card>
      {/if}

    </div>
  {/if}
</div>

<style>
  .payment-details-page {
    max-width: 900px;
    margin: 0 auto;
    padding: 24px;
    box-sizing: border-box;
  }

  .page-top-actions {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 24px;
  }

  .title-header {
    font-size: 24px;
    font-weight: 700;
    color: var(--color-neutral-800);
    margin: 0;
  }

  .title-header code {
    font-size: 18px;
    font-weight: 500;
    color: var(--color-primary-600);
    background: var(--color-primary-50);
    padding: 2px 8px;
    border-radius: var(--radius-sm);
  }

  .back-link-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: none;
    border: none;
    color: var(--color-neutral-500);
    font-family: inherit;
    font-size: 13.5px;
    font-weight: 600;
    cursor: pointer;
    padding: 0;
    width: fit-content;
    transition: color 0.15s ease;
  }

  .back-link-btn:hover {
    color: var(--color-primary-500);
  }

  .status-alert-box {
    background: var(--color-success-light);
    border: 1px solid var(--color-success-border);
    color: var(--color-success-text);
    padding: 12px 16px;
    border-radius: var(--radius-md);
    margin-bottom: 24px;
    font-size: 13.5px;
    font-weight: 500;
  }

  .status-alert-box.error {
    background: var(--color-error-light);
    border: 1px solid var(--color-error-border);
    color: var(--color-error-text);
  }

  .loading-box {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 48px 0;
    color: var(--color-neutral-500);
    font-size: 14.5px;
  }

  .spinner {
    width: 20px;
    height: 20px;
    border: 2px solid hsla(var(--brand-h), var(--brand-s), var(--brand-l), 0.15);
    border-radius: 50%;
    border-top-color: var(--color-primary-500);
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .vertical-layout-stack {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .info-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 16px;
  }

  @media (min-width: 600px) {
    .info-grid {
      grid-template-columns: 1fr 1fr;
    }
  }

  .info-row {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--color-neutral-100);
  }

  .info-label {
    font-size: 12.5px;
    font-weight: 600;
    color: var(--color-neutral-400);
    text-transform: uppercase;
    letter-spacing: 0.02em;
  }

  .info-val {
    font-size: 14.5px;
    color: var(--color-neutral-800);
  }

  .empty-panel {
    padding: 24px;
    text-align: center;
    color: var(--color-neutral-400);
    background: var(--color-neutral-50);
    border-radius: var(--radius-md);
    font-size: 13.5px;
  }

  .table-wrapper {
    overflow-x: auto;
    border: 1px solid var(--color-neutral-200);
    border-radius: var(--radius-md);
  }

  .widescreen-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13.5px;
    text-align: left;
    background: var(--color-white);
  }

  .widescreen-table th {
    background: var(--color-neutral-50);
    color: var(--color-neutral-500);
    font-weight: 600;
    padding: 12px 16px;
    border-bottom: 1px solid var(--color-neutral-200);
  }

  .widescreen-table td {
    padding: 12px 16px;
    border-bottom: 1px solid var(--color-neutral-150);
    color: var(--color-neutral-700);
  }

  .widescreen-table tr:last-child td {
    border-bottom: none;
  }

  .widescreen-table code {
    font-size: 12px;
    color: var(--color-primary-600);
    background: var(--color-primary-50);
    padding: 2px 6px;
    border-radius: var(--radius-xs);
  }

  .approve-collect-btn {
    background: linear-gradient(135deg, var(--color-primary-500), var(--color-primary-600));
    color: var(--color-white);
    border: none;
    border-radius: var(--radius-sm);
    padding: 10px 20px;
    font-family: inherit;
    font-size: 13.5px;
    font-weight: 600;
    cursor: pointer;
    transition: opacity 0.15s ease;
    box-shadow: 0 4px 12px hsla(var(--brand-h), var(--brand-s), var(--brand-l), 0.2);
  }

  .approve-collect-btn:hover:not(:disabled) {
    opacity: 0.9;
  }

  .approve-collect-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    box-shadow: none;
  }

  .animate-fade-in {
    animation: fadeIn 0.3s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  }
</style>
