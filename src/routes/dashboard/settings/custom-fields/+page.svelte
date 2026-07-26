<script lang="ts">
  import { onMount } from 'svelte';
  import { CustomFieldsService } from '$lib/services/customFieldsService';
  import type { CustomFieldDefinition, CustomFieldType } from '$lib/types/customFields';
  import { toast } from '$lib/stores/toast.svelte';
  import { confirmStore } from '$lib/stores/confirm.svelte';
  import { menuConfigStore } from '$lib/stores/menu';

  let fields = $state<CustomFieldDefinition[]>([]);
  let loading = $state(true);
  let selectedModule = $state<string>('clients');

  let hasInterventi = $derived($menuConfigStore.some(i => i.id === 'interventi'));
  let hasTickets = $derived($menuConfigStore.some(i => i.id === 'tickets'));
  let hasContracts = $derived($menuConfigStore.some(i => i.id === 'contracts'));

  // Form State for Create / Edit
  let isModalOpen = $state(false);
  let editingId = $state<string | null>(null);
  let fieldLabel = $state('');
  let fieldKey = $state('');
  let fieldType = $state<CustomFieldType>('text');
  let fieldModule = $state<string>('clients');
  let fieldRequired = $state(false);
  let fieldPlaceholder = $state('');
  let fieldOptionsText = $state('');
  let submitting = $state(false);

  let filteredFields = $derived(
    selectedModule === 'all'
      ? fields
      : fields.filter(f => f.module === selectedModule)
  );

  async function loadFields() {
    loading = true;
    try {
      fields = await CustomFieldsService.getAllFields();
    } catch (err: any) {
      toast.error('Errore nel caricamento dei campi personalizzati: ' + err.message);
    } finally {
      loading = false;
    }
  }

  function openCreateModal() {
    editingId = null;
    fieldLabel = '';
    fieldKey = '';
    fieldType = 'text';
    fieldModule = selectedModule !== 'all' ? (selectedModule as any) : 'clients';
    fieldRequired = false;
    fieldPlaceholder = '';
    fieldOptionsText = '';
    isModalOpen = true;
  }

  function openEditModal(f: CustomFieldDefinition) {
    editingId = f.id;
    fieldLabel = f.label;
    fieldKey = f.key;
    fieldType = f.type;
    fieldModule = f.module as any;
    fieldRequired = f.required || false;
    fieldPlaceholder = f.placeholder || '';
    fieldOptionsText = (f.options || []).map(o => `${o.value}:${o.label}`).join('\n');
    isModalOpen = true;
  }

  function handleAutoKey() {
    if (!editingId && fieldLabel && !fieldKey) {
      fieldKey = fieldLabel
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
    }
  }

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (!fieldLabel.trim()) return toast.error('Inserisci un\'etichetta valida.');
    if (!fieldKey.trim()) return toast.error('Inserisci una chiave di sistema valida.');

    submitting = true;
    try {
      let options: { value: string; label: string }[] | undefined = undefined;
      if (fieldType === 'select') {
        options = fieldOptionsText
          .split('\n')
          .map(line => line.trim())
          .filter(Boolean)
          .map(line => {
            const parts = line.split(':');
            const val = parts[0].trim();
            const lab = parts[1] ? parts[1].trim() : val;
            return { value: val, label: lab };
          });
      }

      await CustomFieldsService.saveField({
        ...(editingId ? { id: editingId } : {}),
        key: fieldKey,
        label: fieldLabel,
        type: fieldType,
        module: fieldModule,
        required: fieldRequired,
        placeholder: fieldPlaceholder,
        options,
        active: true
      });
      toast.success(editingId ? 'Campo personalizzato aggiornato con successo.' : 'Nuovo campo personalizzato creato.');
      isModalOpen = false;
      await loadFields();
    } catch (err: any) {
      toast.error('Errore durante il salvataggio: ' + err.message);
    } finally {
      submitting = false;
    }
  }

  async function toggleActive(f: CustomFieldDefinition) {
    try {
      await CustomFieldsService.saveField({ ...f, active: !f.active });
      toast.success(`Campo ${!f.active ? 'attivato' : 'disattivato'}.`);
      await loadFields();
    } catch (err: any) {
      toast.error('Errore durante il cambio di stato: ' + err.message);
    }
  }

  async function handleDelete(id: string) {
    const confirmed = await confirmStore.prompt('Sei sicuro di voler eliminare questo campo personalizzato?');
    if (!confirmed) return;
    try {
      await CustomFieldsService.deleteField(id);
      toast.success('Campo eliminato con successo.');
      await loadFields();
    } catch (err: any) {
      toast.error('Errore durante l\'eliminazione: ' + err.message);
    }
  }

  onMount(() => {
    loadFields();
  });
</script>

