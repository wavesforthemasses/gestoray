<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { authState } from '$lib/auth.svelte';
  import { projectStore } from '$lib/stores/project';
  import { pageTitle } from '$lib/stores/page';
  import { menuConfigStore } from '$lib/stores/menu';
  import { PlacesService } from '../places.service';
  import { PlaceSettingsService } from '../placeSettingsService';
  import type { PlaceDocument, PlaceSettings } from '../schema';
  import PlaceMapViewer from '../ui/components/PlaceMapViewer.svelte';
  import PlaceCommercialInsights from '../components/PlaceCommercialInsights.svelte';
  import PlaceTeamsInsights from '../components/PlaceTeamsInsights.svelte';
  import PresenceCheckInButton from '../ui/components/PresenceCheckInButton.svelte';
  import { toast } from '$lib/stores/toast.svelte';
  import { confirmStore } from '$lib/stores/confirm.svelte';
  import { 
    MapPin, 
    Building2, 
    Warehouse, 
    Store, 
    List, 
    Pencil, 
    Trash2, 
    User, 
    Phone, 
    Mail, 
    Navigation, 
    Layers, 
    Folder,
    Truck, 
    Key, 
    Plus, 
    Clock, 
    ExternalLink,
    Compass
  } from '@lucide/svelte';

  let placeId = $derived($page.params.id || '');

  let settings = $state<PlaceSettings>({
    entityNaming: 'cantiere',
    customSingularLabel: '',
    customPluralLabel: '',
    prefix: 'LUG-',
    includeYear: true,
    numberPadding: 3,
    lastNumber: 0,
    lastCounterYear: new Date().getFullYear(),
    defaultStatus: 'active'
  });

  let labels = $derived(PlaceSettingsService.getLabels(settings));
  let place = $state<PlaceDocument | null>(null);
  let childrenPlaces = $state<PlaceDocument[]>([]);
  let parentPlace = $state<PlaceDocument | null>(null);
  let loading = $state(true);
  let activeTab = $state<'overview' | string>('overview');

  // Dynamic Bridge Tabs Discovery
  const globTabs = import.meta.glob('../places-tabs/*.svelte', { eager: true });
  const activeModuleIds = $derived(new Set($menuConfigStore.map(m => m.id)));

  const installedBridgeTabs = $derived(
    Object.entries(globTabs)
      .map(([path, mod]: [string, any]) => {
        const meta = mod.bridgeMetadata || mod.default?.bridgeMetadata || {};
        let defaultLabel = 'Tab Collegata';
        if (path.includes('Contract')) defaultLabel = 'Preventivi & Contratti';
        if (path.includes('Activities') || path.includes('Activit') || path.includes('Interventi')) defaultLabel = 'Attività & Task';
        if (path.includes('Ticket')) defaultLabel = 'Ticket & Supporto';
        return {
          id: meta.id || path.split('/').pop()?.replace('.svelte', '').toLowerCase() || 'tab',
          sourceModule: meta.sourceModule || (path.includes('Contract') ? 'contracts' : path.includes('Activit') ? 'activities' : ''),
          label: meta.label || defaultLabel,
          component: mod.default
        };
      })
      .filter(t => {
        if (!t.sourceModule) return true;
        if ($menuConfigStore.length === 0) return true;
        return activeModuleIds.has(t.sourceModule);
      })
  );

  async function loadPlaceData(targetId: string) {
    if (!targetId) return;
    loading = true;
    try {
      const [s, item, allList] = await Promise.all([
        PlaceSettingsService.getSettings(),
        PlacesService.getPlaceById(targetId),
        PlacesService.getPlaces()
      ]);
      settings = s;
      place = item;

      if (item) {
        pageTitle.set(`${labels.singular} ${item.code || item.name}`);
        childrenPlaces = allList.filter(p => p.parentId === item.id);
        if (item.parentId) {
          parentPlace = allList.find(p => p.id === item.parentId) || null;
        } else {
          parentPlace = null;
        }
      } else {
        childrenPlaces = [];
        parentPlace = null;
      }
    } catch (e) {
      console.error('Errore caricamento dettaglio luogo:', e);
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    const id = placeId;
    if (id) {
      loadPlaceData(id);
    }
  });

  async function handleDelete() {
    if (!place) return;
    const ok = await confirmStore.prompt(`Sei sicuro di voler eliminare permanentemente "${place.name}"? L'operazione rilascerà il codice univoco associato.`);
    if (!ok) return;

    try {
      await PlacesService.deletePlace(placeId);
      toast.success(`${labels.singular} eliminato con successo.`);
      goto('/dashboard/places');
    } catch (err: any) {
      toast.error('Errore durante l\'eliminazione: ' + err.message);
    }
  }

  const primaryContact = $derived(
    place?.contacts?.find(c => c.isPrimary) || place?.contacts?.[0] || null
  );

  const placeCoords = $derived.by(() => {
    if (!place?.geo?.location) return null;
    const lat = (place.geo.location as any).latitude ?? (place.geo.location as any).lat;
    const lng = (place.geo.location as any).longitude ?? (place.geo.location as any).lng;
    if (typeof lat === 'number' && typeof lng === 'number') {
      return { lat, lng };
    }
    return null;
  });
