<script lang="ts">
  import { Card, FormField } from '$lib';
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
          <div class="alert-box success animate-fade-in">{quoteSuccessMsg}</div>
        {/if}
        {#if quoteErrorMsg}
          <div class="alert-box error animate-fade-in">{quoteErrorMsg}</div>
        {/if}

        <!-- Builder Selection Form -->
        <div class="quote-builder-form">
          <div class="builder-inputs">
            <FormField id="q-prod" label="Seleziona Prodotto">
              <select 
                id="q-prod" 
                bind:value={selectedProductId}
                onchange={(e) => onProductSelectChange((e.target as HTMLSelectElement).value)}
              >
                <option value="">-- Seleziona Prodotto dal Catalogo --</option>
                {#each productsList as p}
                  <option value={p.id}>{p.name} (Listino: €{p.listPrice.toFixed(2)})</option>
                {/each}
              </select>
            </FormField>

            {#if selectedProductId}
              {@const chosenProd = productsList.find(p => p.id === selectedProductId)}
              {#if chosenProd}
                <FormField id="q-price" label="Prezzo Venduto Singolo (€)" helpText="Prezzo listino: €{chosenProd.listPrice.toFixed(2)}. Prezzo minimo consentito: €{chosenProd.minPrice.toFixed(2)}.">
                  <input 
                    type="number" 
                    id="q-price" 
                    bind:value={itemPriceSold} 
                    step="0.01" 
                    min="0" 
                  />
                  {#if itemPriceSold !== null && itemPriceSold < chosenProd.minPrice}
                    <span class="warning-inline"><ShieldAlert size={12} /> Prezzo inferiore al minimo di catalogo!</span>
                  {/if}
                </FormField>

                <FormField id="q-qty" label="Quantità">
                  <input 
                    type="number" 
                    id="q-qty" 
                    bind:value={itemQuantity} 
                    min="1" 
                    step="1" 
                  />
                </FormField>

                <div class="btn-align-group">
                  <span class="invisible-label">&nbsp;</span>
                  <button type="button" onclick={onAddQuoteItem} class="add-to-items-btn">
                    Inserisci Prodotto
                  </button>
                </div>
              {/if}
            {/if}
          </div>

          <!-- Selected items list -->
          <div class="quote-current-items">
            <h4>Articoli nel Preventivo Corrente</h4>
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
                          <strong class:text-warning={item.priceSold < item.minPrice}>
                            € {item.priceSold.toFixed(2)}
                          </strong>
                        </td>
                        <td>{item.quantity}</td>
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

                <div class="actions-group">
                  <button onclick={onSaveQuote} class="save-draft-btn" disabled={submittingQuote}>
                    Salva Bozza Preventivo
                  </button>
                  <button onclick={() => onConvertToContract(quoteItems)} class="convert-contract-btn" disabled={submittingQuote}>
                    <CheckCircle size={14} /> Converti in Contratto
                  </button>
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
                <span class="q-date">Preventivo del {q.edits?.createdAt ? new Date(q.edits.createdAt).toLocaleString('it-IT') : 'N/D'}</span>
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
                <th>Codice Contratto</th>
                <th>Data Creazione</th>
                <th>Importo Totale</th>
                <th>Stato Approvazione</th>
                <th>Prezzo Sotto Minimo</th>
                <th>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {#each contractsList as c}
                <tr>
                  <td><code>{c.id}</code></td>
                  <td>{c.edits?.createdAt ? new Date(c.edits.createdAt).toLocaleDateString('it-IT') : 'N/D'}</td>
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
                  <td>
                    <button onclick={() => goto(`/dashboard/contracts/${c.id}`)} class="go-details-btn">
                      Dettagli Contratto
                    </button>
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
