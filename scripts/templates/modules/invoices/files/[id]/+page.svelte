<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { 
    Receipt, 
    ArrowLeft, 
    Download, 
    Send, 
    CheckCircle2, 
    FileText, 
    Trash2, 
    RotateCcw, 
    CreditCard, 
    Building2, 
    Calendar, 
    Hash, 
    AlertTriangle,
    Clock,
    Printer,
    FileCode
  } from '@lucide/svelte';
  import { InvoicesService } from '../invoices.service';
  import { InvoiceSettingsService } from '../invoiceSettingsService';
  import { XmlFatturaPaBridge } from '../bridges/XmlFatturaPaBridge';
  import { InvoicesPaymentsBridge } from '../bridges/invoices.payments.bridge';
  import type { InvoiceItem, InvoiceSettings } from '../schema';
  import InvoiceStatusBadge from '../components/InvoiceStatusBadge.svelte';
  import InvoiceTotalsSummary from '../components/InvoiceTotalsSummary.svelte';
  import { formatCurrency } from '$lib/utils/math';

  const invoiceId = page.params.id || '';

  let invoice = $state<InvoiceItem | null>(null);
  let settings = $state<InvoiceSettings | null>(null);
  let loading = $state(true);
  let actionLoading = $state(false);
  let feedbackMessage = $state<{ type: 'success' | 'error'; text: string } | null>(null);

  // Dialog registrazione incasso rapido
  let isPaymentModalOpen = $state(false);
  let paymentAmount = $state<number>(0);
  let paymentMethod = $state('bonifico');

  onMount(async () => {
    await loadData();
  });

  async function loadData() {
    loading = true;
    try {
      const [inv, sett] = await Promise.all([
        InvoicesService.getInvoiceById(invoiceId),
        InvoiceSettingsService.getSettings()
      ]);
      invoice = inv;
      settings = sett;
      if (inv) {
        paymentAmount = inv.remainingAmount ?? inv.netToPay ?? inv.totalGross;
      }
    } catch (e: any) {
      feedbackMessage = { type: 'error', text: e.message || 'Errore caricamento documento' };
    } finally {
      loading = false;
    }
  }

  async function handleIssue() {
    if (!invoice || invoice.status !== 'bozza') return;
    if (!confirm('Confermi l\'emissione definitiva della fattura? Verrà assegnato il numero progressivo ufficiale protetto e immutabile.')) return;

    actionLoading = true;
    try {
      const res = await InvoicesService.issueInvoice(invoice.id!);
      feedbackMessage = { type: 'success', text: `Fattura emessa con successo! Assegnato numero ${res.invoiceNumber}` };
      await loadData();
    } catch (e: any) {
      feedbackMessage = { type: 'error', text: e.message || 'Errore durante l\'emissione' };
    } finally {
      actionLoading = false;
    }
  }

  async function handleDeleteDraft() {
    if (!invoice || invoice.status !== 'bozza') return;
    if (!confirm('Sei sicuro di voler eliminare questa bozza? Eventuali bolle collegate verranno svincolate automaticamente.')) return;

    actionLoading = true;
    try {
      await InvoicesService.deleteDraft(invoice.id!);
      goto('/dashboard/invoices');
    } catch (e: any) {
      feedbackMessage = { type: 'error', text: e.message || 'Errore eliminazione bozza' };
      actionLoading = false;
    }
  }

  async function handleCreateCreditNote() {
    if (!invoice) return;
    const releaseBolle = invoice.bolleIds && invoice.bolleIds.length > 0
      ? confirm('Desideri svincolare anche le bolle/rapportini associati per poterli rifatturare?')
      : false;

    actionLoading = true;
    try {
      const ncId = await InvoicesService.createCreditNote(invoice.id!, undefined, releaseBolle);
      feedbackMessage = { type: 'success', text: 'Nota di credito generata come bozza!' };
      goto(`/dashboard/invoices/${ncId}`);
    } catch (e: any) {
      feedbackMessage = { type: 'error', text: e.message || 'Errore creazione nota di credito' };
      actionLoading = false;
    }
  }

  async function downloadXml() {
    if (!invoice) return;
    try {
      const bridge = new XmlFatturaPaBridge();
      const xml = await bridge.generateXml(invoice, settings?.companyInfo || {});
      const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `IT_${(settings?.companyInfo?.vatNumber || '00000000000').replace(/\D/g, '')}_${invoice.invoiceNumber.replace(/[\/\\]/g, '_')}.xml`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert('Errore generazione XML: ' + e.message);
    }
  }

  async function confirmPayment() {
    if (!invoice || !invoice.id || paymentAmount <= 0) return;
    actionLoading = true;
    try {
      await InvoicesPaymentsBridge.registerPaymentOnInvoice(invoice.id, paymentAmount);
      isPaymentModalOpen = false;
      feedbackMessage = { type: 'success', text: 'Incasso registrato con successo!' };
      await loadData();
    } catch (e: any) {
      alert('Errore registrazione incasso: ' + e.message);
    } finally {
      actionLoading = false;
    }
  }
