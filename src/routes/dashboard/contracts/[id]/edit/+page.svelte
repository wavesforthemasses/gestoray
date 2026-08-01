<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { ContractsService } from '../../contracts.service';
  import { ContractSettingsService } from '../../contractSettingsService';
  import type { ContractItem, ContractType, RecurringFrequency, ContractStatus, ContractProductItem, ContractSettings } from '../../schema';
  import { CustomFieldsService } from '$lib/services/customFieldsService';
  import { CacheLookupService } from '$lib/services/cacheLookupService';
  import type { CustomFieldDefinition, CustomFieldValues } from '$lib/types/customFields';
  import CustomFieldsRenderer from '$lib/components/CustomFieldsRenderer.svelte';
  import Autocomplete from '$lib/components/Autocomplete.svelte';
  import { toast } from '$lib/stores/toast.svelte';
  import { ArrowLeft, Edit, AlertTriangle, User, Save, Plus, Trash2, ShoppingBag } from '@lucide/svelte';

  let contractId = $derived(page.params.id || '');
  let contract = $state<ContractItem | null>(null);

  let settings = $state<ContractSettings>({
    entityNaming: 'contract',
    prefix: 'CTR-',
    includeYear: true,
    numberPadding: 4,
    lastNumber: 0,
    resetCounterAnnually: true
  });
  let labels = $derived(ContractSettingsService.getLabels(settings));

  let clients = $state<{ id: string; name: string }[]>([]);
  let clientOptions = $derived(clients.map(c => ({ id: c.id, label: c.name })));

  let productsCatalog = $state<any[]>([]);
  let customFieldsList = $state<CustomFieldDefinition[]>([]);
  let customFieldsValues = $state<CustomFieldValues>({});

  let loading = $state(true);
  let saving = $state(false);
  let errorMsg = $state('');

  // Form State
  let contractNumber = $state('');
  let title = $state('');
  let clientId = $state('');
  let type = $state<ContractType>('Canone Ricorrente');
  let totalAmount = $state<number>(0);
  let billingFrequency = $state<RecurringFrequency>('mensile');
  let startDate = $state('');
  let endDate = $state('');
  let status = $state<ContractStatus>('attivo');
  let notes = $state('');

  // Items State (Prodotti / Servizi quotati)
  let items = $state<ContractProductItem[]>([]);
  let selectedProductId = $state('');
  let itemQty = $state<number>(1);
  let itemPriceSold = $state<number | undefined>(undefined);
  let itemNotes = $state('');

  onMount(async () => {
    try {
      const [s, cList, pList, cf] = await Promise.all([
        ContractSettingsService.getSettings(),
        CacheLookupService.getLookup('clients'),
        CacheLookupService.getLookup('products'),
        CustomFieldsService.getFieldsForModule('contracts')
      ]);
      settings = s;
      clients = cList;
      productsCatalog = pList;
      customFieldsList = cf;

      if (contractId) {
        contract = await ContractsService.getContractById(contractId);
        if (contract) {
          contractNumber = contract.contractNumber || '';
          title = contract.title || '';
          clientId = contract.clientId || '';
          type = contract.type || 'Canone Ricorrente';
          totalAmount = contract.totalAmount || 0;
          billingFrequency = contract.billingFrequency || 'mensile';
          startDate = contract.startDate || '';
          endDate = contract.endDate || '';
          status = contract.status || 'attivo';
          notes = contract.notes || '';
          items = contract.items ? [...contract.items] : [];
          customFieldsValues = contract.customFields ? { ...contract.customFields } : {};
        }
      }
    } catch (e) {
      console.error('Errore caricamento dati modifica:', e);
    } finally {
      loading = false;
    }
  });

  function handleProductSelectChange(prodId: string) {
    selectedProductId = prodId;
    const found = productsCatalog.find(p => p.id === prodId);
    if (found) {
      itemPriceSold = found.listPrice || found.price || 0;
    }
  }

  function handleAddItem() {
    if (!selectedProductId || itemQty <= 0 || itemPriceSold === undefined || itemPriceSold < 0) {
      toast.error('Seleziona un prodotto e inserisci quantità e prezzo validi');
      return;
    }

    const prod = productsCatalog.find(p => p.id === selectedProductId);
    const productName = prod ? (prod.name || prod.label || 'Prodotto') : 'Prodotto';
    const listPrice = prod ? (prod.listPrice || prod.price || 0) : itemPriceSold;
    const minPrice = prod ? prod.minPrice : undefined;
    const unit = prod ? prod.unit : undefined;
    const subtotal = itemQty * itemPriceSold;

    items = [
      ...items,
      {
        productId: selectedProductId,
        productName,
        unit,
        listPrice,
        minPrice,
        priceSold: itemPriceSold,
        quantity: itemQty,
        subtotal,
        notes: itemNotes.trim()
      }
    ];

    totalAmount = items.reduce((sum, item) => sum + item.subtotal, 0);

    selectedProductId = '';
    itemQty = 1;
    itemPriceSold = undefined;
    itemNotes = '';
    toast.success('Articolo aggiunto alla quotazione');
  }

  function handleRemoveItem(index: number) {
    items = items.filter((_, i) => i !== index);
    totalAmount = items.reduce((sum, item) => sum + item.subtotal, 0);
  }

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (!contractId || !clientId) {
      errorMsg = 'Seleziona un cliente intestatario obbligatorio.';
      return;
    }

    saving = true;
    errorMsg = '';

    try {
      const selectedClient = clients.find(c => c.id === clientId);

      await ContractsService.updateContract(contractId, {
        contractNumber: contractNumber.trim(),
        title: title.trim(),
        clientId,
        clientName: selectedClient ? selectedClient.name : (contract?.clientName || ''),
        type,
        totalAmount,
        billingFrequency,
        startDate,
        endDate,
        status,
        notes: notes.trim(),
        items,
        customFields: customFieldsValues
      });

      toast.success(`${labels.singular} aggiornato con successo!`);
      goto(`/dashboard/contracts/${contractId}`);
    } catch (err: any) {
      console.error('Errore salvataggio:', err);
      errorMsg = err.message || `Errore durante l'aggiornamento del ${labels.singular.toLowerCase()}.`;
    } finally {
      saving = false;
    }
  }
