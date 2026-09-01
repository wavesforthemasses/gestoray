<script lang="ts">
  import { onMount } from 'svelte';
  import { formatDate, formatDateTime } from '$lib/utils/formatters';
  import { Card, FormField, Button, Autocomplete, type AutocompleteOption } from '$lib';
  import { UnitsOfMeasureService } from '$lib/services/unitsOfMeasureService';
  import { Plus, ShieldAlert, Trash2, CheckCircle, FileText } from '@lucide/svelte';
  import { authState, activeRoleState } from '$lib/auth.svelte';
  import { ContractsService } from '../contracts.service';
  import { UsersService } from '../../users/users.service';
  import { toast } from '$lib/stores/toast.svelte';
  import type { ContractItem } from '../schema';

  interface Props {
    clientId: string;
    clientData: any;
  }
  let { clientId, clientData }: Props = $props();

  // State
  let productsList = $state<any[]>([]);
  let quotesList = $state<ContractItem[]>([]);
  let contractsList = $state<ContractItem[]>([]);
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

  let productOptions = $derived<AutocompleteOption[]>(
    productsList.map(p => ({
      id: p.id,
      label: p.name,
      sublabel: `Listino: €${(Number(p.listPrice) || 0).toFixed(2)}${p.sku ? ' • ' + p.sku : ''}`
    }))
  );

  let vendorOptions = $derived<AutocompleteOption[]>([
    { id: '', label: 'Nessuno (100% provvigione a te)' },
    ...usersList
      .filter(u => u.uid !== authState.user?.uid)
      .map(u => ({
        id: u.uid,
        label: `${u.nome || ''} ${u.cognome || ''}`.trim() || u.email,
        sublabel: u.email
      }))
  ]);

  async function loadTabData() {
    try {
      try {
        const mod = await import('../../products/products.service');
        if (mod?.ProductsService) {
          const pList = mod.ProductsService.getSaleableProducts 
            ? await mod.ProductsService.getSaleableProducts() 
            : (await mod.ProductsService.getProducts()).filter((p: any) => p.canBeSold !== false && p.usageType !== 'purchase');
          productsList = pList.map((p: any) => ({
            id: p.id,
            name: p.name,
            listPrice: p.price ?? p.listPrice ?? p.unitPrice ?? 0,
            minPrice: p.minPrice ?? 0,
            unit: p.unit || ''
          }));
        }
      } catch (e) {
        console.warn('Modulo products non disponibile per ClientQuotesTab');
      }

      const uList = await UsersService.getUsers();
      usersList = uList.map((u: any) => ({ id: u.id, ...u }));

      const cList = await ContractsService.getClientContracts(clientId);
      
      const contracts: ContractItem[] = [];
      const quotes: ContractItem[] = [];

      cList.forEach((c) => {
        const statusVal = c.status || 'bozza';
        if (statusVal === 'bozza' || statusVal === 'draft') {
          quotes.push(c);
        } else {
          contracts.push(c);
        }
      });

      contractsList = contracts.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      quotesList = quotes.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

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
      quoteItems[existingIdx].subtotal = quoteItems[existingIdx].quantity * soldPrice;
    } else {
      quoteItems.push({
        productId: prod.id,
        productName: prod.name,
        name: prod.name,
        listPrice: prod.listPrice,
        minPrice: prod.minPrice,
        priceSold: soldPrice,
        quantity: itemQuantity,
        unit: prod.unit || '',
        subtotal: itemQuantity * soldPrice
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
      const fullName = (clientData?.ragioneSociale || clientData?.nome || clientData?.cognome || '').trim() || 'Cliente';
      const secondVendor = usersList.find(u => u.uid === secondVendorUid);
      const coSeller = secondVendorUid ? { 
        uid: secondVendorUid, 
        email: secondVendor ? secondVendor.email : undefined,
        share: secondVendorShare 
      } : undefined;

      await ContractsService.saveQuote(
        clientId, 
        fullName, 
        quoteItems, 
        quoteTotal, 
        { uid: authState.user.uid, email: authState.user.email! },
        coSeller
      );

      quoteSuccessMsg = 'Preventivo bozza salvato con successo!';
      toast.success('Bozza preventivo salvata!');
      quoteItems = [];
      await loadTabData();
    } catch (e: any) {
      quoteErrorMsg = 'Errore durante il salvataggio: ' + e.message;
      toast.error(quoteErrorMsg);
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
      const secondVendor = usersList.find(u => u.uid === secondVendorUid);
      const coSeller = secondVendorUid ? { 
        uid: secondVendorUid, 
        email: secondVendor ? secondVendor.email : undefined,
        share: secondVendorShare 
      } : undefined;

      await ContractsService.submitForApproval(
        quoteId, 
        coSeller, 
        { uid: authState.user.uid, email: authState.user.email! }
      );

      quoteSuccessMsg = 'Preventivo inviato in approvazione amministrativa!';
      toast.success('Preventivo inviato per approvazione!');
      quoteItems = []; 
      secondVendorUid = '';
      secondVendorShare = 30;
      await loadTabData();
    } catch (e: any) {
      quoteErrorMsg = 'Errore durante l\'invio del contratto: ' + e.message;
      toast.error(quoteErrorMsg);
    } finally {
      submittingQuote = false;
    }
  }
</script>

<div class="tab-view animate-fade-in">
  <div class="vertical-layout-stack">
    {#if activeRole !== 'direzione'}
      <!-- Current Quote Draft Builder -->
      <Card title="Preventivatore Rapido" description="Seleziona i prodotti, modifica la quotazione venduta, ed inserisci la quantità per preparare un preventivo. Puoi salvarlo in bozza o inviarlo subito in approvazione.">
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
                <Autocomplete 
                  options={productOptions} 
                  bind:value={selectedProductId} 
                  onchange={(id) => onProductSelectChange(id)} 
                  placeholder="Cerca prodotto a catalogo..." 
                />
              </FormField>
            </div>

            <div class="form-grid-columns mt-10">
              {#if selectedProductId && itemPriceSold !== null}
                {@const prod = productsList.find(p => p.id === selectedProductId)}
                {#if prod}
                  <FormField id="q-price" label="PREZZO VENDUTO SINGOLO (€)" helpText="Prezzo listino: €{(Number(prod.listPrice) || 0).toFixed(2)}. Prezzo minimo consentito: €{(Number(prod.minPrice) || 0).toFixed(2)}.">
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
                        <td>{item.productName || item.name}</td>
                        <td>€ {(Number(item.listPrice) || 0).toFixed(2)}</td>
                        <td>
                          <div class="price-input-wrapper">
                            € <input type="number" bind:value={item.priceSold} step="0.01" class="price-input" class:text-warning={item.priceSold < item.minPrice} />
                          </div>
                        </td>
                        <td>
                          <input type="number" bind:value={item.quantity} min="0" step={UnitsOfMeasureService.getStepForUnit(item.unit)} class="qty-input" />
                          {#if item.unit}<span class="unit-label">{item.unit}</span>{/if}
                        </td>
                        <td><strong>€ {(Number(item.priceSold * item.quantity) || 0).toFixed(2)}</strong></td>
                        <td>
                          <span class="min-threshold-cell">€ {(Number(item.minPrice) || 0).toFixed(2)}</span>
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
                    <Autocomplete 
                      options={vendorOptions} 
                      bind:value={secondVendorUid} 
                      placeholder="Seleziona secondo consulente..." 
                    />
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
                  <span class="tot-val">€ {(Number(quoteTotal) || 0).toFixed(2)}</span>
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
                    <CheckCircle size={14} /> Invia in Approvazione
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
                <span class="q-date">{q.contractNumber ? `${q.contractNumber} - ` : ''}Preventivo del {q.createdAt ? formatDateTime(q.createdAt) : 'N/D'}</span>
                <span class="q-creator">Creato da: {q.agentName || 'N/D'}</span>
                <span class="q-amount">€ {(q.totalAmount || 0).toFixed(2)}</span>
              </div>
              
              <!-- products inside -->
              <div class="q-products-preview">
                <ul class="preview-prod-list">
                  {#each (q.items || []) as item}
                    <li>
                      {item.productName || item.name} &times; {item.quantity} (Venduto a €{(item.priceSold || 0).toFixed(2)} / Listino €{(item.listPrice || 0).toFixed(2)})
                      {#if item.minPrice && item.priceSold < item.minPrice}
                        <span class="warning-pill"><ShieldAlert size={10} /> Prezzo Basso</span>
                      {/if}
                    </li>
                  {/each}
                </ul>
              </div>

              <div class="q-actions">
                {#if activeRole !== 'direzione'}
                  <button onclick={() => onConvertToContract(q.items || [], q.id)} class="action-btn-convert" disabled={submittingQuote}>
                    <CheckCircle size={12} /> Invia in Approvazione
                  </button>
                {/if}
                <a href={`/dashboard/contracts/${q.id}`} class="action-link-btn">
                  Apri Scheda
                </a>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </Card>

    <!-- Active / Pending Contracts list for this client -->
    <Card title="Contratti & Ordini Assegnati al Cliente" description="Contratti emessi per questo cliente.">
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
                <th>Numero / Data</th>
                <th>Titolo</th>
                <th>Importo Totale</th>
                <th>Stato</th>
                <th>Soglia Prezzo</th>
                <th>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {#each contractsList as c}
                <tr>
                  <td>
                    <strong>{c.contractNumber || 'N/D'}</strong>
                    <div class="text-sub">{c.createdAt ? formatDate(c.createdAt) : 'N/D'}</div>
                  </td>
                  <td>{c.title}</td>
                  <td><strong>€ {(c.totalAmount || 0).toFixed(2)}</strong></td>
                  <td>
                    <span class="badge-status" class:approved={c.status === 'approvato' || c.status === 'attivo' || c.status === 'approved'}>
                      {c.status === 'approvato' || c.status === 'attivo' || c.status === 'approved' ? 'Approvato' : (c.status === 'in_approvazione' || c.status === 'pending' ? 'In Approvazione' : c.status)}
                    </span>
                  </td>
                  <td>
                    {#if c.hasPriceWarning}
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
    display: flex;
    flex-direction: column;
    gap: 16px;
    width: 100%;
  }
  .vertical-layout-stack {
    display: flex;
    flex-direction: column;
    gap: 20px;
    width: 100%;
  }

  .save-quote-actions {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    margin-top: 16px;
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
  .mt-10 { margin-top: 10px; }
  .mt-20 { margin-top: 20px; }

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

  .action-btn-convert {
    background: #f0fdf4;
    color: #166534;
    border: 1px solid #bbf7d0;
    padding: 6px 12px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .action-btn-convert:hover { background: #dcfce7; }

  .action-link-btn {
    background: var(--color-white);
    border: 1px solid var(--color-neutral-300);
    color: var(--color-neutral-600);
    padding: 6px 12px;
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-family: inherit;
    font-size: 12px;
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

  .widescreen-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }
  .widescreen-table th, .widescreen-table td {
    padding: 10px 12px;
    border-bottom: 1px solid var(--color-neutral-200);
    text-align: left;
  }
  .widescreen-table th {
    background: var(--color-neutral-50);
    font-weight: 600;
    color: var(--color-neutral-600);
  }

  .badge-status {
    display: inline-block;
    padding: 3px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 700;
    background: #f1f5f9;
    color: #475569;
  }
  .badge-status.approved {
    background: #dcfce7;
    color: #15803d;
  }

  .warning-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 6px;
    background: #fef2f2;
    color: #991b1b;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 700;
  }
  .regular-price-badge {
    font-size: 11px;
    color: var(--color-neutral-500);
  }
  .text-sub {
    font-size: 11px;
    color: var(--color-neutral-500);
  }
  .q-actions {
    display: flex;
    gap: 8px;
    margin-top: 10px;
    justify-content: flex-end;
  }
  .quote-history-card {
    background: var(--color-neutral-50);
    border: 1px solid var(--color-neutral-200);
    border-radius: 8px;
    padding: 14px;
    margin-bottom: 12px;
  }
  .q-header {
    display: flex;
    justify-content: space-between;
    font-size: 13px;
    font-weight: 600;
    margin-bottom: 8px;
  }
  .q-amount {
    color: var(--color-primary-700);
    font-weight: 700;
  }
  .preview-prod-list {
    margin: 0;
    padding-left: 18px;
    font-size: 12px;
    color: var(--color-neutral-700);
  }
  .warning-pill {
    color: #b45309;
    font-weight: 700;
    font-size: 10px;
    margin-left: 6px;
  }
  .status-alert-box {
    padding: 10px 14px;
    background: #ecfdf5;
    color: #065f46;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 600;
    margin-bottom: 14px;
  }
  .status-alert-box.error {
    background: #fef2f2;
    color: #991b1b;
  }
  .remove-item-btn {
    background: none;
    border: none;
    color: var(--color-error);
    cursor: pointer;
    padding: 4px;
  }
  .under-min-badge {
    font-size: 11px;
    color: var(--color-error);
    font-weight: 700;
  }
  .total-summary-box {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .tot-label { font-size: 12px; color: var(--color-neutral-500); }
  .tot-val { font-size: 18px; font-weight: 800; color: var(--color-neutral-900); }
  .builder-summary-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
</style>
