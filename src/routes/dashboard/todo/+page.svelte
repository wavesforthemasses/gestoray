<script lang="ts">
  import { activeRole, auth } from '$lib/auth';
  import { db, doc, setDoc, updateDoc, collection, getDocs, getDoc, collectionGroup, query, where } from '$lib/firebase';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { Card, FormField } from '$lib';
  import { Calendar, Clock, AlertTriangle, CheckCircle, Check, Play, User, RefreshCw } from '@lucide/svelte';

  onMount(() => {
    const unsubscribe = activeRole.subscribe(($activeRole) => {
      if (!$activeRole) {
        goto('/login');
      }
    });

    fetchData();
    return () => unsubscribe();
  });

  // Database lists
  let clientsList = $state<any[]>([]);
  let contractsList = $state<any[]>([]);
  let installmentsList = $state<any[]>([]);
  let usersList = $state<any[]>([]);
  let loading = $state(true);

  // Installment Modal State
  let showInstallmentModal = $state(false);
  let selectedInstallmentId = $state('');
  let selectedContractId = $state('');
  let installmentActualAmount = $state<number | null>(null);
  let submitting = $state(false);
  let statusMessage = $state('');
  let isError = $state(false);

  async function fetchData() {
    loading = true;
    try {
      const [clientsSnapshot, contractsSnapshot, installmentsSnapshot, usersSnapshot] = await Promise.all([
        getDocs(collection(db, 'clients')),
        getDocs(collection(db, 'contracts')),
        getDocs(collectionGroup(db, 'installments')),
        getDocs(collection(db, 'users'))
      ]);

      // 1. Clients
      const clList: any[] = [];
      clientsSnapshot.forEach((doc: any) => {
        const d = doc.data();
        clList.push({ id: doc.id, ...d.original, derived: d.derived, edits: d.edits });
      });
      clientsList = clList;

      // 2. Contracts
      const coList: any[] = [];
      contractsSnapshot.forEach((doc: any) => {
        const d = doc.data();
        coList.push({ id: doc.id, ...d.original, derived: d.derived, edits: d.edits });
      });
      contractsList = coList;

      // 3. Installments
      const insts: any[] = [];
      installmentsSnapshot.forEach((doc: any) => {
        const d = doc.data();
        insts.push({ id: doc.id, ...d.original, edits: d.edits });
      });
      installmentsList = insts;

      // 4. Users
      const uList: any[] = [];
      usersSnapshot.forEach((doc: any) => {
        const d = doc.data()?.original || doc.data();
        uList.push({ uid: doc.id, ...d });
      });
      usersList = uList;

    } catch (e) {
      console.error('Error fetching todo data:', e);
    } finally {
      loading = false;
    }
  }

  // Derive Checklist items based on active role
  let todoItems = $derived.by(() => {
    const role = $activeRole;
    const myUid = $auth?.uid;
    const items: Array<{
      id: string;
      type: 'overdue_payment' | 'pending_approval' | 'prospect_followup' | 'quote_followup' | 'future_payment';
      urgency: 'high' | 'medium' | 'low';
      title: string;
      description: string;
      dueDate?: string;
      meta?: any;
    }> = [];

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    // 1. Pending approval contracts (Superadmin / Amministrazione / Direzione)
    contractsList.forEach(c => {
      const belongs = role !== 'commerciale' || c.vendorUid === myUid || c.secondVendorUid === myUid;
      if (!belongs) return;

      if (c.status === 'pending' && (role === 'superadmin' || role === 'amministrazione' || role === 'direzione')) {
        items.push({
          id: `approval_${c.id}`,
          type: 'pending_approval',
          urgency: 'high',
          title: `Validazione Contratto ${c.id}`,
          description: `Contratto in attesa per "${c.clientName}" - Valore Lordo €${(c.totalPrice || 0).toLocaleString('it-IT')}`,
          dueDate: c.edits?.createdAt || c.createdAt,
          meta: { contractId: c.id }
        });
      }
    });

    // 2. Overdue or future payments from installments subcollection
    installmentsList.forEach(inst => {
      const c = contractsList.find(x => x.id === inst.contractId);
      if (!c) return;

      const belongs = role !== 'commerciale' || c.vendorUid === myUid || c.secondVendorUid === myUid;
      if (!belongs) return;

      if (inst.status === 'paid') return;

      const isOverdue = inst.dueDate < todayStr;

      if (isOverdue) {
        items.push({
          id: `overdue_${inst.contractId}_${inst.id}`,
          type: 'overdue_payment',
          urgency: 'high',
          title: `Rata Scaduta - €${(inst.expectedAmount || 0).toLocaleString('it-IT')}`,
          description: `Rata insoluta per "${c.clientName}" (Contratto ${c.id}). Sollecitare telefonicamente o via PEC.`,
          dueDate: inst.dueDate,
          meta: { contractId: c.id, installmentId: inst.id, amount: inst.expectedAmount, clientName: c.clientName, clientId: c.clientId }
        });
      } else {
        items.push({
          id: `future_${inst.contractId}_${inst.id}`,
          type: 'future_payment',
          urgency: 'low',
          title: `Incasso Rata Previsto - €${(inst.expectedAmount || 0).toLocaleString('it-IT')}`,
          description: `Rata in scadenza per "${c.clientName}" (Contratto ${c.id}).`,
          dueDate: inst.dueDate,
          meta: { contractId: c.id, installmentId: inst.id, amount: inst.expectedAmount, clientName: c.clientName, clientId: c.clientId }
        });
      }
    });

    // 3. Prospects needing first contact (Commerciale)
    clientsList.forEach(cl => {
      const isOwner = role !== 'commerciale' || cl.createdBy === myUid;
      if (!isOwner) return;

      const hasComms = (cl.derived?.activitiesCount || 0) > 0;
      const isProspect = cl.status === 'prospect' || !hasComms;

      if (isProspect) {
        items.push({
          id: `prospect_${cl.id}`,
          type: 'prospect_followup',
          urgency: 'medium',
          title: `Primo Contatto Lead: ${cl.nome}`,
          description: `Lead registrato ma non ancora contattato. Effettua una telefonata conoscitiva.`,
          dueDate: cl.edits?.createdAt || cl.createdAt,
          meta: { clientId: cl.id }
        });
      }

      // 4. Quotes pending follow-up (proposal_sent and quote created)
      const hasQuotes = cl.status === 'proposal_sent';
      if (hasQuotes) {
        items.push({
          id: `quote_${cl.id}`,
          type: 'quote_followup',
          urgency: 'medium',
          title: `Follow-up Preventivo: ${cl.nome}`,
          description: `Proposta inviata al cliente. Ricontatta il referente per negoziare la firma del contratto.`,
          dueDate: cl.edits?.createdAt || cl.createdAt,
          meta: { clientId: cl.id }
        });
      }
    });

    // Sort by urgency, then by due date
    const urgencyWeight = { high: 3, medium: 2, low: 1 };
    return items.sort((a, b) => {
      const uDiff = urgencyWeight[b.urgency] - urgencyWeight[a.urgency];
      if (uDiff !== 0) return uDiff;
      if (a.dueDate && b.dueDate) {
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      }
      return 0;
    });
  });

  // Action: Postpone Installment
  async function handlePostponeInstallment(contractId: string, installmentId: string, currentDueDate: string, clientId: string, clientName: string) {
    const newDate = prompt("Inserisci la nuova data di scadenza (AAAA-MM-GG):", currentDueDate);
    if (!newDate) return;

    try {
      submitting = true;
      const now = new Date().toISOString();

      await updateDoc(doc(db, 'contracts', contractId, 'installments', installmentId), {
        'original.dueDate': newDate,
        'edits.modifiedAt': now,
        'edits.modifiedBy': $auth?.uid
      });

      const activityId = 'act_' + Math.random().toString(36).substring(2, 11);
      await setDoc(doc(db, 'clients', clientId, 'activities', activityId), {
        original: {
          clientId,
          clientName,
          type: 'Sollecito Telefonico',
          notes: `Posticipata scadenza pagamento al ${newDate}`,
          date: now,
          loggedBy: $auth?.uid,
          loggedEmail: $auth?.email,
          status: 'completata'
        },
        edits: {
          createdAt: now,
          createdBy: $auth?.uid
        }
      });

      statusMessage = "Scadenza posticipata con successo!";
      await fetchData();
    } catch (e: any) {
      console.error(e);
      alert("Errore durante il rinvio: " + e.message);
    } finally {
      submitting = false;
    }
  }

  // Action: Collect Installment
  async function handleCollectInstallment(contractId: string, installmentId: string, actualAmount: number) {
    if (!$auth) return;
    try {
      submitting = true;
      const now = new Date().toISOString();

      // 1. Fetch parent contract info
      const contractDoc = await getDoc(doc(db, 'contracts', contractId));
      if (!contractDoc.exists()) return;
      const cData = contractDoc.data();
      const clientId = cData.original.clientId;
      const clientName = cData.original.clientName;

      // 2. Update installment status in subcollection
      await updateDoc(doc(db, 'contracts', contractId, 'installments', installmentId), {
        'original.status': 'paid',
        'original.paidAmount': actualAmount,
        'original.paidAt': now,
        'edits.modifiedAt': now,
        'edits.modifiedBy': $auth.uid
      });

      // 3. Register payment at top-level
      const paymentId = 'pay_' + Math.random().toString(36).substring(2, 11);
      await setDoc(doc(db, 'payments', paymentId), {
        original: {
          clientId,
          clientName,
          contractId,
          amount: actualAmount,
          date: now,
          recordedBy: $auth.uid,
          recordedEmail: $auth.email
        },
        edits: {
          createdAt: now,
          createdBy: $auth.uid
        }
      });

      // 4. Register payment contractsPaid allocation
      await setDoc(doc(db, 'payments', paymentId, 'contractsPaid', contractId), {
        original: {
          contractId,
          paymentId,
          amount: actualAmount,
          clientId,
          clientName
        },
        edits: {
          createdAt: now,
          createdBy: $auth.uid
        }
      });

      // 5. Log activity under client
      const activityId = 'act_' + Math.random().toString(36).substring(2, 11);
      await setDoc(doc(db, 'clients', clientId, 'activities', activityId), {
        original: {
          clientId,
          clientName,
          type: 'Sollecito Telefonico',
          notes: `Riscossa rata / recupero credito di €${actualAmount.toFixed(2)}.`,
          date: now,
          loggedBy: $auth.uid,
          loggedEmail: $auth.email,
          status: 'completata'
        },
        edits: {
          createdAt: now,
          createdBy: $auth.uid
        }
      });

      // Recalculations are processed on backend cloud function triggers!

      statusMessage = "Rata incassata registrata correttamente!";
      showInstallmentModal = false;
      installmentActualAmount = null;
      await fetchData();
    } catch (e: any) {
      console.error(e);
      alert("Errore durante l'incasso: " + e.message);
    } finally {
      submitting = false;
    }
  }

  // Action: Approve Contract
  async function handleApproveContract(contractId: string) {
    if (!$auth) return;
    try {
      submitting = true;
      const now = new Date().toISOString();

      const contractDoc = await getDoc(doc(db, 'contracts', contractId));
      if (!contractDoc.exists()) return;
      const cData = contractDoc.data();
      const clientId = cData.original.clientId;
      const clientName = cData.original.clientName;

      // 1. Approve contract
      await updateDoc(doc(db, 'contracts', contractId), {
        'original.status': 'approved',
        'original.approvedAt': now,
        'original.approvedBy': $auth.uid,
        'original.approvedEmail': $auth.email,
        'edits.modifiedAt': now,
        'edits.modifiedBy': $auth.uid
      });

      // 2. Register top-level payment document
      const paymentId = 'pay_' + Math.random().toString(36).substring(2, 11);
      await setDoc(doc(db, 'payments', paymentId), {
        original: {
          clientId,
          clientName,
          amount: cData.original.totalPrice,
          date: now,
          recordedBy: $auth.uid,
          recordedEmail: $auth.email
        },
        edits: {
          createdAt: now,
          createdBy: $auth.uid
        }
      });

      // 3. Register contract allocation
      await setDoc(doc(db, 'payments', paymentId, 'contractsPaid', contractId), {
        original: {
          contractId,
          paymentId,
          amount: cData.original.totalPrice,
          clientId,
          clientName
        },
        edits: {
          createdAt: now,
          createdBy: $auth.uid
        }
      });

      // Side-effects are calculated by triggers!

      statusMessage = "Contratto validato e approvato con successo!";
      await fetchData();
    } catch (e: any) {
      console.error(e);
      alert("Errore durante l'approvazione: " + e.message);
    } finally {
      submitting = false;
    }
  }
