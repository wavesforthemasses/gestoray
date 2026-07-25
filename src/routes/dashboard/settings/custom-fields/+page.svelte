<script lang="ts">
  import { onMount } from 'svelte';
  import { CustomFieldsService } from '$lib/services/customFieldsService';
  import type { CustomFieldDefinition, CustomFieldType } from '$lib/types/customFields';

  let fields = $state<CustomFieldDefinition[]>([]);
  let loading = $state(true);
  let saving = $state(false);
  let selectedModule = $state<string>('interventi');

  // Modal / Form state per nuovo campo
  let showModal = $state(false);
  let editId = $state<string | null>(null);
  let fieldLabel = $state('');
  let fieldKey = $state('');
  let fieldType = $state<CustomFieldType>('text');
  let fieldModule = $state<'interventi' | 'clients' | 'tickets' | 'contracts' | 'global'>('interventi');
  let fieldRequired = $state(false);
  let fieldPlaceholder = $state('');
  let fieldOptionsText = $state(''); // Per tendine (valore:etichetta su righe)

  onMount(async () => {
    await loadFields();
  });

  async function loadFields() {
    loading = true;
    try {
      fields = await CustomFieldsService.getAllFields();
    } finally {
      loading = false;
    }
  }

  let filteredFields = $derived(
    fields.filter(f => selectedModule === 'all' || f.module === selectedModule)
  );

  function openCreateModal() {
    editId = null;
    fieldLabel = '';
    fieldKey = '';
    fieldType = 'text';
    fieldModule = selectedModule !== 'all' ? (selectedModule as any) : 'interventi';
    fieldRequired = false;
    fieldPlaceholder = '';
    fieldOptionsText = '';
    showModal = true;
  }

  function openEditModal(f: CustomFieldDefinition) {
    editId = f.id;
    fieldLabel = f.label;
    fieldKey = f.key;
    fieldType = f.type;
    fieldModule = f.module;
    fieldRequired = f.required || false;
    fieldPlaceholder = f.placeholder || '';
    fieldOptionsText = (f.options || []).map(o => `${o.value}:${o.label}`).join('\n');
    showModal = true;
  }

  async function handleSaveField() {
    if (!fieldLabel.trim()) return;
    saving = true;

    try {
      const options = fieldType === 'select' 
        ? fieldOptionsText.split('\n').filter(l => l.includes(':')).map(l => {
            const [value, label] = l.split(':');
            return { value: value.trim(), label: label.trim() };
          })
        : undefined;

      await CustomFieldsService.saveField({
        id: editId || undefined,
        label: fieldLabel.trim(),
        key: fieldKey.trim() || fieldLabel.trim().toLowerCase().replace(/[^a-z0-9]/g, '_'),
        type: fieldType,
        module: fieldModule,
        required: fieldRequired,
        placeholder: fieldPlaceholder.trim(),
        options,
        active: true
      });

      showModal = false;
      await loadFields();
    } catch (e: any) {
      alert('Errore salvataggio campo dinamico: ' + e.message);
    } finally {
      saving = false;
    }
  }

  async function handleDeleteField(id: string) {
    if (confirm('Sei sicuro di voler eliminare questo campo dinamico?')) {
      await CustomFieldsService.deleteField(id);
      await loadFields();
    }
  }
</script>

<svelte:head>
  <title>Campi Personalizzati | Gestoray</title>
</svelte:head>

