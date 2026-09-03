<script lang="ts">
  import { onMount } from 'svelte';
  import { Percent, Plus, Check, Trash2, Edit2, Save, AlertCircle, HelpCircle, ShieldCheck, RefreshCw } from '@lucide/svelte';
  import { VatRatesService, DEFAULT_VAT_RATES, type VatRateOption, type VatSettings } from '$lib/services/vatRatesService';

  let settings = $state<VatSettings>({
    defaultRate: 22,
    rates: [...DEFAULT_VAT_RATES]
  });

  let loading = $state(true);
  let saving = $state(false);
  let feedbackMessage = $state<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modale / Form aggiunta o modifica
  let isEditing = $state(false);
  let editId = $state<string | null>(null);
  let formRate = $state<number>(22);
  let formLabel = $state('');
  let formNatureCode = $state('');
  let formNormativeRef = $state('');
  let formEnabled = $state(true);

  onMount(async () => {
    await loadSettings();
  });

  async function loadSettings() {
    loading = true;
    try {
      const data = await VatRatesService.getSettings();
      settings = data;
    } catch (e) {
      console.error('Errore caricamento aliquote IVA:', e);
      feedbackMessage = { type: 'error', text: 'Impossibile caricare le aliquote IVA.' };
    } finally {
      loading = false;
    }
  }

  function openAddModal() {
    isEditing = true;
    editId = null;
    formRate = 22;
    formLabel = '';
    formNatureCode = '';
    formNormativeRef = '';
    formEnabled = true;
  }

  function openEditModal(rate: VatRateOption) {
    isEditing = true;
    editId = rate.id;
    formRate = rate.rate;
    formLabel = rate.label;
    formNatureCode = rate.natureCode || '';
    formNormativeRef = rate.normativeRef || '';
    formEnabled = rate.enabled !== false;
  }

  function closeEditModal() {
    isEditing = false;
    editId = null;
  }

  async function saveRate() {
    if (formRate < 0 || formRate > 100) {
      feedbackMessage = { type: 'error', text: "L'aliquota deve essere compresa tra 0 e 100." };
      return;
    }
    if (!formLabel.trim()) {
      feedbackMessage = { type: 'error', text: "L'etichetta è obbligatoria." };
      return;
    }

    const updatedRates = [...settings.rates];

    if (editId) {
      const idx = updatedRates.findIndex(r => r.id === editId);
      if (idx !== -1) {
        updatedRates[idx] = {
          ...updatedRates[idx],
          rate: Number(formRate),
          label: formLabel.trim(),
          natureCode: formNatureCode.trim() || undefined,
          normativeRef: formNormativeRef.trim() || undefined,
          enabled: formEnabled
        };
      }
    } else {
      const newId = `iva_${formRate}_${Date.now().toString(36)}`;
      updatedRates.push({
        id: newId,
        rate: Number(formRate),
        label: formLabel.trim(),
        natureCode: formNatureCode.trim() || undefined,
        normativeRef: formNormativeRef.trim() || undefined,
        enabled: formEnabled
      });
    }

    settings.rates = updatedRates;
    closeEditModal();
    await persistSettings();
  }

  async function toggleRateStatus(rateId: string) {
    const idx = settings.rates.findIndex(r => r.id === rateId);
    if (idx !== -1) {
      settings.rates[idx].enabled = !settings.rates[idx].enabled;
      await persistSettings();
    }
  }

  async function setDefaultRate(rate: number) {
    settings.defaultRate = rate;
    settings.rates = settings.rates.map(r => ({
      ...r,
      isDefault: r.rate === rate
    }));
    await persistSettings();
  }

  async function deleteRate(rateId: string) {
    const target = settings.rates.find(r => r.id === rateId);
    if (target?.isSystem) {
      feedbackMessage = { type: 'error', text: 'Le aliquote di sistema non possono essere eliminate, ma puoi disabilitarle.' };
      return;
    }
    if (confirm('Sei sicuro di voler eliminare questa aliquota personalizzata?')) {
      settings.rates = settings.rates.filter(r => r.id !== rateId);
      await persistSettings();
    }
  }

  async function persistSettings() {
    saving = true;
    feedbackMessage = null;
    try {
      await VatRatesService.saveSettings(settings);
      feedbackMessage = { type: 'success', text: 'Aliquote fiscali salvate con successo.' };
      setTimeout(() => { feedbackMessage = null; }, 3000);
    } catch (e: any) {
      console.error('Errore salvataggio:', e);
      feedbackMessage = { type: 'error', text: e.message || 'Errore durante il salvataggio.' };
    } finally {
      saving = false;
    }
  }
