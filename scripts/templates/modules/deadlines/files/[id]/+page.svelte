<script lang="ts">
  import { projectStore } from '$lib/stores/project';
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { DeadlinesService } from '../deadlines.service';
  import { DeadlineSettingsService } from '../deadlineSettingsService';
  import type { DeadlineEntry, DeadlineSettings } from '../schema';
  import { Card, StatusBadge, Button } from '$lib';
  import { pageTitle } from '$lib/stores/page';
  import { toast } from '$lib/stores/toast.svelte';
  import { confirmStore } from '$lib/stores/confirm.svelte';
  import { AlertTriangle, List, Edit3, Trash2, Calendar, Link, CheckCircle2 } from '@lucide/svelte';

  let deadlineId = $derived($page.params.id || '');
  let deadline = $state<DeadlineEntry | null>(null);
  let settings = $state<DeadlineSettings>({
    entityNaming: 'scadenzario',
    customSingularLabel: '',
    customPluralLabel: '',
    prefix: 'DDL-',
    includeYear: true,
    numberPadding: 4,
    lastNumber: 0,
    lastCounterYear: new Date().getFullYear(),
    defaultStatus: 'attiva',
    defaultReminderDays: [30, 15, 7, 1],
    enablePushNotifications: false
  });

  let loading = $state(true);
  let deleting = $state(false);
  let updating = $state(false);

  let labels = $derived(DeadlineSettingsService.getLabels(settings));

  onMount(async () => {
    try {
      if (!deadlineId) return;
      const [s, data] = await Promise.all([
        DeadlineSettingsService.getSettings(),
        DeadlinesService.getDeadlineById(deadlineId)
      ]);
      settings = s;
      deadline = data;
      if (data) {
        pageTitle.set(`${data.code} - ${data.title}`);
      }
    } catch (e) {
      console.error('Errore caricamento dettaglio scadenza:', e);
      toast.error('Impossibile caricare il dettaglio');
    } finally {
      loading = false;
    }
  });

  async function handleMarkRenewed() {
    if (!deadline) return;
    updating = true;
    try {
      await DeadlinesService.updateDeadline(deadline.id, { status: 'rinnovata' });
      deadline.status = 'rinnovata';
      toast.success('Scadenza contrassegnata come RINNOVATA');
    } catch (e) {
      console.error('Errore aggiornamento scadenza:', e);
      toast.error('Impossibile aggiornare lo stato');
    } finally {
      updating = false;
    }
  }

  async function handleDelete() {
    if (!deadline) return;
    const confirmed = await confirmStore.prompt(`Sei sicuro di voler eliminare questa ${labels.singular.toLowerCase()}?`);
    if (!confirmed) return;

    deleting = true;
    try {
      await DeadlinesService.deleteDeadline(deadline.id);
      toast.success(`${labels.singular} eliminata con successo`);
      goto('/dashboard/deadlines');
    } catch (e) {
      console.error('Errore eliminazione scadenza:', e);
      toast.error('Errore durante l\'eliminazione');
    } finally {
      deleting = false;
    }
  }

  function getStatusLabel(status: string): string {
    switch (status) {
      case 'attiva': return 'Attiva';
      case 'in_scadenza': return 'In Scadenza';
      case 'scaduta': return 'SCADUTA';
      case 'rinnovata': return 'Rinnovata';
      case 'archiviata': return 'Archiviata';
      default: return status;
    }
  }
</script>

<svelte:head>
  <title>{deadline ? deadline.title : labels.singular} | {$projectStore?.projectName || 'ERP'}</title>
</svelte:head>

