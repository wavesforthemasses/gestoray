<script lang="ts">
  import { projectStore } from '$lib/stores/project';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { NavigationService } from '$lib/services/navigationService';
  import { ActivitiesService } from '../activities.service';
  import type { ActivityPriority, ActivityStatus } from '../schema';
  import { CustomFieldsService } from '$lib/services/customFieldsService';
  import { CacheLookupService, type CacheLookupItem } from '$lib/services/cacheLookupService';
  import { ActivityTypesService, type ActivityType } from '$lib/services/activityTypesService';
  import { activeRoleState } from '$lib/auth.svelte';
  import { auth } from '$lib/firebase';
  import type { CustomFieldDefinition, CustomFieldValues } from '$lib/types/customFields';
  import CustomFieldsRenderer from '$lib/components/CustomFieldsRenderer.svelte';
  import Autocomplete from '$lib/components/Autocomplete.svelte';
  import { toast } from '$lib/stores/toast.svelte';
  import { 
    ArrowLeft, 
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
    Truck 
  } from '@lucide/svelte';

  import { page } from '$app/stores';

  let users = $state<CacheLookupItem[]>([]);
  let clients = $state<CacheLookupItem[]>([]);
  let places = $state<{ id: string; name: string; clientId?: string }[]>([]);
  let teams = $state<CacheLookupItem[]>([]);
  let vehicles = $state<CacheLookupItem[]>([]);

  let activityTypes = $state<ActivityType[]>([]);
  let customFieldsList = $state<CustomFieldDefinition[]>([]);
  let customFieldsValues = $state<CustomFieldValues>({});

  let loading = $state(true);
  let saving = $state(false);
  let errorMsg = $state('');

  // Form State
  let selectedTypeId = $state<string>('');
  let activityNumber = $state(`ACT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
  let title = $state('');
  let assignedUid = $state('');
  
  // Entity relations
  let selectedClientId = $state('');
  let selectedPlaceId = $state('');
  let selectedTeamId = $state('');
  let selectedVehicleId = $state('');

  let filteredPlaces = $derived.by(() => {
    if (!selectedClientId) return places;
    return places.filter(p => !p.clientId || p.clientId === selectedClientId);
  });

  $effect(() => {
    if (selectedPlaceId) {
      const currentPlace = places.find(p => p.id === selectedPlaceId);
      if (currentPlace && currentPlace.clientId) {
        if (!selectedClientId) {
          selectedClientId = currentPlace.clientId;
        } else if (currentPlace.clientId !== selectedClientId) {
          selectedPlaceId = '';
        }
      }
    }
  });

  // Scheduling Mode
  let schedulingType = $state<'singola' | 'multiple'>('singola');
  let executionDate = $state(new Date().toISOString().slice(0, 10));
  let endDate = $state(new Date().toISOString().slice(0, 10));
  let dueDate = $state('');

  let priority = $state<ActivityPriority>('media');
  let status = $state<ActivityStatus>('completata');
  let description = $state('');

  let selectedType = $derived(activityTypes.find(t => t.id === selectedTypeId));
  let canReassign = $derived(ActivityTypesService.canAssignToOthers(activeRoleState.role, selectedType));

  onMount(async () => {
    try {
      const paramDate = $page.url.searchParams.get('date');
      if (paramDate) {
        executionDate = paramDate;
        endDate = paramDate;
        dueDate = paramDate;
      }

      const paramPlaceId = $page.url.searchParams.get('placeId');
      const paramClientId = $page.url.searchParams.get('clientId');
      if (paramClientId) selectedClientId = paramClientId;
      if (paramPlaceId) selectedPlaceId = paramPlaceId;

      const [cFields, uList, cList, typesList] = await Promise.all([
        CustomFieldsService.getFieldsForModule('activities'),
        CacheLookupService.getLookup('users'),
        CacheLookupService.getLookup('clients'),
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
          vList = list.map((v: any) => ({ id: v.id || '', name: v.name }));
        }
      } catch (e) {
        vList = await CacheLookupService.getLookup('vehicles');
      }

      let pList: CacheLookupItem[] = [];
      try {
        // @ts-ignore
        const mod = await import('../../places/places.service');
        if (mod?.PlacesService) {
          const list = await mod.PlacesService.getPlaces();
          pList = list.map((p: any) => ({ id: p.id || '', name: p.name, clientId: p.clientId }));
        }
      } catch (e) {
        pList = await CacheLookupService.getLookup('places');
      }

      customFieldsList = cFields;
      users = uList;
      clients = cList;
      places = pList;
      teams = tList;
      vehicles = vList;
      activityTypes = typesList;

      // Pre-select first activity type
      if (activityTypes.length > 0) {
        selectedTypeId = activityTypes[0].id;
        applyTypeDefaults(activityTypes[0]);
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

  function applyTypeDefaults(type: ActivityType) {
    priority = type.defaultPriority || 'media';
    status = (type.defaultStatus as ActivityStatus) || 'completata';
  }

  function handleTypeChange(e: Event) {
    const target = e.target as HTMLSelectElement;
    selectedTypeId = target.value;
    const found = activityTypes.find(t => t.id === selectedTypeId);
    if (found) {
      applyTypeDefaults(found);
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
    
    // Auto-generate title if empty
    let finalTitle = title.trim();
    if (!finalTitle && selectedType) {
      finalTitle = selectedType.name;
    } else if (!finalTitle) {
      finalTitle = 'Attività Operativa';
    }

    if (!assignedUid) {
      errorMsg = 'Seleziona l\'utente assegnato.';
      return;
    }

    saving = true;
    errorMsg = '';

    try {
      const assignedUser = users.find(u => u.id === assignedUid);
      const selectedClient = clients.find(c => c.id === selectedClientId);
      const selectedPlace = places.find(p => p.id === selectedPlaceId);
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
      if (selectedPlace) {
        assignedEntities.push({ type: 'place', entityType: 'place', id: selectedPlace.id, entityId: selectedPlace.id, name: selectedPlace.name, entityName: selectedPlace.name });
      }

      // Determine date schedule array
      let dates = [executionDate];
      let groupId: string | undefined = undefined;

      if (schedulingType === 'multiple' && endDate && endDate > executionDate) {
        dates = getDatesInRange(executionDate, endDate);
        groupId = 'group_' + Date.now();
      }

      let firstActId = '';

      for (const d of dates) {
        const actId = await ActivitiesService.createActivity({
          activityNumber: dates.length > 1 ? `${activityNumber.trim()}-${d.replace(/-/g, '')}` : activityNumber.trim(),
          title: finalTitle,
          activityTypeId: selectedTypeId,
          activityTypeName: selectedType ? selectedType.name : '',
          assignedUid,
          assignedName: assignedUser ? assignedUser.name : 'Operatore',
          assignedEntities,
          clientId: selectedClientId || undefined,
          clientName: selectedClient ? selectedClient.name : undefined,
          placeId: selectedPlaceId || undefined,
          placeName: selectedPlace ? selectedPlace.name : undefined,
          executionDate: d,
          dueDate: (selectedType?.isSchedulable && dueDate) ? dueDate : '',
          priority,
          status,
          description: description.trim(),
          groupId,
          customFields: customFieldsValues
        });
        if (!firstActId) firstActId = actId;
      }

      toast.success(dates.length > 1 ? `Create ${dates.length} attività nel gruppo!` : 'Attività creata con successo!');
      await NavigationService.submitSuccessReturn($page.url.searchParams, `/dashboard/activities/${firstActId}`);
    } catch (err: any) {
      console.error('Errore salvataggio attività:', err);
      errorMsg = err.message || 'Errore durante la creazione dell\'attività.';
    } finally {
      saving = false;
    }
  }
</script>

<svelte:head>
  <title>Nuova Attività | {$projectStore?.projectName || 'ERP'}</title>
</svelte:head>

<div class="add-activity-page animate-fade-in">
  <div class="page-top">
    <div class="nav-header-actions">
      <button 
        type="button" 
        class="back-link btn-back-context" 
        onclick={() => NavigationService.navigateBack($page.url.searchParams, '/dashboard/activities')}
      >
        <ArrowLeft size={14} /> 
        <span>{NavigationService.getBackLabel($page.url.searchParams, 'Torna alla Gestione Attività')}</span>
      </button>
    </div>
    <h2>
      <ClipboardList size={22} class="header-icon" /> Nuova Attività Operativa
    </h2>
  </div>

  {#if loading}
    <div class="loader-box">
      <span class="spinner"></span>
      Caricamento in corso...
    </div>
  {:else}
    {#if errorMsg}
      <div class="alert error-box">
        <AlertCircle size={16} /> {errorMsg}
      </div>
    {/if}

    <form onsubmit={handleSubmit} class="activity-form">
      <!-- 1. DETTAGLI TASK -->
      <div class="card form-card">
        <div class="card-header">
          <h3 class="card-title">
            <Info size={18} /> Informazioni Attività
          </h3>
          <p class="card-subtitle">Seleziona il tipo di attività, l'operatore e le note esecutive.</p>
        </div>

        <div class="grid-2 mb-16">
          <div class="form-group">
            <label for="act-type">Tipo Attività *</label>
            <select id="act-type" value={selectedTypeId} onchange={handleTypeChange} class="form-control">
              {#each activityTypes as typeOpt}
                <option value={typeOpt.id}>{typeOpt.name}</option>
              {/each}
            </select>
          </div>

          <div class="form-group">
            <label for="user-select">
              <UserCheck size={14} /> Operatore Assegnato *
              {#if !canReassign}
                <span class="auto-assign-tag">(Auto-Assegnato)</span>
              {/if}
            </label>
            {#if canReassign}
              <Autocomplete 
                options={users.map(u => ({ id: u.id, label: u.name }))} 
                bind:value={assignedUid} 
                placeholder="Cerca operatore/utente..."
              />
            {:else}
              <input 
                type="text" 
                value={users.find(u => u.id === assignedUid)?.name || 'Tu stesso (Operatore)'} 
                disabled 
                class="form-control read-only-input"
              />
            {/if}
          </div>
        </div>

        <div class="form-group mb-16">
          <label for="act-title">Titolo / Oggetto Attività <span class="optional-label">(Opzionale - predefinito da tipologia)</span></label>
          <input 
            id="act-title" 
            type="text" 
            bind:value={title} 
            placeholder={selectedType ? `es. ${selectedType.name}` : 'es. Telefonata commerciale cliente'} 
            class="form-control" 
          />
        </div>

        <div class="grid-2 mb-16">
          <div class="form-group">
            <label for="scheduling-type">Programmazione Temporale</label>
            <select id="scheduling-type" bind:value={schedulingType} class="form-control">
              <option value="singola">Singola Data</option>
              <option value="multiple">Date Multiple (Intervallo / Range)</option>
            </select>
          </div>

          {#if selectedType?.isSchedulable && schedulingType === 'singola'}
            <div class="form-group">
              <label for="act-due">
                <Calendar size={14} /> Data Scadenza Programmata <span class="optional-label">(Opzionale)</span>
              </label>
              <input id="act-due" type="date" bind:value={dueDate} class="form-control" />
            </div>
          {/if}
        </div>

        <div class="grid-2 mb-16">
          <div class="form-group">
            <label for="act-exec">
              <Clock size={14} /> 
              {schedulingType === 'multiple' ? 'Data Inizio Intervallo *' : 'Data Esecuzione / Svolta Il *'}
            </label>
            <input id="act-exec" type="date" bind:value={executionDate} required class="form-control" />
          </div>

          {#if schedulingType === 'multiple'}
            <div class="form-group">
              <label for="act-end">
                <Clock size={14} /> Data Fine Intervallo *
              </label>
              <input id="act-end" type="date" bind:value={endDate} min={executionDate} required class="form-control" />
            </div>
          {/if}
        </div>

        <div class="grid-2 mb-16">
          <div class="form-group">
            <label for="act-prio">Priorità</label>
            <select id="act-prio" bind:value={priority} class="form-control">
              <option value="bassa">Bassa</option>
              <option value="media">Media</option>
              <option value="alta">Alta</option>
              <option value="urgente">Urgente</option>
            </select>
          </div>

          <div class="form-group">
            <label for="act-status">Stato Iniziale</label>
            <select id="act-status" bind:value={status} class="form-control">
              <option value="da_fare">Da Fare (Pianificata)</option>
              <option value="in_corso">In Corso</option>
              <option value="completata">Completata (Già Svolta)</option>
            </select>
          </div>
        </div>

        <div class="form-group">
          <label for="act-desc">Descrizione Estesa & Note Operative</label>
          <textarea id="act-desc" bind:value={description} rows="3" placeholder="Note dell'operatore, esito della telefonata, istruzioni..." class="form-control"></textarea>
        </div>
      </div>

      <!-- 2. CORRELAZIONI E ASSEGNAZIONI MULTIPLE (CLIENTE, CANTIERE, SQUADRA, MEZZO) -->
      <div class="card form-card">
        <div class="card-header">
          <h3 class="card-title">
            <Users size={18} /> Correlazioni & Risorse Assegnate
          </h3>
          <p class="card-subtitle">Collega l'attività a un cliente, luogo/cantiere, squadra o mezzo aziendale.</p>
        </div>

        <div class="grid-2 mb-16">
          <div class="form-group">
            <label for="client-select">
              <Building2 size={14} /> Cliente Correlato
            </label>
            <select id="client-select" bind:value={selectedClientId} class="form-control">
              <option value="">-- Nessun Cliente --</option>
              {#each clients as cl}
                <option value={cl.id}>{cl.name}</option>
              {/each}
            </select>
          </div>

          <div class="form-group">
            <label for="place-select">
              <MapPin size={14} /> Luogo / Cantiere
            </label>
            <select id="place-select" bind:value={selectedPlaceId} class="form-control">
              <option value="">-- Nessun Cantiere / Luogo --</option>
              {#each filteredPlaces as pl}
                <option value={pl.id}>{pl.name}</option>
              {/each}
            </select>
          </div>
        </div>

        <div class="grid-2">
          <div class="form-group">
            <label for="team-select">
              <Users size={14} /> Squadra Assegnata
            </label>
            <select id="team-select" bind:value={selectedTeamId} class="form-control">
              <option value="">-- Nessuna Squadra --</option>
              {#each teams as tm}
                <option value={tm.id}>{tm.name}</option>
              {/each}
            </select>
          </div>

          <div class="form-group">
            <label for="vehicle-select">
              <Truck size={14} /> Mezzo / Attrezzatura
            </label>
            <select id="vehicle-select" bind:value={selectedVehicleId} class="form-control">
              <option value="">-- Nessun Mezzo --</option>
              {#each vehicles as vh}
                <option value={vh.id}>{vh.name}</option>
              {/each}
            </select>
          </div>
        </div>
      </div>

      <!-- 3. CAMPI PERSONALIZZATI -->
      {#if customFieldsList.length > 0}
        <div class="card form-card">
          <div class="card-header">
            <h3 class="card-title">
              <SlidersHorizontal size={18} /> Campi Personalizzati
            </h3>
          </div>
          <CustomFieldsRenderer fields={customFieldsList} bind:values={customFieldsValues} />
        </div>
      {/if}

      <!-- FORM ACTIONS -->
      <div class="form-actions-bar">
        <a href="/dashboard/activities" class="btn-cancel">Annulla</a>
        <button type="submit" class="btn-submit" disabled={saving}>
          <Save size={16} /> {saving ? 'Salvataggio...' : 'Crea Attività'}
        </button>
      </div>
    </form>
  {/if}
</div>

<style>
  .add-activity-page { width: 100%; box-sizing: border-box; display: flex; flex-direction: column; gap: 1.5rem; }
  .page-top { display: flex; flex-direction: column; gap: 0.4rem; }
  .back-link { color: var(--color-neutral-500); font-size: 0.85rem; text-decoration: none; font-weight: 600; display: inline-flex; align-items: center; gap: 6px; }
  .back-link:hover { color: var(--color-primary-600); }
  h2 { font-size: 1.5rem; font-weight: 800; margin: 0; color: var(--color-neutral-900); display: flex; align-items: center; gap: 8px; }
  :global(.header-icon) { color: var(--color-primary-500); }

  .activity-form { display: flex; flex-direction: column; gap: 1.5rem; }
  .card { background: white; border: 1px solid var(--color-neutral-200); border-radius: var(--radius-lg); padding: 1.5rem; box-shadow: var(--shadow-sm); }
  .card-header { margin-bottom: 1.2rem; border-bottom: 1px solid var(--color-neutral-100); padding-bottom: 0.8rem; }
  .card-title { font-size: 1.1rem; font-weight: 700; margin: 0; color: var(--color-neutral-900); display: flex; align-items: center; gap: 8px; }
  .card-subtitle { font-size: 0.82rem; color: var(--color-neutral-500); margin: 0.2rem 0 0 0; }

  .form-group { display: flex; flex-direction: column; gap: 0.4rem; }
  .form-group label { font-size: 0.82rem; font-weight: 700; color: var(--color-neutral-700); display: flex; align-items: center; gap: 4px; }
  .optional-label { font-weight: 400; color: var(--color-neutral-500); font-size: 0.78rem; }
  .auto-assign-tag { font-weight: 500; color: var(--color-primary-600); font-size: 0.75rem; }
  .read-only-input { background: var(--color-neutral-50); color: var(--color-neutral-600); }

  .form-control { padding: 0.65rem 0.9rem; border: 1px solid var(--color-neutral-300); border-radius: var(--radius-md); font-size: 0.9rem; outline: none; box-sizing: border-box; }
  .form-control:focus { border-color: var(--color-primary-600); box-shadow: 0 0 0 3px var(--color-primary-100); }

  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
  @media (max-width: 640px) { .grid-2 { grid-template-columns: 1fr; } }

  .mb-16 { margin-bottom: 1rem; }

  .form-actions-bar { display: flex; justify-content: flex-end; align-items: center; gap: 1rem; padding-top: 1rem; }
  .btn-cancel { color: var(--color-neutral-600); text-decoration: none; font-size: 0.9rem; font-weight: 600; }
  .btn-submit { background: var(--color-primary-600); color: white; border: none; padding: 0.7rem 1.5rem; border-radius: var(--radius-md); font-weight: 700; font-size: 0.9rem; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; }
  .btn-submit:disabled { opacity: 0.6; cursor: not-allowed; }

  .alert { padding: 0.8rem 1rem; border-radius: var(--radius-md); font-size: 0.88rem; font-weight: 600; display: flex; align-items: center; gap: 8px; }
  .error-box { background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; }
  .loader-box { text-align: center; padding: 3rem; background: white; border-radius: var(--radius-lg); border: 1px solid var(--color-neutral-200); }
</style>
