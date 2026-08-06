<script lang="ts">
  import { onMount } from 'svelte';
  import { PlacesService } from '../places.service';
  import { PlaceSettingsService } from '../placeSettingsService';
  import type { PlaceItem, PlaceSettings } from '../schema';
  import { MapPin, Plus, Eye } from '@lucide/svelte';

  let { clientId }: { clientId: string } = $props();

  let places = $state<PlaceItem[]>([]);
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

  let loading = $state(true);

  onMount(async () => {
    try {
      const [s, list] = await Promise.all([
        PlaceSettingsService.getSettings(),
        PlacesService.getPlaces(clientId)
      ]);
      settings = s;
      places = list;
    } catch (e) {
      console.error('Errore caricamento luoghi cliente:', e);
    } finally {
      loading = false;
    }
  });
</script>

<div class="client-places-tab">
  <div class="tab-header-row">
    <h4><MapPin size={18} /> {labels.plural} del Cliente ({places.length})</h4>
    <a href="/dashboard/places/add?clientId={clientId}" class="btn-sm-action">
      <Plus size={14} /> {labels.newBtn}
    </a>
  </div>

  {#if loading}
    <p class="loading-text">Caricamento {labels.plural.toLowerCase()}...</p>
  {:else if places.length === 0}
    <div class="empty-state">
      <MapPin size={32} color="var(--color-neutral-400)" />
      <p>Nessun {labels.singular.toLowerCase()} associato a questo cliente.</p>
    </div>
  {:else}
    <div class="places-list">
      {#each places as item}
        <div class="place-item-card">
          <div class="card-main-info">
            <span class="place-code">{item.code}</span>
            <h5 class="place-name">{item.name}</h5>
            <span class="place-status-chip {item.status}">{item.status}</span>
          </div>

          <div class="card-meta-info">
            {#if item.address?.city}
              <span class="address-badge">{item.address.city} {item.address.street ? `(${item.address.street})` : ''}</span>
            {/if}
            <a href="/dashboard/places/{item.id}" class="view-btn" title="Dettaglio">
              <Eye size={16} />
            </a>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .client-places-tab {
    padding: 12px 0;
  }
  .tab-header-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }
  .tab-header-row h4 {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 15px;
    font-weight: 600;
    margin: 0;
  }
  .btn-sm-action {
    display: flex;
    align-items: center;
    gap: 6px;
    background: var(--color-primary-600);
    color: white;
    padding: 6px 12px;
    border-radius: 6px;
    text-decoration: none;
    font-size: 12px;
    font-weight: 600;
  }
  .empty-state {
    text-align: center;
    padding: 30px;
    color: var(--color-neutral-500);
  }
  .places-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .place-item-card {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: white;
    border: 1px solid var(--color-neutral-200);
    border-radius: 8px;
    padding: 12px 16px;
  }
  .card-main-info {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .place-code {
    font-family: monospace;
    font-weight: 700;
    color: var(--color-primary-700);
    font-size: 12px;
  }
  .place-name {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
  }
  .place-status-chip {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    padding: 2px 6px;
    border-radius: 4px;
    background: var(--color-neutral-100);
  }
  .card-meta-info {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .address-badge {
    font-size: 12px;
    color: var(--color-neutral-600);
  }
  .view-btn {
    color: var(--color-neutral-600);
    padding: 4px;
  }
</style>
