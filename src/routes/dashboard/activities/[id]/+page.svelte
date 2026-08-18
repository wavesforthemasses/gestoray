<script lang="ts">
  import { projectStore } from '$lib/stores/project';
  import { page } from '$app/stores';
  import { NavigationService } from '$lib/services/navigationService';
  import { onMount } from 'svelte';
  import { ActivitiesService } from '../activities.service';
  import type { ActivityItem, ActivityStatus, ActivityPriority } from '../schema';
  import { CustomFieldsService } from '$lib/services/customFieldsService';
  import type { CustomFieldDefinition } from '$lib/types/customFields';
  import CustomFieldsRenderer from '$lib/components/CustomFieldsRenderer.svelte';
  import { ActivitiesBridgeOrchestrator } from '../activities.orchestrator';
  import type { TargetSummary } from '$lib/types/moduleActivitiesBridge';
  import { 
    ArrowLeft, 
    Printer, 
    Pencil, 
    Info, 
    SlidersHorizontal, 
    AlertCircle, 
    HardHat,
    Calendar, 
    Clock, 
    Target, 
    UserCheck, 
    Building2, 
    Users, 
    MapPin, 
    Truck, 
    FileText, 
    Phone, 
    Mail, 
    CheckCircle2 
  } from '@lucide/svelte';

  const activityId = $page.params.id as string;
  let activity = $state<ActivityItem | null>(null);
  let loading = $state(true);
  let customFieldsList = $state<CustomFieldDefinition[]>([]);
  let targetSummary = $state<TargetSummary | null>(null);

  onMount(async () => {
    try {
      const [act, cFields] = await Promise.all([
        ActivitiesService.getActivityById(activityId),
        CustomFieldsService.getFieldsForModule('activities')
      ]);
      activity = act;
      customFieldsList = cFields;

      if (activity?.targetType && activity?.targetId) {
        targetSummary = await ActivitiesBridgeOrchestrator.resolveTargetSummary(
          activity.targetType,
          activity.targetId,
          activity.targetName,
          undefined,
          ['places', 'vehicles', 'contracts']
        );
      }
    } catch (e) {
      console.error('Errore caricamento scheda attività:', e);
    } finally {
      loading = false;
    }
  });

  function getStatusBadge(status: ActivityStatus) {
    switch (status) {
      case 'completata':
      case 'completato': return { label: 'Completata', class: 'status-completed' };
      case 'in_corso': return { label: 'In Corso', class: 'status-in-progress' };
      case 'da_fare': return { label: 'Da Fare', class: 'status-todo' };
      case 'annullata':
      case 'annullato': return { label: 'Annullata', class: 'status-cancelled' };
      default: return { label: status, class: 'status-todo' };
    }
  }

  function getPriorityBadge(priority: ActivityPriority) {
    switch (priority) {
      case 'urgente': return { label: 'Urgente', class: 'priority-urgent' };
      case 'alta': return { label: 'Alta', class: 'priority-high' };
      case 'media': return { label: 'Media', class: 'priority-medium' };
      case 'bassa': return { label: 'Bassa', class: 'priority-low' };
      default: return { label: priority, class: 'priority-medium' };
    }
  }

  function printTask() {
    window.print();
  }
</script>

<svelte:head>
  <title>{activity ? activity.title : 'Dettaglio Attività'} | {$projectStore?.projectName || 'ERP'}</title>
</svelte:head>

