<script lang="ts">
  import { onMount } from 'svelte';
  import { ContactsService, type ContactItem } from '$lib/services/contacts.service';
  import { toast } from '$lib/stores/toast.svelte';
  import { UserCheck, Plus, Link, Unlink, Phone, Mail, UserX, Check, Edit, Trash2 } from '@lucide/svelte';

  interface Props {
    clientId: string;
    clientName: string;
    userId: string;
  }

  let { clientId, clientName, userId }: Props = $props();

  let linkedContacts = $state<ContactItem[]>([]);
  let allContacts = $state<ContactItem[]>([]);
  let loading = $state(true);

  // Link existing contact modal state
  let isLinkModalOpen = $state(false);
  let selectedContactIdToLink = $state('');

  // Quick add contact modal state
  let isAddModalOpen = $state(false);
  let newFirstName = $state('');
  let newLastName = $state('');
  let newRole = $state('');
  let newPhone = $state('');
  let newMobile = $state('');
  let newEmail = $state('');
  let newPec = $state('');
  let newDoNotContact = $state(false);
  let newNotes = $state('');
  let submitting = $state(false);

  onMount(async () => {
    await loadData();
  });

  async function loadData() {
    loading = true;
    try {
      const [linked, all] = await Promise.all([
        ContactsService.fetchContacts(undefined, clientId),
        ContactsService.fetchContacts()
      ]);
      linkedContacts = linked;
      allContacts = all;
    } catch (e: any) {
      toast.error('Errore durante il caricamento dei contatti: ' + (e?.message || e));
    } finally {
      loading = false;
    }
  }

  async function handleLinkExistingContact() {
    if (!selectedContactIdToLink) {
      toast.error('Seleziona un contatto da collegare.');
      return;
    }
    submitting = true;
    try {
      await ContactsService.linkContactToClient(selectedContactIdToLink, clientId, userId);
      toast.success('Contatto collegato con successo!');
      isLinkModalOpen = false;
      selectedContactIdToLink = '';
      await loadData();
    } catch (e: any) {
      toast.error('Errore durante il collegamento: ' + (e?.message || e));
    } finally {
      submitting = false;
    }
  }

  async function handleUnlinkContact(contactId: string) {
    if (!confirm('Vuoi scollegare questo referente da questo cliente?')) return;
    try {
      await ContactsService.unlinkContactFromClient(contactId, clientId, userId);
      toast.success('Referente scollegato dal cliente.');
      await loadData();
    } catch (e: any) {
      toast.error('Errore scollegamento: ' + (e?.message || e));
    }
  }

  async function handleCreateNewContact(e: Event) {
    e.preventDefault();
    if (!newFirstName.trim() || !newLastName.trim()) {
      toast.error('Nome e Cognome sono obbligatori.');
      return;
    }
    submitting = true;
    try {
      await ContactsService.createContact({
        firstName: newFirstName,
        lastName: newLastName,
        role: newRole,
        phone: newPhone,
        mobile: newMobile,
        email: newEmail,
        pec: newPec,
        doNotContact: newDoNotContact,
        notes: newNotes,
        linkedClientIds: [clientId],
        userId
      });
      toast.success(`Referente "${newFirstName} ${newLastName}" creato e collegato a ${clientName}!`);
      isAddModalOpen = false;
      newFirstName = '';
      newLastName = '';
      newRole = '';
      newPhone = '';
      newMobile = '';
      newEmail = '';
      newPec = '';
      newDoNotContact = false;
      newNotes = '';
      await loadData();
    } catch (e: any) {
      toast.error('Errore creazione referente: ' + (e?.message || e));
    } finally {
      submitting = false;
    }
  }

  let unlinkedContacts = $derived(allContacts.filter(c => !c.linkedClientIds.includes(clientId)));
</script>

