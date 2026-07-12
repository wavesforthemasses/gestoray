<script lang="ts">
  import { formatDate, formatDateTime } from '$lib/utils/formatters';
  import { Card, FormField, Button } from '$lib';
  import { Plus, ShieldAlert, Trash2, CheckCircle, FileText } from '@lucide/svelte';
  import { goto } from '$app/navigation';

  interface Props {
    // Collections & Data
    productsList: any[];
    quotesList: any[];
    contractsList: any[];
    usersList: any[];
    auth: any;

    // Bindables
    selectedProductId: string;
    itemPriceSold: number | null;
    itemQuantity: number;
    quoteItems: any[];
    secondVendorUid: string;
    secondVendorShare: number;

    // State
    activeRole: string | null;
    submittingQuote: boolean;
    quoteSuccessMsg: string;
    quoteErrorMsg: string;

    // Calculations
    quoteTotal: number;

    // Callbacks
    onProductSelectChange: (id: string) => void;
    onAddQuoteItem: () => void;
    onRemoveQuoteItem: (idx: number) => void;
    onSaveQuote: () => void;
    onConvertToContract: (items: any[], quoteId?: string) => void;
  }

  let {
    productsList,
    quotesList,
    contractsList,
    usersList,
    auth,

    selectedProductId = $bindable(),
    itemPriceSold = $bindable(),
    itemQuantity = $bindable(),
    quoteItems = $bindable(),
    secondVendorUid = $bindable(),
    secondVendorShare = $bindable(),

    activeRole,
    submittingQuote,
    quoteSuccessMsg = $bindable(),
    quoteErrorMsg = $bindable(),

    quoteTotal,

    onProductSelectChange,
    onAddQuoteItem,
    onRemoveQuoteItem,
    onSaveQuote,
    onConvertToContract
  }: Props = $props();
</script>

