<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { TicketsService } from '../../dashboard/tickets/tickets.service';
  import { TicketSettingsService, type TicketCategoryConfig } from '$lib/services/ticketSettings';
  import { db, doc, getDoc } from '$lib/firebase';
  import { projectStore, initProjectStore } from '$lib/stores/project';

  let clientId = $derived(page.url.searchParams.get('clientId') || '');
  let clientName = $state('');
  let loadingClient = $state(false);

  let subject = $state('');
  let description = $state('');
  let requesterName = $state('');
  let requesterEmail = $state('');
  let ccEmailsInput = $state('');
  let category = $state('generale');
  let priority = $state<'bassa' | 'media' | 'alta' | 'urgente'>('media');

  let categories = $state<TicketCategoryConfig[]>([]);
  let loadingConfig = $state(true);
  let isAllowed = $state(true);
  let submitting = $state(false);
  let errorMsg = $state('');

  let appName = $derived($projectStore?.projectName || 'Gestoray');

  onMount(async () => {
    initProjectStore();

    // 1. Verfica configurazioni di accesso e categorie
    const conf = await TicketSettingsService.getSettings();
    categories = conf.categories || [];
    if (categories.length > 0) {
      category = categories[0].id;
    }

    if (clientId) {
      if (!conf.allowClientDedicatedLink) {
        isAllowed = false;
      }
    } else {
      if (!conf.allowPublicGenericLink) {
        isAllowed = false;
      }
    }
    loadingConfig = false;

    // 2. Se è stato passato un clientId, carica la Ragione Sociale da Firestore
    if (clientId) {
      loadingClient = true;
      try {
        const clientDoc = await getDoc(doc(db, 'clients', clientId));
        if (clientDoc.exists()) {
          const data = clientDoc.data();
          const orig = data.original || data;
          clientName = orig.ragioneSociale || orig.companyName || orig.name || `${orig.nome || ''} ${orig.cognome || ''}`.trim() || 'Cliente';
        }
      } catch (e) {
        console.error('Errore caricamento cliente per form pubblica:', e);
      } finally {
        loadingClient = false;
      }
    }
  });

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (!subject.trim() || !description.trim()) {
      errorMsg = 'Compila l\'oggetto e la descrizione.';
      return;
    }

    // Se non è stato specificato un clientId, il richiedente è obbligatorio
    if (!clientId && (!requesterName.trim() || !requesterEmail.trim())) {
      errorMsg = 'Nome ed email di contatto sono obbligatori.';
      return;
    }

    submitting = true;
    errorMsg = '';
    try {
      const parsedCc = ccEmailsInput.split(',').map(s => s.trim()).filter(Boolean);
      const ticketId = await TicketsService.createTicket({
        subject: subject.trim(),
        description: description.trim(),
        clientId: clientId || '',
        clientName: clientName || 'Richiesta Esterna',
        requesterName: requesterName.trim() || clientName || 'Referente Cliente',
        requesterEmail: requesterEmail.trim() || 'non-specificata@cliente.local',
        ccEmails: parsedCc,
        category,
        priority,
        status: 'aperto'
      });

      goto(`/public/tickets/success?ticketId=${ticketId}&client=${encodeURIComponent(clientName || requesterName || 'Cliente')}`);
    } catch (e: any) {
      errorMsg = 'Errore durante l\'invio della segnalazione: ' + e.message;
      submitting = false;
    }
  }
</script>

<svelte:head>
  <title>Richiesta Assistenza | {appName}</title>
</svelte:head>