</script>

<svelte:head>
  <title>Scadenziario To-Do | Gestoray</title>
</svelte:head>

<div class="todo-page animate-fade-in">
  {#if statusMessage}
    <div class="alert success animate-fade-in">{statusMessage}</div>
  {/if}

  <div class="todo-header-banner">
    <h2>Mio Scadenziario To-Do</h2>
    <p>Ecco l'elenco delle attività, dei solleciti di pagamento e delle approvazioni pronte per il ruolo di <strong>{$activeRole || ''}</strong>.</p>
    <button class="refresh-btn" onclick={fetchData} disabled={loading} title="Ricarica i dati">
      <RefreshCw size={14} class={loading ? 'spin-icon' : ''} /> Aggiorna Lista
    </button>
  </div>

  {#if loading}
    <div class="loader-box">
      <span class="spinner"></span>
      Generazione dello scadenziario...
    </div>
  {:else}
    <div class="todo-container">
      {#if todoItems.length === 0}
        <div class="empty-panel" style="padding: 40px;">
          <CheckCircle size={32} style="color: var(--color-success); margin-bottom: 12px;" />
          <h3>Tutto Svolto!</h3>
          <p>Non ci sono rate insolute, contratti da approvare o lead in attesa per il tuo ruolo.</p>
        </div>
      {:else}
        <div class="timeline-todo-stack">
          {#each todoItems as item}
            <div class="timeline-todo-item border-{item.urgency}" class:is-future={item.type === 'future_payment'}>
              <div class="todo-marker">
                {#if item.urgency === 'high'}
                  <span class="urg-badge high"><AlertTriangle size={12} /> Scaduto</span>
                {:else if item.urgency === 'medium'}
                  <span class="urg-badge medium"><Clock size={12} /> Da Fare</span>
                {:else}
                  <span class="urg-badge low"><Calendar size={12} /> Previsto</span>
                {/if}
              </div>

              <div class="todo-content">
                <div class="todo-title-row">
                  <h4>{item.title}</h4>
                  {#if item.dueDate}
                    <span class="due-date">Scadenza: {new Date(item.dueDate).toLocaleDateString('it-IT')}</span>
                  {/if}
                </div>
                <p>{item.description}</p>

                <div class="todo-actions-row">
                  {#if item.type === 'overdue_payment' || item.type === 'future_payment'}
                    {#if $activeRole === 'superadmin' || $activeRole === 'amministrazione'}
                      <button 
                        onclick={() => handlePostponeInstallment(item.meta.contractId, item.meta.installmentId, item.dueDate || '', item.meta.clientId, item.meta.clientName)} 
                        class="todo-action-btn secondary"
                      >
                        Rimanda / Posticipa
                      </button>
                      <button 
                        onclick={() => {
                          selectedContractId = item.meta.contractId;
                          selectedInstallmentId = item.meta.installmentId;
                          installmentActualAmount = item.meta.amount;
                          showInstallmentModal = true;
                        }} 
                        class="todo-action-btn primary"
                      >
                        <Check size={14} /> Registra Incasso
                      </button>
                    {:else}
                      <button 
                        onclick={() => goto(`/dashboard/clients/${item.meta.clientId}?tab=profile`)} 
                        class="todo-action-btn secondary"
                      >
                        Visualizza Anagrafica
                      </button>
                    {/if}
                  {:else if item.type === 'pending_approval'}
                    {#if $activeRole === 'superadmin' || $activeRole === 'amministrazione' || $activeRole === 'direzione'}
                      <button 
                        onclick={() => handleApproveContract(item.meta.contractId)} 
                        class="todo-action-btn primary"
                      >
                        <CheckCircle size={14} /> Approva e Valida Ora
                      </button>
                    {/if}
                    <button 
                      onclick={() => goto(`/dashboard/contracts/${item.meta.contractId}`)} 
                      class="todo-action-btn secondary"
                    >
                      Dettaglio Contratto
                    </button>
                  {:else if item.type === 'prospect_followup'}
                    <button 
                      onclick={() => goto(`/dashboard/clients/${item.meta.clientId}`)} 
                      class="todo-action-btn primary"
                    >
                      <Play size={12} /> Avvia Contratto / Log Attività
                    </button>
                  {:else if item.type === 'quote_followup'}
                    <button 
                      onclick={() => goto(`/dashboard/clients/${item.meta.clientId}`)} 
                      class="todo-action-btn primary"
                    >
                      <User size={12} /> Gestisci Preventivi
                    </button>
                  {/if}
                </div>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {/if}
</div>

{#if showInstallmentModal}
  <div class="installment-modal-overlay">
    <div class="installment-modal-box">
      <h3>Registra Incasso Rata</h3>
      <p>Digita l'importo effettivo al netto di IVA riscosso per questa scadenza.</p>
      
      <FormField id="todo-actual-amount" label="Importo Imponibile Incassato (€)">
        <div class="input-with-button">
          <input type="number" id="todo-actual-amount" bind:value={installmentActualAmount} min="0" step="0.01" required />
          <button type="button" class="back-link-btn" onclick={() => {
            if (installmentActualAmount) {
              installmentActualAmount = parseFloat((installmentActualAmount / 1.22).toFixed(2));
            }
          }}>
            Scorpora IVA (22%)
          </button>
        </div>
      </FormField>

      <div class="modal-buttons">
        <button type="button" class="back-link-btn" onclick={() => showInstallmentModal = false}>Annulla</button>
        <button type="button" class="approve-collect-btn" onclick={() => handleCollectInstallment(selectedContractId, selectedInstallmentId, installmentActualAmount || 0)}>
          Conferma Incasso Rata
        </button>
      </div>
    </div>
  </div>
    {/if}

<style>
  .todo-page {
    width: 100%;
  }

  .todo-header-banner {
    background: var(--color-white);
    padding: 20px;
    border-radius: var(--radius-md);
    border: 1px solid var(--color-neutral-200);
    margin-bottom: 24px;
    position: relative;
  }

  .todo-header-banner h2 {
    margin: 0 0 6px 0;
    font-size: 20px;
    font-weight: 700;
    color: var(--color-neutral-800);
  }

  .todo-header-banner p {
    margin: 0;
    font-size: 13px;
    color: var(--color-neutral-50);
  }

  .refresh-btn {
    position: absolute;
    right: 20px;
    top: 20px;
    background: var(--color-neutral-50);
    border: 1px solid var(--color-neutral-300);
    padding: 6px 12px;
    border-radius: var(--radius-sm);
    font-family: inherit;
    font-size: 11.5px;
    font-weight: 600;
    color: var(--color-neutral-600);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    transition: all 0.2s;
  }

  .refresh-btn:hover {
    background: var(--color-neutral-100);
    color: var(--color-neutral-800);
  }

  .spin-icon {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .todo-container {
    width: 100%;
  }

  .timeline-todo-stack {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .timeline-todo-item {
    background: var(--color-white);
    border: 1px solid var(--color-neutral-200);
    border-radius: var(--radius-md);
    padding: 16px 20px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    box-shadow: var(--shadow-sm);
    transition: transform 0.2s;
  }

  .timeline-todo-item:hover {
    transform: translateY(-2px);
  }

  .timeline-todo-item.border-high {
    border-left: 5px solid var(--color-error);
  }

  .timeline-todo-item.border-medium {
    border-left: 5px solid var(--color-warning);
  }

  .timeline-todo-item.border-low {
    border-left: 5px solid var(--color-primary-500);
  }

  .timeline-todo-item.is-future {
    opacity: 0.85;
  }

  .todo-marker {
    display: flex;
  }

  .urg-badge {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    padding: 3px 8px;
    border-radius: 4px;
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  .urg-badge.high {
    background: var(--color-error-light);
    color: var(--color-error-text);
  }

  .urg-badge.medium {
    background: var(--color-warning-light);
    color: var(--color-warning-text);
  }

  .urg-badge.low {
    background: #e0f2fe;
    color: #0369a1;
  }

  .todo-content {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .todo-title-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
  }

  .todo-title-row h4 {
    margin: 0;
    font-size: 15px;
    font-weight: 700;
    color: var(--color-neutral-800);
  }

  .due-date {
    font-size: 12px;
    font-weight: 600;
    color: var(--color-neutral-500);
  }

  .todo-content p {
    margin: 0;
    font-size: 13.5px;
    color: var(--color-neutral-600);
    line-height: 1.4;
  }

  .todo-actions-row {
    margin-top: 6px;
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
  }

  .todo-action-btn {
    padding: 6px 12px;
    font-family: inherit;
    font-size: 12px;
    font-weight: 600;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: all 0.2s;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .todo-action-btn.primary {
    background: var(--color-primary-500);
    color: var(--color-white);
    border: none;
    box-shadow: 0 2px 6px hsla(var(--brand-h), var(--brand-s), var(--brand-l), 0.15);
  }

  .todo-action-btn.primary:hover {
    opacity: 0.9;
  }

  .todo-action-btn.secondary {
    background: var(--color-white);
    border: 1px solid var(--color-neutral-300);
    color: var(--color-neutral-600);
  }

  .todo-action-btn.secondary:hover {
    background: var(--color-neutral-100);
    color: var(--color-neutral-800);
  }

  .installment-modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    animation: modalFade 0.2s ease-out;
  }

  @keyframes modalFade {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .installment-modal-box {
    background: var(--color-white);
    padding: 24px;
    border-radius: var(--radius-lg);
    width: 100%;
    max-width: 400px;
    box-shadow: var(--shadow-lg);
  }

  .installment-modal-box h3 {
    margin-top: 0;
    font-size: 16px;
    font-weight: 700;
    color: var(--color-neutral-800);
    margin-bottom: 12px;
  }

  .installment-modal-box p {
    font-size: 13px;
    color: var(--color-neutral-500);
    margin-bottom: 16px;
    line-height: 1.4;
  }

  .input-with-button {
    display: flex;
    gap: 8px;
    width: 100%;
  }

  .input-with-button input {
    flex: 1;
  }

  .modal-buttons {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    margin-top: 20px;
  }

  .approve-collect-btn {
    background: var(--color-primary-500);
    color: var(--color-white);
    border: none;
    padding: 8px 16px;
    border-radius: var(--radius-sm);
    font-family: inherit;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: opacity 0.2s;
  }

  .approve-collect-btn:hover {
    opacity: 0.9;
  }

  .back-link-btn {
    background: var(--color-white);
    border: 1px solid var(--color-neutral-300);
    color: var(--color-neutral-600);
    padding: 8px 14px;
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-family: inherit;
    font-size: 13px;
    font-weight: 600;
    transition: all 0.2s;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .back-link-btn:hover {
    background: var(--color-neutral-100);
    color: var(--color-neutral-800);
  }

  .loader-box {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 40px;
    color: var(--color-neutral-500);
    background: var(--color-white);
    border: 1px solid var(--color-neutral-200);
    border-radius: var(--radius-lg);
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
</style>
