<script lang="ts">
  import { activeRole, auth } from '$lib/auth';
  import { db, doc, setDoc, collection, getDocs, query, where, orderBy } from '$lib/firebase';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { Card, Table, LineChart } from '$lib';
  import { FileText, Award, Clock, DollarSign, Wallet, TrendingUp, Users, ChevronUp, ChevronDown } from '@lucide/svelte';
  import { exportToCSV, exportToExcel, triggerPrint } from '$lib/export-utils';

  let contractsList = $state<any[]>([]);
  let usersList = $state<any[]>([]);
  let loading = $state(true);
  let loadingChart = $state(false);

  // Tab filters: 'all' | 'pending' | 'approved' | 'commissions'
  let activeTab = $state<'all' | 'pending' | 'approved' | 'commissions'>('all');

  // Collapse/Expand state for chart
  let isGraphExpanded = $state(false);
  let selectedPointIdx = $state<number | null>(null);
  let granularity = $state<'settimanale' | 'mensile' | 'annuale'>('mensile');
  let endDateString = $state(new Date().toISOString().split('T')[0]);
  let activeChartTab = $state<'vss' | 'commission'>('vss');

  let chartRawDataList = $state<any[]>([]); // holds contracts fetched for time-period chart

  onMount(() => {
    const unsubscribe = activeRole.subscribe(($activeRole) => {
      if ($activeRole && $activeRole !== 'superadmin' && $activeRole !== 'amministrazione' && $activeRole !== 'commerciale' && $activeRole !== 'direzione') {
        goto('/dashboard');
      }
    });

    if (typeof window !== 'undefined') {
      isGraphExpanded = localStorage.getItem('subpage_graph_expanded') === 'true';
    }

    fetchData();
    return () => unsubscribe();
  });

  async function fetchData() {
    loading = true;
    try {
      const myUid = auth.subscribe(($auth) => {}) ? $auth?.uid : null;

      // 1. Fetch Users (for consultant details and tab)
      const usersQuery = query(collection(db, 'users'));
      const usersSnapshot = await getDocs(usersQuery);
      const uList: typeof usersList = [];
      usersSnapshot.forEach((doc: any) => {
        const data = doc.data();
        uList.push({
          uid: doc.id,
          email: data.original?.email || data.email,
          nome: data.original?.nome || data.nome,
          cognome: data.original?.cognome || data.cognome,
          roles: data.original?.roles || data.roles || [],
          qualification: data.original?.qualification || data.qualification || 'junior',
          derived: data.derived || {}
        });
      });
      usersList = uList;

      // 2. Fetch Contracts based on active tab and role
      const cList: any[] = [];
      const role = $activeRole;
      const uid = $auth?.uid;

      if (role === 'commerciale') {
        // Query primary vendor
        const primaryQuery = query(collection(db, 'contracts'), where('original.vendorUid', '==', uid));
        const primarySnap = await getDocs(primaryQuery);
        primarySnap.forEach((doc: any) => {
          cList.push({ id: doc.id, ...doc.data() });
        });

        // Query secondary vendor
        const secondaryQuery = query(collection(db, 'contracts'), where('original.secondVendorUid', '==', uid));
        const secondarySnap = await getDocs(secondaryQuery);
        secondarySnap.forEach((doc: any) => {
          if (!cList.some(x => x.id === doc.id)) {
            cList.push({ id: doc.id, ...doc.data() });
          }
        });
      } else {
        let q;
        if (activeTab === 'pending') {
          q = query(collection(db, 'contracts'), where('original.status', '==', 'pending'));
        } else if (activeTab === 'approved') {
          q = query(collection(db, 'contracts'), where('original.status', '==', 'approved'));
        } else {
          q = query(collection(db, 'contracts'));
        }
        const snap = await getDocs(q);
        snap.forEach((doc: any) => {
          cList.push({ id: doc.id, ...doc.data() });
        });
      }

      contractsList = cList.sort((a, b) => new Date(b.edits?.createdAt || b.original?.createdAt).getTime() - new Date(a.edits?.createdAt || a.original?.createdAt).getTime());
    } catch (e) {
      console.error('Error fetching contracts data:', e);
    } finally {
      loading = false;
    }
  }

  // Reactively refetch when active tab changes (for admins)
  $effect(() => {
    if (activeTab && $activeRole !== 'commerciale') {
      fetchData();
    }
  });

  // Expandable Trend Chart Data logic
  let chartPeriods = $derived.by(() => {
    const end = new Date(endDateString);
    const periods: Array<{ start: Date; end: Date; label: string }> = [];

    if (granularity === 'settimanale') {
      for (let i = 11; i >= 0; i--) { // 12 weeks
        const pEnd = new Date(end.getTime() - i * 7 * 24 * 60 * 60 * 1000);
        const pStart = new Date(pEnd.getTime() - 7 * 24 * 60 * 60 * 1000 + 1);
        periods.push({ start: pStart, end: pEnd, label: `${pEnd.getDate()}/${pEnd.getMonth() + 1}` });
      }
    } else if (granularity === 'mensile') {
      for (let i = 11; i >= 0; i--) { // 12 months
        const d = new Date(end.getFullYear(), end.getMonth() - i, 1);
        const pStart = new Date(d.getFullYear(), d.getMonth(), 1);
        const pEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
        const monthNames = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];
        periods.push({ start: pStart, end: pEnd, label: `${monthNames[pStart.getMonth()]} ${String(pStart.getFullYear()).slice(2)}` });
      }
    } else {
      for (let i = 4; i >= 0; i--) { // 5 years
        const year = end.getFullYear() - i;
        const pStart = new Date(year, 0, 1);
        const pEnd = new Date(year, 11, 31, 23, 59, 59, 999);
        periods.push({ start: pStart, end: pEnd, label: String(year) });
      }
    }
    return periods;
  });

  async function fetchChartDataPoints() {
    if (!isGraphExpanded || chartPeriods.length === 0) return;
    loadingChart = true;

    try {
      const minDate = chartPeriods[0].start.toISOString();
      const myUid = $auth?.uid;
      const isComm = $activeRole === 'commerciale';

      let q;
      if (isComm) {
        // Fetch commercial specific contracts
        const [primarySnap, secondarySnap] = await Promise.all([
          getDocs(query(collection(db, 'contracts'), where('original.vendorUid', '==', myUid), where('edits.createdAt', '>=', minDate))),
          getDocs(query(collection(db, 'contracts'), where('original.secondVendorUid', '==', myUid), where('edits.createdAt', '>=', minDate)))
        ]);
        const docsList: any[] = [];
        primarySnap.forEach((d: any) => docsList.push({ id: d.id, ...d.data() }));
        secondarySnap.forEach((d: any) => {
          if (!docsList.some(x => x.id === d.id)) docsList.push({ id: d.id, ...d.data() });
        });
        chartRawDataList = docsList;
      } else {
        q = query(collection(db, 'contracts'), where('edits.createdAt', '>=', minDate));
        const snap = await getDocs(q);
        const docsList: any[] = [];
        snap.forEach((d: any) => docsList.push({ id: d.id, ...d.data() }));
        chartRawDataList = docsList;
      }
    } catch (e) {
      console.error("Error loading chart data:", e);
    } finally {
      loadingChart = false;
    }
  }

  $effect(() => {
    if (isGraphExpanded || granularity || endDateString || activeChartTab) {
      fetchChartDataPoints();
    }
  });

  let computedChartPoints = $derived.by(() => {
    const isComm = $activeRole === 'commerciale';
    const myUid = $auth?.uid;

    return chartPeriods.map((p) => {
      const filtered = chartRawDataList.filter(c => {
        const d = new Date(c.edits?.createdAt || c.original?.createdAt);
        return d >= p.start && d <= p.end;
      });

      if (activeChartTab === 'vss') {
        return filtered.reduce((sum, c) => {
          const orig = c.original || {};
          let price = orig.totalPrice || 0;
          if (isComm) {
            if (orig.vendorUid === myUid) {
              return sum + price * (100 - (orig.secondVendorShare || 0)) / 100;
            } else if (orig.secondVendorUid === myUid) {
              return sum + price * (orig.secondVendorShare || 0) / 100;
            }
          }
          return sum + price;
        }, 0);
      } else {
        // Provvigioni
        return filtered.reduce((sum, c) => {
          const deriv = c.derived || {};
          const orig = c.original || {};
          if (isComm) {
            if (orig.vendorUid === myUid) {
              return sum + (deriv.commissionPrimary || 0);
            } else if (orig.secondVendorUid === myUid) {
              return sum + (deriv.commissionSecondary || 0);
            }
          }
          return sum + (deriv.commissionTotal || 0);
        }, 0);
      }
    });
  });

  function toggleGraph() {
    isGraphExpanded = !isGraphExpanded;
    if (typeof window !== 'undefined') {
      localStorage.setItem('subpage_graph_expanded', String(isGraphExpanded));
    }
  }

  // Filtered list shown in Svelte table
  let filteredContracts = $derived.by(() => {
    let result = contractsList;

    if (selectedPointIdx !== null && selectedPointIdx >= 0 && selectedPointIdx < chartPeriods.length) {
      const period = chartPeriods[selectedPointIdx];
      result = result.filter(c => {
        const d = new Date(c.edits?.createdAt || c.original?.createdAt);
        return d >= period.start && d <= period.end;
      });
    }

    return result.map(c => ({
      id: c.id,
      createdAt: c.edits?.createdAt || c.original?.createdAt,
      clientName: c.original?.clientName,
      clientEmail: c.original?.clientEmail,
      totalPrice: c.original?.totalPrice,
      vendorEmail: c.original?.vendorEmail,
      vendorUid: c.original?.vendorUid,
      secondVendorUid: c.original?.secondVendorUid,
      secondVendorEmail: c.original?.secondVendorEmail,
      secondVendorShare: c.original?.secondVendorShare,
      status: c.original?.status,
      hasWarning: c.original?.hasWarning,
      derived: c.derived || {}
    }));
  });

  // Expected/Earned totals for Commercial (read from user document directly)
  let commercialStats = $derived.by(() => {
    const myUser = usersList.find(u => u.uid === $auth?.uid);
    const uDerived = myUser?.derived || {};
    return {
      sospese: uDerived.totalCommissionPending || 0,
      maturate: uDerived.totalCommissionEarned || 0,
      totalVenduto: (uDerived.totalPendingSales || 0) + (uDerived.totalApprovedSales || 0)
    };
  });

  // Admin summary per consultant (using pre-calculated derived fields)
  let adminConsultantsSummary = $derived.by(() => {
    return usersList
      .filter(u => u.roles.includes('commerciale'))
      .map(u => ({
        name: `${u.nome || ''} ${u.cognome || ''}`.trim() || u.email,
        email: u.email,
        qualification: u.qualification || 'junior',
        approvedSales: u.derived?.totalApprovedSales || 0,
        totalCommission: u.derived?.totalCommissionEarned || 0,
        pendingSales: u.derived?.totalPendingSales || 0
      }))
      .filter(s => s.approvedSales > 0 || s.pendingSales > 0 || s.totalCommission > 0);
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
          <span class="stat-val">€ {commercialStats.maturate.toFixed(2)}</span>
          <span class="stat-sub">Fatturato incassato: € {commercialStats.totalVenduto.toFixed(2)}</span>
        </div>
      </div>

      <div class="stat-card border-warning">
        <div class="stat-icon warning">
          <Clock size={22} />
        </div>
        <div class="stat-body">
          <span class="stat-lbl">Provvigioni Sospese (In Attesa)</span>
          <span class="stat-val">€ {commercialStats.sospese.toFixed(2)}</span>
          <span class="stat-sub">Visualizzato non appena l'amministrazione approva l'incasso.</span>
        </div>
      </div>
    </div>
  {/if}

  <!-- EXPANDABLE TREND CHART -->
  <div class="subpage-chart-control">
    <button onclick={toggleGraph} class="toggle-chart-btn">
      <TrendingUp size={16} /> 
      {isGraphExpanded ? 'Nascondi Grafico Andamento' : 'Mostra Grafico Andamento'}
      {#if isGraphExpanded}
        <ChevronUp size={14} />
      {:else}
        <ChevronDown size={14} />
      {/if}
    </button>
  </div>

  {#if isGraphExpanded}
    <div class="subpage-chart-card animate-fade-in">
      <Card title="Andamento Contratti e Provvigioni" description="Clicca su un punto del grafico per filtrare l'elenco dei contratti in base al periodo selezionato.">
        {#snippet icon()}
          <TrendingUp size={20} class="icon-accent" />
        {/snippet}

        {#snippet headerSnippet()}
          <div class="chart-controls-sub">
            <!-- Period Granularity -->
            <select bind:value={granularity} class="sub-chart-select">
              <option value="settimanale">Settimanale (12w)</option>
              <option value="mensile">Mensile (12m)</option>
              <option value="annuale">Annuale (5y)</option>
            </select>

            <!-- End Date Picker -->
            <input type="date" bind:value={endDateString} class="sub-chart-date-picker" />

            <!-- Metrics Switcher -->
            <div class="metric-switch">
              <button class="m-btn" class:active={activeChartTab === 'vss'} onclick={() => { activeChartTab = 'vss'; selectedPointIdx = null; }}>Valore Venduto (VSS)</button>
              <button class="m-btn" class:active={activeChartTab === 'commission'} onclick={() => { activeChartTab = 'commission'; selectedPointIdx = null; }}>Provvigioni</button>
            </div>
          </div>
        {/snippet}

        {#if loadingChart}
          <div class="loader-box" style="border: none; padding: 20px;">
            <span class="spinner"></span>
            Caricamento grafico andamento...
          </div>
        {:else}
          <LineChart
            data={computedChartPoints}
            labels={chartPeriods.map(p => p.label)}
            selectedIdx={selectedPointIdx}
            onSelect={(idx) => selectedPointIdx = idx}
            isCurrency={true}
          />
        {/if}
      </Card>
    </div>
  {/if}

  <div class="contracts-shell">
    <Card title="Database Contratti Commerciali" description="Fai clic su un contratto per vederne i dettagli o approvare la transazione.">
      {#snippet icon()}
        <FileText size={20} class="icon-accent" />
      {/snippet}

      {#snippet headerSnippet()}
        <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; flex-wrap: wrap; gap: 12px;">
          <div class="filter-tabs" style="margin: 0;">
            <button class="tab-btn" class:active={activeTab === 'all'} onclick={() => activeTab = 'all'}>Tutti</button>
            <button class="tab-btn" class:active={activeTab === 'pending'} onclick={() => activeTab = 'pending'}>In Attesa</button>
            <button class="tab-btn" class:active={activeTab === 'approved'} onclick={() => activeTab = 'approved'}>Approvati</button>
            {#if $activeRole !== 'commerciale'}
              <button class="tab-btn accent-tab" class:active={activeTab === 'commissions'} onclick={() => activeTab = 'commissions'}>Provvigioni Consulenti</button>
            {/if}
          </div>

          <div style="display: flex; gap: 8px;">
            <button onclick={() => exportToCSV(filteredContracts, [
              { key: 'id', header: 'ID Contratto' },
              { key: 'createdAt', header: 'Data Creazione' },
              { key: 'clientName', header: 'Cliente' },
              { key: 'vendorEmail', header: 'Commerciale' },
              { key: 'totalPrice', header: 'Valore Lordo' },
              { key: 'status', header: 'Stato' }
            ], 'gestoray_contratti')} class="back-link-btn" style="padding: 6px 10px; font-size: 12px; height: 34px;" title="Esporta in formato CSV">
              CSV
            </button>
            <button onclick={() => exportToExcel(filteredContracts, [
              { key: 'id', header: 'ID Contratto' },
              { key: 'createdAt', header: 'Data Creazione' },
              { key: 'clientName', header: 'Cliente' },
              { key: 'vendorEmail', header: 'Commerciale' },
              { key: 'totalPrice', header: 'Valore Lordo' },
              { key: 'status', header: 'Stato' }
            ], 'gestoray_contratti')} class="back-link-btn" style="padding: 6px 10px; font-size: 12px; height: 34px;" title="Esporta in Excel (XLS)">
              Excel
            </button>
            <button onclick={triggerPrint} class="back-link-btn" style="padding: 6px 10px; font-size: 12px; height: 34px;" title="Stampa l'elenco / Salva PDF">
              Stampa / PDF
            </button>
          </div>
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
            {@const deriv = row.derived || {}}
            {@const isComm = $activeRole === 'commerciale'}
            {@const myUid = $auth?.uid}
            {@const myComm = (isComm && row.secondVendorUid === myUid) ? (deriv.commissionSecondary || 0) : (deriv.commissionPrimary || 0)}
            <div class="comm-cell">
              <strong class="comm-total">€ {myComm.toFixed(2)}</strong>
              <span class="comm-sub">
                {#if isComm && row.secondVendorUid === myUid}
                  (CO-SELLING {row.secondVendorShare}%)
                {:else}
                  (TOT: €{(deriv.commissionTotal || 0).toFixed(2)})
                {/if}
              </span>
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
    border-left: 5px solid var(--color-secondary-500);
  }

  .stat-icon {
    width: 48px;
    height: 48px;
    border-radius: var(--radius-md);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    background: var(--color-secondary-100);
    color: var(--color-secondary-700);
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
    border: 2px solid hsla(var(--brand-h), var(--brand-s), var(--brand-l), 0.15);
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

  .subpage-chart-control {
    margin-bottom: 16px;
    display: flex;
    justify-content: flex-end;
  }

  .toggle-chart-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: var(--color-white);
    border: 1px solid var(--color-neutral-300);
    color: var(--color-neutral-600);
    padding: 8px 16px;
    border-radius: var(--radius-sm);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .toggle-chart-btn:hover {
    background: var(--color-neutral-100);
    color: var(--color-neutral-800);
  }

  .subpage-chart-card {
    margin-bottom: 24px;
  }

  .chart-controls-sub {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }

  .sub-chart-select, .sub-chart-date-picker {
    height: 36px;
    padding: 0 8px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--color-neutral-300);
    font-family: inherit;
    font-size: 12px;
    background: var(--color-white);
  }

  .metric-switch {
    display: flex;
    gap: 4px;
    background: var(--color-neutral-100);
    padding: 2px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--color-neutral-200);
  }

  .m-btn {
    border: none;
    background: transparent;
    padding: 6px 12px;
    font-size: 11px;
    font-weight: 600;
    color: var(--color-neutral-500);
    border-radius: var(--radius-xs);
    cursor: pointer;
    transition: all 0.2s;
  }

  .m-btn.active {
    background: var(--color-white);
    color: var(--color-primary-600);
    box-shadow: var(--shadow-sm);
  }
</style>
