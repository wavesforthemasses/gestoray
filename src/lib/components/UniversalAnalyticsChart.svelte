<script lang="ts">
  import { Card, LineChart } from '$lib';
  import { TrendingUp, ChevronUp, ChevronDown, Maximize2, Minimize2 } from '@lucide/svelte';
  import type { MetricOption } from '$lib/types/moduleAnalyticsSettings';
  import { menuConfigStore } from '$lib/stores/menu';
  import type { Snippet } from 'svelte';

  interface Props {
    title?: string;
    description?: string;
    metrics?: MetricOption[];
    activeMetric?: string;
    granularity?: 'settimanale' | 'mensile' | 'annuale';
    endDateString?: string;
    chartPeriods?: Array<{ start: Date; end: Date; label: string }>;
    computedChartPoints?: number[];
    selectedPointIdx?: number | null;
    loadingChart?: boolean;
    collapsible?: boolean;
    isExpanded?: boolean;
    showFullscreenToggle?: boolean;
    kpisPosition?: 'right' | 'top' | 'bottom' | 'none';
    kpisSnippet?: Snippet;
    
    // Callbacks
    onToggle?: (expanded?: boolean) => void;
    onMetricSelect?: (metricId: string) => void;
    onGranularityChange?: (granularity: 'settimanale' | 'mensile' | 'annuale') => void;
    onEndDateChange?: (dateStr: string) => void;
    onPointSelect?: (idx: number | null) => void;
  }

  let {
    title = 'Trend e Andamento Performance',
    description = 'Visualizza l\'andamento temporale delle metriche aziendali. Clicca sui punti per analizzare i dettagli del periodo.',
    metrics = [
      { id: 'nuove_anagrafiche', label: 'Nuove Anagrafiche', shortLabel: 'NA' },
      { id: 'vss', label: 'Valore Venduto', shortLabel: 'VSS', isCurrency: true },
      { id: 'gi', label: 'Incassato', shortLabel: 'GI', isCurrency: true }
    ],
    activeMetric = $bindable('nuove_anagrafiche'),
    granularity = $bindable('mensile'),
    endDateString = $bindable(new Date().toISOString().split('T')[0]),
    chartPeriods = [],
    computedChartPoints = [],
    selectedPointIdx = $bindable(null),
    loadingChart = false,
    collapsible = true,
    isExpanded = $bindable(true),
    showFullscreenToggle = true,
    kpisPosition = 'right',
    kpisSnippet,

    onToggle,
    onMetricSelect,
    onGranularityChange,
    onEndDateChange,
    onPointSelect
  }: Props = $props();

  let isModuleChartActive = $derived(
    $menuConfigStore.length === 0 || $menuConfigStore.some(m => m.id === 'chart')
  );

  let isFullscreen = $state(false);
  let chartWrapperW = $state(0);
  let chartWrapperH = $state(0);

  let currentMetricObj = $derived(
    metrics.find(m => m.id === activeMetric) || metrics[0]
  );

  function handleMetricClick(metricId: string) {
    activeMetric = metricId;
    selectedPointIdx = null;
    if (onMetricSelect) onMetricSelect(metricId);
  }

  function handleGranularityChange(e: Event) {
    const val = (e.target as HTMLSelectElement).value as 'settimanale' | 'mensile' | 'annuale';
    granularity = val;
    selectedPointIdx = null;
    if (onGranularityChange) onGranularityChange(val);
  }

  function handleEndDateChange(e: Event) {
    const val = (e.target as HTMLInputElement).value;
    endDateString = val;
    selectedPointIdx = null;
    if (onEndDateChange) onEndDateChange(val);
  }

  function handlePointSelect(idx: number | null) {
    selectedPointIdx = idx;
    if (onPointSelect) onPointSelect(idx);
  }

  function toggleExpand() {
    isExpanded = !isExpanded;
    if (typeof window !== 'undefined') {
      localStorage.setItem('subpage_graph_expanded', String(isExpanded));
    }
    if (onToggle) onToggle(isExpanded);
  }
</script>

