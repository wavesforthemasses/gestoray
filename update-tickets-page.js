const fs = require('fs');
const content = `<script lang="ts">
  import { projectStore } from '$lib/stores/project';
  import { onMount } from 'svelte';
  import { TicketsService } from './tickets.service';
  import type { TicketItem } from './schema';
  import { can } from '$lib/services/roles.service';
  import { activeRoleState, authState } from '$lib/auth.svelte';
  import { 
    Ticket, 
    Plus, 
    CheckCircle2, 
    AlertTriangle, 
    Clock, 
    BarChart3,
    ArrowRight
  } from '@lucide/svelte';
  import { SearchToolbar, FilterSelect, UniversalAnalyticsChart, ChartSettingsService } from '$lib';
  import { DashboardService } from '../dashboard.service';

  let tickets = $state<TicketItem[]>([]);
  let loading = $state(true);
  let filterStatus = $state('tutti');
  let filterPriority = $state('tutti');
  let viewScope = $state<'tutti' | 'miei'>('miei'); 
  let searchQuery = $state('');

  const currentUserUid = $derived(authState.user?.uid || '');
  const currentEmail = $derived(authState.user?.email || '');

  const isExecutiveRole = $derived(
    activeRoleState.role === 'superadmin' ||
    activeRoleState.role === 'amministrazione' ||
    activeRoleState.role === 'direzione'
  );

  // --- CHART STATE ---
  let activeChartTab = $state<string>('ticket_aperti');
  let granularity = $state<'settimanale' | 'mensile' | 'annuale'>('mensile');
  let endDateString = $state(new Date().toISOString().split('T')[0]);
  let isGraphExpanded = $state(false);
  let selectedPointIdx = $state<number | null>(null);
  let chartPeriods = $state<Array<{ start: Date; end: Date; label: string }>>([]);
  let loadingChart = $state(false);
  let computedChartPoints = $state<number[]>([]);

  let activeEntityConfig = $derived(ChartSettingsService.getEntityConfigSync('tickets'));
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
      console.error("Error loading tickets chart data:", e);
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

  onMount(async () => {
    tickets = await TicketsService.getTickets(isExecutiveRole, currentUserUid, currentEmail);
    if (isExecutiveRole) {
      viewScope = 'tutti';
    } else {
      viewScope = 'miei';
    }
    loading = false;
  });

  const myTicketsCount = $derived(
    tickets.filter(t => isMyTicket(t)).length
  );

  function isMyTicket(t: TicketItem): boolean {
    if (!currentUserUid && !currentEmail) return false;
    const isCreatedByMe = !!(currentUserUid && (t.createdBy === currentUserUid || t.requesterUid === currentUserUid));
    const isAssigned = !!(currentUserUid && t.assignedTo === currentUserUid);
    const isRequester = !!(currentEmail && t.requesterEmail && t.requesterEmail.toLowerCase() === currentEmail.toLowerCase());
    return isCreatedByMe || isAssigned || isRequester;
  }

  const filteredTickets = $derived(
    tickets.filter(t => {
      if ((!isExecutiveRole || viewScope === 'miei') && !isMyTicket(t)) {
        return false;
      }
      if (filterStatus !== 'tutti' && t.status !== filterStatus) return false;
      if (filterPriority !== 'tutti' && t.priority !== filterPriority) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchSubject = t.subject.toLowerCase().includes(q);
        const matchClient = (t.clientName || '').toLowerCase().includes(q);
        const matchRequester = (t.requesterName || '').toLowerCase().includes(q);
        const matchAssignee = (t.assignedToName || '').toLowerCase().includes(q);
        if (!matchSubject && !matchClient && !matchRequester && !matchAssignee) return false;
      }
      return true;
    })
  );

  const kpis = $derived(TicketsService.computeKPIs(filteredTickets));

  function getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'aperto': return 'badge-open';
      case 'in_lavorazione': return 'badge-progress';
      case 'in_attesa_cliente': return 'badge-waiting';
      case 'risolto': return 'badge-resolved';
      case 'chiuso': return 'badge-closed';
      default: return '';
    }
  }

  function getPriorityBadgeClass(priority: string): string {
    switch (priority) {
      case 'urgente': return 'priority-urgente';
      case 'alta': return 'priority-alta';
      case 'media': return 'priority-media';
      case 'bassa': return 'priority-bassa';
      default: return '';
    }
  }
</script>

<svelte:head>
  <title>Ticket di Assistenza | {$projectStore?.projectName || 'ERP'}</title>
</svelte:head>

<div class="tickets-page animate-fade-in">
  <div class="page-top-actions">
    <div>
      <h2 class="title-header">
        <Ticket size={28} color="var(--color-primary-600)" />
        Ticket di Assistenza
      </h2>
      <p class="subtitle">Gestione helpdesk, supporto clienti, QR code e KPI risoluzione.</p>
    </div>

    <div class="header-btns">
      {#if can('tickets:create', activeRoleState.role)}
        <a href="/dashboard/tickets/add" class="btn-primary">
          <Plus size={18} /> Apri Nuovo Ticket
        </a>
      {/if}
    </div>
  </div>

  <div class="kpi-grid">
    <div class="kpi-card">
      <div class="kpi-icon-wrapper kpi-primary">
        <BarChart3 size={22} />
      </div>
      <div>
        <div class="kpi-value">{kpis.totalTickets}</div>
        <div class="kpi-label">Ticket Totali</div>
      </div>
    </div>

    <div class="kpi-card">
      <div class="kpi-icon-wrapper kpi-warning">
        <AlertTriangle size={22} />
      </div>
      <div>
        <div class="kpi-value">{kpis.openCount + kpis.inProgressCount}</div>
        <div class="kpi-label">In Lavorazione / Aperti</div>
      </div>
    </div>

    <div class="kpi-card">
      <div class="kpi-icon-wrapper kpi-info">
        <Clock size={22} />
      </div>
      <div>
        <div class="kpi-value">{kpis.avgResolutionTimeHours} <span class="kpi-currency">ore</span></div>
        <div class="kpi-label">Tempo Medio Risoluzione</div>
      </div>
    </div>

    <div class="kpi-card">
      <div class="kpi-icon-wrapper kpi-success">
        <CheckCircle2 size={22} />
      </div>
      <div>
        <div class="kpi-value">{kpis.resolutionRatePercentage}%</div>
        <div class="kpi-label">Tasso di Risoluzione</div>
      </div>
    </div>
  </div>

  {#if activeEntityConfig?.enabled}
    <UniversalAnalyticsChart
      entityId="tickets"
      chartSettings={ChartSettingsService.getSettingsSync()}
      availableMetrics={availableChartMetrics}
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
  {/if}

  <div class="scope-tabs-bar" style="display: flex; gap: 8px; margin: 16px 0;">
    {#if isExecutiveRole}
      <button
        type="button"
        class="btn-tab {viewScope === 'tutti' ? 'active' : ''}"
        onclick={() => (viewScope = 'tutti')}
      >
        Tutti i Ticket Aziendali ({tickets.length})
      </button>
    {/if}

    <button
      type="button"
      class="btn-tab {viewScope === 'miei' || !isExecutiveRole ? 'active' : ''}"
      onclick={() => (viewScope = 'miei')}
    >
      Assegnati a Me ({myTicketsCount})
    </button>
  </div>

  <SearchToolbar
    bind:searchQuery
    placeholder="Cerca per oggetto, cliente, operatore, richiedente..."
  >
    {#snippet filters()}
      <FilterSelect
        label="Stato"
        bind:value={filterStatus}
        options={[
          { value: 'tutti', label: 'Tutti gli stati' },
          { value: 'aperto', label: 'Aperto' },
          { value: 'in_lavorazione', label: 'In Lavorazione' },
          { value: 'in_attesa_cliente', label: 'In Attesa Cliente' },
          { value: 'risolto', label: 'Risolto' },
          { value: 'chiuso', label: 'Chiuso' }
        ]}
      />
      <FilterSelect
        label="Priorità"
        bind:value={filterPriority}
        options={[
          { value: 'tutti', label: 'Tutte le priorità' },
          { value: 'urgente', label: 'Urgente' },
          { value: 'alta', label: 'Alta' },
          { value: 'media', label: 'Media' },
          { value: 'bassa', label: 'Bassa' }
        ]}
      />
    {/snippet}
  </SearchToolbar>

  {#if loading}
    <div class="loading-box">Caricamento ticket in corso...</div>
  {:else if filteredTickets.length === 0}
    <div class="empty-card">
      <p>Nessun ticket trovato nei filtri attivi.</p>
    </div>
  {:else}
    <div class="table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>Oggetto</th>
            <th>Cliente / Richiedente</th>
            <th>Operatore Assegnato</th>
            <th>Priorità</th>
            <th>Stato</th>
            <th>Data Apertura</th>
            <th class="text-right">Azione</th>
          </tr>
        </thead>
        <tbody>
          {#each filteredTickets as ticket}
            <tr class:row-my-ticket={isMyTicket(ticket)}>
              <td class="col-subject">
                <div class="subject-box">
                  <a href="/dashboard/tickets/{ticket.id}" class="subject-link">
                    {ticket.subject}
                  </a>
                  {#if isMyTicket(ticket)}
                    <span class="my-ticket-badge">Assegnato a Te</span>
                  {/if}
                </div>
              </td>
              <td>
                <div class="requester-info">
                  <span class="client-name">{ticket.clientName || 'Generico'}</span>
                  {#if ticket.requesterName}
                    <span class="requester-sub">{ticket.requesterName}</span>
                  {/if}
                </div>
              </td>
              <td>
                <span class="assignee-tag">
                  {ticket.assignedToName || 'Non Assegnato'}
                </span>
              </td>
              <td>
                <span class="priority-pill {getPriorityBadgeClass(ticket.priority)}">
                  {#if ticket.priority === 'urgente'}URGENTE
                  {:else if ticket.priority === 'alta'}ALTA
                  {:else if ticket.priority === 'media'}MEDIA
                  {:else}BASSA
                  {/if}
                </span>
              </td>
              <td>
                <span class="status-badge {getStatusBadgeClass(ticket.status)}">
                  {ticket.status.replace(/_/g, ' ')}
                </span>
              </td>
              <td class="col-date">
                {ticket.createdAt ? new Date(ticket.createdAt).toLocaleDateString('it-IT') : '-'}
              </td>
              <td class="text-right">
                <a href="/dashboard/tickets/{ticket.id}" class="action-btn">
                  Gestisci <ArrowRight size={14} />
                </a>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>

<style>
  .tickets-page {
    width: 100%;
  }

  .page-top-actions {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 24px;
    flex-wrap: wrap;
    gap: 16px;
  }

  .title-header {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 24px;
    font-weight: 700;
    color: var(--color-neutral-900, #0f172a);
    margin: 0 0 4px 0;
  }

  .subtitle {
    color: var(--color-neutral-500, #64748b);
    font-size: 14px;
    margin: 0;
  }

  .header-btns {
    display: flex;
    gap: 12px;
  }

  .btn-primary {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: var(--color-primary-600, #2563eb);
    color: white;
    padding: 10px 20px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    text-decoration: none;
    transition: all 0.2s;
  }
  .btn-primary:hover {
    background: var(--color-primary-700, #1d4ed8);
  }

  .kpi-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 16px;
    margin-bottom: 24px;
  }

  .kpi-card {
    background: var(--color-surface, #ffffff);
    border: 1px solid var(--color-neutral-200, #e2e8f0);
    border-radius: 12px;
    padding: 20px;
    display: flex;
    align-items: center;
    gap: 16px;
    transition: transform 0.2s, box-shadow 0.2s;
  }
  .kpi-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  }

  .kpi-icon-wrapper {
    width: 48px;
    height: 48px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .kpi-primary { background: #eff6ff; color: #2563eb; }
  .kpi-success { background: #f0fdf4; color: #16a34a; }
  .kpi-warning { background: #fffbeb; color: #d97706; }
  .kpi-info { background: #f0f9ff; color: #0284c7; }

  .kpi-value {
    font-size: 24px;
    font-weight: 700;
    color: var(--color-neutral-900, #0f172a);
    line-height: 1.2;
  }

  .kpi-label {
    font-size: 13px;
    color: var(--color-neutral-500, #64748b);
    font-weight: 500;
    margin-top: 4px;
  }

  .kpi-currency {
    font-size: 14px;
    color: var(--color-neutral-400, #94a3b8);
  }

  .btn-tab {
    padding: 8px 16px;
    border-radius: 8px;
    font-weight: 600;
    font-size: 14px;
    border: 1px solid var(--color-neutral-200, #e2e8f0);
    background: var(--color-surface, #ffffff);
    color: var(--color-neutral-600, #475569);
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-tab:hover {
    background-color: var(--color-neutral-50, #f8fafc);
  }

  .btn-tab.active {
    background-color: var(--color-primary-600, #2563eb);
    color: #ffffff;
    border-color: var(--color-primary-600, #2563eb);
  }

  .table-container {
    background: var(--color-surface, #ffffff);
    border: 1px solid var(--color-neutral-200, #e2e8f0);
    border-radius: 12px;
    overflow-x: auto;
  }

  .data-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
    text-align: left;
  }

  .data-table th, .data-table td {
    padding: 16px;
    border-bottom: 1px solid var(--color-neutral-200, #e2e8f0);
    white-space: nowrap;
    vertical-align: middle;
  }

  .data-table th {
    background: var(--color-neutral-50, #f8fafc);
    font-weight: 600;
    color: var(--color-neutral-600, #475569);
    font-size: 13px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .row-my-ticket { background-color: var(--color-primary-50, #eff6ff); }
  .subject-box { display: flex; flex-direction: column; gap: 4px; }
  .col-subject { font-weight: 600; white-space: normal; min-width: 200px; }
  .subject-link { color: var(--color-primary-600, #2563eb); text-decoration: none; }
  .subject-link:hover { text-decoration: underline; }

  .my-ticket-badge {
    display: inline-flex;
    align-items: center;
    font-size: 11px;
    background: var(--color-primary-100, #dbeafe);
    color: var(--color-primary-700, #1d4ed8);
    padding: 2px 6px;
    border-radius: 4px;
    font-weight: 600;
    width: fit-content;
  }

  .requester-info { display: flex; flex-direction: column; gap: 2px; }
  .client-name { font-weight: 500; color: var(--color-neutral-900, #0f172a); }
  .requester-sub { font-size: 12px; color: var(--color-neutral-500, #64748b); }
  .assignee-tag { font-size: 13px; font-weight: 500; color: var(--color-neutral-700, #334155); }

  .priority-pill {
    display: inline-flex;
    align-items: center;
    padding: 4px 10px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 700;
  }
  .priority-urgente { background: #fee2e2; color: #991b1b; }
  .priority-alta { background: #ffedd5; color: #9a3412; }
  .priority-media { background: #e0f2fe; color: #075985; }
  .priority-bassa { background: #f1f5f9; color: #475569; }

  .status-badge {
    display: inline-flex;
    align-items: center;
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 600;
    text-transform: capitalize;
  }
  .badge-open { background: #dbeafe; color: #1e40af; }
  .badge-progress { background: #fef3c7; color: #92400e; }
  .badge-waiting { background: #e0e7ff; color: #3730a3; }
  .badge-resolved { background: #dcfce7; color: #166534; }
  .badge-closed { background: #f1f5f9; color: #64748b; }

  .text-right { text-align: right; }
  
  .action-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 600;
    text-decoration: none;
    border: 1px solid var(--color-neutral-300, #cbd5e1);
    color: var(--color-neutral-700, #334155);
    background: white;
    transition: all 0.2s;
  }
  .action-btn:hover { 
    background: var(--color-neutral-50, #f8fafc);
    border-color: var(--color-neutral-400, #94a3b8);
  }

  .loading-box, .empty-card { 
    text-align: center; 
    padding: 48px; 
    background: var(--color-surface, #ffffff); 
    border-radius: 12px; 
    border: 1px solid var(--color-neutral-200, #e2e8f0);
    color: var(--color-neutral-500, #64748b); 
  }
</style>
`;
fs.writeFileSync('scripts/templates/modules/tickets/files/+page.svelte', content);
