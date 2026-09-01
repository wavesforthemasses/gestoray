<script lang="ts">
  import { projectStore } from '$lib/stores/project';
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { PaymentsService } from '../payments.service';
  import { PaymentSettingsService } from '../paymentSettingsService';
  import type { PaymentItem, PaymentStatus, PaymentSettings } from '../schema';
  import { CustomFieldsService } from '$lib/services/customFieldsService';
  import type { CustomFieldDefinition } from '$lib/types/customFields';
  import CustomFieldsRenderer from '$lib/components/CustomFieldsRenderer.svelte';
  import { toast } from '$lib/stores/toast.svelte';
  import { confirmStore } from '$lib/stores/confirm.svelte';
  import { Card } from '$lib';
  import { 
    CreditCard, 
    ArrowLeft, 
    Printer, 
    Trash2, 
    Building2, 
    Calendar, 
    Euro, 
    Layers, 
    FileText,
    CheckCircle2,
    Clock,
    XCircle,
    User,
    Pencil,
    AlertTriangle
  } from '@lucide/svelte';

  const paymentId = $page.params.id || '';

  let settings = $state<PaymentSettings>({
    entityNaming: 'payment',
    prefix: 'INC-',
    includeYear: true,
    numberPadding: 4,
    lastNumber: 0,
    resetCounterAnnually: true
  });
  let labels = $derived(PaymentSettingsService.getLabels(settings));

  let payment = $state<PaymentItem | null>(null);
  let customFieldsList = $state<CustomFieldDefinition[]>([]);
  let loading = $state(true);

  onMount(async () => {
    try {
      const [s, p, cf] = await Promise.all([
        PaymentSettingsService.getSettings(),
        PaymentsService.getPaymentById(paymentId),
        CustomFieldsService.getFieldsForModule('payments')
      ]);
      settings = s;
      payment = p;
      customFieldsList = cf;
    } catch (e) {
      console.error('Errore caricamento dettaglio incasso:', e);
      toast.error('Impossibile caricare il movimento di incasso');
    } finally {
      loading = false;
    }
  });

  async function handleDelete() {
    const confirmed = await confirmStore.prompt('Sei sicuro di voler eliminare questo movimento di incasso?');
    if (!confirmed) return;
    try {
      await PaymentsService.deletePayment(paymentId);
      toast.success('Incasso eliminato con successo');
      goto('/dashboard/payments');
    } catch (err: any) {
      toast.error('Errore durante l\'eliminazione: ' + err.message);
    }
  }

  function getStatusBadge(status: PaymentStatus) {
    switch (status) {
      case 'pagato': case 'registrato': 
        return { label: 'Registrato', class: 'badge-success' };
      case 'in_verifica': 
        return { label: 'In Verifica', class: 'badge-warning' };
      case 'annullato': case 'stornato': 
        return { label: 'Annullato', class: 'badge-danger' };
      default: 
        return { label: status, class: 'badge-neutral' };
    }
  }

  function formatDate(d: string) {
    if (!d) return 'N/D';
    try {
      const dt = new Date(d);
      return dt.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
      return d;
    }
  }

  function getMethodLabel(methodId?: string) {
    if (!methodId) return 'N/D';
    const found = (settings.paymentMethods || []).find(m => m.id === methodId);
    if (found) return found.label;
    switch (methodId) {
      case 'bonifico': return 'Bonifico Bancario';
      case 'contanti': return 'Contanti';
      case 'pos_carta': return 'POS / Carta';
      case 'assegno': return 'Assegno';
      case 'riba': return 'Ri.Ba.';
      case 'paypal_stripe': return 'PayPal / Stripe';
      default: return methodId;
    }
  }

  function printReceipt() {
    window.print();
  }
</script>

<svelte:head>
  <title>{payment ? `${labels.singular} ${payment.paymentNumber}` : labels.detailSingular} | {$projectStore?.projectName || 'ERP'}</title>
</svelte:head>