{#if isModuleChartActive}
  {#if collapsible}
    <div class="subpage-chart-control">
      <button type="button" onclick={toggleExpand} class="toggle-chart-btn">
        <TrendingUp size={16} /> 
        <span>{isExpanded ? 'Nascondi Grafico Andamento' : 'Mostra Grafico Andamento'}</span>
        {#if isExpanded}
          <ChevronUp size={14} />
        {:else}
          <ChevronDown size={14} />
        {/if}
      </button>
    </div>
  {/if}

  {#if !collapsible || isExpanded}
    <div class="universal-chart-card animate-fade-in" class:fullscreen-mode={isFullscreen}>
      {#if kpisSnippet && (kpisPosition === 'right' || kpisPosition === 'top' || kpisPosition === 'bottom')}
        <div class="chart-split-layout position-{kpisPosition}">
          {#if kpisPosition === 'top'}
            <div class="kpi-banner-wrapper">
              {@render kpisSnippet()}
            </div>
          {/if}

          <div class="chart-main-col">
            <Card {title} {description}>
              {#snippet icon()}
                <TrendingUp size={20} class="icon-accent" />
              {/snippet}

              <div class="chart-controls-box controls-layout">
                {#if metrics && metrics.length > 0}
                  <div class="chart-tab-switcher tab-switcher-bg">
                    {#each metrics as m}
                      <button
                        type="button"
                        class="chart-tab-btn tab-btn-style"
                        class:active={activeMetric === m.id}
                        onclick={() => handleMetricClick(m.id)}
                        title={m.label}
                      >
                        {m.shortLabel || m.label}
                      </button>
                    {/each}
                  </div>
                {/if}

                <div class="chart-granularity-picker flex-row-gap16-align">
                  <div class="picker-item flex-row-gap8-align">
                    <span class="picker-lbl label-style">Dettaglio</span>
                    <select value={granularity} onchange={handleGranularityChange} class="sub-chart-select">
                      <option value="settimanale">Settimanale</option>
                      <option value="mensile">Mensile</option>
                      <option value="annuale">Annuale</option>
                    </select>
                  </div>

                  <div class="picker-item flex-row-gap8-align">
                    <span class="picker-lbl label-style">Fino al</span>
                    <input type="date" value={endDateString} onchange={handleEndDateChange} class="sub-chart-date-picker" />
                  </div>

                  {#if showFullscreenToggle}
                    <div class="picker-item">
                      <button type="button" onclick={() => isFullscreen = !isFullscreen} class="fs-btn">
                        {#if isFullscreen}
                          <Minimize2 size={16} /> <span class="fs-btn-text">Riduci</span>
                        {:else}
                          <Maximize2 size={16} /> <span class="fs-btn-text">Espandi</span>
                        {/if}
                      </button>
                    </div>
                  {/if}
                </div>
              </div>

              {#if loadingChart}
                <div class="loader-box no-border-padded">
                  <span class="spinner"></span>
                  Caricamento andamento in corso...
                </div>
              {:else}
                <div 
                  class="chart-flex-wrapper chart-container-layout" 
                  class:fullscreen-canvas={isFullscreen}
                  bind:clientWidth={chartWrapperW}
                  bind:clientHeight={chartWrapperH}
                >
                  {#if chartWrapperW > 0}
                    <LineChart
                      data={computedChartPoints}
                      labels={chartPeriods.map(p => p.label)}
                      selectedIdx={selectedPointIdx}
                      onSelect={handlePointSelect}
                      width={Math.max(chartWrapperW - 34, 300)}
                      height={isFullscreen ? Math.max(chartWrapperH - 50, 250) : 250}
                      xPadding={50}
                      yPadding={30}
                      isCurrency={Boolean(currentMetricObj?.isCurrency)}
                    />
                  {/if}
                </div>
              {/if}
            </Card>
          </div>

          {#if kpisPosition === 'right'}
            <div class="kpi-side-col">
              {@render kpisSnippet()}
            </div>
          {/if}

          {#if kpisPosition === 'bottom'}
            <div class="kpi-banner-wrapper">
              {@render kpisSnippet()}
            </div>
          {/if}
        </div>
      {:else}
        <!-- Standalone chart without KPI side snippet -->
        <Card {title} {description}>
          {#snippet icon()}
            <TrendingUp size={20} class="icon-accent" />
          {/snippet}

          <div class="chart-controls-box controls-layout">
            {#if metrics && metrics.length > 0}
              <div class="chart-tab-switcher tab-switcher-bg">
                {#each metrics as m}
                  <button
                    type="button"
                    class="chart-tab-btn tab-btn-style"
                    class:active={activeMetric === m.id}
                    onclick={() => handleMetricClick(m.id)}
                    title={m.label}
                  >
                    {m.shortLabel || m.label}
                  </button>
                {/each}
              </div>
            {/if}

            <div class="chart-granularity-picker flex-row-gap16-align">
              <div class="picker-item flex-row-gap8-align">
                <span class="picker-lbl label-style">Dettaglio</span>
                <select value={granularity} onchange={handleGranularityChange} class="sub-chart-select">
                  <option value="settimanale">Settimanale</option>
                  <option value="mensile">Mensile</option>
                  <option value="annuale">Annuale</option>
                </select>
              </div>

              <div class="picker-item flex-row-gap8-align">
                <span class="picker-lbl label-style">Fino al</span>
                <input type="date" value={endDateString} onchange={handleEndDateChange} class="sub-chart-date-picker" />
              </div>

              {#if showFullscreenToggle}
                <div class="picker-item">
                  <button type="button" onclick={() => isFullscreen = !isFullscreen} class="fs-btn">
                    {#if isFullscreen}
                      <Minimize2 size={16} /> <span class="fs-btn-text">Riduci</span>
                    {:else}
                      <Maximize2 size={16} /> <span class="fs-btn-text">Espandi</span>
                    {/if}
                  </button>
                </div>
              {/if}
            </div>
          </div>

          {#if loadingChart}
            <div class="loader-box no-border-padded">
              <span class="spinner"></span>
              Caricamento andamento in corso...
            </div>
          {:else}
            <div 
              class="chart-flex-wrapper chart-container-layout" 
              class:fullscreen-canvas={isFullscreen}
              bind:clientWidth={chartWrapperW}
              bind:clientHeight={chartWrapperH}
            >
              {#if chartWrapperW > 0}
                <LineChart
                  data={computedChartPoints}
                  labels={chartPeriods.map(p => p.label)}
                  selectedIdx={selectedPointIdx}
                  onSelect={handlePointSelect}
                  width={Math.max(chartWrapperW - 34, 300)}
                  height={isFullscreen ? Math.max(chartWrapperH - 50, 250) : 250}
                  xPadding={50}
                  yPadding={30}
                  isCurrency={Boolean(currentMetricObj?.isCurrency)}
                />
              {/if}
            </div>
          {/if}
        </Card>
      {/if}
    </div>
  {/if}
{:else if kpisSnippet}
  <!-- Fallback: if chart module is uninstalled, render the KPI snippet full-width cleanly -->
  <div class="kpi-standalone-fullwidth animate-fade-in">
    {@render kpisSnippet()}
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
    background: #ffffff;
    border: 1px solid var(--color-neutral-300);
    color: var(--color-neutral-700);
    padding: 8px 16px;
    border-radius: var(--radius-md);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    box-shadow: var(--shadow-sm);
    transition: all 0.2s ease;
  }

  .toggle-chart-btn:hover {
    background: var(--color-neutral-100);
    border-color: var(--color-primary-400);
    color: var(--color-primary-600);
    box-shadow: var(--shadow-md);
  }

  .universal-chart-card {
    margin-bottom: 24px;
    transition: all 0.3s ease;
  }

  .universal-chart-card.fullscreen-mode {
    position: fixed;
    top: 20px;
    left: 20px;
    right: 20px;
    bottom: 20px;
    z-index: 1000;
    background: #ffffff;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
    border-radius: var(--radius-lg);
    overflow: auto;
  }

  .chart-split-layout {
    display: flex;
    gap: 20px;
    width: 100%;
  }

  .chart-split-layout.position-right {
    display: grid;
    grid-template-columns: 1fr 340px;
  }

  @media (max-width: 1024px) {
    .chart-split-layout.position-right {
      grid-template-columns: 1fr;
    }
  }

  .chart-split-layout.position-top,
  .chart-split-layout.position-bottom {
    display: flex;
    flex-direction: column;
  }

  .chart-main-col {
    width: 100%;
    min-width: 0;
  }

  .kpi-side-col, .kpi-banner-wrapper {
    width: 100%;
  }

  .kpi-standalone-fullwidth {
    width: 100%;
    margin-bottom: 24px;
  }

  .controls-layout {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 16px;
    margin-bottom: 20px;
    padding: 12px 16px;
    background: var(--color-neutral-50);
    border: 1px solid var(--color-neutral-200);
    border-radius: var(--radius-md);
  }

  .tab-switcher-bg {
    display: flex;
    gap: 6px;
    background: var(--color-neutral-200);
    padding: 4px;
    border-radius: var(--radius-md);
  }

  .tab-btn-style {
    border: none;
    background: transparent;
    padding: 6px 14px;
    font-size: 12px;
    font-weight: 700;
    border-radius: 6px;
    cursor: pointer;
    color: var(--color-neutral-600);
    transition: all 0.15s ease;
  }

  .tab-btn-style:hover {
    color: var(--color-neutral-900);
  }

  .tab-btn-style.active {
    background: #ffffff;
    color: var(--color-primary-600);
    box-shadow: var(--shadow-sm);
  }

  .flex-row-gap16-align {
    display: flex;
    align-items: center;
    gap: 16px;
    flex-wrap: wrap;
  }

  .flex-row-gap8-align {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .label-style {
    font-size: 12px;
    font-weight: 600;
    color: var(--color-neutral-600);
  }

  .sub-chart-select, .sub-chart-date-picker {
    padding: 6px 12px;
    font-size: 13px;
    border: 1px solid var(--color-neutral-300);
    border-radius: var(--radius-sm);
    background: #ffffff;
    color: var(--color-neutral-800);
  }

  .fs-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: #ffffff;
    border: 1px solid var(--color-neutral-300);
    padding: 6px 12px;
    border-radius: var(--radius-sm);
    font-size: 12px;
    font-weight: 600;
    color: var(--color-neutral-700);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .fs-btn:hover {
    background: var(--color-neutral-100);
    color: var(--color-primary-600);
  }

  .chart-container-layout {
    width: 100%;
    min-height: 250px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .chart-container-layout.fullscreen-canvas {
    min-height: 450px;
  }

  .no-border-padded {
    padding: 40px;
    text-align: center;
  }
</style>
