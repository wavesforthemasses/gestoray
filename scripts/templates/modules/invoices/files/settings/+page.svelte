<script lang="ts">
  import { onMount } from 'svelte';
  import { 
    Settings, 
    Save, 
    Plus, 
    Trash2, 
    Upload, 
    Check, 
    AlertCircle, 
    Building2, 
    Hash, 
    Layers, 
    ArrowLeft,
    RefreshCw,
    FileCode
  } from '@lucide/svelte';
  import { InvoiceSettingsService, DEFAULT_INVOICE_SETTINGS } from '../invoiceSettingsService';
  import { XmlFatturaPaBridge } from '../bridges/XmlFatturaPaBridge';
  import type { InvoiceSettings, SezionaleConfig, AnnualSequenceConfig } from '../schema';

  let settings = $state<InvoiceSettings>({ ...DEFAULT_INVOICE_SETTINGS });
  let loading = $state(true);
  let saving = $state(false);
  let feedback = $state<{ type: 'success' | 'error'; text: string } | null>(null);

  // Import massivo XML
  let importFiles = $state<FileList | null>(null);
  let importing = $state(false);
  let importResult = $state<{ imported: number; errors: string[] } | null>(null);

  const availableYears = [2027, 2026, 2025, 2024];

  onMount(async () => {
    await loadSettings();
  });

  async function loadSettings() {
    loading = true;
    try {
      settings = await InvoiceSettingsService.getSettings();
    } catch (e) {
      console.warn('Errore lettura impostazioni:', e);
    } finally {
      loading = false;
    }
  }

  function addSezionale() {
    const id = `sez_${Date.now().toString(36)}`;
    settings.sezionali = [
      ...settings.sezionali,
      { id, code: '/X', name: 'Nuovo Sezionale', isDefault: false }
    ];
  }

  function removeSezionale(id: string) {
    if (id === 'default') {
      alert('Il sezionale principale di default non può essere eliminato.');
      return;
    }
    settings.sezionali = settings.sezionali.filter(s => s.id !== id);
  }

  function addAnnualSequence(year: number, sezionaleId: string) {
    const exists = settings.annualSequences.some(s => s.year === year && s.sezionaleId === sezionaleId);
    if (exists) return;

    settings.annualSequences = [
      ...settings.annualSequences,
      {
        year,
        sezionaleId,
        startNumber: 1,
        lastAssignedNumber: 0,
        pattern: '{NUM}/{YYYY}{SEZ}'
      }
    ];
  }

  async function handleSave() {
    saving = true;
    feedback = null;
    try {
      await InvoiceSettingsService.saveSettings(settings);
      feedback = { type: 'success', text: 'Impostazioni di fatturazione salvate con successo.' };
      setTimeout(() => { feedback = null; }, 3000);
    } catch (e: any) {
      feedback = { type: 'error', text: e.message || 'Errore salvataggio impostazioni.' };
    } finally {
      saving = false;
    }
  }

  async function handleBatchImport(e: Event) {
    const target = e.target as HTMLInputElement;
    if (!target.files || target.files.length === 0) return;

    importing = true;
    importResult = null;
    try {
      const filesPayload: Array<{ name: string; content: string }> = [];
      for (let i = 0; i < target.files.length; i++) {
        const file = target.files[i];
        if (file.name.toLowerCase().endsWith('.xml')) {
          const content = await file.text();
          filesPayload.push({ name: file.name, content });
        }
      }

      const bridge = new XmlFatturaPaBridge();
      const res = await bridge.importBatch(filesPayload);
      importResult = {
        imported: res.importedCount,
        errors: res.errors
      };
      feedback = { type: 'success', text: `Importati con successo ${res.importedCount} file XML nello storico.` };
    } catch (err: any) {
      feedback = { type: 'error', text: 'Errore durante l\'importazione: ' + err.message };
    } finally {
      importing = false;
      target.value = '';
    }
  }
</script>

