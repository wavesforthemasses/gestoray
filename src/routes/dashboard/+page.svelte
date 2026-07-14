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
  import { activitiesConfigStore } from '$lib/stores/activities';
  import AdminTasks from "$lib/components/Dashboard/AdminTasks.svelte";
  import { ContractService } from "$lib/services/ContractService";
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

  async function loadKPIs() {
    loadingData = true;
    try {
      const kpis = await DashboardService.fetchGlobalKPIs(activeRoleState.role || '', authState.user?.uid || '', $activitiesConfigStore);
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
        const tables = await DashboardService.fetchAdminTables(new Date().toISOString());
        adminPendingContracts = tables.adminPendingContracts;
        adminOverdueInstallments = tables.adminOverdueInstallments;
        adminPendingCommissions = tables.adminPendingCommissions;
        adminFinalizedCommissions = tables.adminFinalizedCommissions;
        adminUndistributedPayments = tables.adminUndistributedPayments;
        loadingAdminTables = false;
      }
    } finally {
      loadingData = false;
    }
  }

  let chartPeriods = $derived(DashboardService.generateChartPeriods(endDateString, granularity));

  async function loadChartData() {
    if (chartPeriods.length === 0) return;
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
    if (selectedPointIdx === null || !chartPeriods[selectedPointIdx]) {
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
        productFilter
      );
    } finally {
      loadingDrillDown = false;
    }
  }

  $effect(() => {
    if (authState.user === null) {
      setTimeout(() => {
        if (authState.user === null) goto("/login");
      }, 800);
    }
  });

  // Reactively fetch KPIs whenever auth or role changes
  $effect(() => {
    if (authState.user && activeRoleState.role) {
      loadKPIs();
    }
  });

  // Reactively fetch new chart points whenever filters or tabs change
  $effect(() => {
    if (activeChartTab || granularity || endDateString || activeRoleState.role) {
      loadChartData();
      selectedPointIdx = null; // reset selection on tab change
    }
  });

  // Reactively fetch drilldown items
  $effect(() => {
    if (selectedPointIdx !== null || clientFilter !== undefined || vendorFilter !== undefined || productFilter !== undefined) {
      loadDrillDown();
    }
  });

  async function handleApproveContract(contractId: string) {
    const role = activeRoleState.role;
    if (role !== 'superadmin' && role !== 'amministrazione') return;

    try {
      await ContractService.approveContract(contractId, authState.user?.uid || 'system', authState.user?.email || 'system');
      toast.success('Contratto approvato con successo!');
      await loadKPIs();
    } catch (e: any) {
      toast.error('Errore durante l\'approvazione: ' + e.message);
    }
  }

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
    {#if activeRoleState.role === 'amministrazione'}
      <!-- 1. Alternative dashboard layout for amministrazione role -->
      <div class="dashboard-panoramica admin-layout animate-fade-in">
        <Card
          title="Pannello di Amministrazione & Recupero Crediti"
          description="Monitora l'approvazione delle transazioni commerciali e gestisci le rate insolute."
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
          <!-- Main Content split -->
          <AdminTasks 
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
      <!-- 2. Commercial / Management (Direzione / Superadmin) Dashboard -->
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
          <div class="dashboard-main-split">
            <div class="dashboard-left-col">
              <!-- Unified Interactive Trend Graph Card -->
              <!-- Unified Interactive Trend Graph Card -->
              <TrendChart
                bind:isChartFullscreen
                bind:activeChartTab
                bind:selectedPointIdx
                bind:granularity
                bind:endDateString
                bind:clientFilter
                bind:vendorFilter
                bind:productFilter
                {KPI_LEGEND}
                {loadingChart}
                {loadingDrillDown}
                {computedChartPoints}
                {chartPeriods}
                {drillDownItems}
                {usersList}
                activeRole={activeRoleState.role || ''}
                {formatCurrency}
                activitiesConfig={$activitiesConfigStore}
              />
            </div>

            <div class="dashboard-right-col">
              <!-- Financial KPIs Block -->
              {#if activeRoleState.role === "commerciale"}
                <CommercialKPIs 
                  {commTotalNA}
                  {commContractsCount}
                  {commTotalSold}
                  {commMaturate}
                  {commTotalNNCF}
                  {commIncassato}
                  {activityCounts}
                  activitiesConfig={$activitiesConfigStore}
                  onTabSelect={(tab) => { activeChartTab = tab as any; selectedPointIdx = null; }}
                />
              {:else}
                <!-- superadmin & direzione global stats view -->
                <AdminKPIs 
                  {totalClienti}
                  {totalVenduto}
                  {totalContratti}
                  {pendingContratti}
                  {totalIncassato}
                  {totalNNCF}
                  {commMaturate}
                  {activityCounts}
                  activitiesConfig={$activitiesConfigStore}
                  onTabSelect={(tab) => { activeChartTab = tab as any; selectedPointIdx = null; }}
                />
              {/if}
            </div>
          </div>




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


</style>
