<script lang="ts">
  import { projectStore } from '$lib/stores/project';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { NavigationService } from '$lib/services/navigationService';
  import { ActivitiesService } from '../activities.service';
  import type { ActivityPriority, ActivityStatus, ActivityTargetType } from '../schema';
  import { CustomFieldsService } from '$lib/services/customFieldsService';
  import { CacheLookupService, type CacheLookupItem } from '$lib/services/cacheLookupService';
  import { ActivityTypesService, type ActivityType } from '$lib/services/activityTypesService';
  import { ActivitiesBridgeOrchestrator, type TargetTypeOption } from '../activities.orchestrator';
  import type { TargetSearchResult, TargetSummary } from '$lib/types/moduleActivitiesBridge';
  import { activeRoleState } from '$lib/auth.svelte';
  import { auth } from '$lib/firebase';
  import type { CustomFieldDefinition, CustomFieldValues } from '$lib/types/customFields';
  import CustomFieldsRenderer from '$lib/components/CustomFieldsRenderer.svelte';
  import { toast } from '$lib/stores/toast.svelte';
  import { FormField, Card } from '$lib';
  import { 
    List, 
    ClipboardList, 
    Info, 
    SlidersHorizontal, 
    Save, 
    AlertCircle, 
    Calendar, 
    Clock, 
    UserCheck, 
    Building2, 
    MapPin, 
    Users, 
    Truck,
    FileText,
    Target,
    Phone,
    Mail,
    CheckCircle2,
    Search,
    User,
    Check
  } from '@lucide/svelte';

  let users = $state<CacheLookupItem[]>([]);
  let teams = $state<CacheLookupItem[]>([]);
  let vehicles = $state<CacheLookupItem[]>([]);

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

  let selectedTargetLabel = $derived(
    availableTargetTypes.find(t => t.targetType === selectedTargetType)?.targetLabel || 'Entità'
  );

  // Filtered Activity Types based on Target Context
  let availableActivityTypes = $derived.by(() => {
    return ActivitiesBridgeOrchestrator.filterActivityTypesForTarget(allActivityTypes, selectedTargetType);
  });

  // Form State
  let selectedTypeId = $state<string>('');
  let activityNumber = $state(`ACT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
  let title = $state('');
  let assignedUid = $state('');
  let durationMinutes = $state<number | undefined>(undefined);
  
  // Extra Entity assignments
  let selectedTeamId = $state('');
  let selectedVehicleId = $state('');

  // Scheduling Mode
  let schedulingType = $state<'singola' | 'multiple'>('singola');
  let executionDate = $state(new Date().toISOString().slice(0, 10));
  let endDate = $state(new Date().toISOString().slice(0, 10));
  let dueDate = $state('');

  let priority = $state<ActivityPriority>('media');
  let status = $state<ActivityStatus>('da_fare');
  let description = $state('');

  let selectedType = $derived(allActivityTypes.find(t => t.id === selectedTypeId));
  let canReassign = $derived(ActivityTypesService.canAssignToOthers(activeRoleState.role, selectedType));

  onMount(async () => {
    try {
      const paramDate = $page.url.searchParams.get('date');
      if (paramDate) {
        executionDate = paramDate;
        endDate = paramDate;
        dueDate = paramDate;
      }

      // Discover active modules
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
        const mod = await import('../../teams/teams.service');
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
        const mod = await import('../../vehicles/vehicles.service');
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

      // Handle query params for target pre-selection (prioritize specific targets over generic client)
      const paramTargetType = $page.url.searchParams.get('targetType') as ActivityTargetType;
      const paramTargetId = $page.url.searchParams.get('targetId');
      const paramPlaceId = $page.url.searchParams.get('placeId');
      const paramContractId = $page.url.searchParams.get('contractId');
      const paramVehicleId = $page.url.searchParams.get('vehicleId');
      const paramContactId = $page.url.searchParams.get('contactId');
      const paramClientId = $page.url.searchParams.get('clientId');

      if (paramTargetType && paramTargetId) {
        selectedTargetType = paramTargetType;
        selectedTargetId = paramTargetId;
        await loadTargetSummary(paramTargetType, paramTargetId);
      } else if (paramPlaceId) {
        selectedTargetType = 'place';
        selectedTargetId = paramPlaceId;
        await loadTargetSummary('place', paramPlaceId);
      } else if (paramContractId) {
        selectedTargetType = 'contract';
        selectedTargetId = paramContractId;
        await loadTargetSummary('contract', paramContractId);
      } else if (paramVehicleId) {
        selectedTargetType = 'vehicle';
        selectedTargetId = paramVehicleId;
        await loadTargetSummary('vehicle', paramVehicleId);
      } else if (paramContactId) {
        selectedTargetType = 'contact';
        selectedTargetId = paramContactId;
        await loadTargetSummary('contact', paramContactId);
      } else if (paramClientId) {
        selectedTargetType = 'client';
        selectedTargetId = paramClientId;
        await loadTargetSummary('client', paramClientId);
      }

      // Initial search for default target type
      await searchTargetEntities();

      // Pre-select first compatible activity type
      const compatibleTypes = ActivitiesBridgeOrchestrator.filterActivityTypesForTarget(allActivityTypes, selectedTargetType);
      if (compatibleTypes.length > 0) {
        selectedTypeId = compatibleTypes[0].id;
        applyTypeDefaults(compatibleTypes[0]);
      }

      // Auto-assign to logged in user by default
      const currentUid = auth.currentUser?.uid || '';
      const matchingUser = users.find(u => u.id === currentUid);
      if (matchingUser) {
        assignedUid = matchingUser.id;
      } else if (users.length > 0) {
        assignedUid = users[0].id;
      }
    } catch (e) {
      console.error('Errore caricamento dati creazione attività:', e);
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

    // Re-filter activity types
    const compatible = ActivitiesBridgeOrchestrator.filterActivityTypesForTarget(allActivityTypes, selectedTargetType);
    if (compatible.length > 0 && !compatible.some(t => t.id === selectedTypeId)) {
      selectedTypeId = compatible[0].id;
      applyTypeDefaults(compatible[0]);
    }
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

  function applyTypeDefaults(type: ActivityType) {
    priority = type.defaultPriority || 'media';
    status = (type.defaultStatus as ActivityStatus) || 'da_fare';
  }

  function handleTypeChange(e: Event) {
    const target = e.target as HTMLSelectElement;
    selectedTypeId = target.value;
    const found = allActivityTypes.find(t => t.id === selectedTypeId);
    if (found) {
      applyTypeDefaults(found);
      // Auto-switch target if current target is not allowed
      if (Array.isArray(found.allowedTargets) && found.allowedTargets.length > 0) {
        if (!found.allowedTargets.includes(selectedTargetType)) {
          selectedTargetType = found.allowedTargets[0];
          selectedTargetId = '';
          selectedTargetSummary = null;
          searchTargetEntities();
        }
      }
    }
  }

  function getDatesInRange(start: string, end: string): string[] {
    const dates: string[] = [];
    let current = new Date(start);
    const last = new Date(end);
    while (current <= last) {
      dates.push(current.toISOString().slice(0, 10));
      current.setDate(current.getDate() + 1);
    }
    return dates;
  }

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    
    let finalTitle = title.trim();
    if (!finalTitle && selectedType) {
      finalTitle = selectedType.name;
    } else if (!finalTitle) {
      finalTitle = 'Attività Operativa';
    }

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

      // Determine date schedule array
      let dates = [executionDate];
      let groupId: string | undefined = undefined;

      if (schedulingType === 'multiple' && endDate && endDate > executionDate) {
        dates = getDatesInRange(executionDate, endDate);
        groupId = 'group_' + Date.now();
      }

      let firstActId = '';
      const author = {
        uid: auth.currentUser?.uid || 'system',
        displayName: auth.currentUser?.displayName || auth.currentUser?.email || 'Utente'
      };

      for (const d of dates) {
        const relationalClientId = selectedTargetType === 'client' ? selectedTargetId : (selectedTargetSummary?.meta?.clientId ? String(selectedTargetSummary.meta.clientId) : undefined);
        const relationalClientName = selectedTargetType === 'client' ? (selectedTargetSummary?.name || '') : (selectedTargetSummary?.meta?.clientName ? String(selectedTargetSummary.meta.clientName) : undefined);
        const relationalPlaceId = selectedTargetType === 'place' ? selectedTargetId : undefined;
        const relationalPlaceName = selectedTargetType === 'place' ? (selectedTargetSummary?.name || '') : undefined;
        const relationalContactId = selectedTargetType === 'contact' ? selectedTargetId : undefined;
        const relationalContactName = selectedTargetType === 'contact' ? (selectedTargetSummary?.name || '') : undefined;

        const actId = await ActivitiesService.createActivity({
          activityNumber: dates.length > 1 ? `${activityNumber.trim()}-${d.replace(/-/g, '')}` : activityNumber.trim(),
          title: finalTitle,
          activityTypeId: selectedTypeId,
          activityTypeName: selectedType ? selectedType.name : '',
          category: selectedType?.category || 'crm',
          targetType: selectedTargetType,
          targetId: selectedTargetId || undefined,
          targetName: selectedTargetSummary?.name || undefined,
          targetSubtext: selectedTargetSummary?.email || selectedTargetSummary?.phone || selectedTargetSummary?.address || undefined,
          clientId: relationalClientId,
          clientName: relationalClientName,
          placeId: relationalPlaceId,
          placeName: relationalPlaceName,
          contactId: relationalContactId,
          contactName: relationalContactName,
          assignedUid,
          assignedName: assignedUser ? assignedUser.name : 'Operatore',
          assignedEntities,
          executionDate: d,
          dueDate: (selectedType?.isSchedulable && dueDate) ? dueDate : '',
          durationMinutes: durationMinutes ? Number(durationMinutes) : undefined,
          priority,
          status,
          description: description.trim(),
          groupId,
          customFields: customFieldsValues
        }, author);
        if (!firstActId) firstActId = actId;
      }

      toast.success(dates.length > 1 ? `Create ${dates.length} attività nel gruppo!` : 'Attività creata con successo!');
      await NavigationService.submitSuccessReturn($page.url.searchParams, `/dashboard/activities/${firstActId}`);
    } catch (err: any) {
      console.error('Errore salvataggio attività:', err);
      errorMsg = err?.message || 'Si è verificato un errore durante il salvataggio.';
    } finally {
      saving = false;
    }
  }
</script>

<svelte:head>
  <title>Nuova Attività Operativa | {$projectStore?.projectName || 'ERP'}</title>
</svelte:head>

<div class="add-activity-page animate-fade-in">
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
          <ClipboardList size={26} color="var(--color-primary-600)" />
          Nuova Attività Operativa
        </h1>
        <p class="page-main-subtitle">Registra e assegna un task, incontro, telefonata o evento collegato all'ecosistema.</p>
      </div>
    </div>
  </header>

  {#if loading}
    <div class="loader-box">
      <span class="spinner"></span>
      Caricamento modulo in corso...
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
                  {#if selectedTargetSummary.meta?.clientName}
                    <div class="summary-detail-row">
                      <Building2 size={14} class="detail-icon" />
                      <span><strong>Cliente:</strong> {selectedTargetSummary.meta.clientName}</span>
                    </div>
                  {/if}
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
          <FormField id="activityType" label={`Tipo Attività (${availableActivityTypes.length} compatibili)`} required>
            <select 
              id="activityType"
              class="form-control"
              value={selectedTypeId}
              onchange={handleTypeChange}
              required
            >
              {#each availableActivityTypes as t}
                <option value={t.id}>{t.name} ({t.code})</option>
              {/each}
            </select>
          </FormField>

          <FormField id="activityNumber" label="Codice Identificativo" required>
            <input 
              type="text" 
              id="activityNumber"
              bind:value={activityNumber} 
              class="form-control font-mono" 
              required
            />
          </FormField>

          <FormField id="title" label="Titolo / Oggetto">
            <input 
              type="text" 
              id="title"
              placeholder={selectedType?.name || 'Oggetto attività'}
              bind:value={title} 
              class="form-control"
            />
          </FormField>
        </div>

        <div class="form-grid-3 mt-16">
          <FormField id="assignedUid" label="Operatore Responsabile *" required>
            <select 
              id="assignedUid"
              class="form-control"
              bind:value={assignedUid}
              disabled={!canReassign}
              required
            >
              {#each users as u}
                <option value={u.id}>{u.name}</option>
              {/each}
            </select>
          </FormField>

          {#if teams.length > 0}
            <FormField id="selectedTeamId" label="Squadra Operativa (Opzionale)">
              <select id="selectedTeamId" class="form-control" bind:value={selectedTeamId}>
                <option value="">Nessuna squadra</option>
                {#each teams as tm}
                  <option value={tm.id}>{tm.name}</option>
                {/each}
              </select>
            </FormField>
          {/if}

          {#if vehicles.length > 0}
            <FormField id="selectedVehicleId" label="Mezzo Aziendale (Opzionale)">
              <select id="selectedVehicleId" class="form-control" bind:value={selectedVehicleId}>
                <option value="">Nessun mezzo assegnato</option>
                {#each vehicles as vh}
                  <option value={vh.id}>{vh.name}</option>
                {/each}
              </select>
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

          {#if selectedType?.isSchedulable}
            <FormField id="schedulingType" label="Pianificazione Ricorrenza">
              <select id="schedulingType" bind:value={schedulingType} class="form-control">
                <option value="singola">Singola Giornata</option>
                <option value="multiple">Multigiornata (Range di date)</option>
              </select>
            </FormField>
          {/if}
        </div>

        {#if schedulingType === 'multiple'}
          <div class="form-grid-2 mt-16">
            <FormField id="endDate" label="Data Fine Intervallo" required>
              <input type="date" id="endDate" bind:value={endDate} min={executionDate} class="form-control" required />
            </FormField>
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
          onclick={() => NavigationService.cancelAndReturn($page.url.searchParams, '/dashboard/activities')}
        >
          Annulla
        </button>
        <button type="submit" class="btn-save" disabled={saving}>
          <Save size={18} />
          <span>{saving ? 'Salvataggio...' : 'Salva Attività'}</span>
        </button>
      </div>
    </form>
  {/if}
</div>

<style>
  .add-activity-page {
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
