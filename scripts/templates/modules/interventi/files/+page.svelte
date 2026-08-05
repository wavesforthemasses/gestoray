<script lang="ts">
  import { projectStore } from '$lib/stores/project';
  import { onMount } from 'svelte';
  import { InterventiService } from './interventi.service';
  import type { InterventionItem } from './schema';
  import { InterventionSettingsService, type InterventionSettingsConfig, DEFAULT_INTERVENTION_SETTINGS } from '$lib/services/interventionSettings';
  import { db, collection, getDocs } from '$lib/firebase';
  
  import InterventiHeader from './components/InterventiHeader.svelte';
  import InterventiFilters from './components/InterventiFilters.svelte';
  import InterventiTable from './components/InterventiTable.svelte';
  import InterventiCalendar from './components/InterventiCalendar.svelte';
  import { CacheLookupService } from '$lib/services/cacheLookupService';

  let interventions = $state<InterventionItem[]>([]);
  let settings = $state<InterventionSettingsConfig>({ ...DEFAULT_INTERVENTION_SETTINGS });
  let users = $state<{ id: string; name: string }[]>([]);
  let loading = $state(true);

  // Filtri State
  let searchQuery = $state('');
  let selectedStatus = $state('');
  let selectedMode = $state('');
  let selectedOperator = $state('');
  let viewMode = $state<'list' | 'calendar'>('list');

  onMount(async () => {
    try {
      settings = await InterventionSettingsService.getSettings();
      interventions = await InterventiService.getInterventions();
      users = await CacheLookupService.getLookup('users');
    } catch (e) {
      console.error('Errore caricamento interventi:', e);
    } finally {
      loading = false;
    }
  });

  // KPI Calculations
  let totalCount = $derived(interventions.length);
  let plannedCount = $derived(interventions.filter(i => i.status === 'pianificato' || i.status === 'in_lavorazione').length);
  let totalActualHours = $derived(interventions.reduce((sum, i) => sum + (i.actualHoursWorked || 0), 0));
  let totalValueBolla = $derived(interventions.filter(i => i.mode === 'a_bolla').reduce((sum, i) => sum + (i.totalAmount || 0), 0));

  // Filtered List
  let filteredInterventions = $derived(interventions.filter(i => {
    if (selectedStatus && i.status !== selectedStatus) return false;
    if (selectedMode && i.mode !== selectedMode) return false;
    if (selectedOperator && !(i.assignedOperatorUids || []).includes(selectedOperator)) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = (i.title || '').toLowerCase().includes(q);
      const matchClient = (i.clientName || '').toLowerCase().includes(q);
      const matchLoc = (i.locationName || '').toLowerCase().includes(q);
      if (!matchTitle && !matchClient && !matchLoc) return false;
    }
    return true;
  }));
</script>

<svelte:head>
  <title>Interventi & Rapportini | {$projectStore?.projectName || 'ERP'}</title>
</svelte:head>

<div class="interventi-page animate-fade-in">
  <InterventiHeader 
    locationLabel={settings.locationLabel} 
    {totalCount} 
    {plannedCount} 
    {totalActualHours} 
    {totalValueBolla} 
    bind:viewMode 
  />

  <InterventiFilters 
    bind:searchQuery 
    bind:selectedStatus 
    bind:selectedMode 
    bind:selectedOperator 
    {users} 
  />

  {#if loading}
    <div class="loader-box">
      <span class="spinner"></span>
      Caricamento interventi in corso...
    </div>
  {:else if viewMode === 'list'}
    <InterventiTable interventions={filteredInterventions} locationLabel={settings.locationLabel} />
  {:else}
    <InterventiCalendar interventions={filteredInterventions} locationLabel={settings.locationLabel} />
  {/if}
</div>

<style>
  .interventi-page {
    width: 100%;
  }
  .loader-box {
    padding: 40px;
    text-align: center;
    color: var(--color-neutral-500);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }
  .spinner {
    width: 24px;
    height: 24px;
    border: 3px solid var(--color-neutral-200);
    border-top-color: var(--color-primary-500);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  .animate-fade-in {
    animation: fadeIn 0.3s ease;
  }
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  }
</style>