<div class="detail-activity-page animate-fade-in">
  <!-- Top Navigation / Header -->
  <header class="page-header">
    <div class="header-title-box">
      <button 
        type="button" 
        class="btn-back btn-back-context" 
        onclick={() => NavigationService.navigateBack($page.url.searchParams, '/dashboard/activities')}
        title={NavigationService.getBackLabel($page.url.searchParams, 'Torna alla lista attività')}
      >
        <ArrowLeft size={20} />
      </button>
      <div>
        <h1 class="page-main-title">
          {activity ? activity.title : 'Dettaglio Attività'}
        </h1>
        <p class="page-main-subtitle">
          Task N° {activity?.activityNumber || activityId} • Creato il {activity?.createdAt ? new Date(activity.createdAt).toLocaleDateString() : 'N.D.'}
        </p>
      </div>
    </div>

    <div class="header-actions">
      <button type="button" class="btn-action-outline" onclick={printTask}>
        <Printer size={16} />
        <span>Stampa</span>
      </button>
      <a href={NavigationService.preserveParams(`/dashboard/activities/${activityId}/edit`, $page.url.searchParams)} class="btn-action-primary">
        <Pencil size={16} />
        <span>Modifica</span>
      </a>
    </div>
  </header>

  {#if loading}
    <div class="loader-box">
      <span class="spinner"></span>
      Caricamento scheda in corso...
    </div>
  {:else if !activity}
    <div class="alert error-box">
      <AlertCircle size={18} />
      <span>Scheda attività non trovata o eliminata.</span>
    </div>
  {:else}
    {@const badge = getStatusBadge(activity.status)}
    {@const prio = getPriorityBadge(activity.priority)}

    <div class="detail-grid">
      <!-- Main Content Column -->
      <div class="main-column">
        <!-- Status & Operations Card -->
        <div class="content-card">
          <h3 class="card-title">
            <Info size={18} />
            Dati Operativi & Stato
          </h3>

          <div class="info-grid-3">
            <div class="info-item">
              <span class="info-label">Stato Attuale</span>
              <div><span class="status-badge {badge.class}">{badge.label}</span></div>
            </div>

            <div class="info-item">
              <span class="info-label">Priorità</span>
              <div><span class="priority-badge {prio.class}">{prio.label}</span></div>
            </div>

            <div class="info-item">
              <span class="info-label">Tipo Attività</span>
              <div class="info-value font-semibold">{activity.activityTypeName || 'Generica'}</div>
            </div>

            <div class="info-item">
              <span class="info-label">Data Esecuzione</span>
              <div class="info-value">{activity.executionDate || 'N.D.'}</div>
            </div>

            <div class="info-item">
              <span class="info-label">Scadenza (Due Date)</span>
              <div class="info-value">{activity.dueDate || 'Nessuna'}</div>
            </div>

            {#if activity.durationMinutes}
              <div class="info-item">
                <span class="info-label">Durata Prevista</span>
                <div class="info-value flex-val"><Clock size={14} class="val-icon" /> {activity.durationMinutes} minuti</div>
              </div>
            {/if}

            <div class="info-item">
              <span class="info-label">Operatore Responsabile</span>
              <div class="info-value font-semibold">{activity.assignedName || 'Non assegnato'}</div>
            </div>
          </div>

          {#if activity.description}
            <div class="notes-box">
              <span class="notes-title">Note & Istruzioni Operative</span>
              <p class="notes-content">{activity.description}</p>
            </div>
          {/if}
        </div>

        <!-- Custom Fields Card -->
        {#if customFieldsList.length > 0 && activity.customFields}
          <div class="content-card">
            <h3 class="card-title">
              <SlidersHorizontal size={18} />
              Campi Personalizzati
            </h3>
            <CustomFieldsRenderer definitions={customFieldsList} values={activity.customFields} readonly={true} />
          </div>
        {/if}
      </div>

      <!-- Sidebar Column -->
      <div class="sidebar-column">
        <!-- Target Summary Card -->
        <div class="content-card">
          <h3 class="card-title">
            <Target size={18} />
            Entità Bersaglio
          </h3>

          {#if activity.targetType && (activity.targetName || targetSummary)}
            <div class="target-info-box">
              <div class="target-header">
                <span class="target-name">{targetSummary?.name || activity.targetName}</span>
                <span class="target-type-badge">{activity.targetType}</span>
              </div>

              <div class="target-details">
                {#if targetSummary?.phone}
                  <div class="target-row">
                    <Phone size={14} class="row-icon" />
                    <span>{targetSummary.phone}</span>
                  </div>
                {/if}
                {#if targetSummary?.email}
                  <div class="target-row">
                    <Mail size={14} class="row-icon" />
                    <span>{targetSummary.email}</span>
                  </div>
                {/if}
                {#if targetSummary?.address}
                  <div class="target-row">
                    <MapPin size={14} class="row-icon" />
                    <span>{targetSummary.address}</span>
                  </div>
                {/if}
                {#if activity.targetSubtext && !targetSummary?.address && !targetSummary?.phone}
                  <div class="target-subtext">{activity.targetSubtext}</div>
                {/if}
              </div>
            </div>
          {:else}
            <div class="empty-target">
              Nessuna entità bersaglio associata a questa attività.
            </div>
          {/if}
        </div>

        <!-- Assigned Resources Card -->
        {#if Array.isArray(activity.assignedEntities) && activity.assignedEntities.length > 0}
          <div class="content-card">
            <h3 class="card-title">
              <Users size={18} />
              Risorse Assegnate
            </h3>
            <div class="resources-list">
              {#each activity.assignedEntities as entity}
                <div class="resource-item">
                  <div class="resource-name-box">
                    {#if entity.type === 'user'}
                      <UserCheck size={16} class="res-icon user" />
                    {:else if entity.type === 'team'}
                      <Users size={16} class="res-icon team" />
                    {:else if entity.type === 'vehicle'}
                      <Truck size={16} class="res-icon vehicle" />
                    {:else}
                      <HardHat size={16} class="res-icon default" />
                    {/if}
                    <span class="res-name">{entity.name || entity.entityName}</span>
                  </div>
                  <span class="res-badge">{entity.type || entity.entityType}</span>
                </div>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .detail-activity-page {
    width: 100%;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 24px;
    padding-bottom: 32px;
  }

  .page-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
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

  .header-actions {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .btn-action-outline {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    border-radius: var(--radius-md, 8px);
    background: var(--color-white, #ffffff);
    border: 1px solid var(--color-neutral-300, #cbd5e1);
    color: var(--color-neutral-700, #334155);
    font-size: 13.5px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
    text-decoration: none;
  }

  .btn-action-outline:hover {
    background: var(--color-neutral-100, #f1f5f9);
  }

  .btn-action-primary {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 18px;
    border-radius: var(--radius-md, 8px);
    background: var(--color-primary-600, #2563eb);
    border: none;
    color: white;
    font-size: 13.5px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s ease;
    text-decoration: none;
  }

  .btn-action-primary:hover {
    background: var(--color-primary-700, #1d4ed8);
  }

  /* Grid Layout */
  .detail-grid {
    display: grid;
    grid-template-columns: 2fr 1fr;
    gap: 24px;
  }

  @media (max-width: 900px) {
    .detail-grid {
      grid-template-columns: 1fr;
    }
  }

  .main-column, .sidebar-column {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .content-card {
    background: var(--color-white, #ffffff);
    border: 1px solid var(--color-neutral-200, #e2e8f0);
    border-radius: var(--radius-lg, 12px);
    padding: 24px;
    display: flex;
    flex-direction: column;
    box-shadow: var(--shadow-sm, 0 1px 2px 0 rgba(0, 0, 0, 0.05));
  }

  .card-title {
    font-size: 16px;
    font-weight: 700;
    color: var(--color-neutral-800, #1e293b);
    margin: 0 0 16px 0;
    display: flex;
    align-items: center;
    gap: 8px;
    border-bottom: 1px solid var(--color-neutral-200, #e2e8f0);
    padding-bottom: 12px;
  }

  .info-grid-3 {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 16px;
  }

  @media (max-width: 600px) {
    .info-grid-3 {
      grid-template-columns: 1fr 1fr;
    }
  }

  .info-item {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .info-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--color-neutral-500, #64748b);
  }

  .info-value {
    font-size: 14px;
    color: var(--color-neutral-900, #0f172a);
  }

  .font-semibold {
    font-weight: 600;
  }

  .flex-val {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .val-icon {
    color: var(--color-primary-600, #2563eb);
  }

  /* Badges */
  .status-badge, .priority-badge {
    display: inline-block;
    padding: 3px 10px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
  }

  .status-completed { background: #dcfce7; color: #15803d; }
  .status-in-progress { background: #e0f2fe; color: #0369a1; }
  .status-todo { background: #fef3c7; color: #b45309; }
  .status-cancelled { background: #f1f5f9; color: #64748b; }

  .priority-urgent { background: #fee2e2; color: #b91c1c; font-weight: 700; }
  .priority-high { background: #ffedd5; color: #c2410c; }
  .priority-medium { background: #e0e7ff; color: #4338ca; }
  .priority-low { background: #f1f5f9; color: #64748b; }

  /* Notes */
  .notes-box {
    margin-top: 20px;
    padding: 16px;
    background: var(--color-neutral-50, #f8fafc);
    border: 1px solid var(--color-neutral-200, #e2e8f0);
    border-radius: var(--radius-md, 8px);
  }

  .notes-title {
    display: block;
    font-size: 12.5px;
    font-weight: 700;
    color: var(--color-neutral-700, #334155);
    margin-bottom: 6px;
  }

  .notes-content {
    font-size: 13.5px;
    color: var(--color-neutral-800, #1e293b);
    line-height: 1.5;
    margin: 0;
    white-space: pre-wrap;
  }

  /* Target info */
  .target-info-box {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .target-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .target-name {
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

  .target-details {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .target-row {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: var(--color-neutral-600, #475569);
  }

  .row-icon {
    color: var(--color-primary-500, #3b82f6);
    flex-shrink: 0;
  }

  .target-subtext {
    font-size: 12px;
    color: var(--color-neutral-500, #64748b);
  }

  .empty-target {
    font-size: 13px;
    color: var(--color-neutral-400, #94a3b8);
    font-style: italic;
    padding: 8px 0;
  }

  /* Resources */
  .resources-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .resource-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 10px;
    background: var(--color-neutral-50, #f8fafc);
    border-radius: var(--radius-md, 8px);
    border: 1px solid var(--color-neutral-200, #e2e8f0);
  }

  .resource-name-box {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    font-weight: 600;
    color: var(--color-neutral-800, #1e293b);
  }

  .res-icon.user { color: var(--color-primary-600, #2563eb); }
  .res-icon.team { color: #8b5cf6; }
  .res-icon.vehicle { color: #0ea5e9; }
  .res-icon.default { color: #64748b; }

  .res-badge {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    padding: 2px 6px;
    border-radius: 4px;
    background: var(--color-neutral-200, #e2e8f0);
    color: var(--color-neutral-700, #334155);
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
