<script lang="ts">
  import { projectStore } from '$lib/stores/project';
  import { onMount } from 'svelte';
  import { ActivitiesService } from './activities.service';
  import type { ActivityItem, ActivityStatus, ActivityPriority } from './schema';
  import { toast } from '$lib/stores/toast.svelte';
  import { confirmStore } from '$lib/stores/confirm.svelte';
  import { CacheLookupService } from '$lib/services/cacheLookupService';
  import { PageHeader } from '$lib';
  import SearchToolbar from '$lib/components/SearchToolbar.svelte';
  import FilterSelect from '$lib/components/FilterSelect.svelte';
  import ActivitiesCalendar from './components/ActivitiesCalendar.svelte';
  import { 
    ClipboardList, 
    RefreshCw, 
    Pin, 
    CheckCircle2, 
    Search, 
    Plus, 
    Eye, 
    Pencil, 
    Trash2,
    HardHat,
    AlertCircle,
    AlertTriangle,
    Minus,
    List,
    Calendar,
    User,
    SlidersHorizontal,
    Target,
    UserCheck,
    Building2,
    MapPin,
    Truck,
    FileText,
    Users
  } from '@lucide/svelte';

  let activities = $state<ActivityItem[]>([]);
  let usersList = $state<{ id: string; name: string }[]>([]);
  let loading = $state(true);
  let searchQuery = $state('');
  
  // Backend Filter State
  let activeStatusTab = $state<string>('tutti');
  let selectedAssignedUid = $state<string>('tutti');
  let selectedPriority = $state<string>('tutti');
  let selectedTargetType = $state<string>('tutti');

  let viewMode = $state<'list' | 'calendar'>('list');

  async function fetchBackendActivities() {
    loading = true;
    try {
      activities = await ActivitiesService.getActivities({
        status: activeStatusTab,
        assignedUid: selectedAssignedUid,
        priority: selectedPriority,
        targetType: selectedTargetType
      });
    } catch (e: any) {
      console.error('Errore caricamento attività:', e);
      toast.error('Errore nel caricamento delle attività');
    } finally {
      loading = false;
    }
  }

  onMount(async () => {
    try {
      usersList = await CacheLookupService.getLookup('users');
      await fetchBackendActivities();
    } catch (e) {
      console.error('Errore inizializzazione:', e);
    }
  });

  function handleStatusChange(status: string) {
    activeStatusTab = status;
    fetchBackendActivities();
  }

  function handleAssignedChange(e: Event) {
    selectedAssignedUid = (e.target as HTMLSelectElement).value;
    fetchBackendActivities();
  }

  function handlePriorityChange(e: Event) {
    selectedPriority = (e.target as HTMLSelectElement).value;
    fetchBackendActivities();
  }

  function handleTargetTypeFilterChange(e: Event) {
    selectedTargetType = (e.target as HTMLSelectElement).value;
    fetchBackendActivities();
  }

  let filteredActivities = $derived(
    activities.filter(a => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        a.title.toLowerCase().includes(q) ||
        (a.activityNumber || '').toLowerCase().includes(q) ||
        (a.assignedName || '').toLowerCase().includes(q) ||
        (a.targetName || '').toLowerCase().includes(q) ||
        (a.clientName || '').toLowerCase().includes(q)
      );
    })
  );

  let inProgressCount = $derived(activities.filter(a => a.status === 'in_corso').length);
  let todoCount = $derived(activities.filter(a => a.status === 'da_fare').length);

  async function handleDelete(id?: string) {
    if (!id) return;
    const confirmed = await confirmStore.prompt('Sei sicuro di voler eliminare questa attività?');
    if (!confirmed) return;
    try {
      await ActivitiesService.deleteActivity(id);
      activities = activities.filter(a => a.id !== id);
      toast.success('Attività eliminata con successo');
    } catch (err: any) {
      toast.error('Errore eliminazione attività: ' + err.message);
    }
  }

  function getStatusBadge(status: ActivityStatus) {
    switch (status) {
      case 'completata':
      case 'completato': return { label: 'Completata', class: 'badge-success' };
      case 'in_corso': return { label: 'In Corso', class: 'badge-info' };
      case 'da_fare': return { label: 'Da Fare', class: 'badge-warning' };
      case 'annullata':
      case 'annullato': return { label: 'Annullata', class: 'badge-neutral' };
      default: return { label: status, class: 'badge-neutral' };
    }
  }

  function getPriorityBadge(priority: ActivityPriority) {
    switch (priority) {
      case 'urgente': return { label: 'Urgente', class: 'prio-red' };
      case 'alta': return { label: 'Alta', class: 'prio-orange' };
      case 'media': return { label: 'Media', class: 'prio-blue' };
      case 'bassa': return { label: 'Bassa', class: 'prio-green' };
      default: return { label: priority, class: 'prio-blue' };
    }
  }
