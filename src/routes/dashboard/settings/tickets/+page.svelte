<script lang="ts">
  import { onMount } from 'svelte';
  import { 
    TicketSettingsService, 
    type TicketSettingsConfig, 
    DEFAULT_TICKET_SETTINGS,
    type TicketCategoryConfig,
    type CannedResponseConfig
  } from '$lib/services/ticketSettings';
  import { db, collection, getDocs } from '$lib/firebase';

  let config = $state<TicketSettingsConfig>({ ...DEFAULT_TICKET_SETTINGS });
  let users = $state<{ id: string; name: string }[]>([]);
  let loading = $state(true);
  let saving = $state(false);
  let successMsg = $state('');
  let errorMsg = $state('');

  // Nuova categoria form state
  let newCatLabel = $state('');
  let newCatAssignee = $state('');

  // Nuova risposta rapida form state
  let newResponseTitle = $state('');
  let newResponseContent = $state('');

  onMount(async () => {
    try {
      config = await TicketSettingsService.getSettings();
      // Assicurati che i campi array siano inizializzati se vuoti
      if (!config.categories) config.categories = [...DEFAULT_TICKET_SETTINGS.categories];
      if (!config.slaHours) config.slaHours = { ...DEFAULT_TICKET_SETTINGS.slaHours };
      if (!config.cannedResponses) config.cannedResponses = [...DEFAULT_TICKET_SETTINGS.cannedResponses];

      const snapUsers = await getDocs(collection(db, 'users'));
      users = snapUsers.docs.map((d: any) => {
        const data = d.data();
        const orig = data.original || data;
        const nome = orig.nome || orig.firstName || orig.name || '';
        const cognome = orig.cognome || orig.lastName || '';
        const fullName = `${nome} ${cognome}`.trim();
        const name = fullName || orig.displayName || orig.email || 'Utente ' + d.id;
        return { id: d.id, name };
      });
    } catch (e: any) {
      console.error('Errore caricamento impostazioni ticket:', e);
    } finally {
      loading = false;
    }
  });

  function addCategory() {
    if (!newCatLabel.trim()) return;
    const id = newCatLabel.trim().toLowerCase().replace(/\s+/g, '_');
    if (config.categories.some(c => c.id === id)) {
      errorMsg = 'Esiste già una categoria con questo nome.';
      return;
    }
    config.categories = [
      ...config.categories,
      { id, label: newCatLabel.trim(), defaultAssigneeUid: newCatAssignee || undefined }
    ];
    newCatLabel = '';
    newCatAssignee = '';
    errorMsg = '';
  }

  function removeCategory(id: string) {
    if (config.categories.length <= 1) {
      errorMsg = 'Deve esserci almeno una categoria abilitata.';
      return;
    }
    config.categories = config.categories.filter(c => c.id !== id);
  }

  function addCannedResponse() {
    if (!newResponseTitle.trim() || !newResponseContent.trim()) return;
    config.cannedResponses = [
      ...config.cannedResponses,
      { id: Date.now().toString(), title: newResponseTitle.trim(), content: newResponseContent.trim() }
    ];
    newResponseTitle = '';
    newResponseContent = '';
  }

  function removeCannedResponse(id: string) {
    config.cannedResponses = config.cannedResponses.filter(r => r.id !== id);
  }

  async function handleSave(e: SubmitEvent) {
    e.preventDefault();
    saving = true;
    successMsg = '';
    errorMsg = '';
    try {
      await TicketSettingsService.saveSettings(config);
      successMsg = 'Impostazioni di configurazione e SLA Ticket salvate con successo!';
    } catch (err: any) {
      errorMsg = 'Errore durante il salvataggio: ' + err.message;
    } finally {
      saving = false;
    }
  }
</script>

<svelte:head>
  <title>Impostazioni Ticket | Gestoray</title>
</svelte:head>

