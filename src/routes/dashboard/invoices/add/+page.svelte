<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { db, collection, getDocs, query, where } from '$lib/firebase';
  import { 
    Receipt, 
    ArrowLeft, 
    Plus, 
    Trash2, 
    FileCheck, 
    FileText, 
    Briefcase, 
    Percent, 
    Save, 
    Calendar,
    Users,
    AlertCircle
  } from '@lucide/svelte';
  import { InvoicesService } from '../invoices.service';
  import { InvoiceSettingsService } from '../invoiceSettingsService';
  import { VatRatesService, type VatRateOption } from '$lib/services/vatRatesService';
  import SelectBolleModal from '../components/SelectBolleModal.svelte';
  import InvoiceTotalsSummary from '../components/InvoiceTotalsSummary.svelte';
  import type { InvoiceItem, InvoiceLine, InvoiceType } from '../schema';
  import { formatCurrency, roundCurrency } from '$lib/utils/math';
  import { Autocomplete, type AutocompleteOption } from '$lib';

  let activeTab = $state<'bolle' | 'libera' | 'contratto'>('bolle');
  let clients = $state<any[]>([]);
  let vatRates = $state<VatRateOption[]>([]);
  let loading = $state(true);
  let saving = $state(false);

  // Form State
  let selectedClientId = $state('');
  let selectedClientName = $state('');
  let clientOptions = $derived<AutocompleteOption[]>(
    clients.map(c => ({
      id: c.id,
      label: c.name || c.ragioneSociale || 'Cliente',
      sublabel: c.piva ? `P.IVA: ${c.piva}` : (c.codiceFiscale ? `C.F.: ${c.codiceFiscale}` : undefined)
    }))
  );
  let invoiceType = $state<InvoiceType>('TD24');
  let invoiceDate = $state(new Date().toISOString().split('T')[0]);
  let dueDate = $state(new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]);
  let paymentMethod = $state('bonifico');
  let notes = $state('');

  // Opzioni fiscali speciali
  let pensionFundRate = $state(0);
  let withholdingTaxRate = $state(0);
  let isSplitPayment = $state(false);

  // Righe fattura
  let lines = $state<InvoiceLine[]>([
    {
      id: 'line_1',
      description: '',
      quantity: 1,
      unitPrice: 0,
      vatRate: 22,
      discountPercent: 0,
      netAmount: 0,
      vatAmount: 0,
      grossAmount: 0
    }
  ]);

  // Bolle collegate
  let attachedBolle = $state<any[]>([]);
  let isBolleModalOpen = $state(false);

  onMount(async () => {
    loading = true;
    try {
      const [rates, clientsSnap] = await Promise.all([
        VatRatesService.getActiveVatRates(),
        getDocs(collection(db, 'clients'))
      ]);
      vatRates = rates;
      const cList: any[] = [];
      clientsSnap.forEach(d => cList.push({ id: d.id, ...d.data() }));
      clients = cList;
    } catch (e) {
      console.warn('Errore inizializzazione wizard:', e);
    } finally {
      loading = false;
    }
  });

  function handleClientChange(clientId: string) {
    selectedClientId = clientId;
    const client = clients.find(c => c.id === clientId);
    if (client) {
      selectedClientName = client.name || client.ragioneSociale || 'Cliente';
      isSplitPayment = client.isPa === true || client.splitPayment === true;
    }
    // Se c'erano bolle di un altro cliente, le azzeriamo
    attachedBolle = [];
  }

  function addEmptyLine() {
    const defaultRate = vatRates.find(r => r.isDefault)?.rate || 22;
    lines = [
      ...lines,
      {
        id: `line_${Date.now()}`,
        description: '',
        quantity: 1,
        unitPrice: 0,
        vatRate: defaultRate,
        discountPercent: 0,
        netAmount: 0,
        vatAmount: 0,
        grossAmount: 0
      }
    ];
  }

  function removeLine(idx: number) {
    if (lines.length <= 1) {
      lines[0].description = '';
      lines[0].unitPrice = 0;
      return;
    }
    lines = lines.filter((_, i) => i !== idx);
  }

  function handleBolleSelected(selectedBolle: any[]) {
    attachedBolle = selectedBolle;
    isBolleModalOpen = false;

    // Converte le bolle in righe fattura
    const newLines: InvoiceLine[] = [];
    selectedBolle.forEach(b => {
      // Riga testata bolla
      newLines.push({
        id: `hdr_${b.id}`,
        description: `Bolla #${b.number || b.id.slice(0, 6)} del ${b.date || 'N/D'} - ${b.title || 'Intervento'}`,
        quantity: 1,
        unitPrice: 0,
        vatRate: 0,
        netAmount: 0,
        vatAmount: 0,
        grossAmount: 0,
        bollaId: b.id,
        bollaNumber: b.number || b.id.slice(0, 6),
        bollaDate: b.date,
        entryType: 'other'
      });

      // Voci bolla se presenti
      if (Array.isArray(b.items) && b.items.length > 0) {
        b.items.forEach((item: any, idx: number) => {
          const qty = Number(item.quantity || 1);
          const price = Number(item.unitPrice || item.totalAmount || 0);
          newLines.push({
            id: `line_${b.id}_${idx}`,
            description: item.description || item.productName || 'Voce di lavoro',
            quantity: qty,
            unitPrice: price,
            vatRate: 22,
            netAmount: roundCurrency(qty * price),
            vatAmount: roundCurrency(qty * price * 0.22),
            grossAmount: roundCurrency(qty * price * 1.22),
            bollaId: b.id,
            bollaNumber: b.number || b.id.slice(0, 6),
            bollaDate: b.date,
            entryType: item.entryType || 'service'
          });
        });
      } else {
        // Importo forfettario bolla
        const amt = Number(b.totalAmount || b.estimatedCost || 0);
        newLines.push({
          id: `line_${b.id}_tot`,
          description: `Consuntivo ${b.title || 'interventi'}`,
          quantity: 1,
          unitPrice: amt,
          vatRate: 22,
          netAmount: amt,
          vatAmount: roundCurrency(amt * 0.22),
          grossAmount: roundCurrency(amt * 1.22),
          bollaId: b.id,
          bollaNumber: b.number || b.id.slice(0, 6),
          bollaDate: b.date,
          entryType: 'service'
        });
      }
    });

    lines = newLines;
    invoiceType = selectedBolle.length > 1 ? 'TD24' : 'TD01';
  }

  let calculatedTotals = $derived(
    InvoicesService.calculateTotals(lines, {
      pensionFundRate,
      withholdingTaxRate,
      isSplitPayment
    })
  );

  async function handleSaveDraft() {
    if (!selectedClientId) {
      alert('Seleziona un cliente destinatario.');
      return;
    }
    if (lines.length === 0 || lines.every(l => !l.description && l.unitPrice === 0)) {
      alert('Inserisci almeno una riga prestazione con importo.');
      return;
    }

    saving = true;
    try {
      const client = clients.find(c => c.id === selectedClientId);
      const draftId = await InvoicesService.createDraft({
        type: invoiceType,
        clientId: selectedClientId,
        clientName: selectedClientName,
        clientVatNumber: client?.piva || client?.partitaIva || '',
        clientTaxCode: client?.codiceFiscale || '',
        clientSdiCode: client?.codiceSdi || client?.sdi || '0000000',
        clientPec: client?.pec || '',
        clientAddress: client?.indirizzo || client?.address || '',
        clientCap: client?.cap || '',
        clientCity: client?.citta || client?.city || '',
        clientProvince: client?.provincia || client?.province || 'RM',
        date: invoiceDate,
        dueDate,
        paymentMethod,
        notes,
        pensionFundRate,
        withholdingTaxRate,
        isSplitPayment,
        originType: attachedBolle.length > 0 ? 'bolle' : 'manual',
        bolleIds: attachedBolle.map(b => b.id),
        lines
      });

      goto(`/dashboard/invoices/${draftId}`);
    } catch (e: any) {
      alert('Errore salvataggio bozza: ' + e.message);
      saving = false;
    }
  }