<div class="payment-detail-page animate-fade-in">
  <div class="page-top-nav no-print">
    <a href="/dashboard/payments" class="btn-back">
      <ArrowLeft size={16} /> Torna all'elenco {labels.plural}
    </a>
  </div>

  {#if loading}
    <div class="loader-box">Caricamento movimento in corso...</div>
  {:else if !payment}
    <div class="alert error-box"><AlertTriangle size={16} class="text-warning inline-mr" /> Movimento di incasso non trovato o eliminato.</div>
  {:else}
    {@const badge = getStatusBadge(payment.status)}

    <!-- HEADER DETAIL -->
    <header class="detail-header card">
      <div class="header-info">
        <div class="header-tag">{labels.numberLabel}: <strong>{payment.paymentNumber}</strong></div>
        <h1 class="page-title">€ {(payment.grossAmount || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}</h1>
        <p class="page-subtitle">
          <User size={15} /> Cliente: <strong>{payment.clientName}</strong>
        </p>
      </div>

      <div class="header-actions no-print">
        <a href="/dashboard/payments/{paymentId}/edit" class="btn btn-secondary">
          <Pencil size={16} /> Modifica
        </a>
        <button type="button" class="btn btn-secondary" onclick={printReceipt}>
          <Printer size={16} /> Stampa Ricevuta
        </button>
        <button type="button" class="btn btn-danger" onclick={handleDelete}>
          <Trash2 size={16} /> Elimina
        </button>
      </div>
    </header>

    <!-- GRID INFORMAZIONI -->
    <div class="info-grid">
      <!-- FINANCIAL BREAKDOWN -->
      <div class="card info-card">
        <h3 class="card-title">
          <Euro size={18} class="icon-accent" /> Riepilogo Finanziario & Scorporo IVA
        </h3>

        <div class="info-row">
          <span class="info-label">Imponibile Netto Aziendale</span>
          <strong class="info-val text-success">€ {(payment.netAmount || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}</strong>
        </div>

        <div class="info-row">
          <span class="info-label">Aliquota IVA Applicata</span>
          <span class="info-val">{payment.vatRate || 22}%</span>
        </div>

        <div class="info-row">
          <span class="info-label">Quota IVA Scorporata</span>
          <span class="info-val text-warning">€ {(payment.vatAmount || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}</span>
        </div>

        <div class="info-row highlight-row">
          <span class="info-label font-bold">Totale Lordo Incassato</span>
          <strong class="info-val font-bold text-primary">€ {(payment.grossAmount || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}</strong>
        </div>
      </div>

      <!-- TRANSACTION DETAILS -->
      <div class="card info-card">
        <h3 class="card-title">
          <CreditCard size={18} class="icon-accent" /> Dettagli Transazione & Metodo
        </h3>

        <div class="info-row">
          <span class="info-label">Stato Movimento</span>
          <span class="badge {badge.class}">{badge.label}</span>
        </div>

        <div class="info-row">
          <span class="info-label">Data Effettiva Incasso</span>
          <span class="info-val">{formatDate(payment.paymentDate)}</span>
        </div>

        <div class="info-row">
          <span class="info-label">Metodo di Pagamento</span>
          <span class="info-val">{getMethodLabel(payment.method)}</span>
        </div>

        <div class="info-row">
          <span class="info-label">Riferimento Transazione (CRO/TRN)</span>
          <span class="info-val font-mono">{payment.transactionReference || 'N/D'}</span>
        </div>

        {#if payment.notes}
          <div class="notes-box margin-top-12">
            <strong>Note Amministrative:</strong>
            <p>{payment.notes}</p>
          </div>
        {/if}
      </div>
    </div>

    <!-- ALLOCAZIONI CONTRATTUALI SE PRESENTI -->
    {#if payment.contractAllocations && payment.contractAllocations.length > 0}
      <Card title="Ripartizione Contrattuale (Bridge Rate)">
        {#snippet icon()}
          <Layers size={20} class="icon-accent" />
        {/snippet}

        <div class="table-wrapper">
          <table class="widescreen-table">
            <thead>
              <tr>
                <th>Contratto Associato</th>
                <th>Riferimento Rata</th>
                <th class="text-right">Importo Assegnato (€)</th>
              </tr>
            </thead>
            <tbody>
              {#each payment.contractAllocations as alloc}
                <tr>
                  <td>
                    <strong>{alloc.contractNumber || alloc.contractId}</strong>
                  </td>
                  <td>{alloc.installmentNumber ? `Rata #${alloc.installmentNumber}` : 'Quota Contratto'}</td>
                  <td class="text-right font-bold">€ {(Number(alloc.amount) || 0).toFixed(2)}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </Card>
    {/if}

    <!-- CUSTOM FIELDS -->
    {#if customFieldsList.length > 0 && payment.customFields}
      <div class="card info-card">
        <h3 class="card-title">Campi Personalizzati</h3>
        <CustomFieldsRenderer fields={customFieldsList} values={payment.customFields} readonly={true} />
      </div>
    {/if}
  {/if}
</div>

<style>
  .payment-detail-page { display: flex; flex-direction: column; gap: 20px; width: 100%; box-sizing: border-box; }


  .detail-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px; background: white; border: 1px solid var(--color-neutral-200); border-radius: 12px; padding: 24px; }
  .header-tag { font-size: 12px; font-weight: 700; color: var(--color-neutral-500); text-transform: uppercase; letter-spacing: 0.5px; }
  .page-title { margin: 4px 0 6px 0; font-size: 26px; font-weight: 800; color: var(--color-neutral-900); }
  .page-subtitle { margin: 0; font-size: 14px; color: var(--color-neutral-600); display: flex; align-items: center; gap: 6px; }

  .header-actions { display: flex; gap: 10px; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }

  .card { background: white; border: 1px solid var(--color-neutral-200); border-radius: 12px; padding: 20px; }
  .info-card { display: flex; flex-direction: column; gap: 10px; }
  .card-title { margin: 0 0 10px 0; font-size: 16px; font-weight: 700; color: var(--color-neutral-800); display: flex; align-items: center; gap: 8px; }

  .info-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--color-neutral-100); font-size: 13.5px; }
  .highlight-row { background: var(--color-neutral-50); padding: 12px; border-radius: 6px; border: none; margin-top: 6px; }
  .info-label { color: var(--color-neutral-600); }
  .font-mono { font-family: monospace; }
  .capitalize { text-transform: capitalize; }
  .notes-box { padding: 12px; background: var(--color-neutral-50); border-radius: 6px; font-size: 13px; }

  .table-wrapper { overflow-x: auto; width: 100%; }
  .widescreen-table { width: 100%; border-collapse: collapse; font-size: 13px; }
  .widescreen-table th { background: var(--color-neutral-50); padding: 10px 12px; text-align: left; font-weight: 600; color: var(--color-neutral-600); border-bottom: 1px solid var(--color-neutral-200); }
  .widescreen-table td { padding: 10px 12px; border-bottom: 1px solid var(--color-neutral-200); }

  .btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; text-decoration: none; border: none; }
  .btn-secondary { background: white; border: 1px solid var(--color-neutral-300); color: var(--color-neutral-700); }
  .btn-danger { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }
  .btn-danger:hover { background: #fee2e2; }

  .text-success { color: #16a34a; }
  .text-warning { color: #d97706; }
  .text-primary { color: #2563eb; }
  .text-right { text-align: right; }
  .font-bold { font-weight: 700; }
  .margin-top-12 { margin-top: 12px; }
  :global(.icon-accent) { color: var(--color-primary-600); }

  @media (max-width: 800px) {
    .info-grid { grid-template-columns: 1fr; }
  }

  @media print {
    .no-print { display: none !important; }
    .payment-detail-page { padding: 0; }
    .detail-header { box-shadow: none; border: none; padding: 0; }
  }
</style>