<div class="deadline-detail-container">
  {#if loading}
    <div class="loading-state">Caricamento in corso...</div>
  {:else if !deadline}
    <Card class="empty-card">
      <h2>{labels.singular} non trovata</h2>
      <p>L'elemento richiesto non esiste o è stato rimosso.</p>
      <a href="/dashboard/deadlines" class="btn-module-list" title="Vai a elenco {labels.plural}" aria-label="Vai a elenco {labels.plural}">
        <List size={20} />
      </a>
    </Card>
  {:else}
    <header class="page-header">
      <div class="header-title-box">
        <a href="/dashboard/deadlines" class="btn-module-list" title="Vai a elenco {labels.plural}" aria-label="Vai a elenco {labels.plural}">
          <List size={20} />
        </a>
        <div class="header-icon">
          <AlertTriangle size={24} color="#D97706" />
        </div>
        <div>
          <div class="code-badge">{deadline.code}</div>
          <h1 class="page-main-title">{deadline.title}</h1>
        </div>
      </div>

      <div class="header-actions">
        {#if deadline.status !== 'rinnovata'}
          <Button variant="secondary" onclick={handleMarkRenewed} disabled={updating}>
            <CheckCircle2 size={16} />
            <span>Segna come Rinnovata</span>
          </Button>
        {/if}
        <a href={`/dashboard/deadlines/${deadline.id}/edit`} class="btn-edit">
          <Edit3 size={16} />
          <span>Modifica</span>
        </a>
        <Button variant="danger" onclick={handleDelete} disabled={deleting} class="btn-delete">
          <Trash2 size={16} color="white" />
          <span>{deleting ? 'Eliminazione...' : 'Elimina'}</span>
        </Button>
      </div>
    </header>

    <div class="detail-grid">
      <Card class="detail-card">
        <h2 class="card-title">Informazioni Generali</h2>
        
        <div class="info-list">
          <div class="info-item">
            <span class="info-label">Stato Alert</span>
            <StatusBadge status={deadline.status} label={getStatusLabel(deadline.status)} />
          </div>
          <div class="info-item">
            <span class="info-label">Data Scadenza</span>
            <span class="info-value font-bold text-primary">{deadline.expiryDate}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Ricorrenza</span>
            <span class="info-value">
              {#if deadline.isRecurring}
                Rinnovo automatico ogni {deadline.recurringIntervalMonths || 12} mesi
              {:else}
                Nessuna (Scadenza singola)
              {/if}
            </span>
          </div>
          <div class="info-item">
            <span class="info-label">Preavviso Alert</span>
            <span class="info-value">{(deadline.reminderDaysBefore || [30, 15, 7, 1]).join(', ')} giorni prima</span>
          </div>
          {#if deadline.linkedEntityName}
            <div class="info-item">
              <span class="info-label">Entità Collegata</span>
              <span class="info-value font-semibold">{deadline.linkedEntityName}</span>
            </div>
          {/if}
        </div>
      </Card>

      <Card class="detail-card">
        <h2 class="card-title">Note & Dettagli Polizza/Corsi</h2>
        <p class="notes-content">{deadline.notes || 'Nessuna nota aggiuntiva presente per questa scadenza.'}</p>
      </Card>
    </div>
  {/if}
</div>

<style>
  .deadline-detail-container {
    display: flex;
    flex-direction: column;
    gap: 20px;
    width: 100%;
  }
  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .header-title-box {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .btn-back {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: var(--radius-md);
    background: var(--color-neutral-100);
    color: var(--color-neutral-700);
    text-decoration: none;
  }
  .header-icon {
    width: 44px;
    height: 44px;
    border-radius: var(--radius-lg);
    background: #FFFBEB;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .code-badge {
    font-size: 12px;
    font-weight: 700;
    font-family: monospace;
    color: var(--color-primary-600);
  }
  .page-main-title {
    font-size: 20px;
    font-weight: 700;
    margin: 0;
  }
  .header-actions {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .btn-edit {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    background: var(--color-primary-600);
    color: white;
    font-size: 14px;
    font-weight: 500;
    border-radius: var(--radius-md);
    text-decoration: none;
  }
  .detail-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
  }
  .card-title {
    font-size: 16px;
    font-weight: 600;
    margin: 0 0 16px 0;
  }
  .info-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .info-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--color-neutral-100);
  }
  .info-label {
    font-size: 13px;
    color: var(--color-neutral-500);
  }
  .info-value {
    font-size: 14px;
    font-weight: 600;
  }
  .notes-content {
    font-size: 14px;
    color: var(--color-neutral-700);
    line-height: 1.5;
  }
  .loading-state {
    padding: 40px;
    text-align: center;
  }
  .empty-card {
    padding: 40px;
    text-align: center;
  }
  .font-semibold { font-weight: 600; }
  .font-bold { font-weight: 700; }
  .text-primary { color: var(--color-primary-600); }
</style>
