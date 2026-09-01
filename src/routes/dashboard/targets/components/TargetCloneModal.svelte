<script lang="ts">
  import type { TargetPlanDefinition } from '../schema';
  import type { PeriodInfo } from '../targets.service';
  import { X, Copy, TrendingUp, AlertCircle } from '@lucide/svelte';
  import { toast } from '$lib/stores/toast.svelte';

  interface Props {
    plan: TargetPlanDefinition;
    fromPeriodKey: string;
    fromPeriodLabel: string;
    toPeriod: PeriodInfo;
    onClose: () => void;
    onClone: (growthPct: number) => Promise<number>;
  }

  let {
    plan,
    fromPeriodKey,
    fromPeriodLabel,
    toPeriod,
    onClose,
    onClone
  }: Props = $props();

  let growthPct = $state(plan.defaultGrowthPct || 5);
  let isCloning = $state(false);
  let errorMessage = $state<string | null>(null);

  const PRESETS = [0, 5, 10, 15, 20];

  async function handleCloneSubmit(e: Event) {
    e.preventDefault();
    errorMessage = null;
    isCloning = true;

    try {
      const count = await onClone(growthPct);
      if (count > 0) {
        toast.success(`Clonati ${count} target con successo per ${toPeriod.label}!`);
        onClose();
      } else {
        errorMessage = `Nessun target trovato nel periodo precedente (${fromPeriodLabel}) da clonare.`;
        toast.info(errorMessage);
      }
    } catch (err: any) {
      console.error('Errore clonazione target:', err);
      errorMessage = err?.message || 'Si è verificato un errore durante la clonazione.';
      toast.error('Errore durante la clonazione dei target.');
    } finally {
      isCloning = false;
    }
  }
</script>