<div class="custom-fields-settings-page animate-fade-in">
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
      <option value="interventi">🛠️ Interventi</option>
      <option value="clients">👤 Clienti</option>
      <option value="tickets">🎫 Ticket Assistenza</option>
      <option value="contracts">📄 Contratti</option>
      <option value="global">🌐 Modulo Globale</option>
    </select>
  </div>

  {#if loading}
    <div class="loader-box">Caricamento campi personalizzati...</div>
  {:else if filteredFields.length === 0}
    <div class="empty-box">
      <p>Nessun campo personalizzato configurato per questo modulo.</p>
      <button onclick={openCreateModal} class="btn btn-secondary">Crea il Primo Campo</button>
    </div>
  {:else}
    <div class="fields-table-card">
      <table class="data-table">
        <thead>
          <tr>
            <th>Etichetta</th>
            <th>Chiave Database (`key`)</th>
            <th>Tipo Dati</th>
            <th>Modulo</th>
            <th>Obbligatorio</th>
            <th>Azioni</th>
          </tr>
        </thead>
        <tbody>
          {#each filteredFields as field (field.id)}
            <tr>
              <td><strong>{field.label}</strong></td>
              <td><code>customFields.{field.key}</code></td>
              <td><span class="type-badge">{field.type}</span></td>
              <td><span class="module-badge">{field.module}</span></td>
              <td>{field.required ? '✅ Sì' : '❌ No'}</td>
              <td>
                <button onclick={() => openEditModal(field)} class="btn-icon" title="Modifica">✏️</button>
                <button onclick={() => handleDeleteField(field.id)} class="btn-icon danger" title="Elimina">🗑️</button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>

{#if showModal}
  <div class="modal-backdrop">
    <div class="modal-card">
      <div class="modal-header">
        <h3>{editId ? '✏️ Modifica Campo Personalizzato' : '➕ Nuovo Campo Personalizzato'}</h3>
        <button onclick={() => showModal = false} class="btn-close">✕</button>
      </div>

      <div class="modal-body">
        <div class="form-group">
          <label for="cf-label">Etichetta Visibile *</label>
          <input id="cf-label" type="text" placeholder="es. Codice SDI / Matricola Macchinario" bind:value={fieldLabel} class="form-control" />
        </div>

        <div class="grid-2 mt-12">
          <div class="form-group">
            <label for="cf-type">Tipo di Dato</label>
            <select id="cf-type" bind:value={fieldType} class="form-control">
              <option value="text">Testo Semplice</option>
              <option value="number">Numero</option>
              <option value="date">Data</option>
              <option value="select">Menu a Tendina (Select)</option>
              <option value="boolean">Casella di Spunta (Si/No)</option>
            </select>
          </div>

          <div class="form-group">
            <label for="cf-module">Modulo di Destinazione</label>
            <select id="cf-module" bind:value={fieldModule} class="form-control">
              <option value="interventi">🛠️ Interventi</option>
              <option value="clients">👤 Clienti</option>
              <option value="tickets">🎫 Ticket Assistenza</option>
              <option value="contracts">📄 Contratti</option>
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

        <div class="form-group mt-12">
          <label for="cf-placeholder">Testo Guida (Placeholder)</label>
          <input id="cf-placeholder" type="text" placeholder="es. Inserisci il codice a 7 cifre..." bind:value={fieldPlaceholder} class="form-control" />
        </div>

        <div class="form-group mt-12">
          <label class="checkbox-label">
            <input type="checkbox" bind:checked={fieldRequired} />
            <span>Rendi questo campo obbligatorio nei form</span>
          </label>
        </div>
      </div>

      <div class="modal-footer">
        <button onclick={() => showModal = false} class="btn btn-secondary">Annulla</button>
        <button onclick={handleSaveField} class="btn btn-primary" disabled={saving}>
          {saving ? 'Salvataggio...' : 'Salva Campo'}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .custom-fields-settings-page { max-width: 900px; margin: 0 auto; }
  .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
  .page-title { font-size: 24px; font-weight: 700; margin: 0 0 4px 0; color: var(--color-neutral-800); }
  .page-subtitle { margin: 0; font-size: 14px; color: var(--color-neutral-500); }
  .module-filter-bar { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
  .form-control-select { padding: 8px 12px; font-size: 14px; border: 1px solid var(--color-neutral-300); border-radius: var(--radius-md); background: white; }
  .fields-table-card { background: white; border: 1px solid var(--color-neutral-200); border-radius: var(--radius-lg); overflow: hidden; box-shadow: var(--shadow-sm); }
  .data-table { width: 100%; border-collapse: collapse; text-align: left; }
  .data-table th { background: var(--color-neutral-50); padding: 12px 16px; font-size: 12px; font-weight: 600; color: var(--color-neutral-600); border-bottom: 1px solid var(--color-neutral-200); }
  .data-table td { padding: 14px 16px; font-size: 13px; border-bottom: 1px solid var(--color-neutral-100); vertical-align: middle; }
  .type-badge, .module-badge { padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; background: var(--color-neutral-100); color: var(--color-neutral-700); }
  .btn { padding: 10px 18px; font-size: 14px; font-weight: 600; border-radius: var(--radius-md); border: none; cursor: pointer; }
  .btn-primary { background: var(--color-primary-500); color: white; }
  .btn-secondary { background: white; border: 1px solid var(--color-neutral-300); color: var(--color-neutral-700); }
  .btn-icon { background: transparent; border: none; font-size: 14px; cursor: pointer; margin-right: 6px; }
  .modal-backdrop { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.6); display: flex; align-items: center; justify-content: center; z-index: 999; padding: 20px; }
  .modal-card { background: white; border-radius: var(--radius-xl); width: 100%; max-width: 520px; overflow: hidden; box-shadow: var(--shadow-xl); }
  .modal-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 24px; border-bottom: 1px solid var(--color-neutral-200); }
  .modal-header h3 { margin: 0; font-size: 18px; color: var(--color-neutral-800); }
  .btn-close { background: transparent; border: none; font-size: 16px; cursor: pointer; color: var(--color-neutral-400); }
  .modal-body { padding: 24px; }
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .form-group { display: flex; flex-direction: column; gap: 6px; }
  .form-group label { font-size: 13px; font-weight: 600; color: var(--color-neutral-700); }
  .form-control { padding: 10px 12px; font-size: 14px; border: 1px solid var(--color-neutral-300); border-radius: var(--radius-md); width: 100%; box-sizing: border-box; }
  .modal-footer { display: flex; justify-content: flex-end; gap: 12px; padding: 16px 24px; background: var(--color-neutral-50); border-top: 1px solid var(--color-neutral-200); }
  .loader-box, .empty-box { padding: 40px; text-align: center; color: var(--color-neutral-500); }
  .mt-12 { margin-top: 12px; }
</style>
