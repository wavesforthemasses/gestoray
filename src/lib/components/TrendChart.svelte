<script lang="ts">
  import { Card, FormField, LineChart, StatusBadge } from '$lib';
  import { TrendingUp, Minimize2, Maximize2, Search, Eye } from 'lucide-svelte';
  import { KPI_LEGEND } from "$lib/kpiLegend";
  import { menuConfigStore } from "$lib/stores/menu";

  interface Props {
    isChartFullscreen: boolean;
    activeChartTab: string;
    selectedPointIdx: number | null;
    granularity: string;
    endDateString: string;
    clientFilter: string;
    vendorFilter: string;
    productFilter: string;
    loadingChart: boolean;
    loadingDrillDown: boolean;
    computedChartPoints: any[];
    chartPeriods: any[];
    drillDownItems: any[];
    usersList: any[];
    activeRole: string;
    formatCurrency: (val: number) => string;
    activitiesConfig: any[];
  }

  let {
    isChartFullscreen = $bindable(),
    activeChartTab = $bindable(),
    selectedPointIdx = $bindable(),
    granularity = $bindable(),
    endDateString = $bindable(),
    clientFilter = $bindable(),
    vendorFilter = $bindable(),
    productFilter = $bindable(),
    loadingChart,
    loadingDrillDown,
    computedChartPoints,
    chartPeriods,
    drillDownItems,
    usersList,
    activeRole,
    formatCurrency,
    activitiesConfig = [],
    hasActivities = true
  }: Props & {
    hasActivities?: boolean;
  } = $props();

  const allowedActivities = $derived(hasActivities && activitiesConfig ? activitiesConfig.filter((a: any) => a.rolesView.includes(activeRole || 'superadmin')) : []);
  
  const activeKPITiles = $derived(
    $menuConfigStore
      .filter((m: any) => m.kpiTiles && Array.isArray(m.kpiTiles))
      .flatMap((m: any) => m.kpiTiles)
  );

  let chartWrapperW = $state(0);
  let chartWrapperH = $state(0);
</script>