<div class="modal-backdrop" onclick={onClose} role="presentation">
  <div class="modal-card" onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
    <div class="modal-header">
      <div class="header-title-wrap">
        <Copy size={20} class="header-icon" />
        <div>
          <h2 class="modal-title">Clona Target da Periodo Precedente</h2>
          <span class="modal-subtitle">{plan.name}</span>
        </div>
      </div>
      <button class="close-btn" onclick={onClose} type="button" aria-label="Chiudi">
        <X size={20} />
      </button>
    </div>

    {#if errorMessage}
      <div class="error-banner">
        <AlertCircle size={16} />
        <span>{errorMessage}</span>
      </div>
    {/if}

    <form onsubmit={handleCloneSubmit} class="modal-form">
      <div class="clone-summary-box">
        <div class="summary-item">
          <span class="summary-label">Periodo Sorgente:</span>
          <span class="summary-val">{fromPeriodLabel}</span>
        </div>
        <div class="summary-arrow">➔</div>
        <div class="summary-item">
          <span class="summary-label">Periodo Destinazione:</span>
          <span class="summary-val highlight">{toPeriod.label}</span>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label" for="growthInput">
          <TrendingUp size={16} class="label-icon" />
          <span>Percentuale di Crescita / Incremento Target</span>
        </label>
        
        <div class="growth-input-row">
          <div class="input-wrap">
            <input 
              id="growthInput"
              type="number" 
              step="1"
              bind:value={growthPct}
              class="form-control"
              placeholder="0"
            />
            <span class="pct-suffix">%</span>
          </div>

          <div class="presets-row">
            {#each PRESETS as p}
              <button 
                type="button" 
                class="preset-btn {growthPct === p ? 'active' : ''}" 
                onclick={() => growthPct = p}
              >
                {p === 0 ? 'Uguale (0%)' : `+${p}%`}
              </button>
            {/each}
          </div>
        </div>
        <span class="field-hint">
          Tutti i valori dei target del periodo precedente verranno moltiplicati per il fattore di crescita ({growthPct >= 0 ? `+${growthPct}%` : `${growthPct}%`}).
        </span>
      </div>

      <div class="modal-footer">
        <button class="btn btn-secondary" onclick={onClose} type="button" disabled={isCloning}>
          Annulla
        </button>
        <button class="btn btn-primary" type="submit" disabled={isCloning}>
          <Copy size={16} />
          <span>{isCloning ? 'Clonazione in corso...' : 'Conferma e Clona'}</span>
        </button>
      </div>
    </form>
  </div>
</div>

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.6);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1rem;
  }

  .modal-card {
    background: var(--color-bg-surface, #ffffff);
    border-radius: var(--radius-xl, 16px);
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
    border: 1px solid var(--color-border-subtle, #e5e7eb);
    width: 100%;
    max-width: 520px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid var(--color-border-subtle, #e5e7eb);
  }

  .header-title-wrap {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .header-icon {
    color: var(--color-primary-500, #3b82f6);
  }

  .modal-title {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 700;
    color: var(--color-text-primary, #111827);
  }

  .modal-subtitle {
    font-size: 0.8125rem;
    color: var(--color-text-muted, #6b7280);
  }

  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: var(--radius-sm, 6px);
    border: none;
    background: transparent;
    color: var(--color-text-muted, #9ca3af);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .close-btn:hover {
    background: var(--color-bg-hover, #f3f4f6);
    color: var(--color-text-primary, #111827);
  }

  .error-banner {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.5rem;
    background: rgba(239, 68, 68, 0.1);
    color: #dc2626;
    font-size: 0.875rem;
    border-bottom: 1px solid rgba(239, 68, 68, 0.2);
  }

  .modal-form {
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .clone-summary-box {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: var(--color-bg-subtle, #f9fafb);
    border: 1px solid var(--color-border-subtle, #e5e7eb);
    border-radius: var(--radius-md, 8px);
    padding: 0.875rem 1.25rem;
  }

  .summary-item {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .summary-label {
    font-size: 0.75rem;
    color: var(--color-text-muted, #6b7280);
  }

  .summary-val {
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--color-text-primary, #111827);
  }

  .summary-val.highlight {
    color: var(--color-primary-600, #2563eb);
  }

  .summary-arrow {
    font-size: 1.25rem;
    color: var(--color-text-muted, #9ca3af);
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .form-label {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-text-secondary, #374151);
  }

  .label-icon {
    color: var(--color-primary-500, #3b82f6);
  }

  .growth-input-row {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .input-wrap {
    position: relative;
    display: flex;
    align-items: center;
    max-width: 140px;
  }

  .input-wrap .form-control {
    width: 100%;
    padding: 0.5rem 1.75rem 0.5rem 0.75rem;
    border-radius: var(--radius-sm, 6px);
    border: 1px solid var(--color-border-subtle, #d1d5db);
    font-size: 1rem;
    font-weight: 700;
    text-align: right;
  }

  .pct-suffix {
    position: absolute;
    right: 0.75rem;
    color: var(--color-text-muted, #6b7280);
    font-weight: 700;
  }

  .presets-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
  }

  .preset-btn {
    padding: 0.35rem 0.625rem;
    border-radius: var(--radius-sm, 6px);
    border: 1px solid var(--color-border-subtle, #d1d5db);
    background: var(--color-bg-surface, #ffffff);
    color: var(--color-text-secondary, #4b5563);
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .preset-btn:hover {
    background: var(--color-bg-hover, #f3f4f6);
    border-color: var(--color-primary-300, #93c5fd);
  }

  .preset-btn.active {
    background: var(--color-primary-50, #eff6ff);
    color: var(--color-primary-700, #1d4ed8);
    border-color: var(--color-primary-500, #3b82f6);
  }

  .field-hint {
    font-size: 0.75rem;
    color: var(--color-text-muted, #6b7280);
    line-height: 1.3;
  }

  .modal-footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.75rem;
    padding-top: 0.5rem;
  }

  .btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1.125rem;
    border-radius: var(--radius-md, 8px);
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-secondary {
    background: var(--color-bg-surface, #ffffff);
    border: 1px solid var(--color-border-subtle, #d1d5db);
    color: var(--color-text-secondary, #374151);
  }

  .btn-secondary:hover {
    background: var(--color-bg-hover, #f3f4f6);
  }

  .btn-primary {
    background: var(--color-primary-600, #2563eb);
    border: 1px solid transparent;
    color: #ffffff;
  }

  .btn-primary:hover {
    background: var(--color-primary-700, #1d4ed8);
  }
</style>