<div class="tab-view animate-fade-in">
  <div class="vertical-layout-stack">
    {#if activeRole !== 'direzione'}
      <!-- Current Quote Draft Builder -->
      <Card title="Preventivatore Rapido" description="Seleziona i prodotti, modifica la quotazione venduta, ed inserisci la quantità per preparare un preventivo. Puoi salvarlo in bozza o convertirlo subito in un Contratto in attesa.">
        {#snippet icon()}
          <Plus size={20} class="icon-accent" />
        {/snippet}

        {#if quoteSuccessMsg}
          <div class="status-alert-box animate-fade-in">{quoteSuccessMsg}</div>
        {/if}
        {#if quoteErrorMsg}
          <div class="status-alert-box error animate-fade-in">{quoteErrorMsg}</div>
        {/if}

        <!-- Builder Selection Form -->
        <div class="quote-builder-form">
          <div class="builder-inputs">
            <div class="form-grid-columns">
              <FormField id="q-product" label="SELEZIONA PRODOTTO">
                <select id="q-product" bind:value={selectedProductId} onchange={(e) => onProductSelectChange(e.currentTarget.value)}>
                  <option value="">-- Seleziona Prodotto dal Catalogo --</option>
                  {#each productsList as p}
                    <option value={p.id}>{p.name} (Listino: €{p.listPrice.toFixed(2)})</option>
                  {/each}
                </select>
              </FormField>
            </div>

            <div class="form-grid-columns" style="margin-top: 10px;">
              {#if selectedProductId && itemPriceSold !== null}
                {@const prod = productsList.find(p => p.id === selectedProductId)}
                {#if prod}
                  <FormField id="q-price" label="PREZZO VENDUTO SINGOLO (€)" helpText="Prezzo listino: €{prod.listPrice.toFixed(2)}. Prezzo minimo consentito: €{prod.minPrice.toFixed(2)}.">
                    <input type="number" id="q-price" bind:value={itemPriceSold} step="0.01" />
                    {#if itemPriceSold < prod.minPrice}
                      <span class="warning-inline"><ShieldAlert size={12} /> Prezzo inferiore al minimo di catalogo!</span>
                    {/if}
                  </FormField>
                {:else}
                  <FormField id="q-price" label="PREZZO VENDUTO SINGOLO (€)">
                    <input type="number" id="q-price" bind:value={itemPriceSold} step="0.01" />
                  </FormField>
                {/if}
              {:else}
                <FormField id="q-price" label="PREZZO VENDUTO SINGOLO (€)">
                  <input type="number" id="q-price" bind:value={itemPriceSold} step="0.01" />
                </FormField>
              {/if}
              
              <FormField id="q-qty" label="QUANTITÀ">
                <input type="number" id="q-qty" bind:value={itemQuantity} min="1" step="1" />
              </FormField>
            </div>

            <Button 
              style="margin-top: 16px; margin-bottom: 24px;"
              disabled={!selectedProductId || itemPriceSold === null || itemQuantity < 1}
              onclick={onAddQuoteItem}
            >
              Inserisci Prodotto
            </Button>
          </div>

          <!-- Selected items list -->
          <div class="quote-current-items" style="border-top: 1px solid var(--color-neutral-200); padding-top: 24px;">
            <h4 style="margin-bottom: 12px; font-size: 14px; font-weight: 700; color: var(--color-neutral-800);">Articoli nel Preventivo Corrente</h4>
            {#if quoteItems.length === 0}
              <div class="empty-items-placeholder">Il preventivo è vuoto. Aggiungi prodotti dal catalogo per iniziare.</div>
            {:else}
              <div class="items-table-container">
                <table class="widescreen-table">
                  <thead>
                    <tr>
                      <th>Prodotto</th>
                      <th>Prezzo Listino</th>
                      <th>Prezzo Venduto</th>
                      <th>Quantità</th>
                      <th>Totale</th>
                      <th>Soglia Minima</th>
                      <th>Azioni</th>
                    </tr>
                  </thead>
                  <tbody>
                    {#each quoteItems as item, index}
                      <tr class:row-warning={item.priceSold < item.minPrice}>
                        <td>{item.name}</td>
                        <td>€ {item.listPrice.toFixed(2)}</td>
                        <td>
                          <div style="display: flex; align-items: center; gap: 4px;">
                            € <input type="number" bind:value={item.priceSold} step="0.01" style="width: 80px; padding: 4px; border: 1px solid var(--color-neutral-300); border-radius: 4px;" class:text-warning={item.priceSold < item.minPrice} />
                          </div>
                        </td>
                        <td>
                          <input type="number" bind:value={item.quantity} min="1" step="1" style="width: 60px; padding: 4px; border: 1px solid var(--color-neutral-300); border-radius: 4px;" />
                        </td>
                        <td><strong>€ {(item.priceSold * item.quantity).toFixed(2)}</strong></td>
                        <td>
                          <span class="min-threshold-cell">€ {item.minPrice.toFixed(2)}</span>
                          {#if item.priceSold < item.minPrice}
                            <span class="under-min-badge" title="Prezzo sotto la soglia minima"><ShieldAlert size={10} /> SOTTO SOGLIA</span>
                          {/if}
                        </td>
                        <td>
                          <button onclick={() => onRemoveQuoteItem(index)} class="remove-item-btn" title="Rimuovi">
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>

              <!-- Co-Selling splits panel -->
              <div class="co-selling-config-panel" style="margin-top: 20px; padding-top: 20px; border-top: 1px solid var(--color-neutral-200);">
                <h4 style="font-size: 13.5px; font-weight: 600; color: var(--color-neutral-800); margin-bottom: 4px;">Ripartizione Co-Selling (Opzionale)</h4>
                <p style="font-size: 12px; color: var(--color-neutral-500); margin-bottom: 12px;">Se questa vendita è stata conclusa in collaborazione con un altro commerciale, selezionalo qui sotto per ripartire le provvigioni.</p>
                <div class="form-grid-columns">
                  <FormField id="q-second-vendor" label="Secondo Consulente">
                    <select id="q-second-vendor" bind:value={secondVendorUid}>
                      <option value="">Nessuno (100% provvigione a te)</option>
                      {#each usersList.filter(u => u.uid !== auth?.uid) as u}
                        <option value={u.uid}>{u.nome || ''} {u.cognome || ''} ({u.email})</option>
                      {/each}
                    </select>
                  </FormField>
                  {#if secondVendorUid}
                    <FormField id="q-second-share" label="Quota Provvigionale Co-Seller (%)" helpText="Il resto della provvigione andrà al principale.">
                      <input type="number" id="q-second-share" bind:value={secondVendorShare} min="1" max="99" step="1" required />
                    </FormField>
                  {/if}
                </div>
              </div>

              <!-- Builder Footer Stats -->
              <div class="builder-summary-row" style="margin-top: 20px;">
                <div class="total-summary-box">
                  <span class="tot-label">Importo Complessivo Preventivo:</span>
                  <span class="tot-val">€ {quoteTotal.toFixed(2)}</span>
                </div>

                <div class="save-quote-actions">
                  <Button 
                    onclick={onSaveQuote} 
                    disabled={submittingQuote}
                  >
                    {submittingQuote ? 'Salvataggio...' : 'Salva Bozza Preventivo'}
                  </Button>
                  <Button 
                    onclick={() => onConvertToContract(quoteItems)} 
                    disabled={submittingQuote}
                  >
                    <CheckCircle size={14} /> Converti in Contratto
                  </Button>
                </div>
              </div>
            {/if}
          </div>
        </div>
      </Card>
    {/if}

    <!-- Quotes History List -->
    <Card title="Storico Preventivi Generati" description="Consulta i preventivi calcolati in precedenza per questo cliente. Puoi convertirli direttamente in contratti se il cliente li ha accettati.">
      {#snippet icon()}
        <FileText size={20} class="icon-accent" />
      {/snippet}

      {#if quotesList.length === 0}
        <div class="empty-panel">Nessun preventivo salvato in bozza per questo cliente.</div>
      {:else}
        <div class="quotes-history-flow">
          {#each quotesList as q}
            <div class="quote-history-card">
              <div class="q-header">
                <span class="q-date">Preventivo del {q.edits?.createdAt ? formatDateTime(q.edits.createdAt) : 'N/D'}</span>
                <span class="q-creator">Creato da: {q.createdEmail || 'N/D'}</span>
                <span class="q-amount">€ {q.totalPrice.toFixed(2)}</span>
              </div>
              
              <!-- products inside -->
              <div class="q-products-preview">
                <ul class="preview-prod-list">
                  {#each q.products as item}
                    <li>
                      {item.name} &times; {item.quantity} (Venduto a €{item.priceSold.toFixed(2)} / Listino €{item.listPrice.toFixed(2)})
                      {#if item.priceSold < item.minPrice}
                        <span class="warning-pill"><ShieldAlert size={10} /> Prezzo Basso</span>
                      {/if}
                    </li>
                  {/each}
                </ul>
              </div>

              {#if activeRole !== 'direzione'}
                <div class="q-actions">
                  <button onclick={() => onConvertToContract(q.products, q.id)} class="action-btn-convert" disabled={submittingQuote}>
                    <CheckCircle size={12} /> Converti in Contratto Attivo
                  </button>
                </div>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    </Card>

    <!-- Active / Pending Contracts list for this client -->
    <Card title="Contratti Assegnati al Cliente" description="Contratti emessi per questo cliente.">
      {#snippet icon()}
        <FileText size={20} class="icon-accent" />
      {/snippet}

      {#if contractsList.length === 0}
        <div class="empty-panel">Nessun contratto presente in database per questa anagrafica.</div>
      {:else}
        <div class="contracts-overview-table-container">
          <table class="widescreen-table">
            <thead>
              <tr>
                <th>Data Creazione</th>
                <th>Importo Totale</th>
                <th>Stato Approvazione</th>
                <th>Prezzo Sotto Minimo</th>
              </tr>
            </thead>
            <tbody>
              {#each contractsList as c}
                <tr class="clickable-row" onclick={() => goto(`/dashboard/contracts/${c.id}`)}>
                  <td>{c.edits?.createdAt ? formatDate(c.edits.createdAt) : 'N/D'}</td>
                  <td><strong>€ {c.totalPrice.toFixed(2)}</strong></td>
                  <td>
                    <span class="badge-status" class:approved={c.status === 'approved'}>
                      {c.status === 'approved' ? 'Approvato' : 'In Attesa'}
                    </span>
                  </td>
                  <td>
                    {#if c.hasWarning}
                      <span class="warning-badge"><ShieldAlert size={12} /> Prezzo Basso</span>
                    {:else}
                      <span class="regular-price-badge">Prezzi Standard</span>
                    {/if}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </Card>
  </div>
</div>

<style>
  .tab-view {
    padding-top: 10px;
  }
  .vertical-layout-stack {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
  .empty-state {
    padding: 30px;
    text-align: center;
    color: var(--color-neutral-500);
    background: var(--color-neutral-50);
    border-radius: var(--radius-md);
    border: 1px dashed var(--color-neutral-300);
    font-size: 14px;
  }
  .quote-item-form {
    display: flex;
    flex-direction: column;
    gap: 16px;
    background: var(--color-neutral-50);
    padding: 16px;
    border-radius: var(--radius-md);
    border: 1px solid var(--color-neutral-200);
  }
  .form-grid-columns {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
  }
  @media (max-width: 768px) {
    .form-grid-columns {
      grid-template-columns: 1fr;
    }
  }
  .product-select-row {
    margin-bottom: 16px;
  }
  .add-to-items-btn {
    background: var(--color-neutral-800);
    color: var(--color-white);
    border: none;
    padding: 12px 20px;
    border-radius: var(--radius-md);
    font-weight: 600;
    cursor: pointer;
    font-size: 14px;
    transition: background var(--transition-fast);
  }
  .add-to-items-btn:hover {
    background: var(--color-neutral-900);
  }
  .add-to-items-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .quote-items-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 16px;
  }
  .quote-item-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px;
    background: var(--color-white);
    border: 1px solid var(--color-neutral-200);
    border-radius: var(--radius-sm);
  }
  .item-name {
    font-weight: 600;
    color: var(--color-neutral-800);
    flex: 1;
  }
  .item-price {
    font-family: monospace;
    font-size: 15px;
    color: var(--color-primary-600);
    margin: 0 16px;
    min-width: 100px;
    text-align: right;
  }
  .remove-item-btn {
    background: transparent;
    border: none;
    color: var(--color-error);
    cursor: pointer;
    padding: 6px;
    border-radius: var(--radius-sm);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .remove-item-btn:hover {
    background: var(--color-error-light);
  }
  .quote-summary {
    margin-top: 16px;
    border-top: 1px solid var(--color-neutral-200);
    padding-top: 16px;
  }
  .total-row {
    display: flex;
    justify-content: flex-end;
    align-items: baseline;
    gap: 16px;
    font-size: 18px;
    font-weight: 700;
    color: var(--color-neutral-900);
  }
  .total-row span:last-child {
    color: var(--color-primary-600);
  }
  .save-quote-actions {
    display: flex;
    justify-content: flex-end;
    margin-top: 16px;
  }
  .submit-profile-btn {
    background: linear-gradient(135deg, var(--color-primary-500), var(--color-primary-600));
    color: var(--color-white);
    border: none;
    padding: 12px 20px;
    border-radius: var(--radius-md);
    font-weight: 600;
    cursor: pointer;
    font-size: 14px;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    transition: all var(--transition-fast);
  }
  .submit-profile-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .status-alert-box {
    padding: 12px 14px;
    border-radius: var(--radius-md);
    font-size: 13px;
    margin-bottom: 20px;
    background: var(--color-success-light);
    border: 1px solid var(--color-success-border);
    color: var(--color-success-text);
  }

  .status-alert-box.error {
    background: var(--color-error-light);
    border: 1px solid var(--color-error-border);
    color: var(--color-error-text);
  }

  .tab-view {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .quotes-history-list, .contracts-list {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .quote-card, .contract-card {
    border: 1px solid var(--color-neutral-200);
    border-radius: var(--radius-md);
    padding: 16px;
    background: var(--color-white);
  }
  .quote-header, .contract-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    flex-wrap: wrap;
    gap: 12px;
  }
  .quote-meta {
    font-size: 13px;
    color: var(--color-neutral-500);
  }
  .quote-meta strong {
    color: var(--color-neutral-800);
  }
  .convert-contract-btn {
    background: var(--color-success);
    color: var(--color-white);
    border: none;
    padding: 8px 16px;
    border-radius: var(--radius-md);
    font-weight: 600;
    cursor: pointer;
    font-size: 13px;
    transition: background var(--transition-fast);
  }
  .convert-contract-btn:hover:not(:disabled) {
    background: hsl(142, 76%, 30%);
  }
  .quote-items {
    font-size: 13px;
    color: var(--color-neutral-600);
    padding-left: 20px;
    margin: 0;
  }
  .contract-status {
    font-weight: 600;
    color: var(--color-neutral-800);
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .status-badge {
    padding: 4px 10px;
    border-radius: var(--radius-round);
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
  }
  .status-badge.approvazione {
    background: var(--color-warning-light);
    color: var(--color-warning-text);
  }
  .status-badge.attivo {
    background: var(--color-success-light);
    color: var(--color-success-text);
  }
  .status-badge.annullato {
    background: var(--color-neutral-200);
    color: var(--color-neutral-600);
  }
  .status-badge.completato {
    background: var(--color-primary-100);
    color: var(--color-primary-700);
  }
  :global(.icon-accent) {
    color: var(--color-primary-500);
  }
  .animate-fade-in {
    animation: fadeIn 0.3s ease;
  }
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  }
</style>
