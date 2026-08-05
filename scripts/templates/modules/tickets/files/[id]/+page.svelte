<script lang="ts">
  import { projectStore } from '$lib/stores/project';
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { TicketsService } from '../tickets.service';
  import type { TicketItem, TicketMessage } from '../schema';
  import { can } from '$lib/services/roles.service';
  import { activeRoleState } from '$lib/auth.svelte';
  import { db, collection, getDocs } from '$lib/firebase';
  import { TicketSettingsService, type CannedResponseConfig } from '$lib/services/ticketSettings';

  let ticketId = $derived(page.params.id || '');
  let ticket = $state<TicketItem | null>(null);
  let users = $state<{ id: string; name: string; role?: string }[]>([]);
  let cannedResponses = $state<CannedResponseConfig[]>([]);
  let loading = $state(true);
  let updatingStatus = $state(false);
  let updatingAssignee = $state(false);

  // Nuovo messaggio
  let newMessageText = $state('');
  let isInternalNote = $state(false);
  let sendingMessage = $state(false);
  let successToast = $state('');
  let selectedCannedId = $state('');

  onMount(async () => {
    await Promise.all([loadTicketData(), loadUsersData(), loadCannedData()]);
  });

  async function loadTicketData() {
    loading = true;
    ticket = await TicketsService.getTicket(ticketId);
    loading = false;
  }

  async function loadUsersData() {
    try {
      const snapUsers = await getDocs(collection(db, 'users'));
      users = snapUsers.docs.map((d: any) => {
        const data = d.data();
        const orig = data.original || data;
        const nome = orig.nome || orig.firstName || orig.name || '';
        const cognome = orig.cognome || orig.lastName || '';
        const fullName = `${nome} ${cognome}`.trim();
        const name = fullName || orig.displayName || orig.email || 'Utente ' + d.id;
        const role = (orig.roles && orig.roles[0]) || orig.role || '';
        return { id: d.id, name, role };
      });
    } catch (e) {
      console.error('Errore caricamento utenti per dettaglio ticket:', e);
    }
  }

  async function loadCannedData() {
    try {
      const conf = await TicketSettingsService.getSettings();
      cannedResponses = conf.cannedResponses || [];
    } catch (e) {
      console.error('Errore caricamento risposte rapide:', e);
    }
  }

  function handleSelectCanned(e: Event) {
    const target = e.target as HTMLSelectElement;
    const selected = cannedResponses.find(r => r.id === target.value);
    if (selected) {
      newMessageText = selected.content;
    }
    selectedCannedId = '';
  }

  async function handleStatusChange(newStatus: any) {
    if (!ticket) return;
    updatingStatus = true;
    await TicketsService.updateTicket(ticketId, { status: newStatus });
    ticket.status = newStatus;
    updatingStatus = false;
    showToast('Stato del ticket aggiornato con successo!');
  }

  async function handleAssigneeChange(newAssignedToId: string) {
    if (!ticket) return;
    updatingAssignee = true;
    const selectedUser = users.find(u => u.id === newAssignedToId);
    const assignedToName = selectedUser ? selectedUser.name : '';
    await TicketsService.updateTicket(ticketId, { assignedTo: newAssignedToId, assignedToName });
    ticket.assignedTo = newAssignedToId;
    ticket.assignedToName = assignedToName;
    updatingAssignee = false;
    showToast('Operatore assegnato aggiornato con successo!');
  }

  async function handleAddMessage(e: SubmitEvent) {
    e.preventDefault();
    if (!newMessageText.trim() || !ticket) return;

    sendingMessage = true;
    const msg: TicketMessage = {
      id: 'msg_' + Date.now(),
      senderName: activeRoleState.role || 'Operatore',
      senderRole: activeRoleState.role || 'Operatore',
      message: newMessageText.trim(),
      isInternal: isInternalNote,
      createdAt: new Date().toISOString()
    };

    await TicketsService.addMessageToTicket(ticketId, msg);
    newMessageText = '';
    isInternalNote = false;
    sendingMessage = false;
    await loadTicketData();
    showToast('Messaggio aggiunto alla cronologia!');
  }

  async function handleDeleteTicket() {
    if (!confirm('Sei sicuro di voler eliminare definitivamente questo ticket?')) return;
    await TicketsService.deleteTicket(ticketId);
    goto('/dashboard/tickets');
  }

  function showToast(msg: string) {
    successToast = msg;
    setTimeout(() => { successToast = ''; }, 3000);
  }

  // Calcola se la SLA è superata
  const isSlaBreached = $derived(
    ticket &&
    ticket.status !== 'risolto' &&
    ticket.status !== 'chiuso' &&
    ticket.slaDueDate &&
    new Date() > new Date(ticket.slaDueDate)
  );