<div class="invoice-settings-page">
  <!-- TOP NAV -->
  <div class="top-nav">
    <a href="/dashboard/invoices" class="btn-back">
      <ArrowLeft size={16} /> Torna a Fatture
    </a>
    <button class="btn btn-primary" onclick={handleSave} disabled={saving}>
      <Save size={16} /> Salva Configurazione
    </button>
  </div>

  <div class="page-header">
    <div class="icon-wrap">
      <Settings size={26} />
    </div>
    <div>
      <h1>Configurazione Fatture & Sezionali</h1>
      <p class="subtitle">Gestione registri IVA, numerazioni annuali progressive e anagrafica cedente</p>
    </div>
  </div>

  {#if feedback}
    <div class="feedback-banner {feedback.type}">
      {#if feedback.type === 'success'}
        <Check size={18} />
      {:else}
        <AlertCircle size={18} />
      {/if}
      <span>{feedback.text}</span>
    </div>
  {/if}

  <!-- SEZIONE 1: REGISTRI IVA & SEZIONALI -->
  <div class="data-card">
    <div class="card-header flex-between">
      <div>
        <h3>1. Registri IVA & Sezionali Numerazione</h3>
        <p class="card-sub">Definisci i codici suffisso utilizzati nella numerazione ufficiale (es. /PA per Pubblica Amministrazione, /NC per Note di Credito)</p>
      </div>
      <button class="btn btn-secondary btn-sm" onclick={addSezionale}>
        <Plus size={14} /> Nuovo Sezionale
      </button>
    </div>
    <div class="card-body">
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th style="width: 140px;">ID Sezionale</th>
              <th style="width: 120px;">Codice Suffisso</th>
              <th>Nome Registro Descrittivo</th>
              <th style="width: 100px; text-align: center;">Default</th>
              <th style="width: 50px;"></th>
            </tr>
          </thead>
          <tbody>
            {#each settings.sezionali as sez (sez.id)}
              <tr>
                <td><code>{sez.id}</code></td>
                <td>
                  <input 
                    type="text" 
                    bind:value={sez.code} 
                    placeholder="es. /PA" 
                    class="form-control form-control-sm"
                  />
                </td>
                <td>
                  <input 
                    type="text" 
                    bind:value={sez.name} 
                    placeholder="es. Registro Fatture Elettroniche" 
                    class="form-control form-control-sm"
                  />
                </td>
                <td style="text-align: center;">
                  {#if sez.isDefault}
                    <span class="badge-tag">Predefinito</span>
                  {:else}
                    <button 
                      class="btn-link" 
                      onclick={() => {
                        settings.sezionali.forEach(s => s.isDefault = (s.id === sez.id));
                      }}
                    >
                      Imposta default
                    </button>
                  {/if}
                </td>
                <td style="text-align: center;">
                  {#if !sez.isDefault}
                    <button class="icon-del" onclick={() => removeSezionale(sez.id)}>
                      <Trash2 size={15} />
                    </button>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <!-- SEZIONE 2: MAPPATURA TIPO DOCUMENTO -> SEZIONALE -->
  <div class="data-card">
    <div class="card-header">
      <h3>2. Instradamento Sezionale per Tipologia Documento</h3>
      <p class="card-sub">Decidi se ogni tipo di documento usa un sezionale dedicato o riutilizza il registro comune a piacere</p>
    </div>
    <div class="card-body">
      <div class="mapping-grid">
        <div class="mapping-item">
          <label for="mTD01">TD01 - Fattura Ordinaria</label>
          <select id="mTD01" bind:value={settings.documentTypeSezionaleMapping.TD01} class="form-control">
            {#each settings.sezionali as s}
              <option value={s.id}>{s.name} ({s.code || 'Principale'})</option>
            {/each}
          </select>
        </div>

        <div class="mapping-item">
          <label for="mTD24">TD24 - Fattura Differita (Bolle)</label>
          <select id="mTD24" bind:value={settings.documentTypeSezionaleMapping.TD24} class="form-control">
            {#each settings.sezionali as s}
              <option value={s.id}>{s.name} ({s.code || 'Principale'})</option>
            {/each}
          </select>
        </div>

        <div class="mapping-item">
          <label for="mTD04">TD04 - Nota di Credito (Storno)</label>
          <select id="mTD04" bind:value={settings.documentTypeSezionaleMapping.TD04} class="form-control">
            {#each settings.sezionali as s}
              <option value={s.id}>{s.name} ({s.code || 'Principale'})</option>
            {/each}
          </select>
        </div>

        <div class="mapping-item">
          <label for="mTD02">TD02 - Fattura di Acconto</label>
          <select id="mTD02" bind:value={settings.documentTypeSezionaleMapping.TD02} class="form-control">
            {#each settings.sezionali as s}
              <option value={s.id}>{s.name} ({s.code || 'Principale'})</option>
            {/each}
          </select>
        </div>

        <div class="mapping-item">
          <label for="mTD06">TD06 - Parcella Professionale</label>
          <select id="mTD06" bind:value={settings.documentTypeSezionaleMapping.TD06} class="form-control">
            {#each settings.sezionali as s}
              <option value={s.id}>{s.name} ({s.code || 'Principale'})</option>
            {/each}
          </select>
        </div>
      </div>
    </div>
  </div>

  <!-- SEZIONE 3: NUMERAZIONE ANNUALE & PROGRESSIVI -->
  <div class="data-card">
    <div class="card-header">
      <h3>3. Numerazione Annuale & Numeri di Partenza</h3>
      <p class="card-sub">Imposta il numero di partenza per ogni anno (es. se migri a metà anno da altro software) e controlla l'ultimo progressivo emesso</p>
    </div>
    <div class="card-body">
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th style="width: 90px;">Anno</th>
              <th style="width: 180px;">Sezionale</th>
              <th style="width: 140px;">Numero di Partenza</th>
              <th style="width: 140px;">Ultimo Assegnato</th>
              <th>Formato Visuale Naming</th>
            </tr>
          </thead>
          <tbody>
            {#each settings.annualSequences as seq}
              <tr>
                <td><strong>{seq.year}</strong></td>
                <td>
                  {settings.sezionali.find(s => s.id === seq.sezionaleId)?.name || seq.sezionaleId}
                </td>
                <td>
                  <input 
                    type="number" 
                    bind:value={seq.startNumber} 
                    min="1" 
                    class="form-control form-control-sm"
                  />
                </td>
                <td>
                  <span class="last-assigned-tag">#{seq.lastAssignedNumber}</span>
                </td>
                <td>
                  <input 
                    type="text" 
                    bind:value={seq.pattern} 
                    class="form-control form-control-sm"
                    placeholder="&#123;NUM&#125;/&#123;YYYY&#125;&#123;SEZ&#125;"
                  />
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <!-- SEZIONE 4: DATI AZIENDA / CEDENTE PRESTATORE -->
  <div class="data-card">
    <div class="card-header">
      <h3>4. Anagrafica Fiscale Cedente / Prestatore</h3>
      <p class="card-sub">Dati fiscali della tua azienda inseriti nell'intestazione XML della Fattura Elettronica</p>
    </div>
    <div class="card-body form-grid-3">
      <div class="form-group">
        <label for="cNome">Denominazione o Ragione Sociale</label>
        <input type="text" id="cNome" bind:value={settings.companyInfo.companyName} class="form-control" placeholder="Azienda Srl" />
      </div>

      <div class="form-group">
        <label for="cPiva">Partita IVA</label>
        <input type="text" id="cPiva" bind:value={settings.companyInfo.vatNumber} class="form-control" placeholder="IT12345678901" />
      </div>

      <div class="form-group">
        <label for="cCf">Codice Fiscale</label>
        <input type="text" id="cCf" bind:value={settings.companyInfo.taxCode} class="form-control" placeholder="12345678901" />
      </div>

      <div class="form-group">
        <label for="cReg">Regime Fiscale</label>
        <select id="cReg" bind:value={settings.companyInfo.fiscalRegime} class="form-control">
          <option value="RF01">RF01 - Ordinario</option>
          <option value="RF02">RF02 - Contribuenti Minimi</option>
          <option value="RF19">RF19 - Forfettario</option>
        </select>
      </div>

      <div class="form-group">
        <label for="cIban">IBAN Predefinito per Incassi</label>
        <input type="text" id="cIban" bind:value={settings.companyInfo.iban} class="form-control" placeholder="IT00X0000000000000000000000" />
      </div>

      <div class="form-group">
        <label for="cPec">PEC Aziendale</label>
        <input type="email" id="cPec" bind:value={settings.companyInfo.pec} class="form-control" placeholder="amministrazione@pec.it" />
      </div>
    </div>
  </div>

  <!-- SEZIONE 5: IMPORTAZIONE MASSIVA STORICO XML -->
  <div class="data-card">
    <div class="card-header">
      <div class="flex-between">
        <div>
          <h3>5. Importazione Massiva Storico XML (FatturaPA)</h3>
          <p class="card-sub">Carica uno o più file XML per importare fatture pregresse senza riscriverle a mano</p>
        </div>
        <label class="btn btn-secondary">
          <Upload size={16} /> Carica File XML
          <input 
            type="file" 
            accept=".xml" 
            multiple 
            onchange={handleBatchImport} 
            style="display: none;" 
          />
        </label>
      </div>
    </div>
    <div class="card-body">
      {#if importing}
        <div class="import-status">
          <RefreshCw size={24} class="spin" />
          <span>Analisi e importazione file XML in corso...</span>
        </div>
      {:else if importResult}
        <div class="import-result">
          <Check size={20} class="text-success" />
          <span>Importati <strong>{importResult.imported}</strong> documenti fiscali nello storico.</span>
          {#if importResult.errors.length > 0}
            <div class="errors-list">
              {#each importResult.errors as err}
                <div class="err-item">{err}</div>
              {/each}
            </div>
          {/if}
        </div>
      {:else}
        <p class="import-desc">
          Puoi trascinare o selezionare un archivio di fatture elettroniche XML emesse con un gestionale precedente.
          Il parser riconoscerà automaticamente clienti, date, imponibili, aliquote e righe.
        </p>
      {/if}
    </div>
  </div>
</div>

<style>
  .invoice-settings-page {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .top-nav {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .btn-back {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    color: var(--text-muted, #64748b);
    text-decoration: none;
    white-space: nowrap;
  }

  .btn-back:hover {
    color: var(--color-primary-600, #2563eb);
  }

  .page-header {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .icon-wrap {
    width: 52px;
    height: 52px;
    border-radius: 12px;
    background: rgba(37, 99, 235, 0.1);
    color: var(--color-primary-600, #2563eb);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  h1 {
    font-size: 1.5rem;
    font-weight: 800;
    margin: 0;
  }

  .subtitle {
    margin: 0.15rem 0 0 0;
    font-size: 0.85rem;
    color: var(--text-muted, #64748b);
  }

  .data-card {
    background: var(--surface-card, #ffffff);
    border: 1px solid var(--border-color, #e2e8f0);
    border-radius: 12px;
    overflow: hidden;
  }

  .card-header {
    padding: 1rem 1.25rem;
    border-bottom: 1px solid var(--border-color, #e2e8f0);
  }

  .card-header h3 {
    margin: 0;
    font-size: 1rem;
    font-weight: 700;
  }

  .card-sub {
    margin: 0.15rem 0 0 0;
    font-size: 0.775rem;
    color: var(--text-muted, #64748b);
  }

  .card-body {
    padding: 1.25rem;
  }

  .flex-between {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .table-responsive {
    width: 100%;
    overflow-x: auto;
  }

  .data-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;
  }

  .data-table th {
    padding: 0.75rem 1rem;
    background: #f8fafc;
    color: #475569;
    font-weight: 600;
    border-bottom: 1px solid #e2e8f0;
    text-align: left;
  }

  .data-table td {
    padding: 0.6rem 1rem;
    border-bottom: 1px solid #f1f5f9;
  }

  .form-control {
    width: 100%;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--border-color, #cbd5e1);
    border-radius: 8px;
    font-size: 0.875rem;
    box-sizing: border-box;
  }

  .form-control-sm {
    padding: 0.35rem 0.6rem;
    font-size: 0.825rem;
  }

  .badge-tag {
    font-size: 0.75rem;
    font-weight: 700;
    color: #15803d;
    background: #dcfce7;
    padding: 0.15rem 0.5rem;
    border-radius: 4px;
  }

  .btn-link {
    background: none;
    border: none;
    color: #2563eb;
    font-size: 0.75rem;
    cursor: pointer;
    text-decoration: underline;
  }

  .icon-del {
    background: none;
    border: none;
    color: #94a3b8;
    cursor: pointer;
  }

  .icon-del:hover {
    color: #dc2626;
  }

  .mapping-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 1rem;
  }

  .mapping-item {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .mapping-item label {
    font-size: 0.8rem;
    font-weight: 600;
    color: #475569;
  }

  .last-assigned-tag {
    font-weight: 700;
    color: #2563eb;
    background: rgba(37, 99, 235, 0.08);
    padding: 0.15rem 0.5rem;
    border-radius: 4px;
  }

  .form-grid-3 {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 1.25rem;
  }

  .form-group label {
    display: block;
    font-size: 0.8rem;
    font-weight: 600;
    color: #475569;
    margin-bottom: 0.35rem;
  }

  .btn {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    padding: 0.55rem 1.1rem;
    border-radius: 8px;
    font-weight: 600;
    font-size: 0.85rem;
    border: none;
    cursor: pointer;
  }

  .btn-primary {
    background: var(--color-primary-600, #2563eb);
    color: #ffffff;
  }

  .btn-secondary {
    background: #f1f5f9;
    color: #334155;
    border: 1px solid #cbd5e1;
  }

  .btn-sm {
    padding: 0.35rem 0.75rem;
    font-size: 0.8rem;
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
  }

  .feedback-banner.error {
    background: #fee2e2;
    color: #991b1b;
  }

  .import-desc {
    color: var(--text-muted, #64748b);
    font-size: 0.85rem;
    margin: 0;
    line-height: 1.5;
  }

  .import-status {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    color: var(--color-primary-600, #2563eb);
    font-size: 0.9rem;
    font-weight: 600;
  }

  .import-result {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.9rem;
  }

  :global(.text-success) {
    color: #16a34a;
  }

  :global(.spin) {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
</style>
