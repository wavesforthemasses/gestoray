<script lang="ts">
  import { 
    Clock, 
    RotateCcw, 
    User, 
    Bot, 
    Server, 
    ShieldCheck, 
    AlertTriangle, 
    CheckCircle2, 
    ChevronDown, 
    ChevronRight, 
    FileText, 
    Sparkles, 
    History,
    ArrowRight,
    Lock,
    X
  } from '@lucide/svelte';
  import { fade, scale } from 'svelte/transition';
  import Button from '$lib/components/Button.svelte';
  import { toast } from '$lib/stores/toast.svelte';
  import { 
    VersioningService, 
    isLedgerMissing, 
    ReversalConflictError, 
    AlreadyReversedError, 
    type SystemLedgerEntry, 
    type LedgerFieldMutation 
  } from '$lib/services/versioningService';

  interface Props {
    timelineList: SystemLedgerEntry[];
    entityId: string;
    entityCollection: string;
    entityLabel?: string;
    activeRole?: string;
    currentUid?: string;
    fieldLabelMap?: Record<string, string>;
    onreverted?: () => void;
  }

  let {
    timelineList = [],
    entityId,
    entityCollection,
    entityLabel = 'Entità',
    activeRole = '',
    currentUid = '',
    fieldLabelMap = {},
    onreverted
  }: Props = $props();

  const isSuperadmin = $derived(activeRole === 'superadmin');

  // Modal State for Rollback
  let rollbackModalOpen = $state(false);
  let selectedEntry = $state<SystemLedgerEntry | null>(null);
  let rollbackReason = $state('');
  let isForcedChecked = $state(false);
  let conflictWarning = $state<string | null>(null);
  let submittingRollback = $state(false);
  let expandedEntries = $state<Record<string, boolean>>({});

  function toggleExpand(id: string) {
    expandedEntries[id] = !expandedEntries[id];
  }

  function formatDateTime(val: any): string {
    if (!val) return 'Data sconosciuta';
    let d: Date;
    if (typeof val === 'object' && 'toMillis' in val) {
      d = new Date(val.toMillis());
    } else if (typeof val === 'string' || typeof val === 'number') {
      d = new Date(val);
    } else {
      return 'Data sconosciuta';
    }
    return new Intl.DateTimeFormat('it-IT', {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(d);
  }

  function getFieldLabel(key: string): string {
    if (fieldLabelMap[key]) return fieldLabelMap[key];
    const stripped = key.replace(/^(original|derived)\./, '');
    return stripped.charAt(0).toUpperCase() + stripped.slice(1);
  }

  function renderValue(val: any): string {
    if (isLedgerMissing(val)) return '[Non presente / Rimosso]';
    if (val === null) return 'null';
    if (val === undefined) return 'undefined';
    if (typeof val === 'boolean') return val ? 'Sì' : 'No';
    if (typeof val === 'object') {
      if ('toMillis' in val) return formatDateTime(val);
      return JSON.stringify(val);
    }
    return String(val);
  }

  function openRollbackModal(entry: SystemLedgerEntry) {
    selectedEntry = entry;
    rollbackReason = `Ripristino alla revisione ${entry.baseVersion} (annullamento evento ${entry.id.slice(0, 8)})`;
    isForcedChecked = false;
    conflictWarning = null;
    rollbackModalOpen = true;
  }

  async function handleConfirmRollback() {
    if (!selectedEntry || !isSuperadmin) return;
    submittingRollback = true;
    conflictWarning = null;

    try {
      const tenantId = selectedEntry.tenantId || 'default';

      const res = await VersioningService.revertEntityLedgerEntryByPath(
        entityCollection,
        entityId,
        {
          entryId: selectedEntry.id,
          reason: rollbackReason.trim() || undefined,
          performedBy: currentUid || 'superadmin',
          performedByName: 'Superadmin',
          tenantId,
          isForced: isForcedChecked
        }
      );

      toast.success(
        res.mode === 'FORCED_COMPENSATING'
          ? 'Rollback forzato eseguito con successo (revisione creata: v' + res.aggregateVersion + ')'
          : 'Rollback sicuro completato con successo (revisione creata: v' + res.aggregateVersion + ')'
      );

      rollbackModalOpen = false;
      selectedEntry = null;
      onreverted?.();
    } catch (err: any) {
      if (err instanceof ReversalConflictError) {
        conflictWarning = err.message;
        toast.error('Rilevato conflitto di concorrenza su campi modificati successivamente.');
      } else if (err instanceof AlreadyReversedError) {
        toast.error('Questo evento è già stato annullato in precedenza.');
        rollbackModalOpen = false;
      } else {
        toast.error(err.message || 'Errore durante il rollback.');
      }
    } finally {
      submittingRollback = false;
    }
  }
</script>

<div class="version-timeline-container">
  <div class="timeline-header">
    <div class="timeline-title-wrap">
      <History size={18} class="text-accent" />
      <h3 class="timeline-title">Audit Trail & Versioning Storico</h3>
    </div>
    <span class="timeline-count-badge">
      {timelineList.length} {timelineList.length === 1 ? 'evento registrato' : 'eventi registrati'}
    </span>
  </div>

  {#if timelineList.length === 0}
    <div class="empty-timeline">
      <Clock size={32} class="empty-icon" />
      <p class="empty-text">Nessun evento di versioning registrato per {entityLabel}.</p>
      <span class="empty-subtext">Le future modifiche e creazioni genereranno automaticamente record tracciati e immutabili.</span>
    </div>
  {:else}
    <div class="timeline-spine">
      {#each timelineList as entry, idx (entry.id)}
        {@const isExpanded = expandedEntries[entry.id] ?? (idx === 0)}
        {@const mutationsCount = entry.keysChanged?.length || Object.keys(entry.mutations || {}).length}
        {@const isReversal = entry.eventType === 'REVERSAL' || entry.isReversal}

        <div class="timeline-node" class:is-reversal={isReversal}>
          <!-- Left Timeline Marker / Icon -->
          <div class="timeline-marker" class:marker-reversal={isReversal}>
            {#if isReversal}
              <RotateCcw size={14} />
            {:else if entry.eventType === 'NUMERICAL_DELTA'}
              <Sparkles size={14} />
            {:else}
              <Clock size={14} />
            {/if}
          </div>

          <!-- Event Card Content -->
          <div class="timeline-card">
            <div class="timeline-card-header" onclick={() => toggleExpand(entry.id)} role="button" tabindex="0" onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleExpand(entry.id); }}>
              <div class="header-left">
                <button type="button" class="expand-btn" aria-label="Espandi o comprimi dettagli evento">
                  {#if isExpanded}
                    <ChevronDown size={16} />
                  {:else}
                    <ChevronRight size={16} />
                  {/if}
                </button>

                <div class="event-meta-info">
                  <div class="event-headline">
                    <span class="version-badge">v{entry.aggregateVersion}</span>
                    
                    {#if isReversal}
                      <span class="badge badge-reversal">
                        <RotateCcw size={11} /> Rollback
                      </span>
                    {:else if entry.eventType === 'NUMERICAL_DELTA'}
                      <span class="badge badge-delta">Delta Quantitativo</span>
                    {:else}
                      <span class="badge badge-mutation">Modifica Anagrafica</span>
                    {/if}

                    {#if entry.reversalMode === 'FORCED_COMPENSATING'}
                      <span class="badge badge-forced">Forzatura Superadmin</span>
                    {/if}

                    <span class="event-time">{formatDateTime(entry.timestamp)}</span>
                  </div>

                  {#if entry.reason}
                    <p class="event-reason">{entry.reason}</p>
                  {/if}
                </div>
              </div>

              <div class="header-right">
                <!-- Actor Badge -->
                <div class="actor-badge">
                  {#if entry.actorType === 'SYSTEM'}
                    <Bot size={13} class="actor-icon" />
                    <span>Sistema</span>
                  {:else if entry.actorType === 'SERVICE'}
                    <Server size={13} class="actor-icon" />
                    <span>Integrazione</span>
                  {:else}
                    <User size={13} class="actor-icon" />
                    <span>{entry.performedByName || entry.performedBy || 'Operatore'}</span>
                  {/if}
                </div>

                <!-- Superadmin Rollback Trigger Button -->
                {#if isSuperadmin && !isReversal}
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    class="btn-rollback"
                    onclick={(e: Event) => {
                      e.stopPropagation();
                      openRollbackModal(entry);
                    }}
                  >
                    <RotateCcw size={13} style="margin-right: 4px;" />
                    Ripristina
                  </Button>
                {/if}
              </div>
            </div>

            <!-- Expandable Mutations Details Table -->
            {#if isExpanded}
              <div class="timeline-card-body">
                {#if mutationsCount === 0}
                  <p class="no-mutations">Nessun campo modificato esplicitamente in questo evento.</p>
                {:else}
                  <div class="mutations-table-wrap">
                    <table class="mutations-table">
                      <thead>
                        <tr>
                          <th>Campo</th>
                          <th>Valore Precedente</th>
                          <th style="width: 24px;"></th>
                          <th>Nuovo Valore</th>
                          <th>Tipo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {#each Object.entries(entry.mutations || {}) as [path, mut]}
                          <tr>
                            <td class="col-field">
                              <span class="field-label-text">{getFieldLabel(path)}</span>
                              <span class="field-path-text">{path}</span>
                            </td>
                            <td class="col-old">
                              <span class="val-pill val-old">{renderValue(mut.old)}</span>
                            </td>
                            <td class="col-arrow">
                              <ArrowRight size={13} class="arrow-icon" />
                            </td>
                            <td class="col-new">
                              <span class="val-pill val-new">{renderValue(mut.new)}</span>
                            </td>
                            <td class="col-semantics">
                              {#if mut.semantics === 'ADDITIVE'}
                                <span class="semantics-tag tag-additive">Δ {mut.delta > 0 ? `+${mut.delta}` : mut.delta}</span>
                              {:else if mut.semantics === 'ABSOLUTE'}
                                <span class="semantics-tag tag-absolute">Assoluto</span>
                              {:else}
                                <span class="semantics-tag tag-descriptive">Descrittivo</span>
                              {/if}
                            </td>
                          </tr>
                        {/each}
                      </tbody>
                    </table>
                  </div>
                {/if}

                <div class="entry-footer-meta">
                  <span class="footer-item">ID Evento: <code>{entry.id}</code></span>
                  <span class="footer-item">Revisione Base: <strong>v{entry.baseVersion}</strong> &rarr; Revisione Risultante: <strong>v{entry.aggregateVersion}</strong></span>
                  {#if entry.operationId}
                    <span class="footer-item">Operazione: <code>{entry.operationId}</code></span>
                  {/if}
                </div>
              </div>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<!-- Rollback Confirmation Modal (Exclusive for Superadmin) -->
{#if rollbackModalOpen && selectedEntry}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="modal-overlay" transition:fade={{ duration: 150 }} onclick={() => rollbackModalOpen = false}>
    <div class="modal-card" transition:scale={{ duration: 200, start: 0.95 }} onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <div class="modal-title-wrap">
          <RotateCcw size={18} class="text-primary" />
          <h3 class="modal-title">Conferma Rollback Time-Machine (Superadmin)</h3>
        </div>
        <button type="button" class="modal-close-btn" onclick={() => rollbackModalOpen = false}>
          <X size={18} />
        </button>
      </div>

      <div class="rollback-modal-content">
        <div class="rollback-header-alert">
          <AlertTriangle size={20} class="text-warning" />
          <div>
            <strong>Operazione di Ripristino Storico</strong>
            <p class="alert-desc">
              Questa operazione genererà un nuovo evento compensativo nel ledger (Invariante I8) ripristinando lo stato dei campi modificati alla revisione <strong>v{selectedEntry.baseVersion}</strong>.
            </p>
          </div>
        </div>

        <div class="rollback-details-box">
          <div class="detail-row">
            <span class="detail-label">Evento Target:</span>
            <code>{selectedEntry.id}</code>
          </div>
          <div class="detail-row">
            <span class="detail-label">Versione da Annullare:</span>
            <span>v{selectedEntry.aggregateVersion} (creata da {selectedEntry.performedByName || selectedEntry.performedBy})</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Campi Coinvolti:</span>
            <span>{selectedEntry.keysChanged?.map(getFieldLabel).join(', ')}</span>
          </div>
        </div>

        {#if conflictWarning}
          <div class="conflict-alert-box">
            <AlertTriangle size={18} class="text-danger" />
            <div class="conflict-text">
              <strong>Rilevato Conflitto di Concorrenza:</strong>
              <p>{conflictWarning}</p>
            </div>
          </div>

          <label class="forced-checkbox-label">
            <input type="checkbox" bind:checked={isForcedChecked} />
            <span>Autorizzo formalmente come Superadmin la forzatura del rollback (sovrascrive le modifiche successive a valle).</span>
          </label>
        {/if}

        <div class="form-group" style="margin-top: 1rem;">
          <label for="rollbackReasonInput" class="form-label">Causale di Rollback (Audit Trail)</label>
          <input
            id="rollbackReasonInput"
            type="text"
            class="form-control"
            bind:value={rollbackReason}
            placeholder="Motivazione del ripristino per l'audit..."
          />
        </div>

        <div class="modal-actions">
          <Button
            type="button"
            variant="ghost"
            onclick={() => rollbackModalOpen = false}
            disabled={submittingRollback}
          >
            Annulla
          </Button>
          <Button
            type="button"
            variant="primary"
            onclick={handleConfirmRollback}
            disabled={submittingRollback || Boolean(conflictWarning && !isForcedChecked)}
          >
            <RotateCcw size={15} style="margin-right: 6px;" />
            {submittingRollback ? 'Ripristino in corso...' : 'Conferma Rollback'}
          </Button>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .version-timeline-container {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    width: 100%;
  }

  .timeline-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 0.75rem;
    border-bottom: 1px solid var(--color-border, #e2e8f0);
  }

  .timeline-title-wrap {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .timeline-title {
    font-size: 1rem;
    font-weight: 600;
    color: var(--color-text-primary, #0f172a);
    margin: 0;
  }

  .timeline-count-badge {
    font-size: 0.75rem;
    font-weight: 500;
    padding: 0.25rem 0.6rem;
    background: var(--color-bg-secondary, #f1f5f9);
    border-radius: 9999px;
    color: var(--color-text-secondary, #64748b);
  }

  .empty-timeline {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 2.5rem 1rem;
    background: var(--color-bg-subtle, #f8fafc);
    border: 1px dashed var(--color-border, #e2e8f0);
    border-radius: 8px;
    gap: 0.5rem;
  }

  :global(.empty-icon) {
    color: var(--color-text-tertiary, #94a3b8);
  }

  .empty-text {
    font-size: 0.9rem;
    font-weight: 500;
    color: var(--color-text-secondary, #64748b);
    margin: 0;
  }

  .empty-subtext {
    font-size: 0.8rem;
    color: var(--color-text-tertiary, #94a3b8);
  }

  .timeline-spine {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding-left: 1.5rem;
  }

  .timeline-spine::before {
    content: '';
    position: absolute;
    top: 10px;
    bottom: 10px;
    left: 8px;
    width: 2px;
    background: var(--color-border, #e2e8f0);
  }

  .timeline-node {
    position: relative;
    display: flex;
    flex-direction: column;
  }

  .timeline-marker {
    position: absolute;
    left: -1.5rem;
    top: 14px;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: var(--color-surface, #ffffff);
    border: 2px solid var(--color-primary, #3b82f6);
    color: var(--color-primary, #3b82f6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2;
  }

  .marker-reversal {
    border-color: var(--color-warning, #f59e0b);
    color: var(--color-warning, #f59e0b);
  }

  .timeline-card {
    background: var(--color-surface, #ffffff);
    border: 1px solid var(--color-border, #e2e8f0);
    border-radius: 8px;
    overflow: hidden;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
  }

  .timeline-card:hover {
    border-color: var(--color-border-hover, #cbd5e1);
  }

  .timeline-node.is-reversal .timeline-card {
    border-left: 3px solid var(--color-warning, #f59e0b);
  }

  .timeline-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    cursor: pointer;
    background: var(--color-surface, #ffffff);
    gap: 0.75rem;
  }

  .timeline-card-header:hover {
    background: var(--color-bg-subtle, #f8fafc);
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    flex: 1;
  }

  .expand-btn {
    background: none;
    border: none;
    padding: 0.2rem;
    display: flex;
    align-items: center;
    color: var(--color-text-tertiary, #94a3b8);
    cursor: pointer;
  }

  .event-meta-info {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }

  .event-headline {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.4rem;
  }

  .version-badge {
    font-size: 0.75rem;
    font-weight: 700;
    padding: 0.15rem 0.45rem;
    background: var(--color-primary-light, #eff6ff);
    color: var(--color-primary, #3b82f6);
    border-radius: 4px;
  }

  .badge {
    font-size: 0.7rem;
    font-weight: 600;
    padding: 0.15rem 0.4rem;
    border-radius: 4px;
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
  }

  .badge-mutation {
    background: var(--color-bg-secondary, #f1f5f9);
    color: var(--color-text-secondary, #475569);
  }

  .badge-delta {
    background: #f0fdf4;
    color: #166534;
  }

  .badge-reversal {
    background: #fffbeb;
    color: #b45309;
  }

  .badge-forced {
    background: #fef2f2;
    color: #b91c1c;
  }

  .event-time {
    font-size: 0.75rem;
    color: var(--color-text-tertiary, #94a3b8);
    margin-left: 0.3rem;
  }

  .event-reason {
    font-size: 0.8rem;
    color: var(--color-text-secondary, #475569);
    margin: 0;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .actor-badge {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.75rem;
    color: var(--color-text-secondary, #64748b);
    padding: 0.25rem 0.5rem;
    background: var(--color-bg-secondary, #f1f5f9);
    border-radius: 6px;
  }

  :global(.actor-icon) {
    color: var(--color-text-tertiary, #94a3b8);
  }

  .timeline-card-body {
    padding: 0.75rem 1rem;
    border-top: 1px solid var(--color-border, #e2e8f0);
    background: var(--color-bg-subtle, #f8fafc);
  }

  .mutations-table-wrap {
    overflow-x: auto;
  }

  .mutations-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.8rem;
  }

  .mutations-table th {
    text-align: left;
    padding: 0.4rem 0.6rem;
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--color-text-tertiary, #64748b);
    border-bottom: 1px solid var(--color-border, #e2e8f0);
  }

  .mutations-table td {
    padding: 0.5rem 0.6rem;
    border-bottom: 1px solid var(--color-border-subtle, #f1f5f9);
    vertical-align: middle;
  }

  .col-field {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
  }

  .field-label-text {
    font-weight: 600;
    color: var(--color-text-primary, #1e293b);
  }

  .field-path-text {
    font-size: 0.7rem;
    color: var(--color-text-tertiary, #94a3b8);
    font-family: monospace;
  }

  .val-pill {
    padding: 0.15rem 0.4rem;
    border-radius: 4px;
    font-family: monospace;
    font-size: 0.75rem;
    word-break: break-all;
  }

  .val-old {
    background: #fef2f2;
    color: #991b1b;
  }

  .val-new {
    background: #f0fdf4;
    color: #166534;
  }

  :global(.arrow-icon) {
    color: var(--color-text-tertiary, #94a3b8);
  }

  .semantics-tag {
    font-size: 0.7rem;
    padding: 0.1rem 0.35rem;
    border-radius: 3px;
    font-weight: 600;
  }

  .tag-additive {
    background: #e0f2fe;
    color: #0369a1;
  }

  .tag-absolute {
    background: #f3e8ff;
    color: #7e22ce;
  }

  .tag-descriptive {
    background: #f1f5f9;
    color: #475569;
  }

  .entry-footer-meta {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 1rem;
    margin-top: 0.75rem;
    padding-top: 0.5rem;
    border-top: 1px dashed var(--color-border, #e2e8f0);
    font-size: 0.7rem;
    color: var(--color-text-tertiary, #94a3b8);
  }

  .entry-footer-meta code {
    font-size: 0.7rem;
    background: #e2e8f0;
    padding: 0.1rem 0.3rem;
    border-radius: 3px;
  }

  .rollback-modal-content {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .rollback-header-alert {
    display: flex;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    background: #fffbeb;
    border: 1px solid #fde68a;
    border-radius: 6px;
    font-size: 0.85rem;
  }

  .alert-desc {
    margin: 0.25rem 0 0 0;
    font-size: 0.8rem;
    color: #92400e;
  }

  .rollback-details-box {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    padding: 0.75rem;
    background: var(--color-bg-subtle, #f8fafc);
    border: 1px solid var(--color-border, #e2e8f0);
    border-radius: 6px;
    font-size: 0.8rem;
  }

  .detail-row {
    display: flex;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .detail-label {
    font-weight: 600;
    color: var(--color-text-secondary, #64748b);
  }

  .conflict-alert-box {
    display: flex;
    gap: 0.5rem;
    padding: 0.75rem;
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 6px;
    font-size: 0.8rem;
    color: #991b1b;
  }

  .forced-checkbox-label {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    font-size: 0.8rem;
    color: #991b1b;
    font-weight: 600;
    cursor: pointer;
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    margin-top: 1rem;
    padding-top: 0.75rem;
    border-top: 1px solid var(--color-border, #e2e8f0);
  }

  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(15, 23, 42, 0.6);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    padding: 1rem;
  }

  .modal-card {
    background: var(--color-surface, #ffffff);
    border-radius: 12px;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
    width: 100%;
    max-width: 520px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid var(--color-border, #e2e8f0);
  }

  .modal-title-wrap {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .modal-title {
    font-size: 1rem;
    font-weight: 600;
    color: var(--color-text-primary, #0f172a);
    margin: 0;
  }

  .modal-close-btn {
    background: none;
    border: none;
    color: var(--color-text-tertiary, #94a3b8);
    cursor: pointer;
    padding: 0.25rem;
    display: flex;
    align-items: center;
    border-radius: 4px;
  }

  .modal-close-btn:hover {
    color: var(--color-text-primary, #0f172a);
    background: var(--color-bg-secondary, #f1f5f9);
  }

  .rollback-modal-content {
    padding: 1.25rem;
  }
</style>
