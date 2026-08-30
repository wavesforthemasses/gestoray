<script lang="ts">
  import { FormField, Autocomplete } from '$lib';
  import { ShoppingBag, Plus, Trash2, Info } from '@lucide/svelte';
  import type { ContractProductItem } from '../schema';

  interface Props {
    productOptions: { id: string; label: string }[];
    items: ContractProductItem[];
    selectedProductId: string;
    itemTitle: string;
    itemDescription: string;
    itemQty: number;
    itemPriceSold: number | undefined;
    discountType: 'percent' | 'amount';
    discountValue: number;
    taxableAmount: number;
    discountAmount: number;
    grandTotalAmount: number;
    onProductSelectChange: (id: string) => void;
    onAddItem: () => void;
    onRemoveItem: (index: number) => void;
  }

  let {
    productOptions,
    items = $bindable([]),
    selectedProductId = $bindable(''),
    itemTitle = $bindable(''),
    itemDescription = $bindable(''),
    itemQty = $bindable(1),
    itemPriceSold = $bindable(undefined),
    discountType = $bindable('percent'),
    discountValue = $bindable(0),
    taxableAmount,
    discountAmount,
    grandTotalAmount,
    onProductSelectChange,
    onAddItem,
    onRemoveItem
  }: Props = $props();
</script>

