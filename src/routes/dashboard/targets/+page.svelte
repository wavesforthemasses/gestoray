<script lang="ts">
  import { onMount } from 'svelte';
  import { TargetsService, type PeriodInfo } from './targets.service';
  import { TargetsSettingsService } from './targetsSettingsService';
  import { ChartSettingsService } from '$lib/services/chartSettingsService';
  import { authState, activeRoleState } from '$lib/auth.svelte';
  import { db, collection, getDocs } from '$lib/firebase';
  import type { 
    TargetPlanDefinition, 
    TargetRecordDocument, 
    TargetRecordWithProgress, 
    SubmissionWindowInfo,
    TargetsGlobalSettings,
    UserSubjectContext 
  } from './schema';

  import TargetPlanSelector from './components/TargetPlanSelector.svelte';
  import TargetPeriodNavigator from './components/TargetPeriodNavigator.svelte';
  import TargetSubmissionWindowBadge from './components/TargetSubmissionWindowBadge.svelte';
  import TargetSubjectCard from './components/TargetSubjectCard.svelte';
  import TargetProgressBar from './components/TargetProgressBar.svelte';
  import TargetEditModal from './components/TargetEditModal.svelte';
  import TargetCloneModal from './components/TargetCloneModal.svelte';
  import SearchToolbar from '$lib/components/SearchToolbar.svelte';

  import { 
    Target, 
    Plus, 
    Copy, 
    TrendingUp, 
    Users, 
    Filter, 
    AlertCircle, 
    CheckCircle2, 
    Award,
    Settings
  } from '@lucide/svelte';
  import { formatCurrency, formatNumber } from '$lib/utils/formatters';

  // State Management (Svelte 5 Runes)
  let plans = $state<TargetPlanDefinition[]>([]);
  let selectedPlanId = $state<string>('');
  let globalSettings = $state<TargetsGlobalSettings>({
    showCompanySummaryOnTop: true
  });

  let currentPeriod = $state<PeriodInfo>(TargetsService.generatePeriodInfo('mensile'));
  let windowInfo = $state<SubmissionWindowInfo>({
    isOpen: true,
    status: 'open',
    windowStartDate: '',
    windowEndDate: '',
    message: ''
  });

  let records = $state<TargetRecordWithProgress[]>([]);
  let availableUsers = $state<Array<{ uid: string; name: string; email?: string; role?: string }>>([]);
  let availableTeams = $state<Array<{ id: string; name: string; leaderId?: string; leaderName?: string; membersCount?: number }>>([]);
  let userTeamMemberships = $state<Array<{ teamId: string; isLeader: boolean }>>([]);
  let kpiMetadataList = $state<Array<{ id: string; name: string; acronym?: string; isCurrency?: boolean; description?: string }>>([]);

  let isLoading = $state(true);
  let searchQuery = $state('');
  let tierFilter = $state('all');

  // Modals state
  let isEditModalOpen = $state(false);
  let editingRecord = $state<TargetRecordDocument | null>(null);
  let isCloneModalOpen = $state(false);

  // Derived Values
  let currentPlan = $derived(plans.find(p => p.id === selectedPlanId) || plans[0] || null);

  let userRole = $derived(activeRoleState.role || 'commerciale');
  let currentUid = $derived(authState.user?.uid || '');
  let isManager = $derived(['superadmin', 'amministrazione', 'direzione'].includes(userRole));

  let currentUserContext = $derived<UserSubjectContext>({
    uid: currentUid,
    role: userRole,
    teamMemberships: userTeamMemberships
  });

  let canCreateOrEditInPlan = $derived.by(() => {
    if (!currentPlan) return false;
    if (isManager) return true;

    if (currentPlan.targetSubject === 'user') {
      if (currentPlan.permissions?.userSelfEdit || currentPlan.compilationMode === 'self_submission') {
        return windowInfo.isOpen;
      }
      return (currentPlan.permissions?.userOthersEditRoles || []).includes(userRole);
    }

    if (currentPlan.targetSubject === 'team') {
      const isAnyTeamLeader = userTeamMemberships.some(m => m.isLeader);
      if (isAnyTeamLeader && (currentPlan.permissions?.teamLeaderEdit ?? true)) {
        return windowInfo.isOpen;
      }
      return (currentPlan.permissions?.teamOthersEditRoles || []).includes(userRole);
    }

    return (currentPlan.permissions?.companyEditRoles || []).includes(userRole);
  });

  // Filtered records
  let filteredRecords = $derived.by(() => {
    let list = records;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(r => 
        r.subjectName.toLowerCase().includes(q) || 
        r.subjectRole?.toLowerCase().includes(q) ||
        r.leaderName?.toLowerCase().includes(q) ||
        r.notes?.toLowerCase().includes(q)
      );
    }

    if (tierFilter !== 'all') {
      list = list.filter(r => r.overallTier === tierFilter);
    }

    return list;
  });

  // Company Aggregated KPI Totals
  let companyTotals = $derived.by(() => {
    if (!currentPlan || records.length === 0) return null;

    const totalsPerKpi: Record<string, { target: number; actual: number; delta: number; rate: number; isCurrency?: boolean; name: string; acronym: string }> = {};

    for (const kpiId of currentPlan.kpiIds) {
      const meta = kpiMetadataList.find(m => m.id === kpiId);
      totalsPerKpi[kpiId] = {
        target: 0,
        actual: 0,
        delta: 0,
        rate: 0,
        isCurrency: meta?.isCurrency || ['vss', 'total_incassato', 'gi', 'totalVenduto'].includes(kpiId),
        name: meta?.name || kpiId,
        acronym: meta?.acronym || kpiId.slice(0, 3).toUpperCase()
      };
    }

    for (const rec of records) {
      for (const m of rec.progressMetrics) {
        if (totalsPerKpi[m.kpiId]) {
          totalsPerKpi[m.kpiId].target += m.target;
          totalsPerKpi[m.kpiId].actual += m.actual;
        }
      }
    }

    let overallTargetSum = 0;
    let overallActualSum = 0;

    for (const [k, v] of Object.entries(totalsPerKpi)) {
      v.delta = v.actual - v.target;
      v.rate = v.target > 0 ? Math.round((v.actual / v.target) * 1000) / 10 : (v.actual > 0 ? 100 : 0);
      overallTargetSum += v.target;
      overallActualSum += v.actual;
    }

    const overallRate = overallTargetSum > 0 ? Math.round((overallActualSum / overallTargetSum) * 1000) / 10 : 0;

    return {
      totalsPerKpi: Object.values(totalsPerKpi),
      overallRate
    };
  });

  // Previous Period for Cloning
  let previousPeriod = $derived.by(() => {
    if (!currentPlan) return null;
    return TargetsService.getAdjacentPeriod(currentPlan.granularity, currentPeriod.startDate, -1);
  });

  // Data Loading
  onMount(async () => {
    await loadInitialData();
  });

  async function loadInitialData() {
    isLoading = true;
    try {
      const [loadedPlans, loadedSettings, allKpis] = await Promise.all([
        TargetsSettingsService.getPlans(),
        TargetsSettingsService.getGlobalSettings(),
        ChartSettingsService.getAllKpisMasterListSync()
      ]);

      plans = loadedPlans;
      globalSettings = loadedSettings;
      kpiMetadataList = allKpis;

      if (plans.length > 0) {
        selectedPlanId = plans[0].id;
        currentPeriod = TargetsService.generatePeriodInfo(plans[0].granularity);
      }

      await loadUsersAndTeams();
      await loadPeriodRecords();
    } catch (err) {
      console.error('Errore inizializzazione modulo targets:', err);
    } finally {
      isLoading = false;
    }
  }

  async function loadUsersAndTeams() {
    try {
      // 1. Users
      const usersSnap = await getDocs(collection(db, 'users'));
      const uList: Array<{ uid: string; name: string; email?: string; role?: string }> = [];
      usersSnap.forEach(d => {
        const u = d.data()?.original || d.data();
        uList.push({
          uid: d.id,
          name: (u.nome ? `${u.nome} ${u.cognome || ''}`.trim() : (u.displayName || u.name || u.email || 'Utente')),
          email: u.email,
          role: u.role || 'commerciale'
        });
      });
      availableUsers = uList;

      // 2. Teams
      const teamsSnap = await getDocs(collection(db, 'teams'));
      const tList: Array<{ id: string; name: string; leaderId?: string; leaderName?: string; membersCount?: number }> = [];
      const memberships: Array<{ teamId: string; isLeader: boolean }> = [];

      teamsSnap.forEach(d => {
        const t = d.data()?.original || d.data();
        const tId = d.id;
        const members: any[] = t.members || [];
        const isLeader = t.leaderId === currentUid || members.some((m: any) => m.userId === currentUid && m.isLeader);
        const isMember = members.some((m: any) => m.userId === currentUid);

        if (isLeader || isMember) {
          memberships.push({ teamId: tId, isLeader: !!isLeader });
        }

        tList.push({
          id: tId,
          name: t.name || `Squadra ${t.code || tId}`,
          leaderId: t.leaderId,
          leaderName: t.leaderName,
          membersCount: members.length
        });
      });

      availableTeams = tList;
      userTeamMemberships = memberships;
    } catch (e) {
      console.warn('Errore lettura utenti/squadre:', e);
    }
  }

  async function loadPeriodRecords() {
    if (!currentPlan) return;
    isLoading = true;
    try {
      // 1. Calculate window status
      windowInfo = TargetsService.calculateSubmissionWindow(
        currentPlan.submissionWindow,
        currentPeriod.startDate
      );

      // 2. Fetch raw target documents
      const rawRecords = await TargetsService.getTargetRecords(currentPlan.id, currentPeriod.key);

      // 3. Compute progress & evaluate permissions for current user
      const enriched: TargetRecordWithProgress[] = [];

      for (const rec of rawRecords) {
        const perm = TargetsService.evaluateTargetPermissions(
          currentPlan,
          rec.subjectId,
          rec.subjectType,
          currentUserContext,
          windowInfo.isOpen
        );

        // Discard record if user is not authorized to view it
        if (!perm.canView) continue;

        const actuals = await TargetsService.fetchActualsForSubject(
          rec.subjectId,
          rec.subjectRole || 'commerciale',
          currentPeriod.startDate,
          currentPeriod.endDate,
          currentPlan.kpiIds
        );

        const withProg = TargetsService.calculateProgress(rec, actuals, kpiMetadataList);
        withProg.canView = perm.canView;
        withProg.canEdit = perm.canEdit;

        enriched.push(withProg);
      }

      records = enriched;
    } catch (err) {
      console.error('Errore caricamento record target:', err);
    } finally {
      isLoading = false;
    }
  }

  function handleSelectPlan(planId: string) {
    selectedPlanId = planId;
    const p = plans.find(x => x.id === planId);
    if (p) {
      currentPeriod = TargetsService.generatePeriodInfo(p.granularity);
      loadPeriodRecords();
    }
  }

  function handleNavigatePeriod(direction: -1 | 1) {
    if (!currentPlan) return;
    currentPeriod = TargetsService.getAdjacentPeriod(currentPlan.granularity, currentPeriod.startDate, direction);
    loadPeriodRecords();
  }

  function handleResetToday() {
    if (!currentPlan) return;
    currentPeriod = TargetsService.generatePeriodInfo(currentPlan.granularity);
    loadPeriodRecords();
  }

  function handleOpenNewModal() {
    editingRecord = null;
    isEditModalOpen = true;
  }

  function handleOpenEditModal(record: TargetRecordWithProgress) {
    editingRecord = record;
    isEditModalOpen = true;
  }

  async function handleSaveRecord(data: Partial<TargetRecordDocument>) {
    await TargetsService.saveTargetRecord(data, {
      uid: currentUid,
      name: (authState.user as any)?.nome ? `${(authState.user as any).nome} ${(authState.user as any).cognome || ''}`.trim() : (authState.user?.displayName || authState.user?.email || 'Utente')
    });
    await loadPeriodRecords();
  }

  async function handleClonePrevious(growthPct: number): Promise<number> {
    if (!currentPlan || !previousPeriod) return 0;
    const count = await TargetsService.cloneTargetsFromPreviousPeriod(
      currentPlan,
      previousPeriod.key,
      currentPeriod,
      growthPct,
      {
        uid: currentUid,
        name: (authState.user as any)?.nome ? `${(authState.user as any).nome} ${(authState.user as any).cognome || ''}`.trim() : (authState.user?.displayName || authState.user?.email || 'Utente')
      }
    );
    await loadPeriodRecords();
    return count;
  }
