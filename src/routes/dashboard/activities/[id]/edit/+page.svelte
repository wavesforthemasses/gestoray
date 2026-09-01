<script lang="ts">
  import { projectStore } from '$lib/stores/project';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { NavigationService } from '$lib/services/navigationService';
  import { ActivitiesService } from '../../activities.service';
  import type { ActivityItem, ActivityPriority, ActivityStatus, ActivityTargetType } from '../../schema';
  import { CustomFieldsService } from '$lib/services/customFieldsService';
  import { CacheLookupService, type CacheLookupItem } from '$lib/services/cacheLookupService';
  import { ActivityTypesService, type ActivityType } from '$lib/services/activityTypesService';
  import { ActivitiesBridgeOrchestrator, type TargetTypeOption } from '../../activities.orchestrator';
  import type { TargetSearchResult, TargetSummary } from '$lib/types/moduleActivitiesBridge';
  import { activeRoleState } from '$lib/auth.svelte';
  import { auth } from '$lib/firebase';
  import type { CustomFieldDefinition, CustomFieldValues } from '$lib/types/customFields';
  import CustomFieldsRenderer from '$lib/components/CustomFieldsRenderer.svelte';
  import { toast } from '$lib/stores/toast.svelte';
  import { FormField, Autocomplete, type AutocompleteOption } from '$lib';
  import { 
    List, 
    Pencil, 
    Info, 
    SlidersHorizontal, 
    Save, 
    AlertCircle,
    UserCheck,
    Building2,
    MapPin,
    Users,
    Truck,
    Clock,
    Calendar,
    Target,
    FileText,
    Phone,
    Mail,
    CheckCircle2,
    Search
  } from '@lucide/svelte';

  let activityId = $derived($page.params.id);
  let activity = $state<ActivityItem | null>(null);

  let users = $state<CacheLookupItem[]>([]);
  let teams = $state<CacheLookupItem[]>([]);
  let vehicles = $state<CacheLookupItem[]>([]);

  let userOptions = $derived<AutocompleteOption[]>(
    users.map(u => ({ id: u.id, label: u.name }))
  );

  let teamOptions = $derived<AutocompleteOption[]>([
    { id: '', label: 'Nessuna squadra' },
    ...teams.map(tm => ({ id: tm.id, label: tm.name }))
  ]);

  let vehicleOptions = $derived<AutocompleteOption[]>([
    { id: '', label: 'Nessun mezzo assegnato' },
    ...vehicles.map(vh => ({ id: vh.id, label: vh.name }))
  ]);

  let allActivityTypes = $state<ActivityType[]>([]);
  let customFieldsList = $state<CustomFieldDefinition[]>([]);
  let customFieldsValues = $state<CustomFieldValues>({});

  let loading = $state(true);
  let saving = $state(false);
  let errorMsg = $state('');

  // Target Context State
  let availableTargetTypes = $state<TargetTypeOption[]>([]);
  let selectedTargetType = $state<ActivityTargetType>('contact');
  let targetSearchTerm = $state('');
  let targetSearchResults = $state<TargetSearchResult[]>([]);
  let selectedTargetId = $state('');
  let selectedTargetSummary = $state<TargetSummary | null>(null);

  // Filtered Activity Types based on Target Context
  let availableActivityTypes = $derived.by(() => {
    return ActivitiesBridgeOrchestrator.filterActivityTypesForTarget(allActivityTypes, selectedTargetType);
  });

  // Form State
  let selectedTypeId = $state<string>('');
  let activityNumber = $state('');
  let title = $state('');
  let assignedUid = $state('');
  let durationMinutes = $state<number | undefined>(undefined);
  
  // Extra Entity assignments
  let selectedTeamId = $state('');
  let selectedVehicleId = $state('');

  let executionDate = $state('');
  let dueDate = $state('');
  let priority = $state<ActivityPriority>('media');
  let status = $state<ActivityStatus>('da_fare');
  let description = $state('');

  let updateAllGroup = $state(false);

  let selectedType = $derived(allActivityTypes.find(t => t.id === selectedTypeId));
  let canReassign = $derived(ActivityTypesService.canAssignToOthers(activeRoleState.role, selectedType));

  onMount(async () => {
    try {
      const installedModuleIds: string[] = ['places', 'vehicles', 'contracts', 'teams'];
      availableTargetTypes = ActivitiesBridgeOrchestrator.getAvailableTargetTypes(installedModuleIds);

      const [cFields, uList, typesList] = await Promise.all([
        CustomFieldsService.getFieldsForModule('activities'),
        CacheLookupService.getLookup('users'),
        ActivityTypesService.getActivityTypes()
      ]);

      let tList: CacheLookupItem[] = [];
      try {
        // @ts-ignore
        const mod = await import('../../../teams/teams.service');
        if (mod?.TeamsService) {
          const list = await mod.TeamsService.getTeams();
          tList = list.map((t: any) => ({ id: t.id || '', name: t.name }));
        }
      } catch (e) {
        tList = await CacheLookupService.getLookup('teams');
      }

      let vList: CacheLookupItem[] = [];
      try {
        // @ts-ignore
        const mod = await import('../../../vehicles/vehicles.service');
        if (mod?.VehiclesService) {
          const list = await mod.VehiclesService.getVehicles();
          vList = list.map((v: any) => ({ id: v.id || '', name: `${v.name} (${v.licensePlate})` }));
        }
      } catch (e) {
        vList = await CacheLookupService.getLookup('vehicles');
      }

      customFieldsList = cFields;
      users = uList;
      teams = tList;
      vehicles = vList;
      allActivityTypes = typesList;

      if (activityId) {
        activity = await ActivitiesService.getActivityById(activityId);
        if (activity) {
          activityNumber = activity.activityNumber || '';
          title = activity.title || '';
          selectedTypeId = activity.activityTypeId || '';
          assignedUid = activity.assignedUid || '';
          executionDate = activity.executionDate || '';
          dueDate = activity.dueDate || '';
          durationMinutes = activity.durationMinutes;
          priority = activity.priority || 'media';
          status = activity.status || 'da_fare';
          description = activity.description || '';

          if (activity.targetType) {
            selectedTargetType = activity.targetType;
            selectedTargetId = activity.targetId || '';
            if (selectedTargetId) {
              await loadTargetSummary(activity.targetType, selectedTargetId, activity.targetName);
            }
          }

          if (activity.assignedEntities) {
            const teamAss = activity.assignedEntities.find(a => a.entityType === 'team' || a.type === 'team');
            if (teamAss) selectedTeamId = teamAss.entityId || teamAss.id || '';

            const vehicleAss = activity.assignedEntities.find(a => a.entityType === 'vehicle' || a.type === 'vehicle');
            if (vehicleAss) selectedVehicleId = vehicleAss.entityId || vehicleAss.id || '';
          }

          if (activity.customFields) {
            customFieldsValues = { ...activity.customFields };
          }
        }
      }

      await searchTargetEntities();
    } catch (e) {
      console.error('Errore caricamento modifica attività:', e);
    } finally {
      loading = false;
    }
  });

  async function handleTargetTypeChange(newType: ActivityTargetType) {
    selectedTargetType = newType;
    selectedTargetId = '';
    selectedTargetSummary = null;
    targetSearchTerm = '';
    await searchTargetEntities();
  }

  async function searchTargetEntities() {
    targetSearchResults = await ActivitiesBridgeOrchestrator.searchTargets(
      selectedTargetType,
      targetSearchTerm,
      undefined,
      ['places', 'vehicles', 'contracts']
    );
  }

  async function selectTarget(target: TargetSearchResult) {
    selectedTargetId = target.id;
    await loadTargetSummary(selectedTargetType, target.id, target.label);
  }

  async function loadTargetSummary(type: ActivityTargetType, id: string, fallbackLabel?: string) {
    selectedTargetSummary = await ActivitiesBridgeOrchestrator.resolveTargetSummary(
      type,
      id,
      fallbackLabel,
      undefined,
      ['places', 'vehicles', 'contracts']
    );
  }

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (!activity) return;

    if (!assignedUid) {
      errorMsg = 'Seleziona l\'operatore assegnato.';
      return;
    }

    saving = true;
    errorMsg = '';

    try {
      const assignedUser = users.find(u => u.id === assignedUid);
      const selectedTeam = teams.find(t => t.id === selectedTeamId);
      const selectedVehicle = vehicles.find(v => v.id === selectedVehicleId);

      const assignedEntities: any[] = [];
      if (assignedUser) {
        assignedEntities.push({ type: 'user', entityType: 'user', id: assignedUser.id, entityId: assignedUser.id, name: assignedUser.name, entityName: assignedUser.name });
      }
      if (selectedTeam) {
        assignedEntities.push({ type: 'team', entityType: 'team', id: selectedTeam.id, entityId: selectedTeam.id, name: selectedTeam.name, entityName: selectedTeam.name });
      }
      if (selectedVehicle) {
        assignedEntities.push({ type: 'vehicle', entityType: 'vehicle', id: selectedVehicle.id, entityId: selectedVehicle.id, name: selectedVehicle.name, entityName: selectedVehicle.name });
      }

      const author = {
        uid: auth.currentUser?.uid || 'system',
        displayName: auth.currentUser?.displayName || auth.currentUser?.email || 'Utente'
      };

      const updates: Partial<ActivityItem> = {
        title: title.trim() || activity.title,
        activityTypeId: selectedTypeId,
        activityTypeName: selectedType ? selectedType.name : activity.activityTypeName,
        category: selectedType?.category || activity.category,
        targetType: selectedTargetType,
        targetId: selectedTargetId || undefined,
        targetName: selectedTargetSummary?.name || undefined,
        targetSubtext: selectedTargetSummary?.email || selectedTargetSummary?.phone || selectedTargetSummary?.address || undefined,
        assignedUid,
        assignedName: assignedUser ? assignedUser.name : 'Operatore',
        assignedEntities,
        executionDate,
        dueDate,
        durationMinutes: durationMinutes ? Number(durationMinutes) : undefined,
        priority,
        status,
        description: description.trim(),
        customFields: customFieldsValues
      };

      if (!activity?.id) throw new Error('ID attività non valido');
      await ActivitiesService.updateActivity(activity.id, updates, author);

      // Handle propagation to group if requested
      if (updateAllGroup && activity.groupId) {
        const groupActs = await ActivitiesService.getActivities();
        const siblings = groupActs.filter(a => a.groupId === activity!.groupId && a.id !== activity!.id);
        for (const sib of siblings) {
          if (sib.id) {
            await ActivitiesService.updateActivity(sib.id, {
              title: updates.title,
              activityTypeId: updates.activityTypeId,
              assignedUid: updates.assignedUid,
              assignedName: updates.assignedName,
              assignedEntities: updates.assignedEntities,
              priority: updates.priority,
              description: updates.description
            }, author);
          }
        }
      }

      toast.success('Attività aggiornata con successo!');
      await NavigationService.submitSuccessReturn($page.url.searchParams, `/dashboard/activities/${activity.id}`);
    } catch (err: any) {
      console.error('Errore aggiornamento attività:', err);
      errorMsg = err?.message || 'Si è verificato un errore durante l\'aggiornamento.';
    } finally {
      saving = false;
    }
  }
