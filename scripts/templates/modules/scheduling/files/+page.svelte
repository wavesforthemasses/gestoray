<script lang="ts">
  import { projectStore } from '$lib/stores/project';
  import { authState, activeRoleState } from '$lib/auth.svelte';
  import { onMount } from 'svelte';
  import { SchedulingService } from './scheduling.service';
  import { ScheduleSettingsService } from './scheduleSettingsService';
  import { ScheduleViewsService } from './scheduleViewsService';
  import { UsersService } from '../users/users.service';
  import type { ScheduleSettings, CompositeCalendarItem, ScheduleView } from './schema';
  import type { TeamItem } from '../teams/schema';
  import type { TeamsService as TeamsServiceType } from '../teams/teams.service';
  import MatrixCalendar, { type YAxisEntity } from './components/MatrixCalendar.svelte';
  import { Card, StatusBadge, Button, SearchToolbar, EmptyState, PageHeader } from '$lib';
  import { pageTitle } from '$lib/stores/page';
  import { toast } from '$lib/stores/toast.svelte';
  import { 
    Calendar, 
    Plus, 
    Search, 
    Eye, 
    User, 
    Users, 
    Truck, 
    MapPin, 
    Clock, 
    Filter,
    Shield,
    Wrench,
    FileText,
    Layers,
    ArrowRight,
    CheckCircle2,
    AlertCircle,
    UserCheck,
    List
  } from '@lucide/svelte';

  let settings = $state<ScheduleSettings>({
    entityNaming: 'pianificazione',
    customSingularLabel: '',
    customPluralLabel: '',
    defaultSlot: 'giornata_intera'
  });

  let systemViews = $state<ScheduleView[]>([]);
  let activeViewId = $state<string>('');

  let compositeItems = $state<CompositeCalendarItem[]>([]);
  let backlogItems = $state<CompositeCalendarItem[]>([]);
  let loading = $state(true);
  let schedulingActionId = $state<string | null>(null);

  // Raw entities for matrix Y-axes
  let teams = $state<TeamItem[]>([]);
  let users = $state<any[]>([]);
  let vehicles = $state<any[]>([]);
  let places = $state<any[]>([]);

  // Filters State
  let searchFilter = $state('');
  let statusFilter = $state('all');
  let slotFilter = $state('all');
  let sourceFilter = $state<'all' | 'intervention' | 'activity' | 'deadline'>('all');
  let viewMode = $state<'all' | 'my'>('all');

  let myUid = $derived(authState.user?.uid || '');
  let userRole = $derived(activeRoleState.role);
  let isAdmin = $derived(userRole === 'superadmin' || userRole === 'direzione' || userRole === 'amministrazione');

  let labels = $derived(ScheduleSettingsService.getLabels(settings));

  let activeView = $derived(
    systemViews.find(v => v.id === activeViewId) || systemViews[0] || {
      id: 'default',
      name: 'Lista Completa',
      layout: 'list',
      filters: { sources: ['intervention', 'activity', 'deadline'] },
      order: 0
    }
  );

  // Derived Y-Axis Entities for current active view
  let activeYAxisEntities = $derived.by<YAxisEntity[]>(() => {
    const yAxisType = activeView.matrixYAxis || 'teams';
    switch (yAxisType) {
      case 'users':
        return users.map(u => ({
          id: u.uid,
          name: `${u.nome || ''} ${u.cognome || ''}`.trim() || u.email,
          subtitle: u.roles?.join(', ') || 'Operatore'
        }));
      case 'vehicles':
        return vehicles.map(v => ({
          id: v.id,
          name: v.name,
          subtitle: v.licensePlate ? `Targa: ${v.licensePlate}` : undefined
        }));
      case 'places':
        return places.map(p => ({
          id: p.id,
          name: p.name,
          subtitle: p.clientName ? `Cliente: ${p.clientName}` : undefined
        }));
      case 'teams':
      default:
        return teams.map(t => ({
          id: t.id,
          name: t.name,
          subtitle: t.vehicleName ? `Veicolo: ${t.vehicleName}` : undefined
        }));
    }
  });

  let filteredComposite = $derived.by(() => {
    return compositeItems.filter(item => {
      // Admin global vs User filtered view
      if (!isAdmin || viewMode === 'my') {
        const isAssigned = item.assignedEntities.some(a => a.entityId === myUid);
        if (!isAssigned) return false;
      }

      // Active view source filter
      if (activeView.filters?.sources && activeView.filters.sources.length > 0) {
        if (!activeView.filters.sources.includes(item.source as any)) return false;
      }

      // Manual source filter override
      if (sourceFilter !== 'all' && item.source !== sourceFilter) return false;

      // Search term
      if (searchFilter.trim()) {
        const term = searchFilter.trim().toLowerCase();
        const matchTitle = item.title.toLowerCase().includes(term);
        const matchPlace = (item.placeName || '').toLowerCase().includes(term);
        const matchClient = (item.clientName || '').toLowerCase().includes(term);
        const matchNum = (item.interventionNumber || '').toLowerCase().includes(term);
        const matchAssigned = item.assignedEntities.some(a => a.entityName.toLowerCase().includes(term));
        if (!matchTitle && !matchPlace && !matchClient && !matchNum && !matchAssigned) {
          return false;
        }
      }

      // Status filter
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;

      // Slot filter
      if (slotFilter !== 'all' && item.slot !== slotFilter) return false;

      return true;
    });
  });

  async function loadData() {
    loading = true;
    try {
      const [s, viewsData, compositeData, usersData] = await Promise.all([
        ScheduleSettingsService.getSettings(),
        ScheduleViewsService.getViews(),
        SchedulingService.getCompositeSchedule(),
        UsersService.getUsers(undefined, 'active')
      ]);

      settings = s;
      systemViews = viewsData;
      if (!activeViewId && systemViews.length > 0) {
        activeViewId = systemViews[0].id;
      }
      compositeItems = compositeData.items;
      backlogItems = compositeData.backlog;
      users = usersData;

      // Dynamic import optional modules (teams, vehicles, places)
      try {
        const modTeams = await import('../teams/teams.service');
        if (modTeams?.TeamsService) {
          const teamsData = await modTeams.TeamsService.getTeams();
          teams = teamsData.filter(t => t.status === 'attiva' || t.status === 'in_servizio');
        }
      } catch (e) {}

      try {
        const modVeh = await import('../vehicles/vehicles.service');
        if (modVeh?.VehiclesService) {
          vehicles = await modVeh.VehiclesService.getVehicles();
        }
      } catch (e) {}

      try {
        const modPlac = await import('../places/places.service');
        if (modPlac?.PlacesService) {
          places = await modPlac.PlacesService.getPlaces();
        }
      } catch (e) {}

      pageTitle.set(labels.plural);

      if (!isAdmin) {
        viewMode = 'my';
      }
    } catch (e) {
      console.error('Errore caricamento vista agenda composita:', e);
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    loadData();
  });

  async function handleQuickSchedule(item: CompositeCalendarItem) {
    const today = new Date().toISOString().slice(0, 10);
    schedulingActionId = item.id;
    try {
      if (item.source === 'intervention') {
        await SchedulingService.scheduleWorkOrder(item.id, today, 'giornata_intera');
      } else {
        await SchedulingService.scheduleActivity(item.id, today, 'giornata_intera');
      }
      await loadData();
    } catch (err) {
      console.error('Errore durante la pianificazione rapida:', err);
    } finally {
      schedulingActionId = null;
    }
  }

  async function handleRescheduleDrop(item: CompositeCalendarItem, newDate: string, entityId: string) {
    try {
      const yAxisType = activeView.matrixYAxis || 'teams';
      let assignedEntities = item.assignedEntities ? [...item.assignedEntities] : [];
      let targetEntityType: 'team' | 'user' | 'vehicle' | 'place' = 'team';
      let entityName = '';

      if (yAxisType === 'teams') {
        targetEntityType = 'team';
        const teamObj = teams.find(t => t.id === entityId);
        entityName = teamObj ? teamObj.name : 'Squadra';
      } else if (yAxisType === 'users') {
        targetEntityType = 'user';
        const userObj = users.find(u => u.uid === entityId);
        entityName = userObj ? `${userObj.nome || ''} ${userObj.cognome || ''}`.trim() : 'Operatore';
      } else if (yAxisType === 'vehicles') {
        targetEntityType = 'vehicle';
        const vehObj = vehicles.find(v => v.id === entityId);
        entityName = vehObj ? vehObj.name : 'Mezzo';
      } else if (yAxisType === 'places') {
        targetEntityType = 'place';
        const placeObj = places.find(p => p.id === entityId);
        entityName = placeObj ? placeObj.name : 'Luogo';
      }

      // Update or add entity in assignedEntities
      const existingIndex = assignedEntities.findIndex(e => e.entityType === targetEntityType);
      if (existingIndex >= 0) {
        assignedEntities[existingIndex] = { entityType: targetEntityType, entityId, entityName };
      } else {
        assignedEntities.push({ entityType: targetEntityType, entityId, entityName });
      }

      if (item.source === 'intervention') {
        await SchedulingService.scheduleWorkOrder(item.id, newDate, item.slot, assignedEntities);
      } else if (item.source === 'activity') {
        await SchedulingService.scheduleActivity(item.id, newDate, item.slot, assignedEntities);
      }
      toast.success(`Attività riprogrammata al ${newDate}`);
      await loadData();
    } catch (err) {
      console.error('Errore drag and drop:', err);
      toast.error('Errore durante la riprogrammazione');
    }
  }

  function getSlotLabel(slot: string): string {
    switch (slot) {
      case 'mattina': return 'Mattina (08:00 - 12:30)';
      case 'pomeriggio': return 'Pomeriggio (13:30 - 18:00)';
      case 'giornata_intera': return 'Giornata Intera';
      case 'custom': return 'Orari Personalizzati';
      default: return slot;
    }
  }

  function getPhaseLabel(phase?: string): string {
    switch (phase) {
      case 'bozza': return 'Bozza / Da Pianificare';
      case 'pianificato': return 'Pianificato';
      case 'in_lavorazione': return 'In Lavorazione';
      case 'completato': return 'Completato';
      case 'firmato': return 'Firmato';
      case 'fatturato': return 'Fatturato';
      default: return phase || 'Pianificato';
    }
  }

  function getAxisLabel(yAxis?: string): string {
    switch (yAxis) {
      case 'users': return 'OPERATORE / UTENTE';
      case 'vehicles': return 'MEZZO / ATTREZZATURA';
      case 'places': return 'LUOGO / CANTIERE';
      case 'teams':
      default: return 'SQUADRA DI LAVORO';
    }
  }
