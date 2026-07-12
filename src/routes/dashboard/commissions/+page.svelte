<script lang="ts">
  import { hasAccess } from '$lib/utils/authCheck';
  import { toast } from '$lib/stores/toast';
  import { confirmStore } from '$lib/stores/confirm';
  import { activeRole, auth } from '$lib/auth';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { FileText } from '@lucide/svelte';
  import { CommissionsService } from './commissions.service';
  
  import PeriodSelector from './components/PeriodSelector.svelte';
  import GeneratePanel from './components/GeneratePanel.svelte';
  import HistoryPanel from './components/HistoryPanel.svelte';

  let loading = $state(true);
  let generating = $state(false);

  let initialDate = new Date();
  initialDate.setMonth(initialDate.getMonth() - 1);
  let selectedMonth = $state(initialDate.getMonth() + 1); // 1-12
  let selectedYear = $state(initialDate.getFullYear());

  let versions = $state<any[]>([]);

  let hasVersions = $derived(versions.length > 0);
  let hasAnyFinalized = $derived(versions.some(v => v.status === 'finalized'));

  onMount(() => {
    const unsubscribe = activeRole.subscribe(($activeRole) => {
      if ($activeRole && !hasAccess($activeRole, ['superadmin', 'amministrazione', 'direzione'])) {
        goto('/dashboard');
      }
    });

    loadVersions();
    return () => unsubscribe();
  });

  async function loadVersions() {
    loading = true;
    versions = [];

    try {
      const periodId = `${selectedYear}_${String(selectedMonth).padStart(2, '0')}`;
      versions = await CommissionsService.getVersions(periodId);
    } catch (e: any) {
      toast.error('Errore nel caricamento delle versioni: ' + e.message);
    } finally {
      loading = false;
    }
  }

  function selectVersion(v: any) {
    const periodId = `${selectedYear}_${String(selectedMonth).padStart(2, '0')}`;
    goto(`/dashboard/commissions/${periodId}/${v.id}`);
  }

  async function handleDeleteVersion(e: Event, v: any) {
    e.stopPropagation();
    const ok = await confirmStore.prompt(`Sei sicuro di voler eliminare questa versione? L'azione è irreversibile.`);
    if (!ok) return;
    
    generating = true;
    try {
      const periodId = `${selectedYear}_${String(selectedMonth).padStart(2, '0')}`;
      await CommissionsService.deleteVersion(periodId, v.id);
      toast.success('Versione di calcolo eliminata con successo.');
      await loadVersions();
    } catch (err: any) {
      console.error(err);
      toast.error('Errore durante l\'eliminazione della versione: ' + err.message);
    } finally {
      generating = false;
    }
  }

  async function handleCalculate() {
    generating = true;
    try {
      const periodId = `${selectedYear}_${String(selectedMonth).padStart(2, '0')}`;
      const newVersion = await CommissionsService.generateCalculation(periodId, selectedMonth, selectedYear, $auth!.uid, $auth!.email!, hasAnyFinalized);
      
      versions = [newVersion, ...versions];
      toast.success('Nuova bozza del prospetto provvigionale generata e salvata con successo!');
      
      // Navigate to the newly generated version
      goto(`/dashboard/commissions/${periodId}/${newVersion.id}`);
    } catch(e: any) {
      console.error(e);
      toast.error('Errore durante la generazione del calcolo: ' + e.message);
    } finally {
      generating = false;
    }
  }
</script>

<svelte:head>
  <title>Storico Provvigioni | Gestoray</title>
</svelte:head>

<div class="commissions-page animate-fade-in">
  <div class="header-dashboard-section">
    <PeriodSelector 
      bind:selectedMonth
      bind:selectedYear
      {loading}
      {generating}
      {hasVersions}
      {hasAnyFinalized}
      onMonthChange={loadVersions}
      onYearChange={loadVersions}
    />
  </div>

  <div class="top-panels-row">
    <!-- PANNELLO IMPOSTAZIONI: SEMPRE VISIBILE PER GENERARE NUOVE BOZZE -->
    <GeneratePanel 
      {hasAnyFinalized}
      {loading}
      {generating}
      onCalculate={handleCalculate}
    />

    <!-- STORICO VERSIONI (SCROLLABILE) -->
    {#if hasVersions}
      <HistoryPanel 
        {versions}
        onSelectVersion={selectVersion}
        onDeleteVersion={handleDeleteVersion}
      />
    {/if}
  </div>

  {#if loading}
    <div class="loader-box">
      <span class="spinner"></span>
      Caricamento in corso...
    </div>
  {:else if !hasVersions}
    <div class="empty-state">
      <FileText size={48} color="var(--color-neutral-300)" />
      <h3>Nessun prospetto disponibile</h3>
      <p>Clicca su "Genera Nuova Bozza" per calcolare le provvigioni del mese.</p>
    </div>
  {/if}
</div>

<style>
  .commissions-page {
    width: 100%;
  }

  .top-panels-row {
    display: flex;
    gap: 24px;
    margin-top: 24px;
    align-items: stretch;
    flex-wrap: wrap;
  }

  .empty-state {
    padding: 60px 20px;
    text-align: center;
    background: var(--color-white);
    border-radius: var(--radius-md);
    border: 1px dashed var(--color-neutral-300);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    margin-top: 24px;
  }
  
  .empty-state h3 {
    margin: 0;
    color: var(--color-neutral-800);
  }
  
  .empty-state p {
    margin: 0;
    color: var(--color-neutral-500);
    font-size: 14px;
    max-width: 400px;
  }

  .loader-box {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 40px;
    color: var(--color-neutral-500);
  }

  .spinner {
    width: 20px;
    height: 20px;
    border: 2px solid hsla(var(--brand-h), var(--brand-s), var(--brand-l), 0.15);
    border-radius: 50%;
    border-top-color: var(--color-primary-500);
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>
