<script lang="ts">
  import { projectStore } from '$lib/stores/project';
  import { onMount } from 'svelte';
  import { 
    ActivityTypesService, 
    type ActivityType, 
    DEFAULT_ACTIVITY_TYPES 
  } from '$lib/services/activityTypesService';
  import { toast } from '$lib/stores/toast.svelte';
  import { pageTitle } from '$lib/stores/page';
  import { 
    ClipboardList, 
    Plus, 
    Trash2, 
    RotateCcw, 
    Save, 
    Info, 
    ArrowLeft, 
    Phone, 
    Users, 
    Mail, 
    FileText, 
    Wrench, 
    MessageSquare,
    Check,
    Calendar,
    Shield
  } from '@lucide/svelte';

  pageTitle.set('Impostazioni Tipi Attività');

  let activityTypes = $state<ActivityType[]>([]);
  let loading = $state(true);
  let saving = $state(false);
  let showModal = $state(false);
  let editingItem = $state<ActivityType | null>(null);

  // Modal Form State
  let formId = $state('');
  let formName = $state('');
  let formCode = $state('');
  let formIcon = $state('Phone');
  let formIsSchedulable = $state(true);
  let formDefaultPriority = $state<'bassa' | 'media' | 'alta' | 'urgente'>('media');
  let formDefaultStatus = $state<'da_fare' | 'in_corso' | 'completata'>('completata');
  let formRolesInsert = $state<string[]>(['superadmin', 'amministrazione', 'commerciale', 'tecnico']);
  let formCanAssignToOthers = $state<string[]>(['superadmin', 'amministrazione']);

  const availableIcons = [
    { name: 'Phone', label: 'Telefono', component: Phone },
    { name: 'Users', label: 'Incontro / Gruppo', component: Users },
    { name: 'Mail', label: 'Email', component: Mail },
    { name: 'FileText', label: 'Preventivo / Doc', component: FileText },
    { name: 'Wrench', label: 'Assistenza / Intervento', component: Wrench },
    { name: 'MessageSquare', label: 'Nota / Messaggio', component: MessageSquare }
  ];

  const availableRoles = [
    { id: 'superadmin', label: 'Super Admin' },
    { id: 'amministrazione', label: 'Amministrazione' },
    { id: 'commerciale', label: 'Commerciale' },
    { id: 'tecnico', label: 'Tecnico' },
    { id: 'direzione', label: 'Direzione' }
  ];

  onMount(async () => {
    await loadData();
  });

  async function loadData() {
    loading = true;
    try {
      activityTypes = await ActivityTypesService.getActivityTypes();
    } catch (e) {
      console.error('Errore caricamento tipi attività:', e);
      toast.error('Errore caricamento impostazioni tipi attività.');
    } finally {
      loading = false;
    }
  }

  function openModal(item?: ActivityType) {
    if (item) {
      editingItem = item;
      formId = item.id;
      formName = item.name;
      formCode = item.code;
      formIcon = item.icon || 'Phone';
      formIsSchedulable = item.isSchedulable ?? true;
      formDefaultPriority = item.defaultPriority || 'media';
      formDefaultStatus = item.defaultStatus || 'completata';
      formRolesInsert = [...(item.rolesInsert || ['superadmin', 'commerciale'])];
      formCanAssignToOthers = [...(item.canAssignToOthers || ['superadmin', 'amministrazione'])];
    } else {
      editingItem = null;
      formId = `act_type_${Date.now()}`;
      formName = '';
      formCode = '';
      formIcon = 'Phone';
      formIsSchedulable = true;
      formDefaultPriority = 'media';
      formDefaultStatus = 'completata';
      formRolesInsert = ['superadmin', 'amministrazione', 'commerciale', 'tecnico'];
      formCanAssignToOthers = ['superadmin', 'amministrazione'];
    }
    showModal = true;
  }

  function closeModal() {
    showModal = false;
    editingItem = null;
  }

  function toggleRoleInsert(roleId: string) {
    if (formRolesInsert.includes(roleId)) {
      formRolesInsert = formRolesInsert.filter(r => r !== roleId);
    } else {
      formRolesInsert = [...formRolesInsert, roleId];
    }
  }

  function toggleRoleAssign(roleId: string) {
    if (formCanAssignToOthers.includes(roleId)) {
      formCanAssignToOthers = formCanAssignToOthers.filter(r => r !== roleId);
    } else {
      formCanAssignToOthers = [...formCanAssignToOthers, roleId];
    }
  }

  async function handleSaveItem() {
    if (!formName.trim()) {
      toast.error('Inserisci un nome per il Tipo di Attività.');
      return;
    }

    saving = true;
    try {
      const code = formCode.trim() || formName.trim().toLowerCase().replace(/\s+/g, '_');
      const itemToSave: ActivityType = {
        id: formId,
        code,
        name: formName.trim(),
        icon: formIcon,
        isSchedulable: formIsSchedulable,
        defaultPriority: formDefaultPriority,
        defaultStatus: formDefaultStatus,
        rolesInsert: formRolesInsert,
        canAssignToOthers: formCanAssignToOthers,
        order: editingItem ? editingItem.order : activityTypes.length + 1
      };

      await ActivityTypesService.saveActivityType(itemToSave);
      toast.success('Tipo di Attività salvato con successo!');
      closeModal();
      await loadData();
    } catch (e) {
      console.error('Errore salvataggio tipo attività:', e);
      toast.error('Errore durante il salvataggio.');
    } finally {
      saving = false;
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Sei sicuro di voler eliminare la tipologia "${name}"?`)) return;
    try {
      await ActivityTypesService.deleteActivityType(id);
      toast.success('Tipo di attività eliminato.');
      await loadData();
    } catch (e) {
      console.error('Errore eliminazione:', e);
      toast.error('Errore durante l\'eliminazione.');
    }
  }

  async function handleResetDefaults() {
    if (!confirm('Vuoi ripristinare ed inserire i Tipi di Attività predefiniti di sistema?')) return;
    loading = true;
    try {
      await ActivityTypesService.resetDefaults();
      toast.success('Tipi di Attività predefiniti ripristinati con successo!');
      await loadData();
    } catch (e) {
      console.error('Errore ripristino default:', e);
      toast.error('Errore durante il ripristino.');
    } finally {
      loading = false;
    }
  }

  function getIconComponent(iconName: string) {
    const found = availableIcons.find(i => i.name === iconName);
    return found ? found.component : ClipboardList;
  }
</script>

<svelte:head>
  <title>Impostazioni Tipi Attività | {$projectStore?.projectName || 'ERP'}</title>
</svelte:head>

<div class="activity-types-settings animate-fade-in">
  <div class="page-top">
    <div>
      <a href="/dashboard/settings" class="back-link">
        <ArrowLeft size={14} /> Torna alle Impostazioni
      </a>
      <h2 class="title-header">
        <ClipboardList size={26} color="var(--color-primary-600)" />
        Configurazione Tipi di Attività & KPI
      </h2>
      <p class="subtitle">
        Gestisci le tipologie di attività operative (es. Telefonata, Visita, Email, Preventivo) ed i relativi permessi di inserimento ed assegnazione.
      </p>
    </div>

    <div class="top-actions">
      <button class="btn btn-secondary" onclick={handleResetDefaults} disabled={loading}>
        <RotateCcw size={16} /> Popola Tipi di Default
      </button>
      <button class="btn btn-primary" onclick={() => openModal()} disabled={loading}>
        <Plus size={16} /> Nuovo Tipo Attività
      </button>
    </div>
  </div>

  <div class="info-card">
    <Info size={20} class="info-icon" />
    <div>
      <strong>Come funzionano i Tipi di Attività:</strong>
      <p>
        Ogni tipologia definisce i bottoni di registrazione rapida a 1-click nella Scheda Cliente, la possibilità di calendarizzazione futura e quali ruoli dello staff possono riassegnare il task ad altri colleghi.
      </p>
    </div>
  </div>

  {#if loading}
    <div class="loading-state">
      <span class="spinner"></span>
      Caricamento impostazioni tipi attività...
    </div>
  {:else}
    <div class="table-card">
      <table class="data-table">
        <thead>
          <tr>
            <th>Icona & Tipologia</th>
            <th>Schedulabile</th>
            <th>Stato Default</th>
            <th>Priorità Default</th>
            <th>Ruoli Abilitati</th>
            <th>Azioni</th>
          </tr>
        </thead>
        <tbody>
          {#each activityTypes as item}
            {@const IconComponent = getIconComponent(item.icon)}
            <tr>
              <td>
                <div class="type-cell">
                  <div class="icon-badge">
                    <IconComponent size={18} />
                  </div>
                  <div>
                    <strong class="type-name">{item.name}</strong>
                    <span class="type-code">Code: {item.code}</span>
                  </div>
                </div>
              </td>
              <td>
                {#if item.isSchedulable}
                  <span class="badge sched-badge">
                    <Calendar size={12} /> Programmabile
                  </span>
                {:else}
                  <span class="badge direct-badge">
                    <Check size={12} /> Solo Immediata
                  </span>
                {/if}
              </td>
              <td>
                <span class="badge status-badge {item.defaultStatus}">
                  {item.defaultStatus === 'completata' ? 'Completata' : item.defaultStatus === 'in_corso' ? 'In Corso' : 'Da Fare'}
                </span>
              </td>
              <td>
                <span class="badge priority-badge {item.defaultPriority}">
                  {item.defaultPriority.toUpperCase()}
                </span>
              </td>
              <td>
                <div class="roles-tags">
                  {#each item.rolesInsert as role}
                    <span class="role-tag">{role}</span>
                  {/each}
                </div>
              </td>
              <td>
                <div class="action-buttons">
                  <button class="action-btn edit-btn" onclick={() => openModal(item)} title="Modifica">
                    Modifica
                  </button>
                  {#if !item.isSystem}
                    <button class="action-btn delete-btn" onclick={() => handleDelete(item.id, item.name)} title="Elimina">
                      <Trash2 size={14} />
                    </button>
                  {/if}
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>

{#if showModal}
  <div class="modal-backdrop animate-fade-in">
    <div class="modal-card">
      <div class="modal-header">
        <h3>
          <ClipboardList size={20} />
          {editingItem ? 'Modifica Tipo Attività' : 'Nuovo Tipo Attività'}
        </h3>
        <button class="close-btn" onclick={closeModal}>&times;</button>
      </div>

      <div class="modal-body">
        <div class="form-group">
          <label for="formName">Nome Tipo Attività *</label>
          <input
            id="formName"
            type="text"
            bind:value={formName}
            placeholder="es. Telefonata Commerciale, Sopralluogo Cantiere"
            class="input-control"
          />
        </div>

        <div class="form-row">
          <div class="form-group flex-1">
            <label for="formIcon">Icona Vector</label>
            <select id="formIcon" bind:value={formIcon} class="input-control">
              {#each availableIcons as iconOpt}
                <option value={iconOpt.name}>{iconOpt.label} ({iconOpt.name})</option>
              {/each}
            </select>
          </div>

          <div class="form-group flex-1">
            <label for="formIsSchedulable">Opzione Scadenza / Future</label>
            <select id="formIsSchedulable" bind:value={formIsSchedulable} class="input-control">
              <option value={true}>Abilita Scadenza Programmata</option>
              <option value={false}>Solo Registrazione Immediata</option>
            </select>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group flex-1">
            <label for="formDefaultStatus">Stato Iniziale Default</label>
            <select id="formDefaultStatus" bind:value={formDefaultStatus} class="input-control">
              <option value="completata">Completata (Attività Svolta)</option>
              <option value="da_fare">Da Fare (Task Pianificato)</option>
              <option value="in_corso">In Corso</option>
            </select>
          </div>

          <div class="form-group flex-1">
            <label for="formDefaultPriority">Priorità Default</label>
            <select id="formDefaultPriority" bind:value={formDefaultPriority} class="input-control">
              <option value="bassa">Bassa</option>
              <option value="media">Media</option>
              <option value="alta">Alta</option>
              <option value="urgente">Urgente</option>
            </select>
          </div>
        </div>

        <div class="form-group">
          <label>Ruoli Abilitati all'Inserimento</label>
          <div class="checkbox-group">
            {#each availableRoles as role}
              <label class="checkbox-label">
                <input
                  type="checkbox"
                  checked={formRolesInsert.includes(role.id)}
                  onchange={() => toggleRoleInsert(role.id)}
                />
                <span>{role.label}</span>
              </label>
            {/each}
          </div>
        </div>

        <div class="form-group">
          <label>Ruoli con Permesso di Riassegnazione ad altri colleghi</label>
          <div class="checkbox-group">
            {#each availableRoles as role}
              <label class="checkbox-label">
                <input
                  type="checkbox"
                  checked={formCanAssignToOthers.includes(role.id)}
                  onchange={() => toggleRoleAssign(role.id)}
                />
                <span>{role.label}</span>
              </label>
            {/each}
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn btn-secondary" onclick={closeModal} disabled={saving}>Annulla</button>
        <button class="btn btn-primary" onclick={handleSaveItem} disabled={saving}>
          <Save size={16} /> {saving ? 'Salvataggio...' : 'Salva Tipologia'}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .activity-types-settings {
    padding: 24px 0;
    width: 100%;
  }
  .page-top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 20px;
    gap: 16px;
  }
  .back-link {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: var(--color-neutral-600);
    text-decoration: none;
    font-size: 0.875rem;
    margin-bottom: 8px;
  }
  .back-link:hover {
    color: var(--color-primary-600);
  }
  .title-header {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 1.5rem;
    font-weight: 700;
    margin: 0 0 6px 0;
  }
  .subtitle {
    color: var(--color-neutral-600);
    font-size: 0.95rem;
    margin: 0;
  }
  .top-actions {
    display: flex;
    gap: 12px;
  }
  .info-card {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    background: var(--color-primary-50, #eff6ff);
    border: 1px solid var(--color-primary-200, #bfdbfe);
    padding: 16px;
    border-radius: 10px;
    margin-bottom: 24px;
    font-size: 0.9rem;
    color: var(--color-neutral-800);
  }
  .table-card {
    background: #ffffff;
    border: 1px solid var(--color-neutral-200);
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  }
  .data-table {
    width: 100%;
    border-collapse: collapse;
    text-align: left;
    font-size: 0.9rem;
  }
  .data-table th {
    background: var(--color-neutral-50);
    padding: 14px 18px;
    font-weight: 600;
    color: var(--color-neutral-700);
    border-bottom: 1px solid var(--color-neutral-200);
  }
  .data-table td {
    padding: 14px 18px;
    border-bottom: 1px solid var(--color-neutral-100);
    vertical-align: middle;
  }
  .type-cell {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .icon-badge {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    background: var(--color-primary-100);
    color: var(--color-primary-700);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .type-name {
    display: block;
    color: var(--color-neutral-900);
  }
  .type-code {
    font-size: 0.75rem;
    color: var(--color-neutral-500);
  }
  .badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 600;
  }
  .sched-badge {
    background: #e0f2fe;
    color: #0369a1;
  }
  .direct-badge {
    background: #f1f5f9;
    color: #475569;
  }
  .status-badge.completata {
    background: #dcfce7;
    color: #15803d;
  }
  .status-badge.da_fare {
    background: #fef3c7;
    color: #b45309;
  }
  .status-badge.in_corso {
    background: #e0e7ff;
    color: #4338ca;
  }
  .priority-badge.alta, .priority-badge.urgente {
    background: #fee2e2;
    color: #b91c1c;
  }
  .priority-badge.media {
    background: #fef3c7;
    color: #b45309;
  }
  .priority-badge.bassa {
    background: #f1f5f9;
    color: #475569;
  }
  .roles-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .role-tag {
    background: var(--color-neutral-100);
    color: var(--color-neutral-700);
    font-size: 0.75rem;
    padding: 2px 6px;
    border-radius: 4px;
  }
  .action-buttons {
    display: flex;
    gap: 8px;
  }
  .action-btn {
    padding: 6px 12px;
    border-radius: 6px;
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
    border: 1px solid transparent;
  }
  .edit-btn {
    background: var(--color-neutral-100);
    color: var(--color-neutral-800);
  }
  .edit-btn:hover {
    background: var(--color-neutral-200);
  }
  .delete-btn {
    background: #fee2e2;
    color: #b91c1c;
  }
  .delete-btn:hover {
    background: #fca5a5;
  }
  .btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    border-radius: 8px;
    font-weight: 600;
    font-size: 0.9rem;
    cursor: pointer;
    border: 1px solid transparent;
  }
  .btn-primary {
    background: var(--color-primary-600);
    color: #ffffff;
  }
  .btn-primary:hover {
    background: var(--color-primary-700);
  }
  .btn-secondary {
    background: #ffffff;
    border: 1px solid var(--color-neutral-300);
    color: var(--color-neutral-700);
  }
  .btn-secondary:hover {
    background: var(--color-neutral-100);
  }

  /* Modal Styles */
  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 999;
  }
  .modal-card {
    background: #ffffff;
    border-radius: 12px;
    width: 100%;
    max-width: 580px;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
    overflow: hidden;
  }
  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    border-bottom: 1px solid var(--color-neutral-200);
  }
  .modal-header h3 {
    margin: 0;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 1.15rem;
  }
  .close-btn {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: var(--color-neutral-500);
  }
  .modal-body {
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    max-height: 70vh;
    overflow-y: auto;
  }
  .form-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .form-group label {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--color-neutral-700);
  }
  .input-control {
    padding: 10px;
    border: 1px solid var(--color-neutral-300);
    border-radius: 6px;
    font-size: 0.9rem;
  }
  .form-row {
    display: flex;
    gap: 12px;
  }
  .flex-1 {
    flex: 1;
  }
  .checkbox-group {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-top: 4px;
  }
  .checkbox-label {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 0.85rem;
    cursor: pointer;
  }
  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    padding: 16px 20px;
    background: var(--color-neutral-50);
    border-top: 1px solid var(--color-neutral-200);
  }
</style>
