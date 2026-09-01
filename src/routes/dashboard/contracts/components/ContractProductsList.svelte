<script lang="ts">
  import { Card, Button, FormField, Autocomplete, type AutocompleteOption } from '$lib';
  import { UnitsOfMeasureService } from '$lib/services/unitsOfMeasureService';
  import { FileText, Trash2, ShieldAlert } from '@lucide/svelte';

  interface Props {
    contract: any;
    productsList: any[];
    usersList: any[];
    isEditingProducts: boolean;
    editSelectedProductId: string;
    editItemPriceSold: number | null;
    editItemQuantity: number;
    editQuoteItems: any[];
    editQuoteTotal: number;
    editSecondVendorUid: string;
    editSecondVendorShare: number;
    submitting: boolean;
    startEditingProducts: () => void;
    handleEditProductSelectChange: (val: string) => void;
    handleAddEditQuoteItem: () => void;
    handleRemoveEditQuoteItem: (idx: number) => void;
    cancelEditingProducts: () => void;
    saveEditedProducts: () => void;
  }

  let {
    contract,
    productsList,
    usersList,
    isEditingProducts = $bindable(),
    editSelectedProductId = $bindable(),
    editItemPriceSold = $bindable(),
    editItemQuantity = $bindable(),
    editQuoteItems = $bindable(),
    editQuoteTotal = $bindable(),
    editSecondVendorUid = $bindable(),
    editSecondVendorShare = $bindable(),
    submitting,
    startEditingProducts,
    handleEditProductSelectChange,
    handleAddEditQuoteItem,
    handleRemoveEditQuoteItem,
    cancelEditingProducts,
    saveEditedProducts
  }: Props = $props();

  let productOptions = $derived<AutocompleteOption[]>(
    productsList.map(p => ({
      id: p.id,
      label: p.name,
      sublabel: `Listino: €${(Number(p.listPrice) || 0).toFixed(2)}${p.sku ? ' • ' + p.sku : ''}`
    }))
  );

  let vendorOptions = $derived<AutocompleteOption[]>([
    { id: '', label: 'Nessuno (100% provvigione)' },
    ...usersList
      .filter(u => u.uid !== contract.original?.vendorUid)
      .map(u => ({
        id: u.uid,
        label: `${u.nome || ''} ${u.cognome || ''}`.trim() || u.email,
        sublabel: u.email
      }))
  ]);
</script>

