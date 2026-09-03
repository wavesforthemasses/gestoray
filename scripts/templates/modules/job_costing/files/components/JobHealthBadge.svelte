<script lang="ts">
  import { TrendingUp, AlertTriangle, TrendingDown, ShieldCheck } from '@lucide/svelte';
  import type { HealthStatus } from '../schema';

  let { 
    status = 'healthy', 
    marginPercent = 0, 
    showPercent = true 
  }: { 
    status?: HealthStatus; 
    marginPercent?: number; 
    showPercent?: boolean;
  } = $props();
</script>

{#if status === 'healthy'}
  <span class="health-badge healthy" title="Margine sano (> 20%)">
    <TrendingUp size={13} />
    <span>{showPercent ? `${(Number(marginPercent) || 0).toFixed(1)}%` : 'In Utile'}</span>
  </span>
{:else if status === 'warning'}
  <span class="health-badge warning" title="Margine a rischio (10-20%)">
    <AlertTriangle size={13} />
    <span>{showPercent ? `${(Number(marginPercent) || 0).toFixed(1)}%` : 'Attenzione'}</span>
  </span>
{:else}
  <span class="health-badge critical" title="Margine critico (< 10%) o over-budget">
    <TrendingDown size={13} />
    <span>{showPercent ? `${(Number(marginPercent) || 0).toFixed(1)}%` : 'Critico'}</span>
  </span>
{/if}

<style>
  .health-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.25rem 0.55rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 600;
    line-height: 1;
    white-space: nowrap;
    border: 1px solid transparent;
  }

  .health-badge.healthy {
    background-color: rgba(16, 185, 129, 0.12);
    color: #059669;
    border-color: rgba(16, 185, 129, 0.25);
  }

  .health-badge.warning {
    background-color: rgba(245, 158, 11, 0.12);
    color: #d97706;
    border-color: rgba(245, 158, 11, 0.25);
  }

  .health-badge.critical {
    background-color: rgba(239, 68, 68, 0.12);
    color: #dc2626;
    border-color: rgba(239, 68, 68, 0.25);
  }
</style>
