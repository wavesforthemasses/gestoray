<script module lang="ts">
  export const bridgeMetadata = {
    id: 'activities',
    sourceModule: 'activities',
    label: 'Attività & Task'
  };
</script>

<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { NavigationService } from '$lib/services/navigationService';
  import { db, collection, getDocs, query, where, orderBy } from '$lib/firebase';
  import { Calendar, Plus, Users, User, ArrowRight, CheckCircle2, Clock, AlertCircle } from '@lucide/svelte';

  let { placeId, clientId }: { placeId?: string; clientId?: string } = $props();

  let activitiesList = $state<any[]>([]);
  let loading = $state(true);
  let selectedFilter = $state<'all' | 'active' | 'completed'>('all');

  onMount(async () => {
    try {
      if (placeId) {
        let list: any[] = [];
        try {
          const snap = await getDocs(query(collection(db, 'activities'), where('placeId', '==', placeId)));
          snap.forEach(d => {
            list.push({ id: d.id, ...d.data() });
          });
        } catch (err) {
          console.warn('Errore query activities placeId:', err);
        }

        // Sort by date / createdAt desc
        list.sort((a, b) => {
          const dateA = a.scheduledDate || a.executionDate || a.createdAt || '';
          const dateB = b.scheduledDate || b.executionDate || b.createdAt || '';
          return dateB.localeCompare(dateA);
        });

        activitiesList = list;
      }
    } catch (e) {
      console.error('Errore caricamento attività del cantiere:', e);
    } finally {
      loading = false;
    }
  });

  let filteredActivities = $derived.by(() => {
    if (selectedFilter === 'active') {
      return activitiesList.filter(a => a.status === 'da_fare' || a.status === 'in_corso');
    }
    if (selectedFilter === 'completed') {
      return activitiesList.filter(a => a.status === 'completata' || a.status === 'completato');
    }
    return activitiesList;
  });

  function getStatusBadge(status: string) {
    switch (status) {
      case 'in_corso':
        return { label: 'In Corso', class: 'status-in-progress' };
      case 'completata':
      case 'completato':
        return { label: 'Completata', class: 'status-completed' };
      case 'annullata':
      case 'annullato':
        return { label: 'Annullata', class: 'status-cancelled' };
      default:
        return { label: 'Da Fare', class: 'status-todo' };
    }
  }

  function getTeams(act: any): string[] {
    if (act.assignedEntities && Array.isArray(act.assignedEntities)) {
      return act.assignedEntities
        .filter((e: any) => e.type === 'team' || e.entityType === 'team')
        .map((e: any) => e.name || e.entityName)
        .filter(Boolean);
    }
    return [];
  }

  function getUsers(act: any): string[] {
    if (act.assignedEntities && Array.isArray(act.assignedEntities)) {
      return act.assignedEntities
        .filter((e: any) => e.type === 'user' || e.entityType === 'user')
        .map((e: any) => e.name || e.entityName)
        .filter(Boolean);
    }
    if (act.assignedName) return [act.assignedName];
    return [];
  }
</script>

