<script lang="ts">
  import { onMount } from 'svelte';
  import {
    Upload,
    FileSpreadsheet,
    SlidersHorizontal,
    AlertCircle,
    CheckCircle2,
    RefreshCw,
    Download,
    X,
    ArrowRight,
    ArrowLeft,
    Check,
    Plus,
    Search,
    Building2,
    Package,
    ClipboardList,
    AlertTriangle,
    HelpCircle
  } from '@lucide/svelte';
  import { ImportRegistry } from '$lib/services/import/importRegistry';
  import { initImportRegistry } from '$lib/services/import/initImportRegistry';
  import { CsvParser } from '$lib/services/import/csvParser';
  import { EntityResolutionService } from '$lib/services/import/entityResolutionService';
  import { ImportEngineService } from '$lib/services/import/importEngineService';
  import type {
    ImportModuleSpec,
    ImportFieldDef,
    ImportRowState,
    ConflictStrategy,
    ImportBatchReport
  } from '$lib/types/importTypes';

  let { isOpen = $bindable(false), onClose = () => {} } = $props<{
    isOpen: boolean;
    onClose?: () => void;
  }>();

  // Wizard States
  let step = $state<1 | 2 | 3 | 4>(1);
  let availableSpecs = $state<ImportModuleSpec[]>([]);
  let selectedEntityType = $state<string>('clients');
  let currentSpec = $derived(availableSpecs.find((s) => s.entityType === selectedEntityType));

  let conflictStrategy = $state<ConflictStrategy>('upsert');
  let rawCsvText = $state<string>('');
  let fileName = $state<string>('');
  let parsedHeaders = $state<string[]>([]);
  let parsedRows = $state<Record<string, string>[]>([]);
  let columnMapping = $state<Record<string, string>>({});

  let rowStates = $state<ImportRowState[]>([]);
  let isExecuting = $state(false);
  let isPrefetching = $state(false);
  let importReport = $state<ImportBatchReport | null>(null);
  let prerequisiteWarning = $state<string | null>(null);

  // Reconciliation State
  let activeTab = $state<'all' | 'unmatched' | 'invalid'>('all');
  let manualSearchQuery = $state<string>('');
  let reconcilingRowIndex = $state<number | null>(null);

  onMount(() => {
    initImportRegistry();
    availableSpecs = ImportRegistry.getAllSpecs();
    if (availableSpecs.length > 0) {
      selectedEntityType = availableSpecs[0].entityType;
    }
  });

  // Reset wizard when entity target changes
  function handleEntityChange(e: Event) {
    const val = (e.target as HTMLSelectElement).value;
    selectedEntityType = val;
    prerequisiteWarning = null;
  }

  // Step 1: File Upload Handler
  async function handleFileSelect(e: Event) {
    const input = e.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    fileName = file.name;

    const text = await file.text();
    rawCsvText = text;

    const result = CsvParser.parse(text);
    parsedHeaders = result.headers;
    parsedRows = result.rows;

    if (currentSpec) {
      columnMapping = ImportEngineService.autoMapHeaders(parsedHeaders, currentSpec.fields);
    }
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
  }

  async function handleDrop(e: DragEvent) {
    e.preventDefault();
    if (!e.dataTransfer?.files || e.dataTransfer.files.length === 0) return;
    const file = e.dataTransfer.files[0];
    fileName = file.name;

    const text = await file.text();
    rawCsvText = text;

    const result = CsvParser.parse(text);
    parsedHeaders = result.headers;
    parsedRows = result.rows;

    if (currentSpec) {
      columnMapping = ImportEngineService.autoMapHeaders(parsedHeaders, currentSpec.fields);
    }
  }

  // Move from Step 1 to Step 2
  function goToStep2() {
    if (parsedRows.length === 0) return;
    step = 2;
  }

  // Move from Step 2 to Step 3 (Pre-flight Validation & Entity Resolution)
  async function goToStep3() {
    if (!currentSpec) return;
    isPrefetching = true;

    try {
      // Bulk pre-fetch lookup map into memory
      await EntityResolutionService.prefetchEntityLookup(currentSpec.entityType);

      // Execute Pre-flight Row Validation
      rowStates = ImportEngineService.validateRows(parsedRows, currentSpec, columnMapping);
      step = 3;
    } catch (err: any) {
      console.error('[ImportWizard] Error prefetching lookups:', err);
    } finally {
      isPrefetching = false;
    }
  }

  // Step 3: Manual Entity Reconciliation Handler
  function selectReconciledEntity(rowIdx: number, entityId: string, entityName: string) {
    const row = rowStates.find((r) => r.rowIndex === rowIdx);
    if (row) {
      row.matchedEntityId = entityId;
      row.matchedEntityName = entityName;
      row.status = 'valid';
      row.errors = [];
    }
    reconcilingRowIndex = null;
  }

  // Step 3 to Step 4: Execute Batch Write
  async function runImportExecution() {
    if (!currentSpec) return;
    isExecuting = true;

    try {
      const report = await ImportEngineService.executeImport(
        rowStates,
        currentSpec,
        conflictStrategy
      );
      importReport = report;
      step = 4;
    } catch (err: any) {
      console.error('[ImportWizard] Import execution error:', err);
    } finally {
      isExecuting = false;
    }
  }

  // Download Error CSV
  function downloadErrorCsv() {
    if (!importReport) return;
    const csvContent = ImportEngineService.generateErrorCsv(importReport);
    if (!csvContent) return;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `import_errors_${selectedEntityType}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function handleCloseModal() {
    step = 1;
    parsedRows = [];
    parsedHeaders = [];
    rowStates = [];
    importReport = null;
    fileName = '';
    onClose();
    isOpen = false;
  }

  // Computed counters for Step 3
  let validCount = $derived(rowStates.filter((r) => r.status === 'valid' || r.status === 'unmatched').length);
  let ambiguousCount = $derived(rowStates.filter((r) => r.status === 'ambiguous').length);
  let invalidCount = $derived(rowStates.filter((r) => r.status === 'invalid').length);

  let filteredRowStates = $derived(
    rowStates.filter((r) => {
      if (activeTab === 'unmatched') return r.status === 'ambiguous';
      if (activeTab === 'invalid') return r.status === 'invalid';
      return true;
    })
  );
</script>

{#if isOpen}
  <div class="modal-backdrop" onclick={handleCloseModal} role="presentation">
    <div
      class="modal-card"
      onclick={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-wizard-title"
    >
      <!-- Modal Header -->
      <div class="modal-header">
        <div class="header-title-group">
          <FileSpreadsheet class="icon-primary" size={24} />
          <div>
            <h2 id="import-wizard-title" class="modal-title">
              Procedura Importazione Dati Centralizzata
            </h2>
            <p class="modal-subtitle">
              Step {step} di 4 — {step === 1
                ? 'Selezione Modulo & File'
                : step === 2
                  ? 'Mappatura Colonne'
                  : step === 3
                    ? 'Validazione & Riconciliazione'
                    : 'Esito & Report'}
            </p>
          </div>
        </div>
        <button type="button" class="btn-close" onclick={handleCloseModal} aria-label="Chiudi">
          <X size={20} />
        </button>
      </div>

      <!-- Modal Body -->
      <div class="modal-body">
        <!-- STEP 1: Modulo, File & Strategia Conflitti -->
        {#if step === 1}
          <div class="step-container">
            <div class="form-row">
              <label for="target-module-select" class="form-label">
                1. Seleziona Modulo di Destinazione
              </label>
              <select
                id="target-module-select"
                class="form-select"
                value={selectedEntityType}
                onchange={handleEntityChange}
              >
                {#each availableSpecs as spec}
                  <option value={spec.entityType}>
                    {spec.label} ({spec.collectionName})
                  </option>
                {/each}
              </select>
            </div>

            <!-- Upload Drop Zone -->
            <div
              class="drop-zone"
              ondragover={handleDragOver}
              ondrop={handleDrop}
              role="region"
              aria-label="Area Caricamento File CSV"
            >
              <Upload class="drop-icon" size={40} />
              <p class="drop-title">Trascina qui il file CSV o TSV</p>
              <p class="drop-subtitle">Oppure selezionalo dal tuo computer</p>

              <input
                type="file"
                id="csv-file-input"
                accept=".csv,.tsv,.txt"
                class="file-input-hidden"
                onchange={handleFileSelect}
              />
              <label for="csv-file-input" class="btn-secondary">
                <FileSpreadsheet size={16} /> Sfoglia File
              </label>

              {#if fileName}
                <div class="file-badge">
                  <CheckCircle2 size={16} class="text-success" />
                  <span>{fileName} ({parsedRows.length} righe rilevate)</span>
                </div>
              {/if}
            </div>

            <!-- Conflict Strategy Selection -->
            <div class="conflict-card">
              <span class="conflict-title">Strategia Gestione Conflitti (Record Esistenti)</span>
              <div class="radio-group">
                <label class="radio-label">
                  <input type="radio" bind:group={conflictStrategy} value="upsert" />
                  <span><strong>Upsert / Aggiorna:</strong> Sovrascrivi o aggiorna i dati esistenti</span>
                </label>
                <label class="radio-label">
                  <input type="radio" bind:group={conflictStrategy} value="skip" />
                  <span><strong>Salta:</strong> Ignora le righe che hanno chiavi già presenti</span>
                </label>
                <label class="radio-label">
                  <input type="radio" bind:group={conflictStrategy} value="create_new" />
                  <span><strong>Crea Nuovo:</strong> Genera sempre un nuovo ID unico</span>
                </label>
              </div>
            </div>
          </div>

        <!-- STEP 2: Mappatura Colonne -->
        {:else if step === 2}
          <div class="step-container">
            <p class="section-desc">
              Associa ciascun campo del modulo alla colonna corrispondente del tuo file CSV.
            </p>

            <div class="mapping-table-wrapper">
              <table class="mapping-table">
                <thead>
                  <tr>
                    <th>Campo Modulo Destinazione</th>
                    <th>Tipo & Regole</th>
                    <th>Colonna CSV Rilevata</th>
                  </tr>
                </thead>
                <tbody>
                  {#if currentSpec}
                    {#each currentSpec.fields as field}
                      <tr>
                        <td>
                          <div class="field-name-group">
                            <span class="field-label">{field.label}</span>
                            {#if field.required}
                              <span class="badge-required">Obbligatorio</span>
                            {:else}
                              <span class="badge-optional">Opzionale</span>
                            {/if}
                          </div>
                          <span class="field-key">({field.key})</span>
                          {#if field.description}
                            <p class="field-desc-hint">{field.description}</p>
                          {/if}
                        </td>
                        <td>
                          <span class="badge-type">
                            {#if field.type === 'currency'}
                              Valuta (€)
                            {:else if field.type === 'number'}
                              Numero
                            {:else if field.type === 'date'}
                              Data (ISO)
                            {:else if field.type === 'boolean'}
                              Booleano (Sì/No)
                            {:else}
                              Testo
                            {/if}
                          </span>
                        </td>
                        <td>
                          <select class="form-select" bind:value={columnMapping[field.key]}>
                            <option value="">-- Non mappato (Nessuna Colonna) --</option>
                            <optgroup label="Generazione Automatica">
                              <option value="__auto_seq">Progressivo Numerico (1, 2, 3...)</option>
                              <option value="__auto_uuid">Identificatore Unico (UUIDv7)</option>
                              {#if field.autoGenerators}
                                {#each field.autoGenerators as gen}
                                  <option value={`__custom_gen_${gen.key}`}>{gen.label.replace(/^✨\s*/, '')}</option>
                                {/each}
                              {/if}
                            </optgroup>
                            <optgroup label="Colonne CSV Rilevate">
                              {#each parsedHeaders as header}
                                <option value={header}>{header}</option>
                              {/each}
                            </optgroup>
                          </select>
                        </td>
                      </tr>
                    {/each}
                  {/if}
                </tbody>
              </table>
            </div>
          </div>

        <!-- STEP 3: Validazione & Riconciliazione Semi-Manuale -->
        {:else if step === 3}
          <div class="step-container">
            <!-- Stat Cards -->
            <div class="stats-grid">
              <div class="stat-card border-success">
                <span class="stat-num text-success">{validCount}</span>
                <span class="stat-label">Righe Valide / Nuovi Record</span>
              </div>
              <div class="stat-card border-warning">
                <span class="stat-num text-warning">{ambiguousCount}</span>
                <span class="stat-label">Da Riconciliare / Ambigue</span>
              </div>
              <div class="stat-card border-danger">
                <span class="stat-num text-danger">{invalidCount}</span>
                <span class="stat-label">Righe Errate</span>
              </div>
            </div>

            <!-- Tab Filters -->
            <div class="tabs-header">
              <button
                type="button"
                class="tab-btn"
                class:active={activeTab === 'all'}
                onclick={() => (activeTab = 'all')}
              >
                Tutte le Righe ({rowStates.length})
              </button>
              <button
                type="button"
                class="tab-btn"
                class:active={activeTab === 'unmatched'}
                onclick={() => (activeTab = 'unmatched')}
              >
                Da Riconciliare ({ambiguousCount})
              </button>
              <button
                type="button"
                class="tab-btn"
                class:active={activeTab === 'invalid'}
                onclick={() => (activeTab = 'invalid')}
              >
                Errate ({invalidCount})
              </button>
            </div>

            <!-- Rows Inspection Table -->
            <div class="rows-table-wrapper">
              <table class="rows-table">
                <thead>
                  <tr>
                    <th>Riga</th>
                    <th>Stato</th>
                    <th>Dati Principali</th>
                    <th>Errori / Note Riconciliazione</th>
                    <th>Azione</th>
                  </tr>
                </thead>
                <tbody>
                  {#each filteredRowStates as row}
                    <tr class:row-invalid={row.status === 'invalid'} class:row-unmatched={row.status === 'ambiguous'}>
                      <td>#{row.rowIndex}</td>
                      <td>
                        {#if row.status === 'invalid'}
                          <span class="status-pill pill-danger">Errata</span>
                        {:else if row.status === 'ambiguous'}
                          <span class="status-pill pill-warning">Ambigua</span>
                        {:else if row.matchedEntityName}
                          <span class="status-pill pill-info">Abbinata</span>
                        {:else}
                          <span class="status-pill pill-success">Nuovo Record</span>
                        {/if}
                      </td>
                      <td>
                        <div class="cell-data-preview">
                          {#each Object.entries(row.mappedData).slice(0, 3) as [k, v]}
                            {#if v !== null && v !== undefined && v !== ''}
                              <span class="data-tag"><strong>{k}:</strong> {v}</span>
                            {/if}
                          {/each}
                        </div>
                      </td>
                      <td>
                        {#if row.errors.length > 0}
                          <span class="text-danger-sm">{row.errors.join('; ')}</span>
                        {:else if row.matchedEntityName}
                          <span class="text-success-sm">Abbinato a: {row.matchedEntityName}</span>
                        {:else if row.candidateEntities && row.candidateEntities.length > 0}
                          <span class="text-warning-sm">Candidati trovati: {row.candidateEntities.map(c => c.name).join(', ')}</span>
                        {:else}
                          <span class="text-success-sm">Pronta per l'importazione (Nuovo Record)</span>
                        {/if}
                      </td>
                      <td>
                        {#if row.candidateEntities && row.candidateEntities.length > 0}
                          <div class="candidate-select-group">
                            {#each row.candidateEntities as cand}
                              <button
                                type="button"
                                class="btn-nano"
                                onclick={() => selectReconciledEntity(row.rowIndex, cand.id, cand.name)}
                              >
                                <Check size={12} /> {cand.name}
                              </button>
                            {/each}
                          </div>
                        {/if}
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          </div>

        <!-- STEP 4: Esito & Report -->
        {:else if step === 4 && importReport}
          <div class="step-container text-center">
            <div class="success-icon-badge">
              <CheckCircle2 size={56} class="text-success" />
            </div>

            <h3 class="result-title">Importazione Completata con Successo!</h3>
            <p class="result-subtitle">
              Operazione registrata nel log di sistema <code>{importReport.importId}</code>.
            </p>

            <div class="report-stats">
              <div class="report-stat-box">
                <span class="r-num text-success">{importReport.succeeded}</span>
                <span class="r-label">Record Salvati</span>
              </div>
              <div class="report-stat-box">
                <span class="r-num text-danger">{importReport.failed}</span>
                <span class="r-label">Record Scartati / Errati</span>
              </div>
              <div class="report-stat-box">
                <span class="r-num text-primary">{importReport.reconciledCount}</span>
                <span class="r-label">Relazioni Riconciliate</span>
              </div>
            </div>

            {#if importReport.failed > 0}
              <div class="download-error-box">
                <div class="error-box-top">
                  <AlertCircle size={20} class="text-warning" />
                  <span><strong>Ci sono {importReport.failed} righe scartate a causa di errori.</strong> Consulta l'elenco dei motivi di errore qui sotto oppure scarica il file CSV completo.</span>
                </div>
                <button type="button" class="btn-warning-sm" onclick={downloadErrorCsv}>
                  <Download size={16} /> Scarica Report Errori (CSV)
                </button>
              </div>

              <!-- INLINE ERROR DETAILS TABLE -->
              <div class="error-details-section">
                <h4 class="error-details-title">
                  <AlertTriangle size={18} class="text-danger" />
                  Dettaglio Motivi dello Scarto ({importReport.errors.length} righe con errore)
                </h4>

                <div class="rows-table-wrapper">
                  <table class="rows-table">
                    <thead>
                      <tr>
                        <th style="width: 80px;">Riga #</th>
                        <th style="width: 45%;">Motivo dell'Errore</th>
                        <th>Dati della Riga CSV</th>
                      </tr>
                    </thead>
                    <tbody>
                      {#each importReport.errors as errItem}
                        <tr class="row-invalid">
                          <td><span class="status-pill pill-danger">#{errItem.row}</span></td>
                          <td>
                            <ul class="error-bullets-list">
                              {#each errItem.errors as errMsg}
                                <li class="error-bullet"><AlertCircle size={14} class="inline-err-icon" /> {errMsg}</li>
                              {/each}
                            </ul>
                          </td>
                          <td>
                            <div class="cell-data-preview">
                              {#each Object.entries(errItem.data).slice(0, 4) as [k, v]}
                                {#if v !== null && v !== undefined && v !== ''}
                                  <span class="data-tag"><strong>{k}:</strong> {v}</span>
                                {/if}
                              {/each}
                            </div>
                          </td>
                        </tr>
                      {/each}
                    </tbody>
                  </table>
                </div>
              </div>
            {/if}
          </div>
        {/if}
      </div>


      <!-- Modal Footer Controls -->
      <div class="modal-footer">
        {#if step === 1}
          <button type="button" class="btn-neutral" onclick={handleCloseModal}>Annulla</button>
          <button type="button" class="btn-primary" disabled={parsedRows.length === 0} onclick={goToStep2}>
            Avanti: Mappatura Colonne <ArrowRight size={16} />
          </button>
        {:else if step === 2}
          <button type="button" class="btn-neutral" onclick={() => (step = 1)}>
            <ArrowLeft size={16} /> Indietro
          </button>
          <button type="button" class="btn-primary" disabled={isPrefetching} onclick={goToStep3}>
            {#if isPrefetching}
              <RefreshCw size={16} class="spin" /> Verificando Dati...
            {:else}
              Avanti: Validazione & Riconciliazione <ArrowRight size={16} />
            {/if}
          </button>
        {:else if step === 3}
          <button type="button" class="btn-neutral" onclick={() => (step = 2)}>
            <ArrowLeft size={16} /> Indietro
          </button>
          <button type="button" class="btn-success" disabled={isExecuting || validCount === 0} onclick={runImportExecution}>
            {#if isExecuting}
              <RefreshCw size={16} class="spin" /> Importando in Corso...
            {:else}
              <CheckCircle2 size={16} /> Esegui Importazione ({validCount} righe)
            {/if}
          </button>
        {:else if step === 4}
          <button type="button" class="btn-primary" onclick={handleCloseModal}>
            Chiudi & Completa
          </button>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background-color: rgba(15, 23, 42, 0.65);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    padding: 1rem;
  }

  .modal-card {
    background: var(--bg-surface, #ffffff);
    border-radius: 12px;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
    width: 100%;
    max-width: 850px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border: 1px solid var(--border-color, #e2e8f0);
  }

  .modal-header {
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid var(--border-color, #e2e8f0);
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: var(--bg-subtle, #f8fafc);
  }

  .header-title-group {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .icon-primary {
    color: var(--color-primary, #3b82f6);
  }

  .modal-title {
    font-size: 1.125rem;
    font-weight: 700;
    margin: 0;
    color: var(--text-heading, #0f172a);
  }

  .modal-subtitle {
    font-size: 0.875rem;
    margin: 0;
    color: var(--text-muted, #64748b);
  }

  .btn-close {
    background: transparent;
    border: none;
    cursor: pointer;
    color: var(--text-muted, #64748b);
    padding: 0.25rem;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .btn-close:hover {
    background: var(--bg-hover, #e2e8f0);
    color: var(--text-heading, #0f172a);
  }

  .modal-body {
    padding: 1.5rem;
    overflow-y: auto;
    flex: 1;
  }

  .step-container {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .form-row {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .form-label {
    font-weight: 600;
    font-size: 0.938rem;
    color: var(--text-heading, #0f172a);
  }

  .form-select {
    padding: 0.625rem 0.875rem;
    border-radius: 8px;
    border: 1px solid var(--border-color, #cbd5e1);
    font-size: 0.875rem;
    background: var(--bg-surface, #fff);
    color: var(--text-main, #334155);
  }

  .drop-zone {
    border: 2px dashed var(--border-color, #cbd5e1);
    border-radius: 10px;
    padding: 2rem 1.5rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: var(--bg-subtle, #f8fafc);
    text-align: center;
    gap: 0.5rem;
  }

  .drop-icon {
    color: var(--text-muted, #94a3b8);
  }

  .drop-title {
    font-size: 1rem;
    font-weight: 600;
    margin: 0;
    color: var(--text-heading, #0f172a);
  }

  .drop-subtitle {
    font-size: 0.84rem;
    margin: 0;
    color: var(--text-muted, #64748b);
  }

  .file-input-hidden {
    display: none;
  }

  .file-badge {
    margin-top: 0.5rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: #f0fdf4;
    border: 1px solid #bbf7d0;
    color: #166534;
    padding: 0.375rem 0.75rem;
    border-radius: 6px;
    font-size: 0.85rem;
    font-weight: 500;
  }

  .conflict-card {
    background: var(--bg-subtle, #f8fafc);
    border: 1px solid var(--border-color, #e2e8f0);
    border-radius: 8px;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .conflict-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-heading, #0f172a);
  }

  .radio-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .radio-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.85rem;
    cursor: pointer;
  }

  /* Table Styles */
  .mapping-table-wrapper, .rows-table-wrapper {
    overflow-x: auto;
    border: 1px solid var(--border-color, #e2e8f0);
    border-radius: 8px;
  }

  .mapping-table, .rows-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.85rem;
  }

  .mapping-table th, .rows-table th {
    background: var(--bg-subtle, #f8fafc);
    padding: 0.75rem 1rem;
    text-align: left;
    font-weight: 600;
    color: var(--text-heading, #0f172a);
    border-bottom: 1px solid var(--border-color, #e2e8f0);
  }

  .mapping-table td, .rows-table td {
    padding: 0.625rem 1rem;
    border-bottom: 1px solid var(--border-color, #f1f5f9);
    vertical-align: middle;
  }

  .field-name-group {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .field-label {
    font-weight: 600;
  }

  .field-key {
    font-size: 0.75rem;
    color: var(--text-muted, #94a3b8);
  }

  .badge-required {
    background: #fef2f2;
    color: #991b1b;
    font-size: 0.7rem;
    padding: 0.1rem 0.4rem;
    border-radius: 4px;
    font-weight: 600;
  }

  .badge-type {
    background: #f1f5f9;
    color: #475569;
    font-size: 0.75rem;
    padding: 0.15rem 0.5rem;
    border-radius: 4px;
    font-family: monospace;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
  }

  .stat-card {
    background: var(--bg-surface, #fff);
    border-radius: 8px;
    padding: 1rem;
    border-left: 4px solid var(--border-color, #cbd5e1);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    display: flex;
    flex-direction: column;
  }

  .border-success { border-left-color: #22c55e; }
  .border-warning { border-left-color: #f59e0b; }
  .border-danger { border-left-color: #ef4444; }

  .stat-num {
    font-size: 1.5rem;
    font-weight: 700;
  }

  .stat-label {
    font-size: 0.8rem;
    color: var(--text-muted, #64748b);
  }

  .tabs-header {
    display: flex;
    gap: 0.5rem;
    border-bottom: 1px solid var(--border-color, #e2e8f0);
    padding-bottom: 0.5rem;
  }

  .tab-btn {
    background: transparent;
    border: none;
    font-size: 0.85rem;
    font-weight: 500;
    padding: 0.5rem 0.75rem;
    border-radius: 6px;
    cursor: pointer;
    color: var(--text-muted, #64748b);
  }

  .tab-btn.active {
    background: var(--bg-subtle, #f1f5f9);
    color: var(--color-primary, #2563eb);
    font-weight: 600;
  }

  .status-pill {
    font-size: 0.75rem;
    padding: 0.15rem 0.5rem;
    border-radius: 12px;
    font-weight: 600;
  }

  .pill-success { background: #dcfce7; color: #15803d; }
  .pill-warning { background: #fef3c7; color: #b45309; }
  .pill-danger { background: #fee2e2; color: #b91c1c; }

  .cell-data-preview {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
  }

  .data-tag {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    padding: 0.1rem 0.4rem;
    border-radius: 4px;
    font-size: 0.75rem;
  }

  .btn-nano {
    background: var(--color-primary, #2563eb);
    color: #fff;
    border: none;
    border-radius: 4px;
    padding: 0.2rem 0.5rem;
    font-size: 0.72rem;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
  }

  .candidate-select-group {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
  }

  /* Modal Footer Buttons */
  .modal-footer {
    padding: 1rem 1.5rem;
    background: var(--bg-subtle, #f8fafc);
    border-top: 1px solid var(--border-color, #e2e8f0);
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .btn-neutral {
    background: #f1f5f9;
    color: #334155;
    border: 1px solid #cbd5e1;
    padding: 0.5rem 1rem;
    border-radius: 8px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }

  .btn-secondary {
    background: var(--bg-surface, #fff);
    color: var(--text-heading, #0f172a);
    border: 1px solid var(--border-color, #cbd5e1);
    padding: 0.5rem 1rem;
    border-radius: 8px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
  }

  .btn-primary {
    background: var(--color-primary, #2563eb);
    color: #ffffff;
    border: none;
    padding: 0.5rem 1.25rem;
    border-radius: 8px;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }

  .btn-success {
    background: #16a34a;
    color: #ffffff;
    border: none;
    padding: 0.5rem 1.25rem;
    border-radius: 8px;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }

  .btn-warning-sm {
    background: #d97706;
    color: #fff;
    border: none;
    padding: 0.4rem 0.875rem;
    border-radius: 6px;
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
  }

  .text-success { color: #16a34a; }
  .text-warning { color: #d97706; }
  .text-danger { color: #dc2626; }

  .text-success-sm { font-size: 0.8rem; color: #16a34a; font-weight: 500; }
  .text-warning-sm { font-size: 0.8rem; color: #d97706; font-weight: 500; }
  .text-danger-sm { font-size: 0.8rem; color: #dc2626; font-weight: 500; }
  .text-muted-sm { font-size: 0.8rem; color: #64748b; }

  .spin {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  .report-stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
    margin: 1.5rem 0;
  }

  .report-stat-box {
    background: var(--bg-subtle, #f8fafc);
    border: 1px solid var(--border-color, #e2e8f0);
    border-radius: 8px;
    padding: 1rem;
    display: flex;
    flex-direction: column;
  }

  .r-num {
    font-size: 1.75rem;
    font-weight: 700;
  }

  .r-label {
    font-size: 0.8rem;
    color: var(--text-muted, #64748b);
  }

  .download-error-box {
    background: #fffbeb;
    border: 1px solid #fef3c7;
    padding: 1rem;
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    font-size: 0.875rem;
    color: #92400e;
  }

  .error-box-top {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .error-details-section {
    margin-top: 1.5rem;
    text-align: left;
  }

  .error-details-title {
    font-size: 0.938rem;
    font-weight: 700;
    color: #b91c1c;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
  }

  .error-bullets-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .error-bullet {
    font-size: 0.8125rem;
    color: #dc2626;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }

  .inline-err-icon {
    flex-shrink: 0;
    color: #dc2626;
  }
</style>

