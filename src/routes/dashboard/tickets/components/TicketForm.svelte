<script lang="ts">
  import type { TicketSchema } from '../schema';
  import { authState } from '$lib/auth.svelte';
  import { User } from '@lucide/svelte';
  import { Autocomplete, type AutocompleteOption } from '$lib';

  let {
    formData = $bindable(),
    clients = [],
    users = [],
    categories = []
  }: {
    formData: TicketSchema;
    clients?: { id: string; name: string }[];
    users?: { id: string; name: string; role?: string }[];
    categories?: { id: string; label: string }[];
  } = $props();

  let clientOptions = $derived<AutocompleteOption[]>([
    { id: '', label: '-- Nessun Cliente (Generico) --' },
    ...clients.map(c => ({ id: c.id, label: c.name }))
  ]);

  let userOptions = $derived<AutocompleteOption[]>([
    { id: '', label: '-- Auto-Routing / Non Assegnato --' },
    ...users.map(u => ({ id: u.id, label: u.name, sublabel: u.role || 'Utente' }))
  ]);

  function handleClientSelect(selectedId: string) {
    const selected = clients.find(c => c.id === selectedId);
    if (selected) {
      formData.clientId = selected.id;
      formData.clientName = selected.name;
    } else {
      formData.clientId = '';
      formData.clientName = '';
    }
  }

  function fillSelfData() {
    if (authState.user) {
      const u = authState.user;
      const fullName = `${u.nome || ''} ${u.cognome || ''}`.trim() || u.email || '';
      formData.requesterName = fullName;
      formData.requesterEmail = u.email || '';
      formData.requesterUid = u.uid;
      formData.createdBy = u.uid;
    }
  }
</script>

<div class="form-grid">
  <div class="field-group full-width">
    <label for="subject" class="form-label">Oggetto Ticket *</label>
    <input
      id="subject"
      type="text"
      class="form-input"
      placeholder="Es: Problema di accesso al portale"
      bind:value={formData.subject}
      required
    />
  </div>

  <div class="field-group full-width">
    <label for="description" class="form-label">Descrizione Dettagliata *</label>
    <textarea
      id="description"
      class="form-textarea"
      rows="4"
      placeholder="Descrivi la richiesta o la segnalazione..."
      bind:value={formData.description}
      required
    ></textarea>
  </div>

  <div class="field-group">
    <label for="category" class="form-label">Categoria</label>
    <select id="category" class="form-select" bind:value={formData.category}>
      {#if categories.length > 0}
        {#each categories as cat}
          <option value={cat.id}>{cat.label}</option>
        {/each}
      {:else}
        <option value="generale">Generale</option>
        <option value="tecnico">Tecnico</option>
        <option value="commerciale">Commerciale</option>
        <option value="amministrativo">Amministrativo</option>
      {/if}
    </select>
  </div>

  <div class="field-group">
    <label for="priority" class="form-label">Priorità</label>
    <select id="priority" class="form-select" bind:value={formData.priority}>
      <option value="bassa">Bassa</option>
      <option value="media">Media</option>
      <option value="alta">Alta</option>
      <option value="urgente">Urgente</option>
    </select>
  </div>

  <div class="field-group">
    <label for="clientId" class="form-label">Cliente Associato</label>
    <Autocomplete 
      options={clientOptions} 
      value={formData.clientId || ''} 
      onchange={handleClientSelect} 
      placeholder="Seleziona cliente..." 
    />
  </div>

  <div class="field-group">
    <label for="assignedTo" class="form-label">Assegna a Operatore</label>
    <Autocomplete 
      options={userOptions} 
      value={formData.assignedTo || ''} 
      onchange={(id) => formData.assignedTo = id} 
      placeholder="Assegna a operatore..." 
    />
  </div>

  <div class="field-group">
    <div class="label-row">
      <label for="requesterName" class="form-label">Nome Richiedente</label>
      {#if authState.user}
        <button type="button" class="btn-self" onclick={fillSelfData}>
          <User size={13} /> Sono Io
        </button>
      {/if}
    </div>
    <input
      id="requesterName"
      type="text"
      class="form-input"
      placeholder="Es: Mario Rossi"
      bind:value={formData.requesterName}
    />
  </div>

  <div class="field-group">
    <label for="requesterEmail" class="form-label">Email Richiedente</label>
    <input
      id="requesterEmail"
      type="email"
      class="form-input"
      placeholder="mario.rossi@cliente.it"
      bind:value={formData.requesterEmail}
    />
  </div>

  <div class="field-group full-width">
    <label for="ccEmails" class="form-label">Email in Copia (CC) - Separate da virgola</label>
    <input
      id="ccEmails"
      type="text"
      class="form-input"
      placeholder="collega1@azienda.it, collega2@azienda.it"
      value={formData.ccEmails ? formData.ccEmails.join(', ') : ''}
      oninput={(e) => {
        const val = (e.target as HTMLInputElement).value;
        formData.ccEmails = val.split(',').map(s => s.trim()).filter(Boolean);
      }}
    />
  </div>
</div>

<style>
  .form-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 1rem;
  }

  .full-width {
    grid-column: 1 / -1;
  }

  .field-group {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .label-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .btn-self {
    background: #e0f2fe;
    color: #0369a1;
    border: none;
    border-radius: 4px;
    padding: 0.15rem 0.5rem;
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
  }

  .btn-self:hover {
    background: #bae6fd;
  }

  .form-label {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--text-secondary, #64748b);
  }

  .form-input,
  .form-select,
  .form-textarea {
    width: 100%;
    padding: 0.6rem 0.8rem;
    border-radius: 8px;
    border: 1px solid var(--border-color, #e2e8f0);
    background-color: var(--bg-surface, #ffffff);
    color: var(--text-primary, #0f172a);
    font-size: 0.9rem;
    transition: border-color 0.2s, box-shadow 0.2s;
  }

  .form-input:focus,
  .form-select:focus,
  .form-textarea:focus {
    outline: none;
    border-color: var(--primary, #3b82f6);
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
  }
</style>
