<script lang="ts">
  import type { TargetRecordWithProgress } from '../schema';
  import TargetProgressBar from './TargetProgressBar.svelte';
  import { User, Users, Building, Edit3, Award, AlertTriangle, CheckCircle, ShieldCheck } from '@lucide/svelte';
  import { formatCurrency, formatNumber } from '$lib/utils/formatters';

  interface Props {
    targetRecord: TargetRecordWithProgress;
    canEdit: boolean;
    onEdit: (record: TargetRecordWithProgress) => void;
  }

  let { targetRecord, canEdit, onEdit }: Props = $props();

  let effectiveCanEdit = $derived(targetRecord.canEdit !== undefined ? targetRecord.canEdit : canEdit);

  let tierBadge = $derived.by(() => {
    switch (targetRecord.overallTier) {
      case 'over_100':
        return { label: 'Obiettivo Superato', class: 'tier-stellar', icon: Award };
      case 'between_80_100':
        return { label: 'In Target', class: 'tier-success', icon: CheckCircle };
      case 'between_50_80':
        return { label: 'In Progresso', class: 'tier-warning', icon: AlertTriangle };
      default:
        return { label: 'Rallentamento', class: 'tier-danger', icon: AlertTriangle };
    }
  });

  function formatValue(val: number, isCurrency?: boolean): string {
    if (isCurrency) return formatCurrency(val);
    return formatNumber(val);
  }
</script>

