<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { 
    TrendingUp, 
    TrendingDown,
    Plus, 
    Search, 
    Filter, 
    Briefcase, 
    Building2, 
    MapPin, 
    Calculator, 
    ArrowRight,
    Eye,
    Calendar,
    AlertCircle,
    X
  } from '@lucide/svelte';
  import { JobCostingService } from './jobCosting.service';
  import { JobCostingKPIBridge } from './jobCosting.kpi.bridge';
  import type { JobCostingProject } from './schema';
  import { formatCurrency } from '$lib/utils/math';
  import JobHealthBadge from './components/JobHealthBadge.svelte';
  import JobBudgetProgressBar from './components/JobBudgetProgressBar.svelte';

  let projects = $state<JobCostingProject[]>([]);
  let loading = $state(true);
  let searchQuery = $state('');
  let statusFilter = $state('all');
  let healthFilter = $state('all');

  let kpiData = $derived(JobCostingKPIBridge.calculateKPIs(projects));

  let filteredProjects = $derived(
    projects.filter(p => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch = !q || 
        (p.code || '').toLowerCase().includes(q) ||
        (p.title || '').toLowerCase().includes(q) ||
        (p.placeName || '').toLowerCase().includes(q) ||
        (p.clientName || '').toLowerCase().includes(q);

      const matchStatus = statusFilter === 'all' || p.status === statusFilter;
      const matchHealth = healthFilter === 'all' || p.profitability?.healthStatus === healthFilter;

      return matchSearch && matchStatus && matchHealth;
    })
  );

  onMount(async () => {
    await loadData();
  });

  async function loadData() {
    loading = true;
    try {
      projects = await JobCostingService.getProjects();
    } catch (e) {
      console.error('Errore caricamento commesse:', e);
    } finally {
      loading = false;
    }
  }

  function getStatusLabel(s: string): string {
    switch (s) {
      case 'pianificata': return 'Pianificata';
      case 'in_corso': return 'In Corso';
      case 'completata': return 'Completata';
      case 'chiusa': return 'Chiusa';
      case 'sospesa': return 'Sospesa';
      default: return s;
    }
  }
</script>

