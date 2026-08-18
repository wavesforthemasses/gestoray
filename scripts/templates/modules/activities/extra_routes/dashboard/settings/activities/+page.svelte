<script lang="ts">
  import { projectStore } from '$lib/stores/project';
  import { onMount } from 'svelte';
  import { 
    ActivityTypesService, 
    type ActivityType, 
    type ActivityTargetType,
    DEFAULT_ACTIVITY_TYPES 
  } from '$lib/services/activityTypesService';
  import { BridgesSettingsService, bridgesConfigStore, ALL_BRIDGES_SPECS } from '$lib/services/bridgesSettingsService';
  import modulesRegistry from '$lib/config/modules.registry.json';
  import { toast } from '$lib/stores/toast.svelte';
  import { confirmStore } from '$lib/stores/confirm.svelte';
  import { pageTitle } from '$lib/stores/page';
  import { menuConfigStore } from '$lib/stores/menu';
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
    Shield,
    Target,
    Layers,
    UserCheck,
    Building2,
    MapPin,
    Truck,
    Ticket,
    CheckCircle2,
    Lock,
    Unlock
  } from '@lucide/svelte';

  pageTitle.set('Configurazione Tipi di Attività & Bridge');

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
  let formAllowedTargets = $state<ActivityTargetType[]>(['contact', 'client', 'user', 'place', 'vehicle', 'contract', 'ticket']);
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

  const availableTargets: { id: ActivityTargetType; label: string; icon: any; badgeClass: string }[] = [
    { id: 'contact', label: 'Contatti / Referenti', icon: UserCheck, badgeClass: 'badge-contact' },
    { id: 'client', label: 'Clienti / Aziende', icon: Building2, badgeClass: 'badge-client' },
    { id: 'place', label: 'Cantieri / Luoghi', icon: MapPin, badgeClass: 'badge-place' },
    { id: 'vehicle', label: 'Mezzi / Veicoli', icon: Truck, badgeClass: 'badge-vehicle' },
    { id: 'contract', label: 'Contratti / Offerte', icon: FileText, badgeClass: 'badge-contract' },
    { id: 'user', label: 'Utenti / Dipendenti', icon: Users, badgeClass: 'badge-user' },
    { id: 'ticket', label: 'Assistenza / Ticket', icon: Ticket, badgeClass: 'badge-ticket' }
  ];

  // Activities cross-module bridges
  const activitiesBridges = $derived(
    ALL_BRIDGES_SPECS.filter(b => b.sourceModule === 'activities')
  );

  const installedModuleIds = $derived(
    new Set([
      'clients', 'contacts', 'users', 'qualifications', 'todo', 'settings',
      ...(modulesRegistry.modules || []).map((m: any) => m.id),
      ...$menuConfigStore.map(m => m.id)
    ])
  );

  onMount(async () => {
    await Promise.all([loadData(), BridgesSettingsService.init()]);
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
      formAllowedTargets = Array.isArray(item.allowedTargets) && item.allowedTargets.length > 0
        ? [...item.allowedTargets]
        : ['contact', 'client', 'user', 'place', 'vehicle', 'contract', 'ticket'];
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
      formAllowedTargets = ['contact', 'client', 'user', 'place', 'vehicle', 'contract', 'ticket'];
      formRolesInsert = ['superadmin', 'amministrazione', 'commerciale', 'tecnico'];
      formCanAssignToOthers = ['superadmin', 'amministrazione'];
    }
    showModal = true;
  }

  function closeModal() {
    showModal = false;
    editingItem = null;
  }

  function toggleTarget(targetId: ActivityTargetType) {
    if (formAllowedTargets.includes(targetId)) {
      formAllowedTargets = formAllowedTargets.filter(t => t !== targetId);
    } else {
      formAllowedTargets = [...formAllowedTargets, targetId];
    }
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

  async function toggleBridge(bridgeId: string) {
    const currentStatus = BridgesSettingsService.isBridgeEnabled(bridgeId, $bridgesConfigStore);
    const nextStatus = !currentStatus;
    try {
      await BridgesSettingsService.setBridgeStatus(bridgeId, nextStatus);
      toast.success(`Bridge ${bridgeId} ${nextStatus ? 'attivato' : 'disattivato'} con successo!`);
    } catch (e) {
      console.error('Errore aggiornamento bridge:', e);
      toast.error('Errore durante l\'aggiornamento del bridge.');
    }
  }

  async function handleSaveItem() {
    if (!formName.trim()) {
      toast.error('Inserisci un nome per il Tipo di Attività.');
      return;
    }

    if (formAllowedTargets.length === 0) {
      toast.error('Seleziona almeno un modulo/entità bersaglio abilitata per questa tipologia.');
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
        allowedTargets: formAllowedTargets,
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
    const confirmed = await confirmStore.prompt(`Sei sicuro di voler eliminare la tipologia "${name}"?`);
    if (!confirmed) return;
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
    const confirmed = await confirmStore.prompt('Vuoi ripristinare ed inserire i Tipi di Attività predefiniti di sistema?');
    if (!confirmed) return;
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
  <title>Configurazione Attività & Bridge | {$projectStore?.projectName || 'ERP'}</title>
</svelte:head>

<div class="activity-types-settings animate-fade-in">
  <div class="page-top">
    <div>
      <a href="/dashboard/settings" class="back-link">
        <ArrowLeft size={14} /> Torna alle Impostazioni
      </a>
      <h2 class="title-header">
        <ClipboardList size={26} color="var(--color-primary-600)" />
        Configurazione Tipi di Attività & Plugin Bridges
      </h2>
      <p class="subtitle">
        Gestisci le tipologie di attività operative (es. Telefonata, Visita, Email, Preventivo), i permessi e in quali schede/moduli (Clienti, Contatti, Cantieri, Mezzi) ciascuna tipologia è visibile.
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

  <!-- BRIDGES TOGGLE CARD -->
  <div class="bridges-settings-card">
    <div class="card-header-with-icon">
      <Layers size={20} class="header-icon" />
      <div>
        <h3 class="card-title">Abilitazione Bridge Attività nei Moduli Aziendali</h3>
        <p class="card-desc">
          Controlla in quali moduli aziendali è attiva l'integrazione con il modulo Attività. Disattivando un bridge, la relativa tab o azione rapida verrà nascosta dalla scheda corrispondente.
        </p>
      </div>
    </div>

    <div class="bridges-grid">
      {#each activitiesBridges as bridge}
        {@const isCore = ['clients', 'contacts', 'users', 'qualifications'].includes(bridge.targetModule)}
        {@const isTargetInstalled = isCore || installedModuleIds.has(bridge.targetModule)}
        {@const isBridgeOn = BridgesSettingsService.isBridgeEnabled(bridge.id, $bridgesConfigStore)}

        <div class="bridge-item-card" class:disabled={!isTargetInstalled} class:active={isBridgeOn && isTargetInstalled}>
          <div class="bridge-item-header">
            <div class="bridge-info">
              <span class="bridge-title">{bridge.title}</span>
              <span class="bridge-target-badge">{bridge.targetModule}</span>
            </div>
            
            {#if isTargetInstalled}
              <button 
                type="button" 
                class="bridge-toggle-btn" 
                class:active={isBridgeOn}
                onclick={() => toggleBridge(bridge.id)}
                title={isBridgeOn ? 'Disattiva Bridge' : 'Attiva Bridge'}
              >
                {#if isBridgeOn}
                  <Unlock size={14} /> Attivo
                {:else}
                  <Lock size={14} /> Disattivato
                {/if}
              </button>
            {:else}
              <span class="badge-module-missing">Modulo {bridge.targetModule} non installato</span>
            {/if}
          </div>
          <p class="bridge-desc">{bridge.description}</p>
        </div>
      {/each}
    </div>
  </div>

  <div class="info-card">
    <Info size={20} class="info-icon" />
    <div>
      <strong>Come funzionano i Tipi di Attività ed i Bersagli:</strong>
      <p>
        Ogni tipologia definisce in quali <strong>moduli bersaglio</strong> (Contatti, Clienti, Luoghi, Mezzi, Contratti) è abilitata la registrazione rapida a 1-click, la possibilità di calendarizzazione futura e quali ruoli dello staff possono gestirla.
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
            <th>Entità & Moduli Abilitati</th>
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
                <div class="target-badges-wrap">
                  {#if Array.isArray(item.allowedTargets) && item.allowedTargets.length > 0}
                    {#each item.allowedTargets as tgtId}
                      {@const tgtSpec = availableTargets.find(t => t.id === tgtId)}
                      <span class="target-pill-badge {tgtSpec?.badgeClass || 'badge-default'}">
                        {tgtSpec?.label?.split('/')[0]?.trim() || tgtId}
                      </span>
                    {/each}
                  {:else}
                    <span class="target-pill-badge badge-all">Tutte le Entità</span>
                  {/if}
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

<!-- Modal: Add / Edit Activity Type -->
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

        <!-- ALLOWED TARGETS / BRIDGES SELECTION -->
        <div class="form-group section-box">
          <label class="section-group-title">
            <Target size={16} />
            Entità & Moduli Abilitati (In quali bridge/moduli compare questo tipo di attività) *
          </label>
          <p class="field-hint">
            Seleziona in quali contesti e schede sarà possibile selezionare e registrare questa specifica tipologia di attività.
          </p>
          <div class="targets-grid">
            {#each availableTargets as target}
              {@const isChecked = formAllowedTargets.includes(target.id)}
              {@const TargetIcon = target.icon}
              <label class="target-card-select" class:checked={isChecked}>
                <input
                  type="checkbox"
                  checked={isChecked}
                  onchange={() => toggleTarget(target.id)}
                />
                <div class="target-card-content">
                  <div class="target-card-top">
                    <TargetIcon size={16} class="target-card-icon" />
                    <span class="target-card-name">{target.label}</span>
                  </div>
                  <span class="target-card-code">tag: {target.id}</span>
                </div>
              </label>
            {/each}
          </div>
        </div>

        <div class="form-group">
          <label class="section-group-title">
            <Shield size={16} />
            Ruoli Abilitati all'Inserimento
          </label>
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
          <label class="section-group-title">
            <Users size={16} />
            Ruoli con Permesso di Riassegnazione ad altri colleghi
          </label>
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
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 24px;
  }
  .page-top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
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
    color: var(--color-neutral-900);
    margin: 0 0 6px 0;
  }
  .subtitle {
    font-size: 0.875rem;
    color: var(--color-neutral-500);
    margin: 0;
  }
  .top-actions {
    display: flex;
    gap: 10px;
  }

  /* Bridges settings card */
  .bridges-settings-card {
    background: var(--color-white, #ffffff);
    border: 1px solid var(--color-neutral-200, #e2e8f0);
    border-radius: var(--radius-lg, 12px);
    padding: 20px 24px;
    box-shadow: var(--shadow-sm, 0 1px 2px rgba(0, 0, 0, 0.05));
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .card-header-with-icon {
    display: flex;
    align-items: flex-start;
    gap: 12px;
  }

  .header-icon {
    color: var(--color-primary-600, #2563eb);
    margin-top: 2px;
  }

  .card-title {
    font-size: 16px;
    font-weight: 700;
    color: var(--color-neutral-800, #1e293b);
    margin: 0 0 4px 0;
  }

  .card-desc {
    font-size: 13px;
    color: var(--color-neutral-500, #64748b);
    margin: 0;
  }

  .bridges-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 14px;
  }

  .bridge-item-card {
    background: var(--color-neutral-50, #f8fafc);
    border: 1px solid var(--color-neutral-200, #e2e8f0);
    border-radius: var(--radius-md, 8px);
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    transition: all 0.15s ease;
  }

  .bridge-item-card.active {
    border-color: var(--color-primary-300, #93c5fd);
    background: var(--color-primary-50, #eff6ff);
  }

  .bridge-item-card.disabled {
    opacity: 0.6;
    background: var(--color-neutral-100, #f1f5f9);
  }

  .bridge-item-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }

  .bridge-info {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .bridge-title {
    font-size: 13.5px;
    font-weight: 700;
    color: var(--color-neutral-800, #1e293b);
  }

  .bridge-target-badge {
    font-size: 10.5px;
    font-weight: 700;
    text-transform: uppercase;
    padding: 2px 6px;
    border-radius: 4px;
    background: var(--color-neutral-200, #e2e8f0);
    color: var(--color-neutral-700, #334155);
  }

  .bridge-toggle-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border-radius: 6px;
    font-size: 11.5px;
    font-weight: 600;
    cursor: pointer;
    border: 1px solid var(--color-neutral-300, #cbd5e1);
    background: var(--color-white, #ffffff);
    color: var(--color-neutral-600, #475569);
    transition: all 0.15s ease;
  }

  .bridge-toggle-btn.active {
    background: var(--color-primary-600, #2563eb);
    color: white;
    border-color: var(--color-primary-600, #2563eb);
  }

  .badge-module-missing {
    font-size: 11px;
    color: var(--color-neutral-400, #94a3b8);
    font-style: italic;
  }

  .bridge-desc {
    font-size: 12px;
    color: var(--color-neutral-600, #475569);
    margin: 0;
    line-height: 1.4;
  }

  .info-card {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    padding: 16px;
    background: var(--color-primary-50, #eff6ff);
    border: 1px solid var(--color-primary-200, #bfdbfe);
    border-radius: 8px;
    color: var(--color-primary-900, #1e3a8a);
    font-size: 0.875rem;
  }
  .info-icon {
    color: var(--color-primary-600, #2563eb);
    flex-shrink: 0;
    margin-top: 2px;
  }

  /* Table styling */
  .table-card {
    background: white;
    border-radius: 8px;
    border: 1px solid var(--color-neutral-200);
    overflow: hidden;
    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
  }
  .data-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;
    text-align: left;
  }
  .data-table th {
    background: var(--color-neutral-50);
    padding: 12px 16px;
    font-weight: 600;
    color: var(--color-neutral-700);
    border-bottom: 1px solid var(--color-neutral-200);
  }
  .data-table td {
    padding: 14px 16px;
    border-bottom: 1px solid var(--color-neutral-100);
    vertical-align: middle;
  }
  .data-table tr:hover {
    background: var(--color-neutral-50);
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
    background: var(--color-primary-50);
    color: var(--color-primary-600);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .type-name {
    display: block;
    font-weight: 600;
    color: var(--color-neutral-900);
  }
  .type-code {
    display: block;
    font-size: 0.75rem;
    color: var(--color-neutral-500);
  }

  /* Target badges */
  .target-badges-wrap {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    max-width: 260px;
  }

  .target-pill-badge {
    font-size: 11px;
    font-weight: 600;
    padding: 2px 7px;
    border-radius: 4px;
  }

  .badge-contact { background: #e0f2fe; color: #0369a1; }
  .badge-client { background: #ede9fe; color: #6d28d9; }
  .badge-place { background: #ecfdf5; color: #047857; }
  .badge-vehicle { background: #ffedd5; color: #c2410c; }
  .badge-contract { background: #fef3c7; color: #b45309; }
  .badge-user { background: #f1f5f9; color: #334155; }
  .badge-ticket { background: #fee2e2; color: #b91c1c; }
  .badge-default { background: #f1f5f9; color: #475569; }
  .badge-all { background: #dcfce7; color: #15803d; font-weight: 700; }

  /* Badges */
  .badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 500;
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
  .priority-badge.urgente {
    background: #fee2e2;
    color: #b91c1c;
    font-weight: 700;
  }
  .priority-badge.alta {
    background: #ffedd5;
    color: #c2410c;
  }
  .priority-badge.media {
    background: #fef3c7;
    color: #b45309;
  }
  .priority-badge.bassa {
    background: #f1f5f9;
    color: #64748b;
  }

  .roles-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .role-tag {
    background: var(--color-neutral-100);
    color: var(--color-neutral-700);
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 0.75rem;
  }

  .action-buttons {
    display: flex;
    gap: 6px;
  }
  .action-btn {
    border: none;
    background: none;
    cursor: pointer;
    padding: 6px;
    border-radius: 4px;
    font-size: 0.8125rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .edit-btn {
    color: var(--color-primary-600);
    font-weight: 500;
  }
  .edit-btn:hover {
    background: var(--color-primary-50);
  }
  .delete-btn {
    color: var(--color-danger-600, #dc2626);
  }
  .delete-btn:hover {
    background: #fee2e2;
  }

  /* Buttons */
  .btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    border: 1px solid transparent;
    transition: all 0.15s ease;
  }
  .btn-primary {
    background: var(--color-primary-600);
    color: white;
  }
  .btn-primary:hover {
    background: var(--color-primary-700);
  }
  .btn-secondary {
    background: white;
    border-color: var(--color-neutral-300);
    color: var(--color-neutral-700);
  }
  .btn-secondary:hover {
    background: var(--color-neutral-50);
  }

  /* Modal */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 999;
    padding: 16px;
  }
  .modal-card {
    background: white;
    border-radius: 12px;
    width: 100%;
    max-width: 650px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
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
    font-size: 1.125rem;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .close-btn {
    border: none;
    background: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: var(--color-neutral-400);
  }
  .modal-body {
    padding: 20px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    padding: 16px 20px;
    border-top: 1px solid var(--color-neutral-200);
    background: var(--color-neutral-50);
    border-bottom-left-radius: 12px;
    border-bottom-right-radius: 12px;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .form-group label {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--color-neutral-700);
  }
  .form-row {
    display: flex;
    gap: 12px;
  }
  .flex-1 {
    flex: 1;
  }
  .input-control {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid var(--color-neutral-300);
    border-radius: 6px;
    font-size: 0.875rem;
    color: var(--color-neutral-900);
    box-sizing: border-box;
  }
  .input-control:focus {
    border-color: var(--color-primary-600);
    outline: none;
  }

  .section-box {
    padding: 14px;
    background: var(--color-neutral-50, #f8fafc);
    border: 1px solid var(--color-neutral-200, #e2e8f0);
    border-radius: var(--radius-md, 8px);
  }

  .section-group-title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px !important;
    font-weight: 700 !important;
    color: var(--color-neutral-800, #1e293b) !important;
    margin-bottom: 2px;
  }

  .field-hint {
    font-size: 12px;
    color: var(--color-neutral-500, #64748b);
    margin: 0 0 10px 0;
  }

  /* Targets grid in modal */
  .targets-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 8px;
  }

  .target-card-select {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    background: var(--color-white, #ffffff);
    border: 1px solid var(--color-neutral-300, #cbd5e1);
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .target-card-select.checked {
    border-color: var(--color-primary-500, #3b82f6);
    background: var(--color-primary-50, #eff6ff);
  }

  .target-card-content {
    display: flex;
    flex-direction: column;
    gap: 2px;
    overflow: hidden;
  }

  .target-card-top {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .target-card-icon {
    color: var(--color-primary-600, #2563eb);
    flex-shrink: 0;
  }

  .target-card-name {
    font-size: 12px;
    font-weight: 600;
    color: var(--color-neutral-800, #1e293b);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .target-card-code {
    font-size: 10.5px;
    color: var(--color-neutral-400, #94a3b8);
  }

  .checkbox-group {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 8px;
  }
  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.8125rem;
    color: var(--color-neutral-700);
    cursor: pointer;
  }

  .loading-state {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 40px;
    color: var(--color-neutral-500);
  }
  .spinner {
    width: 20px;
    height: 20px;
    border: 2px solid var(--color-neutral-300);
    border-top-color: var(--color-primary-600);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>
