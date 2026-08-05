<script lang="ts">
  import { projectStore } from '$lib/stores/project';
  import { onMount } from 'svelte';
  import { TicketsService } from './tickets.service';
  import type { TicketItem } from './schema';
  import { can } from '$lib/services/roles.service';
  import { activeRoleState, authState } from '$lib/auth.svelte';

  let tickets = $state<TicketItem[]>([]);
  let loading = $state(true);
  let filterStatus = $state('tutti');
  let filterPriority = $state('tutti');
  let viewScope = $state<'tutti' | 'miei'>('miei'); // Default per sicurezza sui ruoli operativi
  let searchQuery = $state('');

  const currentUserUid = $derived(authState.user?.uid || '');
  const currentEmail = $derived(authState.user?.email || '');

  // Verifica se il ruolo attivo è di vertice/amministrazione
  const isExecutiveRole = $derived(
    activeRoleState.role === 'superadmin' ||
    activeRoleState.role === 'amministrazione' ||
    activeRoleState.role === 'direzione'
  );

  onMount(async () => {
    tickets = await TicketsService.getTickets(isExecutiveRole, currentUserUid, currentEmail);
    if (isExecutiveRole) {
      viewScope = 'tutti';
    } else {
      viewScope = 'miei';
    }
    loading = false;
  });

  // Conta i ticket assegnati all'utente corrente
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

