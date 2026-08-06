<script lang="ts">
  import { projectStore } from '$lib/stores/project';
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { PlacesService } from '../places.service';
  import { PlaceSettingsService } from '../placeSettingsService';
  import type { PlaceItem, PlaceStatus, PlaceSettings, PlaceAddress } from '../schema';
  import { toast } from '$lib/stores/toast.svelte';
  import { pageTitle } from '$lib/stores/page';
  import { menuConfigStore } from '$lib/stores/menu';
  import { 
    MapPin, 
    ArrowLeft, 
    User, 
    Phone,
    Trash2, 
    Navigation,
    ExternalLink,
    Pencil
  } from '@lucide/svelte';

  const placeId = $page.params.id || '';

  let settings = $state<PlaceSettings>({
    entityNaming: 'cantiere',
    customSingularLabel: '',
    customPluralLabel: '',
    prefix: 'LUG-',
    includeYear: true,
    numberPadding: 3,
    lastNumber: 0,
    lastCounterYear: new Date().getFullYear(),
    defaultStatus: 'attivo'
  });
  let labels = $derived(PlaceSettingsService.getLabels(settings));

  let place = $state<PlaceItem | null>(null);
  let loading = $state(true);
  let activeTab = $state<'overview' | string>('overview');

  // Dynamic Bridge Tabs Discovery
  const globTabs = import.meta.glob('../places-tabs/*.svelte', { eager: true });
  const activeModuleIds = $derived(new Set($menuConfigStore.map(m => m.id)));

  // Available Bridge Sub-Tabs registered by installed modules
  const installedBridgeTabs = $derived(
    Object.entries(globTabs)
      .map(([path, mod]: [string, any]) => {
        const meta = mod.bridgeMetadata || mod.default?.bridgeMetadata || {};
        let defaultLabel = 'Tab Collegata';
        if (path.includes('Contract')) defaultLabel = 'Preventivi & Contratti';
        if (path.includes('Interventi')) defaultLabel = 'Interventi & Rapportini';
        if (path.includes('Ticket')) defaultLabel = 'Ticket & Supporto';
        return {
          id: meta.id || path.split('/').pop()?.replace('.svelte', '').toLowerCase() || 'tab',
          sourceModule: meta.sourceModule || (path.includes('Contract') ? 'contracts' : ''),
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

  onMount(async () => {
    try {
      const [s, item] = await Promise.all([
        PlaceSettingsService.getSettings(),
        PlacesService.getPlaceById(placeId)
      ]);
      settings = s;
      place = item;
      if (item) {
        pageTitle.set(`${labels.singular} ${item.code}`);
      }
    } catch (e) {
      console.error('Errore caricamento dettaglio luogo:', e);
    } finally {
      loading = false;
    }
  });

  async function handleStatusChange(newStatus: PlaceStatus) {
    if (!place) return;
    try {
      await PlacesService.updatePlace(place.id!, { status: newStatus });
      place.status = newStatus;
      toast.success(`Stato ${labels.singular.toLowerCase()} aggiornato in "${newStatus}".`);
    } catch (e: any) {
      toast.error('Errore aggiornamento stato: ' + e.message);
    }
  }

  async function handleDelete() {
    if (!place) return;
    if (!confirm(`Sei sicuro di voler eliminare il ${labels.singular.toLowerCase()} "${place.name}"?`)) return;

    try {
      await PlacesService.deletePlace(place.id!);
      toast.success(`${labels.singular} eliminato con successo.`);
      goto('/dashboard/places');
    } catch (e: any) {
      toast.error('Errore durante l\'eliminazione: ' + e.message);
    }
  }

  let formattedAddress = $derived.by(() => {
    if (!place?.address) return '';
    const parts = [
      place.address.street,
      place.address.city,
      place.address.zip,
      place.address.province ? `(${place.address.province})` : ''
    ].filter(Boolean);
    return parts.join(', ');
  });

  let googleMapsUrl = $derived.by(() => {
    if (!formattedAddress) return '';
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(formattedAddress)}`;
  });
</script>

<svelte:head>
  <title>{place ? `${place.name} (${place.code})` : labels.singular} | {$projectStore?.projectName || 'ERP'}</title>
</svelte:head>

<div class="place-detail-container">
  {#if loading}
    <div class="loading-box">Caricamento scheda {labels.singular.toLowerCase()}...</div>
  {:else if !place}
    <div class="not-found-box">
      <MapPin size={48} color="var(--color-neutral-400)" />
      <h2>{labels.singular} Non Trovato</h2>
      <p>L'elemento richiesto non esiste o è stato rimosso.</p>
      <a href="/dashboard/places" class="btn-back-link">Torna alla lista {labels.plural}</a>
    </div>
  {:else}
    <header class="detail-header">
      <div class="header-main">
        <a href="/dashboard/places" class="btn-back" title="Torna alla lista">
          <ArrowLeft size={20} />
        </a>
        <div>
          <div class="code-row">
            <span class="place-code">{place.code}</span>
            <span class="status-chip {place.status}">{place.status}</span>
          </div>
          <h1 class="place-title">{place.name}</h1>
        </div>
      </div>

      <div class="header-actions">
        <a href="/dashboard/places/{place.id}/edit" class="btn-secondary-action">
          <Pencil size={15} /> Modifica {labels.singular}
        </a>
        <button class="btn-danger-action" onclick={handleDelete}>
          <Trash2 size={16} /> Elimina {labels.singular}
        </button>
      </div>
    </header>

    <div class="nav-tabs">
      <button 
        class="nav-tab-btn" 
        class:active={activeTab === 'overview'} 
        onclick={() => activeTab = 'overview'}
      >
        <span>Panoramica</span>
      </button>

      {#each installedBridgeTabs as tab}
        <button 
          class="nav-tab-btn" 
          class:active={activeTab === tab.id} 
          onclick={() => activeTab = tab.id}
        >
          <span>{tab.label}</span>
        </button>
      {/each}
    </div>

    {#if activeTab === 'overview'}
      <div class="detail-content-grid">
        <div class="main-column">
          <div class="info-card">
            <h3 class="card-title">Informazioni Generali</h3>
            
            <div class="info-grid">
              <div class="info-item">
                <span class="info-label">Cliente Intestatario</span>
                <span class="info-value highlight">
                  <User size={15} />
                  {place.clientName || 'N/D'}
                </span>
              </div>

              {#if place.contactPerson}
                <div class="info-item">
                  <span class="info-label">Persona di Riferimento / Custode</span>
                  <span class="info-value">
                    <User size={15} />
                    {place.contactPerson}
                  </span>
                </div>
              {/if}

              {#if place.phone}
                <div class="info-item">
                  <span class="info-label">Telefono Riferimento Cantiere</span>
                  <span class="info-value">
                    <Phone size={15} />
                    {place.phone}
                  </span>
                </div>
              {/if}
            </div>
          </div>

          {#if place.notes}
            <div class="info-card">
              <h3 class="card-title">Note & Istruzioni d'Accesso</h3>
              <p class="notes-content">{place.notes}</p>
            </div>
          {/if}
        </div>

        <div class="side-column">
          <div class="info-card map-card">
            <h3 class="card-title">
              <MapPin size={18} /> Ubicazione & Mappa Cantiere
            </h3>

            {#if formattedAddress}
              <div class="address-display-box">
                <p class="formatted-address-text">{formattedAddress}</p>

                <a 
                  href={googleMapsUrl} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  class="btn-open-maps"
                >
                  <Navigation size={15} />
                  <span>Apri in Google Maps</span>
                  <ExternalLink size={13} />
                </a>
              </div>

              <div class="embed-map-wrapper">
                <iframe 
                  title="Mappa Cantiere"
                  width="100%" 
                  height="220" 
                  style="border:0; border-radius: 8px;" 
                  loading="lazy" 
                  allowfullscreen
                  src="https://maps.google.com/maps?q={encodeURIComponent(formattedAddress)}&t=&z=15&ie=UTF8&iwloc=&output=embed"
                ></iframe>
              </div>
            {:else}
              <div class="no-address-state">
                <MapPin size={32} color="var(--color-neutral-400)" />
                <p>Nessun indirizzo specificato per questo cantiere.</p>
              </div>
            {/if}
          </div>

          <div class="info-card">
            <h3 class="card-title">Cambia Stato</h3>
            <div class="status-buttons">
              <button 
                class="status-btn attivo" 
                class:selected={place.status === 'attivo'} 
                onclick={() => handleStatusChange('attivo')}
              >
                Attivo
              </button>
              <button 
                class="status-btn inattivo" 
                class:selected={place.status === 'inattivo'} 
                onclick={() => handleStatusChange('inattivo')}
              >
                Inattivo
              </button>
            </div>
          </div>
        </div>
      </div>
    {:else}
      {#each installedBridgeTabs as tab}
        {#if activeTab === tab.id}
          <div class="tab-bridge-container">
            <tab.component placeId={place.id} clientId={place.clientId} />
          </div>
        {/if}
      {/each}
    {/if}
  {/if}
</div>

<style>
  .place-detail-container { padding: 24px; width: 100%; max-width: none; }
  .detail-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
  .header-main { display: flex; align-items: center; gap: 16px; }
  .btn-back { display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; border-radius: 8px; background: white; border: 1px solid var(--color-neutral-300); color: var(--color-neutral-700); text-decoration: none; }
  .code-row { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
  .place-code { font-family: monospace; font-weight: 700; font-size: 13px; color: var(--color-primary-700); }
  .status-chip { font-size: 10px; font-weight: 700; text-transform: uppercase; padding: 2px 6px; border-radius: 4px; background: var(--color-neutral-100); }
  .status-chip.attivo { background: #dcfce7; color: #15803d; }
  .status-chip.inattivo { background: #fee2e2; color: #b91c1c; }
  .place-title { font-size: 22px; font-weight: 700; margin: 0; }
  .header-actions { display: flex; align-items: center; gap: 10px; }
  .btn-secondary-action { display: flex; align-items: center; gap: 6px; padding: 8px 14px; border-radius: 8px; border: 1px solid var(--color-neutral-300); background: white; color: var(--color-neutral-800); font-size: 13px; font-weight: 600; text-decoration: none; transition: all 0.2s ease; }
  .btn-secondary-action:hover { background: var(--color-neutral-50); border-color: var(--color-neutral-400); }
  .btn-danger-action { display: flex; align-items: center; gap: 6px; padding: 8px 14px; border-radius: 8px; border: 1px solid #fee2e2; background: #fff5f5; color: #dc2626; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.2s ease; }
  .btn-danger-action:hover { background: #fecaca; }
  .nav-tabs { display: flex; gap: 8px; border-bottom: 1px solid var(--color-neutral-200); margin-bottom: 24px; }
  .nav-tab-btn { padding: 10px 16px; border: none; background: none; font-size: 14px; font-weight: 600; color: var(--color-neutral-600); cursor: pointer; border-bottom: 2px solid transparent; }
  .nav-tab-btn.active { color: var(--color-primary-600); border-bottom-color: var(--color-primary-600); }
  .detail-content-grid { display: grid; grid-template-columns: 2fr 1fr; gap: 24px; }
  .info-card { background: white; border: 1px solid var(--color-neutral-200); border-radius: 12px; padding: 20px; margin-bottom: 20px; }
  .card-title { font-size: 15px; font-weight: 700; margin: 0 0 16px 0; display: flex; align-items: center; gap: 8px; }
  .info-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; }
  .info-item { display: flex; flex-direction: column; gap: 4px; }
  .info-label { font-size: 12px; color: var(--color-neutral-500); }
  .info-value { font-size: 14px; font-weight: 600; display: flex; align-items: center; gap: 6px; }
  .info-value.highlight { color: var(--color-primary-700); }
  .notes-content { font-size: 14px; color: var(--color-neutral-700); line-height: 1.5; white-space: pre-wrap; margin: 0; }
  .status-buttons { display: flex; flex-wrap: wrap; gap: 8px; }
  .status-btn { flex: 1; min-width: 80px; padding: 8px; border-radius: 6px; border: 1px solid var(--color-neutral-300); background: white; font-size: 12px; font-weight: 600; cursor: pointer; }
  .status-btn.selected { border-color: var(--color-primary-600); background: var(--color-primary-50); color: var(--color-primary-700); }
  .address-display-box { margin-bottom: 16px; }
  .formatted-address-text { font-size: 14px; font-weight: 600; color: var(--color-neutral-800); margin: 0 0 10px 0; }
  .btn-open-maps { display: inline-flex; align-items: center; gap: 6px; padding: 8px 12px; border-radius: 6px; background: #e0f2fe; color: #0284c7; text-decoration: none; font-size: 12px; font-weight: 600; }
  .embed-map-wrapper { overflow: hidden; border-radius: 8px; border: 1px solid var(--color-neutral-200); }
  .no-address-state { text-align: center; padding: 20px; color: var(--color-neutral-500); font-size: 13px; }
</style>
