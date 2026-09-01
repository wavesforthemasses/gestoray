<script lang="ts">
  import type { TargetAchievementTier } from '../schema';

  interface Props {
    rate: number;
    tier?: TargetAchievementTier;
    showLabel?: boolean;
    height?: string;
  }

  let { rate = 0, tier, showLabel = true, height = '8px' }: Props = $props();

  let resolvedTier = $derived.by(() => {
    if (tier) return tier;
    if (rate >= 100) return 'over_100';
    if (rate >= 80) return 'between_80_100';
    if (rate >= 50) return 'between_50_80';
    return 'below_50';
  });

  let clampedWidth = $derived(Math.min(100, Math.max(0, rate)));
</script>

<div class="progress-wrapper">
  <div class="progress-track" style="height: {height}">
    <div 
      class="progress-fill {resolvedTier}" 
      style="width: {clampedWidth}%"
    ></div>
  </div>
  {#if showLabel}
    <span class="rate-text {resolvedTier}">
      {rate.toFixed(1)}%
    </span>
  {/if}
</div>

<style>
  .progress-wrapper {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    width: 100%;
  }

  .progress-track {
    flex: 1;
    background: var(--color-bg-subtle, rgba(0, 0, 0, 0.06));
    border-radius: 999px;
    overflow: hidden;
    position: relative;
  }

  .progress-fill {
    height: 100%;
    border-radius: 999px;
    transition: width 0.6s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .progress-fill.below_50 {
    background: linear-gradient(90deg, #ef4444, #f87171);
  }

  .progress-fill.between_50_80 {
    background: linear-gradient(90deg, #f59e0b, #fbbf24);
  }

  .progress-fill.between_80_100 {
    background: linear-gradient(90deg, #10b981, #34d399);
  }

  .progress-fill.over_100 {
    background: linear-gradient(90deg, #8b5cf6, #ec4899);
    box-shadow: 0 0 8px rgba(139, 92, 246, 0.4);
  }

  .rate-text {
    font-size: 0.8125rem;
    font-weight: 700;
    min-width: 3.25rem;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  .rate-text.below_50 {
    color: #ef4444;
  }

  .rate-text.between_50_80 {
    color: #d97706;
  }

  .rate-text.between_80_100 {
    color: #059669;
  }

  .rate-text.over_100 {
    color: #7c3aed;
  }
</style>