<div class="tickets-page">
  <header class="page-header">
    <div>
      <h1 class="page-title">🎟️ Ticket di Assistenza</h1>
      <p class="page-subtitle">Gestione helpdesk, supporto clienti, QR code e KPI risoluzione.</p>
    </div>

    {#if can('tickets:create', activeRoleState.role)}
      <a href="/dashboard/tickets/add" class="btn btn-primary">
        + Apri Nuovo Ticket
      </a>
    {/if}
  </header>

  <!-- KPI Analytics Performance -->
  <div class="kpi-grid">
    <div class="kpi-card">
      <span class="kpi-label">📊 Ticket Totali</span>
      <span class="kpi-value">{kpis.totalTickets}</span>
    </div>
    <div class="kpi-card">
      <span class="kpi-label">🟡 In Lavorazione / Aperti</span>
      <span class="kpi-value">{kpis.openCount + kpis.inProgressCount}</span>
    </div>
    <div class="kpi-card">
      <span class="kpi-label">⏱️ Tempo Medio Risoluzione</span>
      <span class="kpi-value">{kpis.avgResolutionTimeHours} <small>ore</small></span>
    </div>
    <div class="kpi-card">
      <span class="kpi-label">📈 Tasso di Risoluzione</span>
      <span class="kpi-value">{kpis.resolutionRatePercentage}%</span>
    </div>
  </div>

  <!-- Filtri di Vista Rapida (Tutti vs Assegnati a Me) -->
  <div class="scope-tabs-bar">
    {#if isExecutiveRole}
      <button
        type="button"
        class="scope-tab-btn"
        class:active={viewScope === 'tutti'}
        onclick={() => (viewScope = 'tutti')}
      >
        🌐 Tutti i Ticket Aziendali ({tickets.length})
      </button>
    {/if}

    <button
      type="button"
      class="scope-tab-btn"
      class:active={viewScope === 'miei' || !isExecutiveRole}
      onclick={() => (viewScope = 'miei')}
    >
      👤 Assegnati a Me ({myTicketsCount})
    </button>
  </div>

  <!-- Filtri avanzati -->
  <div class="filters-card">
    <div class="filter-item search-item">
      <label for="search" class="filter-label">Cerca Ticket</label>
      <input
        id="search"
        type="text"
        class="form-input"
        placeholder="Cerca per oggetto, cliente, operatore, richiedente..."
        bind:value={searchQuery}
      />
    </div>

    <div class="filter-item">
      <label for="status" class="filter-label">Stato</label>
      <select id="status" class="form-select" bind:value={filterStatus}>
        <option value="tutti">Tutti gli stati</option>
        <option value="aperto">Aperto</option>
        <option value="in_lavorazione">In Lavorazione</option>
        <option value="in_attesa_cliente">In Attesa Cliente</option>
        <option value="risolto">Risolto</option>
        <option value="chiuso">Chiuso</option>
      </select>
    </div>

    <div class="filter-item">
      <label for="priority" class="filter-label">Priorità</label>
      <select id="priority" class="form-select" bind:value={filterPriority}>
        <option value="tutti">Tutte le priorità</option>
        <option value="urgente">Urgente 🔥</option>
        <option value="alta">Alta ⚡</option>
        <option value="media">Media 🔷</option>
        <option value="bassa">Bassa ⚪</option>
      </select>
    </div>
  </div>

  <!-- Contenuto Tabella -->
  {#if loading}
    <div class="loading-box">Caricamento ticket in corso...</div>
  {:else if filteredTickets.length === 0}
    <div class="empty-card">
      <p>Nessun ticket trovato nei filtri attivi.</p>
    </div>
  {:else}
    <div class="table-container">
      <table class="tickets-table">
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
                    <span class="my-ticket-badge">⭐ Assegnato a Te</span>
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
                  {#if ticket.priority === 'urgente'}🔥 URGENTE
                  {:else if ticket.priority === 'alta'}⚡ ALTA
                  {:else if ticket.priority === 'media'}🔷 MEDIA
                  {:else}⚪ BASSA
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
                <a href="/dashboard/tickets/{ticket.id}" class="btn-sm btn-outline">
                  Gestisci ➔
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
    display: flex;
    flex-direction: column;
    gap: 1.2rem;
  }

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 1rem;
  }

  .page-title {
    font-size: 1.6rem;
    font-weight: 700;
    margin: 0;
    color: var(--text-primary, #0f172a);
  }

  .page-subtitle {
    margin: 0.2rem 0 0 0;
    color: var(--text-secondary, #64748b);
    font-size: 0.9rem;
  }

  .kpi-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
  }

  .kpi-card {
    background: var(--bg-surface, #ffffff);
    padding: 1.1rem;
    border-radius: 12px;
    border: 1px solid var(--border-color, #e2e8f0);
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  }

  .kpi-label {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--text-secondary, #64748b);
  }

  .kpi-value {
    font-size: 1.6rem;
    font-weight: 800;
    color: var(--text-primary, #0f172a);
  }

  .kpi-value small {
    font-size: 0.9rem;
    font-weight: 500;
    color: var(--text-secondary, #64748b);
  }

  .scope-tabs-bar {
    display: flex;
    gap: 0.5rem;
    border-bottom: 2px solid var(--border-color, #e2e8f0);
    padding-bottom: 0.5rem;
  }

  .scope-tab-btn {
    padding: 0.5rem 1rem;
    border-radius: 8px;
    font-weight: 600;
    font-size: 0.88rem;
    border: none;
    background: transparent;
    color: var(--text-secondary, #64748b);
    cursor: pointer;
    transition: all 0.2s;
  }

  .scope-tab-btn:hover {
    background-color: var(--bg-hover, #f1f5f9);
    color: var(--text-primary, #0f172a);
  }

  .scope-tab-btn.active {
    background-color: var(--primary, #3b82f6);
    color: #ffffff;
  }

  .btn {
    padding: 0.6rem 1.2rem;
    border-radius: 8px;
    font-weight: 600;
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
  }

  .btn-primary { background-color: var(--primary, #3b82f6); color: #ffffff; border: none; }
  .btn-primary:hover { background-color: #2563eb; }

  .filters-card {
    display: flex;
    gap: 1rem;
    background-color: var(--bg-surface, #ffffff);
    padding: 1.2rem;
    border-radius: 12px;
    border: 1px solid var(--border-color, #e2e8f0);
    flex-wrap: wrap;
  }

  .filter-item { display: flex; flex-direction: column; gap: 0.3rem; }
  .search-item { flex: 1; min-width: 240px; }
  .filter-label { font-size: 0.78rem; font-weight: 600; color: var(--text-secondary, #64748b); text-transform: uppercase; }

  .form-input, .form-select {
    padding: 0.55rem 0.8rem;
    border-radius: 8px;
    border: 1px solid var(--border-color, #e2e8f0);
    background-color: var(--bg-body, #f8fafc);
    color: var(--text-primary, #0f172a);
    font-size: 0.88rem;
  }

  .table-container {
    background-color: var(--bg-surface, #ffffff);
    border-radius: 12px;
    border: 1px solid var(--border-color, #e2e8f0);
    overflow-x: auto;
  }

  .tickets-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.9rem;
    text-align: left;
  }

  .tickets-table th, .tickets-table td {
    padding: 0.9rem 1.1rem;
    border-bottom: 1px solid var(--border-color, #e2e8f0);
    white-space: nowrap;
    vertical-align: middle;
  }

  .tickets-table th {
    background-color: var(--bg-header, #f8fafc);
    font-weight: 600;
    color: var(--text-secondary, #64748b);
    font-size: 0.8rem;
    text-transform: uppercase;
    white-space: nowrap;
  }

  .row-my-ticket { background-color: #f0f9ff40; }
  .subject-box { display: flex; flex-direction: column; gap: 0.2rem; }
  .col-subject { font-weight: 600; white-space: normal; min-width: 200px; }
  .subject-link { color: var(--primary, #3b82f6); text-decoration: none; }
  .subject-link:hover { text-decoration: underline; }

  .my-ticket-badge {
    display: inline-flex;
    align-items: center;
    font-size: 0.72rem;
    background-color: #fef3c7;
    color: #92400e;
    padding: 0.1rem 0.4rem;
    border-radius: 4px;
    font-weight: 700;
    width: fit-content;
    white-space: nowrap;
  }

  .requester-info { display: flex; flex-direction: column; }
  .client-name { font-weight: 500; color: var(--text-primary, #0f172a); white-space: nowrap; }
  .requester-sub { font-size: 0.78rem; color: var(--text-secondary, #64748b); white-space: nowrap; }
  .assignee-tag { font-size: 0.85rem; font-weight: 500; color: var(--text-primary, #334155); white-space: nowrap; }

  .priority-pill {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 0.25rem 0.6rem;
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 800;
    white-space: nowrap;
  }
  .priority-urgente { background-color: #fee2e2; color: #991b1b; }
  .priority-alta { background-color: #ffedd5; color: #9a3412; }
  .priority-media { background-color: #e0f2fe; color: #075985; }
  .priority-bassa { background-color: #f1f5f9; color: #475569; }

  .status-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 0.25rem 0.65rem;
    border-radius: 20px;
    font-size: 0.78rem;
    font-weight: 600;
    text-transform: capitalize;
    white-space: nowrap;
  }
  .badge-open { background-color: #dbeafe; color: #1e40af; }
  .badge-progress { background-color: #fef3c7; color: #92400e; }
  .badge-waiting { background-color: #e0e7ff; color: #3730a3; }
  .badge-resolved { background-color: #dcfce7; color: #166534; }
  .badge-closed { background-color: #f1f5f9; color: #64748b; }

  .text-right { text-align: right; }
  .btn-sm { padding: 0.35rem 0.7rem; border-radius: 6px; font-size: 0.82rem; font-weight: 500; text-decoration: none; }
  .btn-outline { border: 1px solid var(--border-color, #cbd5e1); color: var(--text-primary, #334155); }
  .btn-outline:hover { background-color: var(--bg-hover, #f8fafc); }
  .loading-box, .empty-card { text-align: center; padding: 3rem; background-color: var(--bg-surface, #ffffff); border-radius: 12px; color: var(--text-secondary, #64748b); }
</style>
