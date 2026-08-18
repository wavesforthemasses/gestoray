<script lang="ts">
  import { onMount } from 'svelte';
  import { authState, activeRoleState } from '$lib/auth.svelte';
  import { toast } from '$lib/stores/toast.svelte';
  import type { ContactItem } from '$lib/services/contacts.service';
  import type { ActivityType } from '$lib/services/activityTypesService';
  import { Button, Card, FormField } from '$lib';
  import { formatDateTime } from '$lib/utils/formatters';
  import { 
    X, 
    ClipboardList, 
    Phone, 
    Users, 
    Mail, 
    FileText, 
    Clock, 
    CheckCircle2, 
    AlertCircle, 
    Plus, 
    Building, 
    UserCheck,
    Calendar,
    ExternalLink
  } from '@lucide/svelte';

  interface Props {
    contact: ContactItem;
    isOpen: boolean;
    activitiesConfig: ActivityType[];
    clientLookup: Record<string, string>;
    onClose: () => void;
  }

  let { contact, isOpen, activitiesConfig, clientLookup, onClose }: Props = $props();

  let activities = $state<any[]>([]);
  let loading = $state(true);
  let submitting = $state(false);
  let noteText = $state('');

  let allowedTypesForContact = $derived(
    (activitiesConfig || [])
      .filter(t => t.rolesInsert?.includes(activeRoleState.role || ''))
      .filter(t => !t.allowedTargets || t.allowedTargets.length === 0 || t.allowedTargets.includes('contact'))
  );

  async function loadActivities() {
    if (!contact?.id) return;
    loading = true;
    try {
      const { ActivitiesService } = await import('../../activities/activities.service');
      activities = await ActivitiesService.getActivities({
        targetType: 'contact',
        targetId: contact.id
      });
    } catch (e: any) {
      console.warn('Errore caricamento attività contatto:', e);
      activities = [];
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    loadActivities();
  });

  async function logQuickActivity(type: ActivityType) {
    if (!authState.user || submitting) return;
    submitting = true;
    try {
      const { ActivitiesService } = await import('../../activities/activities.service');
      const now = new Date();
      const executionDate = now.toISOString().split('T')[0];

      await ActivitiesService.createActivity({
        title: `${type.name} con ${contact.fullName}`,
        activityTypeId: type.id,
        activityTypeName: type.name,
        targetType: 'contact',
        targetId: contact.id,
        targetName: contact.fullName,
        targetSubtext: [contact.email, contact.phone, contact.role].filter(Boolean).join(' • '),
        assignedUid: authState.user.uid,
        assignedName: authState.user.displayName || authState.user.email || 'Operatore',
        executionDate,
        dueDate: executionDate,
        status: type.defaultStatus || 'completata',
        priority: type.defaultPriority || 'media',
        durationMinutes: 15,
        description: `Registrazione rapida da scheda referente.`
      }, {
        uid: authState.user.uid,
        displayName: authState.user.displayName || authState.user.email || 'Operatore'
      });

      toast.success(`Attività "${type.name}" registrata con successo!`);
      await loadActivities();
    } catch (err: any) {
      toast.error('Errore registrazione attività: ' + (err?.message || err));
    } finally {
      submitting = false;
    }
  }

  async function handleAddNote(e: Event) {
    e.preventDefault();
    if (!noteText.trim() || !authState.user || submitting) return;
    submitting = true;
    try {
      const { ActivitiesService } = await import('../../activities/activities.service');
      const now = new Date();
      const executionDate = now.toISOString().split('T')[0];

      await ActivitiesService.createActivity({
        title: `Nota Referente: ${contact.fullName}`,
        activityTypeId: 'note',
        activityTypeName: 'Nota / Promemoria',
        targetType: 'contact',
        targetId: contact.id,
        targetName: contact.fullName,
        targetSubtext: [contact.email, contact.phone].filter(Boolean).join(' • '),
        assignedUid: authState.user.uid,
        assignedName: authState.user.displayName || authState.user.email || 'Operatore',
        executionDate,
        status: 'completata',
        priority: 'bassa',
        description: noteText.trim()
      }, {
        uid: authState.user.uid,
        displayName: authState.user.displayName || authState.user.email || 'Operatore'
      });

      toast.success('Nota registrata con successo!');
      noteText = '';
      await loadActivities();
    } catch (err: any) {
      toast.error('Errore salvataggio nota: ' + (err?.message || err));
    } finally {
      submitting = false;
    }
  }

  function getStatusBadge(status: string) {
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
</script>

{#if isOpen}
  <div class="modal-backdrop" onclick={onClose} role="presentation">
    <div class="modal-container animate-scale-in" onclick={(e) => e.stopPropagation()} role="presentation">
      <!-- HEADER -->
      <div class="modal-header">
        <div class="header-info">
          <div class="avatar-box">
            {contact.firstName.charAt(0)}{contact.lastName.charAt(0)}
          </div>
          <div>
            <h3 class="contact-name">{contact.fullName}</h3>
            <p class="contact-sub">
              {contact.role || 'Referente'} 
              {#if contact.email} • <span class="text-primary">{contact.email}</span>{/if}
              {#if contact.phone} • <span>{contact.phone}</span>{/if}
            </p>
          </div>
        </div>
        <button type="button" class="btn-close" onclick={onClose} title="Chiudi">
          <X size={20} />
        </button>
      </div>

      <!-- BODY -->
      <div class="modal-body">
        <!-- QUICK ACTIONS LOGGER -->
        <div class="quick-log-card">
          <div class="ql-header">
            <ClipboardList size={18} class="text-primary-600" />
            <h4>Registrazione Rapida Interazione</h4>
          </div>
          <p class="ql-sub">Registra con 1 click telefonate, incontri ed email avute con questo referente.</p>

          <div class="quick-buttons-row">
            {#each allowedTypesForContact as type}
              <Button
                variant="secondary"
                disabled={submitting}
                onclick={() => logQuickActivity(type)}
              >
                {#if type.code === 'TEL'}
                  <Phone size={14} />
                {:else if type.code === 'VIS'}
                  <Users size={14} />
                {:else if type.code === 'EML'}
                  <Mail size={14} />
                {:else}
                  <Plus size={14} />
                {/if}
                <span>{type.name}</span>
              </Button>
            {/each}
            {#if allowedTypesForContact.length === 0}
              <p class="empty-msg">Nessuna tipologia di attività abilitata per i contatti o per il tuo ruolo.</p>
            {/if}
          </div>
        </div>

        <!-- QUICK NOTE FORM -->
        <form onsubmit={handleAddNote} class="quick-note-box">
          <div class="note-input-group">
            <input
              type="text"
              bind:value={noteText}
              placeholder="Scrivi una nota rapida su questo contatto..."
              disabled={submitting}
              class="note-input"
            />
            <Button type="submit" variant="primary" disabled={submitting || !noteText.trim()}>
              <FileText size={15} /> Registra Nota
            </Button>
          </div>
        </form>

        <!-- TIMELINE / LIST OF ACTIVITIES -->
        <div class="timeline-section">
          <div class="timeline-header">
            <h4>Storico Attività & Interazioni ({activities.length})</h4>
            <a 
              href="/dashboard/activities/add" 
              class="link-new-activity"
              title="Pianifica attività avanzata"
            >
              <Plus size={14} /> Pianifica Altra Attività
            </a>
          </div>

          {#if loading}
            <div class="loading-box">
              <span class="spinner"></span>
              Caricamento interazioni...
            </div>
          {:else if activities.length === 0}
            <div class="empty-timeline">
              <ClipboardList size={36} class="text-neutral-400" />
              <h5>Nessuna attività registrata</h5>
              <p>Usa i pulsanti rapidi in alto per registrare la prima telefonata o incontro con {contact.fullName}.</p>
            </div>
          {:else}
            <div class="activities-stack">
              {#each activities as a}
                {@const badge = getStatusBadge(a.status)}
                <div class="activity-entry">
                  <div class="entry-header">
                    <div class="entry-title-group">
                      <span class="type-pill">{a.activityTypeName || 'Attività'}</span>
                      <a href="/dashboard/activities/{a.id}" class="activity-title-link" title="Apri scheda attività">
                        {a.title}
                        <ExternalLink size={13} class="inline ml-1 text-neutral-400" />
                      </a>
                    </div>
                    <span class="badge {badge.class}">{badge.label}</span>
                  </div>

                  {#if a.description}
                    <p class="entry-desc">{a.description}</p>
                  {/if}

                  <div class="entry-footer">
                    <span class="meta-item">
                      <Calendar size={13} /> {a.executionDate || a.dueDate || a.createdAt?.slice(0, 10) || 'N.D.'}
                    </span>
                    {#if a.durationMinutes}
                      <span class="meta-item">
                        <Clock size={13} /> {a.durationMinutes} min
                      </span>
                    {/if}
                    <span class="meta-item">
                      Operatore: <strong>{a.assignedName || 'Non assegnato'}</strong>
                    </span>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      </div>

      <!-- FOOTER -->
      <div class="modal-footer">
        <Button variant="secondary" onclick={onClose}>Chiudi</Button>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.6);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    padding: 20px;
    box-sizing: border-box;
  }
  .modal-container {
    background: var(--color-white, #ffffff);
    border-radius: var(--radius-lg, 16px);
    border: 1px solid var(--color-neutral-200, #e2e8f0);
    box-shadow: var(--shadow-xl, 0 20px 25px -5px rgba(0, 0, 0, 0.1));
    width: 100%;
    max-width: 720px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .modal-header {
    padding: 16px 20px;
    border-bottom: 1px solid var(--color-neutral-200, #e2e8f0);
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: var(--color-neutral-50, #f8fafc);
  }
  .header-info {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .avatar-box {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    background: var(--color-primary-100, #dbeafe);
    color: var(--color-primary-700, #1d4ed8);
    font-weight: 700;
    font-size: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .contact-name {
    margin: 0;
    font-size: 18px;
    font-weight: 700;
    color: var(--color-neutral-900, #0f172a);
  }
  .contact-sub {
    margin: 2px 0 0 0;
    font-size: 13px;
    color: var(--color-neutral-500, #64748b);
  }
  .btn-close {
    background: transparent;
    border: none;
    cursor: pointer;
    color: var(--color-neutral-400, #94a3b8);
    padding: 6px;
    border-radius: 6px;
  }
  .btn-close:hover {
    background: var(--color-neutral-200, #e2e8f0);
    color: var(--color-neutral-800, #1e293b);
  }
  .modal-body {
    padding: 20px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 18px;
  }
  .quick-log-card {
    background: var(--color-neutral-50, #f8fafc);
    border: 1px solid var(--color-neutral-200, #e2e8f0);
    border-radius: var(--radius-md, 12px);
    padding: 16px;
  }
  .ql-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
  }
  .ql-header h4 {
    margin: 0;
    font-size: 15px;
    font-weight: 700;
    color: var(--color-neutral-800, #1e293b);
  }
  .ql-sub {
    margin: 0 0 12px 0;
    font-size: 12.5px;
    color: var(--color-neutral-500, #64748b);
  }
  .quick-buttons-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .quick-note-box {
    width: 100%;
  }
  .note-input-group {
    display: flex;
    gap: 8px;
  }
  .note-input {
    flex: 1;
    padding: 10px 14px;
    border: 1px solid var(--color-neutral-300, #cbd5e1);
    border-radius: var(--radius-md, 8px);
    font-size: 14px;
    outline: none;
  }
  .note-input:focus {
    border-color: var(--color-primary-500, #3b82f6);
  }
  .timeline-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .timeline-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .timeline-header h4 {
    margin: 0;
    font-size: 15px;
    font-weight: 700;
    color: var(--color-neutral-800, #1e293b);
  }
  .link-new-activity {
    font-size: 12.5px;
    font-weight: 600;
    color: var(--color-primary-600, #2563eb);
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
  .link-new-activity:hover {
    text-decoration: underline;
  }
  .activities-stack {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .activity-entry {
    background: var(--color-white, #ffffff);
    border: 1px solid var(--color-neutral-200, #e2e8f0);
    border-radius: var(--radius-md, 10px);
    padding: 12px 16px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    transition: all 0.15s ease;
  }
  .activity-entry:hover {
    border-color: var(--color-primary-300, #93c5fd);
    box-shadow: var(--shadow-sm, 0 1px 2px 0 rgba(0, 0, 0, 0.05));
  }
  .entry-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
  }
  .entry-title-group {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .type-pill {
    font-size: 11px;
    font-weight: 700;
    background: var(--color-neutral-100, #f1f5f9);
    color: var(--color-neutral-700, #334155);
    padding: 2px 8px;
    border-radius: 4px;
    text-transform: uppercase;
  }
  .activity-title-link {
    font-size: 14px;
    font-weight: 700;
    color: var(--color-neutral-900, #0f172a);
    text-decoration: none;
  }
  .activity-title-link:hover {
    color: var(--color-primary-600, #2563eb);
    text-decoration: underline;
  }
  .entry-desc {
    margin: 0;
    font-size: 13px;
    color: var(--color-neutral-600, #475569);
    line-height: 1.4;
  }
  .entry-footer {
    display: flex;
    gap: 16px;
    font-size: 12px;
    color: var(--color-neutral-500, #64748b);
    flex-wrap: wrap;
    margin-top: 4px;
  }
  .meta-item {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
  .empty-timeline, .loading-box {
    text-align: center;
    padding: 32px;
    background: var(--color-neutral-50, #f8fafc);
    border: 1px dashed var(--color-neutral-300, #cbd5e1);
    border-radius: var(--radius-md, 12px);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }
  .empty-timeline h5 {
    margin: 4px 0 0 0;
    font-size: 15px;
    font-weight: 700;
    color: var(--color-neutral-700, #334155);
  }
  .empty-timeline p {
    margin: 0;
    font-size: 13px;
    color: var(--color-neutral-500, #64748b);
    max-width: 400px;
  }
  .badge {
    font-size: 11px;
    padding: 2px 8px;
    border-radius: 12px;
    font-weight: 600;
  }
  .badge-success { background: #dcfce7; color: #15803d; }
  .badge-info { background: #e0f2fe; color: #0369a1; }
  .badge-warning { background: #fef3c7; color: #b45309; }
  .badge-neutral { background: #f1f5f9; color: #475569; }
  .modal-footer {
    padding: 12px 20px;
    border-top: 1px solid var(--color-neutral-200, #e2e8f0);
    display: flex;
    justify-content: flex-end;
    background: var(--color-neutral-50, #f8fafc);
  }
  .empty-msg {
    font-size: 12.5px;
    color: var(--color-neutral-500, #64748b);
    margin: 0;
  }
</style>
