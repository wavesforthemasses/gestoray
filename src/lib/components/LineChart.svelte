<script lang="ts">
  interface Props {
    data: number[];
    labels: string[];
    selectedIdx: number | null;
    onSelect: (idx: number | null) => void;
    width?: number;
    height?: number;
    xPadding?: number;
    yPadding?: number;
    isCurrency?: boolean;
  }

  let {
    data,
    labels,
    selectedIdx,
    onSelect,
    width = 480,
    height = 150,
    xPadding = 40,
    yPadding = 20,
    isCurrency = false
  }: Props = $props();

  // Derive points data
  let maxVal = $derived(Math.max(...data, isCurrency ? 1000 : 5));
  let count = $derived(data.length);

  let points = $derived(
    data.map((val, idx) => {
      // Calculate responsive X between xPadding and (width - xPadding)
      const x = xPadding + (idx / Math.max(count - 1, 1)) * (width - xPadding * 2);
      // Calculate responsive Y between yPadding and (height - yPadding)
      const y = (height - yPadding) - (val / maxVal) * (height - yPadding * 2);
      return { x, y, val };
    })
  );

  let pathD = $derived(
    points.reduce((acc, pt, idx) => {
      return acc + (idx === 0 ? `M ${pt.x} ${pt.y}` : ` L ${pt.x} ${pt.y}`);
    }, '')
  );

  let areaD = $derived(
    pathD ? `${pathD} L ${points[points.length - 1].x} ${height - yPadding} L ${points[0].x} ${height - yPadding} Z` : ''
  );

  // Generate a random ID for the gradient to prevent conflicts if multiple charts are on the same page
  const gradientId = `gradient-${Math.random().toString(36).substring(2, 9)}`;

  function handlePointClick(idx: number) {
    if (selectedIdx === idx) {
      onSelect(null);
    } else {
      onSelect(idx);
    }
  }
</script>

<div class="line-chart-component">
  <div class="svg-chart-container">
    <svg class="svg-chart-element" viewBox="0 0 {width} {height}">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="var(--color-secondary-500)" stop-opacity="0.35" />
          <stop offset="100%" stop-color="var(--color-secondary-500)" stop-opacity="0.0" />
        </linearGradient>
      </defs>

      <!-- Grid Lines -->
      <line x1={xPadding} y1={yPadding} x2={width - xPadding} y2={yPadding} class="chart-grid-line" />
      <line x1={xPadding} y1={height / 2} x2={width - xPadding} y2={height / 2} class="chart-grid-line" />
      <line x1={xPadding} y1={height - yPadding} x2={width - xPadding} y2={height - yPadding} class="chart-grid-line" />

      <!-- Area Fill -->
      {#if areaD}
        <path d={areaD} fill="url(#{gradientId})" class="chart-area-path" />
      {/if}

      <!-- Line Path -->
      {#if pathD}
        <path d={pathD} class="chart-line-path" />
      {/if}

      <!-- Dots for selection/interaction -->
      {#each points as pt, idx}
        <!-- Click target circle (invisible and larger for accessibility) -->
        <circle
          cx={pt.x}
          cy={pt.y}
          r="12"
          fill="transparent"
          style="cursor: pointer;"
          role="button"
          tabindex="0"
          aria-label="Seleziona punto grafico {idx + 1}"
          onclick={() => handlePointClick(idx)}
          onkeydown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              handlePointClick(idx);
            }
          }}
        />
        <!-- Visual dot -->
        <circle
          cx={pt.x}
          cy={pt.y}
          r={selectedIdx === idx ? 8 : 4}
          class="chart-dot"
          class:selected={selectedIdx === idx}
          onclick={() => handlePointClick(idx)}
        />
      {/each}
    </svg>
  </div>

  <div class="chart-y-axis-lbls">
    <span>Massimo: {isCurrency ? '€' + maxVal.toLocaleString('it-IT') : maxVal}</span>
    {#if selectedIdx !== null && labels[selectedIdx]}
      <span class="selected-period-banner">
        Filtro attivo: <strong>{labels[selectedIdx]}</strong> (Valore: {isCurrency ? '€' + data[selectedIdx].toLocaleString('it-IT') : data[selectedIdx]})
        <button onclick={() => onSelect(null)} class="clear-filter-btn" type="button">Azzera</button>
      </span>
    {/if}
    <span>Minimo: 0</span>
  </div>
</div>

<style>
  .line-chart-component {
    width: 100%;
  }

  .svg-chart-container {
    background: var(--color-white);
    padding: 16px;
    border-radius: var(--radius-md);
    border: 1px solid var(--color-neutral-200);
    margin-top: 12px;
  }

  .svg-chart-element {
    width: 100%;
    height: auto;
    overflow: visible;
  }

  .chart-grid-line {
    stroke: var(--color-neutral-200);
    stroke-width: 1;
    stroke-dasharray: 4 4;
  }

  .chart-line-path {
    stroke: var(--color-secondary-500);
    stroke-width: 2.5;
    fill: none;
  }

  .chart-dot {
    fill: var(--color-white);
    stroke: var(--color-secondary-500);
    stroke-width: 2.5;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .chart-dot:hover,
  .chart-dot.selected {
    fill: var(--color-secondary-500);
    r: 8px;
  }

  .chart-y-axis-lbls {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    color: var(--color-neutral-500);
    margin-top: 8px;
    align-items: center;
  }

  .selected-period-banner {
    background: var(--color-secondary-100);
    color: var(--color-secondary-900);
    padding: 4px 10px;
    border-radius: var(--radius-sm);
    font-weight: 600;
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }

  .clear-filter-btn {
    background: var(--color-white);
    border: 1px solid var(--color-secondary-300);
    color: var(--color-secondary-700);
    font-size: 10px;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: var(--radius-xs);
    cursor: pointer;
    transition: background 0.15s;
  }

  .clear-filter-btn:hover {
    background: var(--color-secondary-100);
  }
</style>
