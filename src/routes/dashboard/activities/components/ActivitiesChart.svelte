<script lang="ts">
  import { Card, LineChart } from '$lib';
  import { TrendingUp, ChevronUp, ChevronDown } from '@lucide/svelte';
  import type { ActivityItem } from '../activities.service';
  import { DashboardService } from '../../dashboard.service';
  import { activitiesConfigStore } from '$lib/stores/activities';

  interface Props {
    chartData: number[];
    activeRole: string | null;
    myUid: string | undefined;
    filterType: string;
    granularity: 'settimanale' | 'mensile' | 'annuale';
    endDateString: string;
    selectedPointIdx: number | null;
    isGraphExpanded: boolean;
    onToggleGraph: () => void;
    onFilterChange: (type: string) => void;
    onGranularityChange: (g: 'settimanale' | 'mensile' | 'annuale') => void;
    onEndDateChange: (date: string) => void;
    onSelectPoint: (idx: number | null) => void;
    chartPeriods: { label: string, start: Date, end: Date }[];
  }

  let {
    chartData,
    activeRole,
    myUid,
    filterType,
    granularity,
    endDateString,
    selectedPointIdx,
    isGraphExpanded,
    onToggleGraph,
    onFilterChange,
    onGranularityChange,
    onEndDateChange,
    onSelectPoint,
    chartPeriods
  }: Props = $props();

  let chartWrapperW = $state(0);
  let chartWrapperH = $state(0);

  let computedChartPoints = $derived.by(() => {
    return chartData || chartPeriods.map(() => 0);
  });
</script>

<div class="subpage-chart-control">
  <button onclick={onToggleGraph} class="toggle-chart-btn">
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
    <Card title="Andamento Attività Commerciali e Amministrative" description="Visualizza il trend e clicca su un punto del grafico per filtrare le attività per data.">
      {#snippet icon()}
        <TrendingUp size={20} class="icon-accent" />
      {/snippet}

      <div class="chart-controls-box" style="margin-bottom: 20px; display: flex; flex-wrap: wrap; justify-content: space-between; gap: 16px;">
        <!-- Metrics Switcher -->
        <div class="chart-tab-switcher" style="display: flex; gap: 4px; background: var(--color-neutral-100); padding: 4px; border-radius: var(--radius-md); overflow-x: auto; max-width: 100%;">
          <button class="chart-tab-btn" class:active={filterType === 'all'} onclick={() => onFilterChange('all')} style="border: none; background: {filterType === 'all' ? 'var(--color-white)' : 'transparent'}; box-shadow: {filterType === 'all' ? 'var(--shadow-sm)' : 'none'}; padding: 6px 16px; border-radius: var(--radius-sm); font-weight: 600; font-size: 13px; color: {filterType === 'all' ? 'var(--color-primary-600)' : 'var(--color-neutral-500)'}; cursor: pointer; transition: all 0.2s; white-space: nowrap;" title="Tutte le Attività">Tutte</button>
          
          {#each $activitiesConfigStore.filter(kpi => kpi.rolesView.includes(activeRole || '')) as kpi}
            <button 
              class="chart-tab-btn" 
              class:active={filterType === kpi.id} 
              onclick={() => onFilterChange(kpi.id)} 
              style="border: none; background: {filterType === kpi.id ? 'var(--color-white)' : 'transparent'}; box-shadow: {filterType === kpi.id ? 'var(--shadow-sm)' : 'none'}; padding: 6px 16px; border-radius: var(--radius-sm); font-weight: 600; font-size: 13px; color: {filterType === kpi.id ? 'var(--color-primary-600)' : 'var(--color-neutral-500)'}; cursor: pointer; transition: all 0.2s; white-space: nowrap;" 
              title={kpi.name}
            >
              {kpi.name.substring(0, 3).toUpperCase()}
            </button>
          {/each}
        </div>

        <div class="chart-granularity-picker" style="display: flex; gap: 16px; align-items: center;">
          <div class="picker-item" style="display: flex; align-items: center; gap: 8px;">
            <span class="picker-lbl" style="font-size: 12px; font-weight: 600; color: var(--color-neutral-500);">Dettaglio</span>
            <select value={granularity} onchange={(e) => onGranularityChange(e.currentTarget.value as any)} class="sub-chart-select">
              <option value="settimanale">Settimanale</option>
              <option value="mensile">Mensile</option>
              <option value="annuale">Annuale</option>
            </select>
          </div>
          <div class="picker-item" style="display: flex; align-items: center; gap: 8px;">
            <span class="picker-lbl" style="font-size: 12px; font-weight: 600; color: var(--color-neutral-500);">Fino al</span>
            <input type="date" value={endDateString} onchange={(e) => onEndDateChange(e.currentTarget.value)} class="sub-chart-date-picker" />
          </div>
        </div>
      </div>

      <div class="chart-flex-wrapper" bind:clientWidth={chartWrapperW} bind:clientHeight={chartWrapperH} style="flex: 1; min-height: 250px; width: 100%; display: flex; flex-direction: column;">
        {#if chartWrapperW > 0}
          <LineChart
            data={computedChartPoints}
            labels={chartPeriods.map(p => p.label)}
            selectedIdx={selectedPointIdx}
            onSelect={onSelectPoint}
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
    color: var(--color-neutral-700);
    outline: none;
    transition: all 0.2s;
  }
  .sub-chart-select:focus, .sub-chart-date-picker:focus {
    border-color: var(--color-primary-500);
    box-shadow: 0 0 0 2px hsla(var(--brand-h), var(--brand-s), var(--brand-l), 0.1);
  }

  :global(.icon-accent) {
    color: var(--color-primary-500);
  }

  .animate-fade-in {
    animation: fadeIn 0.3s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  }
</style>
