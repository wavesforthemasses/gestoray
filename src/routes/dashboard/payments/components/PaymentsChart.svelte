<script lang="ts">
  import { Card, LineChart } from '$lib';
  import { TrendingUp, ChevronUp, ChevronDown } from '@lucide/svelte';
  import { DashboardService } from '../../dashboard.service';


  interface Props {
    chartData: number[];
    isGraphExpanded: boolean;
    onToggle: () => void;
    selectedPointIdx: number | null;
    onPointSelect: (idx: number | null) => void;
    chartPeriods: Array<{ start: Date; end: Date; label: string }>;
  }

  let { 
    chartData = [],
    isGraphExpanded = $bindable(false),
    onToggle,
    selectedPointIdx = $bindable(null),
    onPointSelect,
    chartPeriods = $bindable([])
  } = $props();

  // We hardcode 'gi' (Gestione Incassi) as the metric since we are in the Payments tab
  let activeChartTab = 'gi'; 
  let granularity = $state<'settimanale' | 'mensile' | 'annuale'>('mensile');
  let endDateString = $state(new Date().toISOString().split('T')[0]);
  
  let chartWrapperW = $state(0);
  // Synchronize periods out to the parent so it can filter the table
  $effect(() => {
    chartPeriods = DashboardService.generateChartPeriods(endDateString, granularity);
  });

  let computedChartPoints = $derived(chartData || chartPeriods.map(() => 0));
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
    <Card title="Andamento Incassi Cassa (GI)" description="Visualizza il trend e clicca su un punto del grafico per filtrare il registro incassi in base al periodo selezionato.">
      {#snippet icon()}
        <TrendingUp size={20} class="icon-accent" />
      {/snippet}

      <div class="chart-controls-box controls-layout">
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

      <div class="chart-flex-wrapper chart-container-layout" bind:clientWidth={chartWrapperW}>
        {#if chartWrapperW > 0}
          <LineChart
            data={computedChartPoints}
            labels={chartPeriods.map(p => p.label)}
            selectedIdx={selectedPointIdx}
            onSelect={onPointSelect}
            width={Math.max(chartWrapperW - 34, 300)}
            height={250}
            xPadding={50}
            yPadding={30}
          />
        {/if}
      </div>
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
    justify-content: flex-end;
    gap: 16px;
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

  .chart-container-layout {
    flex: 1;
    min-height: 250px;
    width: 100%;
    display: flex;
    flex-direction: column;
  }
</style>