</script>

<div class="vat-settings-page">
  <!-- PAGE TOP ACTIONS -->
  <div class="page-top-actions">
    <div class="title-group">
      <div class="icon-wrap">
        <Percent size={24} />
      </div>
      <div>
        <h1>Aliquote IVA & Regimi Fiscali</h1>
        <p class="subtitle">Anagrafe unificata delle aliquote IVA, esenzioni e codici natura per Fatturazione ed Incassi</p>
      </div>
    </div>
    <div class="actions-group">
      <button class="btn btn-secondary" onclick={loadSettings} disabled={loading}>
        <RefreshCw size={16} class={loading ? 'spin' : ''} /> Aggiorna
      </button>
      <button class="btn btn-primary" onclick={openAddModal}>
        <Plus size={16} /> Nuova Aliquota
      </button>
    </div>
  </div>

  {#if feedbackMessage}
    <div class="feedback-banner {feedbackMessage.type}">
      {#if feedbackMessage.type === 'success'}
        <Check size={18} />
      {:else}
        <AlertCircle size={18} />
      {/if}
      <span>{feedbackMessage.text}</span>
    </div>
  {/if}

  <!-- INFO CALLOUT -->
  <div class="info-card">
    <ShieldCheck size={20} class="info-icon" />
    <div class="info-text">
      <strong>Single Source of Truth (SSOT) Fiscale</strong>: Tutte le aliquote configurate qui sono condivise automaticamente da 
      <strong>Fatture</strong>, <strong>Incassi</strong>, <strong>Listini Prodotti</strong> e <strong>Magazzino</strong>.
      In questo modo le quadrature dei centesimi e il calcolo del Castelletto IVA risultano sempre perfettamente allineati.
    </div>
  </div>

  <!-- TABLE CARD -->
  <div class="data-card">
    <div class="card-header">
      <div class="header-left">
        <h2>Registro Aliquote Attive</h2>
        <span class="badge badge-neutral">{settings.rates.length} Aliquote</span>
      </div>
    </div>

    {#if loading}
      <div class="empty-state">
        <RefreshCw size={32} class="spin" />
        <p>Caricamento aliquote fiscali in corso...</p>
      </div>
    {:else}
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th style="width: 90px;">Aliquota</th>
              <th>Descrizione / Etichetta</th>
              <th>Codice Natura SDI</th>
              <th>Riferimento Normativo</th>
              <th style="width: 120px; text-align: center;">Default</th>
              <th style="width: 100px; text-align: center;">Stato</th>
              <th style="width: 110px; text-align: right;">Azioni</th>
            </tr>
          </thead>
          <tbody>
            {#each settings.rates as rate (rate.id)}
              <tr class={!rate.enabled ? 'row-disabled' : ''}>
                <td>
                  <span class="rate-badge">
                    {rate.rate}%
                  </span>
                </td>
                <td>
                  <div class="label-cell">
                    <span class="main-label">{rate.label}</span>
                    {#if rate.isSystem}
                      <span class="system-tag">Sistema</span>
                    {/if}
                  </div>
                </td>
                <td>
                  {#if rate.natureCode}
                    <span class="nature-code-badge">{rate.natureCode}</span>
                  {:else}
                    <span class="text-muted">—</span>
                  {/if}
                </td>
                <td>
                  <span class="normative-text">{rate.normativeRef || '—'}</span>
                </td>
                <td style="text-align: center;">
                  {#if rate.isDefault || settings.defaultRate === rate.rate}
                    <span class="default-badge">Predefinita</span>
                  {:else if rate.enabled}
                    <button class="btn-text-link" onclick={() => setDefaultRate(rate.rate)}>
                      Imposta default
                    </button>
                  {/if}
                </td>
                <td style="text-align: center;">
                  <button 
                    class="status-toggle {rate.enabled ? 'active' : 'inactive'}"
                    onclick={() => toggleRateStatus(rate.id)}
                    title={rate.enabled ? 'Disabilita aliquota' : 'Abilita aliquota'}
                  >
                    {rate.enabled ? 'Attiva' : 'Disattivata'}
                  </button>
                </td>
                <td style="text-align: right;">
                  <div class="actions-cell">
                    <button class="icon-btn" onclick={() => openEditModal(rate)} title="Modifica">
                      <Edit2 size={16} />
                    </button>
                    {#if !rate.isSystem}
                      <button class="icon-btn delete" onclick={() => deleteRate(rate.id)} title="Elimina">
                        <Trash2 size={16} />
                      </button>
                    {/if}
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>

  <!-- MODALE AGGIUNTA / MODIFICA -->
  {#if isEditing}
    <div class="modal-backdrop" onclick={closeEditModal} role="presentation">
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
      <div class="modal-card" onclick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <div class="modal-header">
          <h3>{editId ? 'Modifica Aliquota' : 'Nuova Aliquota Fiscale'}</h3>
          <button class="btn-close" onclick={closeEditModal}>×</button>
        </div>

        <div class="modal-body">
          <div class="form-grid">
            <div class="form-group">
              <label for="fRate">Percentuale IVA (%) *</label>
              <div class="input-with-suffix">
                <input 
                  type="number" 
                  id="fRate" 
                  bind:value={formRate} 
                  min="0" 
                  max="100" 
                  step="0.1" 
                  class="form-control" 
                />
                <span class="suffix">%</span>
              </div>
              <span class="field-hint">Es. 22 per aliquota ordinaria, 10 per edilizia, 0 per esente</span>
            </div>

            <div class="form-group">
              <label for="fLabel">Etichetta Descrittiva *</label>
              <input 
                type="text" 
                id="fLabel" 
                bind:value={formLabel} 
                class="form-control" 
                placeholder="es. 10% (Edilizia Agevolata)" 
              />
            </div>

            <div class="form-group">
              <label for="fNature">Codice Natura SDI (per aliquota 0%)</label>
              <select id="fNature" bind:value={formNatureCode} class="form-control">
                <option value="">Nessuno (Operazione con IVA > 0)</option>
                <option value="N1">N1 - Escluse ex art. 15</option>
                <option value="N2.1">N2.1 - Non soggette ad IVA</option>
                <option value="N3.1">N3.1 - Non imponibili - Esportazioni</option>
                <option value="N4">N4 - Esenti ex art. 10</option>
                <option value="N5">N5 - Regime del margine / IVA non esposta</option>
                <option value="N6.3">N6.3 - Inversione contabile / Reverse charge subappalto edilizia</option>
                <option value="N7">N7 - IVA assolta in altro stato UE</option>
              </select>
              <span class="field-hint">Obbligatorio per fattura elettronica con IVA 0%</span>
            </div>

            <div class="form-group">
              <label for="fNorm">Riferimento Normativo</label>
              <input 
                type="text" 
                id="fNorm" 
                bind:value={formNormativeRef} 
                class="form-control" 
                placeholder="es. Operazione in reverse charge art. 17 c. 6 DPR 633/72" 
              />
              <span class="field-hint">Compare nell'XML FatturaPA e nella stampa del documento</span>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn btn-secondary" onclick={closeEditModal}>Annulla</button>
          <button class="btn btn-primary" onclick={saveRate} disabled={saving}>
            <Save size={16} /> Salva Aliquota
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .vat-settings-page {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .page-top-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 1rem;
  }

  .title-group {
    display: flex;
    align-items: center;
    gap: 0.875rem;
  }

  .icon-wrap {
    width: 46px;
    height: 46px;
    border-radius: 12px;
    background: var(--color-primary-50, rgba(59, 130, 246, 0.1));
    color: var(--color-primary-600, #2563eb);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  h1 {
    font-size: 1.5rem;
    font-weight: 700;
    margin: 0;
    color: var(--text-primary, #0f172a);
  }

  .subtitle {
    margin: 0.15rem 0 0 0;
    font-size: 0.875rem;
    color: var(--text-muted, #64748b);
  }

  .actions-group {
    display: flex;
    gap: 0.75rem;
  }

  .btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.55rem 1.1rem;
    font-size: 0.875rem;
    font-weight: 600;
    border-radius: 8px;
    border: none;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-primary {
    background: var(--color-primary-600, #2563eb);
    color: #ffffff;
  }

  .btn-primary:hover {
    background: var(--color-primary-700, #1d4ed8);
  }

  .btn-secondary {
    background: var(--surface-secondary, #f1f5f9);
    color: var(--text-primary, #334155);
    border: 1px solid var(--border-color, #e2e8f0);
  }

  .info-card {
    display: flex;
    gap: 0.875rem;
    align-items: flex-start;
    padding: 1rem 1.25rem;
    background: rgba(59, 130, 246, 0.05);
    border: 1px solid rgba(59, 130, 246, 0.2);
    border-radius: 10px;
    color: var(--text-primary, #1e293b);
    font-size: 0.875rem;
    line-height: 1.5;
  }

  :global(.info-icon) {
    color: var(--color-primary-600, #2563eb);
    flex-shrink: 0;
    margin-top: 2px;
  }

  .data-card {
    background: var(--surface-card, #ffffff);
    border: 1px solid var(--border-color, #e2e8f0);
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  }

  .card-header {
    padding: 1rem 1.5rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid var(--border-color, #e2e8f0);
  }

  .card-header h2 {
    font-size: 1.1rem;
    font-weight: 600;
    margin: 0;
  }

  .table-responsive {
    width: 100%;
    overflow-x: auto;
  }

  .data-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;
    text-align: left;
  }

  .data-table th {
    padding: 0.85rem 1.25rem;
    background: var(--surface-secondary, #f8fafc);
    color: var(--text-muted, #475569);
    font-weight: 600;
    border-bottom: 1px solid var(--border-color, #e2e8f0);
  }

  .data-table td {
    padding: 0.85rem 1.25rem;
    border-bottom: 1px solid var(--border-color, #f1f5f9);
    color: var(--text-primary, #1e293b);
  }

  .rate-badge {
    font-weight: 700;
    font-size: 0.95rem;
    color: var(--color-primary-600, #2563eb);
    background: rgba(37, 99, 235, 0.08);
    padding: 0.2rem 0.6rem;
    border-radius: 6px;
    display: inline-block;
  }

  .nature-code-badge {
    font-size: 0.75rem;
    font-weight: 700;
    color: #b45309;
    background: #fef3c7;
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
  }

  .default-badge {
    font-size: 0.75rem;
    font-weight: 700;
    color: #15803d;
    background: #dcfce7;
    padding: 0.2rem 0.55rem;
    border-radius: 12px;
  }

  .btn-text-link {
    background: none;
    border: none;
    color: var(--color-primary-600, #2563eb);
    cursor: pointer;
    font-size: 0.75rem;
    text-decoration: underline;
  }

  .status-toggle {
    border: none;
    padding: 0.25rem 0.6rem;
    font-size: 0.75rem;
    font-weight: 600;
    border-radius: 12px;
    cursor: pointer;
  }

  .status-toggle.active {
    background: #e0f2fe;
    color: #0369a1;
  }

  .status-toggle.inactive {
    background: #f1f5f9;
    color: #94a3b8;
  }

  .actions-cell {
    display: flex;
    justify-content: flex-end;
    gap: 0.4rem;
  }

  .icon-btn {
    background: transparent;
    border: none;
    color: var(--text-muted, #64748b);
    cursor: pointer;
    padding: 0.35rem;
    border-radius: 6px;
    display: inline-flex;
  }

  .icon-btn:hover {
    background: var(--surface-secondary, #f1f5f9);
    color: var(--text-primary, #0f172a);
  }

  .icon-btn.delete:hover {
    color: #dc2626;
    background: #fee2e2;
  }

  /* MODALE */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.45);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    padding: 1rem;
  }

  .modal-card {
    background: #ffffff;
    border-radius: 14px;
    width: 100%;
    max-width: 520px;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
    overflow: hidden;
  }

  .modal-header {
    padding: 1.25rem 1.5rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid var(--border-color, #e2e8f0);
  }

  .modal-header h3 {
    margin: 0;
    font-size: 1.15rem;
    font-weight: 700;
  }

  .btn-close {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: #64748b;
  }

  .modal-body {
    padding: 1.5rem;
  }

  .form-grid {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .form-group label {
    display: block;
    font-size: 0.8rem;
    font-weight: 600;
    color: #334155;
    margin-bottom: 0.35rem;
  }

  .form-control {
    width: 100%;
    padding: 0.6rem 0.8rem;
    font-size: 0.875rem;
    border: 1px solid var(--border-color, #cbd5e1);
    border-radius: 8px;
    box-sizing: border-box;
  }

  .input-with-suffix {
    position: relative;
    display: flex;
    align-items: center;
  }

  .input-with-suffix .suffix {
    position: absolute;
    right: 1rem;
    font-weight: 700;
    color: #64748b;
  }

  .field-hint {
    font-size: 0.75rem;
    color: #64748b;
    margin-top: 0.25rem;
    display: block;
  }

  .modal-footer {
    padding: 1rem 1.5rem;
    background: #f8fafc;
    border-top: 1px solid #e2e8f0;
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
  }

  .feedback-banner {
    padding: 0.75rem 1rem;
    border-radius: 8px;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    font-weight: 500;
  }

  .feedback-banner.success {
    background: #dcfce7;
    color: #166534;
    border: 1px solid #bbf7d0;
  }

  .feedback-banner.error {
    background: #fee2e2;
    color: #991b1b;
    border: 1px solid #fecaca;
  }

  :global(.spin) {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
</style>
