<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { projectStore } from '$lib/stores/project';
  import { pageTitle } from '$lib/stores/page';
  import { NavigationService } from '$lib/services/navigationService';
  import { PlacesService } from '../../places.service';
  import { PlaceSettingsService } from '../../placeSettingsService';
  import type { PlaceDocument, PlaceSettings } from '../../schema';
  import PlaceForm from '../../ui/forms/PlaceForm.svelte';
  import { toast } from '$lib/stores/toast.svelte';
  import { MapPin, List, Eye, Layers } from '@lucide/svelte';

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
  let allPlaces = $state<PlaceDocument[]>([]);
  let loading = $state(true);

  async function loadEditData(targetId: string) {
    if (!targetId) return;
    loading = true;
    try {
      const [s, p, pList] = await Promise.all([
        PlaceSettingsService.getSettings(),
        PlacesService.getPlaceById(targetId),
        PlacesService.getPlaces()
      ]);
      settings = s;
      place = p;
      allPlaces = pList;

      if (p) {
        pageTitle.set(`Modifica ${p.name}`);
      }
    } catch (e) {
      console.error('Errore caricamento edit place:', e);
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    const id = placeId;
    if (id) {
      loadEditData(id);
    }
  });

  async function handleUpdate(formData: Partial<PlaceDocument>) {
    if (!place) return;
    try {
      const oldCode = place.code;
      await PlacesService.updatePlace(placeId, formData, oldCode);
      toast.success(`${labels.singular} aggiornato con successo!`);
      await NavigationService.submitSuccessReturn($page.url.searchParams, `/dashboard/places/${placeId}`);
    } catch (err: any) {
      console.error('Errore modifica luogo:', err);
      toast.error('Errore durante l\'aggiornamento: ' + (err.message || err));
      throw err;
    }
  }
</script>

<svelte:head>
  <title>Modifica {place?.name || labels.singular} | {$projectStore?.projectName || 'Gestoray'}</title>
</svelte:head>

<div class="place-edit-page animate-fade-in">
  <!-- Unified Top Header Bar -->
  <header class="page-top-actions">
    <div class="header-left">
      <a 
        href="/dashboard/places/{placeId}" 
        class="btn-module-list" 
        title="Torna alla scheda dettaglio"
        aria-label="Torna alla scheda dettaglio"
      >
        <List size={20} />
      </a>
      <div class="header-icon-box">
        {#if place?.parentId}
          <Layers size={22} class="text-indigo-600" />
        {:else}
          <MapPin size={22} class="text-blue-600" />
        {/if}
      </div>
      <div class="header-title-column">
        <h1 class="page-title">Modifica {place?.name || labels.singular}</h1>
        <p class="page-subtitle">Aggiorna le coordinate, la gerarchia, i contatti o lo stato operativo.</p>
      </div>
    </div>

    <div class="header-right">
      <a href="/dashboard/places/{placeId}" class="btn-secondary-action">
        <Eye size={16} />
        <span>Vedi Scheda Dettaglio</span>
      </a>
    </div>
  </header>

  {#if loading}
    <div class="loading-state">
      <p>Caricamento dati luogo in corso...</p>
    </div>
  {:else if !place}
    <div class="not-found-card">
      <h3>Luogo / Cantiere non trovato</h3>
      <p>Il luogo specificato potrebbe essere stato rimosso.</p>
      <a href="/dashboard/places" class="btn-module-list">
        <List size={20} />
      </a>
    </div>
  {:else}
    <PlaceForm
      initialData={place}
      allPlaces={allPlaces}
      isEditing={true}
      onSubmit={handleUpdate}
    />
  {/if}
</div>

<style>
  .place-edit-page {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .page-top-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 14px;
    flex-wrap: wrap;
  }

  .header-icon-box {
    width: 42px;
    height: 42px;
    border-radius: 10px;
    background: #eff6ff;
    border: 1px solid #dbeafe;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .header-title-column {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .page-title {
    font-size: 20px;
    font-weight: 800;
    color: #0f172a;
    margin: 0;
    line-height: 1.25;
  }

  .page-subtitle {
    font-size: 13px;
    color: #64748b;
    margin: 0;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .btn-secondary-action {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 14px;
    border-radius: 8px;
    border: 1px solid #cbd5e1;
    background: #ffffff;
    color: #334155;
    font-size: 13px;
    font-weight: 600;
    text-decoration: none;
    transition: all 0.15s ease;
  }

  .btn-secondary-action:hover {
    background: #f8fafc;
    border-color: #94a3b8;
    color: #0f172a;
  }

  .loading-state, .not-found-card {
    padding: 48px;
    text-align: center;
    background: #ffffff;
    border-radius: 12px;
    border: 1px solid #e2e8f0;
    color: #64748b;
  }
</style>
