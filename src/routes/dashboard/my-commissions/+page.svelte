<script lang="ts">
  import { activeRole, auth } from '$lib/auth';
  import { db, doc, getDoc, collection, getDocs, query, where } from '$lib/firebase';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { Card, Table, Button } from '$lib';
  import { Award, Eye, Calendar } from '@lucide/svelte';

  let loading = $state(true);
  let errorMsg = $state('');

  // Selected period
  let selectedMonth = $state(new Date().getMonth() + 1); // 1-12
  let selectedYear = $state(new Date().getFullYear());

  // Data
  let myAllocations = $state<any[]>([]);

  // Closing status
  let closingDoc = $state<any>(null);
  let isClosingFinalized = $derived(closingDoc?.status === 'finalized');

  // Summary
  let totalCommissions = $derived(
    myAllocations.reduce((sum, alloc) => sum + alloc.myCommission, 0)
  );

  let totalSales = $derived(
    myAllocations.reduce((sum, alloc) => sum + alloc.mySalePortion, 0)
  );

  onMount(() => {
    const unsubscribe = activeRole.subscribe(($activeRole) => {
      if ($activeRole && $activeRole !== 'commerciale') {
        goto('/dashboard');
      }
    });

    if ($auth) {
      loadData();
    }

    return () => unsubscribe();
  });

  async function loadData() {
    if (!$auth) return;
    loading = true;
    errorMsg = '';
    myAllocations = [];

    try {
      const myUid = $auth.uid;

      // 1. Fetch Closing Status
      const periodId = `${selectedYear}_${String(selectedMonth).padStart(2, '0')}`;
      const closingSnap = await getDoc(doc(db, 'commissions_closings', periodId));
      if (closingSnap.exists()) {
        closingDoc = closingSnap.data();
      } else {
        closingDoc = null;
      }

      // 2. Fetch Payments in selected month/year
      const startOfMonth = new Date(selectedYear, selectedMonth - 1, 1).toISOString();
      const endOfMonth = new Date(selectedYear, selectedMonth, 0, 23, 59, 59, 999).toISOString();

      const paymentsSnap = await getDocs(
        query(collection(db, 'payments'), where('original.date', '>=', startOfMonth), where('original.date', '<=', endOfMonth))
      );

      const paymentIds: string[] = [];
      const paymentDateMap = new Map<string, string>();
      paymentsSnap.forEach((doc: any) => {
        paymentIds.push(doc.id);
        paymentDateMap.set(doc.id, doc.data().original.date);
      });

      if (paymentIds.length === 0) {
        loading = false;
        return;
      }

      // 3. Fetch Allocations (contractsPaid subcollection) under these payments
      const allocs: any[] = [];
      const contractsToFetch = new Set<string>();

      await Promise.all(paymentIds.map(async (payId) => {
        const allocSnap = await getDocs(collection(db, 'payments', payId, 'contractsPaid'));
        allocSnap.forEach((doc: any) => {
          const d = doc.data();
          if (d.original?.contractId) {
            allocs.push({
              id: doc.id,
              paymentId: payId,
              paymentDate: paymentDateMap.get(payId) || '',
              contractId: d.original.contractId,
              amount: d.original.amount || 0
            });
            contractsToFetch.add(d.original.contractId);
          }
        });
      }));

      // 4. Fetch required contracts
      const contractsMap = new Map<string, any>();
      await Promise.all(Array.from(contractsToFetch).map(async (cId) => {
        const contractSnap = await getDoc(doc(db, 'contracts', cId));
        if (contractSnap.exists()) {
          const data = contractSnap.data();
          contractsMap.set(cId, { id: cId, ...data.original, derived: data.derived });
        }
      }));

      // 5. Filter & Calculate specifically for the logged in vendor
      const processedAllocs: any[] = [];

      allocs.forEach(alloc => {
        const contract = contractsMap.get(alloc.contractId);
        if (!contract) return;

        const primaryUid = contract.vendorUid;
        const secondaryUid = contract.secondVendorUid;

        if (primaryUid !== myUid && secondaryUid !== myUid) return; // Not their contract

        const totalPrice = contract.totalPrice || 0;
        if (totalPrice <= 0) return;

        const allocationAmount = alloc.amount || 0;
        const pct = allocationAmount / totalPrice;

        const commissionPrimary = contract.derived?.commissionPrimary || 0;
        const commissionSecondary = contract.derived?.commissionSecondary || 0;

        let myRole = '';
        let mySalePortion = 0;
        let myCommission = 0;
        let shareText = '';

        if (primaryUid === myUid) {
          myRole = 'Venditore Principale';
          const mySharePct = secondaryUid ? (1 - (contract.secondVendorShare || 0) / 100) : 1;
          mySalePortion = allocationAmount * mySharePct;
          myCommission = commissionPrimary * pct;
          shareText = secondaryUid ? `${Math.round(mySharePct * 100)}% (Condiviso)` : '100% (Unico)';
        } else if (secondaryUid === myUid) {
          myRole = 'Co-Venditore';
          const mySharePct = (contract.secondVendorShare || 0) / 100;
          mySalePortion = allocationAmount * mySharePct;
          myCommission = commissionSecondary * pct;
          shareText = `${Math.round(mySharePct * 100)}% (Condiviso)`;
        }

        if (myCommission > 0) {
          processedAllocs.push({
            ...alloc,
            clientName: contract.clientName || 'Sconosciuto',
            myRole,
            mySalePortion,
            myCommission,
            shareText
          });
        }
      });

      processedAllocs.sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime());
      myAllocations = processedAllocs;

    } catch (e: any) {
      console.error(e);
      errorMsg = 'Errore nel caricamento delle tue provvigioni: ' + e.message;
    } finally {
      loading = false;
    }
  }

  const columns = [
    { key: 'paymentDate', header: 'Data Incasso' },
    { key: 'clientName', header: 'Cliente / Contratto' },
    { key: 'amount', header: 'Importo Incassato' },
    { key: 'shareText', header: 'Quota di Spettanza' },
    { key: 'myCommission', header: 'Provvigione Maturata' },
    { key: 'actions', header: 'Azioni' }
  ];

