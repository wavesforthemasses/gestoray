<script lang="ts">
  import { formatCurrency } from '$lib/utils/math';

  let { spent = 0, budget = 0 }: { spent?: number; budget?: number } = $props();

  let percent = $derived(budget > 0 ? Math.round((spent / budget) * 100) : 0);
  let fillPercent = $derived(Math.min(100, Math.max(0, percent)));
  let isOver = $derived(spent > budget && budget > 0);
</script>

<div class="progress-box">
  <div class="progress-meta">
    <span class="progress-label">Speso: <strong>{formatCurrency(spent)}</strong> / Budget: {formatCurrency(budget)}</span>
    <span class="progress-percent" class:over={isOver}>{percent}%</span>
  </div>
  <div class="progress-track">
    <div 
      class="progress-fill" 
      class:healthy={percent < 80}
      class:warning={percent >= 80 && percent <= 100}
      class:danger={isOver}
      style="width: {fillPercent}%;"
    ></div>
  </div>
</div>

<style>
  .progress-box {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    width: 100%;
  }

  .progress-meta {
    display: flex;
    justify-content: space-between;
    font-size: 0.75rem;
    color: var(--color-text-muted, #64748b);
  }

  .progress-meta strong {
    color: var(--color-text-main, #1e293b);
  }

  .progress-percent {
    font-weight: 700;
    color: var(--color-primary-600, #3b82f6);
  }

  .progress-percent.over {
    color: #ef4444;
  }

  .progress-track {
    height: 6px;
    width: 100%;
    background-color: var(--color-bg-subtle, #f1f5f9);
    border-radius: 9999px;
    overflow: hidden;
    border: 1px solid var(--color-border, #e2e8f0);
  }

  .progress-fill {
    height: 100%;
    border-radius: 9999px;
    transition: width 0.3s ease, background-color 0.3s ease;
  }

  .progress-fill.healthy { background-color: #10b981; }
  .progress-fill.warning { background-color: #f59e0b; }
  .progress-fill.danger { background-color: #ef4444; }
</style>
