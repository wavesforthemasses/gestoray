<script lang="ts">
  interface Props {
    totalSales: number;
    totalCommissions: number;
  }

  let { totalSales, totalCommissions } = $props();
</script>

<div class="metrics-grid">
  <div class="metric-card">
    <span class="m-label">Venduto di Competenza</span>
    <span class="m-value">€ {totalSales.toFixed(2)}</span>
  </div>
  <div class="metric-card highlight">
    <span class="m-label">Provvigione Totale</span>
    <span class="m-value">€ {totalCommissions.toFixed(2)}</span>
  </div>
</div>

<style>
  .metrics-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 20px;
  }
  .metric-card {
    background: white;
    border: 1px solid var(--color-neutral-200);
    border-radius: 12px;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.02);
  }
  .metric-card.highlight {
    background: linear-gradient(135deg, var(--color-primary-500), var(--color-primary-600));
    color: white;
    border: none;
  }
  .m-label {
    font-size: 13px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--color-neutral-500);
  }
  .metric-card.highlight .m-label {
    color: rgba(255,255,255,0.8);
  }
  .m-value {
    font-size: 28px;
    font-weight: 700;
    color: var(--color-neutral-900);
  }
  .metric-card.highlight .m-value {
    color: white;
  }
</style>
