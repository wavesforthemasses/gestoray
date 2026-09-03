<script lang="ts">
  import type { JobActualsBreakdown } from '../schema';
  import { formatCurrency } from '$lib/utils/math';

  let { actuals }: { actuals: JobActualsBreakdown } = $props();

  let total = $derived(actuals.total || 1);
  let pLabor = $derived(Math.max(0, Math.min(100, ((actuals.labor || 0) / total) * 100)));
  let pMat = $derived(Math.max(0, Math.min(100, ((actuals.materials || 0) / total) * 100)));
  let pEq = $derived(Math.max(0, Math.min(100, ((actuals.equipment || 0) / total) * 100)));
  let pSub = $derived(Math.max(0, Math.min(100, ((actuals.subcontractor || 0) / total) * 100)));
  let pOth = $derived(Math.max(0, Math.min(100, ((actuals.other || 0) / total) * 100)));
</script>

<div class="breakdown-wrapper">
  <div class="breakdown-bar-track">
    {#if pLabor > 0}
      <div class="bar-seg labor" style="width: {pLabor}%;" title="Manodopera: {formatCurrency(actuals.labor)} ({(Number(pLabor) || 0).toFixed(1)}%)"></div>
    {/if}
    {#if pMat > 0}
      <div class="bar-seg materials" style="width: {pMat}%;" title="Materiali FIFO: {formatCurrency(actuals.materials)} ({(Number(pMat) || 0).toFixed(1)}%)"></div>
    {/if}
    {#if pEq > 0}
      <div class="bar-seg equipment" style="width: {pEq}%;" title="Mezzi: {formatCurrency(actuals.equipment)} ({(Number(pEq) || 0).toFixed(1)}%)"></div>
    {/if}
    {#if pSub > 0}
      <div class="bar-seg subcontractor" style="width: {pSub}%;" title="Subappalti: {formatCurrency(actuals.subcontractor)} ({(Number(pSub) || 0).toFixed(1)}%)"></div>
    {/if}
    {#if pOth > 0}
      <div class="bar-seg other" style="width: {pOth}%;" title="Altro: {formatCurrency(actuals.other)} ({(Number(pOth) || 0).toFixed(1)}%)"></div>
    {/if}
  </div>

  <div class="breakdown-legend">
    <span class="legend-item"><span class="dot labor"></span> Manodopera: <strong>{formatCurrency(actuals.labor)}</strong></span>
    <span class="legend-item"><span class="dot materials"></span> Materiali: <strong>{formatCurrency(actuals.materials)}</strong></span>
    <span class="legend-item"><span class="dot equipment"></span> Mezzi: <strong>{formatCurrency(actuals.equipment)}</strong></span>
    <span class="legend-item"><span class="dot subcontractor"></span> Subappalti: <strong>{formatCurrency(actuals.subcontractor)}</strong></span>
  </div>
</div>

<style>
  .breakdown-wrapper {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    width: 100%;
  }

  .breakdown-bar-track {
    display: flex;
    height: 10px;
    width: 100%;
    border-radius: 9999px;
    overflow: hidden;
    background-color: var(--color-bg-subtle, #f1f5f9);
    border: 1px solid var(--color-border, #e2e8f0);
  }

  .bar-seg {
    height: 100%;
    transition: width 0.3s ease;
  }

  .bar-seg.labor, .dot.labor { background-color: #3b82f6; }
  .bar-seg.materials, .dot.materials { background-color: #8b5cf6; }
  .bar-seg.equipment, .dot.equipment { background-color: #f59e0b; }
  .bar-seg.subcontractor, .dot.subcontractor { background-color: #06b6d4; }
  .bar-seg.other, .dot.other { background-color: #64748b; }

  .breakdown-legend {
    display: flex;
    flex-wrap: wrap;
    gap: 0.85rem;
    font-size: 0.75rem;
    color: var(--color-text-muted, #64748b);
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }

  .legend-item strong {
    color: var(--color-text-main, #1e293b);
  }

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }
</style>
