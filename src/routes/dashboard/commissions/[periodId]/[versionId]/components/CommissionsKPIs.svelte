<script lang="ts">
  import { Wallet, FileText, Award } from '@lucide/svelte';

  interface Props {
    totalIncassi: number;
    totalAllocated: number;
    totalCommissionsToLiquidate: number;
    isClosingFinalized: boolean;
  }

  let { totalIncassi, totalAllocated, totalCommissionsToLiquidate, isClosingFinalized } = $props();
</script>

<div class="kpi-grid" style="margin-bottom: 24px;">
  <div class="kpi-card">
    <div class="kpi-icon"><Wallet size={20} /></div>
    <div class="kpi-info">
      <span class="kpi-val">€ {totalIncassi.toFixed(2)}</span>
      <span class="kpi-lbl">Incassi Totali del Mese</span>
    </div>
  </div>
  <div class="kpi-card">
    <div class="kpi-icon"><FileText size={20} /></div>
    <div class="kpi-info">
      <span class="kpi-val">€ {totalAllocated.toFixed(2)}</span>
      <span class="kpi-lbl">Valore Allocato a Contratti</span>
    </div>
  </div>
  <div class="kpi-card highlight">
    <div class="kpi-icon"><Award size={20} /></div>
    <div class="kpi-info">
      <span class="kpi-val">€ {totalCommissionsToLiquidate.toFixed(2)}</span>
      <span class="kpi-lbl">Massa Provvigionale {isClosingFinalized ? 'Definitiva' : 'Bozza'}</span>
    </div>
  </div>
</div>

<style>
  .kpi-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 16px;
  }

  .kpi-card {
    background: var(--color-white);
    border: 1px solid var(--color-neutral-200);
    border-radius: var(--radius-md);
    padding: 16px 20px;
    display: flex;
    align-items: center;
    gap: 16px;
    box-shadow: var(--shadow-sm);
  }

  .kpi-card.highlight {
    background: linear-gradient(135deg, var(--color-primary-50), var(--color-primary-100));
    border-color: var(--color-primary-200);
  }

  .kpi-icon {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: var(--color-neutral-50);
    color: var(--color-primary-600);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: var(--shadow-sm);
  }

  .kpi-card.highlight .kpi-icon {
    background: var(--color-white);
    color: var(--color-primary-700);
  }

  .kpi-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .kpi-val {
    font-size: 18px;
    font-weight: 700;
    color: var(--color-neutral-800);
  }

  .kpi-lbl {
    font-size: 12px;
    color: var(--color-neutral-500);
  }
</style>
