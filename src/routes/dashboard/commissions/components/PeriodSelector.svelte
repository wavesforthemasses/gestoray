<script lang="ts">
  import { FormField } from '$lib';
  import { CheckCircle2, AlertCircle, Clock } from '@lucide/svelte';

  interface Props {
    selectedMonth: number;
    selectedYear: number;
    loading: boolean;
    generating: boolean;
    hasVersions: boolean;
    hasAnyFinalized: boolean;
    onMonthChange: (e: Event) => void;
    onYearChange: (e: Event) => void;
  }

  let {
    selectedMonth = $bindable(),
    selectedYear = $bindable(),
    loading,
    generating,
    hasVersions,
    hasAnyFinalized,
    onMonthChange,
    onYearChange
  } = $props();
</script>

<div class="period-selector-card">
  <div class="selector-form">
    <FormField id="sel-month" label="Mese">
      <select id="sel-month" bind:value={selectedMonth} onchange={onMonthChange} disabled={loading || generating}>
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
    </FormField>

    <FormField id="sel-year" label="Anno">
      <select id="sel-year" bind:value={selectedYear} onchange={onYearChange} disabled={loading || generating}>
        <option value={2025}>2025</option>
        <option value={2026}>2026</option>
        <option value={2027}>2027</option>
      </select>
    </FormField>
  </div>

  <div class="status-summary-box">
    {#if !hasVersions && !loading}
       <div class="closing-status empty">
         <AlertCircle size={16} />
         <div class="status-details">
           <strong>NESSUN CALCOLO</strong>
           <span>Non è stata generata alcuna versione per questo mese.</span>
         </div>
       </div>
    {:else if hasAnyFinalized}
      <div class="closing-status finalized">
        <CheckCircle2 size={16} />
        <div class="status-details">
          <strong>MESE APPROVATO E CHIUSO</strong>
          <span>Esiste una versione definitiva approvata per questo mese.</span>
        </div>
      </div>
    {:else if !loading}
      <div class="closing-status pending">
        <Clock size={16} />
        <div class="status-details">
          <strong>BOZZA IN ATTESA</strong>
          <span>Ci sono versioni in bozza ma nessuna è stata approvata.</span>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .period-selector-card {
    background: var(--color-white);
    border: 1px solid var(--color-neutral-200);
    border-radius: var(--radius-md);
    padding: 16px 24px;
    margin-bottom: 24px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 16px;
    box-shadow: var(--shadow-sm);
  }

  .selector-form {
    display: flex;
    gap: 16px;
    align-items: center;
  }

  :global(.selector-form .input-group) {
    margin-bottom: 0 !important;
  }

  .selector-form select {
    height: 38px;
    padding: 0 12px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--color-neutral-300);
    font-family: inherit;
    font-size: 13px;
    background: var(--color-white);
    color: var(--color-neutral-800);
    min-width: 140px;
  }

  .status-summary-box {
    display: flex;
    align-items: center;
  }

  .closing-status {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 16px;
    border-radius: var(--radius-md);
    font-size: 12px;
  }

  .closing-status.finalized {
    background: var(--color-success-light);
    border: 1px solid var(--color-success-border);
    color: var(--color-success-text);
  }

  .closing-status.pending {
    background: var(--color-warning-light);
    border: 1px solid var(--color-warning-border);
    color: var(--color-warning-text);
  }
  
  .closing-status.empty {
    background: var(--color-neutral-100);
    border: 1px solid var(--color-neutral-300);
    color: var(--color-neutral-700);
  }

  .status-details {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .status-details strong {
    font-size: 13px;
    font-weight: 700;
  }
</style>
