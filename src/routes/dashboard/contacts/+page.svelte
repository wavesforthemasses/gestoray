<script lang="ts">
  import { onMount } from 'svelte';
  import { authState } from '$lib/auth.svelte';
  import { pageTitle } from '$lib/stores/page';
  import { toast } from '$lib/stores/toast.svelte';
  import { ContactsService, type ContactItem, type CreateContactInput } from '$lib/services/contacts.service';
  import { CacheLookupService } from '$lib/services/cacheLookupService';
  import { 
    UserCheck, 
    Plus, 
    Search, 
    Phone, 
    Mail, 
    Building, 
    UserX, 
    Edit, 
    Trash2, 
    X, 
    Save, 
    ShieldAlert, 
    Filter,
    Check
  } from '@lucide/svelte';

  import MultiComplete from '$lib/components/MultiComplete.svelte';

  pageTitle.set('Gestione Contatti & Referenti');

  let contacts = $state<ContactItem[]>([]);
  let clientLookup = $state<Record<string, string>>({});
  let clientOptions = $state<Array<{ id: string; name: string }>>([]);
  let loading = $state(true);

  // Filters
  let searchVal = $state('');
  let filterClientId = $state('');
  let filterStatus = $state<'all' | 'active' | 'doNotContact'>('all');

  // Modal State
  let isModalOpen = $state(false);
  let editingId = $state<string | null>(null);
  let submitting = $state(false);

  // Form Fields
  let formFirstName = $state('');
  let formLastName = $state('');
  let formRole = $state('');
  let formPhone = $state('');
  let formMobile = $state('');
  let formEmail = $state('');
  let formPec = $state('');
  let formDoNotContact = $state(false);
  let formNotes = $state('');
  let formLinkedClientIds = $state<string[]>([]);

  onMount(async () => {
    await Promise.all([loadContacts(), loadClientsLookup()]);
  });

  async function loadClientsLookup() {
    try {
      const items = await CacheLookupService.getLookup('clients');
      const lookup: Record<string, string> = {};
      (items || []).forEach(item => {
        lookup[item.id] = item.name;
      });
      clientLookup = lookup;
      clientOptions = items || [];
    } catch (e) {
      console.warn('Impossibile caricare il lookup dei clienti:', e);
    }
  }

  async function loadContacts() {
    loading = true;
    try {
      contacts = await ContactsService.fetchContacts(searchVal, filterClientId, filterStatus);
    } catch (e: any) {
      toast.error('Errore durante il caricamento dei contatti: ' + (e?.message || e));
    } finally {
      loading = false;
    }
  }

  function openAddModal() {
    editingId = null;
    formFirstName = '';
    formLastName = '';
    formRole = '';
    formPhone = '';
    formMobile = '';
    formEmail = '';
    formPec = '';
    formDoNotContact = false;
    formNotes = '';
    formLinkedClientIds = filterClientId ? [filterClientId] : [];
    isModalOpen = true;
  }

  function openEditModal(c: ContactItem) {
    editingId = c.id;
    formFirstName = c.firstName;
    formLastName = c.lastName;
    formRole = c.role;
    formPhone = c.phone;
    formMobile = c.mobile;
    formEmail = c.email;
    formPec = c.pec;
    formDoNotContact = c.doNotContact;
    formNotes = c.notes;
    formLinkedClientIds = [...c.linkedClientIds];
    isModalOpen = true;
  }

  function closeModal() {
    isModalOpen = false;
    editingId = null;
  }

  function toggleClientLink(cId: string) {
    if (formLinkedClientIds.includes(cId)) {
      formLinkedClientIds = formLinkedClientIds.filter(id => id !== cId);
    } else {
      formLinkedClientIds = [...formLinkedClientIds, cId];
    }
  }

  async function handleSaveContact(e: Event) {
    e.preventDefault();
    if (!authState.user) return;
    if (!formFirstName.trim() || !formLastName.trim()) {
      toast.error('Nome e Cognome sono obbligatori.');
      return;
    }

    submitting = true;
    try {
      if (editingId) {
        await ContactsService.updateContact(editingId, {
          firstName: formFirstName,
          lastName: formLastName,
          role: formRole,
          phone: formPhone,
          mobile: formMobile,
          email: formEmail,
          pec: formPec,
          doNotContact: formDoNotContact,
          notes: formNotes,
          linkedClientIds: formLinkedClientIds,
          userId: authState.user.uid
        });
        toast.success(`Contatto "${formFirstName} ${formLastName}" aggiornato!`);
      } else {
        await ContactsService.createContact({
          firstName: formFirstName,
          lastName: formLastName,
          role: formRole,
          phone: formPhone,
          mobile: formMobile,
          email: formEmail,
          pec: formPec,
          doNotContact: formDoNotContact,
          notes: formNotes,
          linkedClientIds: formLinkedClientIds,
          userId: authState.user.uid
        });
        toast.success(`Contatto "${formFirstName} ${formLastName}" creato con successo!`);
      }

      closeModal();
      await loadContacts();
    } catch (err: any) {
      toast.error(err?.message || 'Errore durante il salvataggio del contatto.');
    } finally {
      submitting = false;
    }
  }

  async function handleDeleteContact(c: ContactItem) {
    if (!confirm(`Sei sicuro di voler eliminare il contatto "${c.fullName}"?`)) return;
    try {
      await ContactsService.deleteContact(c.id);
      toast.success(`Contatto "${c.fullName}" eliminato.`);
      await loadContacts();
    } catch (e: any) {
      toast.error('Impossibile eliminare il contatto: ' + (e?.message || e));
    }
  }

  // --- Anonymization Modal State ---
  import AnonymizeModal from '$lib/components/AnonymizeModal.svelte';
  import { AnonymizationService, CONTACTS_ANONYMIZATION_SPEC } from '$lib/services/anonymizationService';
  import { db, doc, getDoc } from '$lib/firebase';

  let anonymizeModalOpen = $state(false);
  let selectedContactForAnonymization = $state<Record<string, any> | null>(null);

  async function handleAnonymizeClick(id: string) {
    try {
      const docSnap = await getDoc(doc(db, 'contacts', id));
      if (!docSnap.exists()) {
        toast.error('Contatto non trovato nel database.');
        return;
      }
      const data = docSnap.data();
      data.id = id;
      selectedContactForAnonymization = data;
      anonymizeModalOpen = true;
    } catch (e: any) {
      toast.error('Errore durante il caricamento del contatto: ' + e.message);
    }
  }

  async function confirmAnonymize() {
    if (!selectedContactForAnonymization) return;
    try {
      await AnonymizationService.anonymizeEntity('contacts', selectedContactForAnonymization.id, CONTACTS_ANONYMIZATION_SPEC, authState.user?.uid || 'system');
      toast.success('Contatto anonimizzato con successo.');
      await loadContacts();
    } catch (e: any) {
      toast.error('Errore durante l\'anonimizzazione: ' + e.message);
    }
  }
