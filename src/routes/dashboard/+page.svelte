<script lang="ts">
  import { confirmStore } from '$lib/stores/confirm.svelte';
  import { toast } from '$lib/stores/toast.svelte';
  import { authState, activeRoleState } from "$lib/auth.svelte";
  import { pageTitle } from '$lib/stores/page';
  pageTitle.set('Dashboard');
  import { auth as clientAuth } from "$lib/firebase";
  import StatusBadge from "$lib/components/StatusBadge.svelte";
  import CommercialKPIs from "$lib/components/Dashboard/CommercialKPIs.svelte";
  import AdminKPIs from '$lib/components/Dashboard/AdminKPIs.svelte';
  import AdminTablesWidget from "./components/AdminTablesWidget.svelte";
  import { DashboardService } from "./dashboard.service";
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";
  import { Card, TrendChart } from "$lib";
  import { KPI_LEGEND } from "$lib/kpiLegend";
  import { formatCurrency } from "$lib/utils/formatters";

  // Dashboard Stats States
  let loadingData = $state(true);
  let loadingChart = $state(false);

  // Admin stats
  let totalClienti = $state(0);
  let totalVenduto = $state(0);
  let totalIncassato = $state(0);
  let totalNNCF = $state(0);
  let totalContratti = $state(0);
  let pendingContratti = $state(0);

  // Commercial stats (from user document)
  let commContractsCount = $state(0);
  let commTotalSold = $state(0);
  let commApprovedSold = $state(0);
  let commMaturate = $state(0);
  let commSospese = $state(0);
  let commTotalNNCF = $state(0);
  let commTotalNA = $state(0);
  let commIncassato = $state(0);

  // Activity KPIs
  let activityCounts = $state<Record<string, number>>({});

  // Administration Tables
  let adminPendingContracts = $state<any[]>([]);
  let adminOverdueInstallments = $state<any[]>([]);
  let adminPendingCommissions = $state<any[]>([]);
  let adminFinalizedCommissions = $state<any[]>([]);
  let adminUndistributedPayments = $state<any[]>([]);

  // Advanced chart configurations
  let activeChartTab = $state<string>('vss');
  let granularity: 'settimanale' | 'mensile' | 'annuale' = $state('mensile');
  let endDateString = $state(new Date().toISOString().split('T')[0]);
  let selectedPointIdx = $state<number | null>(null);

  // Chart data
  let computedChartPoints = $state<number[]>([]);
  let drillDownItems = $state<any[]>([]);
  let usersList = $state<any[]>([]);

  // Drill-down live filters
  let clientFilter = $state('');
  let vendorFilter = $state('');
  let productFilter = $state('');
  
  let isChartFullscreen = $state(false);
  let chartWrapperW = $state(0);
  let chartWrapperH = $state(0);

  let loadingAdminTables = $state(true);

  import { menuConfigStore } from '$lib/stores/menu';
  import { Users, Briefcase, CheckSquare, Settings, ArrowRight } from '@lucide/svelte';

  // Active module flags derived from menuConfigStore
  let activeModuleIds = $derived($menuConfigStore.map(m => m.id));
  let hasActivities = $derived(activeModuleIds.includes('activities'));
  let hasFinancialChart = $derived(activeModuleIds.length > 0);

  let rawKpis = $state<any>({});

  async function loadKPIs() {
    loadingData = true;
    try {
      const kpis = await DashboardService.fetchGlobalKPIs(activeRoleState.role || '', authState.user?.uid || '', [], activeModuleIds);
      rawKpis = kpis;
      commContractsCount = kpis.commContractsCount;
      commTotalSold = kpis.commTotalSold;
      commApprovedSold = kpis.commApprovedSold;
      commTotalNNCF = kpis.commTotalNNCF;
      commMaturate = kpis.commMaturate;
      commIncassato = kpis.commIncassato;
      totalClienti = kpis.totalClienti;
      totalVenduto = kpis.totalVenduto;
      totalIncassato = kpis.totalIncassato;
      totalNNCF = kpis.totalNNCF;
      totalContratti = kpis.totalContratti;
      pendingContratti = kpis.pendingContratti;
      activityCounts = kpis.activityCounts;
      commTotalNA = kpis.commTotalNA;
      usersList = kpis.usersList;

      if (activeRoleState.role === 'amministrazione' || activeRoleState.role === 'superadmin') {
        loadingAdminTables = true;
        const tables = await DashboardService.fetchAdminTables(new Date().toISOString(), activeModuleIds);
        adminPendingContracts = tables.adminPendingContracts;
        adminOverdueInstallments = tables.adminOverdueInstallments;
        adminPendingCommissions = tables.adminPendingCommissions;
        adminFinalizedCommissions = tables.adminFinalizedCommissions;
        adminUndistributedPayments = tables.adminUndistributedPayments;
        loadingAdminTables = false;
      }
    } catch (e) {
      console.error("Error loading KPIs", e);
    } finally {
      loadingData = false;
    }
  }

  let chartPeriods = $derived(DashboardService.generateChartPeriods(endDateString, granularity));

  async function loadChartData() {
    if (!hasFinancialChart || chartPeriods.length === 0) return;
    loadingChart = true;
    try {
      computedChartPoints = await DashboardService.fetchChartAggregations(
        chartPeriods, 
        activeRoleState.role || '', 
        authState.user?.uid || '', 
        activeChartTab
      );
    } finally {
      loadingChart = false;
    }
  }

  let loadingDrillDown = $state(false);
  async function loadDrillDown() {
    if (!hasFinancialChart || selectedPointIdx === null || !chartPeriods[selectedPointIdx]) {
      drillDownItems = [];
      return;
    }
    loadingDrillDown = true;
    try {
      drillDownItems = await DashboardService.fetchDrillDownItems(
        chartPeriods[selectedPointIdx], 
        activeChartTab, 
        activeRoleState.role || '', 
        authState.user?.uid || '', 
        clientFilter, 
        vendorFilter, 
        productFilter,
        activeModuleIds
      );
    } finally {
      loadingDrillDown = false;
    }
  }

  // Reactively fetch KPIs whenever auth or role changes
  $effect(() => {
    if (authState.user && activeRoleState.role) {
      loadKPIs();
    }
  });

  // Reactively fetch new chart points whenever filters or tabs change
  $effect(() => {
    if (hasFinancialChart && (activeChartTab || granularity || endDateString || activeRoleState.role)) {
      loadChartData();
      selectedPointIdx = null; // reset selection on tab change
    }
  });

  // Reactively fetch drilldown items
  $effect(() => {
    if (hasFinancialChart && (selectedPointIdx !== null || clientFilter !== undefined || vendorFilter !== undefined || productFilter !== undefined)) {
      loadDrillDown();
    }
  });



  async function handleMarkCommissionPaid(periodId: string) {
    const ok = await confirmStore.prompt('Sei sicuro di voler contrassegnare questo mese provvigionale come pagato? Scomparirà dalla dashboard e non sarà più considerato in attesa.');
    if (!ok) return;
    try {
      await DashboardService.markCommissionPaid(periodId, authState.user?.uid || 'system');
      toast.success('Provvigione segnata come pagata!');
      await loadKPIs();
    } catch (e: any) {
      toast.error('Errore: ' + e.message);
    }
  }