</script>

<svelte:head>
  <title>{ticket ? ticket.subject : 'Dettaglio Ticket'} | {$projectStore?.projectName || 'ERP'}</title>
</svelte:head>

<div class="ticket-detail-page">
  <div class="page-header">
    <a href="/dashboard/tickets" class="back-link">← Torna all'elenco ticket</a>
  </div>

  {#if successToast}
    <div class="toast-success">{successToast}</div>
  {/if}

  {#if loading}
    <div class="loading-box">Caricamento dettagli ticket...</div>
  {:else if !ticket}
    <div class="empty-card">Ticket non trovato o rimosso.</div>
  {:else}
    <div class="detail-grid">
      <!-- Scheda Principale Ticket -->
      <main class="main-card">
        <div class="ticket-title-row">
          <h1 class="ticket-title">{ticket.subject}</h1>
          <div class="badges-row">
            <span class="priority-badge priority-{ticket.priority}">
              {#if ticket.priority === 'urgente'}🔥 URGENTE
              {:else if ticket.priority === 'alta'}⚡ ALTA
              {:else if ticket.priority === 'media'}🔷 MEDIA
              {:else}⚪ BASSA
              {/if}
            </span>

            {#if ticket.status === 'risolto' || ticket.status === 'chiuso'}
              <span class="sla-badge sla-ok">✅ Risolto</span>
            {:else if isSlaBreached}
              <span class="sla-badge sla-breached">⚠️ SLA Superato</span>
            {:else if ticket.slaDueDate}
              <span class="sla-badge sla-pending">⏱️ Scadenza SLA: {new Date(ticket.slaDueDate).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</span>
            {/if}
          </div>
        </div>

        <div class="meta-row">
          <span class="meta-item">📁 Categoria: <strong>{ticket.category}</strong></span>
          <span class="meta-item">🏢 Cliente: <strong>{ticket.clientName || 'Generico'}</strong></span>
          {#if ticket.requesterName}
            <span class="meta-item">👤 Richiedente: <strong>{ticket.requesterName} ({ticket.requesterEmail || 'No email'})</strong></span>
          {/if}
          <span class="meta-item">📅 Aperto il: <strong>{new Date(ticket.createdAt).toLocaleString('it-IT')}</strong></span>
        </div>

        <div class="description-box">
          <h3 class="box-title">Descrizione Iniziale</h3>
          <p class="description-text">{ticket.description}</p>
        </div>

        <!-- Cronologia Messaggi / Note -->
        <div class="timeline-section">
          <h3 class="box-title">💬 Cronologia Risposte e Note Interne</h3>

          {#if !ticket.messages || ticket.messages.length === 0}
            <p class="no-messages">Nessuna risposta o nota ancora registrata per questo ticket.</p>
          {:else}
            <div class="timeline-list">
              {#each ticket.messages as msg}
                <div class="timeline-item {msg.isInternal ? 'item-internal' : 'item-public'}">
                  <div class="item-header">
                    <span class="sender-name">
                      {msg.senderName} ({msg.senderRole})
                      {#if msg.isInternal}
                        <span class="internal-badge">🔒 Nota Interna</span>
                      {/if}
                    </span>
                    <span class="message-time">{new Date(msg.createdAt).toLocaleString('it-IT')}</span>
                  </div>
                  <div class="message-body">{msg.message}</div>
                </div>
              {/each}
            </div>
          {/if}

          <!-- Form di Aggiunta Risposta -->
          {#if can('tickets:update', activeRoleState.role)}
            <form onsubmit={handleAddMessage} class="add-message-form">
              <div class="form-header-row">
                <label for="new-msg" class="filter-label">Aggiungi Risposta o Nota Interna</label>

                {#if cannedResponses.length > 0}
                  <div class="canned-picker">
                    <select value={selectedCannedId} onchange={handleSelectCanned}>
                      <option value="">⚡ Inserisci Risposta Rapida...</option>
                      {#each cannedResponses as r}
                        <option value={r.id}>{r.title}</option>
                      {/each}
                    </select>
                  </div>
                {/if}
              </div>

              <textarea
                id="new-msg"
                class="form-textarea"
                rows="3"
                placeholder="Scrivi un aggiornamento sul ticket..."
                bind:value={newMessageText}
                required
              ></textarea>

              <div class="form-options">
                <label class="checkbox-label">
                  <input type="checkbox" bind:checked={isInternalNote} />
                  <span>Marca come Nota Interna (visibile solo allo staff)</span>
                </label>

                <button type="submit" class="btn btn-primary" disabled={sendingMessage}>
                  {sendingMessage ? 'Invio in corso...' : 'Invia Risposta'}
                </button>
              </div>
            </form>
          {/if}
        </div>
      </main>

      <!-- Sidebar comandi e stato -->
      <aside class="sidebar-card">
        <div class="sidebar-group">
          <label for="ticket-status-select" class="sidebar-label">Stato Attuale Ticket</label>
          {#if can('tickets:update', activeRoleState.role)}
            <select
              id="ticket-status-select"
              class="form-select status-select status-{ticket.status}"
              value={ticket.status}
              onchange={(e) => handleStatusChange((e.target as HTMLSelectElement).value)}
              disabled={updatingStatus}
            >
              <option value="aperto">🔵 Aperto</option>
              <option value="in_lavorazione">🟡 In Lavorazione</option>
              <option value="in_attesa_cliente">🟣 In Attesa Cliente</option>
              <option value="risolto">🟢 Risolto</option>
              <option value="chiuso">⚪ Chiuso</option>
            </select>
          {:else}
            <div class="status-badge-large">{ticket.status.replace(/_/g, ' ').toUpperCase()}</div>
          {/if}
        </div>

        <div class="sidebar-group">
          <label for="ticket-assignee-select" class="sidebar-label">Operatore Assegnato</label>
          {#if can('tickets:update', activeRoleState.role)}
            <select
              id="ticket-assignee-select"
              class="form-select assignee-select"
              value={ticket.assignedTo || ''}
              onchange={(e) => handleAssigneeChange((e.target as HTMLSelectElement).value)}
              disabled={updatingAssignee}
            >
              <option value="">-- Non Assegnato --</option>
              {#each users as u}
                <option value={u.id}>{u.name} ({u.role || 'Utente'})</option>
              {/each}
            </select>
          {:else}
            <div class="sidebar-val">{ticket.assignedToName || 'Non Assegnato'}</div>
          {/if}
        </div>

        {#if can('tickets:delete', activeRoleState.role)}
          <div class="danger-zone">
            <button onclick={handleDeleteTicket} class="btn btn-danger full-width">
              🗑️ Elimina Ticket
            </button>
          </div>
        {/if}
      </aside>
    </div>
  {/if}
</div>

<style>
  .ticket-detail-page {
    display: flex;
    flex-direction: column;
    gap: 1.2rem;
  }

  .back-link {
    color: var(--text-secondary, #64748b);
    text-decoration: none;
    font-size: 0.88rem;
    font-weight: 500;
  }

  .back-link:hover {
    color: var(--primary, #3b82f6);
  }

  .detail-grid {
    display: grid;
    grid-template-columns: 1fr 300px;
    gap: 1.5rem;
  }

  @media (max-width: 900px) {
    .detail-grid {
      grid-template-columns: 1fr;
    }
  }

  .main-card, .sidebar-card {
    background-color: var(--bg-surface, #ffffff);
    border-radius: 12px;
    border: 1px solid var(--border-color, #e2e8f0);
    padding: 1.5rem;

    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .ticket-title-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
  }

  .badges-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .ticket-title {
    font-size: 1.5rem;
    font-weight: 700;
    margin: 0;
    color: var(--text-primary, #0f172a);
  }

  .priority-badge {
    padding: 0.35rem 0.85rem;
    border-radius: 20px;
    font-size: 0.8rem;
    font-weight: 800;
    letter-spacing: 0.05em;
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
    white-space: nowrap;
  }

  .priority-urgente {
    background-color: #fef2f2;
    color: #dc2626;
    border: 1px solid #fca5a5;
  }

  .priority-alta {
    background-color: #fff7ed;
    color: #ea580c;
    border: 1px solid #ffbb7c;
  }

  .priority-media {
    background-color: #f0f9ff;
    color: #0284c7;
    border: 1px solid #7dd3fc;
  }

  .priority-bassa {
    background-color: #f8fafc;
    color: #64748b;
    border: 1px solid #cbd5e1;
  }

  .sla-badge {
    padding: 0.35rem 0.85rem;
    border-radius: 20px;
    font-size: 0.8rem;
    font-weight: 700;
    white-space: nowrap;
  }

  .sla-ok {
    background-color: #dcfce7;
    color: #166534;
    border: 1px solid #86efac;
  }

  .sla-breached {
    background-color: #fee2e2;
    color: #991b1b;
    border: 1px solid #fca5a5;
  }

  .sla-pending {
    background-color: #f1f5f9;
    color: #475569;
    border: 1px solid #cbd5e1;
  }

  .meta-row {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    font-size: 0.88rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid var(--border-color, #e2e8f0);
    color: var(--text-secondary, #64748b);
  }

  .description-box {
    background-color: var(--bg-body, #f8fafc);
    padding: 1rem 1.2rem;
    border-radius: 8px;
    border-left: 4px solid var(--primary, #3b82f6);
  }

  .box-title {
    font-size: 1rem;
    font-weight: 600;
    margin: 0 0 0.5rem 0;
    color: var(--text-primary, #0f172a);
  }

  .description-text {
    margin: 0;
    white-space: pre-wrap;
    font-size: 0.92rem;
    line-height: 1.5;
  }

  .timeline-section {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding-top: 1rem;
    border-top: 1px solid var(--border-color, #e2e8f0);
  }

  .timeline-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .timeline-item {
    padding: 0.9rem 1.1rem;
    border-radius: 8px;
    border: 1px solid var(--border-color, #e2e8f0);
  }

  .item-public {
    background-color: #f0f9ff;
    border-color: #bae6fd;
  }

  .item-internal {
    background-color: #fffbebf5;
    border-color: #fde68a;
  }

  .item-header {
    display: flex;
    justify-content: space-between;
    font-size: 0.82rem;
    margin-bottom: 0.4rem;
  }

  .sender-name {
    font-weight: 600;
    color: var(--text-primary, #0f172a);
  }

  .internal-badge {
    background-color: #f59e0b;
    color: #ffffff;
    padding: 0.1rem 0.4rem;
    border-radius: 4px;
    font-size: 0.72rem;
    margin-left: 0.4rem;
  }

  .message-time {
    color: var(--text-secondary, #64748b);
  }

  .message-body {
    font-size: 0.9rem;
    white-space: pre-wrap;
  }

  .add-message-form {
    display: flex;
    flex-direction: column;
    gap: 0.8rem;
    background-color: var(--bg-body, #f8fafc);
    padding: 1.2rem;
    border-radius: 8px;
    border: 1px solid var(--border-color, #cbd5e1);
  }

  .form-header-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .canned-picker select {
    padding: 0.4rem 0.7rem;
    border-radius: 6px;
    border: 1px solid #cbd5e1;
    font-size: 0.82rem;
    background: #ffffff;
    color: #334155;
  }

  .form-textarea {
    width: 100%;
    padding: 0.6rem;
    border-radius: 8px;
    border: 1px solid var(--border-color, #cbd5e1);
    font-size: 0.9rem;
  }

  .form-options {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.8rem;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.85rem;
    cursor: pointer;
  }

  .sidebar-group {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .sidebar-label {
    font-size: 0.78rem;
    font-weight: 700;
    color: var(--text-secondary, #64748b);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .sidebar-val {
    font-weight: 600;
    color: var(--text-primary, #0f172a);
    font-size: 0.95rem;
  }

  .status-select, .assignee-select {
    width: 100%;
    padding: 0.65rem 0.8rem;
    font-weight: 600;
    border-radius: 8px;
    font-size: 0.9rem;
    border: 1px solid var(--border-color, #cbd5e1);
    background-color: var(--bg-body, #f8fafc);
    color: var(--text-primary, #0f172a);
  }

  .btn {
    padding: 0.6rem 1.2rem;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
  }

  .btn-primary { background-color: var(--primary, #3b82f6); color: #fff; border: none; }
  .btn-danger { background-color: #ef4444; color: #fff; border: none; }

  .full-width { width: 100%; }

  .toast-success {
    background-color: #dcfce7;
    color: #15803d;
    padding: 0.8rem 1rem;
    border-radius: 8px;
    border: 1px solid #86efac;
    font-weight: 600;
  }

  .no-messages {
    font-style: italic;
    color: var(--text-secondary, #64748b);
    font-size: 0.88rem;
  }
</style>