<div class="public-container">
  <div class="public-card">
    <header class="card-header">
      <div class="brand">
        <span class="logo-icon">🎟️</span>
        <span class="brand-name">{appName} Assistenza</span>
      </div>

      {#if clientName}
        <div class="client-badge">
          <span>Dedicato a: <strong>{clientName}</strong></span>
        </div>
      {/if}
    </header>

    {#if loadingConfig}
      <div class="loading-state">
        <span class="spinner"></span>
        <p>Caricamento modulo assistenza...</p>
      </div>
    {:else if !isAllowed}
      <div class="access-denied">
        <div class="denied-icon">🚫</div>
        <h2>Modulo Non Disponibile</h2>
        <p>L'accesso pubblico per la creazione di nuovi ticket è temporaneamente disattivato dall'amministratore del sistema.</p>
      </div>
    {:else}
      {#if errorMsg}
        <div class="error-banner">{errorMsg}</div>
      {/if}

      <form onsubmit={handleSubmit} class="ticket-form">
        <div class="form-group">
          <label for="subject">Oggetto della Segnalazione *</label>
          <input 
            type="text" 
            id="subject" 
            bind:value={subject} 
            placeholder="Es. Problema accesso account / Errore fatturazione" 
            required 
          />
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="requesterName">
              Il tuo Nome e Cognome {clientId ? '(Opzionale)' : '*'}
            </label>
            <input 
              type="text" 
              id="requesterName" 
              bind:value={requesterName} 
              placeholder={clientId ? `Es. Referente ${clientName}` : 'Mario Rossi'} 
              required={!clientId} 
            />
          </div>

          <div class="form-group">
            <label for="requesterEmail">
              Email di Contatto {clientId ? '(Opzionale)' : '*'}
            </label>
            <input 
              type="email" 
              id="requesterEmail" 
              bind:value={requesterEmail} 
              placeholder="mario@azienda.com" 
              required={!clientId} 
            />
          </div>
        </div>

        <div class="form-group">
          <label for="ccEmailsInput">Email in Copia / Altri Referenti (CC - opzionale)</label>
          <input 
            type="text" 
            id="ccEmailsInput" 
            bind:value={ccEmailsInput} 
            placeholder="collega1@azienda.com, collega2@azienda.com" 
          />
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="category">Categoria</label>
            <select id="category" bind:value={category}>
              {#if categories.length > 0}
                {#each categories as cat}
                  <option value={cat.id}>{cat.label}</option>
                {/each}
              {:else}
                <option value="generale">Generale</option>
                <option value="tecnico">Supporto Tecnico</option>
                <option value="amministrativo">Amministrazione / Fatturazione</option>
                <option value="commerciale">Commerciale</option>
              {/if}
            </select>
          </div>

          <div class="form-group">
            <label for="priority">Priorità</label>
            <select id="priority" bind:value={priority}>
              <option value="bassa">Bassa</option>
              <option value="media">Media</option>
              <option value="alta">Alta</option>
              <option value="urgente">Urgente / Bloccante</option>
            </select>
          </div>
        </div>

        <div class="form-group">
          <label for="description">Descrizione Dettagliata *</label>
          <textarea 
            id="description" 
            bind:value={description} 
            rows="5" 
            placeholder="Descrivi in dettaglio il problema riscontrato..." 
            required
          ></textarea>
        </div>

        <button type="submit" class="submit-btn" disabled={submitting}>
          {submitting ? 'Invio in corso...' : 'Invia Segnalazione'}
        </button>
      </form>
    {/if}
  </div>
</div>

<style>
  .public-container {
    min-height: 100vh;
    background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 2rem 1rem;
    font-family: system-ui, -apple-system, sans-serif;
  }

  .public-card {
    background: #ffffff;
    width: 100%;
    max-width: 650px;
    border-radius: 16px;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2);
    padding: 2.5rem;
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid #e2e8f0;
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .logo-icon {
    font-size: 1.8rem;
  }

  .brand-name {
    font-size: 1.4rem;
    font-weight: 800;
    color: #0f172a;
    letter-spacing: -0.02em;
  }

  .client-badge {
    background: #e0f2fe;
    color: #0369a1;
    padding: 0.4rem 0.8rem;
    border-radius: 20px;
    font-size: 0.85rem;
  }

  .loading-state, .access-denied {
    text-align: center;
    padding: 3rem 1rem;
    color: #64748b;
  }

  .denied-icon {
    font-size: 3rem;
    margin-bottom: 1rem;
  }

  .access-denied h2 {
    color: #0f172a;
    margin-bottom: 0.5rem;
  }

  .error-banner {
    background: #fef2f2;
    color: #dc2626;
    padding: 0.8rem 1rem;
    border-radius: 8px;
    margin-bottom: 1.5rem;
    font-size: 0.9rem;
    border: 1px solid #fecaca;
  }

  .ticket-form {
    display: flex;
    flex-direction: column;
    gap: 1.2rem;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }

  label {
    font-size: 0.85rem;
    font-weight: 600;
    color: #334155;
  }

  input, select, textarea {
    padding: 0.75rem 1rem;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    font-size: 0.95rem;
    outline: none;
    transition: border-color 0.2s, box-shadow 0.2s;
  }

  input:focus, select:focus, textarea:focus {
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
  }

  .submit-btn {
    margin-top: 1rem;
    padding: 0.85rem 1.5rem;
    background: #2563eb;
    color: #ffffff;
    font-weight: 700;
    font-size: 1rem;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: background 0.2s;
  }

  .submit-btn:hover:not(:disabled) {
    background: #1d4ed8;
  }

  .submit-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  @media (max-width: 640px) {
    .form-row {
      grid-template-columns: 1fr;
    }
  }
</style>
