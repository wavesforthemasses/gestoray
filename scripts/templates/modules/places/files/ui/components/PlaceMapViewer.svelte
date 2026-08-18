<script lang="ts">
  import { browser } from '$app/environment';
  import type { PlaceDocument } from '../../domain/models/place';
  import { MapPin, WifiOff, Layers, ZoomIn } from '@lucide/svelte';

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
  let L: any = null;
  let isOffline = $state(false);

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

      if (interactivePicker) {
        mapInstance.on('click', (e: any) => {
          const lat = e.latlng.lat;
          const lng = e.latlng.lng;
          onLocationPick?.({ lat, lng });
        });
      }

      renderMarkers();
      renderPicker();
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

  // Reattività Svelte 5 su aggiornamento props
  $effect(() => {
    const _p = places;
    const _s = selectedPlaceId;
    if (mapInstance && layerGroup && L) {
      renderMarkers();
    }
  });

  $effect(() => {
    const _loc = pickerLocation;
    const _rad = pickerRadiusMeters;
    const _parent = parentLocation;
    const _z = zoom;
    if (mapInstance && pickerLayer && L) {
      renderPicker();
    }
  });

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

      marker.on('click', () => onSelectPlace?.(place));
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

    // Auto-fit dinamico del viewport
    if (validMarkersCount > 0 && !selectedPlaceId && !interactivePicker) {
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

  .offline-badge {
    position: absolute;
    top: 12px;
    right: 12px;
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
</style>
