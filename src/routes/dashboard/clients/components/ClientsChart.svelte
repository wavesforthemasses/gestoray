<script lang="ts">
  import { Card, LineChart } from '$lib';
  import { TrendingUp, ChevronUp, ChevronDown } from '@lucide/svelte';
  import { DashboardService } from '../../dashboard.service';
  import { activeRoleState, authState } from '$lib/auth.svelte';

  interface Props {
    isGraphExpanded: boolean;
    onToggle: () => void;
    selectedPointIdx: number | null;
    onPointSelect: (idx: number | null) => void;
    chartPeriods: Array<{ start: Date; end: Date; label: string }>;
  }

  let { 
    isGraphExpanded = $bindable(false),
    onToggle,
    selectedPointIdx = $bindable(null),
    onPointSelect,
    chartPeriods = $bindable([])
  } = $props();

  let activeChartTab = $state<'nuove_anagrafiche' | 'nncf' | 'vss' | 'gi'>('nuove_anagrafiche');
  let granularity = $state<'settimanale' | 'mensile' | 'annuale'>('mensile');
  let endDateString = $state(new Date().toISOString().split('T')[0]);
  
  let chartWrapperW = $state(0);
  let loadingChart = $state(false);
  let chartRawClients = $state<any[]>([]);

  // Synchronize periods out to the parent so it can filter the table
  $effect(() => {
    chartPeriods = DashboardService.generateChartPeriods(endDateString, granularity);
  });

  let computedChartPoints = $state<number[]>([]);

  async function loadChartData() {
    if (!isGraphExpanded || chartPeriods.length === 0) return;
    loadingChart = true;

    try {
      const roleToUse = activeRoleState.role || '';
      const uidToUse = authState.user?.uid || '';
      
      const results = await DashboardService.fetchChartAggregations(chartPeriods, roleToUse, uidToUse, activeChartTab);
      computedChartPoints = results || chartPeriods.map(() => 0);
    } catch (e) {
      console.error("Error loading clients chart data:", e);
      computedChartPoints = chartPeriods.map(() => 0);
    } finally {
      loadingChart = false;
    }
  }

  $effect(() => {
    if (isGraphExpanded || granularity || endDateString || activeChartTab) {
      loadChartData();
    }
  });
</script>

<div class="subpage-chart-control">
  <button onclick={onToggle} class="toggle-chart-btn">
    <TrendingUp size={16} /> 
    {isGraphExpanded ? 'Nascondi Grafico Andamento' : 'Mostra Grafico Andamento'}
    {#if isGraphExpanded}
      <ChevronUp size={14} />
    {:else}
      <ChevronDown size={14} />
    {/if}
  </button>
</div>

{#if isGraphExpanded}
  <div class="subpage-chart-card animate-fade-in">
    <Card title="Andamento Nuovi Lead e Performance Clienti" description="Visualizza il trend e clicca su un punto del grafico per filtrare l'elenco dei clienti in base al periodo selezionato.">
      {#snippet icon()}
        <TrendingUp size={20} class="icon-accent" />
      {/snippet}

      <div class="chart-controls-box controls-layout">
        <div class="chart-tab-switcher tab-switcher-bg">
          <button class="chart-tab-btn tab-btn-style" class:active={activeChartTab === 'nuove_anagrafiche'} onclick={() => { activeChartTab = 'nuove_anagrafiche'; onPointSelect(null); }} title="Nuove Anagrafiche">NA</button>
          <button class="chart-tab-btn tab-btn-style" class:active={activeChartTab === 'nncf'} onclick={() => { activeChartTab = 'nncf'; onPointSelect(null); }} title="NNCF (Primi Ordini)">NNCF</button>
          <button class="chart-tab-btn tab-btn-style" class:active={activeChartTab === 'vss'} onclick={() => { activeChartTab = 'vss'; onPointSelect(null); }} title="Valore Venduto">VSS</button>
          <button class="chart-tab-btn tab-btn-style" class:active={activeChartTab === 'gi'} onclick={() => { activeChartTab = 'gi'; onPointSelect(null); }} title="Incassato">GI</button>
        </div>

        <div class="chart-granularity-picker flex-row-gap16-align">
          <div class="picker-item flex-row-gap8-align">
            <span class="picker-lbl label-style">Dettaglio</span>
            <select bind:value={granularity} class="sub-chart-select">
              <option value="settimanale">Settimanale</option>
              <option value="mensile">Mensile</option>
              <option value="annuale">Annuale</option>
            </select>
          </div>
          <div class="picker-item flex-row-gap8-align">
            <span class="picker-lbl label-style">Fino al</span>
            <input type="date" bind:value={endDateString} class="sub-chart-date-picker" />
          </div>
        </div>
      </div>

      {#if loadingChart}
        <div class="loader-box no-border-padded">
          <span class="spinner"></span>
          Caricamento andamento...
        </div>
      {:else}
        <div class="chart-flex-wrapper chart-container-layout" bind:clientWidth={chartWrapperW}>
          {#if chartWrapperW > 0}
            <LineChart
              data={computedChartPoints}
              labels={chartPeriods.map((p: any) => p.label)}
              selectedIdx={selectedPointIdx}
              onSelect={onPointSelect}
              width={Math.max(chartWrapperW - 34, 300)}
              height={250}
              xPadding={50}
              yPadding={30}
              isCurrency={activeChartTab === 'vss' || activeChartTab === 'gi'}
            />
          {/if}
        </div>
      {/if}
    </Card>
  </div>
{/if}

<style>
  .subpage-chart-control {
    margin-bottom: 16px;
    display: flex;
    justify-content: flex-end;
  }

  .toggle-chart-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: var(--color-white);
    border: 1px solid var(--color-neutral-300);
    color: var(--color-neutral-600);
    padding: 8px 16px;
    border-radius: var(--radius-sm);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .toggle-chart-btn:hover {
    background: var(--color-neutral-100);
    color: var(--color-neutral-800);
  }

  .subpage-chart-card {
    margin-bottom: 24px;
  }

  .sub-chart-select, .sub-chart-date-picker {
    height: 36px;
    padding: 0 8px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--color-neutral-300);
    font-family: inherit;
    font-size: 13px;
    background: var(--color-white);
    color: var(--color-neutral-800);
    transition: border-color 0.2s;
  }

  .controls-layout {
    margin-bottom: 20px;
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 16px;
  }

  .tab-switcher-bg {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    background: var(--color-neutral-100);
    padding: 4px;
    border-radius: var(--radius-md);
  }

  .tab-btn-style {
    border: none;
    background: transparent;
    box-shadow: none;
    padding: 6px 16px;
    border-radius: var(--radius-sm);
    font-weight: 600;
    font-size: 13px;
    color: var(--color-neutral-500);
    cursor: pointer;
    transition: all 0.2s;
  }

  .tab-btn-style.active {
    background: var(--color-white);
    box-shadow: var(--shadow-sm);
    color: var(--color-primary-600);
  }

  .flex-row-gap16-align {
    display: flex;
    gap: 16px;
    align-items: center;
  }

  .flex-row-gap8-align {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .label-style {
    font-size: 12px;
    font-weight: 600;
    color: var(--color-neutral-500);
  }

  .no-border-padded {
    border: none;
    padding: 20px;
  }

  .chart-container-layout {
    flex: 1;
    min-height: 250px;
    width: 100%;
    display: flex;
    flex-direction: column;
  }
</style>