</script>

<svelte:head>
  <title>{labels.plural} | {$projectStore?.projectName || 'ERP'}</title>
</svelte:head>

<div class="scheduling-page-container">
  <PageHeader 
    icon={Calendar} 
    title={labels.plural} 
    subtitle="Agenda unificata: vista composita tra bolle/interventi programmati ed eventi di calendario."
  />

  <!-- SYSTEM VIEWS DYNAMIC TAB BAR -->
  <div class="system-views-tabs">
    {#each systemViews as view (view.id)}
      <button 
        type="button" 
        class="view-tab-btn" 
        class:active={activeViewId === view.id}
        onclick={() => activeViewId = view.id}
      >
        {#if view.layout === 'matrix'}
          {#if view.matrixYAxis === 'users'}
            <UserCheck size={16} />
          {:else if view.matrixYAxis === 'vehicles'}
            <Truck size={16} />
          {:else if view.matrixYAxis === 'places'}
            <MapPin size={16} />
          {:else}
            <Users size={16} />
          {/if}
        {:else}
          <List size={16} />
        {/if}
        <span>{view.name}</span>
      </button>
    {/each}
  </div>

  <!-- VIEW MODE SWITCHER & FILTERS TOOLBAR -->
  <div class="toolbar-box">
    <div class="search-box">
      <Search size={18} class="search-icon" />
      <input 
        type="text" 
        placeholder="Cerca per titolo, cantiere, cliente, numero bolla o operatore..." 
        bind:value={searchFilter} 
        class="search-input"
      />
    </div>

    <div class="filter-controls">
      {#if isAdmin}
        <div class="view-switch">
          <button 
            type="button" 
            class="switch-btn" 
            class:active={viewMode === 'all'} 
            onclick={() => viewMode = 'all'}
          >
            Vista Globale
          </button>
          <button 
            type="button" 
            class="switch-btn" 
            class:active={viewMode === 'my'} 
            onclick={() => viewMode = 'my'}
          >
            Le Mie Assegnazioni
          </button>
        </div>
      {/if}

      <select bind:value={sourceFilter} class="filter-select">
        <option value="all">Tutti i tipi</option>
        <option value="intervention">Bolle & Interventi</option>
        <option value="activity">Attività & Task</option>
        <option value="deadline">Scadenze</option>
      </select>

      <select bind:value={slotFilter} class="filter-select">
        <option value="all">Tutte le fasce orarie</option>
        <option value="mattina">Mattina</option>
        <option value="pomeriggio">Pomeriggio</option>
        <option value="giornata_intera">Giornata Intera</option>
        <option value="custom">Orari Personalizzati</option>
      </select>
    </div>
  </div>

  <!-- BACKLOG / BOZZE DA PIANIFICARE DRAWER -->
  {#if backlogItems.length > 0}
    <div class="backlog-banner">
      <div class="backlog-header">
        <div class="backlog-title">
          <Layers size={18} color="var(--color-warning-600)" />
          <span>Backlog Lavori / Bozze da Pianificare ({backlogItems.length})</span>
        </div>
        <span class="backlog-sub">Lavori o erogazioni contrattuali in attesa di assegnazione data e risorse in agenda.</span>
      </div>

      <div class="backlog-list">
        {#each backlogItems as item (item.id)}
          <div class="backlog-card">
            <div class="bl-info">
              <span class="bl-badge">
                <FileText size={12} />
                <span>{item.interventionNumber || 'Bozza'}</span>
              </span>
              <h4 class="bl-title">{item.title}</h4>
              {#if item.clientName}
                <span class="bl-client">({item.clientName})</span>
              {/if}
            </div>

            <button 
              type="button" 
              class="btn-quick-schedule" 
              disabled={schedulingActionId === item.id}
              onclick={() => handleQuickSchedule(item)}
            >
              <Calendar size={14} />
              <span>{schedulingActionId === item.id ? 'Pianificazione...' : 'Oggi'}</span>
            </button>
            <div 
              class="drag-handle-hint"
              draggable="true"
              ondragstart={(e) => {
                if (e.dataTransfer) {
                  e.dataTransfer.setData('application/json', JSON.stringify(item));
                  e.dataTransfer.effectAllowed = 'move';
                }
              }}
              title="Trascina sul calendario"
            >
              <Layers size={14} />
              <span>Trascina</span>
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  {#if loading}
    <div class="loading-state">Caricamento agenda operativa in corso...</div>
  {:else if filteredComposite.length === 0}
    <EmptyState 
      icon={Calendar} 
      title="Nessuna attività in agenda per i filtri selezionati"
      subtitle="Non ci sono interventi programmati o eventi di calendario da mostrare."
    />
  {:else}
    {#if activeView.layout === 'list'}
      <!-- GRID OF SCHEDULED COMPOSITE CARDS -->
      <div class="schedule-grid">
        {#each filteredComposite as item (item.id)}
          <Card class="schedule-card">
            <div class="sc-header">
              <div class="type-badge" class:is-intervention={item.source === 'intervention'}>
                {#if item.source === 'intervention'}
                  <Wrench size={13} />
                  <span>Bolla / Intervento</span>
                {:else}
                  <Calendar size={13} />
                  <span>Evento Calendario</span>
                {/if}
              </div>
              <StatusBadge status={item.status} label={getPhaseLabel(item.phase || item.status)} />
            </div>

            <h3 class="sc-title">
              {#if item.interventionNumber}
                <span class="int-no">{item.interventionNumber}</span>
              {/if}
              <span>{item.title}</span>
            </h3>

            <div class="sc-info-list">
              <div class="sc-info-item">
                <Clock size={15} color="var(--color-primary-600)" />
                <span class="font-semibold">{item.date}</span>
                <span class="slot-tag">{getSlotLabel(item.slot)}</span>
                {#if item.slot === 'custom' && item.customStartTime}
                  <span class="time-range">({item.customStartTime} - {item.customEndTime})</span>
                {/if}
              </div>

              {#if item.placeName || item.clientName}
                <div class="sc-info-item">
                  <MapPin size={15} color="var(--color-neutral-500)" />
                  <span>{item.placeName || 'Sede/Cantiere N/D'}</span>
                  {#if item.clientName}
                    <span class="client-name">({item.clientName})</span>
                  {/if}
                </div>
              {/if}
            </div>

            <!-- ASSIGNED ENTITIES PILLS -->
            {#if item.assignedEntities && item.assignedEntities.length > 0}
              <div class="sc-assignments">
                <span class="assignments-label">Risorse:</span>
                <div class="chips-list">
                  {#each item.assignedEntities as entity}
                    <span class="entity-chip" class:is-team={entity.entityType === 'team'} class:is-vehicle={entity.entityType === 'vehicle'}>
                      {#if entity.entityType === 'user'}
                        <User size={12} />
                      {:else if entity.entityType === 'team'}
                        <Users size={12} />
                      {:else}
                        <Truck size={12} />
                      {/if}
                      <span>{entity.entityName}</span>
                    </span>
                  {/each}
                </div>
              </div>
            {/if}

            <div class="sc-footer">
              {#if item.source === 'intervention'}
                <a href={`/dashboard/interventi/${item.id}`} class="btn-detail">
                  <Eye size={16} />
                  <span>Apri Bolla</span>
                </a>
              {:else}
                <a href={`/dashboard/activities/${item.id}`} class="btn-detail">
                  <Eye size={16} />
                  <span>Dettaglio</span>
                </a>
              {/if}
            </div>
          </Card>
        {/each}
      </div>
    {:else}
      <MatrixCalendar 
        items={filteredComposite} 
        yAxisEntities={activeYAxisEntities} 
        yAxisType={activeView.matrixYAxis || 'teams'}
        yAxisLabel={getAxisLabel(activeView.matrixYAxis)}
        onReschedule={handleRescheduleDrop} 
      />
    {/if}
  {/if}
</div>

<style>
  .scheduling-page-container {
    display: flex;
    flex-direction: column;
    gap: 20px;
    width: 100%;
  }

  .system-views-tabs {
    display: flex;
    gap: 8px;
    border-bottom: 1px solid var(--color-neutral-200);
    padding-bottom: 8px;
    overflow-x: auto;
  }
  .view-tab-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    background: white;
    border: 1px solid var(--color-neutral-200);
    border-radius: var(--radius-md);
    font-size: 13px;
    font-weight: 600;
    color: var(--color-neutral-600);
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.15s ease;
  }
  .view-tab-btn:hover {
    background: var(--color-neutral-50);
    color: var(--color-primary-600);
  }
  .view-tab-btn.active {
    background: var(--color-primary-600);
    color: white;
    border-color: var(--color-primary-600);
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  }

  .toolbar-box {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
  }
  .search-box {
    position: relative;
    flex: 1;
  }
  .search-icon {
    position: absolute;
    left: 12px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--color-neutral-400);
  }
  .search-input {
    width: 100%;
    padding: 10px 12px 10px 38px;
    border: 1px solid var(--color-neutral-200);
    border-radius: var(--radius-md);
    font-size: 14px;
    background: white;
  }
  .filter-controls {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .view-switch {
    display: flex;
    background: var(--color-neutral-100);
    padding: 3px;
    border-radius: var(--radius-md);
  }
  .switch-btn {
    border: none;
    background: none;
    padding: 6px 12px;
    font-size: 13px;
    font-weight: 600;
    color: var(--color-neutral-600);
    border-radius: var(--radius-sm);
    cursor: pointer;
  }
  .switch-btn.active {
    background: white;
    color: var(--color-primary-600);
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  }
  .filter-select {
    padding: 9px 12px;
    border: 1px solid var(--color-neutral-200);
    border-radius: var(--radius-md);
    font-size: 13px;
    background: white;
  }
  .schedule-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 16px;
  }
  .schedule-card {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
  }
  .type-badge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 11px;
    font-weight: 600;
    padding: 3px 8px;
    border-radius: 4px;
    background: var(--color-neutral-100);
    color: var(--color-neutral-700);
  }
  .type-badge.is-intervention {
    background: var(--color-primary-50);
    color: var(--color-primary-700);
  }
  .int-no {
    font-family: monospace;
    font-size: 13px;
    font-weight: 700;
    color: var(--color-primary-600);
    margin-right: 6px;
  }
  .backlog-banner {
    background: #fffbeb;
    border: 1px solid #fef3c7;
    border-radius: var(--radius-lg);
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .backlog-header {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .backlog-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 700;
    font-size: 15px;
    color: #92400e;
  }
  .backlog-sub {
    font-size: 13px;
    color: #b45309;
  }
  .backlog-list {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }
  .backlog-card {
    background: white;
    border: 1px solid #fde68a;
    border-radius: var(--radius-md);
    padding: 10px 14px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    flex: 1;
    min-width: 280px;
  }
  .bl-info {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .bl-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-family: monospace;
    font-size: 11px;
    font-weight: 700;
    color: var(--color-primary-700);
    background: var(--color-primary-50);
    padding: 2px 6px;
    border-radius: 4px;
  }
  .bl-title {
    font-size: 13px;
    font-weight: 600;
    margin: 0;
  }
  .bl-client {
    font-size: 12px;
    color: var(--color-neutral-500);
  }
  .btn-quick-schedule {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    background: var(--color-primary-600);
    color: white;
    font-size: 12px;
    font-weight: 600;
    border: none;
    border-radius: var(--radius-md);
    cursor: pointer;
    white-space: nowrap;
  }
  .btn-quick-schedule:hover {
    background: var(--color-primary-700);
  }
  .btn-quick-schedule:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  .drag-handle-hint {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 6px 12px;
    background: #fdf6b2;
    color: #92400e;
    font-size: 12px;
    font-weight: 600;
    border-radius: var(--radius-md);
    cursor: grab;
    white-space: nowrap;
    border: 1px dashed #f59e0b;
  }
  .drag-handle-hint:active {
    cursor: grabbing;
  }
  .sc-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .sc-title {
    font-size: 16px;
    font-weight: 700;
    margin: 0;
    color: var(--color-neutral-900);
  }
  .sc-info-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .sc-info-item {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: var(--color-neutral-700);
  }
  .slot-tag {
    font-size: 11px;
    font-weight: 600;
    background: var(--color-neutral-100);
    padding: 2px 6px;
    border-radius: 4px;
  }
  .client-name {
    color: var(--color-neutral-500);
  }
  .sc-assignments {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding-top: 8px;
    border-top: 1px solid var(--color-neutral-100);
  }
  .assignments-label {
    font-size: 11px;
    font-weight: 600;
    color: var(--color-neutral-500);
  }
  .chips-list {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .entity-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    font-weight: 600;
    padding: 3px 8px;
    border-radius: 4px;
    background: var(--color-primary-50);
    color: var(--color-primary-700);
  }
  .entity-chip.is-team {
    background: #ECFDF5;
    color: #047857;
  }
  .entity-chip.is-vehicle {
    background: #FFFBEB;
    color: #B45309;
  }
  .sc-footer {
    display: flex;
    justify-content: flex-end;
    padding-top: 8px;
  }
  .btn-detail {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    font-weight: 600;
    color: var(--color-primary-600);
    text-decoration: none;
  }
  .loading-state {
    padding: 40px;
    text-align: center;
    color: var(--color-neutral-500);
  }
  .font-semibold { font-weight: 600; }
</style>
