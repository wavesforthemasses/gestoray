<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { 
    MapPin, 
    Sparkles, 
    Check, 
    X, 
    LogOut, 
    Coffee, 
    Clock, 
    Loader2, 
    ArrowRight,
    Navigation
  } from '@lucide/svelte';
  import { presenceState } from '../../application/presenceState.svelte';
  import { presenceRadar, type TargetPlaceItem } from '../../application/presenceRadar.svelte';
  import { PresenceSyncChannel } from '../../application/presenceSyncChannel';

  import { PlacesService } from '../../places.service';
  import { PlaceSettingsService } from '../../placeSettingsService';
  import type { PlaceDocument } from '../../domain/models/place';
  import type { PlaceSettings } from '../../schema';
  import NearbyPlacesDock from './NearbyPlacesDock.svelte';

  interface Props {
    currentUser: { uid: string; displayName?: string; email?: string; teamIds?: string[] } | null;
  }

  let { currentUser }: Props = $props();

  let entryPromptPlace = $state<TargetPlaceItem | null>(null);
  let showExitPrompt = $state(false);
  let isSubmittingAction = $state(false);
  let elapsedTimeDisplay = $state('0m');
  let activePlaceCached = $state<PlaceDocument | null>(null);
  let placeSettings = $state<PlaceSettings | null>(null);

  // Cooldown mappa: placeId -> timestamp scadenza
  let dismissedCooldowns = $state<Map<string, number>>(new Map());
  let exitDismissedUntil = $state<number>(0);

  let syncChannel: PresenceSyncChannel | null = null;
  let timerInterval: any = null;

  const activePresence = $derived(presenceState.activePresence);
  const nearest = $derived(presenceRadar.nearestPlace);
  const isInside = $derived(presenceRadar.isInsideNearest);

  // Reattività Svelte 5: Caricamento impostazioni modulo presenze
  $effect(() => {
    if (browser) {
      PlaceSettingsService.getSettings().then(s => {
        placeSettings = s;
      }).catch(() => {});
    }
  });

  // Reattività Svelte 5: Caricamento dati utente quando l'autenticazione è pronta
  $effect(() => {
    if (browser && currentUser?.uid) {
      presenceState.loadUserTodayData(currentUser.uid, currentUser.teamIds || []);
    }
  });

  // Reattività Svelte 5: Caricamento metadati cantiere per turno attivo (se non in activeRelevantPlaces)
  $effect(() => {
    if (browser && activePresence?.placeId) {
      const pId = activePresence.placeId;
      const found = presenceRadar.activeRelevantPlaces.find(p => p.id === pId);
      if (!found) {
        PlacesService.getPlaceById(pId).then(p => {
          if (p) activePlaceCached = p;
        }).catch(() => {});
      } else {
        activePlaceCached = null;
      }
    } else {
      activePlaceCached = null;
    }
  });

  // Inizializzazione sincronizzazione multi-tab e timer
  onMount(() => {
    if (!browser) return;

    // Istanzia il canale Broadcast multi-tab
    syncChannel = new PresenceSyncChannel((event) => {
      if (event.type === 'CHECK_IN') {
        entryPromptPlace = null;
        if (currentUser?.uid) {
          presenceState.loadUserTodayData(currentUser.uid, currentUser.teamIds || []);
        }
      } else if (event.type === 'CHECK_OUT') {
        showExitPrompt = false;
        if (currentUser?.uid) {
          presenceState.loadUserTodayData(currentUser.uid, currentUser.teamIds || []);
        }
      } else if (event.type === 'DISMISS_PROMPT') {
        if (entryPromptPlace?.id === event.payload?.placeId) {
          entryPromptPlace = null;
        }
      }
    });

    // Avvia il tick del timer del turno attivo ogni secondo
    timerInterval = setInterval(() => {
      if (activePresence) {
        updateActiveTimer();
      }
    }, 1000);

    return () => {
      syncChannel?.destroy();
      if (timerInterval) clearInterval(timerInterval);
    };
  });

  // Reattività Svelte 5: Gestione Trigger Ingresso (rispetta la modalità configurata e i cooldown)
  $effect(() => {
    // Se c'è già un turno attivo, non mostrare mai il prompt di ingresso
    if (activePresence) {
      entryPromptPlace = null;
      return;
    }

    const promptMode = placeSettings?.presence?.checkInPromptMode || 'prompt';
    if (promptMode === 'manual' || promptMode === 'dock_only') {
      entryPromptPlace = null;
      return;
    }

    if (isInside && nearest) {
      const pId = nearest.place.id;
      const cooldownUntil = dismissedCooldowns.get(pId) || 0;
      const isCooldown = Date.now() < cooldownUntil;

      if (!isCooldown) {
        if (promptMode === 'auto') {
          // Modalità 100% Automatica: esegue subito il check-in senza toast invasivi
          if (!isSubmittingAction && (!entryPromptPlace || entryPromptPlace.id !== pId)) {
            entryPromptPlace = nearest.place;
            handleQuickCheckIn();
          }
        } else if (promptMode === 'prompt') {
          // Modalità Semi-automatica: mostra il prompt interattivo
          if (!entryPromptPlace || entryPromptPlace.id !== pId) {
            entryPromptPlace = nearest.place;
          }
        }
      }
    } else {
      // Se si esce dal raggio prima di aver fatto check-in, chiudi il prompt
      if (entryPromptPlace && (!nearest || (nearest.place?.id === entryPromptPlace.id && !isInside))) {
        entryPromptPlace = null;
      }
    }
  });

  // Reattività Svelte 5: Gestione Trigger Uscita (con Isteresi ed eventuale Auto-Checkout)
  $effect(() => {
    if (!activePresence) {
      showExitPrompt = false;
      return;
    }

    const isExitCooldown = Date.now() < exitDismissedUntil;
    if (isExitCooldown) {
      showExitPrompt = false;
      return;
    }

    // Verifica se il GPS attuale è fuori dal luogo del turno attivo
    const targetPlace = presenceRadar.activeRelevantPlaces.find(p => p.id === activePresence?.placeId);
    const targetLat = targetPlace?.lat ?? activePlaceCached?.address?.coordinates?.lat ?? (activePlaceCached?.latitude as number | undefined) ?? activePresence.geoVerification?.latitude;
    const targetLng = targetPlace?.lng ?? activePlaceCached?.address?.coordinates?.lng ?? (activePlaceCached?.longitude as number | undefined) ?? activePresence.geoVerification?.longitude;
    const radiusMeters = targetPlace?.radiusMeters ?? activePlaceCached?.geofenceRadiusMeters ?? activePresence.geoVerification?.geofenceRadiusMeters ?? 50;

    if (typeof targetLat === 'number' && typeof targetLng === 'number') {
      const isOut = presenceRadar.isOutsidePlaceWithHysteresis(
        targetLat,
        targetLng,
        radiusMeters
      );

      if (isOut) {
        if (placeSettings?.presence?.autoCheckoutOnExit && !isSubmittingAction) {
          handleCompleteCheckOut('regular');
        } else if (!showExitPrompt) {
          showExitPrompt = true;
        }
      } else if (!isOut && showExitPrompt) {
        // Se l'utente è rientrato nel perimetro, nascondi il prompt di uscita
        showExitPrompt = false;
      }
    }
  });

  function updateActiveTimer() {
    if (!activePresence?.clientEnteredAt) {
      elapsedTimeDisplay = '0m';
      return;
    }
    const startMs = new Date(activePresence.clientEnteredAt).getTime();
    const nowMs = Date.now();
    const totalMinutes = Math.max(0, Math.floor((nowMs - startMs) / 60000));

    if (totalMinutes < 60) {
      elapsedTimeDisplay = `${totalMinutes}m`;
    } else {
      const hours = Math.floor(totalMinutes / 60);
      const mins = totalMinutes % 60;
      elapsedTimeDisplay = `${hours}h ${mins}m`;
    }
  }

  // --- AZIONI SMART PROACTIVE ---

  async function handleQuickCheckIn() {
    if (!entryPromptPlace || !currentUser) return;
    const target = entryPromptPlace;
    isSubmittingAction = true;

    try {
      const newLogId = await presenceState.checkIn({
        placeId: target.id,
        placeName: target.name,
        placeCode: target.code,
        targetLat: target.lat,
        targetLng: target.lng,
        radiusMeters: target.radiusMeters,
        activityId: target.activityId,
        activityName: target.activityName,
        userId: currentUser.uid,
        userName: currentUser.displayName || currentUser.email || 'Operatore',
        userEmail: currentUser.email,
        verifiedBy: 'proximity_radar'
      });

      if (newLogId) {
        syncChannel?.notifyCheckIn(target.id, newLogId, target.name);
        entryPromptPlace = null;
        updateActiveTimer();
      }
    } finally {
      isSubmittingAction = false;
    }
  }

  function handleDismissEntry() {
    if (!entryPromptPlace) return;
    const pId = entryPromptPlace.id;
    dismissedCooldowns.set(pId, Date.now() + 10 * 60 * 1000); // 10 min cooldown
    syncChannel?.notifyDismiss(pId);
    entryPromptPlace = null;
  }

  async function handleCompleteCheckOut(reason: 'regular' | 'lunch_break') {
    if (!activePresence) return;
    const currentActive = activePresence;
    const logId = currentActive.id;
    isSubmittingAction = true;

    const notes = reason === 'lunch_break' ? 'In pausa pranzo' : 'Fine turno regolare';

    try {
      const success = await presenceState.checkOut(notes);
      if (success) {
        // Imposta il cooldown post check-out per evitare falsi re-prompt mentre ci si allontana
        const cooldownMin = placeSettings?.presence?.checkoutCooldownMinutes ?? 15;
        dismissedCooldowns.set(currentActive.placeId, Date.now() + cooldownMin * 60 * 1000);

        syncChannel?.notifyCheckOut(logId);
        showExitPrompt = false;
      }
    } finally {
      isSubmittingAction = false;
    }
  }

  function handleDismissExit() {
    exitDismissedUntil = Date.now() + 15 * 60 * 1000; // Silenzia prompt uscita per 15 min
    showExitPrompt = false;
  }
