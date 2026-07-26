<script lang="ts">
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { ActivitiesService } from '../activities.service';
  import type { ActivityItem, ActivityStatus, ActivityPriority } from '../schema';
  import { CustomFieldsService } from '$lib/services/customFieldsService';
  import type { CustomFieldDefinition } from '$lib/types/customFields';
  import CustomFieldsRenderer from '$lib/components/CustomFieldsRenderer.svelte';
  import { ArrowLeft, Printer, Pencil, Info, SlidersHorizontal, AlertCircle, HardHat } from '@lucide/svelte';

  const activityId = $page.params.id as string;
  let activity = $state<ActivityItem | null>(null);
  let loading = $state(true);
  let customFieldsList = $state<CustomFieldDefinition[]>([]);

  onMount(async () => {
    try {
      const [act, cFields] = await Promise.all([
        ActivitiesService.getActivityById(activityId),
        CustomFieldsService.getFieldsForModule('activities')
      ]);
      activity = act;
      customFieldsList = cFields;
    } catch (e) {
      console.error('Errore caricamento scheda attività:', e);
    } finally {
      loading = false;
    }
  });

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

  function printTask() {
    window.print();
  }
</script>

<svelte:head>
  <title>{activity ? activity.title : 'Dettaglio Attività'} | Gestoray</title>
</svelte:head>

<div class="activity-detail-page animate-fade-in">
  <a href="/dashboard/activities" class="back-link">
    <ArrowLeft size={14} /> Torna alla Gestione Attività
  </a>

  {#if loading}
    <div class="loader-box">
      <span class="spinner"></span>
      Caricamento attività...
    </div>
  {:else if !activity}
    <div class="alert error-box">
      <AlertCircle size={16} /> Scheda attività non trovata o eliminata.
    </div>
  {:else}
    {@const badge = getStatusBadge(activity.status)}
    {@const prio = getPriorityBadge(activity.priority)}

    <!-- HEADER -->
    <header class="detail-header card">
      <div>
        <div class="header-tag">Task N° {activity.activityNumber}</div>
        <h1 class="page-title">{activity.title}</h1>
        <p class="page-subtitle">
          <HardHat size={14} class="subtitle-icon" /> Assegnato a: <strong>{activity.assignedName}</strong>
        </p>
      </div>

      <div class="header-actions">
        <button type="button" class="btn btn-secondary" onclick={printTask}>
          <Printer size={16} /> Stampa Task
        </button>
        <a href="/dashboard/activities/{activityId}/edit" class="btn btn-secondary">
          <Pencil size={16} /> Modifica Attività
        </a>
      </div>
    </header>

    <!-- INFO CARD -->
    <div class="card info-card">
      <h3 class="card-title">
        <Info size={18} /> Dettagli & Stato Lavorazione
      </h3>

      <div class="info-grid">
        <div class="info-row">
          <span class="info-label">Stato Attuale:</span>
          <span class="badge {badge.class}">{badge.label}</span>
        </div>

        <div class="info-row">
          <span class="info-label">Livello Priorità:</span>
          <span class="prio-pill {prio.class}">{prio.label}</span>
        </div>

        <div class="info-row">
          <span class="info-label">Data Scadenza:</span>
          <span class="info-val">{activity.dueDate || 'N.D.'}</span>
        </div>

        <div class="info-row">
          <span class="info-label">Operatore Assegnato:</span>
          <span class="info-val">{activity.assignedName}</span>
        </div>
      </div>

      {#if activity.description}
        <div class="notes-box">
          <strong>Note & Descrizione Operativa:</strong>
          <p>{activity.description}</p>
        </div>
      {/if}
    </div>

    <!-- CUSTOM FIELDS -->
    {#if customFieldsList.length > 0 && activity.customFields}
      <div class="card form-card">
        <h3 class="card-title">
          <SlidersHorizontal size={18} /> Campi Personalizzati
        </h3>
        <CustomFieldsRenderer fields={customFieldsList} values={activity.customFields} readonly={true} />
      </div>
    {/if}
  {/if}
</div>

<style>
  .activity-detail-page { max-width: 800px; margin: 0 auto; padding: 1.5rem; display: flex; flex-direction: column; gap: 1.5rem; }
  .back-link { color: var(--color-neutral-600); text-decoration: none; font-size: 0.85rem; font-weight: 600; display: inline-flex; align-items: center; gap: 6px; }
  .back-link:hover { color: var(--color-primary-600); }

  .detail-header { background: white; border: 1px solid var(--color-neutral-200); border-radius: var(--radius-lg); padding: 1.5rem; display: flex; justify-content: space-between; align-items: center; box-shadow: var(--shadow-sm); }
  .header-tag { font-family: monospace; font-size: 0.85rem; color: var(--color-primary-600); font-weight: 700; }
  .page-title { font-size: 1.6rem; font-weight: 800; margin: 0.2rem 0; color: var(--color-neutral-900); }
  .page-subtitle { font-size: 0.9rem; color: var(--color-neutral-600); margin: 0; display: inline-flex; align-items: center; gap: 6px; }
  :global(.subtitle-icon) { color: var(--color-neutral-500); }

  .header-actions { display: flex; gap: 0.8rem; }

  .card { background: white; border: 1px solid var(--color-neutral-200); border-radius: var(--radius-lg); padding: 1.5rem; box-shadow: var(--shadow-sm); }
  .card-title { font-size: 1.1rem; font-weight: 700; margin: 0 0 1.2rem 0; color: var(--color-neutral-900); border-bottom: 1px solid var(--color-neutral-100); padding-bottom: 0.8rem; display: flex; align-items: center; gap: 8px; }

  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
  @media (max-width: 640px) { .info-grid { grid-template-columns: 1fr; } }

  .info-row { display: flex; justify-content: space-between; align-items: center; padding: 0.6rem 0; border-bottom: 1px dashed var(--color-neutral-200); }
  .info-label { font-size: 0.88rem; color: var(--color-neutral-500); font-weight: 600; }
  .info-val { font-size: 0.92rem; font-weight: 600; color: var(--color-neutral-800); }

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

  .notes-box { margin-top: 1.2rem; background: var(--color-neutral-50); padding: 1rem; border-radius: var(--radius-md); font-size: 0.88rem; border: 1px solid var(--color-neutral-200); }
  .notes-box p { margin: 0.4rem 0 0 0; color: var(--color-neutral-700); line-height: 1.4; }

  .btn { padding: 0.6rem 1.2rem; border-radius: var(--radius-md); font-weight: 600; cursor: pointer; border: none; text-decoration: none; font-size: 0.88rem; display: inline-flex; align-items: center; gap: 6px; }
  .btn-secondary { background: var(--color-neutral-100); color: var(--color-neutral-800); border: 1px solid var(--color-neutral-300); }
  .btn-secondary:hover { background: var(--color-neutral-200); }

  .alert { padding: 0.8rem 1rem; border-radius: var(--radius-md); font-size: 0.88rem; font-weight: 600; display: flex; align-items: center; gap: 8px; }
  .error-box { background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; }
  .loader-box { text-align: center; padding: 3rem; background: white; border-radius: var(--radius-lg); border: 1px solid var(--color-neutral-200); }
</style>
