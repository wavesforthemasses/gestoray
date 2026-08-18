<script module lang="ts">
  export const bridgeMetadata = {
    id: 'presences',
    sourceModule: 'places',
    label: 'Presenze & Operai'
  };
</script>

<script lang="ts">
  import { onMount } from 'svelte';
  import { 
    Users, 
    UserCheck, 
    Clock, 
    ShieldCheck, 
    MapPin, 
    Plus, 
    Radio, 
    FileEdit, 
    AlertCircle, 
    CheckCircle2,
    Calendar,
    Loader2
  } from '@lucide/svelte';
  import { PresenceFirestoreRepository } from '../infrastructure/firestore/PresenceFirestoreRepository';
  import { db } from '$lib/firebase';
  import { formatMinutesDuration } from '../domain/services/presenceUtils';
  import type { PlacePresenceLog } from '../domain/models/presence';
  import { presenceState } from '../application/presenceState.svelte';

  interface Props {
    placeId: string;
    placeName?: string;
  }

  let { placeId, placeName = 'Cantiere' }: Props = $props();

  const repo = new PresenceFirestoreRepository(db);

  let presences = $state<PlacePresenceLog[]>([]);
  let loading = $state(true);
  let filter = $state<'all' | 'active' | 'history'>('all');

  // Modal per aggiunta manuale presenze da caposquadra
  let showManualModal = $state(false);
  let manualWorkerName = $state('');
  let manualWorkerId = $state('');
  let manualNotes = $state('');
  let isSavingManual = $state(false);

  async function loadPresences() {
    loading = true;
    try {
      if (placeId) {
        presences = await repo.getPresencesForPlace('default', placeId, 50);
      }
    } catch (e) {
      console.error('Errore caricamento presenze:', e);
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    loadPresences();
  });

  $effect(() => {
    if (placeId) {
      loadPresences();
    }
  });

  const activeWorkers = $derived(presences.filter(p => p.status === 'active'));
  const historyLogs = $derived(presences.filter(p => p.status !== 'active'));

  const filteredLogs = $derived.by(() => {
    if (filter === 'active') return activeWorkers;
    if (filter === 'history') return historyLogs;
    return presences;
  });

  function getModeBadge(mode: string) {
    switch (mode) {
      case 'self_gps':
        return { label: 'GPS Validato', icon: MapPin, class: 'badge-mode-gps' };
      case 'proximity_radar':
        return { label: 'Radar Auto', icon: Radio, class: 'badge-mode-radar' };
      case 'team_leader':
        return { label: 'Caposquadra', icon: ShieldCheck, class: 'badge-mode-leader' };
      case 'self_manual':
      default:
        return { label: 'Manuale', icon: FileEdit, class: 'badge-mode-manual' };
    }
  }

  async function handleCreateManualPresence() {
    if (!manualWorkerName.trim()) return;
    isSavingManual = true;
    try {
      const now = new Date().toISOString();
      await repo.performSmartCheckIn('default', {
        orgId: 'default',
        placeId,
        placeName,
        userId: manualWorkerId.trim() || `usr_${Date.now()}`,
        userName: manualWorkerName.trim(),
        verifiedBy: 'team_leader',
        verifiedByUserId: 'current_leader',
        verifiedByUserName: 'Caposquadra',
        clientEnteredAt: now,
        status: 'active',
        notes: manualNotes.trim() || 'Registrato manualmente sul posto'
      });
      showManualModal = false;
      manualWorkerName = '';
      manualWorkerId = '';
      manualNotes = '';
      await loadPresences();
    } catch (e) {
      console.error('Errore creazione presenza manuale:', e);
    } finally {
      isSavingManual = false;
    }
  }
</script>

