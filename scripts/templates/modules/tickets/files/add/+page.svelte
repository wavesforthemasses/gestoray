<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { TicketsService } from '../tickets.service';
  import TicketForm from '../components/TicketForm.svelte';
  import type { TicketSchema } from '../schema';
  import { TicketSettingsService, type TicketCategoryConfig } from '$lib/services/ticketSettings';
  import { CacheLookupService } from '$lib/services/cacheLookupService';
  import { db, collection, getDocs } from '$lib/firebase';
  import { authState } from '$lib/auth.svelte';

  let formData = $state<TicketSchema>({
    subject: '',
    description: '',
    clientId: '',
    clientName: '',
    requesterEmail: '',
    requesterName: '',
    assignedTo: '',
    assignedToName: '',
    priority: 'media',
    category: 'generale',
    status: 'aperto'
  });

  let clients = $state<{ id: string; name: string }[]>([]);
  let users = $state<{ id: string; name: string; role?: string }[]>([]);
  let categories = $state<TicketCategoryConfig[]>([]);
  let saving = $state(false);
  let errorMsg = $state('');

  onMount(async () => {
    try {
      const conf = await TicketSettingsService.getSettings();
      categories = conf.categories || [];
      if (categories.length > 0) {
        formData.category = categories[0].id;
      }

      clients = await CacheLookupService.getLookup('clients');
      users = await CacheLookupService.getLookup('users');
    } catch (e) {
      console.error('Errore caricamento dati per form ticket:', e);
    }
  });

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (!formData.subject || !formData.description) {
      errorMsg = 'Compila i campi obbligatori (Oggetto e Descrizione).';
      return;
    }

    if (authState.user?.uid) {
      formData.createdBy = authState.user.uid;
    }

    // Assign operator name if assignedTo is set
    if (formData.assignedTo) {
      const u = users.find(x => x.id === formData.assignedTo);
      if (u) formData.assignedToName = u.name;
    }

    saving = true;
    errorMsg = '';
    try {
      const newId = await TicketsService.createTicket(formData);
      goto(`/dashboard/tickets/${newId}`);
    } catch (e: any) {
      errorMsg = 'Errore durante la creazione del ticket: ' + e.message;
      saving = false;
    }
  }
</script>

<svelte:head>
  <title>Nuovo Ticket di Assistenza | Gestoray</title>
</svelte:head>

<div class="add-ticket-page">
  <div class="page-header">
    <a href="/dashboard/tickets" class="back-link">← Torna all'elenco ticket</a>
    <h1 class="page-title">➕ Apri Nuovo Ticket di Assistenza</h1>
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
    max-width: 900px;
    margin: 0 auto;
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
