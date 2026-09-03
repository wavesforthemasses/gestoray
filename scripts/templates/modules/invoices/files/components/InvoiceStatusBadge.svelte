<script lang="ts">
  import { 
    FileText, 
    Send, 
    CheckCircle2, 
    AlertTriangle, 
    XCircle, 
    Clock, 
    CreditCard,
    RotateCcw
  } from '@lucide/svelte';
  import type { InvoiceStatus, PaymentStatus } from '../schema';

  let { 
    status, 
    paymentStatus,
    showPayment = false 
  }: { 
    status?: InvoiceStatus; 
    paymentStatus?: PaymentStatus;
    showPayment?: boolean;
  } = $props();
</script>

{#if showPayment && paymentStatus}
  {#if paymentStatus === 'pagata_saldata'}
    <span class="badge badge-success">
      <CreditCard size={13} />
      <span>Saldata</span>
    </span>
  {:else if paymentStatus === 'pagata_parziale'}
    <span class="badge badge-warning">
      <Clock size={13} />
      <span>Acconto Parziale</span>
    </span>
  {:else}
    <span class="badge badge-danger">
      <Clock size={13} />
      <span>Da Incassare</span>
    </span>
  {/if}
{:else}
  {#if status === 'bozza'}
    <span class="badge badge-neutral">
      <FileText size={13} />
      <span>Bozza</span>
    </span>
  {:else if status === 'emessa'}
    <span class="badge badge-info">
      <CheckCircle2 size={13} />
      <span>Emessa</span>
    </span>
  {:else if status === 'inviata_sdi'}
    <span class="badge badge-primary">
      <Send size={13} />
      <span>Inviata SDI</span>
    </span>
  {:else if status === 'consegnata'}
    <span class="badge badge-success">
      <CheckCircle2 size={13} />
      <span>Consegnata</span>
    </span>
  {:else if status === 'mancata_consegna'}
    <span class="badge badge-warning">
      <AlertTriangle size={13} />
      <span>Cassetto Fiscale</span>
    </span>
  {:else if status === 'scartata'}
    <span class="badge badge-danger">
      <XCircle size={13} />
      <span>Scartata SDI</span>
    </span>
  {:else if status === 'annullata'}
    <span class="badge badge-muted">
      <RotateCcw size={13} />
      <span>Annullata/Stornata</span>
    </span>
  {:else}
    <span class="badge badge-neutral">
      <span>{status || 'N/D'}</span>
    </span>
  {/if}
{/if}

<style>
  .badge {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.2rem 0.6rem;
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 600;
    line-height: 1;
    white-space: nowrap;
  }

  .badge-neutral {
    background: #f1f5f9;
    color: #475569;
    border: 1px solid #cbd5e1;
  }

  .badge-info {
    background: #e0f2fe;
    color: #0369a1;
    border: 1px solid #bae6fd;
  }

  .badge-primary {
    background: #eff6ff;
    color: #1d4ed8;
    border: 1px solid #bfdbfe;
  }

  .badge-success {
    background: #dcfce7;
    color: #15803d;
    border: 1px solid #bbf7d0;
  }

  .badge-warning {
    background: #fef3c7;
    color: #b45309;
    border: 1px solid #fde68a;
  }

  .badge-danger {
    background: #fee2e2;
    color: #b91c1c;
    border: 1px solid #fecaca;
  }

  .badge-muted {
    background: #f8fafc;
    color: #94a3b8;
    border: 1px solid #e2e8f0;
    text-decoration: line-through;
  }
</style>
