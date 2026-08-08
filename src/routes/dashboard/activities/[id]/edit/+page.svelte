<script lang="ts">
  import { projectStore } from '$lib/stores/project';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { ActivitiesService } from '../../activities.service';
  import type { ActivityItem, ActivityPriority, ActivityStatus } from '../../schema';
  import { CustomFieldsService } from '$lib/services/customFieldsService';
  import { CacheLookupService, type CacheLookupItem } from '$lib/services/cacheLookupService';
  import type { CustomFieldDefinition, CustomFieldValues } from '$lib/types/customFields';
  import CustomFieldsRenderer from '$lib/components/CustomFieldsRenderer.svelte';
  import Autocomplete from '$lib/components/Autocomplete.svelte';
  import { toast } from '$lib/stores/toast.svelte';
  import { 
    ArrowLeft, 
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
    Calendar
  } from '@lucide/svelte';

  let activityId = $derived(page.params.id);
  let activity = $state<ActivityItem | null>(null);

  let users = $state<CacheLookupItem[]>([]);
  let clients = $state<CacheLookupItem[]>([]);
  let places = $state<{ id: string; name: string; clientId?: string }[]>([]);
  let teams = $state<CacheLookupItem[]>([]);
  let vehicles = $state<CacheLookupItem[]>([]);

  let customFieldsList = $state<CustomFieldDefinition[]>([]);
  let customFieldsValues = $state<CustomFieldValues>({});

  let loading = $state(true);
  let saving = $state(false);
  let errorMsg = $state('');

  // Form State
  let activityNumber = $state('');
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

  let executionDate = $state('');
  let dueDate = $state('');
  let priority = $state<ActivityPriority>('media');
  let status = $state<ActivityStatus>('da_fare');
  let description = $state('');

  let updateAllGroup = $state(false);

  onMount(async () => {
    try {
      const [cFields, uList, cList] = await Promise.all([
        CustomFieldsService.getFieldsForModule('activities'),
        CacheLookupService.getLookup('users'),
        CacheLookupService.getLookup('clients')
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
          vList = list.map((v: any) => ({ id: v.id || '', name: v.name }));
        }
      } catch (e) {
        vList = await CacheLookupService.getLookup('vehicles');
      }

      let pList: CacheLookupItem[] = [];
      try {
        // @ts-ignore
        const mod = await import('../../../places/places.service');
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

      if (activityId) {
        activity = await ActivitiesService.getActivityById(activityId);
        if (activity) {
          activityNumber = activity.activityNumber || '';
          title = activity.title || '';
          assignedUid = activity.assignedUid || '';
          executionDate = activity.executionDate || '';
          dueDate = activity.dueDate || '';
          priority = activity.priority || 'media';
          status = activity.status || 'da_fare';
          description = activity.description || '';
          selectedClientId = activity.clientId || '';
          selectedPlaceId = activity.placeId || '';

          // Pre-select team & vehicle from assignedEntities
          const teamEnt = activity.assignedEntities?.find(e => e.entityType === 'team');
          if (teamEnt) selectedTeamId = teamEnt.entityId;

          const vehicleEnt = activity.assignedEntities?.find(e => e.entityType === 'vehicle');
          if (vehicleEnt) selectedVehicleId = vehicleEnt.entityId;

          const placeEnt = activity.assignedEntities?.find(e => e.entityType === 'place');
          if (placeEnt && !selectedPlaceId) selectedPlaceId = placeEnt.entityId;

          customFieldsValues = activity.customFields ? { ...activity.customFields } : {};
        }
      }
    } catch (e) {
      console.error('Errore caricamento dati modifica attività:', e);
    } finally {
      loading = false;
    }
  });

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (!activityId || !title.trim() || !assignedUid) {
      errorMsg = 'Compila i campi obbligatori (Titolo ed Utente Assegnato).';
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

      const payload = {
        activityNumber: activityNumber.trim(),
        title: title.trim(),
        assignedUid,
        assignedName: assignedUser ? assignedUser.name : (activity?.assignedName || ''),
        assignedEntities,
        clientId: selectedClientId || undefined,
        clientName: selectedClient ? selectedClient.name : undefined,
        placeId: selectedPlaceId || undefined,
        placeName: selectedPlace ? selectedPlace.name : undefined,
        executionDate,
        dueDate,
        priority,
        status,
        description: description.trim(),
        customFields: customFieldsValues
      };

      if (activity?.groupId && updateAllGroup) {
        await ActivitiesService.updateActivityGroup(activity.groupId, payload);
        toast.success('Gruppo di attività aggiornato con successo!');
      } else {
        await ActivitiesService.updateActivity(activityId, payload);
        toast.success('Attività aggiornata con successo!');
      }

      goto(`/dashboard/activities/${activityId}`);
    } catch (err: any) {
      console.error('Errore salvataggio attività:', err);
      errorMsg = err.message || 'Errore durante il salvataggio delle modifiche.';
    } finally {
      saving = false;
    }
  }