<div class="target-card {targetRecord.overallTier}">
  <div class="card-header">
    <div class="subject-info">
      <div class="subject-avatar {targetRecord.subjectType}">
        {#if targetRecord.subjectType === 'user'}
          <User size={18} />
        {:else if targetRecord.subjectType === 'team'}
          <Users size={18} />
        {:else}
          <Building size={18} />
        {/if}
      </div>
      <div>
        <h3 class="subject-name">{targetRecord.subjectName}</h3>
        <div class="subject-sub-row">
          {#if targetRecord.subjectType === 'team' && targetRecord.leaderName}
            <span class="leader-tag">
              <ShieldCheck size={11} />
              <span>Caposquadra: {targetRecord.leaderName}</span>
            </span>
          {:else if targetRecord.subjectRole}
            <span class="subject-role">{targetRecord.subjectRole}</span>
          {/if}
        </div>
      </div>
    </div>

    <div class="header-right">
      <div class="tier-pill {tierBadge.class}">
        <svelte:component this={tierBadge.icon} size={13} />
        <span>{tierBadge.label} ({(targetRecord.overallRate ?? 0).toFixed(1)}%)</span>
      </div>

      {#if effectiveCanEdit}
        <button 
          class="edit-btn" 
          onclick={() => onEdit(targetRecord)} 
          title="Modifica Target"
          type="button"
        >
          <Edit3 size={15} />
        </button>
      {/if}
    </div>
  </div>

  <div class="metrics-list">
    {#each targetRecord.progressMetrics as metric (metric.kpiId)}
      <div class="metric-row">
        <div class="metric-meta">
          <div class="metric-name-wrap">
            <span class="metric-name">{metric.kpiName}</span>
            <span class="metric-acronym">{metric.acronym}</span>
          </div>
          <div class="metric-values">
            <span class="val-actual">{formatValue(metric.actual, metric.isCurrency)}</span>
            <span class="val-sep">/</span>
            <span class="val-target">{formatValue(metric.target, metric.isCurrency)}</span>
          </div>
        </div>

        <TargetProgressBar rate={metric.rate} tier={metric.tier} />

        <div class="metric-footer">
          <span class="delta-text {metric.delta >= 0 ? 'positive' : 'negative'}">
            {metric.delta >= 0 ? '+' : ''}{formatValue(metric.delta, metric.isCurrency)} rispetto all'obiettivo
          </span>
        </div>
      </div>
    {/each}
  </div>

  {#if targetRecord.notes}
    <div class="card-notes">
      <span class="notes-label">Strategia & Note:</span>
      <p class="notes-text">{targetRecord.notes}</p>
    </div>
  {/if}
</div>

<style>
  .target-card {
    background: var(--color-bg-surface, #ffffff);
    border: 1px solid var(--color-border-subtle, #e5e7eb);
    border-radius: var(--radius-lg, 12px);
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
    transition: all 0.2s ease;
  }

  .target-card:hover {
    box-shadow: 0 6px 12px -2px rgba(0, 0, 0, 0.08);
    border-color: var(--color-primary-200, #bfdbfe);
  }

  .card-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.75rem;
  }

  .subject-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .subject-avatar {
    width: 38px;
    height: 38px;
    border-radius: 10px;
    background: var(--color-bg-subtle, #f3f4f6);
    color: var(--color-text-secondary, #4b5563);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .subject-avatar.team {
    background: rgba(139, 92, 246, 0.1);
    color: #7c3aed;
  }

  .subject-avatar.company {
    background: rgba(59, 130, 246, 0.1);
    color: #2563eb;
  }

  .subject-name {
    margin: 0;
    font-size: 0.9375rem;
    font-weight: 700;
    color: var(--color-text-primary, #111827);
    line-height: 1.2;
  }

  .subject-sub-row {
    margin-top: 0.125rem;
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }

  .subject-role {
    font-size: 0.75rem;
    color: var(--color-text-muted, #6b7280);
    text-transform: capitalize;
  }

  .leader-tag {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.6875rem;
    color: #6d28d9;
    font-weight: 600;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .tier-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.25rem 0.625rem;
    border-radius: 999px;
    font-size: 0.6875rem;
    font-weight: 600;
  }

  .tier-stellar {
    background: rgba(234, 179, 8, 0.12);
    color: #b45309;
    border: 1px solid rgba(234, 179, 8, 0.3);
  }

  .tier-success {
    background: rgba(16, 185, 129, 0.1);
    color: #059669;
    border: 1px solid rgba(16, 185, 129, 0.2);
  }

  .tier-warning {
    background: rgba(245, 158, 11, 0.1);
    color: #d97706;
    border: 1px solid rgba(245, 158, 11, 0.2);
  }

  .tier-danger {
    background: rgba(239, 68, 68, 0.1);
    color: #dc2626;
    border: 1px solid rgba(239, 68, 68, 0.2);
  }

  .edit-btn {
    width: 28px;
    height: 28px;
    border-radius: var(--radius-sm, 6px);
    border: 1px solid var(--color-border-subtle, #e5e7eb);
    background: var(--color-bg-surface, #ffffff);
    color: var(--color-text-secondary, #4b5563);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .edit-btn:hover {
    background: var(--color-bg-hover, #f3f4f6);
    color: var(--color-primary-600, #2563eb);
    border-color: var(--color-primary-300, #93c5fd);
  }

  .metrics-list {
    display: flex;
    flex-direction: column;
    gap: 0.875rem;
  }

  .metric-row {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .metric-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 0.8125rem;
  }

  .metric-name-wrap {
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }

  .metric-name {
    font-weight: 600;
    color: var(--color-text-primary, #111827);
  }

  .metric-acronym {
    font-size: 0.625rem;
    font-weight: 700;
    color: var(--color-text-muted, #6b7280);
    background: var(--color-bg-subtle, #f3f4f6);
    padding: 0.0625rem 0.25rem;
    border-radius: 4px;
  }

  .metric-values {
    font-variant-numeric: tabular-nums;
  }

  .val-actual {
    font-weight: 700;
    color: var(--color-text-primary, #111827);
  }

  .val-sep {
    color: var(--color-text-muted, #9ca3af);
    margin: 0 0.125rem;
  }

  .val-target {
    color: var(--color-text-muted, #6b7280);
  }

  .metric-footer {
    display: flex;
    justify-content: flex-end;
  }

  .delta-text {
    font-size: 0.6875rem;
    font-weight: 600;
  }

  .delta-text.positive {
    color: #059669;
  }

  .delta-text.negative {
    color: #dc2626;
  }

  .card-notes {
    background: var(--color-bg-subtle, #f9fafb);
    border-radius: var(--radius-sm, 6px);
    padding: 0.5rem 0.75rem;
    font-size: 0.75rem;
  }

  .notes-label {
    font-weight: 600;
    color: var(--color-text-secondary, #4b5563);
    display: block;
    margin-bottom: 0.125rem;
  }

  .notes-text {
    margin: 0;
    color: var(--color-text-muted, #6b7280);
    line-height: 1.3;
  }
</style>
