<script lang="ts">
  import { onMount } from 'svelte';
  import { ActivitiesService } from './activities.service';
  import type { ActivityItem, ActivityStatus, ActivityPriority } from './schema';
  import { toast } from '$lib/stores/toast.svelte';
  import { confirmStore } from '$lib/stores/confirm.svelte';
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
    Minus
  } from '@lucide/svelte';

  let activities = $state<ActivityItem[]>([]);
  let loading = $state(true);
  let searchQuery = $state('');
  let activeStatusTab = $state<'tutti' | ActivityStatus>('tutti');

  onMount(async () => {
    try {
      activities = await ActivitiesService.getActivities();
    } catch (e) {
      console.error('Errore caricamento attività:', e);
    } finally {
      loading = false;
    }
  });

  let filteredActivities = $derived(
    activities.filter(a => {
      const matchSearch = !searchQuery.trim() || 
        a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.activityNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.assignedName.toLowerCase().includes(searchQuery.toLowerCase());

      const matchTab = activeStatusTab === 'tutti' || a.status === activeStatusTab;
      return matchSearch && matchTab;
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
      case 'completato': return { label: 'Completato', class: 'badge-success' };
      case 'in_corso': return { label: 'In Corso', class: 'badge-info' };
      case 'da_fare': return { label: 'Da Fare', class: 'badge-warning' };
      case 'annullato': return { label: 'Annullato', class: 'badge-neutral' };
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
  <title>Attività & Task Interni | Gestoray</title>
</svelte:head>

<div class="activities-page animate-fade-in">
  <header class="page-header">
    <div>
      <h1 class="page-title">
        <ClipboardList size={26} class="title-icon" /> Attività & Task Operativi
      </h1>
      <p class="page-subtitle">Organizza e gestisci le attività interne, le scadenze e le lavorazioni del personale.</p>
    </div>
    <div class="header-actions">
      <a href="/dashboard/activities/add" class="btn btn-primary">
        <Plus size={16} /> Nuova Attività
      </a>
    </div>
  </header>

  <!-- KPI CARDS -->
  <div class="kpi-grid">
    <div class="kpi-card">
      <div class="kpi-icon-wrapper primary-bg">
        <ClipboardList size={22} />
      </div>
      <div>
        <div class="kpi-value">{activities.length}</div>
        <div class="kpi-label">Attività Totali</div>
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

  <!-- FILTERS & SEARCH -->
  <div class="filter-card">
    <div class="status-tabs">
      <button 
        type="button" 
        class="tab-btn {activeStatusTab === 'tutti' ? 'active' : ''}" 
        onclick={() => activeStatusTab = 'tutti'}
      >
        Tutte ({activities.length})
      </button>
      <button 
        type="button" 
        class="tab-btn {activeStatusTab === 'in_corso' ? 'active' : ''}" 
        onclick={() => activeStatusTab = 'in_corso'}
      >
        <RefreshCw size={14} /> In Corso ({inProgressCount})
      </button>
      <button 
        type="button" 
        class="tab-btn {activeStatusTab === 'da_fare' ? 'active' : ''}" 
        onclick={() => activeStatusTab = 'da_fare'}
      >
        <Pin size={14} /> Da Fare ({todoCount})
      </button>
      <button 
        type="button" 
        class="tab-btn {activeStatusTab === 'completato' ? 'active' : ''}" 
        onclick={() => activeStatusTab = 'completato'}
      >
        <CheckCircle2 size={14} /> Completate ({activities.filter(a => a.status === 'completato').length})
      </button>
    </div>

    <div class="search-box">
      <Search size={16} class="search-icon" />
      <input 
        type="text" 
        placeholder="Cerca attività per titolo, numero o utente assegnato..." 
        bind:value={searchQuery} 
        class="search-input"
      />
    </div>
  </div>

  <!-- TABLE -->
  {#if loading}
    <div class="loading-state">
      <span class="spinner"></span>
      Caricamento attività...
    </div>
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
            <th>Assegnato a</th>
            <th>Scadenza</th>
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
              <td class="font-mono">{a.activityNumber}</td>
              <td>
                <a href="/dashboard/activities/{a.id}" class="activity-link">{a.title}</a>
              </td>
              <td>
                <span class="assigned-user">
                  <HardHat size={14} class="user-icon" />
                  {a.assignedName}
                </span>
              </td>
              <td>{a.dueDate || 'N.D.'}</td>
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
  .activities-page { padding: 1.5rem; display: flex; flex-direction: column; gap: 1.5rem; max-width: 1200px; margin: 0 auto; }
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

  .filter-card { background: white; border: 1px solid var(--color-neutral-200); border-radius: var(--radius-lg); padding: 1rem; display: flex; flex-direction: column; gap: 0.8rem; }
  .status-tabs { display: flex; gap: 0.5rem; flex-wrap: wrap; }
  .tab-btn { padding: 0.4rem 0.8rem; border-radius: var(--radius-md); font-size: 0.85rem; font-weight: 600; border: 1px solid var(--color-neutral-300); background: var(--color-neutral-50); color: var(--color-neutral-700); cursor: pointer; display: inline-flex; align-items: center; gap: 6px; }
  .tab-btn.active { background: var(--color-primary-600); color: white; border-color: var(--color-primary-600); }

  .search-box { position: relative; width: 100%; display: flex; align-items: center; }
  :global(.search-icon) { position: absolute; left: 12px; color: var(--color-neutral-400); }
  .search-input { width: 100%; padding: 0.6rem 0.9rem 0.6rem 2.4rem; border: 1px solid var(--color-neutral-300); border-radius: var(--radius-md); font-size: 0.9rem; outline: none; box-sizing: border-box; }

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

  .action-buttons { display: flex; gap: 0.4rem; justify-content: flex-end; }
  .btn { padding: 0.6rem 1.2rem; border-radius: var(--radius-md); font-weight: 600; cursor: pointer; border: none; text-decoration: none; font-size: 0.88rem; display: inline-flex; align-items: center; gap: 6px; }
  .btn-primary { background: var(--color-primary-600); color: white; }
  .btn-icon, .btn-icon-danger { background: none; border: none; cursor: pointer; color: var(--color-neutral-600); text-decoration: none; padding: 4px; border-radius: 4px; display: inline-flex; align-items: center; }
  .btn-icon:hover { color: var(--color-primary-600); background: var(--color-neutral-100); }
  .btn-icon-danger:hover { color: #dc2626; background: #fee2e2; }

  .loading-state, .empty-state { text-align: center; padding: 3rem; background: white; border-radius: var(--radius-lg); border: 1px solid var(--color-neutral-200); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.8rem; }
  .empty-icon-wrapper { width: 64px; height: 64px; border-radius: 16px; background: var(--color-primary-50); color: var(--color-primary-600); display: flex; align-items: center; justify-content: center; margin-bottom: 0.5rem; }
  .font-mono { font-family: monospace; font-weight: 600; }
  .text-right { text-align: right; }
</style>