</script>

<!-- ========================================== -->
<!-- 1. TOAST PROATTIVO DI INGRESSO (CHECK-IN)  -->
<!-- ========================================== -->
{#if entryPromptPlace}
  <div class="sentinel-prompt-overlay entry-glow" role="alert">
    <div class="sentinel-card">
      <div class="card-icon-bubble entry-bubble">
        <MapPin size={22} class="text-blue-600" />
      </div>

      <div class="card-content-body">
        <div class="card-badge-row">
          <span class="sentinel-badge entry-badge">
            <Sparkles size={12} />
            Arrivo Rilevato
          </span>
          {#if nearest?.distance !== undefined}
            <span class="distance-pill">a ~{nearest.distance}m</span>
          {/if}
        </div>

        <h4 class="card-title">Sei arrivato a {entryPromptPlace.name}</h4>

        {#if entryPromptPlace.activityName}
          <p class="card-activity-desc">
            <Clock size={13} class="text-indigo-600 inline mr-1" />
            Attività: <strong>{entryPromptPlace.activityName}</strong>
            {#if entryPromptPlace.scheduledTime}
              • {entryPromptPlace.scheduledTime}
            {/if}
          </p>
        {:else}
          <p class="card-prompt-question">Vuoi registrare l'inizio del turno in questo cantiere?</p>
        {/if}

        <div class="card-actions-row">
          <button 
            type="button" 
            class="btn-primary-action checkin-btn"
            disabled={isSubmittingAction}
            onclick={handleQuickCheckIn}
          >
            {#if isSubmittingAction}
              <Loader2 size={16} class="animate-spin" />
              <span>Registrazione...</span>
            {:else}
              <Check size={16} />
              <span>Registra Check-in</span>
            {/if}
          </button>

          <button 
            type="button" 
            class="btn-secondary-action"
            onclick={handleDismissEntry}
            aria-label="Ignora per ora"
          >
            <X size={15} />
            <span>Più tardi</span>
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<!-- ========================================== -->
<!-- 2. PILLOLA STICKY TURNO ATTIVO (GLOBAL)   -->
<!-- ========================================== -->
{#if activePresence && !showExitPrompt}
  <div class="active-shift-sticky-pill">
    <div class="shift-indicator-core">
      <span class="live-dot-pulse"></span>
      <span class="live-dot-solid"></span>
    </div>

    <div class="shift-info-text">
      <span class="shift-place-name">{activePresence.placeName}</span>
      <span class="shift-timer-val">{elapsedTimeDisplay}</span>
    </div>

    <button 
      type="button" 
      class="btn-pill-checkout"
      disabled={isSubmittingAction}
      onclick={() => handleCompleteCheckOut('regular')}
      title="Registra uscita dal cantiere"
    >
      {#if isSubmittingAction}
        <Loader2 size={14} class="animate-spin" />
      {:else}
        <LogOut size={13} />
        <span>Check-out</span>
      {/if}
    </button>
  </div>
{/if}

<!-- ========================================== -->
<!-- 3. TOAST PROATTIVO DI USCITA (CHECK-OUT)   -->
<!-- ========================================== -->
{#if showExitPrompt && activePresence}
  <div class="sentinel-prompt-overlay exit-glow" role="alert">
    <div class="sentinel-card">
      <div class="card-icon-bubble exit-bubble">
        <LogOut size={22} class="text-amber-600" />
      </div>

      <div class="card-content-body">
        <div class="card-badge-row">
          <span class="sentinel-badge exit-badge">
            Partenza dal Luogo
          </span>
          <span class="shift-duration-tag">Turno: {elapsedTimeDisplay}</span>
        </div>

        <h4 class="card-title">Hai lasciato {activePresence.placeName}?</h4>
        <p class="card-prompt-question">
          Il GPS rileva che sei uscito dal perimetro del cantiere. Scegli come aggiornare il tuo turno:
        </p>

        <div class="card-actions-row flex-wrap">
          <button 
            type="button" 
            class="btn-primary-action checkout-btn"
            disabled={isSubmittingAction}
            onclick={() => handleCompleteCheckOut('regular')}
          >
            {#if isSubmittingAction}
              <Loader2 size={16} class="animate-spin" />
            {:else}
              <LogOut size={15} />
              <span>Fine Turno</span>
            {/if}
          </button>

          <button 
            type="button" 
            class="btn-lunch-action"
            disabled={isSubmittingAction}
            onclick={() => handleCompleteCheckOut('lunch_break')}
          >
            <Coffee size={15} />
            <span>Pausa Pranzo</span>
          </button>

          <button 
            type="button" 
            class="btn-secondary-action"
            onclick={handleDismissExit}
          >
            <span>Resta in Turno</span>
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<!-- ========================================== -->
<!-- 4. DOCK LATERALE / FLUTTUANTE LUOGHI VICINI -->
<!-- ========================================== -->
<NearbyPlacesDock {currentUser} />

<style>
  /* Overlay Flottante Toast (Desktop top-right, Mobile top-4 inset) */
  .sentinel-prompt-overlay {
    position: fixed;
    top: 20px;
    right: 24px;
    z-index: 9999;
    max-width: 420px;
    width: calc(100vw - 32px);
    animation: sentinel-slide-in 0.35s cubic-bezier(0.16, 1, 0.3, 1);
  }

  @keyframes sentinel-slide-in {
    from {
      transform: translateY(-20px) scale(0.96);
      opacity: 0;
    }
    to {
      transform: translateY(0) scale(1);
      opacity: 1;
    }
  }

  .sentinel-card {
    display: flex;
    align-items: flex-start;
    gap: 14px;
    background: rgba(255, 255, 255, 0.96);
    border-radius: 16px;
    padding: 16px;
    box-shadow: 0 12px 32px rgba(15, 23, 42, 0.16), 0 2px 6px rgba(15, 23, 42, 0.08);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(226, 232, 240, 0.8);
  }

  .entry-glow .sentinel-card {
    border-color: #93c5fd;
    box-shadow: 0 12px 32px rgba(37, 99, 235, 0.18), 0 2px 6px rgba(37, 99, 235, 0.1);
  }

  .exit-glow .sentinel-card {
    border-color: #fcd34d;
    box-shadow: 0 12px 32px rgba(217, 119, 6, 0.18), 0 2px 6px rgba(217, 119, 6, 0.1);
  }

  .card-icon-bubble {
    width: 42px;
    height: 42px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .entry-bubble {
    background: #eff6ff;
  }

  .exit-bubble {
    background: #fef3c7;
  }

  .card-content-body {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .card-badge-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .sentinel-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: 20px;
    text-transform: uppercase;
    letter-spacing: 0.02em;
  }

  .entry-badge {
    background: #dbeafe;
    color: #1e40af;
  }

  .exit-badge {
    background: #fef3c7;
    color: #92400e;
  }

  .distance-pill, .shift-duration-tag {
    font-size: 11px;
    font-weight: 600;
    color: #64748b;
    background: #f1f5f9;
    padding: 2px 6px;
    border-radius: 4px;
  }

  .card-title {
    font-size: 15px;
    font-weight: 700;
    color: #0f172a;
    margin: 0;
    line-height: 1.25;
  }

  .card-activity-desc {
    font-size: 12px;
    color: #334155;
    margin: 0;
    line-height: 1.4;
  }

  .card-prompt-question {
    font-size: 12px;
    color: #64748b;
    margin: 0;
    line-height: 1.35;
  }

  .card-actions-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 6px;
  }

  .btn-primary-action {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 7px 14px;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 700;
    border: none;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .checkin-btn {
    background: #2563eb;
    color: #ffffff;
    box-shadow: 0 2px 6px rgba(37, 99, 235, 0.3);
  }

  .checkin-btn:hover:not(:disabled) {
    background: #1d4ed8;
  }

  .checkout-btn {
    background: #d97706;
    color: #ffffff;
    box-shadow: 0 2px 6px rgba(217, 119, 6, 0.3);
  }

  .checkout-btn:hover:not(:disabled) {
    background: #b45309;
  }

  .btn-lunch-action {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 7px 12px;
    background: #f8fafc;
    border: 1px solid #cbd5e1;
    color: #334155;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-lunch-action:hover:not(:disabled) {
    background: #f1f5f9;
    color: #0f172a;
  }

  .btn-secondary-action {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 7px 10px;
    background: transparent;
    border: 1px solid transparent;
    color: #64748b;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-secondary-action:hover {
    background: #f1f5f9;
    color: #1e293b;
  }

  /* Pillola Sticky Turno Attivo (Discreta in alto o in basso mobile) */
  .active-shift-sticky-pill {
    position: fixed;
    top: 14px;
    right: 70px;
    z-index: 9000;
    display: flex;
    align-items: center;
    gap: 10px;
    background: rgba(255, 255, 255, 0.95);
    border: 1px solid #86efac;
    padding: 5px 10px 5px 12px;
    border-radius: 30px;
    box-shadow: 0 4px 14px rgba(22, 101, 52, 0.12);
    backdrop-filter: blur(8px);
    animation: sentinel-slide-in 0.3s ease;
  }

  .shift-indicator-core {
    position: relative;
    width: 10px;
    height: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .live-dot-pulse {
    position: absolute;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: rgba(34, 197, 94, 0.4);
    animation: shift-pulse 2s infinite;
  }

  .live-dot-solid {
    position: relative;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #16a34a;
  }

  @keyframes shift-pulse {
    0% { transform: scale(0.6); opacity: 1; }
    70% { transform: scale(2.2); opacity: 0.1; }
    100% { transform: scale(2.4); opacity: 0; }
  }

  .shift-info-text {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
  }

  .shift-place-name {
    font-weight: 700;
    color: #14532d;
    max-width: 160px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .shift-timer-val {
    font-weight: 600;
    color: #16a34a;
    background: #dcfce7;
    padding: 1px 6px;
    border-radius: 10px;
    font-size: 11px;
  }

  .btn-pill-checkout {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    background: #fee2e2;
    color: #b91c1c;
    border: 1px solid #fca5a5;
    border-radius: 20px;
    font-size: 11px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-pill-checkout:hover {
    background: #fecaca;
  }

  @media (max-width: 768px) {
    .active-shift-sticky-pill {
      top: auto;
      bottom: 80px;
      right: 16px;
      left: 16px;
      justify-content: space-between;
      border-radius: 12px;
      padding: 8px 12px;
    }
  }
</style>
