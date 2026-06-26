<script lang="ts">
  import { activeRole, auth } from '$lib/auth';
  import { db, doc, setDoc, collection, getDocs } from '$lib/firebase';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { Card, Table } from '$lib';
  import { FileText, Award, Clock, DollarSign, Wallet, TrendingUp, Users, ChevronUp, ChevronDown } from '@lucide/svelte';

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

  let contractsList = $state<Array<{ id: string, clientId: string, clientName: string, clientEmail: string, vendorUid: string, vendorEmail: string, totalPrice: number, products: any[], status: string, hasWarning: boolean, createdAt: string, approvedAt?: string, secondVendorUid?: string, secondVendorEmail?: string, secondVendorShare?: number }>>([]);
  let usersList = $state<Array<{ uid: string, email: string, nome?: string, cognome?: string, qualification?: 'junior' | 'senior' }>>([]);
  let loading = $state(true);

  // Tab filters: 'all' | 'pending' | 'approved' | 'commissions'
  let activeTab = $state<'all' | 'pending' | 'approved' | 'commissions'>('all');

  // Collapse/Expand state for chart
  let isGraphExpanded = $state(false);
  let selectedPointIdx = $state<number | null>(null);
  let granularity = $state<'settimanale' | 'mensile' | 'annuale'>('mensile');
  let endDateString = $state(new Date().toISOString().split('T')[0]);
  let activeChartTab = $state<'vss' | 'commission'>('vss');

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
          approvedAt: data.approvedAt,
          secondVendorUid: data.secondVendorUid,
          secondVendorEmail: data.secondVendorEmail,
          secondVendorShare: data.secondVendorShare
        });
      });
      
      contractsList = cList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch (e) {
      console.error('Error fetching contracts data:', e);
    } finally {
      loading = false;
    }
  }

  // Calculate commission taking co-selling splits into account
  function calculateContractCommission(contract: typeof contractsList[0]) {
    const vendor = usersList.find(u => u.uid === contract.vendorUid);
    const qualification = vendor?.qualification || 'junior';

    let totalCommission = 0;
    contract.products.forEach(item => {
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

      totalCommission += itemTotal * (commPct / 100);
    });

    const secondShare = contract.secondVendorShare || 0;
    const primaryCommission = totalCommission * (100 - secondShare) / 100;
    const secondaryCommission = totalCommission * secondShare / 100;

    return {
      qualification,
      totalCommission,
      primaryCommission,
      secondaryCommission
    };
  }

  function toggleGraph() {
    isGraphExpanded = !isGraphExpanded;
    if (typeof window !== 'undefined') {
      localStorage.setItem('subpage_graph_expanded', String(isGraphExpanded));
    }
  }

  // Generate date ranges backwards from endDateString
  let chartPeriods = $derived.by(() => {
    const end = new Date(endDateString);
    const periods: Array<{ start: Date, end: Date, label: string }> = [];

    if (granularity === 'settimanale') {
      for (let i = 51; i >= 0; i--) {
        const pEnd = new Date(end.getTime() - i * 7 * 24 * 60 * 60 * 1000);
        const pStart = new Date(pEnd.getTime() - 7 * 24 * 60 * 60 * 1000 + 1);
        periods.push({ start: pStart, end: pEnd, label: `${pEnd.getDate()}/${pEnd.getMonth() + 1}` });
      }
    } else if (granularity === 'mensile') {
      for (let i = 23; i >= 0; i--) {
        const d = new Date(end.getFullYear(), end.getMonth() - i, 1);
        const pStart = new Date(d.getFullYear(), d.getMonth(), 1);
        const pEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
        const monthNames = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];
        periods.push({ start: pStart, end: pEnd, label: `${monthNames[pStart.getMonth()]} ${String(pStart.getFullYear()).slice(2)}` });
      }
    } else {
      for (let i = 9; i >= 0; i--) {
        const year = end.getFullYear() - i;
        const pStart = new Date(year, 0, 1);
        const pEnd = new Date(year, 11, 31, 23, 59, 59, 999);
        periods.push({ start: pStart, end: pEnd, label: String(year) });
      }
    }
    return periods;
  });

  let computedChartPoints = $derived.by(() => {
    const isComm = $activeRole === 'commerciale';
    const myUid = $auth?.uid;

    return chartPeriods.map((p) => {
      let dbValue = 0;

      const filtered = contractsList.filter(c => {
        const d = new Date(c.createdAt);
        const inPeriod = d >= p.start && d <= p.end;
        if (!inPeriod) return false;
        const belongs = !isComm || c.vendorUid === myUid || c.secondVendorUid === myUid;
        return belongs;
      });

      if (activeChartTab === 'vss') {
        dbValue = filtered.reduce((sum, c) => {
          if (isComm) {
            if (c.vendorUid === myUid) {
              return sum + c.totalPrice * (100 - (c.secondVendorShare || 0)) / 100;
            } else if (c.secondVendorUid === myUid) {
              return sum + c.totalPrice * (c.secondVendorShare || 0) / 100;
            }
          }
          return sum + c.totalPrice;
        }, 0);
      } else {
        dbValue = filtered.reduce((sum, c) => {
          const commInfo = calculateContractCommission(c);
          if (isComm) {
            if (c.vendorUid === myUid) {
              return sum + commInfo.primaryCommission;
            } else if (c.secondVendorUid === myUid) {
              return sum + commInfo.secondaryCommission;
            }
          }
          return sum + commInfo.totalCommission;
        }, 0);
      }

      return dbValue;
    });
  });

  let svgPointsData = $derived.by(() => {
    const data = computedChartPoints;
    const maxVal = Math.max(...data, activeChartTab === 'commission' ? 100 : 1000);
    const count = data.length;

    const points = data.map((val, idx) => {
      const x = 40 + (idx / (count - 1)) * 400;
      const y = 120 - (val / maxVal) * 100;
      return { x, y, val };
    });

    const pathD = points.reduce((acc, pt, idx) => {
      return acc + (idx === 0 ? `M ${pt.x} ${pt.y}` : ` L ${pt.x} ${pt.y}`);
    }, '');

    const areaD = pathD + ` L ${points[points.length - 1].x} 120 L ${points[0].x} 120 Z`;

    return { points, pathD, areaD, maxVal };
  });

  // Filtered list
  let filteredContracts = $derived.by(() => {
    let result = contractsList.filter(c => {
      if ($activeRole === 'commerciale' && c.vendorUid !== $auth?.uid && c.secondVendorUid !== $auth?.uid) {
        return false;
      }
      
      if (activeTab === 'pending' && c.status !== 'pending') return false;
      if (activeTab === 'approved' && c.status !== 'approved') return false;
      
      return true;
    });

    if (selectedPointIdx !== null && selectedPointIdx >= 0 && selectedPointIdx < chartPeriods.length) {
      const period = chartPeriods[selectedPointIdx];
      result = result.filter(c => {
        const d = new Date(c.createdAt);
        return d >= period.start && d <= period.end;
      });
    }

    return result;
  });

  // Expected/Earned totals for Commercial
  let commercialStats = $derived.by(() => {
    let sospese = 0;
    let maturate = 0;
    let totalVenduto = 0;

    contractsList.forEach(c => {
      const belongs = c.vendorUid === $auth?.uid || c.secondVendorUid === $auth?.uid;
      if (belongs) {
        const commInfo = calculateContractCommission(c);
        let comm = 0;
        if (c.vendorUid === $auth?.uid) {
          comm = commInfo.primaryCommission;
          totalVenduto += c.totalPrice * (100 - (c.secondVendorShare || 0)) / 100;
        } else {
          comm = commInfo.secondaryCommission;
          totalVenduto += c.totalPrice * (c.secondVendorShare || 0) / 100;
        }

        if (c.status === 'approved') {
          maturate += comm;
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
    
    usersList.forEach(u => {
      summary[u.uid] = {
        name: `${u.nome || ''} ${u.cognome || ''}`.trim() || u.email,
        email: u.email,
        qualification: u.qualification || 'junior',
        approvedSales: 0,
        totalCommission: 0,
        pendingSales: 0
      };
    });

    contractsList.forEach(c => {
      const commInfo = calculateContractCommission(c);
      
      if (summary[c.vendorUid]) {
        if (c.status === 'approved') {
          summary[c.vendorUid].approvedSales += c.totalPrice * (100 - (c.secondVendorShare || 0)) / 100;
          summary[c.vendorUid].totalCommission += commInfo.primaryCommission;
        } else {
          summary[c.vendorUid].pendingSales += c.totalPrice * (100 - (c.secondVendorShare || 0)) / 100;
        }
      }

      if (c.secondVendorUid && summary[c.secondVendorUid]) {
        if (c.status === 'approved') {
          summary[c.secondVendorUid].approvedSales += c.totalPrice * (c.secondVendorShare || 0) / 100;
          summary[c.secondVendorUid].totalCommission += commInfo.secondaryCommission;
        } else {
          summary[c.secondVendorUid].pendingSales += c.totalPrice * (c.secondVendorShare || 0) / 100;
        }
      }
    });

    return Object.values(summary).filter(s => s.approvedSales > 0 || s.pendingSales > 0 || s.totalCommission > 0);
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
              <option value="settimanale">Settimanale (52w)</option>
              <option value="mensile">Mensile (24m)</option>
              <option value="annuale">Annuale (10y)</option>
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

        <div class="svg-chart-container-sub">
          <svg class="sub-svg" viewBox="0 0 480 150">
            <!-- Grid Lines -->
            <line x1="40" y1="20" x2="440" y2="20" class="grid-line" />
            <line x1="40" y1="70" x2="440" y2="70" class="grid-line" />
            <line x1="40" y1="120" x2="440" y2="120" class="grid-line" />

            <!-- Area -->
            <path d={svgPointsData.areaD} class="chart-area-fill" fill="rgba(79, 70, 229, 0.12)" />

            <!-- Path Line -->
            <path d={svgPointsData.pathD} class="chart-line-stroke" />

            <!-- Dots -->
            {#each svgPointsData.points as pt, idx}
              <circle
                cx={pt.x}
                cy={pt.y}
                r={selectedPointIdx === idx ? "7" : "4"}
                class="chart-point-dot"
                class:selected={selectedPointIdx === idx}
                role="button"
                tabindex="0"
                aria-label="Seleziona punto grafico"
                onclick={() => {
                  if (selectedPointIdx === idx) {
                    selectedPointIdx = null;
                  } else {
                    selectedPointIdx = idx;
                  }
                }}
                onkeydown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    if (selectedPointIdx === idx) {
                      selectedPointIdx = null;
                    } else {
                      selectedPointIdx = idx;
                    }
                  }
                }}
              />
            {/each}
          </svg>
        </div>

        <div class="chart-y-axis-lbls">
          <span>Massimo: €{svgPointsData.maxVal.toLocaleString('it-IT')}</span>
          {#if selectedPointIdx !== null}
            <span class="selected-period-banner">
              Filtro attivo: <strong>{chartPeriods[selectedPointIdx].label}</strong> (Valore: €{computedChartPoints[selectedPointIdx].toLocaleString('it-IT')})
              <button onclick={() => selectedPointIdx = null} class="clear-filter-btn">Azzera filtro</button>
            </span>
          {/if}
          <span>Minimo: 0</span>
        </div>
      </Card>
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

  /* Expandable trend chart styles */
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

  .svg-chart-container-sub {
    background: var(--color-white);
    padding: 16px;
    border-radius: var(--radius-md);
    border: 1px solid var(--color-neutral-200);
    margin-top: 12px;
  }

  .sub-svg {
    width: 100%;
    height: 120px;
    overflow: visible;
  }

  .grid-line {
    stroke: var(--color-neutral-200);
    stroke-width: 1;
    stroke-dasharray: 4 4;
  }

  .chart-line-stroke {
    stroke: var(--color-primary-500);
    stroke-width: 2.5;
    fill: none;
  }

  .chart-point-dot {
    fill: var(--color-white);
    stroke: var(--color-primary-500);
    stroke-width: 2;
    cursor: pointer;
    transition: all 0.2s;
  }

  .chart-point-dot:hover, .chart-point-dot.selected {
    fill: var(--color-primary-500);
    r: 7px;
  }

  .chart-y-axis-lbls {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    color: var(--color-neutral-500);
    margin-top: 8px;
    align-items: center;
  }

  .selected-period-banner {
    background: var(--color-primary-50);
    color: var(--color-primary-700);
    padding: 4px 10px;
    border-radius: var(--radius-sm);
    font-weight: 500;
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }

  .clear-filter-btn {
    background: var(--color-white);
    border: 1px solid var(--color-primary-200);
    color: var(--color-primary-600);
    font-size: 10px;
    font-weight: 600;
    padding: 2px 6px;
    border-radius: var(--radius-xs);
    cursor: pointer;
  }
</style>