<div class="job-costing-page animate-fade-in">
  <!-- 1. Page Top Actions Bar (Principio 12) -->
  <div class="page-top-actions">
    <div class="page-title-group">
      <div class="title-with-icon">
        <div class="header-icon-box">
          <TrendingUp size={22} class="text-primary" />
        </div>
        <div>
          <h1 class="page-title">Controllo di Gestione</h1>
          <p class="page-subtitle">Monitoraggio marginalità, budget preventivo vs consuntivo e redditività cantieri</p>
        </div>
      </div>
    </div>

    <div class="actions-group">
      <a href="/dashboard/job_costing/add" class="btn btn-primary" title="Crea nuova commessa">
        <Plus size={16} />
        <span>Nuova Commessa</span>
      </a>
    </div>
  </div>

  <!-- KPI Summary Cards -->
  <div class="kpi-grid-row">
    <div class="kpi-card">
      <div class="kpi-icon-wrapper blue">
        <Briefcase size={20} />
      </div>
      <div class="kpi-body">
        <span class="kpi-label">Valore Totale Commesse</span>
        <span class="kpi-value">{formatCurrency(kpiData.valore_totale_commesse)}</span>
        <span class="kpi-sub">{kpiData.commesse_attive_count} cantieri e lavori attivi</span>
      </div>
    </div>

    <div class="kpi-card">
      <div class="kpi-icon-wrapper amber">
        <Calculator size={20} />
      </div>
      <div class="kpi-body">
        <span class="kpi-label">Spesa Consuntivata</span>
        <span class="kpi-value">{formatCurrency(kpiData.costi_totali_consuntivati)}</span>
        <span class="kpi-sub">Manodopera, materiali FIFO e mezzi</span>
      </div>
    </div>

    <div class="kpi-card">
      <div class="kpi-icon-wrapper green">
        <TrendingUp size={20} />
      </div>
      <div class="kpi-body">
        <span class="kpi-label">Margine Medio Cumulato</span>
        <span class="kpi-value">{kpiData.margine_medio_percent}%</span>
        <span class="kpi-sub">Utile stimato: {formatCurrency(kpiData.margine_lordo_totale)}</span>
      </div>
    </div>

    {#if kpiData.commesse_in_allerta > 0}
      <div class="kpi-card alert">
        <div class="kpi-icon-wrapper red">
          <AlertCircle size={20} />
        </div>
        <div class="kpi-body">
          <span class="kpi-label">Allerta Budget / Perdita</span>
          <span class="kpi-value text-danger">{kpiData.commesse_in_allerta}</span>
          <span class="kpi-sub">{kpiData.commesse_in_perdita} commesse in rosso</span>
        </div>
      </div>
    {/if}
  </div>

  <!-- 2. Centralized Search Toolbar (Principio 12) -->
  <div class="search-toolbar card">
    <div class="search-input-group">
      <Search size={16} class="search-icon" />
      <input 
        type="text" 
        placeholder="Cerca per codice, titolo, cantiere o cliente..." 
        bind:value={searchQuery}
        class="form-control search-input"
      />
      {#if searchQuery}
        <button class="btn-clear" onclick={() => searchQuery = ''} aria-label="Cancella ricerca"><X size={14} /></button>
      {/if}
    </div>

    <div class="filters-group">
      <div class="filter-item">
        <label for="statusFilter" class="filter-label">Stato:</label>
        <select id="statusFilter" bind:value={statusFilter} class="form-control select-filter">
          <option value="all">Tutti gli stati</option>
          <option value="in_corso">In Corso</option>
          <option value="pianificata">Pianificata</option>
          <option value="completata">Completata</option>
          <option value="chiusa">Chiusa (Snapshot)</option>
        </select>
      </div>

      <div class="filter-item">
        <label for="healthFilter" class="filter-label">Margine:</label>
        <select id="healthFilter" bind:value={healthFilter} class="form-control select-filter">
          <option value="all">Tutti</option>
          <option value="healthy">In Utile (>20%)</option>
          <option value="warning">A Rischio (10-20%)</option>
          <option value="critical">Critico / Perdita</option>
        </select>
      </div>
    </div>
  </div>

  <!-- 3. Data Card (Table) -->
  <div class="card data-card">
    {#if loading}
      <div class="loading-state">
        <div class="spinner"></div>
        <p>Caricamento commesse e indicatori di redditività...</p>
      </div>
    {:else if filteredProjects.length === 0}
      <div class="empty-state">
        <Briefcase size={44} class="text-muted" />
        <h3>Nessuna commessa trovata</h3>
        <p>Crea la prima commessa di cantiere per iniziare a monitorare i costi e la marginalità.</p>
        <a href="/dashboard/job_costing/add" class="btn btn-primary btn-sm">
          <Plus size={14} />
          <span>Nuova Commessa</span>
        </a>
      </div>
    {:else}
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Codice & Titolo</th>
              <th>Cantiere / Luogo</th>
              <th>Cliente</th>
              <th>Stato</th>
              <th class="text-right">Valore Target</th>
              <th style="min-width: 170px;">Costi & Budget</th>
              <th class="text-right">Margine</th>
              <th class="text-center">Azioni</th>
            </tr>
          </thead>
          <tbody>
            {#each filteredProjects as p (p.id)}
              <tr class="table-row" onclick={() => goto(`/dashboard/job_costing/${p.id}`)}>
                <td>
                  <div class="cell-code-title">
                    <span class="project-code">{p.code}</span>
                    <strong class="project-title">{p.title}</strong>
                  </div>
                </td>

                <td>
                  {#if p.placeName}
                    <div class="cell-icon-text">
                      <MapPin size={14} class="text-muted" />
                      <span>{p.placeName}</span>
                    </div>
                  {:else}
                    <span class="text-muted italic">Non associato</span>
                  {/if}
                </td>

                <td>
                  {#if p.clientName}
                    <div class="cell-icon-text">
                      <Building2 size={14} class="text-muted" />
                      <span>{p.clientName}</span>
                    </div>
                  {:else}
                    <span class="text-muted italic">—</span>
                  {/if}
                </td>

                <td>
                  <span class="badge-status {p.status}">
                    {getStatusLabel(p.status)}
                  </span>
                </td>

                <td class="text-right font-medium">
                  {formatCurrency(p.revenues?.contractValue || p.revenues?.invoicedTotal || 0)}
                </td>

                <td>
                  <JobBudgetProgressBar spent={p.actuals?.total || 0} budget={p.budget?.total || 0} />
                </td>

                <td class="text-right">
                  <div class="cell-margin">
                    <JobHealthBadge status={p.profitability?.healthStatus} marginPercent={p.profitability?.grossMarginPercent || 0} />
                    <span class="margin-amount" class:negative={p.profitability?.isLossMaking}>
                      {formatCurrency(p.profitability?.grossMarginAmount || 0)}
                    </span>
                  </div>
                </td>

                <td class="text-center" onclick={e => e.stopPropagation()}>
                  <a href="/dashboard/job_costing/{p.id}" class="btn-action" title="Vedi radiografia economica">
                    <ArrowRight size={15} />
                  </a>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>
</div>

<style>
  .job-costing-page {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    width: 100%;
  }

  .page-top-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 1rem;
  }

  .title-with-icon {
    display: flex;
    align-items: center;
    gap: 0.85rem;
  }

  .header-icon-box {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    background: rgba(59, 130, 246, 0.1);
    color: #3b82f6;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .page-title {
    font-size: 1.5rem;
    font-weight: 700;
    margin: 0;
    color: var(--color-text-main, #0f172a);
  }

  .page-subtitle {
    font-size: 0.875rem;
    color: var(--color-text-muted, #64748b);
    margin: 0.15rem 0 0 0;
  }

  .kpi-grid-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 1rem;
  }

  .kpi-card {
    background: var(--color-surface, #ffffff);
    border: 1px solid var(--color-border, #e2e8f0);
    border-radius: 14px;
    padding: 1.1rem;
    display: flex;
    align-items: center;
    gap: 1rem;
    box-shadow: 0 1px 3px rgba(0,0,0,0.03);
  }

  .kpi-card.alert {
    border-color: rgba(239, 68, 68, 0.3);
    background: rgba(239, 68, 68, 0.02);
  }

  .kpi-icon-wrapper {
    width: 44px;
    height: 44px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .kpi-icon-wrapper.blue { background: rgba(59, 130, 246, 0.12); color: #2563eb; }
  .kpi-icon-wrapper.amber { background: rgba(245, 158, 11, 0.12); color: #d97706; }
  .kpi-icon-wrapper.green { background: rgba(16, 185, 129, 0.12); color: #059669; }
  .kpi-icon-wrapper.red { background: rgba(239, 68, 68, 0.12); color: #dc2626; }

  .kpi-body {
    display: flex;
    flex-direction: column;
  }

  .kpi-label {
    font-size: 0.75rem;
    color: var(--color-text-muted, #64748b);
    text-transform: uppercase;
    font-weight: 600;
    letter-spacing: 0.025em;
  }

  .kpi-value {
    font-size: 1.35rem;
    font-weight: 700;
    color: var(--color-text-main, #0f172a);
    line-height: 1.2;
    margin: 0.2rem 0;
  }

  .kpi-sub {
    font-size: 0.75rem;
    color: var(--color-text-muted, #64748b);
  }

  .search-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 1rem;
    padding: 0.85rem 1.15rem;
    background: var(--color-surface, #ffffff);
    border: 1px solid var(--color-border, #e2e8f0);
    border-radius: 12px;
  }

  .search-input-group {
    position: relative;
    flex: 1;
    min-width: 260px;
  }

  .search-icon {
    position: absolute;
    left: 0.85rem;
    top: 50%;
    transform: translateY(-50%);
    color: var(--color-text-muted, #94a3b8);
  }

  .search-input {
    padding-left: 2.35rem;
    padding-right: 2rem;
    width: 100%;
  }

  .btn-clear {
    position: absolute;
    right: 0.75rem;
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    color: var(--color-text-muted, #94a3b8);
    cursor: pointer;
  }

  .filters-group {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .filter-item {
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }

  .filter-label {
    font-size: 0.8rem;
    color: var(--color-text-muted, #64748b);
  }

  .select-filter {
    padding: 0.35rem 0.65rem;
    font-size: 0.825rem;
    border-radius: 8px;
  }

  .data-card {
    background: var(--color-surface, #ffffff);
    border: 1px solid var(--color-border, #e2e8f0);
    border-radius: 14px;
    overflow: hidden;
    padding: 0;
  }

  .table-responsive {
    overflow-x: auto;
    width: 100%;
  }

  .data-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;
  }

  .data-table th {
    background: var(--color-bg-subtle, #f8fafc);
    color: var(--color-text-muted, #475569);
    font-weight: 600;
    padding: 0.85rem 1rem;
    border-bottom: 1px solid var(--color-border, #e2e8f0);
    text-align: left;
    white-space: nowrap;
  }

  .data-table td {
    padding: 0.9rem 1rem;
    border-bottom: 1px solid var(--color-border, #f1f5f9);
    color: var(--color-text-main, #1e293b);
    vertical-align: middle;
  }

  .table-row {
    cursor: pointer;
    transition: background-color 0.15s ease;
  }

  .table-row:hover {
    background-color: var(--color-bg-subtle, #f8fafc);
  }

  .cell-code-title {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }

  .project-code {
    font-size: 0.75rem;
    font-weight: 700;
    color: var(--color-primary-600, #2563eb);
    letter-spacing: 0.02em;
  }

  .project-title {
    font-size: 0.875rem;
    color: var(--color-text-main, #0f172a);
  }

  .cell-icon-text {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.85rem;
  }

  .badge-status {
    display: inline-block;
    padding: 0.25rem 0.55rem;
    border-radius: 9999px;
    font-size: 0.725rem;
    font-weight: 600;
  }

  .badge-status.in_corso { background: rgba(59, 130, 246, 0.1); color: #2563eb; }
  .badge-status.pianificata { background: rgba(100, 116, 139, 0.1); color: #475569; }
  .badge-status.completata { background: rgba(16, 185, 129, 0.1); color: #059669; }
  .badge-status.chiusa { background: rgba(107, 114, 128, 0.12); color: #374151; }
  .badge-status.sospesa { background: rgba(239, 68, 68, 0.1); color: #dc2626; }

  .cell-margin {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 0.2rem;
  }

  .margin-amount {
    font-size: 0.775rem;
    font-weight: 600;
    color: #059669;
  }

  .margin-amount.negative {
    color: #dc2626;
  }

  .btn-action {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background: var(--color-bg-subtle, #f1f5f9);
    color: var(--color-text-main, #334155);
    transition: all 0.15s ease;
  }

  .btn-action:hover {
    background: #3b82f6;
    color: #ffffff;
  }

  .loading-state, .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem 1.5rem;
    text-align: center;
    gap: 0.75rem;
  }

  .text-right { text-align: right; }
  .text-center { text-align: center; }
  .font-medium { font-weight: 600; }
  .italic { font-style: italic; }
</style>
