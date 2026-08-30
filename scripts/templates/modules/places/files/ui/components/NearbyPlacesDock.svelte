<script lang="ts">
  import { presenceRadar } from '../../application/presenceRadar.svelte';
  import { presenceState } from '../../application/presenceState.svelte';
  import { toast } from '$lib/stores/toast.svelte';
  import { 
    MapPin, 
    Navigation, 
    Check, 
    Loader2, 
    ChevronDown, 
    ChevronUp, 
    Sparkles, 
    Radio,
    Compass
  } from '@lucide/svelte';

  interface Props {
    currentUser: { uid: string; displayName?: string; email?: string; teamIds?: string[] } | null;
  }

  let { currentUser }: Props = $props();

  let isExpanded = $state(false);
  let submittingPlaceId = $state<string | null>(null);

  const nearby = $derived(presenceRadar.nearbyPlaces);
  const activePresence = $derived(presenceState.activePresence);
  const userCoords = $derived(presenceRadar.currentCoords);

  // Filtra i luoghi rilevanti entro 1000m o all'interno del geofence
  const displayPlaces = $derived(
    nearby.filter(item => item.isInside || item.distance <= 1000)
  );

  async function handleQuickCheckIn(item: (typeof nearby)[0]) {
    if (!currentUser?.uid || submittingPlaceId) return;
    submittingPlaceId = item.place.id;

    try {
      await presenceState.checkIn({
        placeId: item.place.id,
        placeName: item.place.name,
        placeCode: item.place.code,
        activityId: item.place.activityId,
        activityName: item.place.activityName,
        targetLat: item.place.lat,
        targetLng: item.place.lng,
        radiusMeters: item.place.radiusMeters,
        userId: currentUser.uid,
        userName: currentUser.displayName || currentUser.email || 'Operatore',
        userEmail: currentUser.email,
        mode: 'proximity_radar'
      });

      toast.success(`Check-in registrato con successo a ${item.place.name}`);
      isExpanded = false;
    } catch (err: any) {
      toast.error(`Errore durante il check-in: ${err.message || err}`);
    } finally {
      submittingPlaceId = null;
    }
  }
</script>

{#if displayPlaces.length > 0 && !activePresence}
  <div class="nearby-dock-container" class:expanded={isExpanded}>
    <!-- Trigger Pill Discreta -->
    <button 
      class="dock-toggle-btn"
      onclick={() => isExpanded = !isExpanded}
      aria-label="Luoghi vicini disponibili per il check-in"
    >
      <div class="dock-indicator-pulse">
        <Radio size={14} class="text-blue-500 animate-pulse" />
      </div>
      <div class="dock-title-text">
        <span class="font-semibold text-slate-800">
          {displayPlaces.length === 1 ? '1 cantiere vicino' : `${displayPlaces.length} cantieri vicini`}
        </span>
        <span class="dock-nearest-sub">
          {displayPlaces[0].isInside ? 'Nel perimetro' : `a ${displayPlaces[0].distance}m`}
        </span>
      </div>
      <div class="dock-toggle-icon">
        {#if isExpanded}
          <ChevronDown size={16} />
        {:else}
          <ChevronUp size={16} />
        {/if}
      </div>
    </button>

    <!-- Pannello Espanso dei Luoghi Vicini -->
    {#if isExpanded}
      <div class="dock-dropdown-panel">
        <div class="panel-header">
          <div class="flex items-center gap-1.5 font-bold text-xs uppercase tracking-wider text-slate-500">
            <Compass size={14} class="text-blue-600" />
            <span>Check-in Disponibili</span>
          </div>
          <span class="text-[11px] text-slate-400">GPS Live</span>
        </div>

        <div class="places-list">
          {#each displayPlaces as item (item.place.id)}
            <div class="place-row" class:inside={item.isInside}>
              <div class="place-info">
                <div class="place-name-row">
                  <MapPin size={14} class={item.isInside ? 'text-emerald-600' : 'text-slate-400'} />
                  <span class="place-name">{item.place.name}</span>
                </div>
                {#if item.place.activityName}
                  <div class="place-activity-name">
                    Task: {item.place.activityName}
                  </div>
                {/if}
                <div class="place-distance-badge" class:badge-inside={item.isInside}>
                  {#if item.isInside}
                    <span class="dot-live-green"></span>
                    <span>Nel perimetro ({item.distance}m)</span>
                  {:else}
                    <span>Distanza: {item.distance}m</span>
                  {/if}
                </div>
              </div>

              <button 
                class="btn-quick-checkin"
                class:btn-primary={item.isInside}
                class:btn-secondary={!item.isInside}
                onclick={() => handleQuickCheckIn(item)}
                disabled={submittingPlaceId !== null}
              >
                {#if submittingPlaceId === item.place.id}
                  <Loader2 size={13} class="animate-spin" />
                  <span>Timbratura...</span>
                {:else}
                  <Check size={13} />
                  <span>Timbra</span>
                {/if}
              </button>
            </div>
          {/each}
        </div>
      </div>
    {/if}
  </div>
{/if}

<style>
  .nearby-dock-container {
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: 9980;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    font-family: inherit;
    pointer-events: auto;
  }

  .dock-toggle-btn {
    display: flex;
    align-items: center;
    gap: 10px;
    background: #ffffff;
    border: 1px solid #e2e8f0;
    padding: 8px 14px;
    border-radius: 9999px;
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.04);
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .dock-toggle-btn:hover {
    border-color: #cbd5e1;
    transform: translateY(-1px);
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.12);
  }

  .dock-indicator-pulse {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .dock-title-text {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    font-size: 12px;
    line-height: 1.2;
    text-align: left;
  }

  .dock-nearest-sub {
    font-size: 10px;
    color: #64748b;
  }

  .dock-toggle-icon {
    color: #64748b;
    margin-left: 2px;
  }

  .dock-dropdown-panel {
    width: 320px;
    max-width: calc(100vw - 32px);
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 14px;
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05);
    margin-bottom: 8px;
    overflow: hidden;
    animation: dockFadeSlide 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  }

  @keyframes dockFadeSlide {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 14px;
    background: #f8fafc;
    border-bottom: 1px solid #f1f5f9;
  }

  .places-list {
    max-height: 240px;
    overflow-y: auto;
    padding: 6px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .place-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 10px;
    background: #ffffff;
    border: 1px solid #f1f5f9;
    border-radius: 8px;
    transition: all 0.15s ease;
  }

  .place-row.inside {
    background: #f0fdf4;
    border-color: #bbf7d0;
  }

  .place-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    max-width: 190px;
  }

  .place-name-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .place-name {
    font-size: 12px;
    font-weight: 600;
    color: #0f172a;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .place-activity-name {
    font-size: 10px;
    color: #475569;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .place-distance-badge {
    font-size: 10px;
    color: #64748b;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .badge-inside {
    color: #15803d;
    font-weight: 600;
  }

  .dot-live-green {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background-color: #22c55e;
  }

  .btn-quick-checkin {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 6px 10px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
    border: none;
    flex-shrink: 0;
  }

  .btn-primary {
    background: #10b981;
    color: #ffffff;
  }

  .btn-primary:hover {
    background: #059669;
  }

  .btn-secondary {
    background: #f1f5f9;
    color: #334155;
  }

  .btn-secondary:hover {
    background: #e2e8f0;
  }

  .btn-quick-checkin:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
</style>