<div class="unified-chart-wrapper" class:fullscreen={isChartFullscreen}>
  <Card
    title="Trend e Andamento Storico"
    description="Visualizza il trend dinamico delle metriche di performance aziendali. Alterna tra le viste usando i tab e seleziona un punto per il drill-down."
  >
    {#snippet icon()}
      <TrendingUp size={20} class="icon-accent" />
    {/snippet}

    <div class="chart-controls-box">
      <!-- Tab buttons switcher -->
      <div class="chart-tab-switcher">
        <button
          class="chart-tab-btn"
          class:active={activeChartTab === 'nuove_anagrafiche'}
          onclick={() => { activeChartTab = 'nuove_anagrafiche'; selectedPointIdx = null; }}
          title={KPI_LEGEND.NA?.label || 'Nuove Anagrafiche'}
        >
          NA
        </button>

        {#if hasActivities}
          {#each allowedActivities as act}
            <button
              class="chart-tab-btn"
              class:active={activeChartTab === act.id}
              onclick={() => { activeChartTab = act.id; selectedPointIdx = null; }}
              title={act.name}
            >
              {act.acronym || act.name.substring(0, 3).toUpperCase()}
            </button>
          {/each}
        {/if}

        {#each activeKPITiles as tile}
          <button
            class="chart-tab-btn"
            class:active={activeChartTab === tile.id}
            onclick={() => { activeChartTab = tile.id; selectedPointIdx = null; }}
            title={`${(KPI_LEGEND as any)[tile.id?.toUpperCase()]?.label || tile.title}`}
          >
            {tile.title}
          </button>
        {/each}
      </div>

      <!-- Granularity & Period picker -->
      <div class="chart-granularity-picker">
        <div class="picker-item">
          <span class="picker-lbl">Dettaglio</span>
          <select bind:value={granularity} class="sub-chart-select">
            <option value="settimanale">Settimanale</option>
            <option value="mensile">Mensile</option>
            <option value="annuale">Annuale</option>
          </select>
        </div>
        <div class="picker-item">
          <span class="picker-lbl">Fino al</span>
          <input type="date" bind:value={endDateString} class="sub-chart-date-picker" />
        </div>
        <div class="picker-item">
          <button onclick={() => isChartFullscreen = !isChartFullscreen} class="fs-btn">
            {#if isChartFullscreen}
              <Minimize2 size={16} /> <span class="fs-btn-text">Chiudi</span>
            {:else}
              <Maximize2 size={16} /> <span class="fs-btn-text">Espandi</span>
            {/if}
          </button>
        </div>
      </div>
    </div>

    <!-- The Chart itself -->
    {#if loadingChart}
      <div class="loader-box">
        <span class="spinner"></span>
        Caricamento andamento grafico...
      </div>
    {:else}
      <div class="chart-flex-wrapper" class:fs-mode={isChartFullscreen} bind:clientWidth={chartWrapperW} bind:clientHeight={chartWrapperH}>
        {#if chartWrapperW > 0}
          <LineChart
            data={computedChartPoints}
            labels={chartPeriods.map((p: any) => p.label)}
            selectedIdx={selectedPointIdx}
            onSelect={(idx: number | null) => selectedPointIdx = idx}
            width={Math.max(chartWrapperW - 34, 300)}
            height={isChartFullscreen ? Math.max(chartWrapperH - 46, 200) : 250}
            xPadding={50}
            yPadding={30}
            isCurrency={activeChartTab === 'vss' || activeChartTab === 'gi'}
          />
        {/if}
      </div>
    {/if}
  </Card>
</div>

<!-- Drill-Down detailed section -->
{#if selectedPointIdx !== null}
  <div class="drilldown-wrapper animate-fade-in drilldown-margin">
    <Card title="Dettaglio Analitico Periodo" description="Dettaglio delle transazioni, lead o attività registrate nel periodo selezionato ({chartPeriods[selectedPointIdx].label}).">
      {#snippet icon()}
        <Search size={20} class="icon-accent" />
      {/snippet}

      <!-- Filters -->
      <div class="drilldown-filters-pane">
        <FormField id="dd-client-filter" label="Filtra per Cliente">
          <input type="text" id="dd-client-filter" bind:value={clientFilter} placeholder="Inserisci nome cliente..." />
        </FormField>

        {#if activeRole !== 'commerciale'}
          <FormField id="dd-vendor-filter" label="Filtra per Consulente">
            <select id="dd-vendor-filter" bind:value={vendorFilter} class="sub-chart-select vendor-select">
              <option value="">Tutti i consulenti</option>
              {#each usersList as u}
                <option value={u.uid}>{u.nome || ''} {u.cognome || ''} ({u.email})</option>
              {/each}
            </select>
          </FormField>
        {/if}

        <FormField id="dd-product-filter" label="Filtra per Prodotto">
          <input type="text" id="dd-product-filter" bind:value={productFilter} placeholder="es. Hosting, CRM..." />
        </FormField>
      </div>

      <!-- Results Table -->
      {#if loadingDrillDown}
        <div class="loader-box">
          <span class="spinner"></span>
          Caricamento dati di dettaglio...
        </div>
      {:else if drillDownItems.length === 0}
        <div class="empty-panel">Nessun dato registrato corrisponde ai filtri impostati per questo periodo.</div>
      {:else}
        <div class="table-wrapper dd-table-margin">
          <table class="widescreen-table drilldown-table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Consulente</th>
                <th>Data</th>
                <th>Stato / Tipo</th>
                {#if activeChartTab === 'vss' || activeChartTab === 'gi'}
                  <th>Importo Quota</th>
                {/if}
                <th>Note / Ripartizione</th>
                <th>Azione</th>
              </tr>
            </thead>
            <tbody>
              {#each drillDownItems as item}
                <tr>
                  <td><strong>{item.cliente}</strong></td>
                  <td>{item.consulente}</td>
                  <td>{item.data}</td>
                  <td>
                    <StatusBadge 
                      status={(item.status === 'Approvato' || item.status === 'Incassato' || item.status === 'Anagrafica') ? 'approved' : 'pending'} 
                      label={item.status} 
                    />
                  </td>
                  {#if activeChartTab === 'vss' || activeChartTab === 'gi'}
                    <td><strong>{formatCurrency(item.valore)}</strong></td>
                  {/if}
                  <td><span class="detail-text">{item.dettaglio}</span></td>
                  <td>
                    <a href={item.link} class="back-link-btn action-btn">
                      <Eye size={12} class="action-icon" /> Vedi
                    </a>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </Card>
  </div>
{/if}

<style>
  .unified-chart-wrapper {
    position: relative;
    z-index: 10;
    transition: all var(--transition-normal);
  }
  .unified-chart-wrapper.fullscreen {
    position: fixed;
    top: 40px; left: 40px; right: 40px; bottom: 40px;
    z-index: 9999;
    box-shadow: 0 40px 100px rgba(0,0,0,0.3);
    display: flex;
    flex-direction: column;
  }
  :global(.unified-chart-wrapper.fullscreen > div) {
    height: 100%;
    display: flex;
    flex-direction: column;
  }
  :global(.unified-chart-wrapper.fullscreen .card-content) {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  .chart-controls-box {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 24px;
    flex-wrap: wrap;
    background: var(--color-neutral-50);
    padding: 12px 16px;
    border-radius: var(--radius-lg);
    border: 1px solid var(--color-neutral-200);
  }

  .chart-tab-switcher {
    display: flex;
    gap: 6px;
    background: var(--color-white);
    padding: 4px;
    border-radius: var(--radius-md);
    border: 1px solid var(--color-neutral-200);
    box-shadow: inset 0 2px 4px rgba(0,0,0,0.02);
  }
  .chart-tab-btn {
    padding: 6px 12px;
    border: none;
    background: transparent;
    border-radius: var(--radius-sm);
    font-size: 12.5px;
    font-weight: 600;
    color: var(--color-neutral-500);
    cursor: pointer;
    transition: all var(--transition-fast);
  }
  .chart-tab-btn:hover {
    color: var(--color-neutral-800);
  }
  .chart-tab-btn.active {
    background: var(--color-white);
    color: var(--color-primary-600);
    box-shadow: var(--shadow-sm);
  }

  .chart-granularity-picker {
    display: flex;
    gap: 16px;
    align-items: center;
  }
  .picker-item {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .picker-lbl {
    font-size: 11px;
    text-transform: uppercase;
    font-weight: 700;
    color: var(--color-neutral-500);
    letter-spacing: 0.05em;
  }
  .sub-chart-select, .sub-chart-date-picker {
    padding: 6px 12px;
    border: 1px solid var(--color-neutral-300);
    border-radius: var(--radius-md);
    font-size: 13px;
    font-weight: 500;
    color: var(--color-neutral-800);
    background: var(--color-white);
    transition: border-color var(--transition-fast);
  }
  .sub-chart-select:focus, .sub-chart-date-picker:focus {
    border-color: var(--color-primary-500);
    outline: none;
    box-shadow: 0 0 0 3px var(--color-primary-100);
  }

  .fs-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-neutral-100);
    border: 1px solid var(--color-neutral-300);
    padding: 6px 12px;
    border-radius: var(--radius-md);
    color: var(--color-neutral-700);
    cursor: pointer;
    transition: all var(--transition-fast);
  }
  .fs-btn:hover {
    background: var(--color-white);
    border-color: var(--color-primary-400);
    color: var(--color-primary-600);
  }

  .drilldown-wrapper {
    background: var(--color-white);
    border-radius: var(--radius-xl);
    border: 1px solid var(--color-primary-100);
    box-shadow: 0 12px 36px rgba(var(--color-primary-500-rgb), 0.05);
  }

  .drilldown-filters-pane {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 16px;
    background: var(--color-neutral-50);
    padding: 16px;
    border-radius: var(--radius-lg);
    border: 1px solid var(--color-neutral-200);
    margin-bottom: 20px;
  }
  
  .loader-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    height: 250px;
    background: var(--color-neutral-50);
    border-radius: var(--radius-lg);
    border: 1px dashed var(--color-neutral-300);
    color: var(--color-neutral-500);
    font-size: 14px;
    font-weight: 500;
  }
  .spinner {
    width: 30px;
    height: 30px;
    border: 3px solid var(--color-primary-200);
    border-top-color: var(--color-primary-500);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .fs-btn-text {
    margin-left: 6px;
    font-size: 13px;
    font-weight: 600;
  }

  .chart-flex-wrapper {
    flex: 1;
    min-height: 250px;
    width: 100%;
    display: flex;
    flex-direction: column;
  }

  .chart-flex-wrapper.fs-mode {
    min-height: 0;
  }

  .drilldown-margin {
    margin-top: 24px;
  }

  .vendor-select {
    width: 100%;
  }

  .dd-table-margin {
    margin-top: 16px;
  }

  .detail-text {
    font-size: 12px;
    color: var(--color-neutral-600);
  }

  .action-btn {
    padding: 4px 8px;
    font-size: 11px;
    display: inline-flex;
    align-items: center;
    text-decoration: none;
  }

  :global(.action-icon) {
    margin-right: 4px;
  }
</style>
