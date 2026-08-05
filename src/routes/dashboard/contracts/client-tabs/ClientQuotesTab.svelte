<script lang="ts">
  import { onMount } from 'svelte';
  import { formatDate, formatDateTime } from '$lib/utils/formatters';
  import { Card, FormField, Button } from '$lib';
  import { UnitsOfMeasureService } from '$lib/services/unitsOfMeasureService';
  import { Plus, ShieldAlert, Trash2, CheckCircle, FileText } from '@lucide/svelte';
  import { activeRoleState, authState } from '$lib/auth.svelte';
  import { ClientDetailService } from '../../../../../src/routes/dashboard/clients/[id]/client-detail.service';
  import { db, collection, getDocs, query, where } from '$lib/firebase';
  import { toast } from '$lib/stores/toast.svelte';

  interface Props {
    clientId: string;
    clientData: any;
  }
  let { clientId, clientData }: Props = $props();

  // State
  let productsList = $state<any[]>([]);
  let quotesList = $state<any[]>([]);
  let contractsList = $state<any[]>([]);
  let usersList = $state<any[]>([]);

  let selectedProductId = $state('');
  let itemPriceSold = $state<number | null>(null);
  let itemQuantity = $state<number>(1);
  let quoteItems = $state<any[]>([]);
  let secondVendorUid = $state('');
  let secondVendorShare = $state(30);

  let submittingQuote = $state(false);
  let quoteSuccessMsg = $state('');
  let quoteErrorMsg = $state('');

  let activeRole = $derived(activeRoleState.role);

  let quoteTotal = $derived(
    quoteItems.reduce((sum, item) => sum + item.priceSold * item.quantity, 0)
  );

  async function loadTabData() {
    try {
      const pSnap = await getDocs(collection(db, 'products'));
      productsList = pSnap.docs.map(d => {
        const p = d.data()?.original || d.data();
        return { id: d.id, name: p.name, listPrice: p.price ?? p.listPrice ?? p.unitPrice ?? 0, minPrice: p.minPrice };
      });

      const uSnap = await getDocs(collection(db, 'users'));
      usersList = uSnap.docs.map(d => ({ id: d.id, ...d.data()?.original }));

      const cSnap1 = await getDocs(query(collection(db, 'contracts'), where('clientId', '==', clientId)));
      const cSnap2 = await getDocs(query(collection(db, 'contracts'), where('original.clientId', '==', clientId)));
      
      const contracts: any[] = [];
      const quotes: any[] = [];
      const processedContractIds = new Set<string>();

      const processContractDoc = (d: any) => {
        if (processedContractIds.has(d.id)) return;
        processedContractIds.add(d.id);
        const c = d.data();
        const docData = { 
          id: d.id, 
          ...c.original, 
          ...c,
          edits: c.edits || { createdAt: c.createdAt }, 
          derived: c.derived 
        };
        const statusVal = c.status || c.original?.status || 'bozza';
        if (statusVal === 'bozza' || statusVal === 'draft') {
          quotes.push(docData);
        } else {
          contracts.push(docData);
        }
      };

      cSnap1.forEach(processContractDoc);
      cSnap2.forEach(processContractDoc);

      contractsList = contracts.sort((a, b) => new Date(b.createdAt || b.edits?.createdAt || 0).getTime() - new Date(a.createdAt || a.edits?.createdAt || 0).getTime());
      quotesList = quotes.sort((a, b) => new Date(b.createdAt || b.edits?.createdAt || 0).getTime() - new Date(a.createdAt || a.edits?.createdAt || 0).getTime());

    } catch (e) {
      console.error('Error loading tab data', e);
    }
  }

  onMount(() => {
    loadTabData();
  });

  function onProductSelectChange(id: string) {
    const prod = productsList.find(p => p.id === id);
    if (prod) {
      itemPriceSold = prod.listPrice;
    } else {
      itemPriceSold = null;
    }
  }

  function onAddQuoteItem() {
    if (!selectedProductId) return;
    const prod = productsList.find(p => p.id === selectedProductId);
    if (!prod) return;

    const soldPrice = itemPriceSold !== null ? itemPriceSold : prod.listPrice;
    const existingIdx = quoteItems.findIndex(item => item.productId === selectedProductId);
    if (existingIdx > -1) {
      quoteItems[existingIdx].quantity += itemQuantity;
      quoteItems[existingIdx].priceSold = soldPrice;
    } else {
      quoteItems.push({
        productId: prod.id,
        name: prod.name,
        listPrice: prod.listPrice,
        minPrice: prod.minPrice,
        priceSold: soldPrice,
        quantity: itemQuantity
      });
    }

    selectedProductId = '';
    itemPriceSold = null;
    itemQuantity = 1;
    quoteSuccessMsg = 'Prodotto aggiunto al preventivo corrente.';
  }

  function onRemoveQuoteItem(index: number) {
    quoteItems.splice(index, 1);
  }

  async function onSaveQuote() {
    if (quoteItems.length === 0 || !authState.user) return;
    submittingQuote = true;
    quoteErrorMsg = '';
    quoteSuccessMsg = '';

    try {
      const fullName = `${clientData?.nome || ''} ${clientData?.cognome || ''}`.trim();
      await ClientDetailService.saveQuote(
        clientId, 
        fullName, 
        quoteItems, 
        quoteTotal, 
        { uid: authState.user.uid, email: authState.user.email! }
      );

      quoteSuccessMsg = 'Preventivo bozza salvato con successo!';
      quoteItems = [];
      await loadTabData();
    } catch (e: any) {
      quoteErrorMsg = 'Errore durante il salvataggio: ' + e.message;
    } finally {
      submittingQuote = false;
    }
  }

  async function onConvertToContract(items: any[], quoteId?: string) {
    if (!authState.user || !activeRoleState.role || !quoteId) return;
    submittingQuote = true;
    quoteErrorMsg = '';
    quoteSuccessMsg = '';

    try {
      const coSeller = secondVendorUid ? { uid: secondVendorUid, share: secondVendorShare } : undefined;

      await ClientDetailService.approveQuoteToContract(
        quoteId, 
        clientId, 
        coSeller, 
        activeRoleState.role, 
        { uid: authState.user.uid, email: authState.user.email! }
      );

      quoteSuccessMsg = 'Preventivo convertito in contratto! In attesa di approvazione amministrativa.';
      quoteItems = []; 
      secondVendorUid = '';
      secondVendorShare = 30;
      await loadTabData();
    } catch (e: any) {
      quoteErrorMsg = 'Errore durante la conversione in contratto: ' + e.message;
    } finally {
      submittingQuote = false;
    }
  }
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

            <div class="form-grid-columns mt-10">
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
                <input
                  type="number"
                  id="q-qty"
                  bind:value={itemQuantity}
                  min="0"
                  step={selectedProductId ? UnitsOfMeasureService.getStepForUnit(productsList.find((p) => p.id === selectedProductId)?.unit) : '1'}
                />
              </FormField>
            </div>

            <Button 
              style="margin-top: 16px; margin-bottom: 24px;"
              disabled={!selectedProductId || itemPriceSold === null || itemQuantity <= 0}
              onclick={onAddQuoteItem}
            >
              Inserisci Prodotto
            </Button>
          </div>

          <!-- Selected items list -->
          <div class="quote-current-items quote-items-container">
            <h4 class="quote-items-title">Articoli nel Preventivo Corrente</h4>
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
                          <div class="price-input-wrapper">
                            € <input type="number" bind:value={item.priceSold} step="0.01" class="price-input" class:text-warning={item.priceSold < item.minPrice} />
                          </div>
                        </td>
                        <td>
                          <input type="number" bind:value={item.quantity} min="0" step={UnitsOfMeasureService.getStepForUnit(item.unit)} class="qty-input" />
                          {#if item.unit}<span class="unit-label">{item.unit}</span>{/if}
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
              <div class="co-selling-config-panel co-selling-container">
                <h4 class="co-selling-title">Ripartizione Co-Selling (Opzionale)</h4>
                <p class="co-selling-desc">Se questa vendita è stata conclusa in collaborazione con un altro commerciale, selezionalo qui sotto per ripartire le provvigioni.</p>
                <div class="form-grid-columns">
                  <FormField id="q-second-vendor" label="Secondo Consulente">
                    <select id="q-second-vendor" bind:value={secondVendorUid}>
                      <option value="">Nessuno (100% provvigione a te)</option>
                      {#each usersList.filter(u => u.uid !== authState.user?.uid) as u}
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
              <div class="builder-summary-row mt-20">
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
                <th>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {#each contractsList as c}
                <tr>
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
                  <td>
                    <a href={`/dashboard/contracts/${c.id}`} class="action-link-btn">
                      Vedi Dettagli
                    </a>
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

  .save-quote-actions {
    display: flex;
    justify-content: flex-end;
    margin-top: 16px;
  }


  .tab-view {
    display: flex;
    flex-direction: column;
    gap: 16px;
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
  .mt-10 {
    margin-top: 10px;
  }
  .mt-20 {
    margin-top: 20px;
  }
  .quote-items-container {
    border-top: 1px solid var(--color-neutral-200);
    padding-top: 24px;
  }
  .quote-items-title {
    margin-bottom: 12px;
    font-size: 14px;
    font-weight: 700;
    color: var(--color-neutral-800);
  }
  .price-input-wrapper {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .price-input {
    width: 80px;
    padding: 4px;
    border: 1px solid var(--color-neutral-300);
    border-radius: 4px;
  }
  .qty-input {
    width: 60px;
    padding: 4px;
    border: 1px solid var(--color-neutral-300);
    border-radius: 4px;
  }
  .co-selling-container {
    margin-top: 20px;
    padding-top: 20px;
    border-top: 1px solid var(--color-neutral-200);
  }
  .co-selling-title {
    font-size: 13.5px;
    font-weight: 600;
    color: var(--color-neutral-800);
    margin-bottom: 4px;
  }
  .co-selling-desc {
    font-size: 12px;
    color: var(--color-neutral-500);
    margin-bottom: 12px;
  }
  .action-link-btn {
    background: var(--color-white);
    border: 1px solid var(--color-neutral-300);
    color: var(--color-neutral-600);
    padding: 4px 8px;
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-family: inherit;
    font-size: 11px;
    font-weight: 600;
    transition: all 0.2s;
    text-decoration: none;
    display: inline-flex;
    align-items: center;
  }
  .action-link-btn:hover {
    background: var(--color-neutral-100);
    color: var(--color-neutral-800);
  }
</style>