</script>

<div class="contacts-hub animate-fade-in">

<AnonymizeModal
  isOpen={anonymizeModalOpen}
  entityName="Contatto"
  originalDoc={selectedContactForAnonymization}
  specs={CONTACTS_ANONYMIZATION_SPEC}
  onClose={() => { anonymizeModalOpen = false; selectedContactForAnonymization = null; }}
  onConfirm={confirmAnonymize}
/>
  <div class="page-top-actions">
    <div>
      <h2 class="title-header">
        <UserCheck size={28} color="var(--color-primary-600)" />
        Gestione Contatti & Referenti
      </h2>
      <p class="subtitle">Anagrafica centralizzata delle persone di riferimento con relazione Many-to-Many verso i Clienti.</p>
    </div>

    <button class="btn-primary" onclick={openAddModal}>
      <Plus size={18} /> Nuovo Contatto
    </button>
  </div>

  <!-- Filter & Search Toolbar -->
  <div class="toolbar-card">
    <div class="search-box">
      <Search size={18} class="search-icon" />
      <input
        type="text"
        placeholder="Cerca per nome, cognome, email, telefono o ruolo..."
        bind:value={searchVal}
        oninput={() => loadContacts()}
      />
    </div>

    <div class="filters-row">
      <div class="filter-item">
        <Filter size={16} class="filter-icon" />
        <select bind:value={filterStatus} onchange={() => loadContacts()}>
          <option value="all">Tutti gli stati</option>
          <option value="active">Solo Attivi</option>
          <option value="doNotContact">Non contattare più</option>
        </select>
      </div>

      <div class="filter-item">
        <Building size={16} class="filter-icon" />
        <select bind:value={filterClientId} onchange={() => loadContacts()}>
          <option value="">Tutti i Clienti</option>
          {#each clientOptions as item}
            <option value={item.id}>{item.name}</option>
          {/each}
        </select>
      </div>
    </div>
  </div>

  {#if loading}
    <div class="loading-state">Caricamento contatti in corso...</div>
  {:else if contacts.length === 0}
    <div class="empty-card">
      <UserX size={48} color="var(--color-neutral-400)" />
      <h3>Nessun contatto trovato</h3>
      <p>Non è presente alcun contatto con i filtri selezionati. Crea il tuo primo contatto per iniziare.</p>
      <button class="btn-primary mt-12" onclick={openAddModal}>
        <Plus size={18} /> Crea Nuovo Contatto
      </button>
    </div>
  {:else}
    <div class="contacts-grid">
      {#each contacts as c (c.id)}
        <div class="contact-card" class:do-not-contact={c.doNotContact}>
          <div class="card-top">
            <div class="user-avatar">
              {c.firstName.charAt(0)}{c.lastName.charAt(0)}
            </div>

            <div class="user-details">
              <div class="user-name">
                {c.fullName}
                {#if c.doNotContact}
                  <span class="badge-dnc">
                    <UserX size={12} /> Non Contattare
                  </span>
                {:else}
                  <span class="badge-active">
                    <Check size={12} /> Attivo
                  </span>
                {/if}
              </div>
              <div class="user-role">{c.role || 'Referente / Contatto'}</div>
            </div>

            <div class="card-actions">
              <button class="btn-icon" onclick={() => openEditModal(c)} title="Modifica contatto">
                <Edit size={16} />
              </button>
              <button class="btn-icon btn-anonymize" onclick={() => handleAnonymizeClick(c.id)} title="Anonimizza Referente">
                <ShieldAlert size={16} />
              </button>
              <button class="btn-icon danger" onclick={() => handleDeleteContact(c)} title="Elimina contatto">
                <Trash2 size={16} />
              </button>
            </div>
          </div>

          <div class="card-body">
            {#if c.phone}
              <div class="info-row">
                <Phone size={14} class="info-icon" />
                <span>{c.phone}</span>
              </div>
            {/if}

            {#if c.mobile}
              <div class="info-row">
                <Phone size={14} class="info-icon" />
                <span>{c.mobile} (Cellulare)</span>
              </div>
            {/if}

            {#if c.email}
              <div class="info-row">
                <Mail size={14} class="info-icon" />
                <a href="mailto:{c.email}" class="link-email">{c.email}</a>
              </div>
            {/if}

            {#if c.notes}
              <div class="notes-preview">
                "{c.notes}"
              </div>
            {/if}
          </div>

          <div class="card-footer">
            <div class="clients-tag-list">
              <Building size={14} class="info-icon" />
              {#if c.linkedClientIds.length === 0}
                <span class="tag-empty">Nessun cliente associato</span>
              {:else}
                {#each c.linkedClientIds as cId}
                  <span class="client-pill">
                    {clientLookup[cId] || 'Cliente (' + cId + ')'}
                  </span>
                {/each}
              {/if}
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<!-- Modal: Add / Edit Contact -->
{#if isModalOpen}
  <div class="modal-backdrop" onclick={closeModal}>
    <div class="modal-card animate-scale-in" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <h3>
          <UserCheck size={22} color="var(--color-primary-600)" />
          {editingId ? 'Modifica Contatto Referente' : 'Nuovo Contatto Referente'}
        </h3>
        <button class="btn-close" onclick={closeModal}>
          <X size={20} />
        </button>
      </div>

      <form onsubmit={handleSaveContact} class="modal-body">
        <div class="form-grid-two">
          <div class="field-group">
            <label for="cnt-fn">Nome *</label>
            <input type="text" id="cnt-fn" bind:value={formFirstName} placeholder="es. Mario" required disabled={submitting} />
          </div>

          <div class="field-group">
            <label for="cnt-ln">Cognome *</label>
            <input type="text" id="cnt-ln" bind:value={formLastName} placeholder="es. Rossi" required disabled={submitting} />
          </div>
        </div>

        <div class="field-group">
          <label for="cnt-role">Ruolo / Incarico</label>
          <input type="text" id="cnt-role" bind:value={formRole} placeholder="es. Referente Tecnico / Capocantiere" disabled={submitting} />
        </div>

        <div class="form-grid-two">
          <div class="field-group">
            <label for="cnt-phone">Telefono Diretto</label>
            <input type="text" id="cnt-phone" bind:value={formPhone} placeholder="es. +39 02 9876543" disabled={submitting} />
          </div>

          <div class="field-group">
            <label for="cnt-mobile">Cellulare / Mobile</label>
            <input type="text" id="cnt-mobile" bind:value={formMobile} placeholder="es. +39 333 1234567" disabled={submitting} />
          </div>
        </div>

        <div class="form-grid-two">
          <div class="field-group">
            <label for="cnt-email">Email Principale</label>
            <input type="email" id="cnt-email" bind:value={formEmail} placeholder="es. m.rossi@cgen.it" disabled={submitting} />
          </div>

          <div class="field-group">
            <label for="cnt-pec">PEC</label>
            <input type="email" id="cnt-pec" bind:value={formPec} placeholder="es. amministrazione@pec.cgen.it" disabled={submitting} />
          </div>
        </div>

        <div class="field-group dnc-box">
          <label class="checkbox-container">
            <input type="checkbox" bind:checked={formDoNotContact} disabled={submitting} />
            <span class="dnc-label-text">
              <strong>Non contattare più</strong> (Segnala l'espresso rifiuto ad essere contattato)
            </span>
          </label>
        </div>

        <!-- Linked Clients Selection -->
        <div class="field-group">
          <span class="field-label-span">Clienti Associati</span>
          <MultiComplete
            options={clientOptions.map(c => ({ id: c.id, label: c.name }))}
            bind:value={formLinkedClientIds}
            placeholder="Scegli clienti da associare..."
            disabled={submitting}
          />
        </div>

        <div class="field-group">
          <label for="cnt-notes">Note / Storico Interazioni</label>
          <textarea id="cnt-notes" bind:value={formNotes} rows="3" placeholder="Annotazioni utili sul referente..." disabled={submitting}></textarea>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn-secondary" onclick={closeModal} disabled={submitting}>
            Annulla
          </button>
          <button type="submit" class="btn-primary" disabled={submitting}>
            <Save size={16} />
            {#if submitting}Salvataggio...{:else}Salva Contatto{/if}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<style>
  .contacts-hub {
    width: 100%;
    padding: 24px 0;
  }
  .page-top-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
  }
  .title-header {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 26px;
    font-weight: 700;
    color: var(--color-neutral-900, #111827);
    margin: 0 0 4px 0;
  }
  .subtitle {
    font-size: 14px;
    color: var(--color-neutral-500, #6b7280);
    margin: 0;
  }
  .btn-primary {
    display: flex;
    align-items: center;
    gap: 8px;
    background: var(--color-primary-600, #2563eb);
    color: white;
    padding: 10px 18px;
    border: none;
    border-radius: var(--radius-md, 8px);
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
  }
  .btn-primary:hover:not(:disabled) {
    background: var(--color-primary-700, #1d4ed8);
  }
  .btn-secondary {
    background: var(--color-neutral-100, #f3f4f6);
    color: var(--color-neutral-700, #374151);
    border: 1px solid var(--color-neutral-300, #d1d5db);
    padding: 10px 16px;
    border-radius: var(--radius-md, 8px);
    font-weight: 600;
    cursor: pointer;
  }

  .toolbar-card {
    background: white;
    border: 1px solid var(--color-neutral-200, #e5e7eb);
    border-radius: var(--radius-lg, 12px);
    padding: 16px;
    margin-bottom: 24px;
    display: flex;
    gap: 16px;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
  }
  .search-box {
    display: flex;
    align-items: center;
    gap: 10px;
    background: var(--color-neutral-50, #f9fafb);
    border: 1px solid var(--color-neutral-300, #d1d5db);
    border-radius: var(--radius-md, 8px);
    padding: 8px 14px;
    flex: 1;
    min-width: 280px;
  }
  .search-box input {
    border: none;
    background: transparent;
    width: 100%;
    outline: none;
    font-size: 14px;
  }
  .filters-row {
    display: flex;
    gap: 12px;
  }
  .filter-item {
    display: flex;
    align-items: center;
    gap: 8px;
    background: var(--color-neutral-50, #f9fafb);
    border: 1px solid var(--color-neutral-300, #d1d5db);
    border-radius: var(--radius-md, 8px);
    padding: 8px 12px;
  }
  .filter-item select {
    border: none;
    background: transparent;
    outline: none;
    font-size: 14px;
    cursor: pointer;
  }

  .loading-state {
    padding: 40px;
    text-align: center;
    color: var(--color-neutral-500, #6b7280);
  }
  .empty-card {
    background: white;
    border: 1px dashed var(--color-neutral-300, #d1d5db);
    border-radius: var(--radius-lg, 12px);
    padding: 48px;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .empty-card h3 {
    margin: 16px 0 8px 0;
    color: var(--color-neutral-800, #1f2937);
  }
  .empty-card p {
    color: var(--color-neutral-500, #6b7280);
    margin: 0;
  }

  .contacts-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 20px;
  }
  .contact-card {
    background: white;
    border: 1px solid var(--color-neutral-200, #e5e7eb);
    border-radius: var(--radius-lg, 12px);
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    transition: box-shadow 0.2s, border-color 0.2s;
  }
  .contact-card:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
    border-color: var(--color-primary-300, #93c5fd);
  }
  .contact-card.do-not-contact {
    border-left: 4px solid var(--color-error, #ef4444);
    background: #fffdfd;
  }

  .card-top {
    display: flex;
    align-items: flex-start;
    gap: 14px;
  }
  .user-avatar {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: var(--color-primary-100, #dbeafe);
    color: var(--color-primary-700, #1d4ed8);
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    flex-shrink: 0;
  }
  .user-details {
    flex: 1;
  }
  .user-name {
    font-size: 16px;
    font-weight: 700;
    color: var(--color-neutral-900, #111827);
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .user-role {
    font-size: 13px;
    color: var(--color-neutral-500, #6b7280);
    margin-top: 2px;
  }

  .badge-dnc {
    background: #fef2f2;
    color: #ef4444;
    border: 1px solid #fecaca;
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 11px;
    font-weight: 600;
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
  .badge-active {
    background: #f0fdf4;
    color: #16a34a;
    border: 1px solid #bbf7d0;
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 11px;
    font-weight: 600;
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  .card-actions {
    display: flex;
    gap: 4px;
  }
  .btn-icon {
    background: transparent;
    border: none;
    color: var(--color-neutral-500, #6b7280);
    padding: 6px;
    border-radius: var(--radius-md, 8px);
    cursor: pointer;
  }
  .btn-icon:hover {
    background: var(--color-neutral-100, #f3f4f6);
    color: var(--color-neutral-900, #111827);
  }
  .btn-icon.danger:hover, .btn-icon.btn-anonymize:hover {
    background: #fef2f2;
    color: #ef4444;
  }

  .card-body {
    display: flex;
    flex-direction: column;
    gap: 8px;
    font-size: 13px;
    color: var(--color-neutral-700, #374151);
  }
  .info-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .link-email {
    color: var(--color-primary-600, #2563eb);
    text-decoration: none;
  }
  .link-email:hover {
    text-decoration: underline;
  }
  .notes-preview {
    font-style: italic;
    color: var(--color-neutral-500, #6b7280);
    background: var(--color-neutral-50, #f9fafb);
    padding: 8px;
    border-radius: var(--radius-md, 8px);
    margin-top: 4px;
  }

  .card-footer {
    border-top: 1px solid var(--color-neutral-100, #f3f4f6);
    padding-top: 12px;
    margin-top: auto;
  }
  .clients-tag-list {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }
  .tag-empty {
    font-size: 12px;
    color: var(--color-neutral-400, #9ca3af);
  }
  .client-pill {
    background: var(--color-primary-50, #eff6ff);
    color: var(--color-primary-700, #1d4ed8);
    border: 1px solid var(--color-primary-200, #bfdbfe);
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 11px;
    font-weight: 600;
  }

  /* Modal Styling */
  .modal-backdrop {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 16px;
  }
  .modal-card {
    background: white;
    border-radius: var(--radius-lg, 12px);
    width: 100%;
    max-width: 600px;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
  }
  .modal-header {
    padding: 20px 24px;
    border-bottom: 1px solid var(--color-neutral-200, #e5e7eb);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .modal-header h3 {
    margin: 0;
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 18px;
  }
  .btn-close {
    background: transparent;
    border: none;
    cursor: pointer;
    color: var(--color-neutral-500, #6b7280);
  }
  .modal-body {
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .form-grid-two {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }
  .field-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .field-group label, .field-label-span {
    font-size: 13px;
    font-weight: 600;
    color: var(--color-neutral-700, #374151);
  }
  .field-group input, .field-group textarea {
    padding: 10px;
    border: 1px solid var(--color-neutral-300, #d1d5db);
    border-radius: var(--radius-md, 8px);
    font-size: 14px;
    outline: none;
  }
  .field-group input:focus, .field-group textarea:focus {
    border-color: var(--color-primary-600, #2563eb);
  }
  .dnc-box {
    background: #fef2f2;
    padding: 12px;
    border-radius: var(--radius-md, 8px);
    border: 1px solid #fecaca;
  }
  .checkbox-container {
    display: flex;
    align-items: center;
    gap: 10px;
    cursor: pointer;
  }
  .dnc-label-text {
    font-size: 13px;
    color: #b91c1c;
  }
  .clients-picker-box {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    max-height: 140px;
    overflow-y: auto;
    padding: 8px;
    background: var(--color-neutral-50, #f9fafb);
    border: 1px solid var(--color-neutral-300, #d1d5db);
    border-radius: var(--radius-md, 8px);
  }
  .picker-chip {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border-radius: 16px;
    border: 1px solid var(--color-neutral-300, #d1d5db);
    background: white;
    font-size: 12px;
    cursor: pointer;
    color: var(--color-neutral-700, #374151);
  }
  .picker-chip.selected {
    background: var(--color-primary-600, #2563eb);
    color: white;
    border-color: var(--color-primary-600, #2563eb);
  }
  .picker-empty {
    font-size: 13px;
    color: var(--color-neutral-400, #9ca3af);
    padding: 8px;
  }
  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    margin-top: 12px;
  }
  .mt-12 { margin-top: 12px; }
</style>