</script>

<div class="add-invoice-page">
  <!-- TOP NAV -->
  <div class="top-nav">
    <a href="/dashboard/invoices" class="btn-back">
      <ArrowLeft size={16} /> Torna a Fatture
    </a>
    <div class="actions">
      <button class="btn btn-primary" onclick={handleSaveDraft} disabled={saving}>
        <Save size={16} /> Salva Bozza Fattura
      </button>
    </div>
  </div>

  <div class="page-header">
    <div class="icon-wrap">
      <Receipt size={26} />
    </div>
    <div>
      <h1>Crea Nuova Fattura</h1>
      <p class="subtitle">Seleziona la modalità di creazione guidata del documento fiscale</p>
    </div>
  </div>

  <!-- TABS CREAZIONE -->
  <div class="wizard-tabs">
    <button 
      class="wizard-tab {activeTab === 'bolle' ? 'active' : ''}"
      onclick={() => { activeTab = 'bolle'; invoiceType = 'TD24'; }}
    >
      <FileCheck size={18} />
      <span>Da Bolle / Interventi</span>
    </button>
    <button 
      class="wizard-tab {activeTab === 'libera' ? 'active' : ''}"
      onclick={() => { activeTab = 'libera'; invoiceType = 'TD01'; }}
    >
      <FileText size={18} />
      <span>Fattura Libera / Notula</span>
    </button>
  </div>

  <div class="main-form-grid">
    <!-- COLONNA SINISTRA: DATI CLIENTE & RIGHE -->
    <div class="form-main-col">
      <!-- CARD INTESTAZIONE -->
      <div class="data-card">
        <div class="card-header">
          <h3>1. Destinatario & Dati Documento</h3>
        </div>
        <div class="card-body form-grid-row">
          <div class="form-group flex-2">
            <label for="cSel">Cliente Destinatario *</label>
            <Autocomplete 
              options={clientOptions}
              value={selectedClientId}
              onchange={(val) => handleClientChange(val)}
              placeholder="Cerca cliente per nome o P.IVA..."
            />
          </div>

          <div class="form-group">
            <label for="tSel">Tipo Documento</label>
            <select id="tSel" bind:value={invoiceType} class="form-control">
              <option value="TD01">TD01 - Fattura Ordinaria</option>
              <option value="TD24">TD24 - Fattura Differita (Bolle)</option>
              <option value="TD02">TD02 - Fattura di Acconto</option>
              <option value="TD06">TD06 - Notula / Parcella</option>
            </select>
          </div>

          <div class="form-group">
            <label for="dEmiss">Data Emissione</label>
            <input type="date" id="dEmiss" bind:value={invoiceDate} class="form-control" />
          </div>

          <div class="form-group">
            <label for="dScad">Data Scadenza</label>
            <input type="date" id="dScad" bind:value={dueDate} class="form-control" />
          </div>
        </div>
      </div>

      <!-- SEZIONE BOLLE (SE ACTIVE TAB BOLLE) -->
      {#if activeTab === 'bolle'}
        <div class="data-card">
          <div class="card-header flex-between">
            <div>
              <h3>2. Bolle / Interventi Inclusi</h3>
              <p class="card-sub">Seleziona i rapportini di cantiere chiusi da fatturare a fine mese</p>
            </div>
            <button 
              class="btn btn-secondary" 
              onclick={() => isBolleModalOpen = true}
              disabled={!selectedClientId}
            >
              <Plus size={16} /> Seleziona Bolle
            </button>
          </div>
          <div class="card-body">
            {#if !selectedClientId}
              <div class="empty-hint">
                <AlertCircle size={20} />
                <span>Seleziona prima un cliente in alto per caricare le bolle disponibili.</span>
              </div>
            {:else if attachedBolle.length === 0}
              <div class="empty-hint">
                <span>Nessuna bolla selezionata. Clicca su "Seleziona Bolle" per includere gli interventi.</span>
              </div>
            {:else}
              <div class="bolle-tags-list">
                {#each attachedBolle as b}
                  <div class="attached-bolla-card">
                    <span class="bolla-name">Bolla #{b.number || b.id.slice(0, 6)}</span>
                    <span class="bolla-meta">{b.date} • {b.title}</span>
                    <span class="bolla-amt">{formatCurrency(b.totalAmount || b.estimatedCost || 0)}</span>
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        </div>
      {/if}

      <!-- CARD RIGHE PRESTAZIONI -->
      <div class="data-card">
        <div class="card-header flex-between">
          <h3>Linee Documento</h3>
          <button class="btn btn-secondary btn-sm" onclick={addEmptyLine}>
            <Plus size={14} /> Aggiungi Riga
          </button>
        </div>
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Descrizione Prestazione / Articolo</th>
                <th style="width: 75px;">Q.tà</th>
                <th style="width: 105px;">Prezzo €</th>
                <th style="width: 75px;">Sc %</th>
                <th style="width: 110px;">IVA</th>
                <th style="width: 95px; text-align: right;">Totale</th>
                <th style="width: 40px;"></th>
              </tr>
            </thead>
            <tbody>
              {#each lines as line, idx}
                <tr>
                  <td>
                    <input 
                      type="text" 
                      bind:value={line.description} 
                      placeholder="Descrizione riga..." 
                      class="cell-input"
                    />
                  </td>
                  <td>
                    <input 
                      type="number" 
                      bind:value={line.quantity} 
                      min="1" 
                      step="0.1" 
                      class="cell-input text-right"
                    />
                  </td>
                  <td>
                    <input 
                      type="number" 
                      bind:value={line.unitPrice} 
                      min="0" 
                      step="0.01" 
                      class="cell-input text-right"
                    />
                  </td>
                  <td>
                    <input 
                      type="number" 
                      bind:value={line.discountPercent} 
                      min="0" 
                      max="100" 
                      class="cell-input text-right"
                    />
                  </td>
                  <td>
                    <select bind:value={line.vatRate} class="cell-input">
                      {#each vatRates as r}
                        <option value={r.rate}>{r.label}</option>
                      {/each}
                    </select>
                  </td>
                  <td style="text-align: right; font-weight: 700;">
                    {formatCurrency((line.quantity || 1) * (line.unitPrice || 0) * (1 - (line.discountPercent || 0) / 100))}
                  </td>
                  <td style="text-align: center;">
                    <button class="icon-btn-del" onclick={() => removeLine(idx)} title="Elimina riga">
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>

      <!-- NOTE FATTURA -->
      <div class="data-card">
        <div class="card-header">
          <h3>Note & Condizioni</h3>
        </div>
        <div class="card-body">
          <textarea 
            bind:value={notes} 
            placeholder="Eventuali note visibili in calce al documento o coordinate bancarie..."
            class="form-control"
            rows="3"
          ></textarea>
        </div>
      </div>
    </div>

    <!-- COLONNA DESTRA: RIEPILOGO TOTALI E OPZIONI FISCALI -->
    <div class="form-side-col">
      <!-- OPZIONI FISCALI AVANZATE -->
      <div class="data-card">
        <div class="card-header">
          <h3>Regime Fiscale & Trattamenti</h3>
        </div>
        <div class="card-body side-options">
          <div class="form-group">
            <label for="rPrev">Rivalsa Cassa Previdenziale (%)</label>
            <input 
              type="number" 
              id="rPrev" 
              bind:value={pensionFundRate} 
              min="0" 
              max="10" 
              step="1" 
              class="form-control"
              placeholder="es. 4 per cassa geometri/architetti"
            />
          </div>

          <div class="form-group">
            <label for="rAcconto">Ritenuta d'Acconto (%)</label>
            <input 
              type="number" 
              id="rAcconto" 
              bind:value={withholdingTaxRate} 
              min="0" 
              max="30" 
              step="1" 
              class="form-control"
              placeholder="es. 20 per professionisti"
            />
          </div>

          <div class="checkbox-group">
            <label class="checkbox-label">
              <input type="checkbox" bind:checked={isSplitPayment} />
              <span>Scissione Pagamenti (Split Payment PA)</span>
            </label>
            <span class="field-hint">L'IVA è a carico dell'ente pubblico (Art. 17-ter)</span>
          </div>
        </div>
      </div>

      <!-- TOTALI IN TEMPO REALE -->
      <InvoiceTotalsSummary 
        totalNet={calculatedTotals.totalNet}
        totalVat={calculatedTotals.totalVat}
        totalGross={calculatedTotals.totalGross}
        netToPay={calculatedTotals.netToPay}
        pensionFundRate={pensionFundRate}
        pensionFundAmount={calculatedTotals.pensionFundAmount}
        withholdingTaxRate={withholdingTaxRate}
        withholdingTaxAmount={calculatedTotals.withholdingTaxAmount}
        isSplitPayment={isSplitPayment}
        splitPaymentAmount={calculatedTotals.splitPaymentAmount}
        castelletto={calculatedTotals.castelletto}
      />

      <button class="btn btn-primary btn-block" onclick={handleSaveDraft} disabled={saving}>
        <Save size={18} /> Salva Bozza Fattura
      </button>
    </div>
  </div>

  <!-- MODALE SELEZIONE BOLLE -->
  {#if isBolleModalOpen}
    <SelectBolleModal 
      clientId={selectedClientId}
      onSelect={handleBolleSelected}
      onClose={() => isBolleModalOpen = false}
    />
  {/if}
</div>

<style>
  .add-invoice-page {
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

  /* WIZARD TABS */
  .wizard-tabs {
    display: flex;
    gap: 0.75rem;
    border-bottom: 1px solid var(--border-color, #e2e8f0);
    padding-bottom: 0.5rem;
  }

  .wizard-tab {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.65rem 1.25rem;
    border-radius: 8px;
    border: none;
    background: transparent;
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--text-muted, #64748b);
    cursor: pointer;
  }

  .wizard-tab.active {
    background: rgba(37, 99, 235, 0.1);
    color: var(--color-primary-600, #2563eb);
  }

  /* LAYOUT A 2 COLONNE */
  .main-form-grid {
    display: grid;
    grid-template-columns: 1fr 360px;
    gap: 1.5rem;
    align-items: start;
  }

  @media (max-width: 1024px) {
    .main-form-grid {
      grid-template-columns: 1fr;
    }
  }

  .form-main-col {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .form-side-col {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
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
    font-size: 0.75rem;
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

  .form-grid-row {
    display: grid;
    grid-template-columns: 2fr 1fr 1fr 1fr;
    gap: 1rem;
  }

  @media (max-width: 768px) {
    .form-grid-row {
      grid-template-columns: 1fr;
    }
  }

  .form-group label {
    display: block;
    font-size: 0.78rem;
    font-weight: 600;
    color: #475569;
    margin-bottom: 0.35rem;
  }

  .form-control {
    width: 100%;
    padding: 0.55rem 0.75rem;
    border: 1px solid var(--border-color, #cbd5e1);
    border-radius: 8px;
    font-size: 0.875rem;
    box-sizing: border-box;
  }

  /* BOLLE TAGS */
  .bolle-tags-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .attached-bolla-card {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.6rem 0.85rem;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    font-size: 0.85rem;
  }

  .bolla-name {
    font-weight: 700;
    color: #2563eb;
  }

  .bolla-meta {
    color: #64748b;
  }

  .bolla-amt {
    font-weight: 700;
  }

  .empty-hint {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--text-muted, #64748b);
    font-size: 0.85rem;
    padding: 0.5rem 0;
  }

  /* TABELLA RIGHE */
  .table-responsive {
    width: 100%;
    overflow-x: auto;
  }

  .data-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.85rem;
  }

  .data-table th {
    padding: 0.65rem 0.85rem;
    background: #f8fafc;
    color: #475569;
    font-weight: 600;
    border-bottom: 1px solid #e2e8f0;
  }

  .data-table td {
    padding: 0.5rem 0.75rem;
    border-bottom: 1px solid #f1f5f9;
  }

  .cell-input {
    width: 100%;
    padding: 0.4rem 0.55rem;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 0.825rem;
  }

  .text-right {
    text-align: right;
  }

  .icon-btn-del {
    background: none;
    border: none;
    color: #94a3b8;
    cursor: pointer;
    padding: 0.3rem;
  }

  .icon-btn-del:hover {
    color: #dc2626;
  }

  /* SIDE OPTIONS */
  .side-options {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .checkbox-group {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
  }

  .field-hint {
    font-size: 0.75rem;
    color: #64748b;
  }

  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.55rem 1rem;
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
    padding: 0.35rem 0.7rem;
    font-size: 0.8rem;
  }

  .btn-block {
    width: 100%;
    padding: 0.85rem 1rem;
    font-size: 0.95rem;
  }
</style>
