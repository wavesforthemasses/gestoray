<script lang="ts">
  import { activeRole, auth } from '$lib/auth';
  import { db, doc, setDoc, getDoc, updateDoc, collection, getDocs, query, where, collectionGroup } from '$lib/firebase';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { Card, Table, FormField } from '$lib';
  import { Award, Clock, CheckCircle2, AlertCircle, Calendar, Users, DollarSign, Wallet, FileText, ArrowRight } from '@lucide/svelte';

  let loading = $state(true);
  let submitting = $state(false);
  let successMsg = $state('');
  let errorMsg = $state('');

  // Selected period
  let selectedMonth = $state(new Date().getMonth() + 1); // 1-12
  let selectedYear = $state(new Date().getFullYear());

  // Data
  let usersList = $state<any[]>([]);
  let paymentsInPeriod = $state<any[]>([]);
  let allocationsInPeriod = $state<any[]>([]);
  let contractsMap = $state<Map<string, any>>(new Map());

  // Closing status
  let closingDoc = $state<any>(null);
  let isClosingFinalized = $derived(closingDoc?.status === 'finalized');

  // Calculations
  let vendorSummary = $derived.by(() => {
    const summary = new Map<string, {
      uid: string;
      name: string;
      email: string;
      qualification: string;
      salesInPeriod: number;
      commissionInPeriod: number;
    }>();

    // Initialize map with all sales consultants
    usersList.forEach(u => {
      if (u.roles?.includes('commerciale')) {
        summary.set(u.uid, {
          uid: u.uid,
          name: `${u.nome || ''} ${u.cognome || ''}`.trim() || u.email,
          email: u.email,
          qualification: u.qualification || 'junior',
          salesInPeriod: 0,
          commissionInPeriod: 0
        });
      }
    });

    // Populate using allocations
    allocationsInPeriod.forEach(alloc => {
      const contract = contractsMap.get(alloc.contractId);
      if (!contract) return;

      const totalPrice = contract.totalPrice || 0;
      if (totalPrice <= 0) return;

      const allocationAmount = alloc.amount || 0;
      const pct = allocationAmount / totalPrice;

      // Extract trigger-calculated commission totals
      const commissionTotal = contract.derived?.commissionTotal || 0;
      const commissionPrimary = contract.derived?.commissionPrimary || 0;
      const commissionSecondary = contract.derived?.commissionSecondary || 0;

      const primaryUid = contract.vendorUid;
      const secondaryUid = contract.secondVendorUid;

      // Process Primary
      if (primaryUid && summary.has(primaryUid)) {
        const vendor = summary.get(primaryUid)!;
        vendor.salesInPeriod += allocationAmount * (secondaryUid ? (1 - (contract.secondVendorShare || 0) / 100) : 1);
        vendor.commissionInPeriod += commissionPrimary * pct;
      }

      // Process Secondary
      if (secondaryUid && summary.has(secondaryUid)) {
        const vendor = summary.get(secondaryUid)!;
        vendor.salesInPeriod += allocationAmount * ((contract.secondVendorShare || 0) / 100);
        vendor.commissionInPeriod += commissionSecondary * pct;
      }
    });

    return Array.from(summary.values()).sort((a, b) => b.commissionInPeriod - a.commissionInPeriod);
  });

  let totalCommissionsToLiquidate = $derived(
    vendorSummary.reduce((sum, v) => sum + v.commissionInPeriod, 0)
  );

  onMount(() => {
    const unsubscribe = activeRole.subscribe(($activeRole) => {
      if ($activeRole && $activeRole !== 'superadmin' && $activeRole !== 'amministrazione' && $activeRole !== 'direzione') {
        goto('/dashboard');
      }
    });

    loadData();
    return () => unsubscribe();
  });

  async function loadData() {
    loading = true;
    successMsg = '';
    errorMsg = '';
    contractsMap.clear();

    try {
      // 1. Fetch Users
      const usersSnap = await getDocs(collection(db, 'users'));
      const uList: any[] = [];
      usersSnap.forEach((doc: any) => {
        const data = doc.data();
        uList.push({ uid: doc.id, ...data.original, edits: data.edits });
      });
      usersList = uList;

      // 2. Fetch Closing Status
      const periodId = `${selectedYear}_${String(selectedMonth).padStart(2, '0')}`;
      const closingSnap = await getDoc(doc(db, 'commissions_closings', periodId));
      if (closingSnap.exists()) {
        closingDoc = closingSnap.data();
      } else {
        closingDoc = null;
      }

      // 3. Fetch Payments in selected month/year
      const startOfMonth = new Date(selectedYear, selectedMonth - 1, 1).toISOString();
      const endOfMonth = new Date(selectedYear, selectedMonth, 0, 23, 59, 59, 999).toISOString();

      const paymentsSnap = await getDocs(
        query(collection(db, 'payments'), where('original.date', '>=', startOfMonth), where('original.date', '<=', endOfMonth))
      );

      const payList: any[] = [];
      const paymentIds: string[] = [];
      paymentsSnap.forEach((doc: any) => {
        payList.push({ id: doc.id, ...doc.data().original });
        paymentIds.push(doc.id);
      });
      paymentsInPeriod = payList;

      // 4. Fetch Allocations (contractsPaid subcollection) under these payments
      const allocs: any[] = [];
      const contractsToFetch = new Set<string>();

      await Promise.all(paymentIds.map(async (payId) => {
        const allocSnap = await getDocs(collection(db, 'payments', payId, 'contractsPaid'));
        allocSnap.forEach((doc: any) => {
          const d = doc.data();
          allocs.push({
            id: doc.id,
            paymentId: payId,
            contractId: d.original?.contractId,
            amount: d.original?.amount
          });
          if (d.original?.contractId) {
            contractsToFetch.add(d.original.contractId);
          }
        });
      }));
      allocationsInPeriod = allocs;

      // 5. Fetch required contracts
      await Promise.all(Array.from(contractsToFetch).map(async (cId) => {
        const contractSnap = await getDoc(doc(db, 'contracts', cId));
        if (contractSnap.exists()) {
          const data = contractSnap.data();
          contractsMap.set(cId, { id: cId, ...data.original, derived: data.derived });
        }
      }));

    } catch (e: any) {
      console.error(e);
      errorMsg = 'Errore nel caricamento delle provvigioni: ' + e.message;
    } finally {
      loading = false;
    }
  }

  async function handleFinalizeCommissions() {
    if (!$auth || isClosingFinalized) return;
    submitting = true;
    successMsg = '';
    errorMsg = '';

    try {
      const periodId = `${selectedYear}_${String(selectedMonth).padStart(2, '0')}`;
      const now = new Date().toISOString();

      const closingData = {
        periodId,
        month: selectedMonth,
        year: selectedYear,
        status: 'finalized',
        finalizedAt: now,
        finalizedBy: $auth.uid,
        finalizedEmail: $auth.email,
        totalCommissions: totalCommissionsToLiquidate,
        breakdown: vendorSummary.map(v => ({
          uid: v.uid,
          name: v.name,
          email: v.email,
          qualification: v.qualification,
          sales: v.salesInPeriod,
          commission: v.commissionInPeriod
        }))
      };

      await setDoc(doc(db, 'commissions_closings', periodId), closingData);
      
      closingDoc = closingData;
      successMsg = 'Provvigioni del mese rese DEFINITIVE con successo! I commerciali possono procedere ad emettere fattura.';
    } catch (e: any) {
      errorMsg = 'Errore durante la chiusura delle provvigioni: ' + e.message;
    } finally {
      submitting = false;
    }
  }
