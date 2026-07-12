<script lang="ts">
  import { Card, Button, FormField } from '$lib';
  import { FileText, Trash2, ShieldAlert } from 'lucide-svelte';

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
    <div class="inline-editor-pane" style="background: var(--color-neutral-50); padding: 20px; border-radius: var(--radius-md); border: 1px solid var(--color-neutral-200);">
      <div class="form-grid-columns" style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
        <FormField id="e-product" label="SELEZIONA PRODOTTO">
          <select id="e-product" bind:value={editSelectedProductId} onchange={(e) => handleEditProductSelectChange(e.currentTarget.value)}>
            <option value="">-- Seleziona Prodotto --</option>
            {#each productsList as p}
              <option value={p.id}>{p.name} (Listino: €{p.listPrice.toFixed(2)})</option>
            {/each}
          </select>
        </FormField>

        <div style="display: flex; gap: 12px;">
          <div style="flex: 2;">
            <FormField id="e-price" label="PREZZO VENDUTO (€)">
              <input type="number" id="e-price" bind:value={editItemPriceSold} step="0.01" />
            </FormField>
          </div>
          <div style="flex: 1;">
            <FormField id="e-qty" label="Q.TÀ">
              <input type="number" id="e-qty" bind:value={editItemQuantity} min="1" step="1" />
            </FormField>
          </div>
        </div>
      </div>

      <Button 
        style="margin-top: 16px; margin-bottom: 24px;"
        disabled={!editSelectedProductId || editItemPriceSold === null || editItemQuantity < 1}
        onclick={handleAddEditQuoteItem}
      >
        Inserisci Articolo
      </Button>

      <h4 style="margin-bottom: 12px; font-size: 14px; font-weight: 700;">Articoli nel Preventivo</h4>
      {#if editQuoteItems.length === 0}
        <div class="empty-items-placeholder">Il preventivo è vuoto.</div>
      {:else}
        <table class="widescreen-table" style="background: var(--color-white); margin-bottom: 24px;">
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
                <td>€ {item.listPrice.toFixed(2)}</td>
                <td>
                  <div style="display: flex; align-items: center; gap: 4px;">
                    € <input type="number" bind:value={item.priceSold} step="0.01" style="width: 80px; padding: 4px; border: 1px solid var(--color-neutral-300); border-radius: 4px;" />
                  </div>
                </td>
                <td>
                  <input type="number" bind:value={item.quantity} min="1" step="1" style="width: 60px; padding: 4px; border: 1px solid var(--color-neutral-300); border-radius: 4px;" />
                </td>
                <td><strong>€ {(item.priceSold * item.quantity).toFixed(2)}</strong></td>
                <td>
                  <button onclick={() => handleRemoveEditQuoteItem(index)} class="remove-item-btn" style="color: var(--color-error); background: transparent; border: none; cursor: pointer;">
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>

        <div class="co-selling-config-panel" style="margin-top: 20px; padding-top: 20px; border-top: 1px solid var(--color-neutral-200);">
          <h4 style="font-size: 13.5px; font-weight: 600; margin-bottom: 8px;">Ripartizione Co-Selling</h4>
          <div class="form-grid-columns" style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
            <FormField id="e-second-vendor" label="Secondo Consulente">
              <select id="e-second-vendor" bind:value={editSecondVendorUid}>
                <option value="">Nessuno (100% principale)</option>
                {#each usersList.filter(u => u.uid !== contract.original?.vendorUid) as u}
                  <option value={u.uid}>{u.nome || ''} {u.cognome || ''}</option>
                {/each}
              </select>
            </FormField>
            {#if editSecondVendorUid}
              <FormField id="e-second-share" label="Quota Co-Seller (%)">
                <input type="number" id="e-second-share" bind:value={editSecondVendorShare} min="1" max="99" step="1" required />
              </FormField>
            {/if}
          </div>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--color-neutral-200);">
          <div style="font-size: 16px; font-weight: 700;">
            Totale: <span style="color: var(--color-primary-600);">€ {editQuoteTotal.toFixed(2)}</span>
          </div>
          <div style="display: flex; gap: 12px;">
            <button onclick={cancelEditingProducts} class="cancel-btn" style="padding: 8px 16px; border-radius: 6px; border: 1px solid var(--color-neutral-300); background: var(--color-white); cursor: pointer;">Annulla</button>
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
            {@const isBelowMin = p.priceSold < p.minPrice}
            {@const gap = p.priceSold - p.listPrice}
            <tr class:row-warning={isBelowMin}>
              <td>
                <div class="prod-cell">
                  <span class="prod-name">{p.name}</span>
                  {#if isBelowMin}
                    <span class="warning-badge-inline"><ShieldAlert size={10} /> Prezzo Sotto Soglia</span>
                  {/if}
                </div>
              </td>
              <td>€ {p.listPrice.toFixed(2)}</td>
              <td>€ {p.minPrice.toFixed(2)}</td>
              <td>
                <strong class:text-warning={isBelowMin}>
                  € {p.priceSold.toFixed(2)}
                </strong>
              </td>
              <td>{p.quantity}</td>
              <td><strong>€ {(p.priceSold * p.quantity).toFixed(2)}</strong></td>
              <td>
                {#if gap === 0}
                  <span class="gap-neutral">Listino Pieno</span>
                {:else if gap > 0}
                  <span class="gap-positive">+€ {gap.toFixed(2)}</span>
                {:else}
                  <span class="gap-negative" class:heavy-discount={isBelowMin}>
                    -€ {Math.abs(gap).toFixed(2)} ({((Math.abs(gap) / p.listPrice) * 100).toFixed(0)}% sconto)
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
</style>