<div class="presences-tab-container">
  <!-- Header & KPI Bar -->
  <div class="tab-top-bar">
    <div class="kpi-cards-row">
      <div class="presence-kpi-card active-card">
        <div class="kpi-icon-box active">
          <UserCheck size={20} />
        </div>
        <div class="kpi-data">
          <span class="kpi-number">{activeWorkers.length}</span>
          <span class="kpi-label">Operai Presenti Ora</span>
        </div>
      </div>

      <div class="presence-kpi-card total-card">
        <div class="kpi-icon-box total">
          <Clock size={20} />
        </div>
        <div class="kpi-data">
          <span class="kpi-number">{presences.length}</span>
          <span class="kpi-label">Registrazioni Totali</span>
        </div>
      </div>
    </div>

    <div class="actions-group">
      <button 
        type="button" 
        class="btn-action-primary" 
        onclick={() => (showManualModal = true)}
      >
        <Plus size={16} />
        <span>Registra Operaio</span>
      </button>
    </div>
  </div>

  <!-- Filtri -->
  <div class="filters-segmented-bar">
    <button 
      class="filter-pill {filter === 'all' ? 'active' : ''}" 
      onclick={() => (filter = 'all')}
    >
      Tutti ({presences.length})
    </button>
    <button 
      class="filter-pill {filter === 'active' ? 'active' : ''}" 
      onclick={() => (filter = 'active')}
    >
      Presenti Ora ({activeWorkers.length})
    </button>
    <button 
      class="filter-pill {filter === 'history' ? 'active' : ''}" 
      onclick={() => (filter = 'history')}
    >
      Storico Concluso ({historyLogs.length})
    </button>
  </div>

  <!-- Contenuto Lista Presenze -->
  {#if loading}
    <div class="empty-state-box">
      <Loader2 size={32} class="animate-spin text-blue-600" />
      <p>Caricamento presenze in tempo reale...</p>
    </div>
  {:else if filteredLogs.length === 0}
    <div class="empty-state-box">
      <Users size={40} class="text-slate-300" />
      <h3>Nessuna presenza registrata</h3>
      <p>Gli operai appariranno qui automaticamente quando timbrano l'ingresso su questo cantiere.</p>
    </div>
  {:else}
    <div class="presences-grid">
      {#each filteredLogs as log (log.id)}
        {@const modeBadge = getModeBadge(log.verifiedBy)}
        {@const ModeIcon = modeBadge.icon}
        {@const isActive = log.status === 'active'}

        <div class="presence-log-card {isActive ? 'card-active' : ''}">
          <div class="log-card-header">
            <div class="worker-avatar">
              <span class="avatar-initials">
                {log.userName ? log.userName.slice(0, 2).toUpperCase() : 'OP'}
              </span>
              {#if isActive}
                <span class="avatar-live-dot"></span>
              {/if}
            </div>

            <div class="worker-info-box">
              <h4 class="worker-name">{log.userName}</h4>
              {#if log.teamName}
                <span class="worker-team-tag">{log.teamName}</span>
              {/if}
            </div>

            <div class="status-pill-box">
              {#if isActive}
                <span class="pill-active-live">
                  <span class="pulse-dot"></span>
                  <span>Al Lavoro</span>
                </span>
              {:else if log.isEstimatedClosing}
                <span class="pill-auto-closed" title="Chiuso automaticamente per orario massimo">
                  Auto-Chiuso
                </span>
              {:else}
                <span class="pill-completed">
                  <CheckCircle2 size={12} />
                  <span>Completato</span>
                </span>
              {/if}
            </div>
          </div>

          <div class="log-card-body">
            <!-- Orari Ingresso / Uscita -->
            <div class="timeline-row">
              <div class="timeline-col">
                <span class="time-label">Ingresso:</span>
                <span class="time-value">
                  {new Date(log.clientEnteredAt).toLocaleDateString([], { day: '2-digit', month: '2-digit' })} • 
                  {new Date(log.clientEnteredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              {#if log.clientLeftAt}
                <div class="timeline-col">
                  <span class="time-label">Uscita:</span>
                  <span class="time-value">
                    {new Date(log.clientLeftAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              {/if}

              {#if log.durationMinutes}
                <div class="timeline-col duration">
                  <span class="time-label">Durata:</span>
                  <span class="duration-badge">{formatMinutesDuration(log.durationMinutes)}</span>
                </div>
              {/if}
            </div>

            <!-- Modalità e Telemetria -->
            <div class="meta-footer-row">
              <span class="mode-pill {modeBadge.class}">
                <ModeIcon size={12} />
                <span>{modeBadge.label}</span>
              </span>

              {#if log.activityName}
                <span class="activity-chip">
                  <Clock size={11} />
                  <span>{log.activityName}</span>
                </span>
              {/if}

              {#if log.geoVerification?.distanceFromCenterMeters !== undefined}
                <span class="geo-dist-chip">
                  <span>Radar: {log.geoVerification.distanceFromCenterMeters}m</span>
                </span>
              {/if}
            </div>

            {#if log.notes}
              <div class="log-notes-box">
                <span class="notes-text">{log.notes}</span>
              </div>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<!-- Modal di Registrazione Manuale -->
{#if showManualModal}
  <div class="modal-backdrop" onclick={() => (showManualModal = false)} role="presentation">
    <div class="modal-dialog" onclick={(e) => e.stopPropagation()} role="dialog">
      <div class="modal-header">
        <h3 class="modal-title">Registra Operaio sul Posto</h3>
      </div>
      <div class="modal-body">
        <div class="form-field">
          <label for="worker-name-input">Nome Operaio / Tecnico:</label>
          <input 
            id="worker-name-input" 
            type="text" 
            bind:value={manualWorkerName} 
            placeholder="Es: Marco Rossi"
            class="input-text"
          />
        </div>

        <div class="form-field">
          <label for="worker-id-input">ID Utente (opzionale):</label>
          <input 
            id="worker-id-input" 
            type="text" 
            bind:value={manualWorkerId} 
            placeholder="Es: usr_456"
            class="input-text"
          />
        </div>

        <div class="form-field">
          <label for="manual-notes-input">Note aggiuntive:</label>
          <textarea 
            id="manual-notes-input" 
            bind:value={manualNotes} 
            placeholder="Es: Inizio turno su indicazione del capocantiere"
            rows="2"
            class="input-textarea"
          ></textarea>
        </div>
      </div>
      <div class="modal-actions">
        <button 
          type="button" 
          class="btn-cancel" 
          onclick={() => (showManualModal = false)}
        >
          Annulla
        </button>
        <button 
          type="button" 
          class="btn-confirm" 
          onclick={handleCreateManualPresence}
          disabled={isSavingManual || !manualWorkerName.trim()}
        >
          {#if isSavingManual}
            <Loader2 size={15} class="animate-spin" />
            <span>Salvataggio...</span>
          {:else}
            <Plus size={15} />
            <span>Conferma Presenza</span>
          {/if}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .presences-tab-container {
    display: flex;
    flex-direction: column;
    gap: 20px;
    padding: 10px 0;
  }

  .tab-top-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
  }

  .kpi-cards-row {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .presence-kpi-card {
    display: flex;
    align-items: center;
    gap: 12px;
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 10px 16px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.02);
  }

  .presence-kpi-card.active-card {
    border-color: #a7f3d0;
    background: #f0fdf4;
  }

  .kpi-icon-box {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .kpi-icon-box.active {
    background: #dcfce7;
    color: #15803d;
  }

  .kpi-icon-box.total {
    background: #eff6ff;
    color: #2563eb;
  }

  .kpi-data {
    display: flex;
    flex-direction: column;
  }

  .kpi-number {
    font-size: 18px;
    font-weight: 800;
    color: #0f172a;
    line-height: 1.1;
  }

  .kpi-label {
    font-size: 11px;
    font-weight: 600;
    color: #64748b;
  }

  .btn-action-primary {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: #2563eb;
    color: #ffffff;
    border: none;
    padding: 8px 14px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-action-primary:hover {
    background: #1d4ed8;
  }

  .filters-segmented-bar {
    display: flex;
    gap: 6px;
    background: #f1f5f9;
    padding: 4px;
    border-radius: 10px;
    width: fit-content;
  }

  .filter-pill {
    border: none;
    background: transparent;
    padding: 6px 12px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    color: #64748b;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .filter-pill.active {
    background: #ffffff;
    color: #0f172a;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  }

  .presences-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
    gap: 14px;
  }

  .presence-log-card {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.02);
  }

  .presence-log-card.card-active {
    border-color: #86efac;
    background: #fcfdfc;
    box-shadow: 0 4px 12px rgba(34, 197, 94, 0.06);
  }

  .log-card-header {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .worker-avatar {
    position: relative;
    width: 38px;
    height: 38px;
    background: #f1f5f9;
    border: 1px solid #cbd5e1;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 13px;
    color: #334155;
  }

  .avatar-live-dot {
    position: absolute;
    bottom: 0;
    right: 0;
    width: 10px;
    height: 10px;
    background: #22c55e;
    border: 2px solid #ffffff;
    border-radius: 50%;
  }

  .worker-info-box {
    flex: 1;
    min-width: 0;
  }

  .worker-name {
    font-size: 14px;
    font-weight: 700;
    color: #0f172a;
    margin: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .worker-team-tag {
    font-size: 11px;
    color: #64748b;
  }

  .pill-active-live {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: #dcfce7;
    color: #166534;
    font-size: 11px;
    font-weight: 700;
    padding: 3px 8px;
    border-radius: 12px;
  }

  .pulse-dot {
    width: 6px;
    height: 6px;
    background: #22c55e;
    border-radius: 50%;
    animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
  }

  @keyframes ping {
    75%, 100% {
      transform: scale(2);
      opacity: 0;
    }
  }

  .pill-completed {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: #f1f5f9;
    color: #475569;
    font-size: 11px;
    font-weight: 600;
    padding: 3px 8px;
    border-radius: 12px;
  }

  .pill-auto-closed {
    background: #fef9c3;
    color: #854d0e;
    font-size: 11px;
    font-weight: 600;
    padding: 3px 8px;
    border-radius: 12px;
  }

  .timeline-row {
    display: flex;
    align-items: center;
    gap: 16px;
    font-size: 12px;
    background: #f8fafc;
    padding: 8px 12px;
    border-radius: 8px;
  }

  .timeline-col {
    display: flex;
    flex-direction: column;
  }

  .time-label {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    color: #94a3b8;
  }

  .time-value {
    font-weight: 600;
    color: #334155;
  }

  .duration-badge {
    font-weight: 700;
    color: #2563eb;
  }

  .meta-footer-row {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    margin-top: 8px;
  }

  .mode-pill {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    font-weight: 600;
    padding: 2px 7px;
    border-radius: 6px;
  }

  .badge-mode-gps { background: #dbeafe; color: #1e40af; }
  .badge-mode-radar { background: #e0e7ff; color: #3730a3; }
  .badge-mode-leader { background: #fef3c7; color: #92400e; }
  .badge-mode-manual { background: #f1f5f9; color: #475569; }

  .activity-chip, .geo-dist-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    color: #64748b;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    padding: 2px 6px;
    border-radius: 4px;
  }

  .log-notes-box {
    font-size: 12px;
    color: #475569;
    background: #fff;
    border-left: 2px solid #cbd5e1;
    padding: 4px 8px;
    margin-top: 6px;
  }

  .empty-state-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px 20px;
    text-align: center;
    background: #f8fafc;
    border: 1px dashed #cbd5e1;
    border-radius: 12px;
    color: #64748b;
    gap: 8px;
  }

  /* Modal */
  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(15, 23, 42, 0.45);
    backdrop-filter: blur(2px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
  }

  .modal-dialog {
    background: #ffffff;
    border-radius: 14px;
    width: 90%;
    max-width: 440px;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
  }

  .modal-title {
    font-size: 16px;
    font-weight: 700;
    color: #0f172a;
    margin: 0;
  }

  .form-field {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .form-field label {
    font-size: 12px;
    font-weight: 600;
    color: #334155;
  }

  .input-text, .input-textarea {
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    padding: 8px 10px;
    font-size: 13px;
    font-family: inherit;
  }

  .modal-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
  }

  .btn-cancel {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    color: #475569;
    padding: 8px 14px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
  }

  .btn-confirm {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: #2563eb;
    color: #ffffff;
    border: none;
    padding: 8px 16px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
  }

  .animate-spin {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
</style>