</script>

<svelte:head>
  <title>Modifica {activity ? activity.title : 'Attività'} | {$projectStore?.projectName || 'ERP'}</title>
</svelte:head>

<div class="edit-activity-page animate-fade-in">
  <header class="page-header">
    <div class="header-title-box">
      <a 
        href="/dashboard/activities" 
        class="btn-module-list" 
        title="Vai all'elenco attività"
        aria-label="Vai all'elenco attività"
      >
        <List size={20} />
      </a>
      <div>
        <h1 class="page-main-title">
          <Pencil size={24} color="var(--color-primary-600)" />
          Modifica Attività: {activity?.activityNumber || activityId}
        </h1>
        <p class="page-main-subtitle">Aggiorna le informazioni operative, lo stato o gli assegnatari dell'attività.</p>
      </div>
    </div>
  </header>

  {#if loading}
    <div class="loader-box">
      <span class="spinner"></span>
      Caricamento in corso...
    </div>
  {:else}
    {#if errorMsg}
      <div class="alert error-box">
        <AlertCircle size={18} />
        <span>{errorMsg}</span>
      </div>
    {/if}

    <form onsubmit={handleSubmit} class="activity-form">
      <!-- 1. CONTESTO & ENTITÀ BERSAGLIO -->
      <div class="form-section">
        <h3 class="section-title">
          <Target size={18} />
          1. Contesto & Entità Bersaglio
        </h3>
        <p class="section-desc">Seleziona a quale entità (referente, cliente, cantiere, mezzo) è associata l'attività.</p>

        <!-- Target Type Selector Pills -->
        <div class="target-type-selector">
          {#each availableTargetTypes as targetOpt}
            <button
              type="button"
              class="target-pill"
              class:active={selectedTargetType === targetOpt.targetType}
              onclick={() => handleTargetTypeChange(targetOpt.targetType)}
            >
              {#if targetOpt.targetType === 'contact'}
                <UserCheck size={16} />
              {:else if targetOpt.targetType === 'client'}
                <Building2 size={16} />
              {:else if targetOpt.targetType === 'user'}
                <Users size={16} />
              {:else if targetOpt.targetType === 'place'}
                <MapPin size={16} />
              {:else if targetOpt.targetType === 'vehicle'}
                <Truck size={16} />
              {:else if targetOpt.targetType === 'contract'}
                <FileText size={16} />
              {/if}
              <span>{targetOpt.targetLabel}</span>
            </button>
          {/each}
        </div>

        <!-- Target Search and Summary Grid -->
        <div class="form-grid-2 mt-16">
          <!-- Search Column -->
          <div class="target-search-col">
            <FormField id="targetSearch" label={`Cerca ${availableTargetTypes.find(t => t.targetType === selectedTargetType)?.targetLabel || 'Entità'}`}>
              <div class="search-input-box">
                <Search size={16} class="search-icon" />
                <input
                  type="text"
                  id="targetSearch"
                  placeholder="Cerca per nome, codice, email o telefono..."
                  bind:value={targetSearchTerm}
                  oninput={searchTargetEntities}
                  class="form-control with-icon"
                />
              </div>
            </FormField>

            <!-- Suggestions List -->
            <div class="target-results-list">
              {#if targetSearchResults.length === 0}
                <div class="results-empty">Nessun elemento trovato per la ricerca</div>
              {:else}
                {#each targetSearchResults as item}
                  <button
                    type="button"
                    class="target-result-item"
                    class:selected={selectedTargetId === item.id}
                    onclick={() => selectTarget(item)}
                  >
                    <div class="result-item-info">
                      <span class="result-title">{item.label}</span>
                      {#if item.subtext}
                        <span class="result-subtext">{item.subtext}</span>
                      {/if}
                    </div>
                    {#if selectedTargetId === item.id}
                      <CheckCircle2 size={16} class="check-icon" />
                    {/if}
                  </button>
                {/each}
              {/if}
            </div>
          </div>

          <!-- Selected Summary Column -->
          <div class="target-summary-col">
            <label class="form-field-label" for="target-summary-box">Dettaglio Bersaglio Selezionato</label>
            <div id="target-summary-box" class="target-summary-box" class:has-target={!!selectedTargetSummary}>
              {#if selectedTargetSummary}
                <div class="summary-header">
                  <span class="summary-name">{selectedTargetSummary.name}</span>
                  <span class="target-type-badge">{selectedTargetSummary.targetType}</span>
                </div>
                <div class="summary-details">
                  {#if selectedTargetSummary.phone}
                    <div class="summary-detail-row">
                      <Phone size={14} class="detail-icon" />
                      <span>{selectedTargetSummary.phone}</span>
                    </div>
                  {/if}
                  {#if selectedTargetSummary.email}
                    <div class="summary-detail-row">
                      <Mail size={14} class="detail-icon" />
                      <span>{selectedTargetSummary.email}</span>
                    </div>
                  {/if}
                  {#if selectedTargetSummary.address}
                    <div class="summary-detail-row">
                      <MapPin size={14} class="detail-icon" />
                      <span>{selectedTargetSummary.address}</span>
                    </div>
                  {/if}
                </div>
              {:else}
                <div class="summary-empty">
                  <Info size={28} class="empty-icon" />
                  <p>Nessun target associato (l'attività sarà generica o interna)</p>
                </div>
              {/if}
            </div>
          </div>
        </div>
      </div>

      <!-- 2. TIPOLOGIA & DATI OPERATIVI -->
      <div class="form-section">
        <h3 class="section-title">
          <SlidersHorizontal size={18} />
          2. Tipologia & Dati Operativi
        </h3>

        <div class="form-grid-3">
          <FormField id="activityType" label="Tipo Attività" required>
            <select 
              id="activityType"
              class="form-control"
              bind:value={selectedTypeId}
              required
            >
              {#each availableActivityTypes as t}
                <option value={t.id}>{t.name} ({t.code})</option>
              {/each}
            </select>
          </FormField>

          <FormField id="activityNumber" label="Codice Identificativo">
            <input 
              type="text" 
              id="activityNumber"
              bind:value={activityNumber} 
              class="form-control font-mono" 
              readonly
            />
          </FormField>

          <FormField id="title" label="Titolo / Oggetto" required>
            <input 
              type="text" 
              id="title"
              bind:value={title} 
              class="form-control"
              required
            />
          </FormField>
        </div>

        <div class="form-grid-3 mt-16">
          <FormField id="assignedUid" label="Operatore Responsabile *" required>
            <Autocomplete 
              options={userOptions} 
              bind:value={assignedUid} 
              disabled={!canReassign} 
              placeholder="Seleziona operatore..." 
            />
          </FormField>

          {#if teams.length > 0}
            <FormField id="selectedTeamId" label="Squadra Operativa (Opzionale)">
              <Autocomplete 
                options={teamOptions} 
                bind:value={selectedTeamId} 
                placeholder="Seleziona squadra..." 
              />
            </FormField>
          {/if}

          {#if vehicles.length > 0}
            <FormField id="selectedVehicleId" label="Mezzo Aziendale (Opzionale)">
              <Autocomplete 
                options={vehicleOptions} 
                bind:value={selectedVehicleId} 
                placeholder="Seleziona mezzo..." 
              />
            </FormField>
          {/if}
        </div>
      </div>

      <!-- 3. PIANIFICAZIONE & TEMPISTICHE -->
      <div class="form-section">
        <h3 class="section-title">
          <Calendar size={18} />
          3. Pianificazione & Date
        </h3>

        <div class="form-grid-4">
          <FormField id="executionDate" label="Data Esecuzione" required>
            <input type="date" id="executionDate" bind:value={executionDate} class="form-control" required />
          </FormField>

          <FormField id="dueDate" label="Scadenza / Due Date">
            <input type="date" id="dueDate" bind:value={dueDate} class="form-control" />
          </FormField>

          <FormField id="durationMinutes" label="Durata (Minuti)">
            <input type="number" id="durationMinutes" bind:value={durationMinutes} placeholder="es. 30" min="0" step="5" class="form-control" />
          </FormField>

          <FormField id="priority" label="Priorità">
            <select id="priority" bind:value={priority} class="form-control">
              <option value="bassa">Bassa</option>
              <option value="media">Media</option>
              <option value="alta">Alta</option>
              <option value="urgente">Urgente</option>
            </select>
          </FormField>
        </div>

        <div class="form-grid-2 mt-16">
          <FormField id="status" label="Stato Operativo">
            <select id="status" bind:value={status} class="form-control">
              <option value="da_fare">Da Fare</option>
              <option value="in_corso">In Corso</option>
              <option value="completata">Completata</option>
              <option value="annullata">Annullata</option>
            </select>
          </FormField>
        </div>

        {#if activity?.groupId}
          <div class="group-update-box mt-16">
            <label class="checkbox-label">
              <input type="checkbox" bind:checked={updateAllGroup} />
              <span>Applica modifiche (titolo, tipo, note, operatore) a tutte le attività collegate di questo gruppo</span>
            </label>
          </div>
        {/if}
      </div>

      <!-- 4. DESCRIZIONE & NOTE -->
      <div class="form-section">
        <h3 class="section-title">
          <Info size={18} />
          4. Descrizione & Note Operative
        </h3>

        <FormField id="description" label="Note / Dettaglio Attività">
          <textarea
            id="description"
            bind:value={description}
            rows={4}
            placeholder="Descrivi dettagli operativi, istruzioni o appunti per questa attività..."
            class="form-control"
          ></textarea>
        </FormField>
      </div>

      <!-- 5. CAMPI PERSONALIZZATI (SE PRESENTI) -->
      {#if customFieldsList.length > 0}
        <div class="form-section">
          <h3 class="section-title">
            <SlidersHorizontal size={18} />
            5. Campi Personalizzati
          </h3>
          <CustomFieldsRenderer fields={customFieldsList} bind:values={customFieldsValues} />
        </div>
      {/if}

      <!-- FORM ACTIONS -->
      <div class="form-actions">
        <button
          type="button"
          class="btn-cancel"
          onclick={() => NavigationService.cancelAndReturn($page.url.searchParams, `/dashboard/activities/${activityId}`)}
        >
          Annulla
        </button>
        <button type="submit" class="btn-save" disabled={saving}>
          <Save size={18} />
          <span>{saving ? 'Salvataggio...' : 'Salva Modifiche'}</span>
        </button>
      </div>
    </form>
  {/if}
</div>

<style>
  .edit-activity-page {
    width: 100%;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 24px;
    padding-bottom: 32px;
  }

  .page-header {
    margin-bottom: 4px;
  }

  .header-title-box {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .btn-back {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: var(--radius-md, 8px);
    background: var(--color-white, #ffffff);
    border: 1px solid var(--color-neutral-300, #cbd5e1);
    color: var(--color-neutral-700, #334155);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-back:hover {
    background: var(--color-neutral-100, #f1f5f9);
    border-color: var(--color-neutral-400, #94a3b8);
  }

  .page-main-title {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 24px;
    font-weight: 700;
    color: var(--color-neutral-900, #0f172a);
    margin: 0;
  }

  .page-main-subtitle {
    font-size: 13px;
    color: var(--color-neutral-500, #64748b);
    margin: 2px 0 0 0;
  }

  .activity-form {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .form-section {
    background: var(--color-white, #ffffff);
    border: 1px solid var(--color-neutral-200, #e2e8f0);
    border-radius: var(--radius-lg, 12px);
    padding: 24px;
    display: flex;
    flex-direction: column;
    box-shadow: var(--shadow-sm, 0 1px 2px 0 rgba(0, 0, 0, 0.05));
  }

  .section-title {
    font-size: 16px;
    font-weight: 700;
    color: var(--color-neutral-800, #1e293b);
    margin: 0 0 4px 0;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .section-desc {
    font-size: 13px;
    color: var(--color-neutral-500, #64748b);
    margin: 0 0 16px 0;
  }

  /* Target Pills */
  .target-type-selector {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 8px;
  }

  .target-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    border-radius: var(--radius-md, 8px);
    border: 1px solid var(--color-neutral-300, #cbd5e1);
    background: var(--color-white, #ffffff);
    color: var(--color-neutral-700, #334155);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .target-pill:hover {
    background: var(--color-neutral-50, #f8fafc);
    border-color: var(--color-neutral-400, #94a3b8);
  }

  .target-pill.active {
    background: var(--color-primary-600, #2563eb);
    color: white;
    border-color: var(--color-primary-600, #2563eb);
    box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2);
  }

  /* Target Search & Summary */
  .search-input-box {
    position: relative;
    width: 100%;
  }

  .search-icon {
    position: absolute;
    left: 12px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--color-neutral-400, #94a3b8);
    pointer-events: none;
  }

  .form-control.with-icon {
    padding-left: 36px;
  }

  .target-results-list {
    margin-top: 8px;
    max-height: 180px;
    overflow-y: auto;
    border: 1px solid var(--color-neutral-200, #e2e8f0);
    border-radius: var(--radius-md, 8px);
    background: var(--color-neutral-50, #f8fafc);
    display: flex;
    flex-direction: column;
  }

  .target-result-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 12px;
    border: none;
    border-bottom: 1px solid var(--color-neutral-200, #e2e8f0);
    background: transparent;
    text-align: left;
    cursor: pointer;
    transition: background 0.15s ease;
    width: 100%;
  }

  .target-result-item:last-child {
    border-bottom: none;
  }

  .target-result-item:hover {
    background: var(--color-neutral-100, #f1f5f9);
  }

  .target-result-item.selected {
    background: var(--color-primary-50, #eff6ff);
  }

  .result-item-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    overflow: hidden;
  }

  .result-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--color-neutral-800, #1e293b);
  }

  .result-subtext {
    font-size: 11.5px;
    color: var(--color-neutral-500, #64748b);
  }

  .check-icon {
    color: var(--color-primary-600, #2563eb);
    flex-shrink: 0;
  }

  .results-empty {
    padding: 16px;
    text-align: center;
    font-size: 12.5px;
    color: var(--color-neutral-400, #94a3b8);
  }

  /* Target Summary */
  .target-summary-box {
    height: 100%;
    min-height: 180px;
    border: 1px dashed var(--color-neutral-300, #cbd5e1);
    border-radius: var(--radius-md, 8px);
    background: var(--color-neutral-50, #f8fafc);
    padding: 16px;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }

  .target-summary-box.has-target {
    border: 1px solid var(--color-primary-200, #bfdbfe);
    background: var(--color-white, #ffffff);
    justify-content: flex-start;
  }

  .summary-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
  }

  .summary-name {
    font-size: 15px;
    font-weight: 700;
    color: var(--color-neutral-900, #0f172a);
  }

  .target-type-badge {
    font-size: 10.5px;
    font-weight: 700;
    text-transform: uppercase;
    padding: 2px 8px;
    border-radius: 4px;
    background: var(--color-primary-100, #dbeafe);
    color: var(--color-primary-700, #1d4ed8);
  }

  .summary-details {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .summary-detail-row {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: var(--color-neutral-600, #475569);
  }

  .detail-icon {
    color: var(--color-primary-500, #3b82f6);
    flex-shrink: 0;
  }

  .summary-empty {
    text-align: center;
    color: var(--color-neutral-400, #94a3b8);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }

  .summary-empty p {
    margin: 0;
    font-size: 12.5px;
  }

  /* Form Layout Grids */
  .form-grid-2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }

  .form-grid-3 {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 16px;
  }

  .form-grid-4 {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr 1fr;
    gap: 16px;
  }

  @media (max-width: 768px) {
    .form-grid-2, .form-grid-3, .form-grid-4 {
      grid-template-columns: 1fr;
    }
  }

  .mt-16 {
    margin-top: 16px;
  }

  .form-field-label {
    font-size: 13px;
    font-weight: 600;
    color: var(--color-neutral-700, #374151);
    margin-bottom: 6px;
    display: block;
  }

  .form-control {
    width: 100%;
    padding: 10px 14px;
    border: 1px solid var(--color-neutral-300, #cbd5e1);
    border-radius: var(--radius-md, 8px);
    font-size: 14px;
    color: var(--color-neutral-900, #0f172a);
    background: var(--color-white, #ffffff);
    box-sizing: border-box;
    outline: none;
    transition: border-color 0.15s ease;
  }

  .form-control:focus {
    border-color: var(--color-primary-600, #2563eb);
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
  }

  .font-mono {
    font-family: monospace;
  }

  .group-update-box {
    background: var(--color-neutral-50, #f8fafc);
    border: 1px solid var(--color-neutral-300, #cbd5e1);
    border-radius: var(--radius-md, 8px);
    padding: 12px 16px;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 13px;
    font-weight: 600;
    color: var(--color-neutral-700, #334155);
    cursor: pointer;
  }

  /* Actions */
  .form-actions {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 12px;
    margin-top: 8px;
  }

  .btn-cancel {
    padding: 10px 20px;
    border-radius: var(--radius-md, 8px);
    background: var(--color-neutral-100, #f1f5f9);
    border: 1px solid var(--color-neutral-300, #cbd5e1);
    color: var(--color-neutral-700, #334155);
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-cancel:hover {
    background: var(--color-neutral-200, #e2e8f0);
  }

  .btn-save {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 24px;
    border-radius: var(--radius-md, 8px);
    background: var(--color-primary-600, #2563eb);
    border: none;
    color: white;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .btn-save:hover:not(:disabled) {
    background: var(--color-primary-700, #1d4ed8);
  }

  .btn-save:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .loader-box {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 48px;
    color: var(--color-neutral-500, #64748b);
    font-size: 15px;
  }

  .spinner {
    width: 20px;
    height: 20px;
    border: 2px solid var(--color-neutral-300, #cbd5e1);
    border-top-color: var(--color-primary-600, #2563eb);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .error-box {
    background: #fef2f2;
    border: 1px solid #fecaca;
    color: #b91c1c;
    padding: 12px 16px;
    border-radius: var(--radius-md, 8px);
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 14px;
  }
</style>
