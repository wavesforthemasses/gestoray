<script lang="ts">
  import { auth, activeRole } from '$lib/auth';
  import { auth as clientAuth } from '$lib/firebase';
  import { db, collection, getDocs } from '$lib/firebase';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { Card } from '$lib';
  import { 
    Zap, Shield, Briefcase, TrendingUp, Users, DollarSign, 
    Wallet, FileText, Phone, Calendar, CheckCircle 
  } from '@lucide/svelte';

  let clientsList = $state<any[]>([]);
  let contractsList = $state<any[]>([]);
  let paymentsList = $state<any[]>([]);
  let usersList = $state<any[]>([]);
  let activitiesList = $state<any[]>([]);
  let loadingData = $state(true);

  // Unified chart active tab
  let activeChartTab = $state<'vss' | 'gi' | 'ncf'>('vss');

  async function fetchDashboardData() {
    loadingData = true;
    try {
      const clientsSnap = await getDocs(collection(db, 'clients'));
      const cList: any[] = [];
      clientsSnap.forEach((doc: any) => {
        cList.push({ id: doc.id, ...doc.data() });
      });
      clientsList = cList;

      const contractsSnap = await getDocs(collection(db, 'contracts'));
      const coList: any[] = [];
      contractsSnap.forEach((doc: any) => {
        coList.push({ id: doc.id, ...doc.data() });
      });
      contractsList = coList;

      const paymentsSnap = await getDocs(collection(db, 'payments'));
      const pList: any[] = [];
      paymentsSnap.forEach((doc: any) => {
        pList.push({ id: doc.id, ...doc.data() });
      });
      paymentsList = pList;

      const usersSnap = await getDocs(collection(db, 'users'));
      const uList: any[] = [];
      usersSnap.forEach((doc: any) => {
        uList.push({ uid: doc.id, ...doc.data() });
      });
      usersList = uList;

      const activitiesSnap = await getDocs(collection(db, 'activities'));
      const actList: any[] = [];
      activitiesSnap.forEach((doc: any) => {
        actList.push({ id: doc.id, ...doc.data() });
      });
      activitiesList = actList;
    } catch (e) {
      console.error(e);
    } finally {
      loadingData = false;
    }
  }

  onMount(() => {
    const unsubscribe = auth.subscribe(($auth) => {
      if (!$auth) {
        setTimeout(() => {
          if (!clientAuth.currentUser) {
            goto('/login');
          }
        }, 800);
      }
    });

    fetchDashboardData();
    return () => unsubscribe();
  });

  // Calculate commission percentage according to qualification formula
  function calculateCommissionPct(item: any, qualification: string) {
    const list = item.listPrice;
    const min = item.minPrice;
    const sold = item.priceSold;
    
    let ratio = 1;
    if (list > min) {
      ratio = (sold - min) / (list - min);
      if (ratio < 0) ratio = 0;
      if (ratio > 1) ratio = 1;
    }
    
    if (qualification === 'senior') {
      return 5.0 + (ratio * 5.0); // 5% to 10%
    } else {
      return 2.5 + (ratio * 5.0); // 2.5% to 7.5%
    }
  }

  // Calculate stats for commercials
  let commercialStats = $derived.by(() => {
    const myContracts = contractsList.filter(c => c.vendorUid === $auth?.uid);
    const approvedContracts = myContracts.filter(c => c.status === 'approved');
    const pendingContracts = myContracts.filter(c => c.status === 'pending');

    const totalSold = myContracts.reduce((sum, c) => sum + c.totalPrice, 0);
    const approvedSold = approvedContracts.reduce((sum, c) => sum + c.totalPrice, 0);

    // Calculate commissions
    const vendor = usersList.find(u => u.uid === $auth?.uid);
    const qualification = vendor?.qualification || 'junior';

    let maturate = 0; // approved
    let sospese = 0; // pending

    myContracts.forEach(c => {
      let comm = 0;
      c.products.forEach((p: any) => {
        const pct = calculateCommissionPct(p, qualification);
        comm += (p.priceSold * p.quantity) * (pct / 100);
      });

      if (c.status === 'approved') {
        maturate += comm;
      } else {
        sospese += comm;
      }
    });

    return {
      count: myContracts.length,
      totalSold,
      approvedSold,
      maturate,
      sospese
    };
  });

  // Global stats for management/admin
  let globalStats = $derived.by(() => {
    const approvedContracts = contractsList.filter(c => c.status === 'approved');
    const totalVenduto = approvedContracts.reduce((sum, c) => sum + c.totalPrice, 0);
    const totalIncassato = paymentsList.reduce((sum, p) => sum + p.amount, 0);
    const totalClienti = clientsList.length;

    return {
      totalVenduto,
      totalIncassato,
      totalClienti,
      totalContratti: contractsList.length,
      pendingContratti: contractsList.filter(c => c.status === 'pending').length
    };
  });

  // Activity KPIs derived
  let activityKPIs = $derived.by(() => {
    const isComm = $activeRole === 'commerciale';
    const list = isComm 
      ? activitiesList.filter(a => a.loggedBy === $auth?.uid)
      : activitiesList;

    const calls = list.filter(a => a.type === 'Telefonata').length;
    const meetings = list.filter(a => a.type === 'Incontro').length;
    const appointments = list.filter(a => a.type === 'Appuntamento').length;

    return { calls, meetings, appointments };
  });

  // Mock month distributions to feed graphics
  const months = ['Mar', 'Apr', 'Mag', 'Giu'];
  
  let graphData = $derived.by(() => {
    const isComm = $activeRole === 'commerciale';
    
    // Filter lists
    const cList = isComm ? clientsList.filter(c => c.createdBy === $auth?.uid) : clientsList;
    const coList = isComm ? contractsList.filter(c => c.vendorUid === $auth?.uid) : contractsList;
    const pList = isComm 
      ? paymentsList.filter(p => coList.some(c => c.id === p.contractId))
      : paymentsList;

    // 1. New Customers Trend (NCF)
    const ncfBase = isComm ? [1, 2, 2, 0] : [2, 4, 3, 0];
    ncfBase[3] = cList.length; // Live today's count
    const maxNcf = Math.max(...ncfBase, 5);

    // 2. Sales Trend (VSS)
    const vssBase = isComm ? [1000, 1800, 900, 0] : [2400, 3800, 1900, 0];
    vssBase[3] = coList.reduce((sum, c) => sum + c.totalPrice, 0);
    const maxVss = Math.max(...vssBase, 2000);

    // 3. Collections Trend (GI)
    const giBase = isComm ? [800, 1500, 1000, 0] : [1800, 3100, 2200, 0];
    giBase[3] = pList.reduce((sum, p) => sum + p.amount, 0);
    const maxGi = Math.max(...giBase, 2000);

    return {
      ncf: ncfBase,
      maxNcf,
      vss: vssBase,
      maxVss,
      gi: giBase,
      maxGi
    };
  });

  // Derived properties of the selected tab for unified SVG
  let unifiedChartDetails = $derived.by(() => {
    let data: number[] = [];
    let max = 1000;
    let label = '';
    let stopColor = 'var(--color-primary-500)';
    let areaColor = 'rgba(79, 70, 229, 0.2)';
    let yLabels: string[] = [];
    let dotClass = 'primary';
    let lineClass = 'primary-line';

    if (activeChartTab === 'vss') {
      data = graphData.vss;
      max = Math.max(...data, 1000);
      label = 'Valore Venduto (€)';
      stopColor = 'var(--color-success)';
      areaColor = 'rgba(16, 185, 129, 0.25)';
      dotClass = 'success';
      lineClass = 'success-line';
      yLabels = [`€ ${max.toFixed(0)}`, `€ ${(max / 2).toFixed(0)}`, '€ 0'];
    } else if (activeChartTab === 'gi') {
      data = graphData.gi;
      max = Math.max(...data, 1000);
      label = 'Valore Incassato (€)';
      stopColor = 'var(--color-warning)';
      areaColor = 'rgba(245, 158, 11, 0.2)';
      dotClass = 'warning';
      lineClass = 'warning-line';
      yLabels = [`€ ${max.toFixed(0)}`, `€ ${(max / 2).toFixed(0)}`, '€ 0'];
    } else {
      data = graphData.ncf;
      max = Math.max(...data, 5);
      label = 'Nuovi Clienti';
      stopColor = 'var(--color-primary-500)';
      areaColor = 'rgba(79, 70, 229, 0.25)';
      dotClass = 'primary';
      lineClass = 'primary-line';
      yLabels = [`${max}`, `${(max / 2).toFixed(0)}`, '0'];
    }

    // Points calculation: y range 30 (for max) to 140 (for 0)
    // x range 80 to 410 (interval 110)
    const points = data.map((val, idx) => {
      const x = 80 + idx * 110;
      const y = 140 - (val / max) * 110;
      return { x, y, val };
    });

    const pathD = `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y} L ${points[2].x} ${points[2].y} L ${points[3].x} ${points[3].y}`;
    const areaD = `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y} L ${points[2].x} ${points[2].y} L ${points[3].x} ${points[3].y} L 410 140 L 80 140 Z`;

    return {
      points,
      pathD,
      areaD,
      label,
      stopColor,
      areaColor,
      yLabels,
      dotClass,
      lineClass
    };
  });
