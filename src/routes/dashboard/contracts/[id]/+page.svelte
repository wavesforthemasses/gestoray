<script lang="ts">
  import { page } from '$app/stores';
  import { auth, activeRole } from '$lib/auth';
  import { db, doc, getDoc, setDoc, collection, getDocs } from '$lib/firebase';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { Card, FormField } from '$lib';
  import { 
    FileText, ArrowLeft, ShieldAlert, CheckCircle, 
    Clock, Award, AlertTriangle, User, DollarSign 
  } from '@lucide/svelte';

  const contractId = $page.params.id as string;

  let loading = $state(true);
  let statusMessage = $state('');
  let isError = $state(false);
  let submitting = $state(false);

  // Contract details
  let contract = $state<any>(null);
  let vendorQual = $state('junior');
  let commissionAmount = $state(0);

  // Columns for products list table
  const columns = [
    { key: 'name', header: 'Nome Prodotto' },
    { key: 'listPrice', header: 'Listino' },
    { key: 'minPrice', header: 'Soglia Minima' },
    { key: 'priceSold', header: 'Prezzo Venduto' },
    { key: 'quantity', header: 'Quantità' },
    { key: 'subtotal', header: 'Totale' },
    { key: 'margin', header: 'Scostamento Listino' }
  ];

  async function fetchContractData() {
    loading = true;
    try {
      const contractDoc = await getDoc(doc(db, 'contracts', contractId));
      if (!contractDoc.exists()) {
        isError = true;
        statusMessage = 'Impossibile trovare il contratto specificato.';
        loading = false;
        return;
      }
      contract = { id: contractId, ...contractDoc.data() };

      // Load Vendor details to get qualification
      if (contract.vendorUid) {
        const vendorDoc = await getDoc(doc(db, 'users', contract.vendorUid));
        if (vendorDoc.exists()) {
          vendorQual = vendorDoc.data().qualification || 'junior';
        }
      }

      // Calculate commission
      calculateCommission();
    } catch (e: any) {
      console.error(e);
      isError = true;
      statusMessage = 'Errore nel caricamento del contratto: ' + e.message;
    } finally {
      loading = false;
    }
  }

  function calculateCommission() {
    if (!contract || !contract.products) return;
    
    let totalComm = 0;
    contract.products.forEach((item: any) => {
      const list = item.listPrice;
      const min = item.minPrice;
      const sold = item.priceSold;
      const qty = item.quantity;
      const itemTotal = sold * qty;

      let ratio = 1;
      if (list > min) {
        ratio = (sold - min) / (list - min);
        if (ratio < 0) ratio = 0;
        if (ratio > 1) ratio = 1;
      }

      let commPct = 0;
      if (vendorQual === 'senior') {
        commPct = 5.0 + (ratio * 5.0);
      } else {
        commPct = 2.5 + (ratio * 5.0);
      }

      totalComm += itemTotal * (commPct / 100);
    });

    commissionAmount = totalComm;
  }

  onMount(() => {
    const unsubscribe = activeRole.subscribe(($activeRole) => {
      if ($activeRole && $activeRole !== 'superadmin' && $activeRole !== 'amministrazione' && $activeRole !== 'commerciale' && $activeRole !== 'direzione') {
        goto('/dashboard');
      }
    });

    fetchContractData();
    return () => unsubscribe();
  });

  // Action: Approve & Incassa
  async function handleApproveAndCollect() {
    if (!contract || !$auth) return;
    submitting = true;
    statusMessage = '';
    isError = false;

    try {
      const updatedContract = {
        ...contract,
        status: 'approved',
        approvedAt: new Date().toISOString(),
        approvedBy: $auth.uid,
        approvedEmail: $auth.email
      };

      // 1. Update contract in db
      await setDoc(doc(db, 'contracts', contractId), updatedContract);

      // 2. Register payment in payments collection
      const paymentId = 'pay_' + Math.random().toString(36).substring(2, 11);
      const newPayment = {
        clientId: contract.clientId,
        clientName: contract.clientName,
        contractId: contractId,
        amount: contract.totalPrice,
        date: new Date().toISOString(),
        recordedBy: $auth.uid,
        recordedEmail: $auth.email
      };

      await setDoc(doc(db, 'payments', paymentId), newPayment);

      statusMessage = 'Contratto approvato ed incasso registrato correttamente!';
      await fetchContractData();
    } catch (err: any) {
      isError = true;
      statusMessage = err.message || 'Errore durante l\'approvazione del contratto.';
    } finally {
      submitting = false;
    }
  }

  // Installment details state
  let installmentDueDate = $state(new Date().toISOString().split('T')[0]);
  let installmentExpectedAmount = $state<number | null>(null);
  let installmentActualAmount = $state<number | null>(null);
  let showInstallmentModal = $state(false);
  let selectedInstallmentId = $state('');

  // Add installment
  async function handleAddInstallment(e: Event) {
    e.preventDefault();
    if (!contract || !installmentExpectedAmount || !$auth) return;
    submitting = true;
    try {
      const newInst = {
        id: 'inst_' + Math.random().toString(36).substring(2, 11),
        dueDate: installmentDueDate,
        expectedAmount: Number(installmentExpectedAmount),
        status: 'pending'
      };

      const currentInsts = contract.installments || [];
      const updatedContract = {
        ...contract,
        installments: [...currentInsts, newInst]
      };

      await setDoc(doc(db, 'contracts', contractId), updatedContract);
      
      const activityId = 'act_' + Math.random().toString(36).substring(2, 11);
      await setDoc(doc(db, 'activities', activityId), {
        clientId: contract.clientId,
        clientName: contract.clientName,
        type: 'Sollecito Email',
        notes: `Pianificata scadenza di recupero credito per €${installmentExpectedAmount.toFixed(2)} in data ${installmentDueDate}`,
        date: new Date().toISOString(),
        loggedBy: $auth.uid,
        loggedEmail: $auth.email,
        status: 'completata'
      });

      statusMessage = 'Nuova scadenza di pagamento inserita con successo!';
      installmentExpectedAmount = null;
      await fetchContractData();
    } catch (err: any) {
      isError = true;
      statusMessage = err.message || 'Errore durante l\'inserimento della scadenza.';
    } finally {
      submitting = false;
    }
  }

  // Postpone due date
  async function handlePostponeInstallment(id: string, newDate: string) {
    if (!contract || !$auth) return;
    submitting = true;
    try {
      const currentInsts = contract.installments || [];
      const updated = currentInsts.map((inst: any) => {
        if (inst.id === id) {
          return { ...inst, dueDate: newDate };
        }
        return inst;
      });

      const updatedContract = {
        ...contract,
        installments: updated
      };

      await setDoc(doc(db, 'contracts', contractId), updatedContract);
      
      const activityId = 'act_' + Math.random().toString(36).substring(2, 11);
      await setDoc(doc(db, 'activities', activityId), {
        clientId: contract.clientId,
        clientName: contract.clientName,
        type: 'Sollecito Telefonico',
        notes: `Posticipata scadenza pagamento al ${newDate}`,
        date: new Date().toISOString(),
        loggedBy: $auth.uid,
        loggedEmail: $auth.email,
        status: 'completata'
      });

      statusMessage = 'Scadenza di pagamento posticipata con successo!';
      await fetchContractData();
    } catch (err: any) {
      isError = true;
      statusMessage = err.message || 'Errore durante lo slittamento.';
    } finally {
      submitting = false;
    }
  }

  // Collect installment
  async function handleCollectInstallment(id: string, actualAmount: number) {
    if (!contract || !$auth) return;
    submitting = true;
    try {
      const currentInsts = contract.installments || [];
      let instObj: any = null;
      const updated = currentInsts.map((inst: any) => {
        if (inst.id === id) {
          instObj = inst;
          return { 
            ...inst, 
            status: 'paid',
            paidAmount: actualAmount,
            paidAt: new Date().toISOString()
          };
        }
        return inst;
      });

      const allPaid = updated.every((x: any) => x.status === 'paid');
      const totalPaid = updated.reduce((sum: number, x: any) => sum + (x.paidAmount || 0), 0);

      const updatedContract = {
        ...contract,
        status: allPaid || totalPaid >= contract.totalPrice ? 'approved' : contract.status,
        installments: updated
      };

      await setDoc(doc(db, 'contracts', contractId), updatedContract);

      const paymentId = 'pay_' + Math.random().toString(36).substring(2, 11);
      const newPayment = {
        clientId: contract.clientId,
        clientName: contract.clientName,
        contractId: contractId,
        amount: actualAmount,
        date: new Date().toISOString(),
        recordedBy: $auth.uid,
        recordedEmail: $auth.email
      };

      await setDoc(doc(db, 'payments', paymentId), newPayment);

      const activityId = 'act_' + Math.random().toString(36).substring(2, 11);
      await setDoc(doc(db, 'activities', activityId), {
        clientId: contract.clientId,
        clientName: contract.clientName,
        type: 'Sollecito Telefonico',
        notes: `Riscossa rata / recupero credito di €${actualAmount.toFixed(2)}.`,
        date: new Date().toISOString(),
        loggedBy: $auth.uid,
        loggedEmail: $auth.email,
        status: 'completata'
      });

      statusMessage = `Rata registrata come incassata per €${actualAmount.toFixed(2)}!`;
      showInstallmentModal = false;
      installmentActualAmount = null;
      await fetchContractData();
    } catch (err: any) {
      isError = true;
      statusMessage = err.message || 'Errore durante la registrazione dell\'incasso rata.';
    } finally {
      submitting = false;
    }
  }