</script>

<div class="invoice-detail-page">
  <!-- TOP BAR -->
  <div class="top-nav">
    <a href="/dashboard/invoices" class="btn-back">
      <ArrowLeft size={16} /> Torna all'elenco fatture
    </a>
    <div class="top-actions">
      {#if invoice}
        {#if invoice.status === 'bozza'}
          <button class="btn btn-danger" onclick={handleDeleteDraft} disabled={actionLoading}>
            <Trash2 size={16} /> Elimina Bozza
          </button>
          <button class="btn btn-primary" onclick={handleIssue} disabled={actionLoading}>
            <CheckCircle2 size={16} /> Emetti Fattura Definitiva
          </button>
        {:else}
          <button class="btn btn-secondary" onclick={downloadXml}>
            <FileCode size={16} /> Scarica XML SDI
          </button>
          <button class="btn btn-secondary" onclick={() => window.print()}>
            <Printer size={16} /> Stampa / PDF
          </button>
          {#if invoice.paymentStatus !== 'pagata_saldata' && invoice.status !== 'annullata'}
            <button class="btn btn-success" onclick={() => isPaymentModalOpen = true}>
              <CreditCard size={16} /> Registra Incasso
            </button>
          {/if}
          {#if invoice.type !== 'TD04' && invoice.status !== 'annullata' && !invoice.creditNoteInvoiceId}
            <button class="btn btn-warning" onclick={handleCreateCreditNote} disabled={actionLoading}>
              <RotateCcw size={16} /> Storna (Nota di Credito)
            </button>
          {/if}
        {/if}
      {/if}
    </div>
  </div>

  {#if feedbackMessage}
    <div class="feedback-banner {feedbackMessage.type}">
      <span>{feedbackMessage.text}</span>
    </div>
  {/if}

  {#if loading}
    <div class="data-card empty-card">
      <p>Caricamento documento in corso...</p>
    </div>
  {:else if !invoice}
    <div class="data-card empty-card">
      <AlertTriangle size={36} />
      <h3>Documento non trovato</h3>
      <p>La fattura richiesta non esiste o è stata eliminata.</p>
    </div>
  {:else}
    <!-- HEADER DOCUMENTO -->
    <div class="header-card">
      <div class="header-left">
        <div class="doc-icon-wrap">
          <Receipt size={28} />
        </div>
        <div>
          <div class="doc-title-row">
            <h1>{invoice.invoiceNumber}</h1>
            <span class="type-tag">{invoice.type}</span>
            <InvoiceStatusBadge status={invoice.status} />
            <InvoiceStatusBadge paymentStatus={invoice.paymentStatus} showPayment={true} />
          </div>
          <p class="doc-meta">
            Data emissione: <strong>{invoice.date}</strong> • Scadenza: <strong>{invoice.dueDate}</strong> • 
            Metodo: <strong>{invoice.paymentMethod}</strong>
          </p>
        </div>
      </div>
      <div class="header-right">
        <span class="total-label">Totale Documento</span>
        <span class="total-value">{formatCurrency(invoice.totalGross)}</span>
        {#if invoice.paymentStatus !== 'pagata_saldata'}
          <span class="due-label">Residuo da pagare: {formatCurrency(invoice.remainingAmount ?? invoice.netToPay)}</span>
        {/if}
      </div>
    </div>

    <!-- ANAGRAFICA CLIENTE & AZIENDA -->
    <div class="parties-grid">
      <div class="party-card">
        <h4>Cedente / Prestatore</h4>
        <div class="party-details">
          <strong>{settings?.companyInfo?.companyName || 'AZIENDA'}</strong>
          <span>P.IVA: {settings?.companyInfo?.vatNumber || 'Non specificata'}</span>
          <span>Regime Fiscale: {settings?.companyInfo?.fiscalRegime || 'RF01'}</span>
          <span>{settings?.companyInfo?.address || ''} {settings?.companyInfo?.city || ''}</span>
        </div>
      </div>

      <div class="party-card">
        <h4>Cessionario / Committente (Cliente)</h4>
        <div class="party-details">
          <strong>{invoice.clientName}</strong>
          {#if invoice.clientVatNumber}<span>P.IVA: {invoice.clientVatNumber}</span>{/if}
          {#if invoice.clientTaxCode}<span>C.F.: {invoice.clientTaxCode}</span>{/if}
          <span>Codice SDI: <strong>{invoice.clientSdiCode || '0000000'}</strong></span>
          {#if invoice.clientPec}<span>PEC: {invoice.clientPec}</span>{/if}
          <span>{invoice.clientAddress || ''} {invoice.clientCity || ''}</span>
        </div>
      </div>
    </div>

    <!-- BOLLE COLLEGATE SE PRESENTI -->
    {#if invoice.bolleIds && invoice.bolleIds.length > 0}
      <div class="linked-bolle-banner">
        <span class="banner-title">Documenti di Trasporto / Interventi Collegati:</span>
        <div class="bolle-chips">
          {#each invoice.bolleIds as bId}
            <span class="bolla-chip">
              Bolla ID: {bId}
            </span>
          {/each}
        </div>
      </div>
    {/if}

    <!-- TABELLA RIGHE DOCUMENTO -->
    <div class="data-card">
      <div class="card-title">
        <h3>Corpo della Fattura (Dettaglio Linee)</h3>
      </div>
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th style="width: 40px;">#</th>
              <th>Descrizione Prestazione / Articolo</th>
              <th style="width: 80px; text-align: right;">Q.tà</th>
              <th style="width: 110px; text-align: right;">Prezzo Unit.</th>
              <th style="width: 90px; text-align: right;">Sconto %</th>
              <th style="width: 100px; text-align: center;">IVA / Natura</th>
              <th style="width: 120px; text-align: right;">Imponibile</th>
              <th style="width: 120px; text-align: right;">Totale Riga</th>
            </tr>
          </thead>
          <tbody>
            {#each invoice.lines as line, idx}
              <tr>
                <td style="color: var(--text-muted);">{idx + 1}</td>
                <td>
                  <span class="line-desc">{line.description}</span>
                  {#if line.bollaNumber}
                    <span class="bolla-ref-tag">Rif. Bolla #{line.bollaNumber}</span>
                  {/if}
                </td>
                <td style="text-align: right;">{line.quantity}</td>
                <td style="text-align: right;">{formatCurrency(line.unitPrice)}</td>
                <td style="text-align: right;">{line.discountPercent ? `${line.discountPercent}%` : '—'}</td>
                <td style="text-align: center;">
                  <span class="vat-tag">
                    {line.vatRate}% {#if line.natureCode}({line.natureCode}){/if}
                  </span>
                </td>
                <td style="text-align: right; font-weight: 600;">{formatCurrency(line.netAmount)}</td>
                <td style="text-align: right; font-weight: 700;">{formatCurrency(line.grossAmount)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>

    <!-- RIEPILOGO TOTALI E NOTE -->
    <div class="bottom-grid">
      <div class="notes-card">
        <h4>Note & Condizioni di Pagamento</h4>
        <p class="notes-text">{invoice.notes || 'Nessuna nota aggiuntiva specificata nel documento.'}</p>
        {#if invoice.iban}
          <div class="iban-block">
            <span class="iban-label">Coordinate Bancarie (IBAN):</span>
            <span class="iban-code">{invoice.iban}</span>
          </div>
        {/if}
      </div>

      <InvoiceTotalsSummary 
        totalNet={invoice.totalNet}
        totalVat={invoice.totalVat}
        totalGross={invoice.totalGross}
        netToPay={invoice.netToPay}
        pensionFundRate={invoice.pensionFundRate}
        pensionFundAmount={invoice.pensionFundAmount}
        withholdingTaxRate={invoice.withholdingTaxRate}
        withholdingTaxAmount={invoice.withholdingTaxAmount}
        isSplitPayment={invoice.isSplitPayment}
        splitPaymentAmount={invoice.splitPaymentAmount}
        castelletto={invoice.castelletto}
      />
    </div>
  {/if}

  <!-- MODALE REGISTRAZIONE INCASSO -->
  {#if isPaymentModalOpen}
    <div class="modal-backdrop" onclick={() => isPaymentModalOpen = false} role="presentation">
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
      <div class="modal-card" onclick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <div class="modal-header">
          <h3>Registra Incasso su Fattura</h3>
          <button class="btn-close" onclick={() => isPaymentModalOpen = false}>×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label for="pAmt">Importo Incassato (€) *</label>
            <input 
              type="number" 
              id="pAmt" 
              bind:value={paymentAmount} 
              step="0.01" 
              min="0.01" 
              max={invoice?.remainingAmount ?? invoice?.netToPay} 
              class="form-control"
            />
            <span class="field-hint">Residuo da saldare: {formatCurrency(invoice?.remainingAmount ?? invoice?.netToPay ?? 0)}</span>
          </div>

          <div class="form-group" style="margin-top: 1rem;">
            <label for="pMet">Metodo di Pagamento</label>
            <select id="pMet" bind:value={paymentMethod} class="form-control">
              <option value="bonifico">Bonifico Bancario</option>
              <option value="riba">Ri.Ba.</option>
              <option value="pos_carta">Carta / POS</option>
              <option value="contanti">Contanti</option>
            </select>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick={() => isPaymentModalOpen = false}>Annulla</button>
          <button class="btn btn-primary" onclick={confirmPayment} disabled={actionLoading}>
            <CheckCircle2 size={16} /> Salva Incasso
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .invoice-detail-page {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .top-nav {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 1rem;
  }

  .btn-back {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    color: var(--text-muted, #64748b);
    text-decoration: none;
    font-weight: 500;
    white-space: nowrap;
  }

  .btn-back:hover {
    color: var(--color-primary-600, #2563eb);
  }

  .top-actions {
    display: flex;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .btn {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.55rem 1rem;
    font-size: 0.85rem;
    font-weight: 600;
    border-radius: 8px;
    border: none;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-primary {
    background: var(--color-primary-600, #2563eb);
    color: #ffffff;
  }

  .btn-secondary {
    background: var(--surface-secondary, #f1f5f9);
    color: var(--text-primary, #334155);
    border: 1px solid var(--border-color, #cbd5e1);
  }

  .btn-success {
    background: #16a34a;
    color: #ffffff;
  }

  .btn-warning {
    background: #d97706;
    color: #ffffff;
  }

  .btn-danger {
    background: #dc2626;
    color: #ffffff;
  }

  .header-card {
    background: var(--surface-card, #ffffff);
    border: 1px solid var(--border-color, #e2e8f0);
    border-radius: 12px;
    padding: 1.5rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 1.5rem;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 1.25rem;
  }

  .doc-icon-wrap {
    width: 56px;
    height: 56px;
    border-radius: 12px;
    background: rgba(37, 99, 235, 0.1);
    color: var(--color-primary-600, #2563eb);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .doc-title-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  h1 {
    font-size: 1.75rem;
    font-weight: 800;
    margin: 0;
  }

  .type-tag {
    font-size: 0.8rem;
    font-weight: 700;
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
    background: #f1f5f9;
    color: #475569;
  }

  .doc-meta {
    margin: 0.35rem 0 0 0;
    font-size: 0.85rem;
    color: var(--text-muted, #64748b);
  }

  .header-right {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
  }

  .total-label {
    font-size: 0.8rem;
    color: var(--text-muted, #64748b);
  }

  .total-value {
    font-size: 1.85rem;
    font-weight: 800;
    color: var(--color-primary-600, #2563eb);
  }

  .due-label {
    font-size: 0.8rem;
    font-weight: 600;
    color: #dc2626;
  }

  .parties-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.25rem;
  }

  @media (max-width: 768px) {
    .parties-grid {
      grid-template-columns: 1fr;
    }
  }

  .party-card {
    background: var(--surface-card, #ffffff);
    border: 1px solid var(--border-color, #e2e8f0);
    border-radius: 12px;
    padding: 1.25rem;
  }

  .party-card h4 {
    margin: 0 0 0.75rem 0;
    font-size: 0.9rem;
    color: var(--text-muted, #64748b);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .party-details {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    font-size: 0.875rem;
  }

  .linked-bolle-banner {
    background: #eff6ff;
    border: 1px solid #bfdbfe;
    border-radius: 8px;
    padding: 0.75rem 1rem;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-size: 0.85rem;
  }

  .banner-title {
    font-weight: 600;
    color: #1d4ed8;
  }

  .bolle-chips {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .bolla-chip {
    background: #ffffff;
    border: 1px solid #93c5fd;
    color: #1e40af;
    padding: 0.15rem 0.5rem;
    border-radius: 4px;
    font-weight: 600;
  }

  .data-card {
    background: var(--surface-card, #ffffff);
    border: 1px solid var(--border-color, #e2e8f0);
    border-radius: 12px;
    overflow: hidden;
  }

  .card-title {
    padding: 1rem 1.25rem;
    border-bottom: 1px solid var(--border-color, #e2e8f0);
  }

  .card-title h3 {
    margin: 0;
    font-size: 1rem;
    font-weight: 700;
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
  }

  .line-desc {
    font-weight: 500;
  }

  .bolla-ref-tag {
    display: block;
    font-size: 0.725rem;
    color: #2563eb;
    margin-top: 0.15rem;
  }

  .vat-tag {
    font-size: 0.75rem;
    font-weight: 700;
    color: #475569;
    background: #f1f5f9;
    padding: 0.15rem 0.45rem;
    border-radius: 4px;
  }

  .bottom-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.25rem;
  }

  @media (max-width: 768px) {
    .bottom-grid {
      grid-template-columns: 1fr;
    }
  }

  .notes-card {
    background: var(--surface-card, #ffffff);
    border: 1px solid var(--border-color, #e2e8f0);
    border-radius: 12px;
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }

  .notes-card h4 {
    margin: 0 0 0.5rem 0;
    font-size: 0.95rem;
  }

  .notes-text {
    font-size: 0.875rem;
    color: var(--text-muted, #64748b);
    line-height: 1.5;
  }

  .iban-block {
    margin-top: 1rem;
    padding: 0.75rem;
    background: #f8fafc;
    border-radius: 8px;
    border: 1px solid #e2e8f0;
  }

  .iban-label {
    display: block;
    font-size: 0.75rem;
    color: var(--text-muted, #64748b);
  }

  .iban-code {
    font-family: monospace;
    font-weight: 700;
    font-size: 0.9rem;
    color: var(--text-primary, #0f172a);
  }

  .empty-card {
    padding: 3rem;
    text-align: center;
    color: var(--text-muted, #64748b);
  }

  .feedback-banner {
    padding: 0.75rem 1rem;
    border-radius: 8px;
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
    border-radius: 12px;
    width: 100%;
    max-width: 440px;
    overflow: hidden;
  }

  .modal-header {
    padding: 1rem 1.25rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid #e2e8f0;
  }

  .modal-header h3 {
    margin: 0;
    font-size: 1.1rem;
  }

  .btn-close {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
  }

  .modal-body {
    padding: 1.25rem;
  }

  .modal-footer {
    padding: 0.85rem 1.25rem;
    background: #f8fafc;
    border-top: 1px solid #e2e8f0;
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
  }

  .form-control {
    width: 100%;
    padding: 0.5rem 0.75rem;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    box-sizing: border-box;
  }

  .field-hint {
    font-size: 0.75rem;
    color: #64748b;
    margin-top: 0.25rem;
    display: block;
  }
</style>
