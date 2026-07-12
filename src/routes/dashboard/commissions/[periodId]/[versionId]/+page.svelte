<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { activeRole, auth } from '$lib/auth';
  import { hasAccess } from '$lib/utils/authCheck';
  import { CommissionsService } from '../../commissions.service';
  import { toast } from '$lib/stores/toast';
  import { ArrowLeft } from '@lucide/svelte';

  import CommissionsKPIs from './components/CommissionsKPIs.svelte';
  import VendorBreakdownTable from './components/VendorBreakdownTable.svelte';
  import AllocationsTable from './components/AllocationsTable.svelte';

  let activeVersion = $state<any>(null);
  let loading = $state(true);
  let submitting = $state(false);

  let periodId = $derived($page.params.periodId);
  let versionId = $derived($page.params.versionId);

  let isClosingFinalized = $derived(activeVersion?.status === 'finalized');
  let totalIncassi = $derived(activeVersion?.totalIncassi || 0);
  let totalAllocated = $derived(activeVersion?.totalAllocated || 0);
  let totalCommissionsToLiquidate = $derived(activeVersion?.totalCommissions || 0);
  let vendorSummary = $derived(activeVersion?.breakdown || []);
  let allocationsList = $derived(activeVersion?.allocations || []);

  onMount(() => {
    const unsubscribe = activeRole.subscribe(($activeRole) => {
      if ($activeRole && !hasAccess($activeRole, ['superadmin', 'amministrazione', 'direzione'])) {
        goto('/dashboard');
      }
    });

    loadData();
    return () => unsubscribe();
  });

  async function loadData() {
    loading = true;
    try {
      activeVersion = await CommissionsService.getVersion(periodId, versionId);
      if (!activeVersion) {
        toast.error('Versione non trovata.');
        goto('/dashboard/commissions');
      }
    } catch (e: any) {
      toast.error('Errore durante il caricamento: ' + e.message);
    } finally {
      loading = false;
    }
  }

  async function handleFinalizeCommissions() {
    if (!$auth || !activeVersion || activeVersion.status === 'finalized') return;
    submitting = true;

    try {
      const now = await CommissionsService.finalizeVersion(periodId, versionId, $auth.uid, $auth.email!);
      activeVersion.status = 'finalized';
      activeVersion.finalizedAt = now;
      activeVersion.finalizedEmail = $auth.email;
      toast.success('Versione provvigionale resa DEFINITIVA con successo!');
    } catch (e: any) {
      toast.error('Errore durante la chiusura delle provvigioni: ' + e.message);
    } finally {
      submitting = false;
    }
  }
</script>

<svelte:head>
  <title>Dettaglio Provvigioni | Gestoray</title>
</svelte:head>

<div class="version-details-page animate-fade-in">
  <div class="header-actions">
    <button onclick={() => goto('/dashboard/commissions')} class="back-link">
      <ArrowLeft size={16} /> Torna allo Storico Provvigioni
    </button>
  </div>

  {#if loading}
    <div class="loader-box">
      <span class="spinner"></span>
      Caricamento dettaglio...
    </div>
  {:else if activeVersion}
    <div class="full-width-details">
      <CommissionsKPIs 
        {totalIncassi}
        {totalAllocated}
        {totalCommissionsToLiquidate}
        {isClosingFinalized}
      />

      <VendorBreakdownTable 
        {vendorSummary}
        {isClosingFinalized}
        calculationMode={activeVersion.calculationMode}
        onFinalize={handleFinalizeCommissions}
        canFinalize={!isClosingFinalized && $activeRole !== 'direzione'}
        {submitting}
      />

      <AllocationsTable {allocationsList} />
    </div>
  {/if}
</div>

<style>
  .version-details-page {
    width: 100%;
  }

  .header-actions {
    margin-bottom: 24px;
  }

  .back-link {
    background: var(--color-white);
    border: 1px solid var(--color-neutral-300);
    color: var(--color-neutral-600);
    padding: 8px 14px;
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-family: inherit;
    font-size: 13px;
    font-weight: 600;
    transition: all 0.2s;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .back-link:hover {
    background: var(--color-neutral-100);
    color: var(--color-neutral-800);
  }

  .full-width-details {
    width: 100%;
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

  .animate-fade-in {
    animation: fadeIn 0.3s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  }
</style>
