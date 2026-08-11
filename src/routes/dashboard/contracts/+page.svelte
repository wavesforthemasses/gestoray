<script lang="ts">
  import { onMount } from 'svelte';
  import { ContractsService } from './contracts.service';
  import { ContractSettingsService } from './contractSettingsService';
  import type { ContractItem, ContractStatus, ContractSettings } from './schema';
  import { toast } from '$lib/stores/toast.svelte';
  import { Card, SearchToolbar, FilterSelect, UniversalAnalyticsChart, ChartSettingsService } from '$lib';
  import { DashboardService } from '../dashboard.service';
  import { activeRoleState, authState } from '$lib/auth.svelte';
  import { 
    FileText, 
    Plus, 
    CheckCircle2, 
    AlertTriangle, 
    XCircle, 
    PauseCircle, 
    Euro, 
    User, 
    Eye, 
    Edit, 
    Trash2, 
    Filter
  } from '@lucide/svelte';

  let settings = $state<ContractSettings>({
    entityNaming: 'contract',
    prefix: 'CTR-',
    includeYear: true,
    numberPadding: 4,
    lastNumber: 0,
    resetCounterAnnually: true
  });
  let labels = $derived(ContractSettingsService.getLabels(settings));

  let contracts = $state<ContractItem[]>([]);
  let loading = $state(true);
  let searchQuery = $state('');
  let activeStatusTab = $state<'tutti' | ContractStatus>('tutti');

  let activeChartTab = $state<string>('vss');
  let granularity = $state<'settimanale' | 'mensile' | 'annuale'>('mensile');
  let endDateString = $state(new Date().toISOString().split('T')[0]);
  let isGraphExpanded = $state(false);
  let selectedPointIdx = $state<number | null>(null);
  let chartPeriods = $state<Array<{ start: Date; end: Date; label: string }>>([]);
  let loadingChart = $state(false);
  let computedChartPoints = $state<number[]>([]);

  let activeEntityConfig = $derived(ChartSettingsService.getEntityConfigSync('contracts'));
  let availableChartMetrics = $derived(
    (activeEntityConfig?.kpis || []).map(k => ({
      id: k.id,
      label: k.name,
      shortLabel: k.acronym,
      isCurrency: k.isCurrency
    }))
  );

  $effect(() => {
    chartPeriods = DashboardService.generateChartPeriods(endDateString, granularity);
  });

  async function loadChartData() {
    if (!isGraphExpanded || chartPeriods.length === 0) return;
    loadingChart = true;
    try {
      const roleToUse = activeRoleState.role || '';
      const uidToUse = authState.user?.uid || '';
      const results = await DashboardService.fetchChartAggregations(chartPeriods, roleToUse, uidToUse, activeChartTab);
      computedChartPoints = results || chartPeriods.map(() => 0);
    } catch (e) {
      console.error("Error loading contracts chart data:", e);
      computedChartPoints = chartPeriods.map(() => 0);
    } finally {
      loadingChart = false;
    }
  }

  $effect(() => {
    if (isGraphExpanded || granularity || endDateString || activeChartTab) {
      loadChartData();
    }
  });

  function toggleGraph() {
    isGraphExpanded = !isGraphExpanded;
  }

  onMount(async () => {
    try {
      const [s, list] = await Promise.all([
        ContractSettingsService.getSettings(),
        ContractsService.getContracts()
      ]);
      settings = s;
      contracts = list;
    } catch (e) {
      console.error('Errore caricamento:', e);
    } finally {
      loading = false;
    }
  });

  let filteredContracts = $derived(
    contracts.filter(c => {
      const matchSearch = !searchQuery.trim() || 
        c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.contractNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.clientName.toLowerCase().includes(searchQuery.toLowerCase());

      const matchTab = activeStatusTab === 'tutti' || c.status === activeStatusTab;
      return matchSearch && matchTab;
    })
  );

  let activeCount = $derived(contracts.filter(c => c.status === 'attivo').length);
  let expiringCount = $derived(contracts.filter(c => c.status === 'in_scadenza').length);
  let expiredCount = $derived(contracts.filter(c => c.status === 'scaduto').length);
  let totalValue = $derived(contracts.reduce((acc, curr) => acc + (curr.totalAmount || 0), 0));

  async function handleDelete(id?: string) {
    if (!id || !confirm(`Sei sicuro di voler eliminare questo ${labels.singular.toLowerCase()}?`)) return;
    try {
      await ContractsService.deleteContract(id);
      contracts = contracts.filter(c => c.id !== id);
      toast.success(`${labels.singular} eliminato con successo`);
    } catch (err: any) {
      toast.error(`Errore eliminazione ${labels.singular.toLowerCase()}: ` + err.message);
    }
  }

  function getStatusBadge(status: ContractStatus) {
    switch (status) {
      case 'attivo': return { label: labels.activeTabLabel, class: 'badge-success' };
      case 'in_scadenza': return { label: labels.expiringTabLabel, class: 'badge-warning' };
      case 'scaduto': return { label: labels.expiredTabLabel, class: 'badge-danger' };
      case 'sospeso': return { label: 'Sospeso', class: 'badge-neutral' };
      default: return { label: status, class: 'badge-neutral' };
    }
  }
  import { projectStore } from '$lib/stores/project';
