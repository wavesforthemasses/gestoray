<script lang="ts">
  import { browser } from '$app/environment';
  import type { PlaceDocument } from '../../domain/models/place';
  import { 
    MapPin, 
    WifiOff, 
    Crosshair, 
    Navigation, 
    Loader2, 
    Compass,
    Layers, 
    ZoomIn 
  } from '@lucide/svelte';
  import { presenceRadar } from '../../application/presenceRadar.svelte';

  interface Props {
    places?: PlaceDocument[];
    selectedPlaceId?: string | null;
    center?: { lat: number; lng: number };
    zoom?: number;
    height?: string;
    interactivePicker?: boolean;
    pickerLocation?: { lat: number; lng: number } | null;
    pickerRadiusMeters?: number;
    parentLocation?: { lat: number; lng: number; name?: string; radiusMeters?: number } | null;
    onSelectPlace?: (place: PlaceDocument) => void;
    onLocationPick?: (coords: { lat: number; lng: number }) => void;
  }

  let {
    places = [],
    selectedPlaceId = null,
    center = { lat: 45.4642, lng: 9.1900 },
    zoom = 13,
    height = '480px',
    interactivePicker = false,
    pickerLocation = null,
    pickerRadiusMeters = 100,
    parentLocation = null,
    onSelectPlace,
    onLocationPick
  }: Props = $props();

  let mapContainer = $state<HTMLDivElement | null>(null);
  let mapInstance: any = null;
  let layerGroup: any = null;
  let pickerLayer: any = null;
  let userLocationLayer: any = null;
  let userMarkerInstance: any = null;
  let userCircleInstance: any = null;
  let L: any = null;
  let isOffline = $state(false);

  // Stato per Geolocalizzazione Live Utente e Modalità "Seguimi"
  let isFollowMode = $state(false);
  let isLocating = $state(false);
  let watchId: number | null = null;

  const userCoords = $derived(presenceRadar.currentCoords);

  $effect(() => {
    if (browser) {
      isOffline = !navigator.onLine;
      const onOnline = () => { isOffline = false; };
      const onOffline = () => { isOffline = true; };
      window.addEventListener('online', onOnline);
      window.addEventListener('offline', onOffline);
      return () => {
        window.removeEventListener('online', onOnline);
        window.removeEventListener('offline', onOffline);
      };
    }
  });

  // Avvio continuo del tracking di geolocalizzazione live
  $effect(() => {
    if (!browser || !navigator.geolocation) return;

    // Richiesta immediata della posizione all'apertura della mappa
    presenceRadar.requestImmediatePosition();

    // Avvia watchPosition per aggiornamenti GPS in movimento
    try {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          presenceRadar.updateCoords(
            pos.coords.latitude,
            pos.coords.longitude,
            pos.coords.accuracy
          );
          presenceRadar.permissionStatus = 'granted';
        },
        (err) => {
          if (err.code === err.PERMISSION_DENIED) {
            presenceRadar.permissionStatus = 'denied';
          }
        },
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
      );
    } catch (_) {}

    return () => {
      if (watchId !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
      }
    };
  });

  // Inizializzazione protetta con Teardown Anti-Memory Leak
  $effect(() => {
    if (!browser || !mapContainer) return;
    let isMounted = true;

    async function initMap() {
      L = await import('leaflet');
      if (!isMounted || !mapContainer) return;

      // Fix per i path delle icone con bundler Vite
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
      });

      const initialCenter = pickerLocation || parentLocation || (places.length > 0 && places[0].geo?.location ? {
        lat: (places[0].geo.location as any).latitude ?? (places[0].geo.location as any).lat,
        lng: (places[0].geo.location as any).longitude ?? (places[0].geo.location as any).lng
      } : center);

      mapInstance = L.map(mapContainer, {
        zoomControl: true,
        scrollWheelZoom: true
      }).setView([initialCenter.lat, initialCenter.lng], zoom);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19
      }).addTo(mapInstance);

      layerGroup = L.layerGroup().addTo(mapInstance);
      pickerLayer = L.layerGroup().addTo(mapInstance);
      userLocationLayer = L.layerGroup().addTo(mapInstance);

      // Disattiva la modalità "Seguimi" se l'utente trascina manualmente la mappa
      mapInstance.on('dragstart', () => {
        if (isFollowMode) {
          isFollowMode = false;
        }
      });

      if (interactivePicker) {
        mapInstance.on('click', (e: any) => {
          isFollowMode = false;
          const lat = e.latlng.lat;
          const lng = e.latlng.lng;
          onLocationPick?.({ lat, lng });
        });
      }

      renderMarkers();
      renderPicker();
      renderUserLocation();
    }

    initMap();

    // Teardown completo all'unmount
    return () => {
      isMounted = false;
      if (mapInstance) {
        mapInstance.remove();
        mapInstance = null;
      }
    };
  });

  // Reattività Svelte 5 su aggiornamento luoghi / selezione
  $effect(() => {
    const _p = places;
    const _s = selectedPlaceId;
    if (mapInstance && layerGroup && L) {
      renderMarkers();
    }
  });

  // Reattività Svelte 5 su aggiornamento picker
  $effect(() => {
    const _loc = pickerLocation;
    const _rad = pickerRadiusMeters;
    const _parent = parentLocation;
    const _z = zoom;
    if (mapInstance && pickerLayer && L) {
      renderPicker();
    }
  });

  // Reattività Svelte 5 su coordinate utente & Modalità Seguimi
  $effect(() => {
    const coords = userCoords;
    if (mapInstance && userLocationLayer && L) {
      renderUserLocation();

      // Se "Seguimi" è attivo, sposta la visuale centrando sull'utente
      if (isFollowMode && coords) {
        mapInstance.panTo([coords.lat, coords.lng], { animate: true, duration: 0.8 });
      }
    }
  });

  // Disattiva "Seguimi" se viene cambiato il luogo selezionato o il picker
  $effect(() => {
    if (pickerLocation || selectedPlaceId) {
      // Non disattivare al primo mount se non c'è interazione esplicita
    }
  });

  /**
   * Renderizza o aggiorna in-place il marker e il raggio di precisione live dell'utente (Zero Flicker)
   */
  function renderUserLocation() {
    if (!userLocationLayer || !L || !mapInstance) return;

    const coords = userCoords;
    if (!coords || typeof coords.lat !== 'number' || typeof coords.lng !== 'number') {
      if (userMarkerInstance) {
        userLocationLayer.removeLayer(userMarkerInstance);
        userMarkerInstance = null;
      }
      if (userCircleInstance) {
        userLocationLayer.removeLayer(userCircleInstance);
        userCircleInstance = null;
      }
      return;
    }

    const userLatLng = [coords.lat, coords.lng] as [number, number];

    const popupHtml = `
      <div style="font-family: inherit; font-size: 12px; padding: 4px;">
        <div style="font-size: 10px; font-weight: 700; color: #2563eb; text-transform: uppercase; margin-bottom: 2px; display: flex; align-items: center; gap: 4px;">
          <svg style="width: 12px; height: 12px; stroke: currentColor; fill: none; stroke-width: 2;" viewBox="0 0 24 24"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></svg>
          La Tua Posizione Live
        </div>
        <div style="font-weight: 600; color: #0f172a;">
          ${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}
        </div>
        <div style="font-size: 11px; color: #64748b; margin-top: 2px;">
          ${(coords.accuracy && coords.accuracy > 1500) ? 'Posizione stimata da rete IP/WiFi (nessun GPS hardware)' : `Accuratezza segnale: ±${Math.round(coords.accuracy || 0)}m`}
        </div>
      </div>
    `;

    // 1. Aggiorna in-place o crea il marker utente
    if (userMarkerInstance) {
      userMarkerInstance.setLatLng(userLatLng);
      const popup = userMarkerInstance.getPopup();
      if (popup) {
        popup.setContent(popupHtml);
      }
    } else {
      const userPulseIcon = L.divIcon({
        className: 'user-gps-marker-wrapper',
        html: `
          <div class="user-live-gps-dot">
            <div class="gps-pulse-halo"></div>
            <div class="gps-dot-core"></div>
          </div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });

      userMarkerInstance = L.marker(userLatLng, {
        icon: userPulseIcon,
        zIndexOffset: 1000,
        title: 'La tua posizione'
      }).bindPopup(popupHtml);

      userLocationLayer.addLayer(userMarkerInstance);
    }

    // 2. Aggiorna in-place o crea il cerchio di accuratezza GPS reale
    const shouldShowCircle = coords.accuracy && coords.accuracy > 5 && coords.accuracy <= 1500;
    if (shouldShowCircle) {
      if (userCircleInstance) {
        userCircleInstance.setLatLng(userLatLng);
        userCircleInstance.setRadius(coords.accuracy);
      } else {
        userCircleInstance = L.circle(userLatLng, {
          radius: coords.accuracy,
          color: '#3b82f6',
          fillColor: '#60a5fa',
          fillOpacity: 0.12,
          weight: 1
        });
        userLocationLayer.addLayer(userCircleInstance);
      }
    } else {
      if (userCircleInstance) {
        userLocationLayer.removeLayer(userCircleInstance);
        userCircleInstance = null;
      }
    }
  }

  /**
   * Centra la mappa sulla posizione dell'utente (senza inseguimento continuo)
   */
  async function centerOnUser() {
    isLocating = true;
    let coords = userCoords;
    if (!coords) {
      coords = await presenceRadar.requestImmediatePosition();
    }
    isLocating = false;

    if (coords && mapInstance) {
      mapInstance.flyTo([coords.lat, coords.lng], 16, { duration: 1.2 });
    }
  }

  /**
   * Attiva/Disattiva la modalità "Seguimi" (insegue la posizione man mano che ci si sposta)
   */
  async function toggleFollowMode() {
    if (!isFollowMode) {
      isFollowMode = true;
      isLocating = true;
      let coords = userCoords;
      if (!coords) {
        coords = await presenceRadar.requestImmediatePosition();
      }
      isLocating = false;

      if (coords && mapInstance) {
        mapInstance.flyTo([coords.lat, coords.lng], Math.max(mapInstance.getZoom(), 16), { duration: 1.0 });
      }
    } else {
      isFollowMode = false;
    }
  }

  function renderPicker() {
    if (!pickerLayer || !L || !mapInstance) return;
    pickerLayer.clearLayers();

    // Se esiste una posizione genitore, mostra il perimetro e il riferimento del cantiere principale
    if (parentLocation) {
      const parentLatLng = [parentLocation.lat, parentLocation.lng];
      const parentMarker = L.circleMarker(parentLatLng, {
        radius: 8,
        color: '#7c3aed',
        fillColor: '#8b5cf6',
        fillOpacity: 0.8,
        weight: 2
      }).bindPopup(`
        <div style="font-family: inherit; font-size: 12px; padding: 4px;">
          <div style="font-size: 10px; font-weight: 700; color: #7c3aed; text-transform: uppercase;">Sito Principale / Padre</div>
          <div style="font-weight: 600; color: #0f172a;">${parentLocation.name || 'Cantiere Genitore'}</div>
        </div>
      `);
      pickerLayer.addLayer(parentMarker);

      if (parentLocation.radiusMeters && parentLocation.radiusMeters > 0) {
        const parentCircle = L.circle(parentLatLng, {
          radius: parentLocation.radiusMeters,
          color: '#7c3aed',
          fillColor: '#a78bfa',
          fillOpacity: 0.08,
          weight: 1.5,
          dashArray: '6, 6'
        });
        pickerLayer.addLayer(parentCircle);
      }
    }

    if (!pickerLocation) {
      if (parentLocation) {
        mapInstance.setView([parentLocation.lat, parentLocation.lng], zoom || 18);
      }
      return;
    }

    const latLng = [pickerLocation.lat, pickerLocation.lng];
    const marker = L.marker(latLng, {
      title: 'Punto Selezionato'
    }).bindPopup('<div class="p-1 font-semibold text-xs text-slate-800">Coordinate Selezionate</div>');
    pickerLayer.addLayer(marker);

    if (pickerRadiusMeters > 0) {
      const circle = L.circle(latLng, {
        radius: pickerRadiusMeters,
        color: '#2563eb',
        fillColor: '#3b82f6',
        fillOpacity: 0.18,
        weight: 2
      });
      pickerLayer.addLayer(circle);
    }

    const targetZoom = zoom || (parentLocation ? 18 : Math.max(mapInstance.getZoom(), 15));
    mapInstance.setView(latLng, targetZoom);
  }

  function renderMarkers() {
    if (!layerGroup || !L || !mapInstance) return;
    layerGroup.clearLayers();

    if (places.length === 0) return;

    const bounds = L.latLngBounds([]);
    let validMarkersCount = 0;

    for (const place of places) {
      if (!place.geo?.location) continue;

      const pLat = (place.geo.location as any).latitude ?? (place.geo.location as any).lat;
      const pLng = (place.geo.location as any).longitude ?? (place.geo.location as any).lng;
      if (typeof pLat !== 'number' || typeof pLng !== 'number') continue;

      const isSelected = place.id === selectedPlaceId;
      const latLng = [pLat, pLng];

      bounds.extend(latLng);
      validMarkersCount++;

      const typeLabels = (place.types || ['site']).map(t => {
        if (t === 'site') return 'Cantiere';
        if (t === 'warehouse') return 'Magazzino';
        if (t === 'headquarters') return 'Sede Legale';
        if (t === 'branch') return 'Filiale';
        if (t === 'store') return 'Showroom';
        return t;
      }).join(', ');

      const marker = L.marker(latLng)
        .bindPopup(`
          <div style="font-family: inherit; min-width: 180px; padding: 4px;">
            <div style="font-size: 11px; font-weight: 700; color: #2563eb; text-transform: uppercase; margin-bottom: 2px;">
              ${typeLabels}
            </div>
            <h4 style="font-weight: 700; font-size: 14px; color: #0f172a; margin: 0 0 4px 0;">
              ${place.name}
            </h4>
            <p style="font-size: 12px; color: #64748b; margin: 0 0 6px 0;">
              ${place.summary?.shortAddress || place.address?.formattedAddress || ''}
            </p>
            ${place.code ? `<span style="display: inline-block; font-size: 10px; background: #f1f5f9; padding: 2px 6px; border-radius: 4px; color: #475569; font-weight: 600;">${place.code}</span>` : ''}
          </div>
        `);

      marker.on('click', () => {
        isFollowMode = false;
        onSelectPlace?.(place);
      });
      layerGroup.addLayer(marker);

      // Rendering Geofence Visivo
      if (place.geo.radiusMeters) {
        const circle = L.circle(latLng, {
          radius: place.geo.radiusMeters,
          color: isSelected ? '#2563eb' : '#64748b',
          fillColor: isSelected ? '#3b82f6' : '#94a3b8',
          fillOpacity: isSelected ? 0.22 : 0.12,
          weight: isSelected ? 2 : 1,
          dashArray: isSelected ? undefined : '4, 4'
        });
        layerGroup.addLayer(circle);
      }
    }

    // Auto-fit dinamico del viewport se non ci sono selezioni attive
    if (validMarkersCount > 0 && !selectedPlaceId && !interactivePicker && !isFollowMode) {
      mapInstance.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
    }
  }
</script>

<svelte:head>
  <link 
    rel="stylesheet" 
    href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" 
    integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" 
    crossorigin="" 
  />
</svelte:head>

<div class="map-viewer-wrapper" style="height: {height};">
  {#if isOffline}
    <div class="offline-badge">
      <WifiOff size={14} />
      <span>Mappa Offline (Tile in cache)</span>
    </div>
  {/if}

  <!-- Controlli Mappa Flottanti (Centra su di me & Seguimi) -->
  <div class="map-floating-controls">
    <button 
      type="button" 
      class="map-ctrl-btn"
      onclick={centerOnUser}
      title="Centra sulla mia posizione attuale"
    >
      {#if isLocating}
        <Loader2 size={16} class="animate-spin text-blue-600" />
      {:else}
        <Crosshair size={16} />
      {/if}
      <span class="btn-label">La Mia Posizione</span>
    </button>

    <button 
      type="button" 
      class="map-ctrl-btn follow-toggle"
      class:active-follow={isFollowMode}
      onclick={toggleFollowMode}
      title={isFollowMode ? "Modalità 'Seguimi' attiva (la mappa ti segue). Clicca per disattivare." : "Attiva modalità 'Seguimi' (la mappa si sposta in tempo reale con la tua posizione)"}
    >
      <Navigation size={16} class={isFollowMode ? 'nav-pulse-icon' : ''} />
      <span class="btn-label">{isFollowMode ? 'Seguimi: ATTIVO' : 'Seguimi'}</span>
    </button>
  </div>

  <div bind:this={mapContainer} class="map-container"></div>
</div>

<style>
  .map-viewer-wrapper {
    position: relative;
    width: 100%;
    border-radius: 12px;
    overflow: hidden;
    border: 1px solid var(--border-color, #e2e8f0);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.04);
    background: #f8fafc;
  }

  .map-container {
    width: 100%;
    height: 100%;
    z-index: 1;
  }

  /* Controlli Flottanti di Navigazione Mappa */
  .map-floating-controls {
    position: absolute;
    top: 12px;
    right: 12px;
    z-index: 1000;
    display: flex;
    align-items: center;
    gap: 8px;
    background: rgba(255, 255, 255, 0.94);
    padding: 4px;
    border-radius: 10px;
    border: 1px solid rgba(226, 232, 240, 0.85);
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.08);
    backdrop-filter: blur(8px);
  }

  .map-ctrl-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    color: #334155;
    cursor: pointer;
    transition: all 0.18s ease;
  }

  .map-ctrl-btn:hover {
    background: #f1f5f9;
    color: #0f172a;
  }

  .map-ctrl-btn .btn-label {
    display: inline-block;
  }

  @media (max-width: 640px) {
    .map-ctrl-btn .btn-label {
      display: none;
    }
  }

  .follow-toggle.active-follow {
    background: #2563eb;
    color: #ffffff;
    border-color: #1d4ed8;
    box-shadow: 0 2px 8px rgba(37, 99, 235, 0.35);
  }

  .follow-toggle.active-follow:hover {
    background: #1d4ed8;
    color: #ffffff;
  }

  :global(.nav-pulse-icon) {
    animation: nav-rotate-bounce 1.8s ease-in-out infinite;
  }

  @keyframes nav-rotate-bounce {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.2); }
  }

  .offline-badge {
    position: absolute;
    bottom: 12px;
    left: 12px;
    z-index: 1000;
    display: flex;
    align-items: center;
    gap: 6px;
    background: rgba(15, 23, 42, 0.88);
    color: #f8fafc;
    font-size: 11px;
    font-weight: 600;
    padding: 6px 10px;
    border-radius: 20px;
    backdrop-filter: blur(8px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  }

  /* Stili Marker GPS Live Utente (Globali per Leaflet divIcon) */
  :global(.user-gps-marker-wrapper) {
    background: transparent !important;
    border: none !important;
  }

  :global(.user-live-gps-dot) {
    position: relative;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  :global(.gps-pulse-halo) {
    position: absolute;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: rgba(37, 99, 235, 0.4);
    animation: gps-radar-pulse 2s cubic-bezier(0.2, 0.8, 0.2, 1) infinite;
  }

  :global(.gps-dot-core) {
    position: relative;
    width: 13px;
    height: 13px;
    border-radius: 50%;
    background: #2563eb;
    border: 2.5px solid #ffffff;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.35);
    z-index: 2;
  }

  @keyframes gps-radar-pulse {
    0% {
      transform: scale(0.5);
      opacity: 1;
    }
    70% {
      transform: scale(2.2);
      opacity: 0.15;
    }
    100% {
      transform: scale(2.4);
      opacity: 0;
    }
  }
</style>