<Card title="Articoli e Servizi Inclusi" description="Dettaglio analitico delle licenze e dei prodotti inseriti in sede di quotazione.">
  {#snippet icon()}
    <FileText size={20} class="icon-accent" />
  {/snippet}
  
  {#snippet headerSnippet()}
    {#if contract.original?.status !== 'approved'}
      <button class="edit-products-btn" onclick={startEditingProducts} disabled={isEditingProducts}>
        Modifica Servizi
      </button>
    {/if}
  {/snippet}

  {#if isEditingProducts}
    <!-- In-place Editor -->
    <div class="inline-editor-pane editor-pane-styled">
      <div class="form-grid-columns grid-two-cols">
        <FormField id="e-product" label="SELEZIONA PRODOTTO">
          <Autocomplete 
            options={productOptions} 
            bind:value={editSelectedProductId} 
            onchange={(id) => handleEditProductSelectChange(id)} 
            placeholder="Cerca prodotto a catalogo..." 
          />
        </FormField>

        <div class="flex-gap-12">
          <div class="flex-2">
            <FormField id="e-price" label="PREZZO VENDUTO (€)">
              <input type="number" id="e-price" bind:value={editItemPriceSold} step="0.01" />
            </FormField>
          </div>
          <div class="flex-1">
            <FormField id="e-qty" label="Q.TÀ">
              <input
                type="number"
                id="e-qty"
                bind:value={editItemQuantity}
                min="0"
                step={editSelectedProductId ? UnitsOfMeasureService.getStepForUnit(productsList.find((p) => p.id === editSelectedProductId)?.unit) : '1'}
              />
            </FormField>
          </div>
        </div>
      </div>

      <Button 
        class="insert-btn"
        disabled={!editSelectedProductId || editItemPriceSold === null || editItemQuantity <= 0}
        onclick={handleAddEditQuoteItem}
      >
        Inserisci Articolo
      </Button>

      <h4 class="quote-title">Articoli nel Preventivo</h4>
      {#if editQuoteItems.length === 0}
        <div class="empty-items-placeholder">Il preventivo è vuoto.</div>
      {:else}
        <table class="widescreen-table quote-table">
          <thead>
            <tr>
              <th>Prodotto</th>
              <th>P. Listino</th>
              <th>P. Venduto</th>
              <th>Q.tà</th>
              <th>Totale</th>
              <th>Azioni</th>
            </tr>
          </thead>
          <tbody>
            {#each editQuoteItems as item, index}
              <tr>
                <td>{item.name}</td>
                <td>€ {(Number(item.listPrice) || 0).toFixed(2)}</td>
                <td>
                  <div class="price-input-wrapper">
                    € <input type="number" bind:value={item.priceSold} step="0.01" class="small-input price-input" />
                  </div>
                </td>
                <td>
                  <input type="number" bind:value={item.quantity} min="1" step="1" class="small-input qty-input" />
                </td>
                <td><strong>€ {(Number(item.priceSold * item.quantity) || 0).toFixed(2)}</strong></td>
                <td>
                  <button onclick={() => handleRemoveEditQuoteItem(index)} class="remove-item-btn danger-icon-btn">
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>

        <div class="co-selling-config-panel co-selling-container">
          <h4 class="co-selling-title">Ripartizione Co-Selling (Opzionale)</h4>
          <p class="co-selling-desc">Se questa vendita è stata conclusa in collaborazione con un altro commerciale, selezionalo qui sotto per ripartire le provvigioni.</p>
          <div class="form-grid-columns">
            <FormField id="e-second-vendor" label="Secondo Commerciale">
              <Autocomplete 
                options={vendorOptions} 
                bind:value={editSecondVendorUid} 
                placeholder="Seleziona secondo commerciale..." 
              />
            </FormField>
            {#if editSecondVendorUid}
              <FormField id="e-second-share" label="Quota Co-Seller (%)">
                <input type="number" id="e-second-share" bind:value={editSecondVendorShare} min="1" max="99" step="1" required />
              </FormField>
            {/if}
          </div>
        </div>

        <div class="total-footer">
          <div class="total-label">
            Totale: <span class="total-amount">€ {(Number(editQuoteTotal) || 0).toFixed(2)}</span>
          </div>
          <div class="flex-gap-12">
            <button onclick={cancelEditingProducts} class="cancel-btn footer-cancel-btn">Annulla</button>
            <Button onclick={saveEditedProducts} disabled={submitting}>Salva Modifiche</Button>
          </div>
        </div>
      {/if}
    </div>
  {:else}
    <div class="table-wrapper">
      <table class="widescreen-table">
        <thead>
          <tr>
            <th>Prodotto</th>
            <th>P. Listino (€)</th>
            <th>P. Minimo (€)</th>
            <th>P. Venduto (€)</th>
            <th>Qtà</th>
            <th>Totale (€)</th>
            <th>Delta (€) / Note</th>
          </tr>
        </thead>
        <tbody>
          {#each contract.original?.products || [] as p}
            {@const isBelowMin = (Number(p.priceSold) || 0) < (Number(p.minPrice) || 0)}
            {@const gap = (Number(p.priceSold) || 0) - (Number(p.listPrice) || 0)}
            <tr class:row-warning={isBelowMin}>
              <td>
                <div class="prod-cell">
                  <span class="prod-name">{p.name}</span>
                  {#if isBelowMin}
                    <span class="warning-badge-inline"><ShieldAlert size={10} /> Prezzo Sotto Soglia</span>
                  {/if}
                </div>
              </td>
              <td>€ {(Number(p.listPrice) || 0).toFixed(2)}</td>
              <td>€ {(Number(p.minPrice) || 0).toFixed(2)}</td>
              <td>
                <strong class:text-warning={isBelowMin}>
                  € {(Number(p.priceSold) || 0).toFixed(2)}
                </strong>
              </td>
              <td>{p.quantity}</td>
              <td><strong>€ {(Number(p.priceSold * p.quantity) || 0).toFixed(2)}</strong></td>
              <td>
                {#if gap === 0}
                  <span class="gap-neutral">Listino Pieno</span>
                {:else if gap > 0}
                  <span class="gap-positive">+€ {(Number(gap) || 0).toFixed(2)}</span>
                {:else}
                  <span class="gap-negative" class:heavy-discount={isBelowMin}>
                    -€ {(Number(Math.abs(gap)) || 0).toFixed(2)} ({((Math.abs(gap) / (Number(p.listPrice) || 1)) * 100).toFixed(0)}% sconto)
                  </span>
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</Card>

<style>
  .edit-products-btn {
    background: var(--color-white);
    border: 1px solid var(--color-neutral-300);
    padding: 6px 12px;
    border-radius: var(--radius-md);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all var(--transition-fast);
  }
  .edit-products-btn:hover:not(:disabled) {
    background: var(--color-neutral-100);
    border-color: var(--color-neutral-400);
  }
  .edit-products-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .prod-cell {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .prod-name {
    font-weight: 600;
  }
  .warning-badge-inline {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: var(--color-warning-light);
    color: var(--color-warning-text);
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 10px;
    font-weight: 700;
  }
  .row-warning td {
    background-color: var(--color-warning-light) !important;
  }
  .text-warning {
    color: var(--color-error);
  }
  .gap-neutral {
    color: var(--color-neutral-500);
    font-size: 12px;
  }
  .gap-positive {
    color: var(--color-success-text);
    font-weight: 700;
    font-size: 13px;
  }
  .gap-negative {
    color: var(--color-error-text);
    font-weight: 600;
    font-size: 13px;
  }
  .gap-negative.heavy-discount {
    color: var(--color-error);
    font-weight: 800;
  }
  :global(.insert-btn) {
    margin-top: 16px;
    margin-bottom: 24px;
  }

  .editor-pane-styled {
    background: var(--color-neutral-50);
    padding: 20px;
    border-radius: var(--radius-md);
    border: 1px solid var(--color-neutral-200);
  }

  .grid-two-cols {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
  }

  .flex-gap-12 {
    display: flex;
    gap: 12px;
  }

  .flex-2 {
    flex: 2;
  }

  .flex-1 {
    flex: 1;
  }

  .quote-title {
    margin-bottom: 12px;
    font-size: 14px;
    font-weight: 700;
  }

  .quote-table {
    background: var(--color-white);
    margin-bottom: 24px;
  }

  .price-input-wrapper {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .small-input {
    padding: 4px;
    border: 1px solid var(--color-neutral-300);
    border-radius: 4px;
  }

  .price-input {
    width: 80px;
  }

  .qty-input {
    width: 60px;
  }

  .danger-icon-btn {
    color: var(--color-error);
    background: transparent;
    border: none;
    cursor: pointer;
  }

  .co-selling-panel-styled {
    margin-top: 20px;
    padding-top: 20px;
    border-top: 1px solid var(--color-neutral-200);
  }

  .co-selling-title {
    font-size: 13.5px;
    font-weight: 600;
    margin-bottom: 8px;
  }

  .total-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 20px;
    padding-top: 16px;
    border-top: 1px solid var(--color-neutral-200);
  }

  .total-label {
    font-size: 16px;
    font-weight: 700;
  }

  .total-amount {
    color: var(--color-primary-600);
  }

  .footer-cancel-btn {
    padding: 8px 16px;
    border-radius: 6px;
    border: 1px solid var(--color-neutral-300);
    background: var(--color-white);
    cursor: pointer;
  }
</style>
