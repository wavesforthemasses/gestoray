<script lang="ts">
  import type { TargetPlanDefinition, TargetRecordDocument } from '../schema';
  import { Autocomplete, type AutocompleteOption } from '$lib';
  import { X, Save, Target, User, Users, Building, Percent, AlertCircle } from '@lucide/svelte';
  import { toast } from '$lib/stores/toast.svelte';

  interface Props {
    plan: TargetPlanDefinition;
    periodKey: string;
    periodLabel: string;
    startDate: string;
    endDate: string;
    editingRecord?: TargetRecordDocument | null;
    availableUsers: Array<{ uid: string; name: string; email?: string; role?: string }>;
    availableTeams?: Array<{ id: string; name: string; leaderId?: string; leaderName?: string; membersCount?: number }>;
    kpiMetadataList: Array<{ id: string; name: string; acronym?: string; isCurrency?: boolean; description?: string }>;
    onClose: () => void;
    onSave: (recordData: Partial<TargetRecordDocument>) => Promise<void>;
  }

  let {
    plan,
    periodKey,
    periodLabel,
    startDate,
    endDate,
    editingRecord = null,
    availableUsers = [],
    availableTeams = [],
    kpiMetadataList = [],
    onClose,
    onSave
  }: Props = $props();

  let selectedSubjectId = $state(
    editingRecord?.subjectId || (plan.targetSubject === 'company' ? 'company' : '')
  );
  let selectedSubjectName = $state(
    editingRecord?.subjectName || (plan.targetSubject === 'company' ? 'Totale Globale Aziendale' : '')
  );
  let selectedSubjectRole = $state(editingRecord?.subjectRole || '');
  let leaderId = $state(editingRecord?.leaderId || '');
  let leaderName = $state(editingRecord?.leaderName || '');
  let notes = $state(editingRecord?.notes || '');
  let status = $state<'draft' | 'submitted' | 'approved' | 'locked'>(editingRecord?.status || 'approved');

  let targetValues = $state<Record<string, number>>({});
  let isSaving = $state(false);
  let errorMessage = $state<string | null>(null);

  // Initialize values
  $effect(() => {
    const vals: Record<string, number> = {};
    for (const kpiId of plan.kpiIds) {
      vals[kpiId] = editingRecord?.targetValues?.[kpiId] ?? 0;
    }
    targetValues = vals;
  });

  let userOptions = $derived<AutocompleteOption[]>(
    availableUsers.map(u => ({
      id: u.uid,
      label: u.name,
      sublabel: `${u.role ? u.role + ' • ' : ''}${u.email || ''}`
    }))
  );

  let teamOptions = $derived<AutocompleteOption[]>(
    availableTeams.map(t => ({
      id: t.id,
      label: t.name,
      sublabel: `${t.leaderName ? 'Caposquadra: ' + t.leaderName + ' • ' : ''}${t.membersCount !== undefined ? t.membersCount + ' membri' : ''}`
    }))
  );

  function handleUserSelect(userId: string) {
    selectedSubjectId = userId;
    const found = availableUsers.find(u => u.uid === userId);
    if (found) {
      selectedSubjectName = found.name;
      selectedSubjectRole = found.role || 'commerciale';
    }
  }

  function handleTeamSelect(teamId: string) {
    selectedSubjectId = teamId;
    const found = availableTeams.find(t => t.id === teamId);
    if (found) {
      selectedSubjectName = found.name;
      leaderId = found.leaderId || '';
      leaderName = found.leaderName || '';
      selectedSubjectRole = 'team';
    }
  }

  function adjustKpiPercent(kpiId: string, pct: number) {
    const current = Number(targetValues[kpiId]) || 0;
    const increment = current * (pct / 100);
    targetValues[kpiId] = Math.round((current + increment) * 100) / 100;
  }

  async function handleFormSubmit(e: Event) {
    e.preventDefault();
    errorMessage = null;

    if (!selectedSubjectId) {
      errorMessage = 'Seleziona un soggetto assegnatario per il target.';
      return;
    }

    isSaving = true;
    try {
      await onSave({
        planId: plan.id,
        planName: plan.name,
        granularity: plan.granularity,
        periodKey,
        periodLabel,
        startDate,
        endDate,
        subjectType: plan.targetSubject,
        subjectId: selectedSubjectId,
        subjectName: selectedSubjectName || (plan.targetSubject === 'team' ? 'Squadra' : 'Utente'),
        subjectRole: selectedSubjectRole,
        leaderId,
        leaderName,
        targetValues: { ...targetValues },
        status,
        notes
      });
      toast.success('Target salvato con successo!');
      onClose();
    } catch (err: any) {
      console.error('Errore salvataggio target:', err);
      errorMessage = err?.message || 'Si è verificato un errore durante il salvataggio.';
      toast.error('Errore durante il salvataggio del target.');
    } finally {
      isSaving = false;
    }
  }