<div class="form-section-card">
  <div class="section-card-header">
    <div class="header-icon-box">
      <ShoppingBag size={20} />
    </div>
    <div class="header-titles">
      <h3 class="card-title">Prodotti & Servizi in Offerta</h3>
      <p class="card-subtitle">Inserisci le voci di catalogo o servizi personalizzati e calcola il totale</p>
    </div>
  </div>

  <!-- Panel Inserimento Articolo -->
  <div class="add-item-card">
    <div class="form-group-row">
      <FormField id="selectedProduct" label="Seleziona da Catalogo" class="flex-1">
        <Autocomplete
          options={productOptions}
          bind:value={selectedProductId}
          onchange={onProductSelectChange}
          placeholder="Cerca prodotto o servizio..."
        />
      </FormField>

      <FormField id="itemTitle" label="Nome Servizio / Voce *" class="flex-1">
        <input type="text" id="itemTitle" bind:value={itemTitle} placeholder="Nome della voce o servizio..." />
      </FormField>
    </div>

    <FormField id="itemDescription" label="Descrizione Dettagliata" class="margin-top-12">
      <textarea id="itemDescription" bind:value={itemDescription} rows="2" placeholder="Specifiche tecniche, posa in opera..."></textarea>
    </FormField>

    <div class="item-action-row margin-top-12">
      <FormField id="itemQty" label="Quantità *" class="col-qty">
        <input type="number" id="itemQty" bind:value={itemQty} min="0.01" step="any" />
      </FormField>

      <FormField id="itemPriceSold" label="Prezzo Unitario (€) *" class="col-price">
        <input type="number" id="itemPriceSold" bind:value={itemPriceSold} min="0" step="any" placeholder="0.00" />
      </FormField>

      <button type="button" class="btn-add-item" onclick={onAddItem}>
        <Plus size={16} /> Aggiungi Voce
      </button>
    </div>
  </div>

  <!-- Tabella Articoli Inseriti -->
  {#if items.length > 0}
    <div class="table-container margin-top-16">
      <table class="items-table">
        <thead>
          <tr>
            <th>Voce / Servizio</th>
            <th>Descrizione</th>
            <th>Qtà</th>
            <th>Prezzo Unt.</th>
            <th class="text-right">Subtotale</th>
            <th class="text-center"></th>
          </tr>
        </thead>
        <tbody>
          {#each items as item, idx}
            <tr>
              <td><strong>{item.productName}</strong></td>
              <td class="cell-desc">{item.description || '-'}</td>
              <td>{item.quantity} {item.unit || ''}</td>
              <td>€ {(Number(item.priceSold) || 0).toFixed(2)}</td>
              <td class="text-right font-bold">
                € {(Number(item.subtotal) || 0).toFixed(2)}
                {#if item.minimoFatturabileText}
                  <div class="minimo-info-note"><Info size={12} /> {item.minimoFatturabileText}</div>
                {/if}
              </td>
              <td class="text-center">
                <button type="button" class="btn-icon-danger" onclick={() => onRemoveItem(idx)} title="Rimuovi voce">
                  <Trash2 size={15} />
                </button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {:else}
    <div class="empty-state-box">
      <ShoppingBag size={24} color="var(--color-neutral-400)" />
      <p>Nessun prodotto o servizio aggiunto. Cerca dal catalogo in alto per inserire le voci del documento.</p>
    </div>
  {/if}

  <!-- Box Totali Documento -->
  <div class="totals-summary-box">
    <div class="totals-row">
      <span class="totals-label">Imponibile Parziale:</span>
      <span class="totals-value">€ {(Number(taxableAmount) || 0).toFixed(2)}</span>
    </div>

    <div class="totals-row">
      <div class="discount-controls">
        <span class="totals-label">Sconto Documento:</span>
        <select bind:value={discountType} class="select-mini">
          <option value="percent">%</option>
          <option value="amount">€</option>
        </select>
        <input type="number" bind:value={discountValue} min="0" step="any" class="input-mini" placeholder="0" />
      </div>
      <span class="totals-value text-danger">- € {(Number(discountAmount) || 0).toFixed(2)}</span>
    </div>

    <div class="totals-row grand-total-row">
      <span class="grand-total-label">TOTALE COMPLESSIVO:</span>
      <span class="grand-total-value">€ {(Number(grandTotalAmount) || 0).toFixed(2)}</span>
    </div>
  </div>
</div>

<style>
  .form-section-card {
    background: var(--color-neutral-0);
    border: 1px solid var(--color-neutral-200);
    border-radius: var(--radius-xl);
    padding: 24px;
    margin-bottom: 24px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
    transition: all 0.2s ease-in-out;
  }

  .form-section-card:focus-within {
    border-color: var(--color-primary-400);
    box-shadow: 0 6px 20px rgba(37, 99, 235, 0.08);
  }

  .section-card-header {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-bottom: 20px;
    padding-bottom: 16px;
    border-bottom: 1px dashed var(--color-neutral-200);
  }

  .header-icon-box {
    width: 42px;
    height: 42px;
    border-radius: 12px;
    background: linear-gradient(135deg, var(--color-primary-50), #eff6ff);
    color: var(--color-primary-600);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    border: 1px solid rgba(37, 99, 235, 0.12);
  }

  .header-titles {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .card-title {
    font-size: 16px;
    font-weight: 700;
    color: var(--color-neutral-900);
    margin: 0;
    letter-spacing: -0.01em;
  }

  .card-subtitle {
    font-size: 13px;
    color: var(--color-neutral-500);
    margin: 0;
  }

  .add-item-card {
    background: var(--color-neutral-50);
    border: 1px solid var(--color-neutral-200);
    border-radius: var(--radius-lg);
    padding: 18px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .form-group-row {
    display: flex;
    gap: 16px;
  }

  .item-action-row {
    display: flex;
    align-items: flex-end;
    gap: 16px;
    flex-wrap: wrap;
  }

  .col-qty { width: 140px; }
  .col-price { width: 160px; }

  .btn-add-item {
    background: linear-gradient(135deg, var(--color-primary-600), var(--color-primary-700));
    color: var(--color-white);
    padding: 12px 20px;
    border: none;
    border-radius: var(--radius-md);
    font-family: inherit;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 46px;
    box-shadow: 0 2px 6px hsla(var(--brand-h), var(--brand-s), var(--brand-l), 0.2);
    transition: all 0.2s ease;
  }

  .btn-add-item:hover {
    opacity: 0.95;
    transform: translateY(-1px);
  }

  .table-container {
    overflow-x: auto;
    border: 1px solid var(--color-neutral-200);
    border-radius: var(--radius-lg);
  }

  .items-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }

  .items-table th {
    background: var(--color-neutral-50);
    padding: 12px 14px;
    text-align: left;
    font-weight: 700;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-neutral-600);
    border-bottom: 1px solid var(--color-neutral-200);
  }

  .items-table td {
    padding: 12px 14px;
    border-bottom: 1px solid var(--color-neutral-100);
    vertical-align: top;
  }

  .cell-desc {
    max-width: 260px;
    font-size: 12px;
    color: var(--color-neutral-500);
  }

  .minimo-info-note {
    font-size: 11px;
    color: #d97706;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 4px;
    justify-content: flex-end;
  }

  .btn-icon-danger {
    background: transparent;
    border: none;
    color: var(--color-error, #dc2626);
    cursor: pointer;
    padding: 6px;
    border-radius: var(--radius-md);
  }
  .btn-icon-danger:hover {
    background: #fee2e2;
  }

  .empty-state-box {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 28px;
    background: var(--color-neutral-50);
    border: 1px dashed var(--color-neutral-300);
    border-radius: var(--radius-lg);
    color: var(--color-neutral-500);
    font-size: 13px;
  }

  .empty-state-box p {
    margin: 0;
  }

  .totals-summary-box {
    background: var(--color-neutral-50);
    border: 1px solid var(--color-neutral-200);
    border-radius: var(--radius-lg);
    padding: 18px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    max-width: 380px;
    margin-left: auto;
  }

  .totals-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 13px;
    color: var(--color-neutral-700);
  }

  .discount-controls {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .select-mini, .input-mini {
    padding: 4px 8px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--color-neutral-300);
    font-size: 12px;
  }
  .input-mini { width: 65px; }

  .grand-total-row {
    border-top: 2px solid var(--color-neutral-300);
    padding-top: 12px;
    margin-top: 4px;
  }

  .grand-total-label {
    font-size: 14px;
    font-weight: 700;
    color: var(--color-neutral-900);
  }

  .grand-total-value {
    font-size: 18px;
    font-weight: 800;
    color: var(--color-primary-600);
  }

  .text-danger { color: #dc2626; }
  .text-right { text-align: right; }
  .text-center { text-align: center; }
  .font-bold { font-weight: 700; }
  .margin-top-12 { margin-top: 12px; }
  .margin-top-16 { margin-top: 16px; }

  @media (max-width: 768px) {
    .form-group-row {
      flex-direction: column;
      gap: 16px;
    }
    .col-qty, .col-price { width: 100%; }
    .totals-summary-box { max-width: 100%; }
  }
</style>
