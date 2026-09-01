<script lang="ts">
  import { ChevronLeft, ChevronRight, Calendar, RotateCcw } from '@lucide/svelte';
  import type { PeriodInfo } from '../targets.service';

  interface Props {
    currentPeriod: PeriodInfo;
    onNavigate: (direction: -1 | 1) => void;
    onResetToday: () => void;
  }

  let { currentPeriod, onNavigate, onResetToday }: Props = $props();
</script>

<div class="navigator-card">
  <button 
    class="nav-btn" 
    onclick={() => onNavigate(-1)} 
    title="Periodo precedente"
    type="button"
  >
    <ChevronLeft size={18} />
  </button>

  <div class="period-display">
    <Calendar size={18} class="calendar-icon" />
    <span class="period-label">{currentPeriod.label}</span>
  </div>

  <button 
    class="nav-btn" 
    onclick={() => onNavigate(1)} 
    title="Periodo successivo"
    type="button"
  >
    <ChevronRight size={18} />
  </button>

  <button 
    class="today-btn" 
    onclick={onResetToday} 
    title="Torna al periodo corrente"
    type="button"
  >
    <RotateCcw size={14} />
    <span>Oggi</span>
  </button>
</div>

<style>
  .navigator-card {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: var(--color-bg-surface, #ffffff);
    padding: 0.375rem 0.625rem;
    border-radius: var(--radius-md, 10px);
    border: 1px solid var(--color-border-subtle, #e5e7eb);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  }

  .nav-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: var(--radius-sm, 6px);
    border: 1px solid transparent;
    background: transparent;
    color: var(--color-text-secondary, #4b5563);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .nav-btn:hover {
    background: var(--color-bg-hover, #f3f4f6);
    color: var(--color-text-primary, #111827);
  }

  .period-display {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0 0.5rem;
  }

  .calendar-icon {
    color: var(--color-primary-500, #3b82f6);
  }

  .period-label {
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--color-text-primary, #111827);
    white-space: nowrap;
  }

  .today-btn {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.25rem 0.5rem;
    border-radius: var(--radius-sm, 6px);
    border: 1px solid var(--color-border-subtle, #e5e7eb);
    background: var(--color-bg-subtle, #f9fafb);
    color: var(--color-text-secondary, #4b5563);
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
    margin-left: 0.25rem;
  }

  .today-btn:hover {
    background: var(--color-bg-hover, #f3f4f6);
    color: var(--color-primary-600, #2563eb);
    border-color: var(--color-primary-300, #93c5fd);
  }
</style>
