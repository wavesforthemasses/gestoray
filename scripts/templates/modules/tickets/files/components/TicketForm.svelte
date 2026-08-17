<script lang="ts">
  import type { TicketSchema } from '../schema';
  import { authState } from '$lib/auth.svelte';
  import { User } from '@lucide/svelte';

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

  function handleClientChange(e: Event) {
    const target = e.target as HTMLSelectElement;
    const selected = clients.find(c => c.id === target.value);
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
      formData.requesterName = authState.user.name || authState.user.email || '';
      formData.requesterEmail = authState.user.email || '';
      formData.requesterType = 'internal';
    }
  }
</script>

<div class="ticket-form-fields">
  <div class="field-group">
    <label for="title" class="form-label">Titolo Ticket *</label>
    <input
      id="title"
      type="text"
      class="form-input"
      placeholder="Es: Errore connessione stampante fiscale"
      bind:value={formData.title}
      required
    />
  </div>

  <div class="field-group">
    <label for="description" class="form-label">Descrizione Dettagliata *</label>
    <textarea
      id="description"
      class="form-textarea"
      rows="4"
      placeholder="Descrivi il problema riscontrato..."
      bind:value={formData.description}
      required
    ></textarea>
  </div>

  <div class="field-group">
    <label for="category" class="form-label">Categoria</label>
    <select id="category" class="form-select" bind:value={formData.category}>
      <option value="generale">Generale</option>
      {#each categories as cat}
        <option value={cat.id}>{cat.label}</option>
      {/each}
    </select>
  </div>

  <div class="field-group">
    <label for="status" class="form-label">Stato Iniziale</label>
    <select id="status" class="form-select" bind:value={formData.status}>
      <option value="aperto">Aperto</option>
      <option value="in_lavorazione">In Lavorazione</option>
      <option value="risolto">Risolto</option>
      <option value="chiuso">Chiuso</option>
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
    <select id="clientId" class="form-select" value={formData.clientId} onchange={handleClientChange}>
      <option value="">-- Nessun Cliente (Generico) --</option>
      {#each clients as client}
        <option value={client.id}>{client.name}</option>
      {/each}
    </select>
  </div>

  <div class="field-group">
    <label for="assignedTo" class="form-label">Assegna a Operatore</label>
    <select id="assignedTo" class="form-select" bind:value={formData.assignedTo}>
      <option value="">-- Auto-Routing / Non Assegnato --</option>
      {#each users as u}
        <option value={u.id}>{u.name} ({u.role || 'Utente'})</option>
      {/each}
    </select>
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
      placeholder="Es: mario.rossi@azienda.it"
      bind:value={formData.requesterEmail}
    />
  </div>

  <div class="field-group">
    <label for="requesterPhone" class="form-label">Telefono Richiedente</label>
    <input
      id="requesterPhone"
      type="tel"
      class="form-input"
      placeholder="Es: +39 333 1234567"
      bind:value={formData.requesterPhone}
    />
  </div>
</div>

<style>
  .ticket-form-fields {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .field-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .label-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .form-label {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--color-neutral-700, #374151);
  }

  .form-input,
  .form-select,
  .form-textarea {
    width: 100%;
    padding: 8px 12px;
    font-size: 0.9rem;
    border: 1px solid var(--color-neutral-300, #d1d5db);
    border-radius: var(--radius-md, 6px);
    background-color: #fff;
    color: var(--color-neutral-900, #111827);
    box-sizing: border-box;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
  }

  .form-input:focus,
  .form-select:focus,
  .form-textarea:focus {
    outline: none;
    border-color: var(--color-primary, #3b82f6);
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
  }

  .form-textarea {
    resize: vertical;
    min-height: 80px;
  }

  .btn-self {
    background: none;
    border: none;
    font-size: 0.75rem;
    color: var(--color-primary, #3b82f6);
    cursor: pointer;
    padding: 2px 6px;
    border-radius: 4px;
    font-weight: 500;
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  .btn-self:hover {
    background-color: var(--color-primary-50, #eff6ff);
    text-decoration: underline;
  }
</style>