<div class="place-activities-bridge-tab">
  <div class="bridge-header-row">
    <div class="bridge-header-info">
      <h4 class="bridge-title">Attività & Task del Cantiere</h4>
      <p class="bridge-sub">Pianificazione dei lavori, rapportini ed eventi assegnati a questo cantiere.</p>
    </div>

    <a 
      href={NavigationService.buildAddUrl('/dashboard/activities/add', { placeId, clientId }, $page.url.pathname)} 
      class="btn-create-activity"
    >
      <Plus size={16} />
      <span>Nuova Attività</span>
    </a>
  </div>

  <div class="filter-toolbar">
    <button 
      class="filter-pill" 
      class:active={selectedFilter === 'all'}
      onclick={() => selectedFilter = 'all'}
    >
      Tutte ({activitiesList.length})
    </button>
    <button 
      class="filter-pill" 
      class:active={selectedFilter === 'active'}
      onclick={() => selectedFilter = 'active'}
    >
      Attive / In Corso ({activitiesList.filter(a => a.status === 'da_fare' || a.status === 'in_corso').length})
    </button>
    <button 
      class="filter-pill" 
      class:active={selectedFilter === 'completed'}
      onclick={() => selectedFilter = 'completed'}
    >
      Completate ({activitiesList.filter(a => a.status === 'completata' || a.status === 'completato').length})
    </button>
  </div>

  {#if loading}
    <div class="loading-state">
      <div class="spinner"></div>
      <p>Caricamento attività del cantiere in corso...</p>
    </div>
  {:else if filteredActivities.length === 0}
    <div class="empty-bridge-state">
      <Calendar size={36} class="empty-icon" />
      <h5>Nessuna attività trovata</h5>
      <p>Non ci sono attività o task registrati per questo cantiere con i filtri correnti.</p>
      <a 
        href="/dashboard/activities/add?placeId={placeId || ''}&clientId={clientId || ''}" 
        class="btn-create-activity mt-12"
      >
        <Plus size={16} />
        <span>Crea Prima Attività</span>
      </a>
    </div>
  {:else}
    <div class="activities-grid">
      {#each filteredActivities as act}
        {@const badge = getStatusBadge(act.status)}
        {@const teams = getTeams(act)}
        {@const users = getUsers(act)}
        
        <div class="activity-card">
          <div class="activity-card-header">
            <div class="header-left">
              {#if act.activityNumber}
                <span class="activity-code">{act.activityNumber}</span>
              {/if}
              <h5 class="activity-title">{act.title}</h5>
            </div>
            <span class="status-badge {badge.class}">{badge.label}</span>
          </div>

          {#if act.description}
            <p class="activity-desc">{act.description}</p>
          {/if}

          <div class="activity-meta-row">
            {#if act.scheduledDate || act.executionDate}
              <div class="meta-item">
                <Calendar size={14} />
                <span>{act.scheduledDate || act.executionDate}</span>
              </div>
            {/if}

            {#if teams.length > 0}
              <div class="meta-item teams-tag">
                <Users size={14} />
                <span>Squadre: {teams.join(', ')}</span>
              </div>
            {/if}

            {#if users.length > 0}
              <div class="meta-item users-tag">
                <User size={14} />
                <span>Operatori: {users.join(', ')}</span>
              </div>
            {/if}
          </div>

          <div class="activity-card-footer">
            <span class="type-tag">{act.activityTypeName || act.category || 'Attività'}</span>
            <a href="/dashboard/activities/{act.id}/edit" class="btn-detail-link">
              <span>Modifica / Dettagli</span>
              <ArrowRight size={14} />
            </a>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .place-activities-bridge-tab {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .bridge-header-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: #ffffff;
    border: 1px solid var(--color-neutral-200);
    border-radius: var(--radius-lg);
    padding: 16px 20px;
    box-shadow: var(--shadow-sm);
  }

  .bridge-title {
    font-size: 16px;
    font-weight: 700;
    margin: 0 0 4px 0;
    color: var(--color-neutral-900);
  }

  .bridge-sub {
    font-size: 13px;
    color: var(--color-neutral-500);
    margin: 0;
  }

  .btn-create-activity {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 9px 16px;
    border-radius: 8px;
    background: var(--color-neutral-900, #111827);
    color: #ffffff;
    font-size: 13px;
    font-weight: 600;
    text-decoration: none;
    transition: all 0.2s ease;
  }

  .btn-create-activity:hover {
    background: var(--color-neutral-800, #1f2937);
    transform: translateY(-1px);
  }

  .filter-toolbar {
    display: flex;
    gap: 8px;
  }

  .filter-pill {
    padding: 6px 14px;
    border-radius: 20px;
    border: 1px solid var(--color-neutral-200);
    background: #ffffff;
    font-size: 13px;
    font-weight: 600;
    color: var(--color-neutral-600);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .filter-pill.active {
    background: var(--color-primary-50, #eff6ff);
    border-color: var(--color-primary-500, #3b82f6);
    color: var(--color-primary-700, #1d4ed8);
  }

  .loading-state, .empty-bridge-state {
    text-align: center;
    padding: 40px 20px;
    background: #ffffff;
    border: 1px solid var(--color-neutral-200);
    border-radius: var(--radius-lg);
    color: var(--color-neutral-500);
  }

  .empty-icon {
    color: var(--color-neutral-400);
    margin-bottom: 12px;
  }

  .empty-bridge-state h5 {
    font-size: 16px;
    font-weight: 700;
    margin: 0 0 6px 0;
    color: var(--color-neutral-800);
  }

  .empty-bridge-state p {
    font-size: 13px;
    margin: 0 0 16px 0;
  }

  .activities-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 16px;
  }

  .activity-card {
    background: #ffffff;
    border: 1px solid var(--color-neutral-200);
    border-radius: 12px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    box-shadow: var(--shadow-sm);
    transition: all 0.2s ease;
  }

  .activity-card:hover {
    border-color: var(--color-neutral-300);
    box-shadow: var(--shadow-md);
  }

  .activity-card-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 10px;
  }

  .header-left {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .activity-code {
    font-size: 11px;
    font-weight: 700;
    color: var(--color-neutral-500);
    text-transform: uppercase;
  }

  .activity-title {
    font-size: 14px;
    font-weight: 700;
    margin: 0;
    color: var(--color-neutral-900);
  }

  .status-badge {
    font-size: 11px;
    font-weight: 700;
    padding: 3px 8px;
    border-radius: 6px;
    text-transform: uppercase;
    white-space: nowrap;
  }

  .status-todo { background: #f1f5f9; color: #475569; }
  .status-in-progress { background: #dbeafe; color: #1e40af; }
  .status-completed { background: #dcfce7; color: #166534; }
  .status-cancelled { background: #fee2e2; color: #991b1b; }

  .activity-desc {
    font-size: 13px;
    color: var(--color-neutral-600);
    margin: 0;
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .activity-meta-row {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    font-size: 12px;
    color: var(--color-neutral-600);
    background: var(--color-neutral-50);
    padding: 8px 10px;
    border-radius: 6px;
  }

  .meta-item {
    display: flex;
    align-items: center;
    gap: 5px;
  }

  .activity-card-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 4px;
    padding-top: 10px;
    border-top: 1px solid var(--color-neutral-100);
  }

  .type-tag {
    font-size: 11px;
    font-weight: 600;
    color: var(--color-neutral-500);
    background: var(--color-neutral-100);
    padding: 2px 6px;
    border-radius: 4px;
  }

  .btn-detail-link {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    font-weight: 600;
    color: var(--color-primary-600);
    text-decoration: none;
  }

  .btn-detail-link:hover {
    color: var(--color-primary-800);
  }

  .mt-12 { margin-top: 12px; }
</style>
