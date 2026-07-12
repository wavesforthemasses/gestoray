<script lang="ts">
  import { hasAccess } from '$lib/utils/authCheck';
  import { toast } from '$lib/stores/toast';
  import { activeRole, auth } from '$lib/auth';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { Card } from '$lib';
  import { Award } from '@lucide/svelte';
  
  import { MyCommissionsService, type MyCommissionsData } from './my-commissions.service';
  import MyCommissionsHeader from './components/MyCommissionsHeader.svelte';
  import MyCommissionsKPIs from './components/MyCommissionsKPIs.svelte';
  import MyCommissionsTable from './components/MyCommissionsTable.svelte';

  let loading = $state(true);

  // Selected period
  let selectedMonth = $state(new Date().getMonth() + 1); // 1-12
  let selectedYear = $state(new Date().getFullYear());

  let data = $state<MyCommissionsData>({
    isFinalized: false,
    allocations: [],
    totalCommissions: 0,
    totalSales: 0
  });

  onMount(() => {
    const unsubscribe = activeRole.subscribe(($activeRole) => {
      if ($activeRole && !hasAccess($activeRole, ['commerciale'])) {
        goto('/dashboard');
      }
    });

    if ($auth) {
      loadData();
    }

    return () => unsubscribe();
  });

  async function loadData() {
    if (!$auth) return;
    loading = true;

    try {
      const periodId = `${selectedYear}_${String(selectedMonth).padStart(2, '0')}`;
      data = await MyCommissionsService.getMyCommissions(periodId, $auth.uid);
    } catch (e: any) {
      console.error(e);
      toast.error('Errore nel caricamento delle tue provvigioni: ' + e.message);
    } finally {
      loading = false;
    }
  }
</script>

<div class="my-commissions-page animate-fade-in">
  <div class="page-header">
    <div class="header-left">
      <h1 class="page-title"><Award size={28} class="title-icon" /> Le Mie Provvigioni</h1>
      <p class="page-subtitle">Visualizza in dettaglio le tue provvigioni maturate nel periodo selezionato.</p>
    </div>
  </div>

  <MyCommissionsHeader 
    bind:selectedMonth
    bind:selectedYear
    isClosingFinalized={data.isFinalized}
    onDateChange={loadData}
  />

  {#if loading}
    <div class="loader-box">
      <span class="spinner"></span>
      Calcolo provvigioni in corso...
    </div>
  {:else}
    {#if data.isFinalized}
      <MyCommissionsKPIs 
        totalSales={data.totalSales}
        totalCommissions={data.totalCommissions}
      />

      <MyCommissionsTable 
        myAllocations={data.allocations}
      />
    {:else}
      <Card>
        <div class="empty-state">
          <Award size={48} class="empty-icon" />
          <h3>Provvigioni non ancora approvate</h3>
          <p>Il calcolo provvigionale per il periodo di {selectedMonth}/{selectedYear} è attualmente in fase di elaborazione da parte dell'amministrazione. Torna a controllare più tardi.</p>
        </div>
      </Card>
    {/if}
  {/if}
</div>

<style>
  .my-commissions-page {
    display: flex;
    flex-direction: column;
    gap: 24px;
    padding-bottom: 40px;
  }

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
  }
  .header-left {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .page-title {
    font-size: 24px;
    font-weight: 700;
    color: var(--color-neutral-900);
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 0;
  }
  .title-icon {
    color: var(--color-primary-500);
  }
  .page-subtitle {
    margin: 0;
    color: var(--color-neutral-500);
    font-size: 14px;
  }

  .loader-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    padding: 60px 20px;
    background: white;
    border-radius: 12px;
    border: 1px solid var(--color-neutral-200);
    color: var(--color-neutral-600);
    font-weight: 500;
  }
  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--color-neutral-200);
    border-top-color: var(--color-primary-500);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .empty-state {
    padding: 40px 20px;
    text-align: center;
    color: var(--color-neutral-500);
  }
  .empty-icon {
    margin-bottom: 16px;
    opacity: 0.5;
  }
  .empty-state h3 {
    margin: 0 0 8px 0;
    color: var(--color-neutral-800);
  }
  .empty-state p {
    margin: 0;
    font-size: 14px;
  }
</style>
