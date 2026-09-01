<script lang="ts">
  import type { TargetPlanDefinition } from '../schema';
  import { Target } from '@lucide/svelte';

  interface Props {
    plans: TargetPlanDefinition[];
    selectedPlanId: string;
    onSelectPlan: (planId: string) => void;
  }

  let { plans, selectedPlanId, onSelectPlan }: Props = $props();
</script>

<div class="plans-bar">
  {#each plans as plan (plan.id)}
    <button 
      class="plan-tab {selectedPlanId === plan.id ? 'active' : ''}"
      onclick={() => onSelectPlan(plan.id)}
      type="button"
    >
      <Target size={16} class="plan-icon" />
      <span class="plan-name">{plan.name}</span>
      <span class="granularity-pill">{plan.granularity}</span>
    </button>
  {/each}
</div>

<style>
  .plans-bar {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    overflow-x: auto;
    padding: 0.25rem 0;
    scrollbar-width: thin;
  }

  .plan-tab {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.875rem;
    border-radius: var(--radius-md, 8px);
    border: 1px solid var(--color-border-subtle, #e5e7eb);
    background: var(--color-bg-surface, #ffffff);
    color: var(--color-text-secondary, #4b5563);
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.2s ease;
  }

  .plan-tab:hover {
    background: var(--color-bg-hover, #f9fafb);
    color: var(--color-text-primary, #111827);
  }

  .plan-tab.active {
    background: var(--color-primary-50, #eff6ff);
    border-color: var(--color-primary-500, #3b82f6);
    color: var(--color-primary-700, #1d4ed8);
    font-weight: 600;
    box-shadow: 0 1px 2px rgba(59, 130, 246, 0.1);
  }

  .plan-icon {
    opacity: 0.8;
  }

  .granularity-pill {
    font-size: 0.6875rem;
    font-weight: 600;
    text-transform: uppercase;
    padding: 0.125rem 0.375rem;
    border-radius: 4px;
    background: rgba(0, 0, 0, 0.05);
    letter-spacing: 0.025em;
  }

  .plan-tab.active .granularity-pill {
    background: rgba(59, 130, 246, 0.15);
    color: var(--color-primary-800, #1e40af);
  }
</style>