</script>

<div class="my-commissions-page animate-fade-in">
  <div class="page-header">
    <div class="header-left">
      <h1 class="page-title"><Award size={28} class="title-icon" /> Le Mie Provvigioni</h1>
      <p class="page-subtitle">Visualizza in dettaglio le tue provvigioni maturate nel periodo selezionato.</p>
    </div>
  </div>

  <Card>
    <div class="controls-row">
      <div class="period-selectors">
        <div class="selector-group">
          <label for="month-sel">Mese</label>
          <select id="month-sel" bind:value={selectedMonth} onchange={loadData}>
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
        </div>
        <div class="selector-group">
          <label for="year-sel">Anno</label>
          <select id="year-sel" bind:value={selectedYear} onchange={loadData}>
            {#each Array.from({length: 5}, (_, i) => new Date().getFullYear() - i) as yr}
              <option value={yr}>{yr}</option>
            {/each}
          </select>
        </div>
      </div>
      <div class="period-status">
        {#if isClosingFinalized}
          <span class="status-badge closed"><Calendar size={14} /> Chiusura Definitiva (Approvato)</span>
        {:else}
          <span class="status-badge open"><Calendar size={14} /> Periodo Provvisorio (In corso)</span>
        {/if}
      </div>
    </div>
  </Card>

  {#if errorMsg}
    <div class="alert alert-error">{errorMsg}</div>
  {/if}

  {#if loading}
    <div class="loader-box">
      <span class="spinner"></span>
      Calcolo provvigioni in corso...
    </div>
  {:else}
    <div class="metrics-grid">
      <div class="metric-card">
        <span class="m-label">Venduto di competenza</span>
        <span class="m-value">€ {totalSales.toFixed(2)}</span>
      </div>
      <div class="metric-card highlight">
        <span class="m-label">Provvigione Totale</span>
        <span class="m-value">€ {totalCommissions.toFixed(2)}</span>
      </div>
    </div>

    <Card title="Dettaglio Incassi e Provvigioni" description="Elenco di tutti gli incassi che hanno generato una tua provvigione in questo periodo.">
      {#snippet cell(col: any, row: any)}
        {#if col.key === 'paymentDate'}
          <span class="date-txt">{new Date(row.paymentDate).toLocaleDateString('it-IT')}</span>
        {:else if col.key === 'clientName'}
          <div class="client-info">
            <span class="client-name">{row.clientName}</span>
            <span class="contract-id">Contratto: {row.contractId.substring(0, 8)}...</span>
          </div>
        {:else if col.key === 'amount'}
          <span class="money-txt">€ {row.amount.toFixed(2)}</span>
        {:else if col.key === 'shareText'}
          <div class="share-info">
            <span class="share-pct">{row.shareText}</span>
            <span class="share-role">{row.myRole}</span>
          </div>
        {:else if col.key === 'myCommission'}
          <span class="money-txt success">€ {row.myCommission.toFixed(2)}</span>
        {:else if col.key === 'actions'}
          <Button size="sm" variant="secondary" onclick={() => goto(`/dashboard/contracts/${row.contractId}`)}>
            <Eye size={14} /> Vedi Contratto
          </Button>
        {/if}
      {/snippet}

      <div class="table-wrapper">
        <Table
          {columns}
          data={myAllocations}
          cellSnippet={cell}
          emptyText="Nessuna provvigione maturata nel periodo selezionato."
        />
      </div>
    </Card>
  {/if}
</div>

<style>
  .my-commissions-page {
    display: flex;
    flex-direction: column;
    gap: 24px;
    padding-bottom: 40px;
  }

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
  }
  .header-left {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .page-title {
    font-size: 24px;
    font-weight: 700;
    color: var(--color-neutral-900);
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 0;
  }
  .title-icon {
    color: var(--color-primary-500);
  }
  .page-subtitle {
    margin: 0;
    color: var(--color-neutral-500);
    font-size: 14px;
  }

  .controls-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 16px;
  }
  .period-selectors {
    display: flex;
    gap: 16px;
    align-items: center;
  }
  .selector-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .selector-group label {
    font-size: 12px;
    font-weight: 600;
    color: var(--color-neutral-600);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .selector-group select {
    padding: 8px 12px;
    border: 1px solid var(--color-neutral-300);
    border-radius: 6px;
    font-size: 14px;
    color: var(--color-neutral-800);
    background-color: var(--color-neutral-50);
    min-width: 140px;
  }
  .selector-group select:focus {
    outline: none;
    border-color: var(--color-primary-500);
    box-shadow: 0 0 0 3px var(--color-primary-100);
  }

  .period-status {
    display: flex;
    align-items: center;
  }
  .status-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 600;
  }
  .status-badge.closed {
    background: var(--color-success-light);
    color: var(--color-success-text);
  }
  .status-badge.open {
    background: var(--color-warning-light);
    color: var(--color-warning-text);
  }

  .metrics-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 20px;
  }
  .metric-card {
    background: white;
    border: 1px solid var(--color-neutral-200);
    border-radius: 12px;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.02);
  }
  .metric-card.highlight {
    background: linear-gradient(135deg, var(--color-primary-500), var(--color-primary-600));
    color: white;
    border: none;
  }
  .m-label {
    font-size: 13px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--color-neutral-500);
  }
  .metric-card.highlight .m-label {
    color: rgba(255,255,255,0.8);
  }
  .m-value {
    font-size: 28px;
    font-weight: 700;
    color: var(--color-neutral-900);
  }
  .metric-card.highlight .m-value {
    color: white;
  }

  .table-wrapper {
    margin-top: 16px;
  }
  .date-txt {
    font-size: 13px;
    color: var(--color-neutral-700);
  }
  .client-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .client-name {
    font-weight: 600;
    color: var(--color-neutral-900);
  }
  .contract-id {
    font-size: 11px;
    color: var(--color-neutral-500);
    font-family: monospace;
  }
  .money-txt {
    font-weight: 600;
    color: var(--color-neutral-800);
  }
  .money-txt.success {
    color: var(--color-success-500);
    font-size: 15px;
  }
  .share-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .share-pct {
    font-weight: 600;
    color: var(--color-neutral-800);
  }
  .share-role {
    font-size: 11px;
    color: var(--color-neutral-500);
    text-transform: uppercase;
  }

  .loader-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    padding: 60px 20px;
    background: white;
    border-radius: 12px;
    border: 1px solid var(--color-neutral-200);
    color: var(--color-neutral-600);
    font-weight: 500;
  }
  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--color-neutral-200);
    border-top-color: var(--color-primary-500);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  .alert {
    padding: 12px 16px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
  }
  .alert-error {
    background-color: var(--color-error-light);
    color: var(--color-error-text);
    border: 1px solid rgba(220, 38, 38, 0.2);
  }
</style>