</script>

{#if authState.user}
  <div class="dashboard-viewport">
    {#if activeRoleState.role === 'amministrazione' && hasFinancialChart}
      <!-- 1. Admin layout for active admin modules -->
      <div class="dashboard-panoramica admin-layout animate-fade-in">
        <Card
          title="Pannello di Amministrazione & Operatività"
          description="Monitora l'approvazione delle transazioni commerciali e gestisci le operazioni di sistema."
          variant="glass"
          class="welcome-banner"
          style="--card-padding: 30px 40px;"
        />

        {#if loadingAdminTables}
          <div class="loader-box">
            <span class="spinner"></span>
            Caricamento dati amministrativi...
          </div>
        {:else}
          <AdminTablesWidget 
            loadingAdminTables={loadingAdminTables}
            {adminPendingContracts}
            {adminOverdueInstallments}
            {adminUndistributedPayments}
            {adminPendingCommissions}
            {adminFinalizedCommissions}
            onMarkCommissionPaid={handleMarkCommissionPaid}
          />
        {/if}
      </div>
    {:else}
      <!-- 2. Clean Core / Commercial / Management Dashboard -->
      <div class="dashboard-panoramica animate-fade-in">
        <!-- Top Welcome Banner -->
        <Card
          title={`Benvenuto, ${authState.user.nome || 'Utente'}`}
          description="Qui puoi accedere rapidamente alle funzionalità e alle panoramiche abilitate per il tuo profilo."
          variant="glass"
          class="welcome-banner"
          style="--card-padding: 30px 40px;"
        />

        {#if loadingData}
          <div class="loader-box">
            <span class="spinner"></span>
            Caricamento pannello di controllo...
          </div>
        {:else}
          {#if hasFinancialChart}
            <div class="dashboard-main-split">
              <div class="dashboard-left-col">
                <TrendChart
                  bind:isChartFullscreen
                  bind:activeChartTab
                  bind:selectedPointIdx
                  bind:granularity
                  bind:endDateString
                  bind:clientFilter
                  bind:vendorFilter
                  bind:productFilter
                  {loadingChart}
                  {loadingDrillDown}
                  {computedChartPoints}
                  {chartPeriods}
                  {drillDownItems}
                  {usersList}
                  activeRole={activeRoleState.role || ''}
                  {formatCurrency}
                  activitiesConfig={[]}
                  {hasActivities}
                />
              </div>

              <div class="dashboard-right-col">
                {#if activeRoleState.role === "commerciale"}
                  <CommercialKPIs 
                    kpis={rawKpis}
                    {commTotalNA}
                    {commContractsCount}
                    {commTotalSold}
                    {commMaturate}
                    {commTotalNNCF}
                    {commIncassato}
                    {activityCounts}
                    activitiesConfig={[]}
                    onTabSelect={(tab: string) => { activeChartTab = tab as any; selectedPointIdx = null; }}
                    {hasActivities}
                  />
                {:else}
                  <AdminKPIs 
                    kpis={rawKpis}
                    {totalClienti}
                    {totalVenduto}
                    {totalContratti}
                    {pendingContratti}
                    {totalIncassato}
                    {totalNNCF}
                    {commMaturate}
                    {activityCounts}
                    activitiesConfig={[]}
                    onTabSelect={(tab: string) => { activeChartTab = tab as any; selectedPointIdx = null; }}
                    {hasActivities}
                  />
                {/if}
              </div>
            </div>
          {:else}
            <!-- CLEAN CORE DASHBOARD UI (No financial/contract modules installed) -->
            <div class="clean-core-grid">
              <div class="core-kpis-row">
                <div class="kpi-card">
                  <div class="kpi-icon-box info">
                    <Briefcase size={24} />
                  </div>
                  <div class="kpi-info">
                    <span class="kpi-num">{totalClienti}</span>
                    <span class="kpi-label">Clienti in Anagrafica</span>
                  </div>
                </div>

                <div class="kpi-card">
                  <div class="kpi-icon-box success">
                    <Users size={24} />
                  </div>
                  <div class="kpi-info">
                    <span class="kpi-num">{usersList.length || 1}</span>
                    <span class="kpi-label">Utenti Registrati</span>
                  </div>
                </div>

                <div class="kpi-card">
                  <div class="kpi-icon-box warning">
                    <CheckSquare size={24} />
                  </div>
                  <div class="kpi-info">
                    <span class="kpi-num">0</span>
                    <span class="kpi-label">Task da Completare</span>
                  </div>
                </div>
              </div>

              <div class="quick-nav-section">
                <h3>Navigazione Rapida</h3>
                <div class="nav-cards-grid">
                  <a href="/dashboard/clients" class="quick-card">
                    <div class="qc-header">
                      <Briefcase size={20} class="qc-icon" />
                      <span>Anagrafica Clienti</span>
                    </div>
                    <p>Gestisci l'elenco e le schede dei clienti registrati.</p>
                    <div class="qc-arrow"><ArrowRight size={16} /></div>
                  </a>

                  {#if activeRoleState.role === 'superadmin'}
                    <a href="/dashboard/users" class="quick-card">
                      <div class="qc-header">
                        <Users size={20} class="qc-icon" />
                        <span>Gestione Utenti</span>
                      </div>
                      <p>Gestisci gli account aziendali ed i relativi permessi.</p>
                      <div class="qc-arrow"><ArrowRight size={16} /></div>
                    </a>

                    <a href="/dashboard/settings/theme" class="quick-card">
                      <div class="qc-header">
                        <Settings size={20} class="qc-icon" />
                        <span>Personalizza Tema</span>
                      </div>
                      <p>Modifica la palette ed i colori della piattaforma in tempo reale.</p>
                      <div class="qc-arrow"><ArrowRight size={16} /></div>
                    </a>
                  {/if}

                  <a href="/dashboard/todo" class="quick-card">
                    <div class="qc-header">
                      <CheckSquare size={20} class="qc-icon" />
                      <span>Cose da Fare</span>
                    </div>
                    <p>Visualizza la lista dei task e dei promemoria personali.</p>
                    <div class="qc-arrow"><ArrowRight size={16} /></div>
                  </a>
                </div>
              </div>
            </div>
          {/if}

          {#if activeRoleState.role === "amministrazione" || activeRoleState.role === "superadmin"}
            <AdminTablesWidget 
              {loadingAdminTables}
              {adminPendingContracts}
              {adminOverdueInstallments}
              {adminPendingCommissions}
              {adminFinalizedCommissions}
              {adminUndistributedPayments}
            />
          {/if}
        {/if}
      </div>
    {/if}
  </div>
{/if}

<style>
  .dashboard-viewport {
    width: 100%;
  }

  .dashboard-panoramica {
    display: flex;
    flex-direction: column;
    gap: 36px;
    width: 100%;
  }

  :global(.welcome-banner) {
    background: linear-gradient(
      135deg,
      var(--color-primary-600),
      var(--color-primary-800)
    ) !important;
    color: white !important;
    border: none !important;
    box-shadow: 0 12px 36px rgba(0,0,0,0.12) !important;
  }
  :global(.welcome-banner h3) {
    color: white !important;
  }
  .dashboard-main-split {
    display: flex;
    gap: 30px;
    align-items: flex-start;
  }
  .dashboard-left-col {
    flex: 1;
    min-width: 0;
  }
  .dashboard-right-col {
    flex: 0 0 280px;
  }
  @media (max-width: 1024px) {
    .dashboard-main-split {
      flex-direction: column;
    }
    .dashboard-right-col {
      flex: none;
      width: 100%;
    }
  }

  /* Clean Core Dashboard Styles */
  .clean-core-grid {
    display: flex;
    flex-direction: column;
    gap: 32px;
    width: 100%;
  }

  .core-kpis-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 20px;
  }

  .kpi-card {
    background: var(--color-white);
    padding: 24px;
    border-radius: var(--radius-lg);
    border: 1px solid var(--color-neutral-200);
    display: flex;
    align-items: center;
    gap: 18px;
    box-shadow: 0 4px 14px rgba(0,0,0,0.04);
    transition: transform 0.2s, box-shadow 0.2s;
  }

  .kpi-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(0,0,0,0.08);
  }

  .kpi-icon-box {
    width: 52px;
    height: 52px;
    border-radius: var(--radius-md);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .kpi-icon-box.info {
    background: var(--color-info-light);
    color: var(--color-primary-500);
  }

  .kpi-icon-box.success {
    background: var(--color-success-light);
    color: var(--color-success-text);
  }

  .kpi-icon-box.warning {
    background: var(--color-warning-light);
    color: var(--color-warning-text);
  }

  .kpi-info {
    display: flex;
    flex-direction: column;
  }

  .kpi-num {
    font-size: 26px;
    font-weight: 700;
    color: var(--color-neutral-900);
    line-height: 1.2;
  }

  .kpi-label {
    font-size: 13px;
    color: var(--color-neutral-500);
    font-weight: 500;
  }

  .quick-nav-section h3 {
    font-size: 18px;
    font-weight: 700;
    color: var(--color-neutral-800);
    margin: 0 0 16px 0;
  }

  .nav-cards-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: 20px;
  }

  .quick-card {
    background: var(--color-white);
    border: 1px solid var(--color-neutral-200);
    padding: 22px;
    border-radius: var(--radius-lg);
    text-decoration: none;
    display: flex;
    flex-direction: column;
    position: relative;
    transition: all 0.2s;
    box-shadow: 0 2px 8px rgba(0,0,0,0.03);
  }

  .quick-card:hover {
    border-color: var(--color-primary-400);
    transform: translateY(-2px);
    box-shadow: 0 8px 24px hsla(var(--brand-h), var(--brand-s), var(--brand-l), 0.12);
  }

  .qc-header {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 16px;
    font-weight: 700;
    color: var(--color-neutral-900);
    margin-bottom: 8px;
  }

  :global(.qc-icon) {
    color: var(--color-primary-500);
  }

  .quick-card p {
    font-size: 13px;
    color: var(--color-neutral-500);
    margin: 0 0 16px 0;
    line-height: 1.4;
  }

  .qc-arrow {
    align-self: flex-end;
    color: var(--color-primary-500);
    transition: transform 0.2s;
  }

  .quick-card:hover .qc-arrow {
    transform: translateX(4px);
  }
</style>
