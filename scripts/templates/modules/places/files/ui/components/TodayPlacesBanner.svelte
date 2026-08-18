<script lang="ts">
  import { 
    CalendarDays, 
    MapPin, 
    Navigation, 
    Clock, 
    ExternalLink, 
    ChevronRight,
    Sparkles,
    CheckCircle2
  } from '@lucide/svelte';
  import { presenceState } from '../../application/presenceState.svelte';
  import { presenceRadar } from '../../application/presenceRadar.svelte';
  import PresenceCheckInButton from './PresenceCheckInButton.svelte';

  interface Props {
    currentUser: { uid: string; displayName?: string; email?: string } | null;
  }

  let { currentUser }: Props = $props();

  const activities = $derived(presenceState.todayActivities);
  const activeLog = $derived(presenceState.activePresence);

  // Mappa univoca dei luoghi di oggi
  const todayPlacesList = $derived.by(() => {
    const list: any[] = [];
    const seen = new Set<string>();

    for (const act of activities) {
      if (act.placeId && !seen.has(act.placeId)) {
        seen.add(act.placeId);
        list.push({
          id: act.placeId,
          name: act.placeName || act.placeSummary?.name || 'Luogo',
          code: act.placeSummary?.code,
          address: act.placeSummary?.shortAddress || act.placeSummary?.address,
          coordinates: act.placeSummary?.coordinates,
          radiusMeters: act.placeSummary?.radiusMeters || 50,
          activity: { id: act.id, name: act.title || act.name, slot: act.scheduledSlot, time: act.customStartTime }
        });
      }
    }
    return list;
  });

  function getDirectionsUrl(lat: number, lng: number): string {
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  }
</script>

{#if todayPlacesList.length > 0}
  <div class="today-banner-container">
    <div class="banner-header">
      <div class="banner-title-box">
        <div class="banner-icon-badge">
          <CalendarDays size={18} />
        </div>
        <div>
          <h2 class="banner-title">I Tuoi Luoghi di Oggi</h2>
          <p class="banner-subtitle">
            Hai {todayPlacesList.length} {todayPlacesList.length === 1 ? 'luogo programmato' : 'luoghi programmati'} per la giornata di oggi
          </p>
        </div>
      </div>

      {#if activeLog}
        <div class="banner-active-pill">
          <CheckCircle2 size={14} class="text-emerald-600" />
          <span>Al lavoro presso: <strong>{activeLog.placeName}</strong></span>
        </div>
      {/if}
    </div>

    <!-- Griglia Luoghi di Oggi -->
    <div class="today-places-grid">
      {#each todayPlacesList as item (item.id)}
        {@const isCurrentActive = activeLog?.placeId === item.id}
        {@const isNearest = presenceRadar.nearestPlace?.place.id === item.id}
        {@const distance = isNearest ? presenceRadar.nearestPlace?.distance : null}

        <div class="today-place-card {isCurrentActive ? 'card-active-shift' : ''}">
          <div class="today-place-header">
            <div class="today-place-info">
              <div class="place-name-row">
                <MapPin size={16} class="text-blue-600 flex-shrink-0" />
                <h3 class="place-name-heading">{item.name}</h3>
                {#if item.code}
                  <span class="place-code-tag">{item.code}</span>
                {/if}
              </div>
              {#if item.address}
                <p class="place-address-line">{item.address}</p>
              {/if}
            </div>

            {#if item.coordinates?.lat && item.coordinates?.lng}
              <a 
                href={getDirectionsUrl(item.coordinates.lat, item.coordinates.lng)}
                target="_blank" 
                rel="noopener noreferrer"
                class="btn-directions"
                title="Apri Navigatore"
              >
                <Navigation size={13} />
                <span>Naviga</span>
                <ExternalLink size={11} />
              </a>
            {/if}
          </div>

          <!-- Dettaglio Attività Associata -->
          {#if item.activity}
            <div class="today-activity-tag">
              <Clock size={12} class="text-indigo-600" />
              <span class="act-name">{item.activity.name}</span>
              {#if item.activity.time || item.activity.slot}
                <span class="act-time">• {item.activity.time || item.activity.slot}</span>
              {/if}
            </div>
          {/if}

          <!-- Azione Rapida Check-in -->
          <div class="today-checkin-wrapper">
            <PresenceCheckInButton 
              place={item} 
              activity={item.activity} 
              {currentUser} 
            />
          </div>
        </div>
      {/each}
    </div>
  </div>
{/if}

<style>
  .today-banner-container {
    background: linear-gradient(135deg, #f8fafc 0%, #eff6ff 100%);
    border: 1px solid #dbeafe;
    border-radius: 16px;
    padding: 18px 20px;
    margin-bottom: 24px;
    box-shadow: 0 4px 12px rgba(37, 99, 235, 0.04);
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .banner-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
  }

  .banner-title-box {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .banner-icon-badge {
    width: 38px;
    height: 38px;
    background: #3b82f6;
    color: #ffffff;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 8px rgba(59, 130, 246, 0.25);
  }

  .banner-title {
    font-size: 17px;
    font-weight: 700;
    color: #0f172a;
    margin: 0;
  }

  .banner-subtitle {
    font-size: 13px;
    color: #64748b;
    margin: 0;
  }

  .banner-active-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: #ffffff;
    border: 1px solid #a7f3d0;
    color: #065f46;
    padding: 6px 12px;
    border-radius: 20px;
    font-size: 12px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.02);
  }

  .today-places-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 14px;
  }

  .today-place-card {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    transition: all 0.2s ease;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.02);
  }

  .today-place-card:hover {
    border-color: #cbd5e1;
    transform: translateY(-1px);
    box-shadow: 0 6px 12px rgba(0, 0, 0, 0.04);
  }

  .today-place-card.card-active-shift {
    border-color: #86efac;
    background: #f0fdf4;
  }

  .today-place-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 10px;
  }

  .today-place-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
    min-width: 0;
  }

  .place-name-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .place-name-heading {
    font-size: 14px;
    font-weight: 700;
    color: #1e293b;
    margin: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .place-code-tag {
    font-size: 10px;
    font-weight: 700;
    background: #eff6ff;
    color: #2563eb;
    padding: 1px 5px;
    border-radius: 4px;
  }

  .place-address-line {
    font-size: 12px;
    color: #64748b;
    margin: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .btn-directions {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: #eff6ff;
    color: #1d4ed8;
    border: 1px solid #bfdbfe;
    padding: 5px 8px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 600;
    text-decoration: none;
    flex-shrink: 0;
    transition: all 0.15s ease;
  }

  .btn-directions:hover {
    background: #dbeafe;
  }

  .today-activity-tag {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: #e0e7ff;
    color: #3730a3;
    padding: 4px 8px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 600;
  }

  .act-name {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 180px;
  }

  .act-time {
    color: #4f46e5;
  }

  .today-checkin-wrapper {
    margin-top: 4px;
    padding-top: 8px;
    border-top: 1px dashed #e2e8f0;
  }
</style>
