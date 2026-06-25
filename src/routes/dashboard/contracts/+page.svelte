<script lang="ts">
  import { activeRole, auth } from '$lib/auth';
  import { db, doc, setDoc, collection, getDocs } from '$lib/firebase';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { Card, Table } from '$lib';
  import { FileText, Award, Clock, DollarSign, Wallet, TrendingUp, Users } from '@lucide/svelte';

  onMount(() => {
    const unsubscribe = activeRole.subscribe(($activeRole) => {
      if ($activeRole && $activeRole !== 'superadmin' && $activeRole !== 'amministrazione' && $activeRole !== 'commerciale') {
        goto('/dashboard');
      }
    });

    fetchData();
    return () => unsubscribe();
  });

  let contractsList = $state<Array<{ id: string, clientId: string, clientName: string, clientEmail: string, vendorUid: string, vendorEmail: string, totalPrice: number, products: any[], status: string, hasWarning: boolean, createdAt: string, approvedAt?: string }>>([]);
  let usersList = $state<Array<{ uid: string, email: string, nome?: string, cognome?: string, qualification?: 'junior' | 'senior' }>>([]);
  let loading = $state(true);

  // Tab filters: 'all' | 'pending' | 'approved' | 'commissions'
  let activeTab = $state<'all' | 'pending' | 'approved' | 'commissions'>('all');

  async function fetchData() {
    loading = true;
    try {
      // 1. Fetch Users
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const uList: typeof usersList = [];
      usersSnapshot.forEach((doc: any) => {
        const data = doc.data();
        uList.push({
          uid: doc.id,
          email: data.email,
          nome: data.nome,
          cognome: data.cognome,
          qualification: data.qualification || 'junior'
        });
      });
      usersList = uList;

      // 2. Fetch Contracts
      const contractsSnapshot = await getDocs(collection(db, 'contracts'));
      const cList: typeof contractsList = [];
      contractsSnapshot.forEach((doc: any) => {
        const data = doc.data();
        cList.push({
          id: doc.id,
          clientId: data.clientId,
          clientName: data.clientName,
          clientEmail: data.clientEmail,
          vendorUid: data.vendorUid,
          vendorEmail: data.vendorEmail,
          totalPrice: data.totalPrice,
          products: data.products || [],
          status: data.status,
          hasWarning: data.hasWarning || false,
          createdAt: data.createdAt,
          approvedAt: data.approvedAt
        });
      });
      
      contractsList = cList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch (e) {
      console.error('Error fetching contracts data:', e);
    } finally {
      loading = false;
    }
  }

  // Calculate commission
  function calculateContractCommission(contract: typeof contractsList[0]) {
    const vendor = usersList.find(u => u.uid === contract.vendorUid);
    const qualification = vendor?.qualification || 'junior';

    let totalCommission = 0;
    const itemsCommissions = contract.products.map(item => {
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
      if (qualification === 'senior') {
        commPct = 5.0 + (ratio * 5.0);
      } else {
        commPct = 2.5 + (ratio * 5.0);
      }

      const itemComm = itemTotal * (commPct / 100);
      totalCommission += itemComm;

      return { amount: itemComm };
    });

    return {
      qualification,
      totalCommission
    };
  }

  // Filtered list
  let filteredContracts = $derived(
    contractsList.filter(c => {
      if ($activeRole === 'commerciale' && c.vendorUid !== $auth?.uid) {
        return false;
      }
      
      if (activeTab === 'pending' && c.status !== 'pending') return false;
      if (activeTab === 'approved' && c.status !== 'approved') return false;
      
      return true;
    })
  );

  // Expected/Earned totals for Commercial
  let commercialStats = $derived.by(() => {
    let sospese = 0;
    let maturate = 0;
    let totalVenduto = 0;

    contractsList.forEach(c => {
      if (c.vendorUid === $auth?.uid) {
        const comm = calculateContractCommission(c).totalCommission;
        if (c.status === 'approved') {
          maturate += comm;
          totalVenduto += c.totalPrice;
        } else {
          sospese += comm;
        }
      }
    });

    return { sospese, maturate, totalVenduto };
  });

  // Admin summary per consultant
  let adminConsultantsSummary = $derived.by(() => {
    const summary: Record<string, { name: string, email: string, qualification: string, approvedSales: number, totalCommission: number, pendingSales: number }> = {};
    
    contractsList.forEach(c => {
      const vendor = usersList.find(u => u.uid === c.vendorUid);
      const name = vendor ? `${vendor.nome || ''} ${vendor.cognome || ''}`.trim() : c.vendorEmail;
      const qualification = vendor?.qualification || 'junior';
      
      if (!summary[c.vendorUid]) {
        summary[c.vendorUid] = {
          name: name || 'Sconosciuto',
          email: c.vendorEmail,
          qualification,
          approvedSales: 0,
          totalCommission: 0,
          pendingSales: 0
        };
      }
      
      const comm = calculateContractCommission(c).totalCommission;
      if (c.status === 'approved') {
        summary[c.vendorUid].approvedSales += c.totalPrice;
        summary[c.vendorUid].totalCommission += comm;
      } else {
        summary[c.vendorUid].pendingSales += c.totalPrice;
      }
    });

    return Object.values(summary);
  });

  // Columns layout
  const columns = $derived.by(() => {
    const list = [
      { key: 'createdAt', header: 'Data Ordine' },
      { key: 'clientName', header: 'Cliente' },
      { key: 'totalPrice', header: 'Importo Venduto' },
      { key: 'commission', header: 'Provvigione Stimata' },
      { key: 'status', header: 'Stato' }
    ];
    
    if ($activeRole !== 'commerciale') {
      list.splice(2, 0, { key: 'vendorEmail', header: 'Consulente' });
    }
    
    return list;
  });

  function handleSelectContract(row: any) {
    goto(`/dashboard/contracts/${row.id}`);
  }
</script>

<svelte:head>
  <title>Gestione Contratti | Gestoray</title>
</svelte:head>

<div class="contracts-page animate-fade-in">
  <!-- 1. Commercial stats cards -->
  {#if $activeRole === 'commerciale'}
    <div class="stats-row">
      <div class="stat-card border-success">
        <div class="stat-icon success">
          <Award size={22} />
        </div>
        <div class="stat-body">
          <span class="stat-lbl">Provvigioni Maturate (Incassate)</span>
          <span class="stat-val text-success">€ {commercialStats.maturate.toFixed(2)}</span>
          <span class="stat-sub">Fatturato incassato: € {commercialStats.totalVenduto.toFixed(2)}</span>
        </div>
      </div>

      <div class="stat-card border-warning">
        <div class="stat-icon warning">
          <Clock size={22} />
        </div>
        <div class="stat-body">
          <span class="stat-lbl">Provvigioni Sospese (In Attesa)</span>
          <span class="stat-val text-warning">€ {commercialStats.sospese.toFixed(2)}</span>
          <span class="stat-sub">Visualizzato non appena l'amministrazione approva l'incasso.</span>
        </div>
      </div>
    </div>
  {/if}

  <div class="contracts-shell">
    <Card title="Database Contratti Commerciali" description="Fai clic su un contratto per vederne i dettagli o approvare la transazione.">
      {#snippet icon()}
        <FileText size={20} class="icon-accent" />
      {/snippet}

      {#snippet headerSnippet()}
        <div class="filter-tabs">
          <button class="tab-btn" class:active={activeTab === 'all'} onclick={() => activeTab = 'all'}>Tutti</button>
          <button class="tab-btn" class:active={activeTab === 'pending'} onclick={() => activeTab = 'pending'}>In Attesa</button>
          <button class="tab-btn" class:active={activeTab === 'approved'} onclick={() => activeTab = 'approved'}>Approvati</button>
          {#if $activeRole !== 'commerciale'}
            <button class="tab-btn accent-tab" class:active={activeTab === 'commissions'} onclick={() => activeTab = 'commissions'}>Provvigioni Consulenti</button>
          {/if}
        </div>
      {/snippet}

      {#if loading}
        <div class="loader-box">
          <span class="spinner"></span>
          Caricamento dati...
        </div>
      {:else if activeTab === 'commissions'}
        <!-- Consultants summary tab (Admin only) -->
        <div class="consultants-summary-grid animate-fade-in">
          {#each adminConsultantsSummary as rep}
            <div class="consultant-card">
              <div class="c-header">
                <span class="c-name">{rep.name}</span>
                <span class="badge qual-{rep.qualification}">{rep.qualification.toUpperCase()}</span>
              </div>
              <span class="c-email">{rep.email}</span>
              
              <div class="c-metrics">
                <div class="c-metric">
                  <span class="c-metric-val">€ {rep.approvedSales.toFixed(2)}</span>
                  <span class="c-metric-lbl">Venduto Approvato</span>
                </div>
                <div class="c-metric">
                  <span class="c-metric-val text-success">€ {rep.totalCommission.toFixed(2)}</span>
                  <span class="c-metric-lbl">Provvigione Dovuta</span>
                </div>
              </div>
              {#if rep.pendingSales > 0}
                <span class="c-pending">Vendite in attesa di approvazione: € {rep.pendingSales.toFixed(2)}</span>
              {/if}
            </div>
          {/each}
          {#if adminConsultantsSummary.length === 0}
            <span class="empty-txt">Nessun dato provvigionale calcolato.</span>
          {/if}
        </div>
      {:else}
        <!-- Contracts list tab -->
        {#snippet cell(col: any, row: any)}
          {#if col.key === 'createdAt'}
            <span class="date-txt">{new Date(row.createdAt).toLocaleDateString('it-IT')}</span>
          {:else if col.key === 'clientName'}
            <div class="client-cell">
              <span class="client-name">{row.clientName}</span>
              <span class="client-mail">{row.clientEmail}</span>
            </div>
          {:else if col.key === 'totalPrice'}
            <span class="total-txt">€ {row.totalPrice.toFixed(2)}</span>
          {:else if col.key === 'vendorEmail'}
            <div class="vendor-cell">
              <span class="vendor-mail">{row.vendorEmail}</span>
              {#if usersList.find(u => u.uid === row.vendorUid)}
                <span class="vendor-qual">{usersList.find(u => u.uid === row.vendorUid)?.qualification === 'senior' ? 'Senior' : 'Junior'}</span>
              {/if}
            </div>
          {:else if col.key === 'commission'}
            {@const calculation = calculateContractCommission(row)}
            <div class="comm-cell">
              <strong class="comm-total">€ {calculation.totalCommission.toFixed(2)}</strong>
              <span class="comm-sub">({calculation.qualification.toUpperCase()})</span>
            </div>
          {:else if col.key === 'status'}
            <div class="status-cell">
              <span class="badge status-{row.status}">{row.status === 'approved' ? 'Approvato' : 'In attesa'}</span>
              {#if row.hasWarning}
                <span class="badge warning-icon" title="Contratto con prodotti venduti sotto la soglia minima"><Clock size={12} /> Prezzo Basso</span>
              {/if}
            </div>
          {/if}
        {/snippet}

        <div class="table-wrapper">
          <Table
            {columns}
            data={filteredContracts}
            cellSnippet={cell}
            onRowClick={handleSelectContract}
            emptyText="Nessun contratto presente in questo archivio."
          />
        </div>
      {/if}
    </Card>
  </div>
</div>

<style>
  .contracts-page {
    width: 100%;
  }

  .stats-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
    margin-bottom: 30px;
  }

  @media (max-width: 768px) {
    .stats-row {
      grid-template-columns: 1fr;
    }
  }

  .stat-card {
    background: var(--color-white);
    border: 1px solid var(--color-neutral-200);
    border-radius: var(--radius-lg);
    padding: 24px;
    display: flex;
    gap: 20px;
    align-items: center;
    box-shadow: var(--shadow-sm);
  }

  .stat-card.border-success {
    border-left: 5px solid var(--color-success);
  }
  .stat-card.border-warning {
    border-left: 5px solid var(--color-warning);
  }

  .stat-icon {
    width: 48px;
    height: 48px;
    border-radius: var(--radius-md);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .stat-icon.success {
    background: var(--color-success-light);
    color: var(--color-success-text);
  }

  .stat-icon.warning {
    background: var(--color-warning-light);
    color: var(--color-warning-text);
  }

  .stat-body {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .stat-lbl {
    font-size: 12px;
    font-weight: 600;
    color: var(--color-neutral-500);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .stat-val {
    font-size: 22px;
    font-weight: 700;
  }

  .stat-sub {
    font-size: 11px;
    color: var(--color-neutral-400);
  }

  .contracts-shell {
    width: 100%;
  }

  .filter-tabs {
    display: flex;
    gap: 4px;
    background: var(--color-neutral-100);
    padding: 3px;
    border-radius: var(--radius-md);
    border: 1px solid var(--color-neutral-200);
  }

  .tab-btn {
    background: transparent;
    border: none;
    padding: 6px 14px;
    border-radius: var(--radius-sm);
    font-family: inherit;
    font-size: 12px;
    font-weight: 600;
    color: var(--color-neutral-500);
    cursor: pointer;
    transition: all 0.2s;
  }

  .tab-btn.active {
    background: var(--color-white);
    color: var(--color-primary-600);
    box-shadow: var(--shadow-sm);
  }

  .tab-btn.accent-tab {
    color: var(--color-primary-700);
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
    border: 2px solid hsla(var(--brand-h), var(--brand-s), 50%, 0.15);
    border-radius: 50%;
    border-top-color: var(--color-primary-500);
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .date-txt {
    font-size: 13px;
    color: var(--color-neutral-500);
  }

  .client-cell {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .client-name {
    font-size: 14px;
    font-weight: 600;
    color: var(--color-neutral-800);
  }

  .client-mail {
    font-size: 11px;
    color: var(--color-neutral-500);
  }

  .total-txt {
    font-weight: 600;
    color: var(--color-neutral-800);
  }

  .vendor-cell {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .vendor-mail {
    font-size: 13px;
    color: var(--color-neutral-600);
  }

  .vendor-qual {
    font-size: 10px;
    font-weight: 700;
    color: var(--color-primary-600);
    text-transform: uppercase;
  }

  .comm-cell {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .comm-total {
    font-size: 14px;
    color: var(--color-neutral-800);
  }

  .comm-sub {
    font-size: 9px;
    font-weight: 600;
    color: var(--color-neutral-400);
  }

  .status-cell {
    display: flex;
    flex-direction: column;
    gap: 6px;
    align-items: flex-start;
  }

  .badge {
    font-size: 11px;
    font-weight: 600;
    padding: 3px 8px;
    border-radius: var(--radius-sm);
    text-transform: uppercase;
    letter-spacing: 0.02em;
    display: inline-block;
  }

  .badge.status-approved {
    background: var(--color-success-light);
    color: var(--color-success-text);
  }

  .badge.status-pending {
    background: var(--color-neutral-100);
    color: var(--color-neutral-500);
  }

  .badge.warning-icon {
    background: var(--color-error-light);
    color: var(--color-error-text);
    border: 1px solid var(--color-error-border);
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  /* Consultants summary grid */
  .consultants-summary-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 24px;
    padding: 10px 0;
  }

  .consultant-card {
    background: var(--color-neutral-50);
    border: 1px solid var(--color-neutral-200);
    border-radius: var(--radius-md);
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .c-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .c-name {
    font-size: 14px;
    font-weight: 600;
    color: var(--color-neutral-800);
  }

  .badge.qual-senior {
    background: var(--color-primary-100);
    color: var(--color-primary-700);
  }
  .badge.qual-junior {
    background: var(--color-neutral-200);
    color: var(--color-neutral-600);
  }

  .c-email {
    font-size: 12px;
    color: var(--color-neutral-500);
    margin-bottom: 6px;
  }

  .c-metrics {
    display: flex;
    gap: 10px;
    border-top: 1px dashed var(--color-neutral-200);
    padding-top: 10px;
  }

  .c-metric {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .c-metric-val {
    font-size: 14px;
    font-weight: 700;
    color: var(--color-neutral-800);
  }

  .c-metric-lbl {
    font-size: 10px;
    color: var(--color-neutral-400);
    text-transform: uppercase;
    letter-spacing: 0.02em;
  }

  .c-pending {
    font-size: 11px;
    color: var(--color-neutral-500);
    font-weight: 500;
    margin-top: 4px;
  }

  .table-wrapper {
    width: 100%;
    overflow-x: auto;
  }

  .empty-txt {
    font-size: 13px;
    color: var(--color-neutral-400);
    text-align: center;
    display: block;
    margin: 10px 0;
  }

  .icon-accent {
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