</script>

<svelte:head>
  <title>{place?.name || labels.singular} | {$projectStore?.projectName || 'Gestoray'}</title>
</svelte:head>

<div class="place-detail-page">
  {#if loading}
    <div class="loading-state-card">
      <p>Caricamento scheda {labels.singular}...</p>
    </div>
  {:else if !place}
    <div class="not-found-card">
      <h3>{labels.singular} non trovato</h3>
      <p>Il record richiesto non esiste o è stato rimosso.</p>
      <a href="/dashboard/places" class="btn-module-list">Torna all'elenco</a>
    </div>
  {:else}
    <!-- 1. DETAIL TOP HEADER (Rule 12 & Rule 23) -->
    <header class="detail-header-card">
      <div class="header-main-row">
        <div class="title-group">
          <a 
            href="/dashboard/places" 
            class="btn-module-list" 
            title="Vai all'elenco {labels.plural}"
            aria-label="Vai all'elenco {labels.plural}"
          >
            <List size={20} />
          </a>
          <div class="header-icon-box">
            <MapPin size={24} class="text-blue-600" />
          </div>
          <div>
            <div class="meta-pills-row">
              {#if place.code}
                <span class="code-pill font-mono">{place.code}</span>
              {/if}
              <span class="status-pill status-{place.status}">
                {place.status === 'active' || place.status === 'attivo' ? 'Attivo' : place.status}
              </span>
              {#each (place.types || ['site']) as t}
                <span class="type-pill">{t}</span>
              {/each}
              {#if place.depth > 0}
                <span class="depth-pill">Livello {place.depth}</span>
              {/if}
            </div>

            <h1 class="place-name">{place.name}</h1>

            {#if parentPlace}
              <div class="parent-link-row">
                <span class="text-slate-400">Sotto-area di:</span>
                <a href="/dashboard/places/{parentPlace.id}" class="parent-link">
                  <Folder size={14} class="inline text-slate-400" />
                  <span>{parentPlace.name} {parentPlace.code ? `(${parentPlace.code})` : ''}</span>
                </a>
              </div>
            {/if}
          </div>
        </div>

        <div class="header-action-buttons">
          {#if place}
            <div class="header-presence-box">
              <PresenceCheckInButton 
                {place} 
                currentUser={authState.user ? { uid: authState.user.uid, displayName: authState.user.displayName || undefined, email: authState.user.email || undefined } : null} 
                onStatusChange={() => loadPlaceData(placeId)}
              />
            </div>
          {/if}
          <a href="/dashboard/places/{placeId}/edit" class="btn-edit">
            <Pencil size={15} />
            <span>Modifica</span>
          </a>
          <button type="button" class="btn-delete" onclick={handleDelete}>
            <Trash2 size={15} />
            <span>Elimina</span>
          </button>
        </div>
      </div>

      <!-- Navigation Sub-Tabs -->
      <nav class="detail-tabs-nav" aria-label="Sezioni scheda">
        <button
          type="button"
          class="tab-nav-btn {activeTab === 'overview' ? 'active' : ''}"
          onclick={() => { activeTab = 'overview'; }}
        >
          Panoramica & Mappa
        </button>

        {#each installedBridgeTabs as tab}
          <button
            type="button"
            class="tab-nav-btn {activeTab === tab.id ? 'active' : ''}"
            onclick={() => { activeTab = tab.id; }}
          >
            {tab.label}
          </button>
        {/each}
      </nav>
    </header>

    <!-- 2. TAB CONTENT: OVERVIEW & MAP -->
    {#if activeTab === 'overview'}
      <div class="overview-grid">
        <!-- Colonna Sinistra: Mappa con Geofence e Scheda Indirizzo -->
        <div class="left-col">
          <!-- Card Mappa & Coordinate -->
          <div class="section-box">
            <div class="box-header">
              <div class="box-title-group">
                <Compass size={18} class="text-blue-600" />
                <h3 class="box-title">Posizione Geografica & Radar Geofence</h3>
              </div>
              {#if placeCoords}
                <a 
                  href="https://www.google.com/maps/search/?api=1&query={placeCoords.lat},{placeCoords.lng}" 
                  target="_blank" 
                  rel="noreferrer" 
                  class="btn-open-ext"
                >
                  <ExternalLink size={13} />
                  <span>Google Maps</span>
                </a>
              {/if}
            </div>

            {#if placeCoords}
              <div class="map-wrapper-box">
                <PlaceMapViewer 
                  places={[place]} 
                  height="340px"
                  zoom={15}
                  center={placeCoords}
                  selectedPlaceId={place.id}
                />
              </div>
              <div class="geo-details-footer">
                <div class="geo-stat">
                  <span class="stat-label">Coordinate:</span>
                  <span class="stat-val font-mono">{placeCoords.lat.toFixed(5)}, {placeCoords.lng.toFixed(5)}</span>
                </div>
                <div class="geo-stat">
                  <span class="stat-label">Radar Geofence:</span>
                  <span class="stat-val font-semibold text-blue-600">{place.geo?.radiusMeters || 100} metri</span>
                </div>
                {#if place.geo?.geohash}
                  <div class="geo-stat">
                    <span class="stat-label">Geohash:</span>
                    <span class="stat-val font-mono">{place.geo.geohash}</span>
                  </div>
                {/if}
              </div>
            {:else}
              <div class="no-coords-box">
                <Compass size={36} class="text-slate-300" />
                <p>Nessuna coordinata GPS registrata per questo luogo.</p>
                <a href="/dashboard/places/{placeId}/edit" class="btn-add-coords">
                  <Pencil size={14} />
                  <span>Imposta Coordinate</span>
                </a>
              </div>
            {/if}
          </div>

          <!-- Sotto-Aree Figlie -->
          <div class="section-box">
            <div class="box-header">
              <div class="box-title-group">
                <Layers size={18} class="text-blue-600" />
                <h3 class="box-title">Sotto-Aree & Lotti Collegati ({childrenPlaces.length})</h3>
              </div>
              <a href="/dashboard/places/add?parentId={place.id}" class="btn-add-sub">
                <Plus size={14} />
                <span>+ Nuova Sotto-Area</span>
              </a>
            </div>

            {#if childrenPlaces.length === 0}
              <p class="empty-sub-text">Nessuna sotto-area o settore figlio registrato sotto questo luogo.</p>
            {:else}
              <div class="children-places-list">
                {#each childrenPlaces as child (child.id)}
                  <a href="/dashboard/places/{child.id}" class="child-place-row">
                    <div class="child-info">
                      <span class="child-name font-semibold">{child.name}</span>
                      {#if child.code}
                        <span class="child-code">{child.code}</span>
                      {/if}
                    </div>
                    <span class="child-status status-{child.status}">{child.status}</span>
                  </a>
                {/each}
              </div>
            {/if}
          </div>

          <!-- Commercial & Teams Insights -->
          <PlaceCommercialInsights placeId={place.id} />
          <PlaceTeamsInsights placeId={place.id} />
        </div>

        <!-- Colonna Destra: Dati Indirizzo, Referenti, Vincoli di Accesso -->
        <div class="right-col">
          <!-- Indirizzo Canonico -->
          <div class="section-box">
            <div class="box-header">
              <div class="box-title-group">
                <MapPin size={18} class="text-blue-600" />
                <h3 class="box-title">Indirizzo & Cliente</h3>
              </div>
            </div>

            <div class="info-details-list">
              <div class="detail-item">
                <span class="item-label">Indirizzo Completo:</span>
                <span class="item-value font-semibold">
                  {place.address?.formattedAddress || place.summary?.shortAddress || 'Non specificato'}
                </span>
              </div>
              {#if place.address?.city}
                <div class="detail-item">
                  <span class="item-label">Città / CAP / Prov:</span>
                  <span class="item-value">
                    {place.address.city} {place.address.postalCode ? `(${place.address.postalCode})` : ''} {place.address.province ? `[${place.address.province}]` : ''}
                  </span>
                </div>
              {/if}
              {#if place.clientName}
                <div class="detail-item">
                  <span class="item-label">Cliente Titolare:</span>
                  <span class="item-value text-blue-600 font-semibold">
                    {#if place.clientId}
                      <a href="/dashboard/clients/{place.clientId}" class="hover:underline">{place.clientName}</a>
                    {:else}
                      {place.clientName}
                    {/if}
                  </span>
                </div>
              {/if}
            </div>
          </div>

          <!-- Referenti sul Posto -->
          <div class="section-box">
            <div class="box-header">
              <div class="box-title-group">
                <User size={18} class="text-blue-600" />
                <h3 class="box-title">Referenti & Contatti ({place.contacts?.length || 0})</h3>
              </div>
            </div>

            {#if !place.contacts || place.contacts.length === 0}
              <p class="empty-sub-text">Nessun referente specificato.</p>
            {:else}
              <div class="contacts-cards-list">
                {#each place.contacts as contact (contact.id)}
                  <div class="contact-card {contact.isPrimary ? 'primary' : ''}">
                    <div class="contact-card-top">
                      <span class="contact-card-name font-semibold">{contact.name}</span>
                      <span class="contact-card-role">{contact.role || 'Referente'}</span>
                    </div>
                    <div class="contact-links-row">
                      {#if contact.phone}
                        <a href="tel:{contact.phone}" class="link-item">
                          <Phone size={13} />
                          <span>{contact.phone}</span>
                        </a>
                      {/if}
                      {#if contact.email}
                        <a href="mailto:{contact.email}" class="link-item">
                          <Mail size={13} />
                          <span>{contact.email}</span>
                        </a>
                      {/if}
                    </div>
                  </div>
                {/each}
              </div>
            {/if}
          </div>

          <!-- Vincoli di Accesso & Note Operative -->
          <div class="section-box">
            <div class="box-header">
              <div class="box-title-group">
                <Truck size={18} class="text-blue-600" />
                <h3 class="box-title">Accessibilità & Note Operative</h3>
              </div>
            </div>

            <div class="access-info-list">
              <div class="access-item">
                <span class="access-item-label">Accesso Mezzi Pesanti (&gt;3.5t):</span>
                <span class="access-badge {place.accessInfo?.heavyVehicleAccessible ? 'yes' : 'no'}">
                  {place.accessInfo?.heavyVehicleAccessible ? 'SI - Consentito' : 'NO / Non Dichiarato'}
                </span>
              </div>

              {#if place.accessInfo?.notes}
                <div class="access-notes-box">
                  <div class="notes-header">
                    <Key size={14} class="text-amber-600" />
                    <span class="font-semibold text-xs text-amber-800">Istruzioni Citofono / Cancello:</span>
                  </div>
                  <p class="notes-body">{place.accessInfo.notes}</p>
                </div>
              {/if}

              {#if (place as any).notes}
                <div class="access-notes-box general">
                  <span class="font-semibold text-xs text-slate-700">Note Generali:</span>
                  <p class="notes-body">{(place as any).notes}</p>
                </div>
              {/if}
            </div>
          </div>
        </div>
      </div>

    <!-- 3. DYNAMIC BRIDGE TABS (Contracts, Activities, Tickets) -->
    {:else}
      {#each installedBridgeTabs as tab}
        {#if activeTab === tab.id}
          <div class="bridge-tab-container">
            <svelte:component this={tab.component} placeId={place.id} />
          </div>
        {/if}
      {/each}
    {/if}
  {/if}
</div>

<style>
  .place-detail-page {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .detail-header-card {
    background: #ffffff;
    border: 1px solid var(--border-color, #e2e8f0);
    border-radius: 14px;
    padding: 20px 24px 0 24px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.02);
  }

  .header-main-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 20px;
    flex-wrap: wrap;
  }

  .title-group {
    display: flex;
    align-items: flex-start;
    gap: 14px;
  }

  .header-icon-box {
    width: 52px;
    height: 52px;
    border-radius: 12px;
    background: #eff6ff;
    border: 1px solid #dbeafe;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .meta-pills-row {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
    margin-bottom: 6px;
  }

  .code-pill {
    font-size: 11px;
    font-weight: 700;
    color: #2563eb;
    background: #eff6ff;
    padding: 2px 8px;
    border-radius: 4px;
  }

  .status-pill {
    font-size: 11px;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 12px;
    text-transform: capitalize;
  }

  .status-active, .status-attivo { background: #dcfce7; color: #166534; }
  .status-archived, .status-inattivo { background: #f1f5f9; color: #64748b; }
  .status-temporary { background: #fef9c3; color: #854d0e; }

  .type-pill, .depth-pill {
    font-size: 11px;
    font-weight: 600;
    background: #f1f5f9;
    color: #475569;
    padding: 2px 8px;
    border-radius: 12px;
    text-transform: capitalize;
  }

  .place-name {
    font-size: 24px;
    font-weight: 800;
    color: #0f172a;
    margin: 0;
    letter-spacing: -0.02em;
  }

  .parent-link-row {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    margin-top: 4px;
  }

  .parent-link {
    color: #2563eb;
    font-weight: 600;
    text-decoration: none;
  }

  .parent-link:hover {
    text-decoration: underline;
  }

  .header-action-buttons {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .header-presence-box {
    min-width: 220px;
  }

  .btn-edit, .btn-delete {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    text-decoration: none;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-edit {
    background: #eff6ff;
    color: #1d4ed8;
    border: 1px solid #bfdbfe;
  }

  .btn-edit:hover {
    background: #dbeafe;
  }

  .btn-delete {
    background: #fef2f2;
    color: #dc2626;
    border: 1px solid #fecaca;
  }

  .btn-delete:hover {
    background: #fee2e2;
  }

  .detail-tabs-nav {
    display: flex;
    gap: 16px;
    border-top: 1px solid #f1f5f9;
    overflow-x: auto;
  }

  .tab-nav-btn {
    padding: 12px 4px;
    border: none;
    background: transparent;
    font-size: 14px;
    font-weight: 600;
    color: #64748b;
    border-bottom: 2px solid transparent;
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.15s ease;
  }

  .tab-nav-btn:hover {
    color: #0f172a;
  }

  .tab-nav-btn.active {
    color: #2563eb;
    border-bottom-color: #2563eb;
  }

  /* Overview Grid */
  .overview-grid {
    display: grid;
    grid-template-columns: 3fr 2fr;
    gap: 20px;
  }

  @media (max-width: 1024px) {
    .overview-grid {
      grid-template-columns: 1fr;
    }
  }

  .left-col, .right-col {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .section-box {
    background: #ffffff;
    border: 1px solid var(--border-color, #e2e8f0);
    border-radius: 14px;
    padding: 20px;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.02);
  }

  .box-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
    padding-bottom: 12px;
    border-bottom: 1px solid #f1f5f9;
  }

  .box-title-group {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .box-title {
    font-size: 15px;
    font-weight: 700;
    color: #0f172a;
    margin: 0;
  }

  .btn-open-ext, .btn-add-sub, .btn-add-coords {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    font-weight: 600;
    color: #2563eb;
    text-decoration: none;
  }

  .map-wrapper-box {
    border-radius: 10px;
    overflow: hidden;
  }

  .geo-details-footer {
    display: flex;
    align-items: center;
    gap: 20px;
    margin-top: 12px;
    font-size: 13px;
    flex-wrap: wrap;
  }

  .geo-stat {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .stat-label {
    color: #64748b;
  }

  .no-coords-box {
    padding: 36px 16px;
    text-align: center;
    color: #64748b;
    font-size: 13px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
  }

  .empty-sub-text {
    font-size: 13px;
    color: #64748b;
    margin: 0;
  }

  .children-places-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .child-place-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 12px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    text-decoration: none;
    color: #0f172a;
  }

  .child-place-row:hover {
    background: #f1f5f9;
  }

  .child-info {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .child-code {
    font-size: 11px;
    font-weight: 700;
    color: #2563eb;
    background: #eff6ff;
    padding: 1px 6px;
    border-radius: 4px;
  }

  .child-status {
    font-size: 11px;
    font-weight: 600;
    text-transform: capitalize;
  }

  /* Right column details */
  .info-details-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
    font-size: 13px;
  }

  .detail-item {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .item-label {
    color: #64748b;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
  }

  .contacts-cards-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .contact-card {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 10px 12px;
  }

  .contact-card.primary {
    border-left: 3px solid #3b82f6;
  }

  .contact-card-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 6px;
  }

  .contact-card-name {
    font-size: 13px;
    color: #0f172a;
  }

  .contact-card-role {
    font-size: 11px;
    color: #64748b;
  }

  .contact-links-row {
    display: flex;
    align-items: center;
    gap: 14px;
    font-size: 12px;
  }

  .link-item {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: #2563eb;
    text-decoration: none;
  }

  .access-info-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .access-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 13px;
  }

  .access-badge {
    font-size: 11px;
    font-weight: 700;
    padding: 3px 8px;
    border-radius: 6px;
  }

  .access-badge.yes { background: #dcfce7; color: #166534; }
  .access-badge.no { background: #f1f5f9; color: #64748b; }

  .access-notes-box {
    background: #fffbeb;
    border: 1px solid #fef3c7;
    border-radius: 8px;
    padding: 10px 12px;
  }

  .access-notes-box.general {
    background: #f8fafc;
    border-color: #e2e8f0;
  }

  .notes-header {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 4px;
  }

  .notes-body {
    font-size: 13px;
    color: #334155;
    margin: 0;
    line-height: 1.4;
  }

  .bridge-tab-container {
    background: #ffffff;
    border: 1px solid var(--border-color, #e2e8f0);
    border-radius: 14px;
    padding: 20px;
  }

  .loading-state-card, .not-found-card {
    padding: 48px;
    text-align: center;
    background: #ffffff;
    border-radius: 14px;
    color: #64748b;
  }
</style>
