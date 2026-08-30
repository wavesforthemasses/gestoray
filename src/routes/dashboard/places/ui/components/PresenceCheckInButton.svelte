<script lang="ts">
  import { 
    MapPin, 
    CheckCircle2, 
    Clock, 
    Square, 
    AlertCircle, 
    Loader2, 
    Navigation,
    ArrowRightLeft
  } from '@lucide/svelte';
  import { presenceState } from '../../application/presenceState.svelte';
  import { presenceRadar } from '../../application/presenceRadar.svelte';
  import { formatMinutesDuration } from '../../domain/services/presenceUtils';
  import type { PlaceDocument } from '../../domain/models/place';

  interface Props {
    place: PlaceDocument | { id: string; name: string; code?: string; parentId?: string | null; geo?: any; summary?: any };
    activity?: { id: string; name: string } | null;
    currentUser: { uid: string; displayName?: string; email?: string } | null;
    onStatusChange?: () => void;
  }

  let {
    place,
    activity = null,
    currentUser,
    onStatusChange
  }: Props = $props();

  let showConfirmModal = $state(false);
  let checkOutNotes = $state('');

  const isCurrentPlaceActive = $derived(
    presenceState.activePresence?.placeId === place.id
  );

  const isOtherPlaceActive = $derived(
    presenceState.activePresence !== null && presenceState.activePresence.placeId !== place.id
  );

  const targetCoords = $derived({
    lat: place.geo?.coordinates?.latitude ?? place.summary?.coordinates?.lat ?? 0,
    lng: place.geo?.coordinates?.longitude ?? place.summary?.coordinates?.lng ?? 0,
    radius: place.geo?.radiusMeters ?? place.summary?.radiusMeters ?? 50
  });

  const isNearby = $derived.by(() => {
    if (!presenceRadar.currentCoords || !targetCoords.lat) return false;
    return presenceRadar.isInsideNearest && presenceRadar.nearestPlace?.place.id === place.id;
  });

  const distanceToPlace = $derived.by(() => {
    if (!presenceRadar.currentCoords || !targetCoords.lat) return null;
    if (presenceRadar.nearestPlace?.place.id === place.id) {
      return presenceRadar.nearestPlace.distance;
    }
    return null;
  });

  // Timer minuti trascorsi dal check-in
  let elapsedMinutes = $state(0);
  $effect(() => {
    if (isCurrentPlaceActive && presenceState.activePresence?.clientEnteredAt) {
      const updateTimer = () => {
        const start = new Date(presenceState.activePresence!.clientEnteredAt).getTime();
        elapsedMinutes = Math.max(0, Math.round((Date.now() - start) / 60000));
      };
      updateTimer();
      const interval = setInterval(updateTimer, 30000);
      return () => clearInterval(interval);
    }
  });

  async function handleCheckIn() {
    if (!currentUser) return;
    const res = await presenceState.checkIn({
      placeId: place.id,
      placeName: place.name,
      placeCode: (place as any).code,
      parentId: place.parentId,
      activityId: activity?.id,
      activityName: activity?.name,
      targetLat: targetCoords.lat || undefined,
      targetLng: targetCoords.lng || undefined,
      radiusMeters: targetCoords.radius,
      userId: currentUser.uid,
      userName: currentUser.displayName || currentUser.email || 'Operatore',
      userEmail: currentUser.email
    });
    if (res) {
      onStatusChange?.();
    }
  }

  async function handleCheckOut() {
    const success = await presenceState.checkOut(checkOutNotes.trim() || undefined);
    if (success) {
      showConfirmModal = false;
      checkOutNotes = '';
      onStatusChange?.();
    }
  }
</script>

