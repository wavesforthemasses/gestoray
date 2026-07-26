<script lang="ts">
  import { onMount } from 'svelte';
  import { ActivitiesService } from './activities.service';
  import type { ActivityItem, ActivityStatus, ActivityPriority } from './schema';
  import { toast } from '$lib/stores/toast.svelte';

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
    if (!id || !confirm('Sei sicuro di voler eliminare questa attività?')) return;
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
      case 'completato': return { label: '✅ Completato', class: 'badge-success' };
      case 'in_corso': return { label: '🔄 In Corso', class: 'badge-info' };
      case 'da_fare': return { label: '📌 Da Fare', class: 'badge-warning' };
      case 'annullato': return { label: '🚫 Annullato', class: 'badge-neutral' };
      default: return { label: status, class: 'badge-neutral' };
    }
  }

  function getPriorityBadge(priority: ActivityPriority) {
    switch (priority) {
      case 'urgente': return { label: '🔥 Urgente', class: 'prio-red' };
      case 'alta': return { label: '⚠️ Alta', class: 'prio-orange' };
      case 'media': return { label: '🔹 Media', class: 'prio-blue' };
      case 'bassa': return { label: '🟢 Bassa', class: 'prio-green' };
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
      <h1 class="page-title">📋 Attività & Task Operativi</h1>
      <p class="page-subtitle">Organizza e gestisci le attività interne, le scadenze e le lavorazioni del personale.</p>
    </div>
    <div class="header-actions">
      <a href="/dashboard/activities/add" class="btn btn-primary">+ Nuova Attività</a>
    </div>
  </header>

  <!-- KPI CARDS -->
  <div class="kpi-grid">
    <div class="kpi-card">
      <span class="kpi-icon">📋</span>
      <div>
        <div class="kpi-value">{activities.length}</div>
        <div class="kpi-label">Attività Totali</div>
      </div>
    </div>

    <div class="kpi-card">
      <span class="kpi-icon">🔄</span>
      <div>
        <div class="kpi-value">{inProgressCount}</div>
        <div class="kpi-label">In Corso di Svolgimento</div>
      </div>
    </div>

    <div class="kpi-card">
      <span class="kpi-icon">📌</span>
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
        🔄 In Corso ({inProgressCount})
      </button>
      <button 
        type="button" 
        class="tab-btn {activeStatusTab === 'da_fare' ? 'active' : ''}" 
        onclick={() => activeStatusTab = 'da_fare'}
      >
        📌 Da Fare ({todoCount})
      </button>
      <button 
        type="button" 
        class="tab-btn {activeStatusTab === 'completato' ? 'active' : ''}" 
        onclick={() => activeStatusTab = 'completato'}
      >
        ✅ Completate ({activities.filter(a => a.status === 'completato').length})
      </button>
    </div>

    <input 
      type="text" 
      placeholder="🔍 Cerca attività per titolo, numero o utente assegnato..." 
      bind:value={searchQuery} 
      class="search-input"
    />
  </div>

  <!-- TABLE -->
  {#if loading}
    <div class="loading-state">
      <span class="spinner"></span>
      Caricamento attività...
    </div>
  {:else if filteredActivities.length === 0}
    <div class="empty-state">
      <span class="empty-icon">📋</span>
      <h3>Nessuna attività trovata</h3>
      <p>Crea la tua prima attività o task operativo per coordinare il lavoro.</p>
      <a href="/dashboard/activities/add" class="btn btn-primary">+ Nuova Attività</a>
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
              <td><strong class="text-neutral-800">👷 {a.assignedName}</strong></td>
              <td>{a.dueDate || 'N.D.'}</td>
              <td><span class="prio-pill {prio.class}">{prio.label}</span></td>
              <td><span class="badge {badge.class}">{badge.label}</span></td>
              <td class="text-right">
                <div class="action-buttons">
                  <a href="/dashboard/activities/{a.id}" class="btn-icon" title="Dettaglio">👁️</a>
                  <a href="/dashboard/activities/{a.id}/edit" class="btn-icon" title="Modifica">✏️</a>
                  <button type="button" class="btn-icon-danger" onclick={() => handleDelete(a.id)} title="Elimina">🗑️</button>
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
  .page-title { font-size: 1.6rem; font-weight: 800; margin: 0; color: var(--color-neutral-900); }
  .page-subtitle { color: var(--color-neutral-500); font-size: 0.9rem; margin: 0.2rem 0 0 0; }

  .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; }
  .kpi-card { background: white; border: 1px solid var(--color-neutral-200); border-radius: var(--radius-lg); padding: 1rem 1.2rem; display: flex; align-items: center; gap: 1rem; box-shadow: var(--shadow-sm); }
  .kpi-icon { font-size: 2rem; }
  .kpi-value { font-size: 1.4rem; font-weight: 800; color: var(--color-neutral-900); }
  .kpi-label { font-size: 0.8rem; color: var(--color-neutral-500); font-weight: 600; }

  .filter-card { background: white; border: 1px solid var(--color-neutral-200); border-radius: var(--radius-lg); padding: 1rem; display: flex; flex-direction: column; gap: 0.8rem; }
  .status-tabs { display: flex; gap: 0.5rem; flex-wrap: wrap; }
  .tab-btn { padding: 0.4rem 0.8rem; border-radius: var(--radius-md); font-size: 0.85rem; font-weight: 600; border: 1px solid var(--color-neutral-300); background: var(--color-neutral-50); color: var(--color-neutral-700); cursor: pointer; }
  .tab-btn.active { background: var(--color-primary-600); color: white; border-color: var(--color-primary-600); }

  .search-input { width: 100%; padding: 0.6rem 0.9rem; border: 1px solid var(--color-neutral-300); border-radius: var(--radius-md); font-size: 0.9rem; outline: none; box-sizing: border-box; }

  .table-card { background: white; border: 1px solid var(--color-neutral-200); border-radius: var(--radius-lg); overflow: hidden; box-shadow: var(--shadow-sm); }
  .data-table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
  .data-table th, .data-table td { padding: 0.8rem 1rem; text-align: left; border-bottom: 1px solid var(--color-neutral-200); }
  .data-table th { background: var(--color-neutral-50); font-weight: 700; color: var(--color-neutral-700); font-size: 0.8rem; text-transform: uppercase; }

  .activity-link { font-weight: 700; color: var(--color-primary-700); text-decoration: none; }
  .activity-link:hover { text-decoration: underline; }

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
  .btn { padding: 0.6rem 1.2rem; border-radius: var(--radius-md); font-weight: 600; cursor: pointer; border: none; text-decoration: none; font-size: 0.88rem; }
  .btn-primary { background: var(--color-primary-600); color: white; }
  .btn-icon, .btn-icon-danger { background: none; border: none; cursor: pointer; font-size: 1rem; text-decoration: none; }

  .loading-state, .empty-state { text-align: center; padding: 3rem; background: white; border-radius: var(--radius-lg); border: 1px solid var(--color-neutral-200); }
  .empty-icon { font-size: 3rem; display: block; margin-bottom: 0.5rem; }
  .font-mono { font-family: monospace; font-weight: 600; }
  .text-right { text-align: right; }
</style>