</script>

<svelte:head>
  <title>Attività & Task Interni | {$projectStore?.projectName || 'ERP'}</title>
</svelte:head>

<div class="activities-page animate-fade-in">
  <PageHeader 
    icon={ClipboardList} 
    title="Attività & Task Operativi" 
    subtitle="Organizza e gestisci le attività interne, le scadenze e le lavorazioni del personale."
  >
    {#snippet actions()}
      <div class="view-toggle-group">
        <button 
          type="button" 
          class="toggle-btn" 
          class:active={viewMode === 'list'} 
          onclick={() => viewMode = 'list'}
          title="Vista Elenco"
        >
          <List size={16} /> Lista
        </button>
        <button 
          type="button" 
          class="toggle-btn" 
          class:active={viewMode === 'calendar'} 
          onclick={() => viewMode = 'calendar'}
          title="Vista Calendario"
        >
          <Calendar size={16} /> Calendario
        </button>
      </div>

      <a href="/dashboard/activities/add" class="btn-create">
        <Plus size={18} />
        <span>Nuova Attività</span>
      </a>
    {/snippet}
  </PageHeader>

  <!-- KPI CARDS -->
  <div class="kpi-grid">
    <div class="kpi-card">
      <div class="kpi-icon-wrapper primary-bg">
        <ClipboardList size={22} />
      </div>
      <div>
        <div class="kpi-value">{activities.length}</div>
        <div class="kpi-label">Attività Caricate</div>
      </div>
    </div>

    <div class="kpi-card">
      <div class="kpi-icon-wrapper info-bg">
        <RefreshCw size={22} />
      </div>
      <div>
        <div class="kpi-value">{inProgressCount}</div>
        <div class="kpi-label">In Corso di Svolgimento</div>
      </div>
    </div>

    <div class="kpi-card">
      <div class="kpi-icon-wrapper warning-bg">
        <Pin size={22} />
      </div>
      <div>
        <div class="kpi-value">{todoCount}</div>
        <div class="kpi-label">Da Fare</div>
      </div>
    </div>
  </div>

  <!-- STATUS TABS -->
  <div class="status-tabs-container">
    <button 
      type="button" 
      class="tab-btn {activeStatusTab === 'tutti' ? 'active' : ''}" 
      onclick={() => handleStatusChange('tutti')}
    >
      Tutte ({activities.length})
    </button>
    <button 
      type="button" 
      class="tab-btn {activeStatusTab === 'in_corso' ? 'active' : ''}" 
      onclick={() => handleStatusChange('in_corso')}
    >
      <RefreshCw size={14} /> In Corso ({inProgressCount})
    </button>
    <button 
      type="button" 
      class="tab-btn {activeStatusTab === 'da_fare' ? 'active' : ''}" 
      onclick={() => handleStatusChange('da_fare')}
    >
      <Pin size={14} /> Da Fare ({todoCount})
    </button>
    <button 
      type="button" 
      class="tab-btn {activeStatusTab === 'completata' ? 'active' : ''}" 
      onclick={() => handleStatusChange('completata')}
    >
      <CheckCircle2 size={14} /> Completate
    </button>
  </div>

  <!-- SEARCH & FILTER TOOLBAR (Principio 12) -->
  <SearchToolbar
    bind:searchQuery
    placeholder="Cerca attività per titolo, numero, bersaglio o utente..."
  >
    {#snippet filtersSnippet()}
      <FilterSelect
        value={selectedTargetType}
        onchange={(val) => { selectedTargetType = val; handleTargetTypeFilterChange({ target: { value: val } } as any); }}
        icon={Target}
        options={[
          { value: 'tutti', label: 'Tutti i Bersagli' },
          { value: 'contact', label: 'Contatti' },
          { value: 'client', label: 'Clienti' },
          { value: 'user', label: 'Utenti / Personale' },
          { value: 'place', label: 'Luoghi / Impianti' },
          { value: 'vehicle', label: 'Mezzi' },
          { value: 'contract', label: 'Contratti' }
        ]}
      />
      <FilterSelect
        value={selectedAssignedUid}
        onchange={(val) => { selectedAssignedUid = val; handleAssignedChange({ target: { value: val } } as any); }}
        icon={User}
        options={[
          { value: 'tutti', label: 'Tutti gli Utenti' },
          ...usersList.map(u => ({ value: u.id, label: u.name }))
        ]}
      />
      <FilterSelect
        value={selectedPriority}
        onchange={(val) => { selectedPriority = val; handlePriorityChange({ target: { value: val } } as any); }}
        icon={SlidersHorizontal}
        options={[
          { value: 'tutti', label: 'Tutte le Priorità' },
          { value: 'urgente', label: 'Urgente' },
          { value: 'alta', label: 'Alta' },
          { value: 'media', label: 'Media' },
          { value: 'bassa', label: 'Bassa' }
        ]}
      />
    {/snippet}
  </SearchToolbar>

  <!-- TABLE -->
  {#if loading}
    <div class="loading-state">
      <span class="spinner"></span>
      Caricamento attività...
    </div>
  {:else if viewMode === 'calendar'}
    <ActivitiesCalendar activities={filteredActivities} />
  {:else if filteredActivities.length === 0}
    <div class="empty-state">
      <div class="empty-icon-wrapper">
        <ClipboardList size={42} />
      </div>
      <h3>Nessuna attività trovata</h3>
      <p>Crea la tua prima attività o task operativo per coordinare il lavoro.</p>
      <a href="/dashboard/activities/add" class="btn btn-primary">
        <Plus size={16} /> Nuova Attività
      </a>
    </div>
  {:else}
    <div class="table-card">
      <table class="data-table">
        <thead>
          <tr>
            <th>N° Task</th>
            <th>Titolo Attività</th>
            <th>Bersaglio (Target)</th>
            <th>Assegnato a</th>
            <th>Data Esecuzione</th>
            <th>Priorità</th>
            <th>Stato</th>
            <th class="text-right">Azioni</th>
          </tr>
        </thead>
        <tbody>
          {#each filteredActivities as a}
            {@const badge = getStatusBadge(a.status)}
            {@const prio = getPriorityBadge(a.priority)}
            <tr>
              <td class="font-mono">{a.activityNumber || a.id}</td>
              <td>
                <a href="/dashboard/activities/{a.id}" class="activity-link">{a.title}</a>
                {#if a.activityTypeName}
                  <div class="text-[11px] text-base-content/50">{a.activityTypeName}</div>
                {/if}
              </td>
              <td>
                {#if a.targetName}
                  <div class="flex items-center gap-1.5 font-medium text-xs">
                    {#if a.targetType === 'contact'}
                      <UserCheck size={13} class="text-primary" />
                    {:else if a.targetType === 'client'}
                      <Building2 size={13} class="text-secondary" />
                    {:else if a.targetType === 'user'}
                      <Users size={13} class="text-accent" />
                    {:else if a.targetType === 'place'}
                      <MapPin size={13} class="text-info" />
                    {:else if a.targetType === 'vehicle'}
                      <Truck size={13} class="text-warning" />
                    {:else if a.targetType === 'contract'}
                      <FileText size={13} class="text-success" />
                    {/if}
                    <span class="truncate max-w-[160px]" title={a.targetName}>{a.targetName}</span>
                  </div>
                {:else}
                  <span class="text-base-content/40 text-xs">-</span>
                {/if}
              </td>
              <td>
                <span class="assigned-user">
                  <HardHat size={14} class="user-icon" />
                  {a.assignedName || 'Non assegnato'}
                </span>
              </td>
              <td>{a.executionDate || a.dueDate || 'N.D.'}</td>
              <td><span class="prio-pill {prio.class}">{prio.label}</span></td>
              <td><span class="badge {badge.class}">{badge.label}</span></td>
              <td class="text-right">
                <div class="action-buttons">
                  <a href="/dashboard/activities/{a.id}" class="btn-icon" title="Dettaglio">
                    <Eye size={16} />
                  </a>
                  <a href="/dashboard/activities/{a.id}/edit" class="btn-icon" title="Modifica">
                    <Pencil size={16} />
                  </a>
                  <button type="button" class="btn-icon-danger" onclick={() => handleDelete(a.id)} title="Elimina">
                    <Trash2 size={16} />
                  </button>
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>

<style>
  .activities-page { padding: 1.5rem; display: flex; flex-direction: column; gap: 1.5rem; width: 100%; box-sizing: border-box; }
  .page-header { display: flex; justify-content: space-between; align-items: center; }
  .page-title { font-size: 1.6rem; font-weight: 800; margin: 0; color: var(--color-neutral-900); display: flex; align-items: center; gap: 10px; }
  :global(.title-icon) { color: var(--color-primary-500); }
  .page-subtitle { color: var(--color-neutral-500); font-size: 0.9rem; margin: 0.2rem 0 0 0; }

  .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; }
  .kpi-card { background: white; border: 1px solid var(--color-neutral-200); border-radius: var(--radius-lg); padding: 1rem 1.2rem; display: flex; align-items: center; gap: 1rem; box-shadow: var(--shadow-sm); }
  
  .kpi-icon-wrapper { width: 44px; height: 44px; border-radius: 10px; display: flex; align-items: center; justify-content: center; }
  .primary-bg { background: var(--color-primary-100); color: var(--color-primary-600); }
  .info-bg { background: #e0f2fe; color: #0369a1; }
  .warning-bg { background: #fef3c7; color: #b45309; }

  .kpi-value { font-size: 1.4rem; font-weight: 800; color: var(--color-neutral-900); }
  .kpi-label { font-size: 0.8rem; color: var(--color-neutral-500); font-weight: 600; }

  .status-tabs-container { display: flex; gap: 0.5rem; flex-wrap: wrap; }
  .tab-btn { padding: 0.4rem 0.8rem; border-radius: var(--radius-md); font-size: 0.85rem; font-weight: 600; border: 1px solid var(--color-neutral-300); background: var(--color-neutral-50); color: var(--color-neutral-700); cursor: pointer; display: inline-flex; align-items: center; gap: 6px; }
  .tab-btn.active { background: var(--color-primary-600); color: white; border-color: var(--color-primary-600); }

  .table-card { background: white; border: 1px solid var(--color-neutral-200); border-radius: var(--radius-lg); overflow: hidden; box-shadow: var(--shadow-sm); }
  .data-table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
  .data-table th, .data-table td { padding: 0.8rem 1rem; text-align: left; border-bottom: 1px solid var(--color-neutral-200); }
  .data-table th { background: var(--color-neutral-50); font-weight: 700; color: var(--color-neutral-700); font-size: 0.8rem; text-transform: uppercase; }

  .activity-link { font-weight: 700; color: var(--color-primary-700); text-decoration: none; }
  .activity-link:hover { text-decoration: underline; }

  .assigned-user { display: inline-flex; align-items: center; gap: 6px; font-weight: 600; color: var(--color-neutral-800); }
  :global(.user-icon) { color: var(--color-neutral-500); }

  .prio-pill { font-size: 0.78rem; font-weight: 700; padding: 0.2rem 0.5rem; border-radius: 6px; }
  .prio-red { background: #fee2e2; color: #991b1b; }
  .prio-orange { background: #ffedd5; color: #c2410c; }
  .prio-blue { background: #e0f2fe; color: #0369a1; }
  .prio-green { background: #dcfce7; color: #15803d; }

  .badge { font-size: 0.78rem; padding: 0.2rem 0.6rem; border-radius: 12px; font-weight: 600; }
  .badge-success { background: #dcfce7; color: #15803d; }
  .badge-info { background: #e0f2fe; color: #0369a1; }
  .badge-warning { background: #fef3c7; color: #b45309; }
  .badge-neutral { background: #f1f5f9; color: #475569; }

  .header-actions { display: flex; align-items: center; gap: 12px; }
  .view-toggle-group { display: inline-flex; background: var(--color-neutral-100); border: 1px solid var(--color-neutral-300); border-radius: var(--radius-md); padding: 2px; }
  .toggle-btn { background: transparent; border: none; padding: 6px 12px; font-size: 0.85rem; font-weight: 600; color: var(--color-neutral-600); cursor: pointer; border-radius: var(--radius-sm); display: inline-flex; align-items: center; gap: 6px; transition: all 0.15s ease; }
  .toggle-btn.active { background: var(--color-white); color: var(--color-primary-600); box-shadow: var(--shadow-sm); }

  .loading-state, .empty-state { text-align: center; padding: 3rem; background: white; border-radius: var(--radius-lg); border: 1px solid var(--color-neutral-200); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.8rem; }
  .empty-icon-wrapper { width: 64px; height: 64px; border-radius: 16px; background: var(--color-primary-50); color: var(--color-primary-600); display: flex; align-items: center; justify-content: center; margin-bottom: 0.5rem; }
  .font-mono { font-family: monospace; font-weight: 600; }
  .text-right { text-align: right; }
  .action-buttons { display: flex; gap: 6px; justify-content: flex-end; }
  .btn-icon { padding: 6px; border-radius: 6px; color: var(--color-neutral-600); display: inline-flex; align-items: center; justify-content: center; }
  .btn-icon:hover { background: var(--color-neutral-100); color: var(--color-primary-600); }
  .btn-icon-danger { padding: 6px; border-radius: 6px; color: #ef4444; background: transparent; border: none; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; }
  .btn-icon-danger:hover { background: #fee2e2; }
  .btn-create { display: inline-flex; align-items: center; gap: 8px; padding: 8px 16px; background: var(--color-primary-600); color: white; border-radius: var(--radius-md); font-weight: 600; text-decoration: none; font-size: 0.9rem; }
  .btn-create:hover { background: var(--color-primary-700); }
</style>
