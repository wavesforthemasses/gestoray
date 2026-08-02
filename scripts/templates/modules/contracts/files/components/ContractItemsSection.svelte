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

<div class="form-section-block">
  <div class="section-title-row">
    <ShoppingBag size={18} class="icon-accent" />
    <span class="section-title-text">Prodotti & Servizi in Offerta</span>
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
              <td>€ {item.priceSold?.toFixed(2)}</td>
              <td class="text-right font-bold">
                € {item.subtotal.toFixed(2)}
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
      <span class="totals-value">€ {taxableAmount.toFixed(2)}</span>
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
      <span class="totals-value text-danger">- € {discountAmount.toFixed(2)}</span>
    </div>

    <div class="totals-row grand-total-row">
      <span class="grand-total-label">TOTALE COMPLESSIVO:</span>
      <span class="grand-total-value">€ {grandTotalAmount.toFixed(2)}</span>
    </div>
  </div>
</div>

<style>
  .form-section-block {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding-bottom: 20px;
    border-bottom: 1px solid var(--color-neutral-200);
  }

  .section-title-row {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    font-weight: 700;
    color: var(--color-neutral-800);
    letter-spacing: 0.02em;
  }

  .add-item-card {
    background: var(--color-neutral-100);
    border: 1px solid var(--color-neutral-200);
    border-radius: var(--radius-md);
    padding: 16px;
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
    background: linear-gradient(135deg, var(--color-primary-500), var(--color-primary-600));
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
    transition: opacity var(--transition-fast);
  }

  .btn-add-item:hover {
    opacity: 0.9;
  }

  .table-container {
    overflow-x: auto;
    border: 1px solid var(--color-neutral-200);
    border-radius: var(--radius-md);
  }

  .items-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }

  .items-table th {
    background: var(--color-neutral-100);
    padding: 10px 14px;
    text-align: left;
    font-weight: 600;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-neutral-500);
    border-bottom: 1px solid var(--color-neutral-200);
  }

  .items-table td {
    padding: 10px 14px;
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
    padding: 4px;
    border-radius: 4px;
  }
  .btn-icon-danger:hover {
    background: #fee2e2;
  }

  .empty-state-box {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 24px;
    background: var(--color-neutral-100);
    border: 1px dashed var(--color-neutral-300);
    border-radius: var(--radius-md);
    color: var(--color-neutral-500);
    font-size: 13px;
  }

  .empty-state-box p {
    margin: 0;
  }

  .totals-summary-box {
    background: var(--color-neutral-100);
    border: 1px solid var(--color-neutral-200);
    border-radius: var(--radius-md);
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    max-width: 360px;
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
  .input-mini { width: 60px; }

  .grand-total-row {
    border-top: 2px solid var(--color-neutral-300);
    padding-top: 10px;
    margin-top: 4px;
  }

  .grand-total-label {
    font-size: 14px;
    font-weight: 700;
    color: var(--color-neutral-800);
  }

  .grand-total-value {
    font-size: 16px;
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