<div class="client-contacts-tab animate-fade-in">
  <div class="actions-header">
    <div>
      <h3 class="tab-title">Referenti & Persone di Contatto</h3>
      <p class="tab-subtitle">Gestisci le persone da contattare collegate a <strong>{clientName}</strong>.</p>
    </div>

    <div class="btn-group">
      <button class="btn-secondary" onclick={() => (isLinkModalOpen = true)}>
        <Link size={16} /> Collega Contatto Esistente
      </button>

      <button class="btn-primary" onclick={() => (isAddModalOpen = true)}>
        <Plus size={16} /> Aggiungi Nuovo Contatto
      </button>
    </div>
  </div>

  {#if loading}
    <div class="loading-state">Caricamento referenti collegate...</div>
  {:else if linkedContacts.length === 0}
    <div class="empty-box">
      <UserCheck size={40} color="var(--color-neutral-400)" />
      <h4>Nessun referente collegato</h4>
      <p>Aggiungi un nuovo contatto o collegane uno dall'anagrafica centralizzata.</p>
      <div class="btn-group mt-12">
        <button class="btn-primary" onclick={() => (isAddModalOpen = true)}>
          <Plus size={16} /> Crea Nuovo Referente
        </button>
      </div>
    </div>
  {:else}
    <div class="contacts-grid">
      {#each linkedContacts as c (c.id)}
        <div class="contact-card" class:do-not-contact={c.doNotContact}>
          <div class="card-header">
            <div class="avatar">{c.firstName.charAt(0)}{c.lastName.charAt(0)}</div>
            <div class="header-info">
              <div class="contact-name">
                {c.fullName}
                {#if c.doNotContact}
                  <span class="badge-dnc"><UserX size={12} /> Non Contattare</span>
                {:else}
                  <span class="badge-active"><Check size={12} /> Attivo</span>
                {/if}
              </div>
              <div class="contact-role">{c.role || 'Referente Aziendale'}</div>
            </div>
            <button class="btn-unlink" onclick={() => handleUnlinkContact(c.id)} title="Scollega dal cliente">
              <Unlink size={16} />
            </button>
          </div>

          <div class="card-body">
            {#if c.phone}
              <div class="info-row"><Phone size={14} /> <span>{c.phone}</span></div>
            {/if}
            {#if c.mobile}
              <div class="info-row"><Phone size={14} /> <span>{c.mobile} (Mobile)</span></div>
            {/if}
            {#if c.email}
              <div class="info-row"><Mail size={14} /> <a href="mailto:{c.email}">{c.email}</a></div>
            {/if}
            {#if c.notes}
              <div class="notes-box">"{c.notes}"</div>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<!-- Modal: Link Existing Contact -->
{#if isLinkModalOpen}
  <div class="modal-backdrop" onclick={() => (isLinkModalOpen = false)}>
    <div class="modal-card animate-scale-in" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <h3><Link size={20} color="var(--color-primary-600)" /> Collega Contatto Esistente</h3>
        <button class="btn-close" onclick={() => (isLinkModalOpen = false)}>×</button>
      </div>
      <div class="modal-body">
        {#if unlinkedContacts.length === 0}
          <p class="empty-msg">Tutti i contatti registrati in anagrafica sono già associati a questo cliente.</p>
        {:else}
          <div class="field-group">
            <label for="select-cnt">Seleziona Referente dall'Anagrafica Centralizzata</label>
            <select id="select-cnt" bind:value={selectedContactIdToLink} disabled={submitting}>
              <option value="">-- Seleziona un contatto --</option>
              {#each unlinkedContacts as c}
                <option value={c.id}>{c.fullName} ({c.role || 'Senza ruolo'}) - {c.email || c.phone}</option>
              {/each}
            </select>
          </div>
        {/if}
        <div class="modal-footer">
          <button class="btn-secondary" onclick={() => (isLinkModalOpen = false)}>Annulla</button>
          <button class="btn-primary" onclick={handleLinkExistingContact} disabled={submitting || !selectedContactIdToLink}>
            Collega a Cliente
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<!-- Modal: Add New Contact -->
{#if isAddModalOpen}
  <div class="modal-backdrop" onclick={() => (isAddModalOpen = false)}>
    <div class="modal-card animate-scale-in" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <h3><Plus size={20} color="var(--color-primary-600)" /> Aggiungi Nuovo Contatto Referente</h3>
        <button class="btn-close" onclick={() => (isAddModalOpen = false)}>×</button>
      </div>
      <form onsubmit={handleCreateNewContact} class="modal-body">
        <div class="form-grid-two">
          <div class="field-group">
            <label for="nc-fn">Nome *</label>
            <input type="text" id="nc-fn" bind:value={newFirstName} required placeholder="es. Mario" disabled={submitting} />
          </div>
          <div class="field-group">
            <label for="nc-ln">Cognome *</label>
            <input type="text" id="nc-ln" bind:value={newLastName} required placeholder="es. Rossi" disabled={submitting} />
          </div>
        </div>

        <div class="field-group">
          <label for="nc-role">Ruolo / Incarico</label>
          <input type="text" id="nc-role" bind:value={newRole} placeholder="es. REFERENTE TECNICO / CAPOCANTIERE" disabled={submitting} />
        </div>

        <div class="form-grid-two">
          <div class="field-group">
            <label for="nc-phone">Telefono Centralino/Fisso</label>
            <input type="text" id="nc-phone" bind:value={newPhone} placeholder="es. +39 02 9876543" disabled={submitting} />
          </div>
          <div class="field-group">
            <label for="nc-mobile">Cellulare / Mobile</label>
            <input type="text" id="nc-mobile" bind:value={newMobile} placeholder="es. +39 333 1234567" disabled={submitting} />
          </div>
        </div>

        <div class="form-grid-two">
          <div class="field-group">
            <label for="nc-email">Email Contatto</label>
            <input type="email" id="nc-email" bind:value={newEmail} placeholder="es. m.rossi@cgen.it" disabled={submitting} />
          </div>
          <div class="field-group">
            <label for="nc-pec">PEC</label>
            <input type="email" id="nc-pec" bind:value={newPec} placeholder="es. amministrazione@pec.cgen.it" disabled={submitting} />
          </div>
        </div>

        <div class="field-group dnc-box">
          <label class="checkbox-container">
            <input type="checkbox" bind:checked={newDoNotContact} disabled={submitting} />
            <span class="dnc-label-text"><strong>Non contattare più</strong> (Segnala l'espresso rifiuto)</span>
          </label>
        </div>

        <div class="field-group">
          <label for="nc-notes">Note Referente</label>
          <textarea id="nc-notes" bind:value={newNotes} rows="2" placeholder="Note sul contatto..." disabled={submitting}></textarea>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn-secondary" onclick={() => (isAddModalOpen = false)} disabled={submitting}>Annulla</button>
          <button type="submit" class="btn-primary" disabled={submitting}>Crea & Collega Referente</button>
        </div>
      </form>
    </div>
  </div>
{/if}

<style>
  .client-contacts-tab {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
  .actions-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 16px;
  }
  .tab-title {
    font-size: 18px;
    font-weight: 700;
    margin: 0 0 2px 0;
    color: var(--color-neutral-900, #111827);
  }
  .tab-subtitle {
    font-size: 13px;
    color: var(--color-neutral-500, #6b7280);
    margin: 0;
  }
  .btn-group {
    display: flex;
    gap: 10px;
  }
  .btn-primary {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: var(--color-primary-600, #2563eb);
    color: white;
    padding: 9px 16px;
    border-radius: var(--radius-md, 8px);
    border: none;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
  }
  .btn-secondary {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: var(--color-neutral-100, #f3f4f6);
    color: var(--color-neutral-700, #374151);
    border: 1px solid var(--color-neutral-300, #d1d5db);
    padding: 9px 16px;
    border-radius: var(--radius-md, 8px);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
  }

  .loading-state {
    padding: 40px;
    text-align: center;
    color: var(--color-neutral-500, #6b7280);
  }
  .empty-box {
    padding: 40px;
    text-align: center;
    background: white;
    border: 1px dashed var(--color-neutral-300, #d1d5db);
    border-radius: var(--radius-lg, 12px);
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .empty-box h4 { margin: 12px 0 4px 0; }
  .empty-box p { margin: 0; color: var(--color-neutral-500, #6b7280); font-size: 14px; }

  .contacts-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 16px;
  }
  .contact-card {
    background: white;
    border: 1px solid var(--color-neutral-200, #e5e7eb);
    border-radius: var(--radius-lg, 12px);
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .contact-card.do-not-contact {
    border-left: 4px solid #ef4444;
  }

  .card-header {
    display: flex;
    align-items: flex-start;
    gap: 12px;
  }
  .avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: #dbeafe;
    color: #1d4ed8;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .header-info { flex: 1; }
  .contact-name {
    font-weight: 700;
    font-size: 15px;
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }
  .contact-role {
    font-size: 12px;
    color: var(--color-neutral-500, #6b7280);
  }

  .badge-dnc {
    background: #fef2f2;
    color: #ef4444;
    border: 1px solid #fecaca;
    padding: 1px 6px;
    border-radius: 10px;
    font-size: 10px;
    font-weight: 600;
  }
  .badge-active {
    background: #f0fdf4;
    color: #16a34a;
    border: 1px solid #bbf7d0;
    padding: 1px 6px;
    border-radius: 10px;
    font-size: 10px;
    font-weight: 600;
  }

  .btn-unlink {
    background: transparent;
    border: none;
    color: var(--color-neutral-400, #9ca3af);
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
  }
  .btn-unlink:hover {
    color: #ef4444;
    background: #fef2f2;
  }

  .card-body {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 13px;
    color: var(--color-neutral-700, #374151);
  }
  .info-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .info-row a {
    color: #2563eb;
    text-decoration: none;
  }
  .notes-box {
    font-style: italic;
    background: var(--color-neutral-50, #f9fafb);
    padding: 6px 10px;
    border-radius: 6px;
    font-size: 12px;
    color: var(--color-neutral-500, #6b7280);
  }

  /* Modal Styling */
  .modal-backdrop {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 16px;
  }
  .modal-card {
    background: white;
    border-radius: 12px;
    width: 100%;
    max-width: 550px;
    max-height: 90vh;
    overflow-y: auto;
  }
  .modal-header {
    padding: 16px 20px;
    border-bottom: 1px solid #e5e7eb;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .modal-header h3 {
    margin: 0;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 16px;
  }
  .btn-close {
    background: transparent;
    border: none;
    font-size: 20px;
    cursor: pointer;
  }
  .modal-body {
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .form-grid-two {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
  .field-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .field-group label {
    font-size: 12px;
    font-weight: 600;
    color: #374151;
  }
  .field-group input, .field-group select, .field-group textarea {
    padding: 8px 10px;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 13px;
  }
  .dnc-box {
    background: #fef2f2;
    padding: 10px;
    border-radius: 6px;
    border: 1px solid #fecaca;
  }
  .checkbox-container {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
  }
  .dnc-label-text { font-size: 12px; color: #b91c1c; }
  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 8px;
  }
  .empty-msg {
    color: #6b7280;
    font-size: 14px;
  }
  .mt-12 { margin-top: 12px; }
</style>