</script>

<div class="modal-backdrop" onclick={onClose} role="presentation">
  <div class="modal-card" onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
    <!-- Header -->
    <div class="modal-header">
      <div class="header-title-wrap">
        <Target size={20} class="header-icon" />
        <div>
          <h2 class="modal-title">{editingRecord ? 'Modifica Target' : 'Imposta Nuovo Target'}</h2>
          <span class="modal-subtitle">{plan.name} • {periodLabel}</span>
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

    <!-- Form Body -->
    <form onsubmit={handleFormSubmit} class="modal-form">
      <!-- 1. Assegnatario (User o Team o Company) -->
      <div class="form-group">
        <label class="form-label">
          {#if plan.targetSubject === 'user'}
            <User size={15} />
            <span>Collaboratore Assegnatario *</span>
          {:else if plan.targetSubject === 'team'}
            <Users size={15} />
            <span>Squadra / Team di Lavoro *</span>
          {:else}
            <Building size={15} />
            <span>Totale Aziendale</span>
          {/if}
        </label>

        {#if plan.targetSubject === 'user'}
          <Autocomplete 
            options={userOptions} 
            value={selectedSubjectId} 
            placeholder="Cerca collaboratore per nome o email..."
            onchange={handleUserSelect}
            disabled={!!editingRecord}
          />
        {:else if plan.targetSubject === 'team'}
          <Autocomplete 
            options={teamOptions} 
            value={selectedSubjectId} 
            placeholder="Seleziona la squadra di lavoro..."
            onchange={handleTeamSelect}
            disabled={!!editingRecord}
          />
        {:else}
          <div class="company-badge-box">
            <Building size={16} />
            <span>Target complessivo valido per l'intera azienda</span>
          </div>
        {/if}
      </div>

      <!-- 2. KPI Values Input Grid -->
      <div class="form-group">
        <label class="form-label">
          <Percent size={15} />
          <span>Valori Obiettivo per KPI Monitorati</span>
        </label>

        <div class="kpi-inputs-grid">
          {#each plan.kpiIds as kpiId}
            {@const meta = kpiMetadataList.find(m => m.id === kpiId)}
            {@const isCurrency = meta?.isCurrency || ['vss', 'total_incassato', 'gi', 'totalVenduto'].includes(kpiId)}
            <div class="kpi-field-card">
              <div class="kpi-meta-row">
                <span class="kpi-title">{meta?.name || kpiId}</span>
                <span class="kpi-acronym">{meta?.acronym || kpiId.slice(0, 3).toUpperCase()}</span>
              </div>
              {#if meta?.description}
                <span class="kpi-desc">{meta.description}</span>
              {/if}

              <div class="input-with-modifiers">
                <div class="input-prefix-wrap">
                  {#if isCurrency}
                    <span class="prefix">€</span>
                  {/if}
                  <input 
                    type="number" 
                    step={isCurrency ? "100" : "1"}
                    bind:value={targetValues[kpiId]}
                    class="form-control number-input"
                    placeholder="0"
                  />
                </div>

                <div class="modifiers-row">
                  <button type="button" class="mod-btn" onclick={() => adjustKpiPercent(kpiId, 5)} title="Aumenta del 5%">+5%</button>
                  <button type="button" class="mod-btn" onclick={() => adjustKpiPercent(kpiId, 10)} title="Aumenta del 10%">+10%</button>
                  <button type="button" class="mod-btn" onclick={() => adjustKpiPercent(kpiId, 20)} title="Aumenta del 20%">+20%</button>
                </div>
              </div>
            </div>
          {/each}
        </div>
      </div>

      <!-- 3. Strategia e Note -->
      <div class="form-group">
        <label class="form-label" for="notesText">Note & Strategia del Periodo (Opzionale)</label>
        <textarea 
          id="notesText" 
          bind:value={notes} 
          class="form-control textarea" 
          placeholder="Obiettivi di lead generation, focus contratti enterprise, ecc..."
          rows="2"
        ></textarea>
      </div>

      <!-- Footer Buttons -->
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick={onClose} type="button" disabled={isSaving}>
          Annulla
        </button>
        <button class="btn btn-primary" type="submit" disabled={isSaving}>
          <Save size={16} />
          <span>{isSaving ? 'Salvataggio...' : 'Salva Target'}</span>
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
    max-width: 620px;
    max-height: 90vh;
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
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
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

  .company-badge-box {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background: var(--color-primary-50, #eff6ff);
    color: var(--color-primary-700, #1d4ed8);
    border: 1px solid var(--color-primary-200, #bfdbfe);
    border-radius: var(--radius-md, 8px);
    font-size: 0.875rem;
    font-weight: 600;
  }

  .kpi-inputs-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 0.875rem;
  }

  .kpi-field-card {
    background: var(--color-bg-subtle, #f9fafb);
    border: 1px solid var(--color-border-subtle, #e5e7eb);
    border-radius: var(--radius-md, 8px);
    padding: 0.875rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .kpi-meta-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .kpi-title {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--color-text-primary, #111827);
  }

  .kpi-acronym {
    font-size: 0.625rem;
    font-weight: 700;
    color: var(--color-primary-700, #1d4ed8);
    background: var(--color-primary-100, #dbeafe);
    padding: 0.0625rem 0.25rem;
    border-radius: 4px;
  }

  .kpi-desc {
    font-size: 0.6875rem;
    color: var(--color-text-muted, #6b7280);
    line-height: 1.2;
  }

  .input-with-modifiers {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .input-prefix-wrap {
    position: relative;
    display: flex;
    align-items: center;
    flex: 1;
  }

  .prefix {
    position: absolute;
    left: 0.625rem;
    color: var(--color-text-muted, #6b7280);
    font-weight: 600;
  }

  .number-input {
    width: 100%;
    padding: 0.4rem 0.625rem 0.4rem 1.5rem;
    border-radius: var(--radius-sm, 6px);
    border: 1px solid var(--color-border-subtle, #d1d5db);
    font-size: 0.9375rem;
    font-weight: 600;
  }

  .modifiers-row {
    display: flex;
    gap: 0.25rem;
  }

  .mod-btn {
    padding: 0.35rem 0.45rem;
    border-radius: var(--radius-sm, 6px);
    border: 1px solid var(--color-border-subtle, #d1d5db);
    background: var(--color-bg-surface, #ffffff);
    color: var(--color-text-secondary, #4b5563);
    font-size: 0.6875rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .mod-btn:hover {
    background: var(--color-bg-hover, #f3f4f6);
    border-color: var(--color-primary-300, #93c5fd);
  }

  .textarea {
    width: 100%;
    padding: 0.5rem 0.75rem;
    border-radius: var(--radius-sm, 6px);
    border: 1px solid var(--color-border-subtle, #d1d5db);
    font-size: 0.875rem;
    resize: vertical;
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
    padding: 0.5rem 1rem;
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
