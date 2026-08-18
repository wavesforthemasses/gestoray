<script lang="ts">
  import { projectStore } from '$lib/stores/project';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { TicketsService } from '../tickets.service';
  import TicketForm from '../components/TicketForm.svelte';
  import type { TicketSchema } from '../schema';
  import { TicketSettingsService, type TicketCategoryConfig } from '$lib/services/ticketSettings';
  import { CacheLookupService } from '$lib/services/cacheLookupService';
  import { authState } from '$lib/auth.svelte';
  import { List, Plus } from '@lucide/svelte';

  let formData = $state<TicketSchema>({
    subject: '',
    description: '',
    clientId: '',
    clientName: '',
    requesterEmail: '',
    requesterName: '',
    assignedTo: '',
    assignedToName: '',
    priority: 'normale',
    category: 'altro',
    status: 'aperto'
  });

  let users = $state<{ id: string; name: string }[]>([]);
  let clients = $state<{ id: string; name: string }[]>([]);
  let categories = $state<TicketCategoryConfig[]>([]);

  let loading = $state(true);
  let saving = $state(false);
  let errorMsg = $state('');

  onMount(async () => {
    try {
      const [usersData, clientsData, ticketSettings] = await Promise.all([
        TicketsService.getAssignableUsers(),
        CacheLookupService.getClients(),
        TicketSettingsService.getSettings()
      ]);

      users = usersData;
      clients = clientsData;
      if (ticketSettings && ticketSettings.categories) {
        categories = ticketSettings.categories.filter(c => c.enabled);
      }
      
      // Auto-populate requester if logged in
      if (authState.user) {
        formData.requesterEmail = authState.user.email || '';
        formData.requesterName = authState.user.email?.split('@')[0] || '';
      }
    } catch (e: any) {
      errorMsg = 'Impossibile caricare i dati: ' + e.message;
    } finally {
      loading = false;
    }
  });

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    saving = true;
    errorMsg = '';

    try {
      if (!formData.subject.trim()) {
        throw new Error('Il campo Oggetto è obbligatorio.');
      }
      if (!formData.description.trim()) {
        throw new Error('Il campo Descrizione è obbligatorio.');
      }

      await TicketsService.createTicket(formData, authState.user?.uid);
      goto('/dashboard/tickets');
    } catch (e: any) {
      errorMsg = 'Errore durante la creazione del ticket: ' + e.message;
      saving = false;
    }
  }
</script>

<svelte:head>
  <title>Nuovo Ticket di Assistenza | {$projectStore?.projectName || 'ERP'}</title>
</svelte:head>

<div class="add-ticket-page">
  <div class="page-header">
    <a href="/dashboard/tickets" class="btn-module-list" title="Vai all'elenco ticket" aria-label="Vai all'elenco ticket">
      <List size={20} />
    </a>
    <h1 class="page-title">Apri Nuovo Ticket di Assistenza</h1>
  </div>

  {#if errorMsg}
    <div class="alert-danger">{errorMsg}</div>
  {/if}

  <form onsubmit={handleSubmit} class="form-card">
    <TicketForm bind:formData {clients} {users} {categories} />

    <div class="form-actions">
      <a href="/dashboard/tickets" class="btn btn-secondary">Annulla</a>
      <button type="submit" class="btn btn-primary" disabled={saving}>
        {saving ? 'Salvataggio...' : 'Crea e Invia Ticket'}
      </button>
    </div>
  </form>
</div>

<style>
  .add-ticket-page {
    display: flex;
    flex-direction: column;
    gap: 1.2rem;
    width: 100%;
    box-sizing: border-box;
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

  .page-title {
    font-size: 1.5rem;
    font-weight: 700;
    margin: 0.3rem 0 0 0;
    color: var(--text-primary, #0f172a);
  }

  .form-card {
    background-color: var(--bg-surface, #ffffff);
    border-radius: 12px;
    border: 1px solid var(--border-color, #e2e8f0);
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .form-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.8rem;
    padding-top: 1rem;
    border-top: 1px solid var(--border-color, #e2e8f0);
  }

  .btn {
    padding: 0.6rem 1.2rem;
    border-radius: 8px;
    font-weight: 600;
    font-size: 0.9rem;
    cursor: pointer;
    text-decoration: none;
  }

  .btn-primary {
    background-color: var(--primary, #3b82f6);
    color: #ffffff;
    border: none;
  }

  .btn-primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .btn-secondary {
    background-color: var(--bg-body, #f1f5f9);
    color: var(--text-primary, #334155);
    border: 1px solid var(--border-color, #cbd5e1);
  }

  .alert-danger {
    background-color: #fef2f2;
    color: #991b1b;
    padding: 0.8rem 1rem;
    border-radius: 8px;
    border: 1px solid #fca5a5;
    font-size: 0.9rem;
  }
</style>