</script>

<div class="commissions-page animate-fade-in">
  {#if errorMsg}
    <div class="alert error animate-fade-in">
      <AlertCircle size={16} />
      <span>{errorMsg}</span>
    </div>
  {/if}
  {#if successMsg}
    <div class="alert success animate-fade-in">
      <CheckCircle2 size={16} />
      <span>{successMsg}</span>
    </div>
  {/if}

  <div class="header-dashboard-section">
    <div class="period-selector-card">
      <div class="selector-form">
        <FormField id="sel-month" label="Mese">
          <select id="sel-month" bind:value={selectedMonth} onchange={loadData} disabled={loading}>
            <option value={1}>Gennaio</option>
            <option value={2}>Febbraio</option>
            <option value={3}>Marzo</option>
            <option value={4}>Aprile</option>
            <option value={5}>Maggio</option>
            <option value={6}>Giugno</option>
            <option value={7}>Luglio</option>
            <option value={8}>Agosto</option>
            <option value={9}>Settembre</option>
            <option value={10}>Ottobre</option>
            <option value={11}>Novembre</option>
            <option value={12}>Dicembre</option>
          </select>
        </FormField>

        <FormField id="sel-year" label="Anno">
          <select id="sel-year" bind:value={selectedYear} onchange={loadData} disabled={loading}>
            <option value={2025}>2025</option>
            <option value={2026}>2026</option>
            <option value={2027}>2027</option>
          </select>
        </FormField>
      </div>

      <div class="status-summary-box">
        {#if isClosingFinalized}
          <div class="closing-status finalized">
            <CheckCircle2 size={16} />
            <div class="status-details">
              <strong>CHIUSURA DEFINITIVA</strong>
              <span>Approvata il {new Date(closingDoc.finalizedAt).toLocaleDateString('it-IT')} da {closingDoc.finalizedEmail}</span>
            </div>
          </div>
        {:else}
          <div class="closing-status pending">
            <Clock size={16} />
            <div class="status-details">
              <strong>STIMA PROVVISORIA</strong>
              <span>Le provvigioni sono provvisorie e si aggiornano in tempo reale con gli incassi registrati.</span>
            </div>
          </div>
        {/if}
      </div>
    </div>
  </div>

  {#if loading}
    <div class="loader-box">
      <span class="spinner"></span>
      Ricalcolo provvigioni del mese...
    </div>
  {:else}
    <div class="kpi-grid" style="margin-bottom: 24px;">
      <div class="kpi-card">
        <div class="kpi-icon"><Wallet size={20} /></div>
        <div class="kpi-info">
          <span class="kpi-val">€ {paymentsInPeriod.reduce((sum, p) => sum + (p.amount || 0), 0).toFixed(2)}</span>
          <span class="kpi-lbl">Incassi Totali del Mese</span>
        </div>
      </div>
      <div class="kpi-card">
        <div class="kpi-icon"><FileText size={20} /></div>
        <div class="kpi-info">
          <span class="kpi-val">€ {allocationsInPeriod.reduce((sum, a) => sum + (a.amount || 0), 0).toFixed(2)}</span>
          <span class="kpi-lbl">Valore Allocato a Contratti</span>
        </div>
      </div>
      <div class="kpi-card highlight">
        <div class="kpi-icon"><Award size={20} /></div>
        <div class="kpi-info">
          <span class="kpi-val">€ {totalCommissionsToLiquidate.toFixed(2)}</span>
          <span class="kpi-lbl">Massa Provvigionale {isClosingFinalized ? 'Definitiva' : 'Provvisoria'}</span>
        </div>
      </div>
    </div>

    <Card title="Prospetto Provvigionale Consulenti" description="Riepilogo delle provvigioni spettanti a ciascun commerciale per il mese di riferimento, calcolate sugli incassi effettivi.">
      {#snippet icon()}
        <Users size={20} class="icon-accent" />
      {/snippet}

      {#snippet headerSnippet()}
        {#if !isClosingFinalized && $activeRole !== 'direzione'}
          <button onclick={handleFinalizeCommissions} disabled={submitting || vendorSummary.length === 0} class="approve-closing-btn">
            Approva e Rendi Definitive
          </button>
        {/if}
      {/snippet}

      {#if vendorSummary.length === 0}
        <div class="empty-txt" style="padding: 24px; text-align: center; color: var(--color-neutral-500);">Nessun commerciale attivo trovato nel database.</div>
      {:else}
        <table class="widescreen-table">
          <thead>
            <tr>
              <th>Consulente</th>
              <th>Qualifica</th>
              <th>Volume Incassato (Quota)</th>
              <th>Importo Provvigione</th>
              <th>Stato liquidazione</th>
            </tr>
          </thead>
          <tbody>
            {#each vendorSummary as row}
              <tr>
                <td>
                  <div class="user-cell">
                    <span class="u-name">{row.name}</span>
                    <span class="u-email">{row.email}</span>
                  </div>
                </td>
                <td>
                  <span class="badge qual-{row.qualification}">{row.qualification.toUpperCase()}</span>
                </td>
                <td><strong>€ {row.salesInPeriod.toFixed(2)}</strong></td>
                <td><strong style="color: var(--color-success-text); font-size: 14px;">€ {row.commissionInPeriod.toFixed(2)}</strong></td>
                <td>
                  <span class="status-pill" class:finalized={isClosingFinalized}>
                    {isClosingFinalized ? 'Pronta per Fatturazione' : 'Provvisoria (In attesa Chiusura)'}
                  </span>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      {/if}
    </Card>

    <div style="margin-top: 24px;">
      <Card title="Dettaglio Distribuzione Incassi del Mese" description="Elenco di tutti i singoli incassi registrati nel mese selezionato e la relativa allocazione sulle voci di contratto.">
        {#snippet icon()}
          <Clock size={20} class="icon-accent" />
        {/snippet}

        {#if allocationsInPeriod.length === 0}
          <div class="empty-txt" style="padding: 24px; text-align: center; color: var(--color-neutral-500);">Nessuna transazione incassata in questo periodo.</div>
        {:else}
          <table class="widescreen-table">
            <thead>
              <tr>
                <th>ID Incasso</th>
                <th>Contratto Padre</th>
                <th>Cliente</th>
                <th>Importo Allocato</th>
                <th>Consulente Primario</th>
                <th>Split Co-selling</th>
              </tr>
            </thead>
            <tbody>
              {#each allocationsInPeriod as alloc}
                {@const contract = contractsMap.get(alloc.contractId)}
                <tr>
                  <td><code>{alloc.paymentId}</code></td>
                  <td><code>{alloc.contractId}</code></td>
                  <td>{contract?.clientName || 'N/D'}</td>
                  <td><strong>€ {alloc.amount.toFixed(2)}</strong></td>
                  <td>{contract?.vendorEmail || 'N/D'}</td>
                  <td>
                    {#if contract?.secondVendorEmail}
                      <span class="co-seller-badge">{contract.secondVendorEmail} ({contract.secondVendorShare}%)</span>
                    {:else}
                      <span class="no-co-seller">Nessuno (100% primario)</span>
                    {/if}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        {/if}
      </Card>
    </div>
  {/if}
</div>

<style>
  .commissions-page {
    width: 100%;
  }

  .alert {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 16px;
    border-radius: var(--radius-md);
    font-size: 14px;
    margin-bottom: 20px;
    line-height: 1.4;
  }

  .alert.error {
    background: var(--color-error-light);
    border: 1px solid var(--color-error-border);
    color: var(--color-error-text);
  }

  .alert.success {
    background: var(--color-success-light);
    border: 1px solid var(--color-success-border);
    color: var(--color-success-text);
  }

  .period-selector-card {
    background: var(--color-white);
    border: 1px solid var(--color-neutral-200);
    border-radius: var(--radius-md);
    padding: 16px 24px;
    margin-bottom: 24px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 16px;
    box-shadow: var(--shadow-sm);
  }

  .selector-form {
    display: flex;
    gap: 16px;
    align-items: center;
  }

  :global(.selector-form .input-group) {
    margin-bottom: 0 !important;
  }

  .selector-form select {
    height: 38px;
    padding: 0 12px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--color-neutral-300);
    font-family: inherit;
    font-size: 13px;
    background: var(--color-white);
    color: var(--color-neutral-800);
    min-width: 140px;
  }

  .status-summary-box {
    display: flex;
    align-items: center;
  }

  .closing-status {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 16px;
    border-radius: var(--radius-md);
    font-size: 12px;
  }

  .closing-status.finalized {
    background: var(--color-success-light);
    border: 1px solid var(--color-success-border);
    color: var(--color-success-text);
  }

  .closing-status.pending {
    background: var(--color-primary-50);
    border: 1px solid var(--color-primary-200);
    color: var(--color-primary-800);
  }

  .status-details {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .status-details strong {
    font-size: 13px;
    font-weight: 700;
  }

  .kpi-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 16px;
  }

  .kpi-card {
    background: var(--color-white);
    border: 1px solid var(--color-neutral-200);
    border-radius: var(--radius-md);
    padding: 16px 20px;
    display: flex;
    align-items: center;
    gap: 16px;
    box-shadow: var(--shadow-sm);
  }

  .kpi-card.highlight {
    background: linear-gradient(135deg, var(--color-primary-50), var(--color-primary-100));
    border-color: var(--color-primary-200);
  }

  .kpi-icon {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: var(--color-neutral-50);
    color: var(--color-primary-600);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: var(--shadow-sm);
  }

  .kpi-card.highlight .kpi-icon {
    background: var(--color-white);
    color: var(--color-primary-700);
  }

  .kpi-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .kpi-val {
    font-size: 18px;
    font-weight: 700;
    color: var(--color-neutral-800);
  }

  .kpi-lbl {
    font-size: 12px;
    color: var(--color-neutral-500);
  }

  .approve-closing-btn {
    background: linear-gradient(135deg, var(--color-success), var(--color-success-text));
    color: var(--color-white);
    border: none;
    padding: 8px 16px;
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-family: inherit;
    font-size: 13px;
    font-weight: 600;
    transition: all 0.2s;
    box-shadow: 0 4px 10px rgba(16, 185, 129, 0.2);
  }

  .approve-closing-btn:hover {
    opacity: 0.9;
  }

  .approve-closing-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .user-cell {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .u-name {
    font-weight: 600;
    color: var(--color-neutral-800);
  }

  .u-email {
    font-size: 11.5px;
    color: var(--color-neutral-500);
  }

  .badge {
    font-size: 10px;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: var(--radius-xs);
    letter-spacing: 0.05em;
    display: inline-block;
  }

  .badge.qual-senior {
    background: var(--color-success-light);
    color: var(--color-success-text);
  }

  .badge.qual-junior {
    background: var(--color-primary-50);
    color: var(--color-primary-700);
  }

  .status-pill {
    font-size: 11.5px;
    color: var(--color-neutral-500);
    font-weight: 500;
  }

  .status-pill.finalized {
    color: var(--color-success-text);
    font-weight: 700;
  }

  .co-seller-badge {
    background: hsla(270, 100%, 97%, 1);
    color: #7c3aed;
    font-size: 11px;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: var(--radius-xs);
  }

  .no-co-seller {
    color: var(--color-neutral-400);
    font-size: 11.5px;
  }

  .loader-box {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 40px;
    color: var(--color-neutral-500);
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

  .widescreen-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 8px;
  }

  .widescreen-table th {
    text-align: left;
    padding: 12px;
    font-size: 12px;
    text-transform: uppercase;
    color: var(--color-neutral-500);
    border-bottom: 1px solid var(--color-neutral-200);
    letter-spacing: 0.05em;
  }

  .widescreen-table td {
    padding: 14px 12px;
    border-bottom: 1px solid var(--color-neutral-100);
    font-size: 13px;
  }
</style>
