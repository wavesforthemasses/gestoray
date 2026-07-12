<script lang="ts">
  import { Card } from '$lib';
  import { Calendar } from '@lucide/svelte';

  interface Props {
    selectedMonth: number;
    selectedYear: number;
    isClosingFinalized: boolean;
    onDateChange: () => void;
  }

  let {
    selectedMonth = $bindable(),
    selectedYear = $bindable(),
    isClosingFinalized,
    onDateChange
  } = $props();
</script>

<Card>
  <div class="controls-row">
    <div class="period-selectors">
      <div class="selector-group">
        <label for="month-sel">Mese</label>
        <select id="month-sel" bind:value={selectedMonth} onchange={onDateChange}>
          <option value={1}>Gennaio</option>
          <option value={2}>Febbraio</option>
          <option value={3}>Marzo</option>
          <option value={4}>Aprile</option>
          <option value={5}>Maggio</option>
          <option value={6}>Giugno</option>
          <option value={7}>Luglio</option>
          <option value={8}>Agosto</option>
          <option value={9}>Settembre</option>
          <option value={10}>Ottobre</option>
          <option value={11}>Novembre</option>
          <option value={12}>Dicembre</option>
        </select>
      </div>
      <div class="selector-group">
        <label for="year-sel">Anno</label>
        <select id="year-sel" bind:value={selectedYear} onchange={onDateChange}>
          {#each Array.from({length: 5}, (_, i) => new Date().getFullYear() - i) as yr}
            <option value={yr}>{yr}</option>
          {/each}
        </select>
      </div>
    </div>
    <div class="period-status">
      {#if isClosingFinalized}
        <span class="status-badge closed"><Calendar size={14} /> Chiusura Definitiva (Approvato)</span>
      {:else}
        <span class="status-badge open"><Calendar size={14} /> Periodo Provvisorio (In corso)</span>
      {/if}
    </div>
  </div>
</Card>

<style>
  .controls-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 16px;
  }
  .period-selectors {
    display: flex;
    gap: 16px;
    align-items: center;
  }
  .selector-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .selector-group label {
    font-size: 12px;
    font-weight: 600;
    color: var(--color-neutral-600);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .selector-group select {
    padding: 8px 12px;
    border: 1px solid var(--color-neutral-300);
    border-radius: 6px;
    font-size: 14px;
    color: var(--color-neutral-800);
    background-color: var(--color-neutral-50);
    min-width: 140px;
  }
  .selector-group select:focus {
    outline: none;
    border-color: var(--color-primary-500);
    box-shadow: 0 0 0 3px var(--color-primary-100);
  }

  .period-status {
    display: flex;
    align-items: center;
  }
  .status-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 600;
  }
  .status-badge.closed {
    background: var(--color-success-light);
    color: var(--color-success-text);
  }
  .status-badge.open {
    background: var(--color-warning-light);
    color: var(--color-warning-text);
  }
</style>