<div class="custom-fields-container">
  <div class="page-header">
    <div>
      <h1 class="page-title">⚙️ Gestione Campi Personalizzati PMI</h1>
      <p class="page-subtitle">Aggiungi e personalizza i campi dinamici per rispecchiare i processi della tua azienda.</p>
    </div>
    <button onclick={openCreateModal} class="btn btn-primary">➕ Nuovo Campo Personalizzato</button>
  </div>

  <div class="module-filter-bar">
    <label for="module-select">Filtra per Modulo:</label>
    <select id="module-select" bind:value={selectedModule} class="form-control-select">
      <option value="all">Tutti i Moduli</option>
      <option value="clients">👤 Clienti</option>
      {#if hasInterventi}<option value="interventi">🛠️ Interventi</option>{/if}
      {#if hasTickets}<option value="tickets">🎫 Ticket Assistenza</option>{/if}
      {#if hasContracts}<option value="contracts">📄 Contratti</option>{/if}
      <option value="global">🌐 Modulo Globale</option>
    </select>
  </div>

  {#if loading}
    <div class="loader-box">Caricamento campi personalizzati...</div>
  {:else if filteredFields.length === 0}
    <div class="empty-box">
      <p>Nessun campo personalizzato trovato per questo modulo.</p>
      <button onclick={openCreateModal} class="btn btn-secondary mt-8">Crea il primo campo</button>
    </div>
  {:else}
    <div class="table-responsive">
      <table class="data-table">
        <thead>
          <tr>
            <th>Stato</th>
            <th>Etichetta</th>
            <th>Chiave Sistema</th>
            <th>Tipo</th>
            <th>Modulo</th>
            <th>Obbligatorio</th>
            <th>Azioni</th>
          </tr>
        </thead>
        <tbody>
          {#each filteredFields as f}
            <tr>
              <td>
                <button
                  class="badge-btn {f.active ? 'badge-active' : 'badge-inactive'}"
                  onclick={() => toggleActive(f)}
                >
                  {f.active ? 'Attivo' : 'Disattivo'}
                </button>
              </td>
              <td><strong>{f.label}</strong></td>
              <td><code>{f.key}</code></td>
              <td><span class="type-tag">{f.type}</span></td>
              <td><span class="module-tag">{f.module}</span></td>
              <td>{f.required ? 'Sì' : 'No'}</td>
              <td class="actions-cell">
                <button onclick={() => openEditModal(f)} class="btn-action edit">✏️ Modifica</button>
                <button onclick={() => handleDelete(f.id)} class="btn-action delete">🗑️ Elimina</button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>

{#if isModalOpen}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="modal-backdrop" onclick={() => (isModalOpen = false)}>
    <div class="modal-card" onclick={(e) => e.stopPropagation()}>
      <header class="modal-header">
        <h3>{editingId ? '✏️ Modifica Campo Personalizzato' : '➕ Nuovo Campo Personalizzato'}</h3>
        <button class="close-btn" onclick={() => (isModalOpen = false)}>✕</button>
      </header>

      <form onsubmit={handleSubmit} class="modal-body">
        <div class="form-group">
          <label for="cf-label">Etichetta Visibile *</label>
          <input id="cf-label" type="text" placeholder="es. Codice SDI / Marca Caldaia" bind:value={fieldLabel} onblur={handleAutoKey} required class="form-control" />
        </div>

        <div class="form-group">
          <label for="cf-key">Chiave di Sistema (Unica in DB) *</label>
          <input id="cf-key" type="text" placeholder="es. codice_sdi" bind:value={fieldKey} disabled={!!editingId} required class="form-control" />
        </div>

        <div class="form-grid-2">
          <div class="form-group">
            <label for="cf-type">Tipo di Dato</label>
            <select id="cf-type" bind:value={fieldType} class="form-control">
              <option value="text">Testo Semplice</option>
              <option value="number">Numero / Importo</option>
              <option value="date">Data</option>
              <option value="select">Menu a Tendina (Select)</option>
              <option value="boolean">Casella di Spunta (Si/No)</option>
            </select>
          </div>

          <div class="form-group">
            <label for="cf-module">Modulo di Destinazione</label>
            <select id="cf-module" bind:value={fieldModule} class="form-control">
              <option value="clients">👤 Clienti</option>
              {#if hasInterventi}<option value="interventi">🛠️ Interventi</option>{/if}
              {#if hasTickets}<option value="tickets">🎫 Ticket Assistenza</option>{/if}
              {#if hasContracts}<option value="contracts">📄 Contratti</option>{/if}
              <option value="global">🌐 Modulo Globale</option>
            </select>
          </div>
        </div>

        {#if fieldType === 'select'}
          <div class="form-group mt-12">
            <label for="cf-options">Opzioni del Menu (formato `valore:Etichetta`, una per riga)</label>
            <textarea id="cf-options" rows="3" placeholder="es.&#10;opz1:Opzione 1&#10;opz2:Opzione 2" bind:value={fieldOptionsText} class="form-control"></textarea>
          </div>
        {/if}

        <div class="form-group">
          <label for="cf-placeholder">Placeholder (Testo di Aiuto)</label>
          <input id="cf-placeholder" type="text" placeholder="es. Inserisci il codice a 7 cifre" bind:value={fieldPlaceholder} class="form-control" />
        </div>

        <div class="form-checkbox-group">
          <label>
            <input type="checkbox" bind:checked={fieldRequired} />
            <strong>Campo Obbligatorio in Form</strong>
          </label>
        </div>

        <footer class="modal-footer">
          <button type="button" class="btn btn-secondary" onclick={() => (isModalOpen = false)}>Annulla</button>
          <button type="submit" class="btn btn-primary" disabled={submitting}>
            {submitting ? 'Salvataggio...' : editingId ? 'Salva Modifiche' : 'Crea Campo'}
          </button>
        </footer>
      </form>
    </div>
  </div>
{/if}

<style>
  .custom-fields-container {
    padding: 1.5rem;
    max-width: 1200px;
    margin: 0 auto;
  }
  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
  }
  .page-title {
    font-size: 1.5rem;
    font-weight: 800;
    color: #0f172a;
    margin: 0;
  }
  .page-subtitle {
    color: #64748b;
    font-size: 0.9rem;
    margin-top: 0.2rem;
  }
  .module-filter-bar {
    display: flex;
    align-items: center;
    gap: 0.8rem;
    background: #ffffff;
    padding: 0.8rem 1.2rem;
    border-radius: 12px;
    border: 1px solid #e2e8f0;
    margin-bottom: 1.5rem;
    font-weight: 600;
    color: #334155;
  }
  .form-control-select {
    padding: 0.4rem 0.8rem;
    border-radius: 8px;
    border: 1px solid #cbd5e1;
    font-size: 0.9rem;
    font-weight: 600;
  }
  .table-responsive {
    background: #ffffff;
    border-radius: 12px;
    border: 1px solid #e2e8f0;
    overflow: hidden;
  }
  .data-table {
    width: 100%;
    border-collapse: collapse;
    text-align: left;
    font-size: 0.9rem;
  }
  .data-table th, .data-table td {
    padding: 0.8rem 1rem;
    border-bottom: 1px solid #f1f5f9;
  }
  .data-table th {
    background: #f8fafc;
    color: #475569;
    font-weight: 700;
  }
  .type-tag, .module-tag {
    background: #f1f5f9;
    padding: 0.2rem 0.5rem;
    border-radius: 6px;
    font-size: 0.8rem;
    font-weight: 600;
    color: #475569;
  }
  .badge-btn {
    border: none;
    padding: 0.25rem 0.6rem;
    border-radius: 20px;
    font-size: 0.78rem;
    font-weight: 700;
    cursor: pointer;
  }
  .badge-active { background: #dcfce7; color: #166534; }
  .badge-inactive { background: #fee2e2; color: #991b1b; }
  .actions-cell {
    display: flex;
    gap: 0.4rem;
  }
  .btn-action {
    border: none;
    background: none;
    cursor: pointer;
    font-size: 0.82rem;
    font-weight: 600;
    padding: 0.3rem 0.5rem;
    border-radius: 6px;
  }
  .btn-action.edit { color: #2563eb; }
  .btn-action.delete { color: #dc2626; }
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.6);
    backdrop-filter: blur(4px);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 9999;
    padding: 1rem;
  }
  .modal-card {
    background: #ffffff;
    border-radius: 16px;
    width: 100%;
    max-width: 540px;
    box-shadow: 0 20px 25px -5px rgba(0,0,0,0.2);
  }
  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.2rem 1.5rem;
    border-bottom: 1px solid #e2e8f0;
  }
  .modal-header h3 { margin: 0; font-size: 1.1rem; font-weight: 700; }
  .close-btn { background: none; border: none; font-size: 1.2rem; cursor: pointer; color: #64748b; }
  .modal-body { padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem; }
  .form-group { display: flex; flex-direction: column; gap: 0.3rem; }
  .form-group label { font-size: 0.85rem; font-weight: 700; color: #334155; }
  .form-control { padding: 0.6rem 0.8rem; border-radius: 8px; border: 1px solid #cbd5e1; font-size: 0.9rem; }
  .form-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
  .form-checkbox-group { display: flex; align-items: center; gap: 0.5rem; }
  .modal-footer { display: flex; justify-content: flex-end; gap: 0.8rem; margin-top: 1rem; }
  .btn { padding: 0.6rem 1.2rem; border-radius: 8px; font-weight: 700; cursor: pointer; border: none; }
  .btn-primary { background: #3b82f6; color: white; }
  .btn-secondary { background: #e2e8f0; color: #334155; }
  .loader-box, .empty-box { background: white; padding: 3rem; text-align: center; border-radius: 12px; border: 1px solid #e2e8f0; }
</style>
