<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { WarehouseService } from '../../warehouse.service';
  import type { SupplierItem, PurchaseOrderItemLine } from '../../schema';
  import { toast } from '$lib/stores/toast.svelte';
  import { 
    Truck, 
    List, 
    CheckCircle2, 
    Plus, 
    Trash2, 
    Package, 
    RefreshCw, 
    DollarSign, 
    Calendar, 
    Building2 
  } from '@lucide/svelte';
  import { menuConfigStore } from '$lib/stores/menu';
  import { roundCurrency } from '$lib/utils/math';
  import { Autocomplete, type AutocompleteOption } from '$lib';

  let suppliers = $state<SupplierItem[]>([]);
  let productsCatalog = $state<Array<{ id: string; name: string; sku?: string; price?: number; unit?: string }>>([]);
  let loadingCatalog = $state(true);

  let supplierOptions = $derived<AutocompleteOption[]>(
    suppliers.map(s => ({
      id: s.id,
      label: s.companyName,
      sublabel: `${s.supplierNumber}${s.vatNumber ? ' • P.IVA ' + s.vatNumber : ''}`
    }))
  );

  let productOptions = $derived<AutocompleteOption[]>(
    productsCatalog.map(p => ({
      id: p.id,
      label: p.name,
      sublabel: `${p.sku ? p.sku + ' • ' : ''}€ ${(p.price || 0).toFixed(2)}`
    }))
  );

  let selectedSupplierId = $state('');
  let orderDate = $state(new Date().toISOString().split('T')[0]);
  let expectedDeliveryDate = $state('');
  let destinationPlaceId = $state('default');
  let destinationPlaceName = $state('Magazzino Centrale');
  let deliveryNotes = $state('');
  let notes = $state('');

  let lines = $state<PurchaseOrderItemLine[]>([]);
  let isSaving = $state(false);

  onMount(async () => {
    try {
      suppliers = await WarehouseService.getSuppliers();
      if (suppliers.length > 0) {
        selectedSupplierId = suppliers[0].id;
      }

      // Dynamic Plugin Bridge to load purchasable products catalog
      if ($menuConfigStore.some(m => m.id === 'products')) {
        const mod: any = await import('../../../products/products.service');
        const prods = mod.ProductsService.getPurchasableProducts 
          ? await mod.ProductsService.getPurchasableProducts() 
          : (await mod.ProductsService.getProducts()).filter((p: any) => p.canBePurchased !== false && p.usageType !== 'sale');
        productsCatalog = (prods as any[]).map((p: any) => ({
          id: p.id,
          name: p.name,
          sku: p.sku || '',
          price: roundCurrency(p.purchasePrice !== undefined && p.purchasePrice > 0 ? p.purchasePrice : (p.price ?? 0)),
          unit: p.unit || 'pz'
        }));
      }
    } catch (err) {
      console.error('Errore caricamento catalogo / fornitori:', err);
    } finally {
      loadingCatalog = false;
    }
  });

  function addLine() {
    const firstProd = productsCatalog.length > 0 ? productsCatalog[0] : null;
    const newLine: PurchaseOrderItemLine = {
      productId: firstProd ? firstProd.id : '',
      productName: firstProd ? firstProd.name : '',
      sku: firstProd ? (firstProd.sku || '') : '',
      unit: firstProd ? (firstProd.unit || 'pz') : 'pz',
      orderedQty: 1,
      receivedQty: 0,
      unitPrice: firstProd ? (firstProd.price || 0) : 0,
      vatRate: 22,
      discountPercent: 0,
      subtotalNet: firstProd ? (firstProd.price || 0) : 0,
      subtotalVat: firstProd ? roundCurrency((firstProd.price || 0) * 0.22) : 0,
      subtotalGross: firstProd ? roundCurrency((firstProd.price || 0) * 1.22) : 0
    };
    lines = [...lines, newLine];
    recalculateTotals();
  }

  function removeLine(idx: number) {
    lines = lines.filter((_, i) => i !== idx);
    recalculateTotals();
  }

  function handleProductChange(idx: number, productId: string) {
    const found = productsCatalog.find(p => p.id === productId);
    if (found && lines[idx]) {
      lines[idx].productId = found.id;
      lines[idx].productName = found.name;
      lines[idx].sku = found.sku || '';
      lines[idx].unit = found.unit || 'pz';
      lines[idx].unitPrice = found.price || 0;
      updateLineCalculation(idx);
    }
  }

  function updateLineCalculation(idx: number) {
    if (!lines[idx]) return;
    const totals = WarehouseService.calculateLineTotals(lines[idx]);
    lines[idx].subtotalNet = totals.subtotalNet;
    lines[idx].subtotalVat = totals.subtotalVat;
    lines[idx].subtotalGross = totals.subtotalGross;
  }

  let totalNetAmount = $derived(
    lines.reduce((acc, l) => acc + (l.subtotalNet || 0), 0)
  );

  let totalVatAmount = $derived(
    lines.reduce((acc, l) => acc + (l.subtotalVat || 0), 0)
  );

  let totalGrossAmount = $derived(
    lines.reduce((acc, l) => acc + (l.subtotalGross || 0), 0)
  );

  function recalculateTotals() {
    lines = lines.map(line => {
      const totals = WarehouseService.calculateLineTotals(line);
      return {
        ...line,
        subtotalNet: totals.subtotalNet,
        subtotalVat: totals.subtotalVat,
        subtotalGross: totals.subtotalGross
      };
    });
  }

  async function handleSubmit(e: Event) {
    e.preventDefault();
    if (!selectedSupplierId) {
      toast.error('Seleziona un fornitore');
      return;
    }
    if (lines.length === 0) {
      toast.error('Aggiungi almeno una riga articolo all\'ordine');
      return;
    }

    const supplier = suppliers.find(s => s.id === selectedSupplierId);
    isSaving = true;

    try {
      await WarehouseService.createPurchaseOrder({
        supplierId: selectedSupplierId,
        supplierName: supplier ? supplier.companyName : 'Fornitore',
        orderDate,
        expectedDeliveryDate: expectedDeliveryDate || undefined,
        status: 'bozza',
        destinationPlaceId,
        destinationPlaceName,
        items: lines,
        deliveryNotes,
        notes
      });

      toast.success('Ordine di acquisto creato con successo');
      goto('/dashboard/warehouse/orders');
    } catch (err: any) {
      console.error('Errore creazione ordine:', err);
      toast.error(err.message || 'Errore durante la creazione dell\'ordine');
    } finally {
      isSaving = false;
    }
  }
