<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { fade, scale } from 'svelte/transition';
  import { WarehouseService } from '../../warehouse.service';
  import type { PurchaseOrderItem, PurchaseOrderItemLine } from '../../schema';
  import { toast } from '$lib/stores/toast.svelte';
  import { confirmStore } from '$lib/stores/confirm.svelte';
  import { authState } from '$lib/auth.svelte';
  import { 
    Truck, 
    List, 
    CheckCircle2, 
    Clock, 
    AlertCircle, 
    Package, 
    RefreshCw, 
    Building2, 
    Boxes, 
    ArrowDownLeft, 
    Calendar,
    Send,
    XCircle,
    Trash2,
    X
  } from '@lucide/svelte';

  let orderId = $derived($page.params.id);
  let order = $state<PurchaseOrderItem | null>(null);
  let loading = $state(true);

  // Receive goods modal
  let showReceiveModal = $state(false);
  let receiveLines = $state<Array<{ productId: string; name: string; sku: string; unit: string; remainingQty: number; qtyToReceive: number; batchNumber: string; expiryDate: string }>>([]);
  let receivePlaceId = $state('default');
  let receivePlaceName = $state('Magazzino Centrale');
  let receiveNotes = $state('');
  let isReceiving = $state(false);

  onMount(async () => {
    if (orderId) {
      await loadOrder();
    }
  });

  async function loadOrder() {
    if (!orderId) return;
    loading = true;
    try {
      order = await WarehouseService.getPurchaseOrderById(orderId);
    } catch (err) {
      console.error('Errore caricamento ordine:', err);
      toast.error('Ordine non trovato');
    } finally {
      loading = false;
    }
  }

  function openReceiveModal() {
    if (!order) return;
    receiveLines = (order.items || []).map(item => {
      const remaining = Math.max(0, (item.orderedQty || 0) - (item.receivedQty || 0));
      return {
        productId: item.productId,
        name: item.productName,
        sku: item.sku,
        unit: item.unit || 'pz',
        remainingQty: remaining,
        qtyToReceive: remaining, // Pre-fill with remaining
        batchNumber: '',
        expiryDate: ''
      };
    });
    receivePlaceId = order.destinationPlaceId || 'default';
    receivePlaceName = order.destinationPlaceName || 'Magazzino Centrale';
    receiveNotes = '';
    showReceiveModal = true;
  }

  async function handleConfirmReceive() {
    if (!order) return;
    const linesToProcess = receiveLines.filter(l => l.qtyToReceive > 0);
    if (linesToProcess.length === 0) {
      toast.error('Inserisci una quantità ricevuta maggiore di 0 per almeno un articolo');
      return;
    }

    isReceiving = true;
    try {
      await WarehouseService.receiveOrderItems(
        order.id,
        linesToProcess.map(l => ({
          productId: l.productId,
          receivedQtyDelta: l.qtyToReceive,
          batchNumber: l.batchNumber,
          expiryDate: l.expiryDate
        })),
        receivePlaceId,
        receivePlaceName,
        authState.user?.uid || 'system',
        authState.user?.displayName || authState.user?.email || 'Operatore',
        receiveNotes
      );

      toast.success('Merci ricevute e caricate a magazzino con successo');
      showReceiveModal = false;
      await loadOrder();
    } catch (err: any) {
      console.error('Errore ricezione merci:', err);
      toast.error(err.message || 'Errore durante la ricezione merci');
    } finally {
      isReceiving = false;
    }
  }

  async function handleMarkAsSent() {
    if (!order) return;
    try {
      await WarehouseService.updatePurchaseOrder(order.id, { status: 'inviato' });
      toast.success('Stato ordine aggiornato a "Inviato"');
      await loadOrder();
    } catch (err: any) {
      toast.error('Errore: ' + err.message);
    }
  }

  async function handleCancelOrder() {
    if (!order) return;
    const confirmed = await confirmStore.prompt('Sei sicuro di voler annullare questo ordine di acquisto?');
    if (!confirmed) return;
    try {
      await WarehouseService.updatePurchaseOrder(order.id, { status: 'annullato' });
      toast.success('Ordine annullato');
      await loadOrder();
    } catch (err: any) {
      toast.error('Errore: ' + err.message);
    }
  }

  async function handleDelete() {
    if (!order) return;
    const confirmed = await confirmStore.prompt('Sei sicuro di voler eliminare definitivamente questo ordine?');
    if (!confirmed) return;
    try {
      await WarehouseService.deletePurchaseOrder(order.id);
      toast.success('Ordine eliminato');
      goto('/dashboard/warehouse/orders');
    } catch (err: any) {
      toast.error('Errore eliminazione: ' + err.message);
    }
  }
