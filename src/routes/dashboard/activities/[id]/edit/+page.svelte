<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { ActivitiesService } from '../../activities.service';
  import type { ActivityItem, ActivityPriority, ActivityStatus } from '../../schema';
  import { CustomFieldsService } from '$lib/services/customFieldsService';
  import { CacheLookupService } from '$lib/services/cacheLookupService';
  import type { CustomFieldDefinition, CustomFieldValues } from '$lib/types/customFields';
  import CustomFieldsRenderer from '$lib/components/CustomFieldsRenderer.svelte';
  import Autocomplete from '$lib/components/Autocomplete.svelte';
  import { toast } from '$lib/stores/toast.svelte';

  let activityId = $derived(page.params.id);
  let activity = $state<ActivityItem | null>(null);

  let users = $state<{ id: string; name: string }[]>([]);
  let customFieldsList = $state<CustomFieldDefinition[]>([]);
  let customFieldsValues = $state<CustomFieldValues>({});

  let loading = $state(true);
  let saving = $state(false);
  let errorMsg = $state('');

  // Form State
  let activityNumber = $state('');
  let title = $state('');
  let assignedUid = $state('');
  let dueDate = $state('');
  let priority = $state<ActivityPriority>('media');
  let status = $state<ActivityStatus>('da_fare');
  let description = $state('');

  onMount(async () => {
    try {
      customFieldsList = await CustomFieldsService.getFieldsForModule('activities');
      users = await CacheLookupService.getLookup('users');

      if (activityId) {
        activity = await ActivitiesService.getActivityById(activityId);
        if (activity) {
          activityNumber = activity.activityNumber || '';
          title = activity.title || '';
          assignedUid = activity.assignedUid || '';
          dueDate = activity.dueDate || '';
          priority = activity.priority || 'media';
          status = activity.status || 'da_fare';
          description = activity.description || '';
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
      const selectedUser = users.find(u => u.id === assignedUid);

      await ActivitiesService.updateActivity(activityId, {
        activityNumber: activityNumber.trim(),
        title: title.trim(),
        assignedUid,
        assignedName: selectedUser ? selectedUser.name : (activity?.assignedName || ''),
        dueDate,
        priority,
        status,
        description: description.trim(),
        customFields: customFieldsValues
      });

      toast.success('Attività aggiornata con successo!');
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
  <title>Modifica Attività | Gestoray</title>
</svelte:head>

<div class="add-activity-page animate-fade-in">
  <div class="page-top">
    <a href="/dashboard/activities/{activityId}" class="back-link">← Torna al Dettaglio Attività</a>
    <h2>✏️ Modifica Attività Operativa</h2>
  </div>

  {#if loading}
    <div class="loader-box">
      <span class="spinner"></span>
      Caricamento in corso...
    </div>
  {:else if !activity}
    <div class="alert error-box">⚠️ Attività non trovata o eliminata.</div>
  {:else}
    {#if errorMsg}
      <div class="alert error-box">⚠️ {errorMsg}</div>
    {/if}

    <form onsubmit={handleSubmit} class="activity-form">
      <!-- 1. DETTAGLI TASK -->
      <div class="card form-card">
        <div class="card-header">
          <h3 class="card-title">ℹ️ Informazioni Task</h3>
          <p class="card-subtitle">Titolo del task ed utente/operatore assegnato.</p>
        </div>

        <div class="grid-2 mb-16">
          <div class="form-group">
            <label for="act-num">N° Task *</label>
            <input id="act-num" type="text" bind:value={activityNumber} required class="form-control" />
          </div>

          <div class="form-group">
            <label for="user-select">Assegnato ad Utente *</label>
            <Autocomplete 
              options={users.map(u => ({ id: u.id, label: u.name }))} 
              bind:value={assignedUid} 
              placeholder="🔍 Cerca operatore/utente..."
            />
          </div>
        </div>

        <div class="form-group mb-16">
          <label for="act-title">Titolo Attività *</label>
          <input id="act-title" type="text" bind:value={title} placeholder="es. Manutenzione Preventiva Centralina Termica Sede" required class="form-control" />
        </div>

        <div class="grid-3 mb-16">
          <div class="form-group">
            <label for="act-due">Data Scadenza *</label>
            <input id="act-due" type="date" bind:value={dueDate} required class="form-control" />
          </div>

          <div class="form-group">
            <label for="act-prio">Priorità</label>
            <select id="act-prio" bind:value={priority} class="form-control">
              <option value="bassa">🟢 Bassa</option>
              <option value="media">🔹 Media</option>
              <option value="alta">⚠️ Alta</option>
              <option value="urgente">🔥 Urgente</option>
            </select>
          </div>

          <div class="form-group">
            <label for="act-status">Stato Attività</label>
            <select id="act-status" bind:value={status} class="form-control">
              <option value="da_fare">📌 Da Fare</option>
              <option value="in_corso">🔄 In Corso</option>
              <option value="completato">✅ Completato</option>
              <option value="annullato">🚫 Annullato</option>
            </select>
          </div>
        </div>

        <div class="form-group">
          <label for="act-desc">Descrizione Estesa & Note Operative</label>
          <textarea id="act-desc" bind:value={description} rows="3" placeholder="Istruzioni per l'assegnatario, note operative..." class="form-control"></textarea>
        </div>
      </div>

      <!-- 2. CAMPI PERSONALIZZATI -->
      {#if customFieldsList.length > 0}
        <div class="card form-card">
          <div class="card-header">
            <h3 class="card-title">🧩 Campi Personalizzati</h3>
          </div>
          <CustomFieldsRenderer fields={customFieldsList} bind:values={customFieldsValues} />
        </div>
      {/if}

      <!-- FORM ACTIONS -->
      <div class="form-actions-bar">
        <a href="/dashboard/activities/{activityId}" class="btn-cancel">Annulla</a>
        <button type="submit" class="btn-submit" disabled={saving}>
          {saving ? 'Salvataggio...' : '💾 Aggiorna Attività'}
        </button>
      </div>
    </form>
  {/if}
</div>

<style>
  .add-activity-page { max-width: 900px; margin: 0 auto; padding: 24px 16px; }
  .page-top { margin-bottom: 20px; }
  .back-link { color: var(--color-neutral-600); text-decoration: none; font-size: 13px; font-weight: 600; }
  .back-link:hover { color: var(--color-primary-600); }
  .page-top h2 { margin: 6px 0 0 0; font-size: 22px; font-weight: 700; color: var(--color-neutral-900); }

  .form-card { background: white; border: 1px solid var(--color-neutral-200); border-radius: var(--radius-lg); padding: 24px; margin-bottom: 24px; box-shadow: var(--shadow-sm); }
  .card-title { margin: 0 0 4px 0; font-size: 16px; font-weight: 600; color: var(--color-neutral-800); }
  .card-subtitle { margin: 0 0 16px 0; font-size: 13px; color: var(--color-neutral-500); }

  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }
  .mb-16 { margin-bottom: 16px; }

  .form-group { display: flex; flex-direction: column; gap: 6px; }
  .form-group label { font-size: 13px; font-weight: 600; color: var(--color-neutral-700); }

  .form-control { padding: 10px 14px; font-size: 14px; border: 1px solid var(--color-neutral-300); border-radius: var(--radius-md); background: white; outline: none; width: 100%; box-sizing: border-box; }

  .form-actions-bar { display: flex; justify-content: flex-end; align-items: center; gap: 16px; margin-top: 32px; }
  .btn-cancel { padding: 12px 24px; font-size: 14px; font-weight: 600; color: var(--color-neutral-600); background: var(--color-neutral-100); border: 1px solid var(--color-neutral-300); border-radius: var(--radius-md); text-decoration: none; }
  .btn-submit { padding: 12px 28px; font-size: 14px; font-weight: 700; color: white; background: var(--color-primary-600); border: none; border-radius: var(--radius-md); cursor: pointer; }

  .alert { padding: 14px 18px; border-radius: var(--radius-md); margin-bottom: 20px; font-weight: 600; }
  .error-box { background: #fef2f2; color: #991b1b; border: 1px solid #fca5a5; }
  .loader-box { padding: 40px; text-align: center; color: var(--color-neutral-500); }
</style>