<div class="ticket-settings-page">
  <header class="page-header">
    <a href="/dashboard/settings" class="back-link">← Torna alle Impostazioni</a>
    <h1 class="page-title">⚙️ Configurazione Accesso, SLA e Modelli Ticket</h1>
    <p class="page-subtitle">Gestisci le regole di apertura, le categorie, le ore target SLA e le risposte rapide per gli operatori.</p>
  </header>

  {#if successMsg}
    <div class="alert-success">{successMsg}</div>
  {/if}

  {#if errorMsg}
    <div class="alert-danger">{errorMsg}</div>
  {/if}

  {#if loading}
    <div class="loading-box">Caricamento impostazioni...</div>
  {:else}
    <form onsubmit={handleSave} class="settings-form">
      <!-- 1. MODALITÀ ACCESSO -->
      <section class="settings-card">
        <h2 class="card-section-title">🌐 Modalità Accesso e Canali</h2>
        
        <div class="setting-option">
          <label class="toggle-container">
            <input type="checkbox" bind:checked={config.allowInternalOnly} />
            <div class="toggle-content">
              <span class="toggle-title">👥 Consenti Apertura Interna da Utenti Registrati</span>
              <span class="toggle-desc">Gli utenti con ruoli abilitati possono aprire e gestire ticket all'interno della dashboard.</span>
            </div>
          </label>
        </div>

        <div class="setting-option">
          <label class="toggle-container">
            <input type="checkbox" bind:checked={config.allowPublicGenericLink} />
            <div class="toggle-content">
              <span class="toggle-title">🌐 Abilita Form Pubblica Generica (`/public/tickets`)</span>
              <span class="toggle-desc">Consenti la segnalazione di ticket tramite form web pubblica da parte di utenti o clienti generali.</span>
            </div>
          </label>
        </div>

        <div class="setting-option">
          <label class="toggle-container">
            <input type="checkbox" bind:checked={config.allowClientDedicatedLink} />
            <div class="toggle-content">
              <span class="toggle-title">📱 Abilita Link / QR Code Dedicati per Cliente (`/public/tickets?clientId=...`)</span>
              <span class="toggle-desc">Consenti l'invio rapido di ticket tramite QR Code o Link dedicato abbinato automaticamente al Cliente.</span>
            </div>
          </label>
        </div>

        <div class="setting-option">
          <label class="toggle-container">
            <input type="checkbox" bind:checked={config.allowEmailNotifications} />
            <div class="toggle-content">
              <span class="toggle-title">📧 Abilita Invio Notifiche Email (Outbound Multi-Destinatario)</span>
              <span class="toggle-desc">Invia notifiche email automatiche a Richiedente, Operatore e persone in Copia (CC) ad ogni nuovo messaggio.</span>
            </div>
          </label>
        </div>

        <div class="setting-option">
          <label class="toggle-container">
            <input type="checkbox" bind:checked={config.allowInboundEmailTickets} />
            <div class="toggle-content">
              <span class="toggle-title">📩 Abilita Ricezione & Creazione Ticket via Webhook Email Inbound (`/api/webhooks/tickets/inbound`)</span>
              <span class="toggle-desc">Consenti l'apertura e la risposta ai ticket direttamente via email integrando Cloudflare o provider email.</span>
            </div>
          </label>
        </div>

        {#if config.allowInboundEmailTickets}
          <div class="secret-box">
            <label for="webhookSecretInput" class="toggle-title">🔑 Webhook Secret Token Header (`x-webhook-secret`)</label>
            <input 
              type="text" 
              id="webhookSecretInput" 
              bind:value={config.webhookSecret} 
              placeholder="Chiave segreta webhook" 
              class="secret-input"
            />
            <span class="toggle-desc">Usa questo secret negli header del tuo provider email (Cloudflare Email Routing, Postmark, Mailgun).</span>
          </div>
        {/if}
      </section>

      <!-- 2. CATEGORIE E AUTO-ROUTING -->
      <section class="settings-card">
        <h2 class="card-section-title">📁 Categorie Personalizzate & Auto-Routing</h2>
        <p class="section-desc">Definisci le categorie di supporto e imposta un assegnatario automatico per instradare le richieste.</p>

        <div class="items-list">
          {#each config.categories as cat}
            <div class="item-row">
              <div class="item-info">
                <strong>{cat.label}</strong>
                <span class="tag-id">ID: {cat.id}</span>
              </div>
              <div class="item-assignee">
                <label for="assignee-{cat.id}">Assegnatario Default:</label>
                <select id="assignee-{cat.id}" bind:value={cat.defaultAssigneeUid}>
                  <option value="">-- Nessun Assegnatario --</option>
                  {#each users as u}
                    <option value={u.id}>{u.name}</option>
                  {/each}
                </select>
              </div>
              <button type="button" class="btn-icon-danger" onclick={() => removeCategory(cat.id)}>🗑️</button>
            </div>
          {/each}
        </div>

        <div class="add-box">
          <input type="text" placeholder="Nome Nuova Categoria" bind:value={newCatLabel} />
          <select bind:value={newCatAssignee}>
            <option value="">-- Assegnatario Auto-Routing (Opzionale) --</option>
            {#each users as u}
              <option value={u.id}>{u.name}</option>
            {/each}
          </select>
          <button type="button" class="btn btn-secondary" onclick={addCategory}>+ Aggiungi Categoria</button>
        </div>
      </section>

      <!-- 3. TARGET SLA ORE PER PRIORITÀ -->
      <section class="settings-card">
        <h2 class="card-section-title">⏱️ Ore Target SLA per Priorità</h2>
        <p class="section-desc">Specifica il tempo massimo (in ore) entro cui un ticket deve essere lavorato prima di andare Fuori SLA.</p>

        <div class="sla-grid">
          <div class="sla-field">
            <label for="sla-urgente">🔴 Urgente (ore)</label>
            <input type="number" id="sla-urgente" min="1" bind:value={config.slaHours.urgente} />
          </div>
          <div class="sla-field">
            <label for="sla-alta">🟠 Alta (ore)</label>
            <input type="number" id="sla-alta" min="1" bind:value={config.slaHours.alta} />
          </div>
          <div class="sla-field">
            <label for="sla-media">🟡 Media (ore)</label>
            <input type="number" id="sla-media" min="1" bind:value={config.slaHours.media} />
          </div>
          <div class="sla-field">
            <label for="sla-bassa">🟢 Bassa (ore)</label>
            <input type="number" id="sla-bassa" min="1" bind:value={config.slaHours.bassa} />
          </div>
        </div>
      </section>

      <!-- 4. LIBRERIA RISPOSTE RAPIDE -->
      <section class="settings-card">
        <h2 class="card-section-title">💬 Modelli di Risposta Rapida (Canned Responses)</h2>
        <p class="section-desc">Crea modelli di risposta precompilati che gli operatori possono inserire con un clic nel dettaglio dei ticket.</p>

        <div class="items-list">
          {#each config.cannedResponses as resp}
            <div class="item-card">
              <div class="item-card-header">
                <strong>{resp.title}</strong>
                <button type="button" class="btn-icon-danger" onclick={() => removeCannedResponse(resp.id)}>🗑️</button>
              </div>
              <p class="canned-text">{resp.content}</p>
            </div>
          {/each}
        </div>

        <div class="add-canned-box">
          <input type="text" placeholder="Titolo Modello (es. Presa in carico)" bind:value={newResponseTitle} />
          <textarea rows="3" placeholder="Testo della risposta precompilata..." bind:value={newResponseContent}></textarea>
          <button type="button" class="btn btn-secondary" onclick={addCannedResponse}>+ Aggiungi Modello Risposta</button>
        </div>
      </section>

      <div class="form-actions">
        <button type="submit" class="btn btn-primary" disabled={saving}>
          {saving ? 'Salvataggio...' : 'Salva Tutte le Impostazioni'}
        </button>
      </div>
    </form>
  {/if}
</div>

<style>
  .ticket-settings-page {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    max-width: 900px;
    margin: 0 auto;
  }

  .back-link {
    color: var(--text-secondary, #64748b);
    text-decoration: none;
    font-size: 0.88rem;
  }

  .page-title {
    font-size: 1.5rem;
    font-weight: 700;
    margin: 0.3rem 0 0 0;
  }

  .page-subtitle {
    margin: 0.2rem 0 0 0;
    color: var(--text-secondary, #64748b);
    font-size: 0.9rem;
  }

  .settings-form {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .settings-card {
    background-color: var(--bg-surface, #ffffff);
    border-radius: 12px;
    border: 1px solid var(--border-color, #e2e8f0);
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .card-section-title {
    font-size: 1.15rem;
    font-weight: 700;
    color: var(--text-primary, #0f172a);
    margin: 0;
  }

  .section-desc {
    font-size: 0.85rem;
    color: var(--text-secondary, #64748b);
    margin: 0;
  }

  .setting-option {
    padding: 0.9rem;
    border-radius: 8px;
    border: 1px solid var(--border-color, #e2e8f0);
    background-color: var(--bg-body, #f8fafc);
  }

  .secret-box {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    padding: 1rem;
    border-radius: 8px;
    background-color: #f0fdf4;
    border: 1px solid #bbf7d0;
  }

  .secret-input {
    padding: 0.6rem 0.8rem;
    border-radius: 6px;
    border: 1px solid #86efac;
    font-family: monospace;
    font-size: 0.9rem;
    background: #ffffff;
  }

  .toggle-container {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
    cursor: pointer;
  }

  .toggle-container input[type="checkbox"] {
    width: 20px;
    height: 20px;
    margin-top: 0.2rem;
    cursor: pointer;
  }

  .toggle-content {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }

  .toggle-title {
    font-weight: 600;
    font-size: 0.95rem;
    color: var(--text-primary, #0f172a);
  }

  .toggle-desc {
    font-size: 0.85rem;
    color: var(--text-secondary, #64748b);
  }

  .items-list {
    display: flex;
    flex-direction: column;
    gap: 0.8rem;
  }

  .item-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.8rem 1rem;
    border: 1px solid var(--border-color, #e2e8f0);
    border-radius: 8px;
    background: #f8fafc;
    gap: 1rem;
  }

  .item-info {
    display: flex;
    flex-direction: column;
  }

  .tag-id {
    font-size: 0.75rem;
    color: #64748b;
  }

  .item-assignee {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.85rem;
  }

  .item-assignee select, .add-box select, .add-box input, .add-canned-box input, .add-canned-box textarea, .sla-field input {
    padding: 0.5rem 0.8rem;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    font-size: 0.88rem;
  }

  .add-box, .add-canned-box {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    margin-top: 0.5rem;
    padding-top: 0.8rem;
    border-top: 1px dashed #cbd5e1;
  }

  .item-card {
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 0.8rem 1rem;
    background: #f8fafc;
  }

  .item-card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.4rem;
  }

  .canned-text {
    font-size: 0.85rem;
    color: #475569;
    white-space: pre-wrap;
    margin: 0;
  }

  .sla-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 1rem;
  }

  .sla-field {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .sla-field label {
    font-size: 0.85rem;
    font-weight: 600;
  }

  .btn-icon-danger {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 1rem;
  }

  .form-actions {
    display: flex;
    justify-content: flex-end;
  }

  .btn {
    padding: 0.6rem 1.4rem;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
  }

  .btn-secondary { background-color: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; }
  .btn-primary { background-color: var(--primary, #3b82f6); color: #fff; border: none; }
  .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

  .alert-success { background-color: #dcfce7; color: #166534; padding: 0.8rem; border-radius: 8px; font-weight: 600; }
  .alert-danger { background-color: #fef2f2; color: #991b1b; padding: 0.8rem; border-radius: 8px; font-weight: 600; }
  .loading-box { text-align: center; padding: 3rem; color: var(--text-secondary, #64748b); }
</style>
