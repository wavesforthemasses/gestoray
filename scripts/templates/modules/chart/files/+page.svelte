<script lang="ts">
  import { pageTitle } from '$lib/stores/page';
  import { activeRoleState, authState } from '$lib/auth.svelte';
  import { TrendingUp, BarChart3, PieChart, Layers } from '@lucide/svelte';
  import { Card, UniversalAnalyticsChart, ChartSettingsService } from '$lib';
  import { DashboardService } from '../dashboard.service';

  pageTitle.set('Analytics & Grafici Business Intelligence');

  let activeChartTab = $state<string>('');
  let granularity = $state<'settimanale' | 'mensile' | 'annuale'>('mensile');
  let endDateString = $state(new Date().toISOString().split('T')[0]);
  let loadingChart = $state(false);
  let computedChartPoints = $state<number[]>([]);
  let selectedPointIdx = $state<number | null>(null);
  let chartPeriods = $state<Array<{ start: Date; end: Date; label: string }>>([]);

  // Fetch dynamic metrics for the general BI chart
  // This uses the merged master list of all enabled KPIs from active modules.
  let chartMetrics = $derived.by(() => {
    return ChartSettingsService.getAllKpisMasterListSync()
      .filter(k => k.enabled)
      .map(k => ({
        id: k.id,
        label: k.name,
        shortLabel: k.acronym,
        isCurrency: k.isCurrency
      }));
  });

  $effect(() => {
    if (chartMetrics.length > 0 && !activeChartTab) {
      activeChartTab = chartMetrics[0].id;
    } else if (chartMetrics.length > 0 && activeChartTab) {
      const exists = chartMetrics.some(m => m.id === activeChartTab);
      if (!exists) {
        activeChartTab = chartMetrics[0].id;
      }
    }
  });

  $effect(() => {
    chartPeriods = DashboardService.generateChartPeriods(endDateString, granularity);
  });

  async function loadChartData() {
    if (chartPeriods.length === 0) return;
    loadingChart = true;
    try {
      const roleToUse = activeRoleState.role || '';
      const uidToUse = authState.user?.uid || '';
      const results = await DashboardService.fetchChartAggregations(chartPeriods, roleToUse, uidToUse, activeChartTab);
      computedChartPoints = results || chartPeriods.map(() => 0);
    } catch (e) {
      console.error("Error loading BI chart data:", e);
      computedChartPoints = chartPeriods.map(() => 0);
    } finally {
      loadingChart = false;
    }
  }

  $effect(() => {
    if (granularity || endDateString || activeChartTab) {
      loadChartData();
    }
  });
</script>

<div class="chart-module-page animate-fade-in">
  <div class="page-top-actions">
    <div>
      <h2 class="title-header">
        <TrendingUp size={28} color="var(--color-primary-600)" />
        Analytics & Business Intelligence
      </h2>
      <p class="subtitle">Panoramica completa e comparazione dinamica delle performance aziendali.</p>
    </div>
  </div>

  <UniversalAnalyticsChart
    title="Andamento Storico Multi-Metrica"
    description="Seleziona una metrica per analizzarne l'andamento temporale e clicca su un punto per il drill-down."
    metrics={chartMetrics}
    bind:activeMetric={activeChartTab}
    bind:granularity
    bind:endDateString
    {chartPeriods}
    {computedChartPoints}
    bind:selectedPointIdx
    {loadingChart}
    collapsible={false}
  />
</div>

<style>
  .chart-module-page {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .page-top-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .title-header {
    font-size: 1.5rem;
    font-weight: 800;
    margin: 0;
    color: var(--color-neutral-900);
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .subtitle {
    font-size: 0.88rem;
    color: var(--color-neutral-500);
    margin: 4px 0 0 0;
  }
</style>