</script>

<svelte:head>
  <title>Modifica Attività | {$projectStore?.projectName || 'ERP'}</title>
</svelte:head>

<div class="add-activity-page animate-fade-in">
  <div class="page-top">
    <a href={`/dashboard/activities/${activityId}`} class="back-link">
      <ArrowLeft size={14} /> Torna al Dettaglio Attività
    </a>
    <h2>
      <Pencil size={22} class="header-icon" /> Modifica Attività #{activityNumber || activityId}
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
        </div>

        <div class="form-group mb-16">
          <label for="act-title">Titolo / Oggetto Attività *</label>
          <input 
            id="act-title" 
            type="text" 
            bind:value={title} 
            required
            class="form-control" 
          />
        </div>

        <div class="grid-2 mb-16">
          <div class="form-group">
            <label for="user-select">
              <UserCheck size={14} /> Operatore Assegnato *
            </label>
            <Autocomplete 
              options={users.map(u => ({ id: u.id, label: u.name }))} 
              bind:value={assignedUid} 
              placeholder="Cerca operatore/utente..."
            />
          </div>

          <div class="form-group">
            <label for="act-exec">
              <Clock size={14} /> Data Esecuzione
            </label>
            <input id="act-exec" type="date" bind:value={executionDate} class="form-control" />
          </div>
        </div>

        <div class="grid-2 mb-16">
          <div class="form-group">
            <label for="act-due">
              <Calendar size={14} /> Data Scadenza Programmata
            </label>
            <input id="act-due" type="date" bind:value={dueDate} class="form-control" />
          </div>

          <div class="form-group">
            <label for="act-prio">Priorità</label>
            <select id="act-prio" bind:value={priority} class="form-control">
              <option value="bassa">Bassa</option>
              <option value="media">Media</option>
              <option value="alta">Alta</option>
              <option value="urgente">Urgente</option>
            </select>
          </div>
        </div>

        <div class="form-group mb-16">
          <label for="act-status">Stato Attività</label>
          <select id="act-status" bind:value={status} class="form-control">
            <option value="da_fare">Da Fare (Pianificata)</option>
            <option value="in_corso">In Corso</option>
            <option value="completata">Completata (Già Svolta)</option>
            <option value="annullato">Annullato</option>
          </select>
        </div>

        <div class="form-group">
          <label for="act-desc">Descrizione Estesa & Note Operative</label>
          <textarea id="act-desc" bind:value={description} rows="3" class="form-control"></textarea>
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

      <!-- 4. GRUPPO DATE MULTIPLE AVISO -->
      {#if activity?.groupId}
        <div class="card form-card group-notice-card">
          <div class="form-group-checkbox">
            <input type="checkbox" id="update-group" bind:checked={updateAllGroup} class="checkbox-control" />
            <label for="update-group" class="cursor-pointer font-bold select-none m-0">
              Aggiorna anche tutte le altre attività del gruppo (Date multiple)
            </label>
          </div>
          <p class="section-desc mt-8 mb-0">
            Se selezionato, le modifiche (titolo, operatore, priorità, descrizione, ecc.) verranno replicate per tutte le attività create insieme in questo intervallo di date. La data di esecuzione rimarrà distinta per ciascuna attività.
          </p>
        </div>
      {/if}

      <!-- FORM ACTIONS -->
      <div class="form-actions-bar">
        <a href={`/dashboard/activities/${activityId}`} class="btn-cancel">Annulla</a>
        <button type="submit" class="btn-submit" disabled={saving}>
          <Save size={16} /> {saving ? 'Salvataggio...' : 'Salva Modifiche'}
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

  .group-notice-card { background: #eff6ff; border-color: #bfdbfe; }
  .form-group-checkbox { display: flex; align-items: center; gap: 8px; }
  .checkbox-control { width: 18px; height: 18px; cursor: pointer; }
  .cursor-pointer { cursor: pointer; }
  .font-bold { font-weight: 700; }
  .select-none { user-select: none; }
  .mt-8 { margin-top: 0.5rem; }
  .mb-0 { margin-bottom: 0; }
  .m-0 { margin: 0; }
</style>