</script>

<svelte:head>
  <title>{order ? order.poNumber : 'Dettaglio Ordine'} - Gestoray</title>
</svelte:head>

<div class="order-detail-page">
  <!-- Page Top Actions Bar -->
  <div class="page-top-actions">
    <div class="header-left">
      <div class="title-row">
        <div class="icon-bubble">
          <Truck size={24} class="text-primary-600" />
        </div>
        <div>
          <h1 class="page-title">{order ? order.poNumber : 'Dettaglio Ordine'}</h1>
          <p class="page-subtitle">Fornitore: <strong>{order?.supplierName || '...'}</strong></p>
        </div>
      </div>
    </div>

    <div class="header-right">
      <a href="/dashboard/warehouse/orders" class="btn-module-list">
        <List size={16} />
        <span>Elenco Ordini</span>
      </a>

      {#if order && order.status !== 'ricevuto_totale' && order.status !== 'annullato'}
        <button type="button" class="btn-receive" onclick={openReceiveModal}>
          <ArrowDownLeft size={16} />
          <span>Ricevi Merci (DDT)</span>
        </button>
      {/if}
    </div>
  </div>

  {#if loading}
    <div class="loading-card">
      <RefreshCw size={28} class="animate-spin text-primary-500" />
      <p>Caricamento ordine in corso...</p>
    </div>
  {:else if !order}
    <div class="empty-state">
      <p>Ordine non trovato o eliminato.</p>
      <a href="/dashboard/warehouse/orders" class="btn-secondary">Torna agli ordini</a>
    </div>
  {:else}
    <!-- Status & Info Card -->
    <div class="info-card">
      <div class="info-grid">
        <div class="info-item">
          <span class="label">Stato Ordine</span>
          <span class="status-badge status-{order.status}">
            {order.status.toUpperCase()}
          </span>
        </div>

        <div class="info-item">
          <span class="label">Data Emissione</span>
          <span class="val font-semibold">
            {order.orderDate ? new Date(order.orderDate).toLocaleDateString('it-IT') : 'N/D'}
          </span>
        </div>

        <div class="info-item">
          <span class="label">Prevista Consegna</span>
          <span class="val">
            {order.expectedDeliveryDate ? new Date(order.expectedDeliveryDate).toLocaleDateString('it-IT') : 'Non specificata'}
          </span>
        </div>

        <div class="info-item">
          <span class="label">Destinazione Merce</span>
          <span class="val font-medium">{order.destinationPlaceName || 'Magazzino Centrale'}</span>
        </div>
      </div>

      {#if order.status === 'bozza'}
        <div class="quick-status-bar">
          <span>L'ordine è attualmente in stato <strong>Bozza</strong>. Quando inviato al fornitore, contrassegnalo per tenere traccia dei tempi di consegna:</span>
          <button type="button" class="btn-action-status" onclick={handleMarkAsSent}>
            <Send size={14} />
            <span>Segna come Inviato</span>
          </button>
        </div>
      {/if}
    </div>

    <!-- Items Table Card -->
    <div class="table-card">
      <div class="card-header">
        <h3 class="card-title">Righe Articoli ({order.items?.length || 0})</h3>
      </div>

      <div class="table-responsive">
        <table class="detail-table">
          <thead>
            <tr>
              <th>Articolo / SKU</th>
              <th class="text-right">Q.tà Ordinata</th>
              <th class="text-right">Q.tà Ricevuta</th>
              <th class="text-right">Rimanente</th>
              <th class="text-right">Prezzo Unit.</th>
              <th class="text-right">IVA %</th>
              <th class="text-right">Totale Netto</th>
              <th class="text-right">Totale Lordo</th>
            </tr>
          </thead>
          <tbody>
            {#each order.items as item}
              {@const remaining = Math.max(0, (item.orderedQty || 0) - (item.receivedQty || 0))}
              <tr>
                <td>
                  <div class="item-cell">
                    <span class="prod-name font-semibold text-slate-900">{item.productName}</span>
                    <span class="prod-sku text-xs text-slate-400">SKU: {item.sku || 'N/D'}</span>
                  </div>
                </td>
                <td class="text-right font-medium">
                  {item.orderedQty} <span class="unit-text">{item.unit || 'pz'}</span>
                </td>
                <td class="text-right font-bold {item.receivedQty >= item.orderedQty ? 'text-emerald-600' : 'text-slate-700'}">
                  {item.receivedQty || 0} <span class="unit-text">{item.unit || 'pz'}</span>
                </td>
                <td class="text-right font-medium {remaining > 0 ? 'text-amber-600' : 'text-slate-400'}">
                  {remaining} <span class="unit-text">{item.unit || 'pz'}</span>
                </td>
                <td class="text-right">
                  € {(item.unitPrice || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td class="text-right">{item.vatRate || 22}%</td>
                <td class="text-right font-medium">
                  € {(item.subtotalNet || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td class="text-right font-bold text-slate-900">
                  € {(item.subtotalGross || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

      <!-- Financial Totals Summary -->
      <div class="totals-bar">
        <div class="totals-col">
          <div class="total-line">
            <span>Totale Imponibile Netto:</span>
            <strong>€ {(order.totalNetAmount || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
          </div>
          <div class="total-line">
            <span>Totale IVA:</span>
            <strong>€ {(order.totalVatAmount || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
          </div>
          <div class="total-line grand-total-line">
            <span>Totale Lordo Ordine:</span>
            <strong class="text-primary-600 text-lg">€ {(order.totalGrossAmount || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
          </div>
        </div>
      </div>
    </div>

    <!-- Bottom Actions -->
    <div class="bottom-actions-row">
      {#if order.status === 'bozza'}
        <button type="button" class="btn-danger" onclick={handleDelete}>
          <Trash2 size={16} />
          <span>Elimina Bozza Ordine</span>
        </button>
      {:else if order.status !== 'annullato' && order.status !== 'ricevuto_totale'}
        <button type="button" class="btn-cancel-po" onclick={handleCancelOrder}>
          <XCircle size={16} />
          <span>Annulla Ordine</span>
        </button>
      {/if}
    </div>
  {/if}
</div>

<!-- Modal Wizard: Ricezione Merci DDT -->
{#if showReceiveModal && order}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="modal-overlay" transition:fade={{ duration: 150 }} onclick={() => showReceiveModal = false}>
    <div class="modal-content modal-large" transition:scale={{ duration: 200, start: 0.95 }} onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <div class="modal-title">
          <ArrowDownLeft size={20} class="text-emerald-600" />
          <span>Ricezione Merci / DDT: {order.poNumber}</span>
        </div>
        <button class="close-btn" onclick={() => showReceiveModal = false}>
          <X size={18} />
        </button>
      </div>

      <div class="modal-body">
        <p class="modal-instruction">
          Inserisci le quantità fisiche effettivamente consegnate dal fornitore. Le scorte a magazzino e il CMP verranno ricalcolati automaticamente.
        </p>

        <div class="table-responsive">
          <table class="receive-table">
            <thead>
              <tr>
                <th>Articolo</th>
                <th class="text-right">Rimanente</th>
                <th class="text-right" style="width: 120px;">Q.tà Ricevuta</th>
                <th style="width: 140px;">Lotto (Opz.)</th>
              </tr>
            </thead>
            <tbody>
              {#each receiveLines as line}
                <tr>
                  <td>
                    <span class="font-medium text-slate-800">{line.name}</span>
                  </td>
                  <td class="text-right text-slate-500">
                    {line.remainingQty} {line.unit}
                  </td>
                  <td>
                    <input 
                      type="number" 
                      bind:value={line.qtyToReceive} 
                      min="0" 
                      max={line.remainingQty * 2} 
                      step="any"
                      class="form-input text-right" 
                    />
                  </td>
                  <td>
                    <input 
                      type="text" 
                      bind:value={line.batchNumber} 
                      placeholder="Es. LOT-99" 
                      class="form-input text-xs" 
                    />
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>

        <div class="form-group mt-3">
          <label for="receive-notes">Note di Ricezione / Riferimento DDT Fornitore</label>
          <input 
            type="text" 
            id="receive-notes" 
            bind:value={receiveNotes} 
            placeholder="Es. DDT n. 452 del 30/08/2026"
            class="form-input" 
          />
        </div>

        <div class="modal-actions">
          <button type="button" class="btn-secondary" onclick={() => showReceiveModal = false}>
            Annulla
          </button>
          <button type="button" class="btn-primary" disabled={isReceiving} onclick={handleConfirmReceive}>
            {#if isReceiving}
              <RefreshCw size={15} class="animate-spin" />
              <span>Registrazione Carico...</span>
            {:else}
              <CheckCircle2 size={15} />
              <span>Conferma Carico a Magazzino</span>
            {/if}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .order-detail-page {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .page-top-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 1rem;
  }

  .header-left .title-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .icon-bubble {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    background: var(--color-primary-50, #eff6ff);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .page-title {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--color-slate-900, #0f172a);
    margin: 0;
  }

  .page-subtitle {
    font-size: 0.875rem;
    color: var(--color-slate-500, #64748b);
    margin: 0.125rem 0 0 0;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .btn-module-list {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.5rem 0.875rem;
    border-radius: 8px;
    border: 1px solid var(--color-slate-300, #cbd5e1);
    background: #ffffff;
    color: var(--color-slate-700, #334155);
    font-size: 0.875rem;
    font-weight: 500;
    text-decoration: none;
  }

  .btn-receive {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: var(--color-emerald-600, #059669);
    color: #ffffff;
    border-radius: 8px;
    font-weight: 600;
    font-size: 0.875rem;
    border: none;
    cursor: pointer;
  }

  .btn-receive:hover {
    background: var(--color-emerald-700, #047857);
  }

  .info-card {
    background: #ffffff;
    border-radius: 12px;
    border: 1px solid var(--color-slate-200, #e2e8f0);
    padding: 1.5rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .info-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1.25rem;
  }

  .info-item {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .info-item .label {
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--color-slate-400, #94a3b8);
  }

  .status-badge {
    display: inline-flex;
    padding: 0.25rem 0.625rem;
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 700;
    width: fit-content;
  }

  .status-bozza { background: #f1f5f9; color: #475569; }
  .status-inviato { background: #eff6ff; color: #2563eb; }
  .status-ricevuto_parziale { background: #fffbeb; color: #b45309; }
  .status-ricevuto_totale { background: #ecfdf5; color: #047857; }
  .status-annullato { background: #fff1f2; color: #e11d48; }

  .quick-status-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    background: var(--color-slate-50, #f8fafc);
    border-radius: 8px;
    border: 1px solid var(--color-slate-200, #e2e8f0);
    font-size: 0.875rem;
  }

  .btn-action-status {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.375rem 0.75rem;
    background: var(--color-primary-600, #2563eb);
    color: #ffffff;
    border-radius: 6px;
    font-size: 0.8125rem;
    font-weight: 600;
    border: none;
    cursor: pointer;
  }

  .table-card {
    background: #ffffff;
    border-radius: 12px;
    border: 1px solid var(--color-slate-200, #e2e8f0);
    overflow: hidden;
  }

  .card-header {
    padding: 1rem 1.25rem;
    border-bottom: 1px solid var(--color-slate-200, #e2e8f0);
  }

  .card-title {
    font-size: 1rem;
    font-weight: 600;
    color: var(--color-slate-800, #1e293b);
    margin: 0;
  }

  .table-responsive {
    width: 100%;
    overflow-x: auto;
  }

  .detail-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;
  }

  .detail-table th {
    background: var(--color-slate-50, #f8fafc);
    padding: 0.75rem 1rem;
    font-weight: 600;
    color: var(--color-slate-600, #475569);
    border-bottom: 1px solid var(--color-slate-200, #e2e8f0);
    text-align: left;
  }

  .detail-table td {
    padding: 0.875rem 1rem;
    border-bottom: 1px solid var(--color-slate-100, #f1f5f9);
    color: var(--color-slate-700, #334155);
  }

  .item-cell {
    display: flex;
    flex-direction: column;
  }

  .unit-text {
    font-size: 0.75rem;
    color: var(--color-slate-400, #94a3b8);
  }

  .totals-bar {
    padding: 1.25rem;
    background: var(--color-slate-50, #f8fafc);
    display: flex;
    justify-content: flex-end;
    border-top: 1px solid var(--color-slate-200, #e2e8f0);
  }

  .totals-col {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    min-width: 280px;
  }

  .total-line {
    display: flex;
    justify-content: space-between;
    font-size: 0.875rem;
    color: var(--color-slate-600, #475569);
  }

  .grand-total-line {
    border-top: 1px solid var(--color-slate-200, #e2e8f0);
    padding-top: 0.5rem;
    font-size: 1rem;
  }

  .bottom-actions-row {
    display: flex;
    justify-content: flex-end;
  }

  .btn-danger {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.5rem 1rem;
    background: #fff1f2;
    color: #e11d48;
    border: 1px solid #fecdd3;
    border-radius: 8px;
    font-size: 0.875rem;
    cursor: pointer;
  }

  .btn-cancel-po {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.5rem 1rem;
    background: #fff7ed;
    color: #c2410c;
    border: 1px solid #ffedd5;
    border-radius: 8px;
    font-size: 0.875rem;
    cursor: pointer;
  }

  /* Modal Overlay Styles */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.6);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 999;
    padding: 1rem;
  }

  .modal-content {
    background: #ffffff;
    border-radius: 12px;
    width: 100%;
    max-width: 680px;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
    overflow: hidden;
  }

  .modal-header {
    padding: 1.25rem 1.5rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid var(--color-slate-100, #f1f5f9);
  }

  .modal-title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 1rem;
    font-weight: 600;
    color: var(--color-slate-900, #0f172a);
  }

  .close-btn {
    background: transparent;
    border: none;
    color: var(--color-slate-400, #94a3b8);
    cursor: pointer;
    padding: 0.25rem;
    border-radius: 6px;
  }

  .modal-body {
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .modal-instruction {
    font-size: 0.875rem;
    color: var(--color-slate-600, #475569);
    margin: 0;
  }

  .receive-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;
  }

  .receive-table th {
    background: var(--color-slate-50, #f8fafc);
    padding: 0.5rem 0.75rem;
    border-bottom: 1px solid var(--color-slate-200, #e2e8f0);
    text-align: left;
  }

  .receive-table td {
    padding: 0.5rem 0.75rem;
    border-bottom: 1px solid var(--color-slate-100, #f1f5f9);
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .form-group label {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--color-slate-700, #334155);
  }

  .form-input {
    width: 100%;
    padding: 0.5rem 0.75rem;
    border-radius: 6px;
    border: 1px solid var(--color-slate-300, #cbd5e1);
    font-size: 0.875rem;
  }

  .modal-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.75rem;
    margin-top: 1rem;
    border-top: 1px solid var(--color-slate-100, #f1f5f9);
    padding-top: 1rem;
  }

  .btn-primary {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: var(--color-primary-600, #2563eb);
    color: #ffffff;
    border-radius: 8px;
    font-weight: 600;
    font-size: 0.875rem;
    border: none;
    cursor: pointer;
  }

  .btn-secondary {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: #ffffff;
    color: var(--color-slate-700, #334155);
    border-radius: 8px;
    font-weight: 500;
    font-size: 0.875rem;
    border: 1px solid var(--color-slate-300, #cbd5e1);
    text-decoration: none;
  }

  .loading-card, .empty-state {
    background: #ffffff;
    border-radius: 12px;
    border: 1px solid var(--color-slate-200, #e2e8f0);
    padding: 4rem 2rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    text-align: center;
    color: var(--color-slate-500, #64748b);
  }

  .text-right { text-align: right; }
  .mt-3 { margin-top: 0.75rem; }
</style>