<div class="presence-control-wrapper">
  {#if isCurrentPlaceActive}
    <!-- STATO 1: Turno Attivo in questo Luogo -->
    <div class="active-shift-card">
      <div class="shift-live-header">
        <span class="live-pulse-dot"></span>
        <div class="shift-info">
          <span class="shift-title">Turno in corso</span>
          <span class="shift-timer">
            <Clock size={13} />
            <span>{formatMinutesDuration(elapsedMinutes)} ({new Date(presenceState.activePresence!.clientEnteredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})</span>
          </span>
        </div>
      </div>

      <button 
        type="button" 
        class="btn-checkout" 
        onclick={() => (showConfirmModal = true)}
        disabled={presenceState.isSubmitting}
      >
        {#if presenceState.isSubmitting}
          <Loader2 size={15} class="animate-spin" />
          <span>Registrazione...</span>
        {:else}
          <Square size={15} />
          <span>Termina Lavoro</span>
        {/if}
      </button>
    </div>

  {:else}
    <!-- STATO 2: Nessun turno attivo o turno attivo altrove -->
    <div class="checkin-action-card">
      <div class="proximity-indicator">
        {#if isNearby}
          <span class="badge-proximity within">
            <CheckCircle2 size={13} />
            <span>Sei all'interno del cantiere</span>
          </span>
        {:else if distanceToPlace !== null}
          <span class="badge-proximity away">
            <Navigation size={13} />
            <span>A {distanceToPlace > 1000 ? (Number(distanceToPlace / 1000) || 0).toFixed(1) + ' km' : distanceToPlace + ' m'} da qui</span>
          </span>
        {/if}

        {#if isOtherPlaceActive}
          <span class="badge-switch-warning">
            <ArrowRightLeft size={13} />
            <span>Attivo a: {presenceState.activePresence?.placeName}</span>
          </span>
        {/if}
      </div>

      <button 
        type="button" 
        class="btn-checkin {isNearby ? 'highlight-btn' : ''}" 
        onclick={handleCheckIn}
        disabled={presenceState.isSubmitting || !currentUser}
      >
        {#if presenceState.isSubmitting}
          <Loader2 size={16} class="animate-spin" />
          <span>Registrazione presenza...</span>
        {:else}
          <MapPin size={16} />
          <span>{isOtherPlaceActive ? 'Sposta Turno Qui' : 'Inizia Turno / Check-In'}</span>
        {/if}
      </button>
    </div>
  {/if}

  {#if presenceState.lastError}
    <div class="presence-error-alert">
      <AlertCircle size={14} />
      <span>{presenceState.lastError}</span>
    </div>
  {/if}
</div>

<!-- Modal di Conferma Check-Out -->
{#if showConfirmModal}
  <div class="modal-backdrop" onclick={() => (showConfirmModal = false)} role="presentation">
    <div class="modal-dialog" onclick={(e) => e.stopPropagation()} role="dialog">
      <div class="modal-header">
        <h3 class="modal-title">Conferma Fine Lavoro</h3>
      </div>
      <div class="modal-body">
        <p class="modal-desc">
          Stai per terminare il tuo turno presso <strong>{place.name}</strong>.
          Durata stimata: <strong>{formatMinutesDuration(elapsedMinutes)}</strong>.
        </p>

        <label class="modal-label" for="notes-input">Note o rapportino (opzionale):</label>
        <textarea 
          id="notes-input" 
          bind:value={checkOutNotes} 
          class="modal-textarea" 
          placeholder="Es: Completata gettata di cemento lotto A..."
          rows="3"
        ></textarea>
      </div>
      <div class="modal-actions">
        <button 
          type="button" 
          class="btn-cancel" 
          onclick={() => (showConfirmModal = false)}
        >
          Annulla
        </button>
        <button 
          type="button" 
          class="btn-confirm-checkout" 
          onclick={handleCheckOut}
          disabled={presenceState.isSubmitting}
        >
          {#if presenceState.isSubmitting}
            <Loader2 size={15} class="animate-spin" />
            <span>Salvataggio...</span>
          {:else}
            <CheckCircle2 size={15} />
            <span>Conferma e Chiudi Turno</span>
          {/if}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .presence-control-wrapper {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 100%;
  }

  .active-shift-card {
    background: #ecfdf5;
    border: 1px solid #a7f3d0;
    border-radius: 10px;
    padding: 12px 14px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .shift-live-header {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .live-pulse-dot {
    width: 10px;
    height: 10px;
    background: #10b981;
    border-radius: 50%;
    box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
    animation: pulse-ring 1.8s infinite cubic-bezier(0.66, 0, 0, 1);
  }

  @keyframes pulse-ring {
    0% {
      box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
    }
    70% {
      box-shadow: 0 0 0 8px rgba(16, 185, 129, 0);
    }
    100% {
      box-shadow: 0 0 0 0 rgba(16, 185, 129, 0);
    }
  }

  .shift-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .shift-title {
    font-size: 13px;
    font-weight: 700;
    color: #065f46;
  }

  .shift-timer {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    font-weight: 600;
    color: #047857;
  }

  .btn-checkout {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: #ffffff;
    color: #b91c1c;
    border: 1px solid #fecaca;
    padding: 7px 12px;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-checkout:hover {
    background: #fee2e2;
    border-color: #fca5a5;
  }

  .checkin-action-card {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .proximity-indicator {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }

  .badge-proximity {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    font-weight: 600;
    padding: 3px 8px;
    border-radius: 12px;
  }

  .badge-proximity.within {
    background: #dcfce7;
    color: #15803d;
    border: 1px solid #bbf7d0;
  }

  .badge-proximity.away {
    background: #f1f5f9;
    color: #475569;
    border: 1px solid #e2e8f0;
  }

  .badge-switch-warning {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    font-weight: 600;
    background: #fffbeb;
    color: #b45309;
    border: 1px solid #fef3c7;
    padding: 3px 8px;
    border-radius: 12px;
  }

  .btn-checkin {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    background: #2563eb;
    color: #ffffff;
    border: none;
    padding: 9px 16px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-checkin:hover:not(:disabled) {
    background: #1d4ed8;
  }

  .btn-checkin.highlight-btn {
    background: #059669;
  }

  .btn-checkin.highlight-btn:hover:not(:disabled) {
    background: #047857;
  }

  .btn-checkin:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .presence-error-alert {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: #dc2626;
    background: #fef2f2;
    border: 1px solid #fee2e2;
    padding: 6px 10px;
    border-radius: 6px;
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
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .modal-title {
    font-size: 16px;
    font-weight: 700;
    color: #0f172a;
    margin: 0;
  }

  .modal-desc {
    font-size: 13px;
    color: #475569;
    line-height: 1.4;
    margin: 0 0 10px 0;
  }

  .modal-label {
    display: block;
    font-size: 12px;
    font-weight: 600;
    color: #334155;
    margin-bottom: 4px;
  }

  .modal-textarea {
    width: 100%;
    box-sizing: border-box;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    padding: 8px 10px;
    font-size: 13px;
    font-family: inherit;
    resize: vertical;
  }

  .modal-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 6px;
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

  .btn-confirm-checkout {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: #dc2626;
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
