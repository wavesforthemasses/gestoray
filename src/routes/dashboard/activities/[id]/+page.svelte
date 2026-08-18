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
    CalendarDays, 
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
    CheckCircle2, 
    ArrowUpRight, 
    Plus, 
    Tag 
  } from '@lucide/svelte';

  const activityId = $page.params.id as string;
  let activity = $state<ActivityItem | null>(null);
  let loading = $state(true);
  let customFieldsList = $state<CustomFieldDefinition[]>([]);
  let targetSummary = $state<TargetSummary | null>(null);

  // Attività correlate di contesto
  let relatedData = $state<{
    sameTarget: ActivityItem[];
    sameClient: ActivityItem[];
    sameDayOnTarget: ActivityItem[];
  }>({ sameTarget: [], sameClient: [], sameDayOnTarget: [] });
  let relatedLoading = $state(false);

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

      // Carica attività correlate nel medesimo contesto
      if (activity) {
        relatedLoading = true;
        try {
          const clientId = (targetSummary?.meta?.clientId as string) || activity.clientId;
          relatedData = await ActivitiesService.getRelatedActivities({
            currentActivityId: activityId,
            targetId: activity.targetId,
            targetType: activity.targetType,
            clientId,
            executionDate: activity.executionDate || activity.dueDate,
            tenantId: (activity as any)?.tenantId
          });
        } catch (err) {
          console.warn('[ActivityDetail] Errore caricamento attività correlate:', err);
        } finally {
          relatedLoading = false;
        }
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

  const totalRelatedCount = $derived(
    relatedData.sameTarget.length + relatedData.sameClient.length
  );
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

        <!-- Related Activities & Operational Context Widget -->
        <div class="content-card related-activities-card">
          <div class="card-header-flex">
            <h3 class="card-title">
              <CalendarDays size={18} />
              Attività Correlate & Contesto Operativo
            </h3>

            {#if activity.targetType === 'place' && activity.targetId}
              <a 
                href={NavigationService.buildAddUrl('/dashboard/activities/add', { placeId: activity.targetId, clientId: (targetSummary?.meta?.clientId as string) || activity.clientId }, $page.url.pathname)} 
                class="btn-sm-action"
                title="Pianifica un'altra attività per questo luogo"
              >
                <Plus size={14} />
                <span>Nuova per questo Luogo</span>
              </a>
            {/if}
          </div>

          {#if relatedLoading}
            <div class="related-loading">
              <span class="spinner-sm"></span>
              Ricerca attività correlate in corso...
            </div>
          {:else if totalRelatedCount === 0}
            <div class="empty-related-box">
              <Calendar size={28} class="empty-icon" />
              <p>Nessun'altra attività pianificata per questo contesto.</p>
              {#if activity.targetType === 'place' && activity.targetId}
                <a 
                  href={NavigationService.buildAddUrl('/dashboard/activities/add', { placeId: activity.targetId, clientId: (targetSummary?.meta?.clientId as string) || activity.clientId }, $page.url.pathname)} 
                  class="btn-create-contextual"
                >
                  <Plus size={14} />
                  <span>Pianifica nuova attività</span>
                </a>
              {/if}
            </div>
          {:else}
            <div class="related-sections">
              <!-- Stesso Giorno Alert/Highlight -->
              {#if relatedData.sameDayOnTarget.length > 0}
                <div class="same-day-banner">
                  <div class="banner-header">
                    <Clock size={16} class="banner-icon" />
                    <strong>Attività previste nello stesso giorno ({relatedData.sameDayOnTarget.length})</strong>
                  </div>
                  <div class="related-items-list">
                    {#each relatedData.sameDayOnTarget as item}
                      {@const itemBadge = getStatusBadge(item.status)}
                      <a 
                        href={NavigationService.preserveParams(`/dashboard/activities/${item.id}`, $page.url.searchParams)} 
                        class="related-item-row"
                      >
                        <div class="item-title-box">
                          <span class="item-title">{item.title}</span>
                          <span class="item-meta-sub">
                            {item.activityTypeName || 'Attività'}
                            {#if item.assignedName} • {item.assignedName}{/if}
                          </span>
                        </div>
                        <div class="item-right-box">
                          <span class="status-badge-sm {itemBadge.class}">{itemBadge.label}</span>
                          <ArrowUpRight size={14} class="item-link-arrow" />
                        </div>
                      </a>
                    {/each}
                  </div>
                </div>
              {/if}

              <!-- Altre attività per questo Luogo / Target -->
              {#if relatedData.sameTarget.length > 0}
                <div class="related-group">
                  <div class="group-title">
                    <Target size={14} />
                    <span>Cronologia {activity.targetType === 'place' ? 'Luogo / Cantiere' : 'Bersaglio'} ({relatedData.sameTarget.length})</span>
                  </div>
                  <div class="related-items-list">
                    {#each relatedData.sameTarget as item}
                      {@const itemBadge = getStatusBadge(item.status)}
                      <a 
                        href={NavigationService.preserveParams(`/dashboard/activities/${item.id}`, $page.url.searchParams)} 
                        class="related-item-row"
                      >
                        <div class="item-title-box">
                          <span class="item-title">{item.title}</span>
                          <span class="item-meta-sub">
                            {#if item.executionDate}Data: {item.executionDate}{/if}
                            {#if item.activityTypeName} • {item.activityTypeName}{/if}
                            {#if item.assignedName} • {item.assignedName}{/if}
                          </span>
                        </div>
                        <div class="item-right-box">
                          <span class="status-badge-sm {itemBadge.class}">{itemBadge.label}</span>
                          <ArrowUpRight size={14} class="item-link-arrow" />
                        </div>
                      </a>
                    {/each}
                  </div>
                </div>
              {/if}

              <!-- Altre attività per questo Cliente -->
              {#if relatedData.sameClient.length > 0}
                <div class="related-group">
                  <div class="group-title">
                    <Building2 size={14} />
                    <span>Altre attività per questo Cliente ({relatedData.sameClient.length})</span>
                  </div>
                  <div class="related-items-list">
                    {#each relatedData.sameClient as item}
                      {@const itemBadge = getStatusBadge(item.status)}
                      <a 
                        href={NavigationService.preserveParams(`/dashboard/activities/${item.id}`, $page.url.searchParams)} 
                        class="related-item-row"
                      >
                        <div class="item-title-box">
                          <span class="item-title">{item.title}</span>
                          <span class="item-meta-sub">
                            {#if item.targetName}Luogo: {item.targetName} • {/if}
                            {#if item.executionDate}Data: {item.executionDate}{/if}
                          </span>
                        </div>
                        <div class="item-right-box">
                          <span class="status-badge-sm {itemBadge.class}">{itemBadge.label}</span>
                          <ArrowUpRight size={14} class="item-link-arrow" />
                        </div>
                      </a>
                    {/each}
                  </div>
                </div>
              {/if}
            </div>
          {/if}
        </div>
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
                {#if targetSummary?.url}
                  <a 
                    href={NavigationService.preserveParams(targetSummary.url, $page.url.searchParams)} 
                    class="target-name target-link"
                    title="Apri scheda {targetSummary.name || activity.targetName}"
                  >
                    <span>{targetSummary.name || activity.targetName}</span>
                    <ArrowUpRight size={15} class="link-icon" />
                  </a>
                {:else}
                  <span class="target-name">{targetSummary?.name || activity.targetName}</span>
                  {#if targetSummary?.isModuleDisabled}
                    <span class="module-disabled-badge">Modulo non attivo</span>
                  {/if}
                {/if}
                <span class="target-type-badge">{activity.targetType}</span>
              </div>

              <div class="target-details">
                <!-- Cliente Collegato se presente -->
                {#if (targetSummary?.meta?.clientId || activity.clientId) && activity.targetType !== 'client'}
                  <div class="target-row linked-client-row">
                    <Building2 size={14} class="row-icon" />
                    <span class="client-label">Cliente:</span>
                    <a 
                      href={NavigationService.preserveParams(`/dashboard/clients/${targetSummary?.meta?.clientId || activity.clientId}`, $page.url.searchParams)}
                      class="client-link"
                      title="Vai alla scheda del cliente"
                    >
                      <span>{targetSummary?.meta?.clientName || activity.clientName || 'Scheda Cliente'}</span>
                      <ArrowUpRight size={13} class="link-icon" />
                    </a>
                  </div>
                {/if}

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
                {@const isUser = entity.type === 'user' || entity.entityType === 'user'}
                {@const entityId = entity.id || entity.entityId}
                <div class="resource-item">
                  <div class="resource-name-box">
                    {#if isUser}
                      <UserCheck size={16} class="res-icon user" />
                    {:else if entity.type === 'team' || entity.entityType === 'team'}
                      <Users size={16} class="res-icon team" />
                    {:else if entity.type === 'vehicle' || entity.entityType === 'vehicle'}
                      <Truck size={16} class="res-icon vehicle" />
                    {:else}
                      <HardHat size={16} class="res-icon default" />
                    {/if}

                    {#if isUser && entityId}
                      <a 
                        href={NavigationService.preserveParams(`/dashboard/users/${entityId}`, $page.url.searchParams)}
                        class="resource-link"
                        title="Apri scheda utente"
                      >
                        <span>{entity.name || entity.entityName}</span>
                        <ArrowUpRight size={12} class="link-icon" />
                      </a>
                    {:else}
                      <span class="res-name">{entity.name || entity.entityName}</span>
                    {/if}
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
    padding-bottom: 48px;
  }

  /* Header */
  .page-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
    background: var(--color-surface, #ffffff);
    padding: 16px 20px;
    border-radius: var(--radius-lg, 12px);
    border: 1px solid var(--color-neutral-200, #e2e8f0);
    box-shadow: var(--shadow-sm, 0 1px 2px 0 rgba(0, 0, 0, 0.05));
  }

  .header-title-box {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .btn-back-context {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 38px;
    height: 38px;
    border-radius: var(--radius-md, 8px);
    border: 1px solid var(--color-neutral-200, #e2e8f0);
    background: var(--color-surface, #ffffff);
    color: var(--color-neutral-600, #475569);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-back-context:hover {
    background: var(--color-neutral-100, #f1f5f9);
    color: var(--color-neutral-900, #0f172a);
    border-color: var(--color-neutral-300, #cbd5e1);
  }

  .page-main-title {
    font-size: 20px;
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
    padding: 8px 14px;
    border-radius: var(--radius-md, 8px);
    border: 1px solid var(--color-neutral-200, #e2e8f0);
    background: var(--color-surface, #ffffff);
    color: var(--color-neutral-700, #334155);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-action-outline:hover {
    background: var(--color-neutral-50, #f8fafc);
    border-color: var(--color-neutral-300, #cbd5e1);
  }

  .btn-action-primary {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    border-radius: var(--radius-md, 8px);
    background: var(--color-primary-600, #2563eb);
    color: #ffffff;
    font-size: 13px;
    font-weight: 600;
    text-decoration: none;
    transition: all 0.15s ease;
  }

  .btn-action-primary:hover {
    background: var(--color-primary-700, #1d4ed8);
  }

  /* Grid Layout */
  .detail-grid {
    display: grid;
    grid-template-columns: 2fr 1.1fr;
    gap: 24px;
    align-items: start;
  }

  @media (max-width: 1024px) {
    .detail-grid {
      grid-template-columns: 1fr;
    }
  }

  .main-column, .sidebar-column {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  /* Cards */
  .content-card {
    background: var(--color-surface, #ffffff);
    border: 1px solid var(--color-neutral-200, #e2e8f0);
    border-radius: var(--radius-lg, 12px);
    padding: 20px;
    box-shadow: var(--shadow-sm, 0 1px 2px 0 rgba(0, 0, 0, 0.05));
  }

  .card-header-flex {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 16px;
  }

  .card-title {
    font-size: 15px;
    font-weight: 700;
    color: var(--color-neutral-800, #1e293b);
    margin: 0 0 16px 0;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .card-header-flex .card-title {
    margin: 0;
  }

  .btn-sm-action {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 5px 10px;
    border-radius: var(--radius-md, 6px);
    font-size: 12px;
    font-weight: 600;
    color: var(--color-primary-700, #1d4ed8);
    background: var(--color-primary-50, #eff6ff);
    border: 1px solid var(--color-primary-200, #bfdbfe);
    text-decoration: none;
    transition: all 0.15s ease;
  }

  .btn-sm-action:hover {
    background: var(--color-primary-100, #dbeafe);
    border-color: var(--color-primary-300, #93c5fd);
  }

  /* Info Grid */
  .info-grid-3 {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
  }

  @media (max-width: 768px) {
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
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-neutral-400, #94a3b8);
  }

  .info-value {
    font-size: 14px;
    color: var(--color-neutral-800, #1e293b);
  }

  .info-value.font-semibold {
    font-weight: 600;
  }

  .flex-val {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .val-icon {
    color: var(--color-neutral-400, #94a3b8);
  }

  /* Badges */
  .status-badge {
    display: inline-block;
    padding: 3px 10px;
    border-radius: 9999px;
    font-size: 12px;
    font-weight: 600;
  }

  .status-badge-sm {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 9999px;
    font-size: 11px;
    font-weight: 600;
  }

  .status-completed { background: #dcfce7; color: #166534; }
  .status-in-progress { background: #dbeafe; color: #1e40af; }
  .status-todo { background: #fef3c7; color: #92400e; }
  .status-cancelled { background: #fee2e2; color: #991b1b; }

  .priority-badge {
    display: inline-block;
    padding: 3px 10px;
    border-radius: 9999px;
    font-size: 12px;
    font-weight: 600;
  }

  .priority-urgent { background: #fee2e2; color: #b91c1c; font-weight: 700; }
  .priority-high { background: #ffedd5; color: #c2410c; }
  .priority-medium { background: #f1f5f9; color: #475569; }
  .priority-low { background: #f8fafc; color: #94a3b8; }

  /* Notes */
  .notes-box {
    margin-top: 16px;
    padding: 14px;
    background: var(--color-neutral-50, #f8fafc);
    border-radius: var(--radius-md, 8px);
    border: 1px solid var(--color-neutral-200, #e2e8f0);
  }

  .notes-title {
    font-size: 12px;
    font-weight: 700;
    color: var(--color-neutral-700, #334155);
    display: block;
    margin-bottom: 6px;
  }

  .notes-content {
    font-size: 13px;
    line-height: 1.5;
    color: var(--color-neutral-800, #1e293b);
    margin: 0;
    white-space: pre-line;
  }

  /* Target Info Box & Dynamic Links */
  .target-info-box {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .target-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    border-bottom: 1px solid var(--color-neutral-100, #f1f5f9);
    padding-bottom: 10px;
  }

  .target-name {
    font-size: 15px;
    font-weight: 700;
    color: var(--color-neutral-900, #0f172a);
  }

  .target-link {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: var(--color-primary-600, #2563eb);
    text-decoration: none;
    transition: color 0.15s ease;
  }

  .target-link:hover {
    color: var(--color-primary-700, #1d4ed8);
    text-decoration: underline;
  }

  .link-icon {
    color: var(--color-primary-500, #3b82f6);
    flex-shrink: 0;
  }

  .module-disabled-badge {
    font-size: 11px;
    padding: 2px 6px;
    border-radius: 4px;
    background: var(--color-neutral-100, #f1f5f9);
    color: var(--color-neutral-500, #64748b);
    font-weight: 500;
  }

  .target-type-badge {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    padding: 3px 8px;
    border-radius: 6px;
    background: var(--color-primary-50, #eff6ff);
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

  .linked-client-row {
    background: var(--color-neutral-50, #f8fafc);
    padding: 6px 10px;
    border-radius: var(--radius-md, 6px);
    border: 1px solid var(--color-neutral-200, #e2e8f0);
  }

  .client-label {
    font-weight: 600;
    color: var(--color-neutral-500, #64748b);
    font-size: 12px;
  }

  .client-link {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: var(--color-primary-600, #2563eb);
    font-weight: 600;
    text-decoration: none;
    font-size: 13px;
  }

  .client-link:hover {
    color: var(--color-primary-700, #1d4ed8);
    text-decoration: underline;
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

  .resource-link {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: var(--color-neutral-800, #1e293b);
    text-decoration: none;
    transition: color 0.15s ease;
  }

  .resource-link:hover {
    color: var(--color-primary-600, #2563eb);
    text-decoration: underline;
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

  /* Related Activities Section */
  .related-activities-card {
    border-color: var(--color-neutral-200, #e2e8f0);
  }

  .related-loading {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 13px;
    color: var(--color-neutral-500, #64748b);
    padding: 16px 0;
  }

  .spinner-sm {
    width: 16px;
    height: 16px;
    border: 2px solid var(--color-neutral-300, #cbd5e1);
    border-top-color: var(--color-primary-600, #2563eb);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  .empty-related-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 24px;
    background: var(--color-neutral-50, #f8fafc);
    border-radius: var(--radius-md, 8px);
    border: 1px dashed var(--color-neutral-300, #cbd5e1);
    text-align: center;
    color: var(--color-neutral-500, #64748b);
    font-size: 13px;
  }

  .empty-related-box p {
    margin: 0;
  }

  .btn-create-contextual {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border-radius: var(--radius-md, 6px);
    background: var(--color-primary-600, #2563eb);
    color: #ffffff;
    font-size: 12px;
    font-weight: 600;
    text-decoration: none;
    transition: background 0.15s ease;
  }

  .btn-create-contextual:hover {
    background: var(--color-primary-700, #1d4ed8);
  }

  .related-sections {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .same-day-banner {
    background: #f0fdf4;
    border: 1px solid #bbf7d0;
    border-radius: var(--radius-md, 8px);
    padding: 12px;
  }

  .banner-header {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: #166534;
    margin-bottom: 10px;
  }

  .banner-icon {
    color: #15803d;
  }

  .related-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .group-title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--color-neutral-600, #475569);
  }

  .related-items-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .related-item-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 12px;
    background: var(--color-surface, #ffffff);
    border: 1px solid var(--color-neutral-200, #e2e8f0);
    border-radius: var(--radius-md, 8px);
    text-decoration: none;
    transition: all 0.15s ease;
  }

  .related-item-row:hover {
    border-color: var(--color-primary-300, #93c5fd);
    background: var(--color-primary-50, #eff6ff);
    transform: translateY(-1px);
    box-shadow: var(--shadow-sm, 0 1px 2px 0 rgba(0, 0, 0, 0.05));
  }

  .item-title-box {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .item-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--color-neutral-900, #0f172a);
  }

  .item-meta-sub {
    font-size: 11px;
    color: var(--color-neutral-500, #64748b);
  }

  .item-right-box {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  .item-link-arrow {
    color: var(--color-neutral-400, #94a3b8);
    transition: color 0.15s ease;
  }

  .related-item-row:hover .item-link-arrow {
    color: var(--color-primary-600, #2563eb);
  }

  /* Common Loaders & Errors */
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