</script>

<svelte:head>
  <title>Dettaglio Contratto | Gestoray</title>
</svelte:head>

<div class="contract-details-page animate-fade-in">
  <div class="page-top-actions">
    <button onclick={() => goto('/dashboard/contracts')} class="back-link-btn">
      <ArrowLeft size={16} /> Torna all'elenco contratti
    </button>
    <h2 class="title-header">Gestione Contratto: <code>{contractId}</code></h2>
  </div>

  {#if statusMessage}
    <div class="status-alert-box animate-fade-in" class:error={isError}>
      {statusMessage}
    </div>
  {/if}

  {#if loading}
    <div class="loading-box">
      <span class="spinner"></span>
      Caricamento dettagli contratto...
    </div>
  {:else if !isError && contract}
    
    <!-- Dati di Riepilogo in Widescreen -->
    <div class="vertical-layout-stack">

      <!-- WARNING BOX: VISIBLE TO ANYONE WHO ACCESSES THE CONTRACT -->
      {#if contract.hasWarning || contract.products.some((p: any) => p.priceSold < p.minPrice)}
        <div class="pricing-warning-banner animate-fade-in">
          <div class="warning-icon-wrapper">
            <AlertTriangle size={32} />
          </div>
          <div class="warning-body">
            <h3>ATTENZIONE: Prezzi di Vendita Inferiori alla Soglia Minima</h3>
            <p>
              Questo contratto contiene uno o più articoli venduti a una quotazione inferiore alla <strong>soglia minima consentita</strong> dal listino prodotti aziendale. 
              Si prega di verificare la redditività dell'operazione. Le provvigioni del commerciale sono state ridotte al minimo garantito per questi articoli.
            </p>
            <ul class="under-min-products-list">
              {#each contract.products.filter((p: any) => p.priceSold < p.minPrice) as item}
                <li>
                  <strong>{item.name}</strong>: Venduto a €{item.priceSold.toFixed(2)} (Minimo consentito: €{item.minPrice.toFixed(2)})
                  &mdash; Scostamento: <span class="negative-gap">-€{(item.minPrice - item.priceSold).toFixed(2)}</span>
                </li>
              {/each}
            </ul>
          </div>
        </div>
      {/if}

      <!-- Contract Info Cards -->
      <div class="contract-summary-row">
        <!-- Client & Vendor Card -->
        <Card title="Informazioni Contratto" description="Dettaglio delle parti interessate e dello stato d'ordine.">
          {#snippet icon()}
            <User size={20} class="icon-accent" />
          {/snippet}

          <div class="info-grid">
            <div class="info-item">
              <span class="info-lbl">Cliente</span>
              <span class="info-val">{contract.clientName}</span>
              <span class="info-sub">{contract.clientEmail}</span>
            </div>

            <div class="info-item">
              <span class="info-lbl">Consulente Commerciale</span>
              <span class="info-val">{contract.vendorEmail}</span>
              <span class="info-sub">Livello: <strong style="text-transform: uppercase;">{vendorQual}</strong></span>
            </div>

            <div class="info-item">
              <span class="info-lbl">Data Creazione</span>
              <span class="info-val">{new Date(contract.createdAt).toLocaleString('it-IT')}</span>
            </div>

            <div class="info-item">
              <span class="info-lbl">Stato Approvazione</span>
              <div style="margin-top: 4px;">
                <span class="badge" class:status-approved={contract.status === 'approved'} class:status-pending={contract.status !== 'approved'}>
                  {contract.status === 'approved' ? 'Approvato ed Incassato' : 'In attesa di approvazione'}
                </span>
              </div>
              {#if contract.approvedAt}
                <span class="info-sub" style="margin-top: 4px; display: block;">Approvato il {new Date(contract.approvedAt).toLocaleString('it-IT')} da {contract.approvedEmail}</span>
              {/if}
            </div>
          </div>
        </Card>

        <!-- Totals Card -->
        <Card title="Valori e Provvigioni" description="Importo totale del contratto e calcolo provvigionale stimato.">
          {#snippet icon()}
            <DollarSign size={20} class="icon-accent" />
          {/snippet}

          <div class="totals-dashboard">
            <div class="total-metric">
              <span class="metric-lbl">Importo Lordo Contratto</span>
              <span class="metric-val text-primary">€ {contract.totalPrice.toFixed(2)}</span>
            </div>

            <div class="total-metric">
              <span class="metric-lbl">Provvigione Commerciale ({vendorQual.toUpperCase()})</span>
              <span class="metric-val text-success">€ {commissionAmount.toFixed(2)}</span>
              <span class="metric-sub">Calcolata con interpolazione lineare basata sullo sconto applicato.</span>
            </div>

            {#if contract.secondVendorUid}
              <div class="co-selling-split-display" style="margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--color-neutral-200); width: 100%;">
                <h4 style="font-size: 13px; font-weight: 600; color: var(--color-neutral-800); margin-bottom: 8px;">Ripartizione Vendita / Co-Selling</h4>
                <table class="split-table" style="width: 100%; font-size: 12px; border-collapse: collapse;">
                  <thead>
                    <tr style="text-align: left; border-bottom: 1px solid var(--color-neutral-200);">
                      <th style="padding: 4px 0; color: var(--color-neutral-500);">Consulente</th>
                      <th style="padding: 4px 0; text-align: right; color: var(--color-neutral-500);">Quota %</th>
                      <th style="padding: 4px 0; text-align: right; color: var(--color-neutral-500);">Provvigione</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style="border-bottom: 1px solid var(--color-neutral-100);">
                      <td style="padding: 6px 0; font-weight: 500;">{contract.vendorEmail} (Principale)</td>
                      <td style="padding: 6px 0; text-align: right;">{100 - contract.secondVendorShare}%</td>
                      <td style="padding: 6px 0; text-align: right; font-weight: 700; color: var(--color-neutral-800);">€ {(commissionAmount * (100 - contract.secondVendorShare) / 100).toFixed(2)}</td>
                    </tr>
                    <tr>
                      <td style="padding: 6px 0; font-weight: 500;">{contract.secondVendorEmail} (Co-selling)</td>
                      <td style="padding: 6px 0; text-align: right;">{contract.secondVendorShare}%</td>
                      <td style="padding: 6px 0; text-align: right; font-weight: 700; color: var(--color-neutral-800);">€ {(commissionAmount * contract.secondVendorShare / 100).toFixed(2)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            {/if}
          </div>
        </Card>
      </div>

      <!-- Products Table Widescreen -->
      <Card title="Articoli e Servizi Inclusi" description="Dettaglio analitico delle licenze e dei prodotti inseriti in sede di quotazione.">
        {#snippet icon()}
          <FileText size={20} class="icon-accent" />
        {/snippet}

        <div class="table-wrapper">
          <table class="widescreen-table">
            <thead>
              <tr>
                {#each columns as col}
                  <th>{col.header}</th>
                {/each}
              </tr>
            </thead>
            <tbody>
              {#each contract.products as p}
                {@const isBelowMin = p.priceSold < p.minPrice}
                {@const gap = p.priceSold - p.listPrice}
                <tr class:row-warning={isBelowMin}>
                  <td>
                    <div class="prod-cell">
                      <span class="prod-name">{p.name}</span>
                      {#if isBelowMin}
                        <span class="warning-badge-inline"><ShieldAlert size={10} /> Prezzo Sotto Soglia</span>
                      {/if}
                    </div>
                  </td>
                  <td>€ {p.listPrice.toFixed(2)}</td>
                  <td>€ {p.minPrice.toFixed(2)}</td>
                  <td>
                    <strong class:text-warning={isBelowMin}>
                      € {p.priceSold.toFixed(2)}
                    </strong>
                  </td>
                  <td>{p.quantity}</td>
                  <td><strong>€ {(p.priceSold * p.quantity).toFixed(2)}</strong></td>
                  <td>
                    {#if gap === 0}
                      <span class="gap-neutral">Listino Pieno</span>
                    {:else if gap > 0}
                      <span class="gap-positive">+€ {gap.toFixed(2)}</span>
                    {:else}
                      <span class="gap-negative" class:heavy-discount={isBelowMin}>
                        -€ {Math.abs(gap).toFixed(2)} ({((Math.abs(gap) / p.listPrice) * 100).toFixed(0)}% sconto)
                      </span>
                    {/if}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </Card>

      <!-- Admin Actions Card -->
      {#if ($activeRole === 'superadmin' || $activeRole === 'amministrazione' || $activeRole === 'direzione')}
        <Card title="Azioni Amministrative di Controllo" description="Gestione dell'approvazione del contratto e della registrazione del saldo.">
          {#snippet icon()}
            <CheckCircle size={20} class="icon-accent" />
          {/snippet}

          <div class="admin-actions-pane">
            {#if contract.status === 'pending'}
              <div class="pane-instruction">
                <p>Questo contratto è <strong>in attesa di validazione</strong>. Cliccando sul pulsante sottostante, approverai ufficialmente la transazione e registrerai automaticamente il pagamento corrispondente (pari al 100% dell'importo lordo del contratto).</p>
              </div>
              <button 
                onclick={handleApproveAndCollect} 
                class="approve-collect-btn"
                disabled={submitting}
              >
                <CheckCircle size={16} /> Approva e Incassa Contratto
              </button>
            {:else}
              <div class="pane-success-msg">
                <CheckCircle size={24} class="success-icon" />
                <div>
                  <h4>Contratto Già Approvato ed Incassato</h4>
                  <p>La transazione è stata chiusa con successo. Il relativo pagamento è stato registrato nell'archivio incassi.</p>
                </div>
              </div>
            {/if}
          </div>
        </Card>
      {/if}

      <!-- PIANO RECUPERO CREDITI / SCADENZE PAGAMENTI CARD -->
      <Card title="Piano di Rientro / Scadenziario Pagamenti" description="Verifica lo stato dei pagamenti dovuti o pianifica un piano rateizzato per la riscossione del credito di questo contratto.">
        {#snippet icon()}
          <DollarSign size={20} class="icon-accent" />
        {/snippet}

        <div class="vertical-layout-stack" style="gap: 16px;">
          {#if !contract.installments || contract.installments.length === 0}
            <div class="empty-panel" style="padding: 20px; text-align: center; color: var(--color-neutral-400); background: var(--color-neutral-50); border-radius: var(--radius-md);">Nessuna rata o piano di rientro pianificato per questo contratto.</div>
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
                    {#if $activeRole === 'superadmin' || $activeRole === 'amministrazione'}
                      <th>Azioni</th>
                    {/if}
                  </tr>
                </thead>
                <tbody>
                  {#each contract.installments as inst}
                    {@const isOverdue = inst.status === 'pending' && new Date(inst.dueDate) < new Date()}
                    <tr style={isOverdue ? 'background-color: hsla(0, 100%, 98%, 1); border-left: 4px solid var(--color-error);' : ''}>
                      <td>
                        <span style="font-weight: 600; color: {isOverdue ? 'var(--color-error-text)' : 'var(--color-neutral-800)'};">
                          {new Date(inst.dueDate).toLocaleDateString('it-IT')}
                        </span>
                        {#if isOverdue}
                          <span style="display: block; font-size: 10px; font-weight: 700; color: var(--color-error-text); margin-top: 2px;">
                            SOLLECITARE CLIENTE!
                          </span>
                        {/if}
                      </td>
                      <td><strong>€ {inst.expectedAmount.toFixed(2)}</strong></td>
                      <td>
                        <span class="badge" class:status-approved={inst.status === 'paid'} class:status-pending={inst.status !== 'paid'}>
                          {inst.status === 'paid' ? 'Pagato' : 'In attesa'}
                        </span>
                      </td>
                      <td>{inst.paidAmount ? `€ ${inst.paidAmount.toFixed(2)}` : 'N/D'}</td>
                      <td>{inst.paidAt ? new Date(inst.paidAt).toLocaleDateString('it-IT') : 'N/D'}</td>
                      {#if $activeRole === 'superadmin' || $activeRole === 'amministrazione'}
                        <td>
                          {#if inst.status === 'pending'}
                            <div style="display: flex; gap: 8px;">
                              <button 
                                onclick={() => {
                                  const newDate = prompt("Inserisci la nuova data di scadenza (AAAA-MM-GG):", inst.dueDate);
                                  if (newDate) handlePostponeInstallment(inst.id, newDate);
                                }}
                                class="back-link-btn" 
                                style="padding: 4px 8px; font-size: 11px;"
                              >
                                Posticipa
                              </button>
                              <button 
                                onclick={() => {
                                  selectedInstallmentId = inst.id;
                                  installmentActualAmount = inst.expectedAmount;
                                  showInstallmentModal = true;
                                }}
                                class="approve-collect-btn" 
                                style="padding: 4px 8px; font-size: 11px;"
                              >
                                Segna Incassato
                              </button>
                            </div>
                          {:else}
                            <span style="color: var(--color-success-text); font-weight: 600; font-size: 12px; display: inline-flex; align-items: center; gap: 4px;">
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
          {#if $activeRole === 'superadmin' || $activeRole === 'amministrazione'}
            <div style="margin-top: 10px; padding-top: 16px; border-top: 1px solid var(--color-neutral-200);">
              <h4 style="font-size: 13.5px; font-weight: 700; color: var(--color-neutral-800); margin-bottom: 8px;">Pianifica Nuova Scadenza Pagamento</h4>
              <form onsubmit={handleAddInstallment} style="display: flex; gap: 16px; align-items: flex-end; flex-wrap: wrap;">
                <FormField id="inst-due" label="Data Scadenza">
                  <input type="date" id="inst-due" bind:value={installmentDueDate} required />
                </FormField>
                <FormField id="inst-amount" label="Importo Dovuto (€)">
                  <input type="number" id="inst-amount" bind:value={installmentExpectedAmount} min="1" step="0.01" required placeholder="es. 500" />
                </FormField>
                <button type="submit" class="approve-collect-btn" style="height: 38px; padding: 0 16px;">
                  Pianifica Scadenza
                </button>
              </form>
            </div>
          {/if}
        </div>
      </Card>

    </div>
  {/if}
</div>

{#if showInstallmentModal}
  <div class="installment-modal-overlay" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000;">
    <div class="installment-modal-box" style="background: white; padding: 24px; border-radius: var(--radius-lg); width: 100%; max-width: 400px; box-shadow: var(--shadow-lg);">
      <h3 style="margin-top: 0; font-size: 16px; font-weight: 700; color: var(--color-neutral-800); margin-bottom: 12px;">Registra Incasso Rata</h3>
      <p style="font-size: 13px; color: var(--color-neutral-500); margin-bottom: 16px;">
        Inserisci l'importo imponibile effettivamente incassato per questa rata (al netto di IVA). 
        Puoi scorporare l'IVA al 22% se l'importo inserito è lordo.
      </p>
      <FormField id="inst-actual-amount" label="Importo Effettivo Incassato (€)">
        <div class="input-with-button" style="display: flex; gap: 8px;">
          <input type="number" id="inst-actual-amount" bind:value={installmentActualAmount} min="0" step="0.01" required style="flex: 1;" />
          <button type="button" class="back-link-btn" style="padding: 0 8px; font-size: 11px;" onclick={() => {
            if (installmentActualAmount) {
              installmentActualAmount = parseFloat((installmentActualAmount / 1.22).toFixed(2));
            }
          }}>
            Scorpora IVA
          </button>
        </div>
      </FormField>
      <div style="display: flex; justify-content: flex-end; gap: 12px; margin-top: 20px;">
        <button type="button" class="back-link-btn" onclick={() => showInstallmentModal = false}>Annulla</button>
        <button type="button" class="approve-collect-btn" onclick={() => {
          if (installmentActualAmount !== null) handleCollectInstallment(selectedInstallmentId, installmentActualAmount);
        }}>
          Conferma Incasso
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .contract-details-page {
    width: 100%;
  }

  .page-top-actions {
    display: flex;
    align-items: center;
    gap: 20px;
    margin-bottom: 25px;
    flex-wrap: wrap;
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

  .title-header {
    margin: 0;
    font-size: 20px;
    font-weight: 700;
    color: var(--color-neutral-800);
  }

  .status-alert-box {
    padding: 12px 14px;
    border-radius: var(--radius-md);
    font-size: 13px;
    margin-bottom: 20px;
    background: var(--color-success-light);
    border: 1px solid var(--color-success-border);
    color: var(--color-success-text);
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
    padding: 40px;
    color: var(--color-neutral-500);
    background: var(--color-white);
    border: 1px solid var(--color-neutral-200);
    border-radius: var(--radius-lg);
  }

  .spinner {
    width: 20px;
    height: 20px;
    border: 2px solid hsla(var(--brand-h), var(--brand-s), 50%, 0.15);
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
    gap: 30px;
  }

  /* Warning box CSS */
  .pricing-warning-banner {
    display: flex;
    gap: 20px;
    background: hsla(0, 100%, 97%, 1);
    border: 1px solid var(--color-error-border);
    border-left: 6px solid var(--color-error);
    border-radius: var(--radius-md);
    padding: 20px;
    align-items: flex-start;
  }

  .warning-icon-wrapper {
    color: var(--color-error);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .warning-body {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .warning-body h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 700;
    color: var(--color-error-text);
  }

  .warning-body p {
    margin: 0;
    font-size: 13px;
    color: var(--color-neutral-700);
    line-height: 1.5;
  }

  .under-min-products-list {
    margin: 8px 0 0 0;
    padding-left: 20px;
    font-size: 12.5px;
    color: var(--color-neutral-800);
  }

  .under-min-products-list li {
    margin-bottom: 4px;
  }

  .negative-gap {
    color: var(--color-error-text);
    font-weight: 700;
  }

  /* Contract summary row */
  .contract-summary-row {
    display: grid;
    grid-template-columns: 3fr 2fr;
    gap: 24px;
  }

  @media (max-width: 992px) {
    .contract-summary-row {
      grid-template-columns: 1fr;
    }
  }

  .info-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
  }

  @media (max-width: 576px) {
    .info-grid {
      grid-template-columns: 1fr;
    }
  }

  .info-item {
    display: flex;
    flex-direction: column;
  }

  .info-lbl {
    font-size: 11px;
    font-weight: 600;
    color: var(--color-neutral-400);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .info-val {
    font-size: 14.5px;
    font-weight: 700;
    color: var(--color-neutral-800);
    margin-top: 2px;
  }

  .info-sub {
    font-size: 11px;
    color: var(--color-neutral-500);
    margin-top: 1px;
  }

  .badge {
    font-size: 10px;
    font-weight: 700;
    padding: 3px 8px;
    border-radius: 4px;
    text-transform: uppercase;
    display: inline-block;
  }

  .badge.status-approved {
    background: var(--color-success-light);
    color: var(--color-success-text);
  }

  .badge.status-pending {
    background: var(--color-neutral-100);
    color: var(--color-neutral-500);
    border: 1px solid var(--color-neutral-200);
  }

  /* Totals */
  .totals-dashboard {
    display: flex;
    flex-direction: column;
    gap: 24px;
    justify-content: center;
    height: 100%;
  }

  .total-metric {
    display: flex;
    flex-direction: column;
  }

  .metric-lbl {
    font-size: 11px;
    font-weight: 600;
    color: var(--color-neutral-400);
    text-transform: uppercase;
  }

  .metric-val {
    font-size: 24px;
    font-weight: 800;
    margin-top: 4px;
  }

  .metric-val.text-primary { color: var(--color-primary-600); }
  .metric-val.text-success { color: var(--color-success-text); }

  .metric-sub {
    font-size: 10px;
    color: var(--color-neutral-400);
    margin-top: 2px;
  }

  /* Products Table */
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

  .row-warning {
    background: hsla(0, 100%, 98%, 1);
  }

  .prod-cell {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .prod-name {
    font-weight: 600;
    color: var(--color-neutral-800);
  }

  .warning-badge-inline {
    font-size: 9px;
    font-weight: 700;
    background: var(--color-error-light);
    color: var(--color-error-text);
    padding: 1px 5px;
    border-radius: 4px;
    align-self: flex-start;
    display: inline-flex;
    align-items: center;
    gap: 3px;
  }

  .text-warning {
    color: var(--color-error-text);
  }

  .gap-neutral {
    font-size: 11px;
    color: var(--color-neutral-400);
  }

  .gap-positive {
    font-size: 11px;
    color: var(--color-success-text);
    font-weight: 600;
  }

  .gap-negative {
    font-size: 11.5px;
    color: var(--color-neutral-500);
  }

  .gap-negative.heavy-discount {
    color: var(--color-error-text);
    font-weight: 600;
  }

  /* Admin Actions Pane */
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

  .approve-collect-btn {
    background: linear-gradient(135deg, var(--color-success), #16a34a);
    color: var(--color-white);
    border: none;
    padding: 12px 24px;
    border-radius: var(--radius-md);
    font-family: inherit;
    font-weight: 600;
    font-size: 14px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    box-shadow: 0 4px 12px rgba(22, 163, 74, 0.2);
    transition: opacity 0.2s;
  }

  .approve-collect-btn:hover {
    opacity: 0.9;
  }

  .approve-collect-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
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

  :global(.icon-accent) {
    color: var(--color-primary-500);
  }

  .animate-fade-in {
    animation: fadeIn 0.3s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  }
</style>