</script>

<div class="targets-page-container">
  <!-- 1. Page Top Actions Bar -->
  <div class="page-top-actions">
    <div class="header-left">
      <div class="icon-wrap">
        <Target size={26} class="page-main-icon" />
      </div>
      <div>
        <h1 class="page-title">Target & Budgeting</h1>
        <p class="page-subtitle">Monitoraggio obiettivi di performance, forecast e avanzamento KPI real-time</p>
      </div>
    </div>

    <div class="header-actions">
      {#if isManager}
        <a href="/dashboard/settings/targets" class="btn btn-outline" title="Configura Piani e Regole">
          <Settings size={16} />
          <span>Impostazioni</span>
        </a>

        <button 
          class="btn btn-secondary" 
          onclick={() => isCloneModalOpen = true}
          disabled={isLoading || !previousPeriod}
          type="button"
        >
          <Copy size={16} />
          <span>Clona da Mese Scorso</span>
        </button>
      {/if}

      {#if canCreateOrEditInPlan}
        <button 
          class="btn btn-primary" 
          onclick={handleOpenNewModal}
          disabled={isLoading}
          type="button"
        >
          <Plus size={16} />
          <span>+ Imposta Target</span>
        </button>
      {/if}
    </div>
  </div>

  <!-- 2. Plans Selector Bar & Period Navigator -->
  <div class="controls-toolbar">
    <div class="plan-tabs-section">
      <TargetPlanSelector 
        {plans} 
        {selectedPlanId} 
        onSelectPlan={handleSelectPlan} 
      />
    </div>

    <div class="period-navigator-section">
      <TargetPeriodNavigator 
        {currentPeriod} 
        onNavigate={handleNavigatePeriod} 
        onResetToday={handleResetToday} 
      />
    </div>
  </div>

  <!-- 3. Submission Window Status Banner -->
  {#if currentPlan && currentPlan.submissionWindow.enabled}
    <div class="submission-status-row">
      <TargetSubmissionWindowBadge {windowInfo} />
      <span class="status-summary-hint">
        {records.length} target visibili per questo periodo
      </span>
    </div>
  {/if}

  <!-- 4. Company Aggregated KPI Summary Banner -->
  {#if companyTotals && globalSettings.showCompanySummaryOnTop}
    <div class="company-summary-card">
      <div class="summary-card-header">
        <div class="summary-title-wrap">
          <TrendingUp size={20} class="summary-icon" />
          <h2 class="summary-title">Avanzamento Globale Aziendale</h2>
        </div>
        <div class="summary-badge">
          <span>Completamento Totale: <strong>{(companyTotals.overallRate ?? 0).toFixed(1)}%</strong></span>
        </div>
      </div>

      <div class="summary-kpis-grid">
        {#each companyTotals.totalsPerKpi as kpi (kpi.name)}
          <div class="summary-kpi-tile">
            <div class="tile-meta">
              <span class="tile-name">{kpi.name} ({kpi.acronym})</span>
              <span class="tile-values">
                <strong>{kpi.isCurrency ? formatCurrency(kpi.actual) : formatNumber(kpi.actual)}</strong>
                / {kpi.isCurrency ? formatCurrency(kpi.target) : formatNumber(kpi.target)}
              </span>
            </div>
            <TargetProgressBar rate={kpi.rate} />
            <div class="tile-footer">
              <span class="tile-delta {kpi.delta >= 0 ? 'positive' : 'negative'}">
                {kpi.delta >= 0 ? '+' : ''}{kpi.isCurrency ? formatCurrency(kpi.delta) : formatNumber(kpi.delta)}
              </span>
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  <!-- 5. Search & Filters Toolbar -->
  <div class="filters-row">
    <div class="search-wrap">
      <SearchToolbar 
        bind:searchQuery 
        placeholder="Cerca soggetto per nome, ruolo o caposquadra..." 
      />
    </div>

    <div class="tier-filter-dropdown">
      <select bind:value={tierFilter} class="form-select">
        <option value="all">Tutti i Livelli di Performance</option>
        <option value="over_100">Superato (≥ 100%)</option>
        <option value="between_80_100">In Target (80 - 99%)</option>
        <option value="between_50_80">In Progresso (50 - 79%)</option>
        <option value="below_50">Rallentamento (&lt; 50%)</option>
      </select>
    </div>
  </div>

  <!-- 6. Target Cards Grid -->
  {#if isLoading}
    <div class="loading-state">
      <div class="spinner"></div>
      <p>Calcolo avanzamento target e aggregazioni KPI in corso...</p>
    </div>
  {:else if filteredRecords.length === 0}
    <div class="empty-state">
      <div class="empty-icon-wrap">
        <Target size={40} />
      </div>
      <h3 class="empty-title">Nessun Target Trovato</h3>
      <p class="empty-desc">
        Non sono presenti target definiti per il periodo {currentPeriod.label} o i filtri selezionati.
      </p>
      {#if canCreateOrEditInPlan}
        <div class="empty-actions">
          {#if isManager && previousPeriod}
            <button class="btn btn-secondary" onclick={() => isCloneModalOpen = true} type="button">
              <Copy size={16} />
              <span>Clona da {previousPeriod.label}</span>
            </button>
          {/if}
          <button class="btn btn-primary" onclick={handleOpenNewModal} type="button">
            <Plus size={16} />
            <span>+ Imposta il Primo Target</span>
          </button>
        </div>
      {/if}
    </div>
  {:else}
    <div class="targets-grid">
      {#each filteredRecords as record (record.id)}
        <TargetSubjectCard 
          targetRecord={record} 
          canEdit={record.canEdit ?? isManager}
          onEdit={handleOpenEditModal}
        />
      {/each}
    </div>
  {/if}
</div>

<!-- Modals -->
{#if isEditModalOpen && currentPlan}
  <TargetEditModal 
    plan={currentPlan}
    periodKey={currentPeriod.key}
    periodLabel={currentPeriod.label}
    startDate={currentPeriod.startDate}
    endDate={currentPeriod.endDate}
    {editingRecord}
    {availableUsers}
    {availableTeams}
    {kpiMetadataList}
    onClose={() => isEditModalOpen = false}
    onSave={handleSaveRecord}
  />
{/if}

{#if isCloneModalOpen && currentPlan && previousPeriod}
  <TargetCloneModal 
    plan={currentPlan}
    fromPeriodKey={previousPeriod.key}
    fromPeriodLabel={previousPeriod.label}
    toPeriod={currentPeriod}
    onClose={() => isCloneModalOpen = false}
    onClone={handleClonePrevious}
  />
{/if}

<style>
  .targets-page-container {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    width: 100%;
    max-width: 100%;
    padding-bottom: 3rem;
  }

  .page-top-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .icon-wrap {
    width: 48px;
    height: 48px;
    border-radius: 12px;
    background: linear-gradient(135deg, rgba(59, 130, 246, 0.12), rgba(37, 99, 235, 0.2));
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .page-main-icon {
    color: var(--color-primary-600, #2563eb);
  }

  .page-title {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--color-text-primary, #111827);
  }

  .page-subtitle {
    margin: 0.125rem 0 0 0;
    font-size: 0.875rem;
    color: var(--color-text-muted, #6b7280);
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    border-radius: var(--radius-md, 8px);
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    text-decoration: none;
    transition: all 0.15s ease;
  }

  .btn-primary {
    background: var(--color-primary-600, #2563eb);
    color: #ffffff;
    border: 1px solid transparent;
  }

  .btn-primary:hover:not(:disabled) {
    background: var(--color-primary-700, #1d4ed8);
  }

  .btn-secondary {
    background: var(--color-bg-surface, #ffffff);
    color: var(--color-text-primary, #111827);
    border: 1px solid var(--color-border-subtle, #d1d5db);
  }

  .btn-secondary:hover:not(:disabled) {
    background: var(--color-bg-hover, #f3f4f6);
    border-color: var(--color-primary-300, #93c5fd);
  }

  .btn-outline {
    background: transparent;
    color: var(--color-text-secondary, #4b5563);
    border: 1px solid var(--color-border-subtle, #d1d5db);
  }

  .btn-outline:hover {
    background: var(--color-bg-hover, #f3f4f6);
    color: var(--color-text-primary, #111827);
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .controls-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
    background: var(--color-bg-surface, #ffffff);
    border: 1px solid var(--color-border-subtle, #e5e7eb);
    border-radius: var(--radius-lg, 12px);
    padding: 0.75rem 1rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  }

  .submission-status-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .status-summary-hint {
    font-size: 0.8125rem;
    color: var(--color-text-muted, #6b7280);
    font-weight: 500;
  }

  .company-summary-card {
    background: var(--color-bg-surface, #ffffff);
    border: 1px solid var(--color-border-subtle, #e5e7eb);
    border-radius: var(--radius-lg, 12px);
    padding: 1.25rem 1.5rem;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.04);
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .summary-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  .summary-title-wrap {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .summary-icon {
    color: var(--color-primary-600, #2563eb);
  }

  .summary-title {
    margin: 0;
    font-size: 1rem;
    font-weight: 700;
    color: var(--color-text-primary, #111827);
  }

  .summary-badge {
    background: var(--color-primary-50, #eff6ff);
    color: var(--color-primary-800, #1e40af);
    padding: 0.25rem 0.75rem;
    border-radius: 999px;
    font-size: 0.8125rem;
    font-weight: 500;
    border: 1px solid var(--color-primary-200, #bfdbfe);
  }

  .summary-kpis-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 1rem;
  }

  .summary-kpi-tile {
    background: var(--color-bg-subtle, #f9fafb);
    border: 1px solid var(--color-border-subtle, #e5e7eb);
    border-radius: var(--radius-md, 8px);
    padding: 0.875rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .tile-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 0.8125rem;
  }

  .tile-name {
    font-weight: 600;
    color: var(--color-text-secondary, #374151);
  }

  .tile-values {
    font-variant-numeric: tabular-nums;
    color: var(--color-text-muted, #6b7280);
  }

  .tile-values strong {
    color: var(--color-text-primary, #111827);
  }

  .tile-footer {
    display: flex;
    justify-content: flex-end;
  }

  .tile-delta {
    font-size: 0.6875rem;
    font-weight: 600;
  }

  .tile-delta.positive {
    color: #059669;
  }

  .tile-delta.negative {
    color: #dc2626;
  }

  .filters-row {
    display: flex;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .search-wrap {
    flex: 1;
    min-width: 280px;
  }

  .tier-filter-dropdown .form-select {
    padding: 0.5rem 0.875rem;
    border-radius: var(--radius-md, 8px);
    border: 1px solid var(--color-border-subtle, #d1d5db);
    background: var(--color-bg-surface, #ffffff);
    font-size: 0.875rem;
    color: var(--color-text-primary, #111827);
    font-weight: 500;
  }

  .targets-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 1.25rem;
  }

  .loading-state, .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: var(--color-bg-surface, #ffffff);
    border: 1px solid var(--color-border-subtle, #e5e7eb);
    border-radius: var(--radius-lg, 12px);
    padding: 3.5rem 1.5rem;
    text-align: center;
  }

  .spinner {
    width: 36px;
    height: 36px;
    border: 3px solid var(--color-border-subtle, #e5e7eb);
    border-top-color: var(--color-primary-600, #2563eb);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin-bottom: 1rem;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .empty-icon-wrap {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    background: var(--color-bg-subtle, #f3f4f6);
    color: var(--color-text-muted, #9ca3af);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 1rem;
  }

  .empty-title {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 700;
    color: var(--color-text-primary, #111827);
  }

  .empty-desc {
    margin: 0.5rem 0 1.5rem 0;
    font-size: 0.875rem;
    color: var(--color-text-muted, #6b7280);
    max-width: 420px;
  }

  .empty-actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
    justify-content: center;
  }
</style>