</script>

<svelte:head>
  <title>Nuovo Ordine di Acquisto - Gestoray</title>
</svelte:head>

<div class="form-page-container">
  <!-- Page Top Actions Bar -->
  <div class="page-top-actions">
    <div class="header-left">
      <div class="title-row">
        <div class="icon-bubble">
          <Truck size={24} class="text-primary-600" />
        </div>
        <div>
          <h1 class="page-title">Nuovo Ordine di Acquisto</h1>
          <p class="page-subtitle">Compila le righe d'ordine e invia l'ordine al fornitore</p>
        </div>
      </div>
    </div>

    <div class="header-right">
      <a href="/dashboard/warehouse/orders" class="btn-module-list">
        <List size={16} />
        <span>Elenco Ordini</span>
      </a>
    </div>
  </div>

  <!-- Form Card (100% Full Width) -->
  <div class="form-card">
    <form onsubmit={handleSubmit} class="form-layout">
      <!-- Section 1: Fornitore e Date -->
      <div class="form-section">
        <h3 class="section-title">Testata Ordine Fornitore</h3>
        <div class="fields-grid">
          <div class="form-group col-span-2">
            <label for="supplierSelect">Fornitore Intestatario *</label>
            {#if suppliers.length === 0}
              <div class="no-suppliers-warning">
                <span>Nessun fornitore registrato.</span>
                <a href="/dashboard/warehouse/suppliers/add" class="text-primary-600 font-semibold underline">Aggiungi Fornitore</a>
              </div>
            {:else}
              <Autocomplete 
                options={supplierOptions} 
                bind:value={selectedSupplierId} 
                placeholder="Cerca fornitore per ragione sociale o codice..." 
              />
            {/if}
          </div>

          <div class="form-group">
            <label for="orderDate">Data Emissione Ordine *</label>
            <input type="date" id="orderDate" bind:value={orderDate} required class="form-input" />
          </div>

          <div class="form-group">
            <label for="expectedDelivery">Data Prevista Consegna</label>
            <input type="date" id="expectedDelivery" bind:value={expectedDeliveryDate} class="form-input" />
          </div>
        </div>
      </div>

      <!-- Section 2: Righe Articoli -->
      <div class="form-section">
        <div class="section-header-row">
          <h3 class="section-title">Articoli in Ordine</h3>
          <button type="button" class="btn-action-primary" onclick={addLine}>
            <Plus size={15} />
            <span>Aggiungi Articolo</span>
          </button>
        </div>

        {#if lines.length === 0}
          <div class="empty-lines-placeholder">
            <Package size={32} class="text-slate-300" />
            <p>Nessun articolo inserito nell'ordine. Clicca su <strong>"Aggiungi Articolo"</strong> per iniziare.</p>
          </div>
        {:else}
          <div class="table-responsive">
            <table class="lines-table">
              <thead>
                <tr>
                  <th style="width: 35%;">Articolo da Catalogo</th>
                  <th style="width: 12%;">Q.tà</th>
                  <th style="width: 15%;">Prezzo Unit. (€)</th>
                  <th style="width: 10%;">Sconto %</th>
                  <th style="width: 10%;">IVA %</th>
                  <th class="text-right" style="width: 13%;">Imponibile</th>
                  <th style="width: 5%;"></th>
                </tr>
              </thead>
              <tbody>
                {#each lines as line, idx}
                  <tr>
                    <td>
                      {#if productsCatalog.length > 0}
                        <Autocomplete 
                          options={productOptions} 
                          value={line.productId} 
                          onchange={(selectedId) => handleProductChange(idx, selectedId)}
                          placeholder="Cerca articolo catalogo..." 
                        />
                      {:else}
                        <input 
                          type="text" 
                          bind:value={line.productName} 
                          class="form-input text-sm" 
                          placeholder="Nome articolo" 
                        />
                      {/if}
                    </td>
                    <td>
                      <div class="qty-field-row">
                        <input 
                          type="number" 
                          bind:value={line.orderedQty} 
                          min="0.1" 
                          step="any" 
                          oninput={() => updateLineCalculation(idx)}
                          class="form-input text-sm text-right" 
                        />
                        <span class="unit-text">{line.unit || 'pz'}</span>
                      </div>
                    </td>
                    <td>
                      <input 
                        type="number" 
                        bind:value={line.unitPrice} 
                        min="0" 
                        step="0.01" 
                        oninput={() => updateLineCalculation(idx)}
                        class="form-input text-sm text-right" 
                      />
                    </td>
                    <td>
                      <input 
                        type="number" 
                        bind:value={line.discountPercent} 
                        min="0" 
                        max="100" 
                        step="1" 
                        oninput={() => updateLineCalculation(idx)}
                        class="form-input text-sm text-right" 
                      />
                    </td>
                    <td>
                      <select 
                        bind:value={line.vatRate} 
                        onchange={() => updateLineCalculation(idx)}
                        class="form-select text-sm"
                      >
                        <option value={22}>22%</option>
                        <option value={10}>10%</option>
                        <option value={4}>4%</option>
                        <option value={0}>0% (Esente)</option>
                      </select>
                    </td>
                    <td class="text-right font-medium text-slate-800">
                      € {(line.subtotalNet || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td class="text-center">
                      <button 
                        type="button" 
                        class="btn-delete-row" 
                        title="Rimuovi riga" 
                        onclick={() => removeLine(idx)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      </div>

      <!-- Section 3: Totali & Riepilogo Economico -->
      <div class="totals-summary-card">
        <div class="totals-row">
          <span class="total-label">Totale Imponibile Netto:</span>
          <span class="total-val">€ {totalNetAmount.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
        <div class="totals-row">
          <span class="total-label">Totale Imposta IVA:</span>
          <span class="total-val">€ {totalVatAmount.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
        <div class="totals-row grand-total">
          <span class="total-label">Totale Lordo Ordine:</span>
          <span class="total-val text-primary-700">€ {totalGrossAmount.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
      </div>

      <!-- Section 4: Note -->
      <div class="form-section">
        <h3 class="section-title">Istruzioni di Consegna & Note</h3>
        <div class="form-group">
          <textarea 
            id="notes" 
            bind:value={deliveryNotes} 
            rows="2" 
            class="form-textarea" 
            placeholder="Indicazioni per il trasportatore o referente di cantiere..."
          ></textarea>
        </div>
      </div>

      <div class="form-actions">
        <a href="/dashboard/warehouse/orders" class="btn-secondary">Annulla</a>
        <button type="submit" class="btn-primary" disabled={isSaving}>
          {#if isSaving}
            <RefreshCw size={16} class="animate-spin" />
            <span>Salvataggio Ordine...</span>
          {:else}
            <CheckCircle2 size={16} />
            <span>Salva Bozza Ordine</span>
          {/if}
        </button>
      </div>
    </form>
  </div>
</div>

<style>
  .form-page-container {
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

  .form-card {
    width: 100%;
    background: #ffffff;
    border-radius: 12px;
    border: 1px solid var(--color-slate-200, #e2e8f0);
    padding: 2rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  }

  .form-layout {
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  .form-section {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding-bottom: 1.5rem;
    border-bottom: 1px solid var(--color-slate-100, #f1f5f9);
  }

  .section-header-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .section-title {
    font-size: 1rem;
    font-weight: 600;
    color: var(--color-slate-800, #1e293b);
    margin: 0;
  }

  .btn-action-primary {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.375rem 0.75rem;
    background: var(--color-primary-50, #eff6ff);
    color: var(--color-primary-700, #1d4ed8);
    border: 1px solid var(--color-primary-200, #bfdbfe);
    border-radius: 6px;
    font-size: 0.8125rem;
    font-weight: 600;
    cursor: pointer;
  }

  .fields-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 1.25rem;
  }

  .col-span-2 { grid-column: span 2; }
  @media (max-width: 640px) { .col-span-2 { grid-column: span 1; } }

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

  .form-select, .form-input, .form-textarea {
    width: 100%;
    padding: 0.5rem 0.75rem;
    border-radius: 6px;
    border: 1px solid var(--color-slate-300, #cbd5e1);
    font-size: 0.875rem;
    color: var(--color-slate-900, #0f172a);
    background: #ffffff;
  }

  .no-suppliers-warning {
    padding: 0.75rem;
    background: var(--color-amber-50, #fffbeb);
    border: 1px solid var(--color-amber-200, #fde68a);
    border-radius: 6px;
    font-size: 0.875rem;
    display: flex;
    gap: 0.5rem;
  }

  .empty-lines-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 2.5rem;
    border: 2px dashed var(--color-slate-200, #e2e8f0);
    border-radius: 8px;
    text-align: center;
    color: var(--color-slate-500, #64748b);
    gap: 0.5rem;
  }

  .table-responsive {
    width: 100%;
    overflow-x: auto;
  }

  .lines-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;
  }

  .lines-table th {
    background: var(--color-slate-50, #f8fafc);
    padding: 0.625rem 0.75rem;
    font-weight: 600;
    color: var(--color-slate-600, #475569);
    border-bottom: 1px solid var(--color-slate-200, #e2e8f0);
    text-align: left;
  }

  .lines-table td {
    padding: 0.625rem 0.75rem;
    border-bottom: 1px solid var(--color-slate-100, #f1f5f9);
    vertical-align: middle;
  }

  .qty-field-row {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .unit-text {
    font-size: 0.75rem;
    color: var(--color-slate-400, #94a3b8);
  }

  .btn-delete-row {
    background: none;
    border: none;
    color: var(--color-slate-400, #94a3b8);
    cursor: pointer;
    padding: 0.25rem;
    border-radius: 4px;
  }

  .btn-delete-row:hover {
    color: #e11d48;
    background: #fff1f2;
  }

  .totals-summary-card {
    background: var(--color-slate-50, #f8fafc);
    border-radius: 8px;
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    align-items: flex-end;
    border: 1px solid var(--color-slate-200, #e2e8f0);
  }

  .totals-row {
    display: flex;
    align-items: center;
    gap: 2rem;
    font-size: 0.875rem;
  }

  .total-label {
    color: var(--color-slate-600, #475569);
    font-weight: 500;
  }

  .total-val {
    font-weight: 600;
    min-width: 110px;
    text-align: right;
    color: var(--color-slate-800, #1e293b);
  }

  .totals-row.grand-total {
    border-top: 1px solid var(--color-slate-200, #e2e8f0);
    padding-top: 0.5rem;
    font-size: 1.125rem;
  }

  .totals-row.grand-total .total-label {
    font-weight: 700;
    color: var(--color-slate-900, #0f172a);
  }

  .totals-row.grand-total .total-val {
    font-weight: 800;
  }

  .form-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 1rem;
  }

  .btn-primary {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1.25rem;
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
    padding: 0.625rem 1.25rem;
    background: #ffffff;
    color: var(--color-slate-700, #334155);
    border-radius: 8px;
    font-weight: 500;
    font-size: 0.875rem;
    border: 1px solid var(--color-slate-300, #cbd5e1);
    text-decoration: none;
  }

  .text-right { text-align: right; }
  .text-center { text-align: center; }
</style>