</script>

<svelte:head>
  <title>{labels.editSingular} | Gestoray</title>
</svelte:head>

<div class="add-contract-page animate-fade-in">
  <div class="page-top">
    <a href="/dashboard/contracts/{contractId}" class="back-link">
      <ArrowLeft size={16} /> Torna al {labels.detailSingular}
    </a>
    <h2>{labels.editSingular}</h2>
  </div>

  {#if loading}
    <div class="loader-box">
      <span class="spinner"></span>
      Caricamento in corso...
    </div>
  {:else if !contract}
    <div class="alert error-box">
      <AlertTriangle size={18} /> {labels.singular} non trovato o eliminato.
    </div>
  {:else}
    {#if errorMsg}
      <div class="alert error-box">
        <AlertTriangle size={18} /> {errorMsg}
      </div>
    {/if}

    <form onsubmit={handleSubmit} class="contract-form">
      <!-- 1. CLIENTE E RIFERIMENTI -->
      <div class="card form-card">
        <div class="card-header">
          <h3 class="card-title">Cliente & Riferimenti</h3>
          <p class="card-subtitle">Seleziona il cliente intestatario del {labels.singular.toLowerCase()}.</p>
        </div>

        <div class="grid-2">
          <div class="form-group">
            <label for="clientId">Cliente Intestatario *</label>
            <Autocomplete
              options={clientOptions}
              bind:value={clientId}

              placeholder="Cerca cliente per nome o ragione sociale..."
            />
          </div>

          <div class="form-group">
            <label for="contractNumber">{labels.numberLabel} *</label>
            <input type="text" id="contractNumber" bind:value={contractNumber} required />
          </div>
        </div>

        <div class="form-group margin-top-12">
          <label for="title">{labels.titleLabel} <span class="optional-tag">(opzionale)</span></label>
          <input type="text" id="title" bind:value={title} placeholder="es. Fornitura Licenze e Manutenzione Annuale..." />
        </div>
      </div>

      <!-- 2. PRODOTTI & SERVIZI INCLUSI -->
      <div class="card form-card">
        <div class="card-header">
          <h3 class="card-title">
            <ShoppingBag size={18} color="var(--color-primary-600)" /> Prodotti & Servizi Inclusi nella Quotazione
          </h3>
          <p class="card-subtitle">Seleziona i prodotti dal catalogo, imposta quantità e prezzo venduto.</p>
        </div>

        <!-- FORM INSERIMENTO PRODOTTO -->
        <div class="add-item-box">
          <div class="grid-3">
            <div class="form-group">
              <label for="selectProd">Seleziona Prodotto / Servizio</label>
              <select 
                id="selectProd" 
                bind:value={selectedProductId} 
                onchange={(e) => handleProductSelectChange(e.currentTarget.value)}
              >
                <option value="">-- Seleziona dal Catalogo --</option>
                {#each productsCatalog as p}
                  <option value={p.id}>{p.name || p.label} (Listino: €{(p.listPrice || p.price || 0).toFixed(2)})</option>
                {/each}
              </select>
            </div>

            <div class="form-group">
              <label for="itemPrice">Prezzo Venduto (€)</label>
              <input type="number" id="itemPrice" bind:value={itemPriceSold} step="0.01" min="0" placeholder="0.00" />
            </div>

            <div class="form-group">
              <label for="itemQty">Quantità</label>
              <input type="number" id="itemQty" bind:value={itemQty} min="1" step="1" />
            </div>
          </div>

          <div class="add-item-footer">
            <input type="text" bind:value={itemNotes} placeholder="Note o specifiche della riga (opzionale)..." class="flex-1" />
            <button type="button" class="btn-secondary" onclick={handleAddItem}>
              <Plus size={16} /> Aggiungi Articolo
            </button>
          </div>
        </div>

        <!-- TABELLA ARTICOLI INSERITI -->
        {#if items.length === 0}
          <div class="empty-items-text">Nessun articolo inserito. Il totale verrà specificato manualmente sotto.</div>
        {:else}
          <table class="items-table">
            <thead>
              <tr>
                <th>Prodotto / Servizio</th>
                <th>P. Listino (€)</th>
                <th>P. Venduto (€)</th>
                <th>Qtà</th>
                <th>Subtotale (€)</th>
                <th class="text-right">Azione</th>
              </tr>
            </thead>
            <tbody>
              {#each items as item, idx}
                <tr>
                  <td>
                    <strong>{item.productName}</strong>
                    {#if item.notes}<div class="sub-text">{item.notes}</div>{/if}
                  </td>
                  <td>€ {item.listPrice.toFixed(2)}</td>
                  <td class="font-bold">€ {item.priceSold.toFixed(2)}</td>
                  <td>{item.quantity} {item.unit || ''}</td>
                  <td class="font-bold">€ {item.subtotal.toFixed(2)}</td>
                  <td class="text-right">
                    <button type="button" class="btn-icon btn-danger-icon" onclick={() => handleRemoveItem(idx)}>
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        {/if}
      </div>

      <!-- 3. DETTAGLI ECONOMICI E FREQUENZA -->
      <div class="card form-card">
        <div class="card-header">
          <h3 class="card-title">Condizioni Economiche & Scadenze</h3>
        </div>

        <div class="grid-2">
          <div class="form-group">
            <label for="type">{labels.typeLabel}</label>
            <select id="type" bind:value={type}>
              <option value="Canone Ricorrente">Canone Ricorrente</option>
              <option value="Fornitura / Quotazione">Fornitura / Quotazione</option>
              <option value="Monte Ore">Monte Ore</option>
              <option value="SLA Garantito">SLA Garantito</option>
              <option value="Licenza / Abbonamento">Licenza / Abbonamento</option>
            </select>
          </div>

          <div class="form-group">
            <label for="billingFrequency">Frequenza Fatturazione</label>
            <select id="billingFrequency" bind:value={billingFrequency}>
              <option value="mensile">Mensile</option>
              <option value="bimestrale">Bimestrale</option>
              <option value="trimestrale">Trimestrale</option>
              <option value="semestrale">Semestrale</option>
              <option value="annuale">Annuale</option>
              <option value="una_una">Una Tantum / Singola</option>
            </select>
          </div>
        </div>

        <div class="grid-3 margin-top-12">
          <div class="form-group">
            <label for="totalAmount">{labels.totalValueLabel} (€) *</label>
            <input type="number" id="totalAmount" bind:value={totalAmount} step="0.01" min="0" required />
          </div>

          <div class="form-group">
            <label for="startDate">Data Inizio / Decorrenza *</label>
            <input type="date" id="startDate" bind:value={startDate} required />
          </div>

          <div class="form-group">
            <label for="endDate">Data Scadenza *</label>
            <input type="date" id="endDate" bind:value={endDate} required />
          </div>
        </div>

        <div class="form-group margin-top-12">
          <label for="status">Stato {labels.singular}</label>
          <select id="status" bind:value={status}>
            <option value="attivo">{labels.activeTabLabel}</option>
            <option value="in_scadenza">{labels.expiringTabLabel}</option>
            <option value="scaduto">{labels.expiredTabLabel}</option>
            <option value="sospeso">Sospeso</option>
          </select>
        </div>

        <div class="form-group margin-top-12">
          <label for="notes">Note Riservate / Specifiche</label>
          <textarea id="notes" bind:value={notes} rows="3" placeholder="Note interne, dettagli accordo..."></textarea>
        </div>
      </div>

      <!-- CAMPI PERSONALIZZATI -->
      {#if customFieldsList.length > 0}
        <div class="card form-card">
          <h3 class="card-title">Campi Personalizzati</h3>
          <CustomFieldsRenderer fields={customFieldsList} bind:values={customFieldsValues} />
        </div>
      {/if}

      <!-- SUBMIT -->
      <div class="form-actions">
        <a href="/dashboard/contracts/{contractId}" class="btn-secondary">Annulla</a>
        <button type="submit" class="btn-primary" disabled={saving}>
          <Save size={18} /> {saving ? 'Salvataggio...' : `Aggiorna ${labels.singular}`}
        </button>
      </div>
    </form>
  {/if}
</div>

<style>
  .add-contract-page {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .page-top h2 {
    font-size: 22px;
    font-weight: 700;
    margin: 6px 0 0 0;
  }

  .back-link {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: var(--color-neutral-600, #4b5563);
    text-decoration: none;
    font-size: 13px;
    font-weight: 500;
  }

  .contract-form {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .grid-2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }

  .grid-3 {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 16px;
  }

  .margin-top-12 {
    margin-top: 12px;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .form-group label {
    font-size: 13px;
    font-weight: 600;
    color: var(--color-neutral-700, #374151);
  }

  .optional-tag {
    font-size: 12px;
    font-weight: 400;
    color: var(--color-neutral-500, #6b7280);
  }

  input[type="text"], input[type="number"], input[type="date"], select, textarea {
    padding: 9px 12px;
    border: 1px solid var(--color-neutral-300, #d1d5db);
    border-radius: 8px;
    font-size: 14px;
    outline: none;
    box-sizing: border-box;
    background: white;
  }

  input:focus, select:focus, textarea:focus {
    border-color: var(--color-primary-500, #3b82f6);
  }

  .add-item-box {
    background: var(--color-neutral-50, #f9fafb);
    border: 1px dashed var(--color-neutral-300, #d1d5db);
    border-radius: 8px;
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-bottom: 12px;
  }

  .add-item-footer {
    display: flex;
    gap: 12px;
    align-items: center;
  }

  .flex-1 { flex: 1; }

  .items-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }

  .items-table th {
    background: var(--color-neutral-50, #f9fafb);
    padding: 10px 12px;
    text-align: left;
    font-weight: 600;
    color: var(--color-neutral-500, #6b7280);
    border-bottom: 1px solid var(--color-neutral-200, #e5e7eb);
  }

  .items-table td {
    padding: 10px 12px;
    border-bottom: 1px solid var(--color-neutral-200, #e5e7eb);
  }

  .empty-items-text {
    font-size: 13px;
    color: var(--color-neutral-500, #6b7280);
    padding: 12px 0;
    font-style: italic;
  }

  .btn-primary {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: var(--color-primary-600, #2563eb);
    color: white;
    padding: 10px 20px;
    border-radius: 8px;
    font-weight: 600;
    border: none;
    cursor: pointer;
  }

  .btn-secondary {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: var(--color-neutral-100, #f3f4f6);
    color: var(--color-neutral-800, #1f2937);
    padding: 9px 16px;
    border-radius: 8px;
    font-weight: 600;
    border: 1px solid var(--color-neutral-300, #d1d5db);
    cursor: pointer;
    text-decoration: none;
  }

  .btn-icon {
    background: transparent;
    border: none;
    color: var(--color-red-500, #ef4444);
    padding: 4px;
    cursor: pointer;
  }

  .form-actions {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
  }

  .sub-text {
    font-size: 12px;
    color: var(--color-neutral-500, #6b7280);
  }

  .text-right { text-align: right; }
  .font-bold { font-weight: 700; }
  .loader-box { padding: 40px; text-align: center; }
</style>