</script>

<svelte:head>
  <title>Dashboard | Gestoray</title>
</svelte:head>

{#if $auth}
  <div class="dashboard-panoramica animate-fade-in">
    <!-- Top Welcome Banner -->
    <Card
      title="Benvenuto nel tuo pannello di controllo"
      description="Qui puoi visualizzare le informazioni e i trend grafici abilitati per i tuoi ruoli aziendali."
      variant="glass"
      class="welcome-banner"
      style="--card-padding: 30px 40px;"
    />

    {#if loadingData}
      <div class="loader-box">
        <span class="spinner"></span>
        Aggiornamento dati analitici...
      </div>
    {:else}
      <!-- 1. Financial KPIs Block -->
      {#if $activeRole === 'commerciale'}
        <section class="kpi-deck">
          <div class="kpi-tile border-primary">
            <div class="kpi-icon primary"><Briefcase size={20} /></div>
            <div class="kpi-text">
              <span class="kpi-lbl">Contratti Chiusi</span>
              <span class="kpi-val">{commercialStats.count}</span>
              <span class="kpi-sub">Totale ordinato: € {commercialStats.totalSold.toFixed(2)}</span>
            </div>
          </div>

          <div class="kpi-tile border-success">
            <div class="kpi-icon success"><DollarSign size={20} /></div>
            <div class="kpi-text">
              <span class="kpi-lbl">Provvigioni Maturate</span>
              <span class="kpi-val text-success">€ {commercialStats.maturate.toFixed(2)}</span>
              <span class="kpi-sub">Fatturato incassato: € {commercialStats.approvedSold.toFixed(2)}</span>
            </div>
          </div>

          <div class="kpi-tile border-warning">
            <div class="kpi-icon warning"><Wallet size={20} /></div>
            <div class="kpi-text">
              <span class="kpi-lbl">Provvigioni In Sospeso</span>
              <span class="kpi-val text-warning">€ {commercialStats.sospese.toFixed(2)}</span>
              <span class="kpi-sub">In attesa di approvazione amministrativa</span>
            </div>
          </div>
        </section>
      {:else}
        <section class="kpi-deck">
          <div class="kpi-tile border-primary">
            <div class="kpi-icon primary"><Users size={20} /></div>
            <div class="kpi-text">
              <span class="kpi-lbl">Clienti Anagrafati (NCF)</span>
              <span class="kpi-val">{globalStats.totalClienti}</span>
              <span class="kpi-sub">Totalità lead database</span>
            </div>
          </div>

          <div class="kpi-tile border-success">
            <div class="kpi-icon success"><DollarSign size={20} /></div>
            <div class="kpi-text">
              <span class="kpi-lbl">Valore Ordinato (VSS)</span>
              <span class="kpi-val text-success">€ {globalStats.totalVenduto.toFixed(2)}</span>
              <span class="kpi-sub">Contratti approvati: {globalStats.totalContratti - globalStats.pendingContratti}</span>
            </div>
          </div>

          <div class="kpi-tile border-warning">
            <div class="kpi-icon warning"><Wallet size={20} /></div>
            <div class="kpi-text">
              <span class="kpi-lbl">Cassa Incassata (GI)</span>
              <span class="kpi-val text-warning">€ {globalStats.totalIncassato.toFixed(2)}</span>
              <span class="kpi-sub">In attesa di incasso: {globalStats.pendingContratti} contratti</span>
            </div>
          </div>
        </section>
      {/if}

      <!-- 2. Commercial Activities KPIs Section (Widescreen Cards) -->
      <section class="activity-section-header">
        <h4>Attività Commerciali Registrate</h4>
        <span class="sub-desc">Contatori delle interazioni e degli appuntamenti effettuati con i lead.</span>
      </section>

      <section class="kpi-deck activity-deck">
        <div class="kpi-tile border-info">
          <div class="kpi-icon info"><Phone size={20} /></div>
          <div class="kpi-text">
            <span class="kpi-lbl">Telefonate Loggate</span>
            <span class="kpi-val">{activityKPIs.calls}</span>
            <span class="kpi-sub">Chiamate e feedback rapidi</span>
          </div>
        </div>

        <div class="kpi-tile border-teal">
          <div class="kpi-icon teal"><Users size={20} /></div>
          <div class="kpi-text">
            <span class="kpi-lbl">Incontri Svolti</span>
            <span class="kpi-val">{activityKPIs.meetings}</span>
            <span class="kpi-sub">Riunioni e incontri conoscitivi</span>
          </div>
        </div>

        <div class="kpi-tile border-indigo">
          <div class="kpi-icon indigo"><Calendar size={20} /></div>
          <div class="kpi-text">
            <span class="kpi-lbl">Appuntamenti Presi</span>
            <span class="kpi-val">{activityKPIs.appointments}</span>
            <span class="kpi-sub">Demo commerciali pianificate</span>
          </div>
        </div>
      </section>

      <!-- 3. Unified Interactive Trend Graph -->
      <div class="unified-chart-wrapper">
        <Card 
          title="Trend e Andamento Storico" 
          description="Visualizza il trend mensile delle metriche di performance aziendali. Alterna tra le viste usando i tab."
        >
          {#snippet icon()}
            <TrendingUp size={20} class="icon-accent" />
          {/snippet}

          {#snippet headerSnippet()}
            <div class="chart-tab-switcher">
              <button 
                class="chart-tab-btn" 
                class:active={activeChartTab === 'vss'} 
                onclick={() => activeChartTab = 'vss'}
              >
                Valore Venduto (VSS)
              </button>
              <button 
                class="chart-tab-btn" 
                class:active={activeChartTab === 'gi'} 
                onclick={() => activeChartTab = 'gi'}
              >
                Cassa Incassata (GI)
              </button>
              <button 
                class="chart-tab-btn" 
                class:active={activeChartTab === 'ncf'} 
                onclick={() => activeChartTab = 'ncf'}
              >
                Nuovi Clienti (NCF)
              </button>
            </div>
          {/snippet}

          <div class="chart-container">
            <svg class="svg-chart" viewBox="0 0 500 200">
              <defs>
                <linearGradient id="gradient-unified" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color={unifiedChartDetails.stopColor} stop-opacity="0.35"/>
                  <stop offset="100%" stop-color={unifiedChartDetails.stopColor} stop-opacity="0.0"/>
                </linearGradient>
              </defs>

              <!-- Grid Lines -->
              <line x1="50" y1="30" x2="450" y2="30" class="chart-grid-line" />
              <line x1="50" y1="85" x2="450" y2="85" class="chart-grid-line" />
              <line x1="50" y1="140" x2="450" y2="140" class="chart-grid-line" />

              <!-- X Axis Labels -->
              {#each months as month, idx}
                <text x={80 + idx * 110} y="180" class="chart-axis-lbl" text-anchor="middle">{month}</text>
              {/each}

              <!-- Y Axis Labels -->
              <text x="15" y="35" class="chart-axis-lbl">{unifiedChartDetails.yLabels[0]}</text>
              <text x="15" y="90" class="chart-axis-lbl">{unifiedChartDetails.yLabels[1]}</text>
              <text x="15" y="145" class="chart-axis-lbl">{unifiedChartDetails.yLabels[2]}</text>

              <!-- Area Fill -->
              <path d={unifiedChartDetails.areaD} fill="url(#gradient-unified)" />

              <!-- Line Chart Path -->
              <path d={unifiedChartDetails.pathD} class="chart-line-path {unifiedChartDetails.lineClass}" />

              <!-- Dots with values on hover -->
              {#each unifiedChartDetails.points as pt}
                <circle cx={pt.x} cy={pt.y} r="5" class="chart-dot {unifiedChartDetails.dotClass}" />
                <text x={pt.x} y={pt.y - 10} text-anchor="middle" class="chart-point-val">
                  {activeChartTab === 'ncf' ? pt.val : `€${pt.val.toFixed(0)}`}
                </text>
              {/each}
            </svg>
          </div>

          <div class="legend-row">
            <div class="legend-item">
              <span class="legend-color" style="background-color: {unifiedChartDetails.stopColor}"></span>
              <span>{unifiedChartDetails.label}</span>
            </div>
          </div>
        </Card>
      </div>

    {/if}
  </div>
{/if}

<style>
  .dashboard-panoramica {
    display: flex;
    flex-direction: column;
    gap: 30px;
    width: 100%;
  }

  :global(.welcome-banner) {
    background: linear-gradient(135deg, var(--color-primary-50), var(--color-neutral-100)) !important;
  }

  .kpi-deck {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 24px;
  }

  .kpi-tile {
    background: var(--color-white);
    border: 1px solid var(--color-neutral-200);
    border-radius: var(--radius-lg);
    padding: 24px;
    display: flex;
    gap: 16px;
    align-items: center;
    box-shadow: var(--shadow-sm);
  }

  .kpi-tile.border-primary { border-left: 5px solid var(--color-primary-500); }
  .kpi-tile.border-success { border-left: 5px solid var(--color-success); }
  .kpi-tile.border-warning { border-left: 5px solid var(--color-warning); }
  .kpi-tile.border-info { border-left: 5px solid #0284c7; }
  .kpi-tile.border-teal { border-left: 5px solid #0d9488; }
  .kpi-tile.border-indigo { border-left: 5px solid #4f46e5; }

  .kpi-icon {
    width: 44px;
    height: 44px;
    border-radius: var(--radius-md);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .kpi-icon.primary { background: var(--color-primary-50); color: var(--color-primary-600); }
  .kpi-icon.success { background: var(--color-success-light); color: var(--color-success-text); }
  .kpi-icon.warning { background: var(--color-warning-light); color: var(--color-warning-text); }
  .kpi-icon.info { background: #e0f2fe; color: #0369a1; }
  .kpi-icon.teal { background: #ccfbf1; color: #0f766e; }
  .kpi-icon.indigo { background: #e0e7ff; color: #4338ca; }

  .kpi-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .kpi-lbl {
    font-size: 11px;
    font-weight: 600;
    color: var(--color-neutral-500);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .kpi-val {
    font-size: 20px;
    font-weight: 700;
    color: var(--color-neutral-800);
  }

  .kpi-sub {
    font-size: 11px;
    color: var(--color-neutral-400);
    font-weight: 500;
  }

  .activity-section-header {
    margin-top: 10px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .activity-section-header h4 {
    margin: 0;
    font-size: 16px;
    font-weight: 700;
    color: var(--color-neutral-800);
  }

  .activity-section-header .sub-desc {
    font-size: 12.5px;
    color: var(--color-neutral-400);
  }

  /* Unified chart layout */
  .unified-chart-wrapper {
    width: 100%;
  }

  .chart-tab-switcher {
    display: flex;
    gap: 4px;
    background: var(--color-neutral-100);
    padding: 3px;
    border-radius: var(--radius-md);
    border: 1px solid var(--color-neutral-200);
  }

  .chart-tab-btn {
    background: transparent;
    border: none;
    padding: 6px 14px;
    border-radius: var(--radius-sm);
    font-family: inherit;
    font-size: 11.5px;
    font-weight: 600;
    color: var(--color-neutral-500);
    cursor: pointer;
    transition: all 0.2s;
  }

  .chart-tab-btn.active {
    background: var(--color-white);
    color: var(--color-primary-600);
    box-shadow: var(--shadow-sm);
  }

  .chart-container {
    padding: 24px 10px 10px 10px;
  }

  .svg-chart {
    width: 100%;
    height: auto;
    overflow: visible;
  }

  .chart-grid-line {
    stroke: var(--color-neutral-200);
    stroke-width: 1;
    stroke-dasharray: 4,4;
  }

  .chart-axis-lbl {
    font-size: 9px;
    fill: var(--color-neutral-400);
    font-weight: 600;
  }

  text.chart-axis-lbl {
    text-anchor: start;
  }

  .chart-line-path {
    fill: none;
    stroke-width: 3.5;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .chart-line-path.primary-line { stroke: var(--color-primary-500); }
  .chart-line-path.success-line { stroke: var(--color-success); }
  .chart-line-path.warning-line { stroke: var(--color-warning); }

  .chart-dot {
    stroke: var(--color-white);
    stroke-width: 2;
  }

  .chart-dot.primary { fill: var(--color-primary-500); }
  .chart-dot.success { fill: var(--color-success); }
  .chart-dot.warning { fill: var(--color-warning); }

  .chart-point-val {
    font-size: 9.5px;
    font-weight: 700;
    fill: var(--color-neutral-700);
  }

  .legend-row {
    display: flex;
    justify-content: center;
    margin-top: 15px;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 11.5px;
    color: var(--color-neutral-500);
    font-weight: 600;
  }

  .legend-color {
    width: 10px;
    height: 10px;
    border-radius: 2px;
    display: inline-block;
  }

  .loader-box {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 60px;
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

  .animate-fade-in {
    animation: fadeIn 0.4s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(6px); }
    to { opacity: 1; transform: translateY(0); }
  }
</style>
