<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { projectStore } from '$lib/stores/project';
  import { pageTitle } from '$lib/stores/page';
  import { NavigationService } from '$lib/services/navigationService';
  import { PlacesService } from '../places.service';
  import { PlaceSettingsService } from '../placeSettingsService';
  import type { PlaceDocument, PlaceSettings } from '../schema';
  import PlaceForm from '../ui/forms/PlaceForm.svelte';
  import { toast } from '$lib/stores/toast.svelte';
  import { MapPin, List, Layers } from '@lucide/svelte';

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
  let allPlaces = $state<PlaceDocument[]>([]);
  let initialParentDoc = $state<PlaceDocument | null>(null);
  let initialData = $state<Partial<PlaceDocument>>({});
  let loading = $state(true);

  onMount(async () => {
    try {
      const [s, pList] = await Promise.all([
        PlaceSettingsService.getSettings(),
        PlacesService.getPlaces()
      ]);
      settings = s;
      allPlaces = pList;

      const urlParams = new URLSearchParams(window.location.search);
      const preClient = urlParams.get('clientId');
      const preParent = urlParams.get('parentId');

      if (preParent) {
        initialParentDoc = pList.find(p => p.id === preParent) || null;
      }

      if (initialParentDoc) {
        pageTitle.set(`Nuovo Lotto - ${initialParentDoc.name}`);
      } else {
        pageTitle.set(`Nuovo ${labels.singular}`);
      }

      initialData = {
        status: s.defaultStatus || 'active',
        types: ['site'],
        clientId: preClient || initialParentDoc?.clientId || undefined,
        clientName: initialParentDoc?.clientName || undefined,
        parentId: preParent || null,
        address: initialParentDoc?.address ? { ...initialParentDoc.address } : undefined,
        geo: initialParentDoc?.geo ? {
          ...initialParentDoc.geo,
          radiusMeters: 50
        } : undefined,
        accessInfo: initialParentDoc?.accessInfo ? { ...initialParentDoc.accessInfo } : undefined
      };
    } catch (e) {
      console.error('Errore caricamento add place:', e);
    } finally {
      loading = false;
    }
  });

  async function handleCreate(formData: Partial<PlaceDocument>) {
    try {
      const newId = await PlacesService.createPlace(formData);
      toast.success(`${labels.singular} creato con successo!`);
      await NavigationService.submitSuccessReturn($page.url.searchParams, `/dashboard/places/${newId}`);
    } catch (err: any) {
      console.error('Errore salvataggio luogo:', err);
      toast.error('Errore durante la creazione: ' + (err.message || err));
      throw err;
    }
  }
</script>

<svelte:head>
  <title>
    {initialParentDoc ? `Nuovo Lotto / Sotto-Area per ${initialParentDoc.name}` : `Nuovo ${labels.singular}`} | {$projectStore?.projectName || 'Gestoray'}
  </title>
</svelte:head>

<div class="place-add-page animate-fade-in">
  <!-- Unified Top Header Bar (Rule 12 & Rule 23) -->
  <header class="page-top-actions">
    <div class="header-left">
      <a 
        href="/dashboard/places" 
        class="btn-module-list" 
        title="Vai all'elenco {labels.plural}"
        aria-label="Vai all'elenco {labels.plural}"
      >
        <List size={20} />
      </a>
      <div class="header-icon-box">
        {#if initialParentDoc}
          <Layers size={22} class="text-indigo-600" />
        {:else}
          <MapPin size={22} class="text-blue-600" />
        {/if}
      </div>
      <div class="header-title-column">
        <h1 class="page-title">
          {#if initialParentDoc}
            Nuova Sotto-Area / Lotto per <span class="text-indigo-600 font-extrabold">{initialParentDoc.name}</span>
          {:else}
            Nuovo {labels.singular}
          {/if}
        </h1>
        <p class="page-subtitle">
          {#if initialParentDoc}
            Definisci la sotto-area, capannone o settore operativo all'interno del cantiere principale.
          {:else}
            Compila la scheda per registrare un nuovo immobile, cantiere o sede operativa.
          {/if}
        </p>
      </div>
    </div>
  </header>

  {#if loading}
    <div class="loading-state">
      <p>Caricamento configurazione modulo...</p>
    </div>
  {:else}
    <PlaceForm 
      initialData={initialData} 
      allPlaces={allPlaces}
      isEditing={false}
      onSubmit={handleCreate}
    />
  {/if}
</div>

<style>
  .place-add-page {
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

  .loading-state {
    padding: 48px;
    text-align: center;
    color: #64748b;
  }
</style>