</script>

<svelte:head>
  <title>Gestione {labels.plural} | {$projectStore?.projectName || 'ERP'}</title>
</svelte:head>

<div class="contracts-page animate-fade-in">
  <!-- PAGE HEADER -->
  <div class="page-top-actions">
    <div>
      <h2 class="title-header">
        <FileText size={28} color="var(--color-primary-600)" />
        {labels.managementTitle}
      </h2>
      <p class="subtitle">{labels.managementSubtitle}</p>
    </div>

    <div class="header-btns">
      <a href="/dashboard/contracts/add" class="btn-primary">
        <Plus size={18} /> {labels.newSingular}
      </a>
    </div>

  </div>

  <!-- KPI CARDS -->
  <div class="kpi-grid">
    <div class="kpi-card">
      <div class="kpi-icon-wrapper kpi-primary">
        <FileText size={22} />
      </div>
      <div>
        <div class="kpi-value">{contracts.length}</div>
        <div class="kpi-label">{labels.plural} Totali</div>
      </div>
    </div>

    <div class="kpi-card">
      <div class="kpi-icon-wrapper kpi-success">
        <CheckCircle2 size={22} />
      </div>
      <div>
        <div class="kpi-value">{activeCount}</div>
        <div class="kpi-label">{labels.activeTabLabel}</div>
      </div>
    </div>

    <div class="kpi-card">
      <div class="kpi-icon-wrapper kpi-warning">
        <AlertTriangle size={22} />
      </div>
      <div>
        <div class="kpi-value">{expiringCount}</div>
        <div class="kpi-label">{labels.expiringTabLabel}</div>
      </div>
    </div>

    <div class="kpi-card">
      <div class="kpi-icon-wrapper kpi-info">
        <Euro size={22} />
      </div>
      <div>
        <div class="kpi-value">€ {totalValue.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</div>
        <div class="kpi-label">{labels.portfolioLabel}</div>
      </div>
    </div>
  </div>

  <UniversalAnalyticsChart 
    title={`Andamento ${labels.plural} e KPI`}
    description={`Visualizza il trend e clicca su un punto del grafico per filtrare l'elenco dei ${labels.plural.toLowerCase()} in base al periodo selezionato.`}
    metrics={availableChartMetrics.length > 0 ? availableChartMetrics : [
      { id: 'vss', label: 'Valore Venduto (VSS)', shortLabel: 'VSS', isCurrency: true },
      { id: 'nncf', label: 'Primi Ordini (NNCF)', shortLabel: 'NNCF', isCurrency: false }
    ]}
    bind:activeMetric={activeChartTab}
    bind:granularity
    bind:endDateString
    {chartPeriods}
    {computedChartPoints}
    bind:selectedPointIdx
    {loadingChart}
    collapsible={true}
    bind:isExpanded={isGraphExpanded}
  />

  <!-- FILTERS & SEARCH TOOLBAR -->
  <SearchToolbar
    bind:searchQuery
    placeholder={`Cerca ${labels.singular.toLowerCase()} per titolo, numero o cliente...`}
  >
    {#snippet filtersSnippet()}
      <FilterSelect
        bind:value={activeStatusTab}
        icon={Filter}
        options={[
          { value: 'tutti', label: `Tutti gli stati (${contracts.length})` },
          { value: 'attivo', label: `${labels.activeTabLabel} (${activeCount})` },
          { value: 'in_scadenza', label: `${labels.expiringTabLabel} (${expiringCount})` },
          { value: 'scaduto', label: `${labels.expiredTabLabel} (${expiredCount})` },
          { value: 'sospeso', label: 'Sospesi' }
        ]}
      />
    {/snippet}
  </SearchToolbar>

  <!-- CONTRACTS LIST TABLE -->
  {#if loading}
    <div class="loading-state">
      <span class="spinner"></span>
      Caricamento in corso...
    </div>
  {:else if filteredContracts.length === 0}
    <div class="empty-state">
      <FileText size={48} color="var(--color-neutral-400)" />
      <h3>Nessun {labels.singular.toLowerCase()} trovato</h3>
      <p>Crea il tuo primo {labels.singular.toLowerCase()} per tracciare quotazioni e scadenze.</p>
      <a href="/dashboard/contracts/add" class="btn-primary">
        <Plus size={18} /> {labels.newSingular}
      </a>
    </div>
  {:else}
    <Card title={`Elenco ${labels.plural} Registrati`} description={`Elenco completo dei ${labels.plural.toLowerCase()} con dettagli e scadenze.`}>
      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>{labels.numberLabel}</th>
              <th>Titolo & Cliente</th>
              <th>Tipologia</th>
              <th>Frequenza</th>
              <th>Valore Totale</th>
              <th>Scadenza</th>
              <th>Stato</th>
              <th class="text-right">Azioni</th>
            </tr>
          </thead>
          <tbody>
            {#each filteredContracts as c}
              {@const badge = getStatusBadge(c.status)}
              <tr>
                <td class="font-mono">{c.contractNumber}</td>
                <td>
                  <a href="/dashboard/contracts/{c.id}" class="contract-link">
                    {c.title || `${labels.singular} - ${c.clientName}`}
                  </a>
                  <div class="sub-text">
                    <User size={12} /> {c.clientName}
                  </div>
                </td>
                <td><span class="type-pill">{c.type}</span></td>
                <td class="capitalize">{c.billingFrequency}</td>
                <td class="font-bold">€ {(c.totalAmount || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}</td>
                <td>{c.endDate || 'N.D.'}</td>
                <td><span class="badge {badge.class}">{badge.label}</span></td>
                <td class="text-right">
                  <div class="action-buttons">
                    <a href="/dashboard/contracts/{c.id}" class="btn-icon" title="Dettaglio">
                      <Eye size={16} />
                    </a>
                    <a href="/dashboard/contracts/{c.id}/edit" class="btn-icon" title="Modifica">
                      <Edit size={16} />
                    </a>
                    <button type="button" class="btn-icon btn-danger-icon" onclick={() => handleDelete(c.id)} title="Elimina">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </Card>
  {/if}
</div>

<style>
  .contracts-page {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .page-top-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }

  .header-btns {
    display: flex;
    gap: 10px;
    align-items: center;
  }

  .title-header {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 24px;
    font-weight: 700;
    color: var(--color-neutral-900, #111827);
    margin: 0 0 4px 0;
  }

  .subtitle {
    font-size: 14px;
    color: var(--color-neutral-500, #6b7280);
    margin: 0;
  }

  .btn-primary {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: var(--color-primary-600, #2563eb);
    color: white;
    padding: 10px 18px;
    border-radius: var(--radius-md, 8px);
    font-weight: 600;
    text-decoration: none;
    cursor: pointer;
    transition: background 0.2s;
  }

  .btn-secondary {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: var(--color-neutral-100, #f3f4f6);
    color: var(--color-neutral-700, #374151);
    padding: 10px;
    border-radius: var(--radius-md, 8px);
    border: 1px solid var(--color-neutral-300, #d1d5db);
    text-decoration: none;
    cursor: pointer;
  }

  .kpi-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 16px;
  }

  .kpi-card {
    background: var(--color-surface, #ffffff);
    border: 1px solid var(--color-neutral-200, #e5e7eb);
    border-radius: var(--radius-lg, 12px);
    padding: 16px;
    display: flex;
    align-items: center;
    gap: 14px;
    box-shadow: var(--shadow-sm, 0 1px 2px rgba(0,0,0,0.05));
  }

  .kpi-icon-wrapper {
    width: 44px;
    height: 44px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .kpi-primary { background: #eff6ff; color: #2563eb; }
  .kpi-success { background: #dcfce7; color: #16a34a; }
  .kpi-warning { background: #fef3c7; color: #d97706; }
  .kpi-info { background: #f3e8ff; color: #9333ea; }

  .kpi-value {
    font-size: 20px;
    font-weight: 800;
    color: var(--color-neutral-900, #111827);
  }

  .kpi-label {
    font-size: 12px;
    font-weight: 500;
    color: var(--color-neutral-500, #6b7280);
  }

  .table-wrapper {
    overflow-x: auto;
  }

  .data-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
  }

  .data-table th {
    background: var(--color-neutral-50, #f9fafb);
    padding: 12px 16px;
    text-align: left;
    font-size: 12px;
    font-weight: 600;
    color: var(--color-neutral-500, #6b7280);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    border-bottom: 1px solid var(--color-neutral-200, #e5e7eb);
  }

  .data-table td {
    padding: 14px 16px;
    border-bottom: 1px solid var(--color-neutral-200, #e5e7eb);
    color: var(--color-neutral-800, #1f2937);
  }

  .contract-link {
    font-weight: 600;
    color: var(--color-primary-600, #2563eb);
    text-decoration: none;
  }

  .contract-link:hover {
    text-decoration: underline;
  }

  .sub-text {
    font-size: 12px;
    color: var(--color-neutral-500, #6b7280);
    display: flex;
    align-items: center;
    gap: 4px;
    margin-top: 2px;
  }

  .type-pill {
    font-size: 12px;
    font-weight: 500;
    padding: 2px 8px;
    border-radius: 4px;
    background: var(--color-neutral-100, #f3f4f6);
    color: var(--color-neutral-700, #374151);
  }

  .badge {
    font-size: 11px;
    font-weight: 600;
    padding: 3px 8px;
    border-radius: 12px;
    display: inline-block;
  }

  .badge-success { background: #dcfce7; color: #15803d; }
  .badge-warning { background: #fef3c7; color: #b45309; }
  .badge-danger { background: #fee2e2; color: #b91c1c; }
  .badge-neutral { background: #f3f4f6; color: #4b5563; }

  .action-buttons {
    display: flex;
    justify-content: flex-end;
    gap: 6px;
  }

  .btn-icon {
    background: transparent;
    border: none;
    color: var(--color-neutral-500, #6b7280);
    padding: 6px;
    border-radius: 4px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  }

  .btn-icon:hover {
    background: var(--color-neutral-100, #f3f4f6);
    color: var(--color-neutral-900, #111827);
  }

  .btn-danger-icon {
    color: var(--color-red-500, #ef4444);
  }

  .btn-danger-icon:hover {
    background: #fee2e2;
    color: #b91c1c;
  }

  .text-right { text-align: right; }
  .font-mono { font-family: monospace; font-size: 13px; }
  .font-bold { font-weight: 700; }
  .capitalize { text-transform: capitalize; }

  .loading-state, .empty-state {
    background: white;
    border-radius: 12px;
    border: 1px solid var(--color-neutral-200, #e5e7eb);
    padding: 48px 24px;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }
</style>
