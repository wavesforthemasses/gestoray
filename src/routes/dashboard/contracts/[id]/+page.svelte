<script lang="ts">
  import { hasAccess } from '$lib/utils/authCheck';
  import { toast } from '$lib/stores/toast';
  import { confirmStore } from '$lib/stores/confirm';
  import { formatDate } from '$lib/utils/formatters';
  import { page } from '$app/stores';
  import { auth, activeRole } from '$lib/auth';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { ContractProductsList, ContractSignatures, ContractInstallments } from "$lib";
  import { ArrowLeft, AlertTriangle } from '@lucide/svelte';
  
  import { ContractDetailService, type ContractDataPayload } from './contract-detail.service';
  import ContractSummary from './components/ContractSummary.svelte';
  import ContractAdminActions from './components/ContractAdminActions.svelte';
  import ContractPaymentsList from './components/ContractPaymentsList.svelte';
  import ContractInstallmentModal from './components/ContractInstallmentModal.svelte';

  const contractId = $page.params.id as string;

  let loading = $state(true);
  let submitting = $state(false);

  let payload = $state<ContractDataPayload | null>(null);

  // For Smart Payment Distribution
  let productAllocations = $state<Array<{ productId: string, amount: number }>>([]);
  let productsStatus = $derived(
    payload?.contract?.original?.products?.map((p: any) => {
      let alreadyPaid = 0;
      for (const pay of payload?.paymentsList || []) {
        if (pay.productAllocations) {
          const alloc = pay.productAllocations.find((a: any) => a.productId === p.productId);
          if (alloc) alreadyPaid += alloc.amount;
        }
      }
      return {
        ...p,
        alreadyPaid,
        remaining: (p.priceSold * p.quantity) - alreadyPaid
      };
    }) || []
  );

  let isEditingProducts = $state(false);
  let editQuoteItems = $state<any[]>([]);
  let editSecondVendorUid = $state('');
  let editSecondVendorShare = $state(30);

  let editSelectedProductId = $state('');
  let editItemPriceSold = $state<number | null>(null);
  let editItemQuantity = $state(1);

  let editQuoteTotal = $derived(
    editQuoteItems.reduce((sum, item) => sum + item.priceSold * item.quantity, 0)
  );

  function startEditingProducts() {
    editQuoteItems = JSON.parse(JSON.stringify(payload?.contract.original?.products || []));
    editSecondVendorUid = payload?.contract.original?.secondVendorUid || '';
    editSecondVendorShare = payload?.contract.original?.secondVendorShare || 30;
    
    editSelectedProductId = '';
    editItemPriceSold = null;
    editItemQuantity = 1;
    
    isEditingProducts = true;
  }

  function cancelEditingProducts() {
    isEditingProducts = false;
  }

  function handleEditProductSelectChange(id: string) {
    const prod = payload?.productsList.find(p => p.id === id);
    if (prod) {
      editItemPriceSold = prod.listPrice;
    } else {
      editItemPriceSold = null;
    }
  }

  function handleAddEditQuoteItem() {
    if (!editSelectedProductId || !payload) return;
    const prod = payload.productsList.find(p => p.id === editSelectedProductId);
    if (!prod) return;

    const soldPrice = editItemPriceSold !== null ? editItemPriceSold : prod.listPrice;
    const existingIdx = editQuoteItems.findIndex(item => item.productId === editSelectedProductId);
    if (existingIdx > -1) {
      editQuoteItems[existingIdx].quantity += editItemQuantity;
      editQuoteItems[existingIdx].priceSold = soldPrice;
    } else {
      editQuoteItems.push({
        productId: prod.id,
        name: prod.name,
        listPrice: prod.listPrice,
        minPrice: prod.minPrice,
        priceSold: soldPrice,
        quantity: editItemQuantity
      });
    }

    editSelectedProductId = '';
    editItemPriceSold = null;
    editItemQuantity = 1;
  }

  function handleRemoveEditQuoteItem(index: number) {
    editQuoteItems.splice(index, 1);
  }

  async function saveEditedProducts() {
    if (editQuoteItems.length === 0 || !$auth || !payload) return;
    submitting = true;
    try {
      await ContractDetailService.saveEditedProducts(
        contractId,
        editQuoteItems,
        editQuoteTotal,
        editSecondVendorUid,
        payload.usersList,
        editSecondVendorShare,
        $auth.uid
      );
      toast.success('Prodotti e configurazione salvati con successo!');
      isEditingProducts = false;
      await fetchContractData();
    } catch (e: any) {
      console.error(e);
      toast.error('Errore durante il salvataggio dei prodotti: ' + e.message);
    } finally {
      submitting = false;
    }
  }

  async function fetchContractData() {
    loading = true;
    try {
      payload = await ContractDetailService.fetchContractData(contractId);
    } catch (e: any) {
      console.error(e);
      toast.error('Errore nel caricamento del contratto: ' + e.message);
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    const unsubscribe = activeRole.subscribe(($activeRole) => {
      if ($activeRole && !hasAccess($activeRole, ['superadmin', 'amministrazione', 'commerciale', 'direzione'])) {
        goto('/dashboard');
      }
    });

    fetchContractData();
    return () => unsubscribe();
  });

  async function handleApproveOnly() {
    if (!payload?.contract || !$auth) return;
    submitting = true;
    try {
      await ContractDetailService.approveOnly(contractId, $auth.uid, $auth.email!);
      toast.success('Contratto approvato con successo!');
      await fetchContractData();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Errore durante l\'approvazione del contratto.');
    } finally {
      submitting = false;
    }
  }

  async function handleApproveAndPlanInstallments() {
    await handleApproveOnly();
    document.getElementById('scadenziario-pagamenti')?.scrollIntoView({ behavior: 'smooth' });
  }

  async function handleApproveAndCollect() {
    if (!payload?.contract || !$auth) return;
    submitting = true;
    try {
      await ContractDetailService.approveAndCollectFull(contractId, $auth.uid, $auth.email!);
      toast.success('Contratto approvato ed incasso registrato correttamente!');
      await fetchContractData();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Errore durante l\'approvazione del contratto.');
    } finally {
      submitting = false;
    }
  }

  async function handleDeleteContract() {
    if (!payload) return;
    if (payload.paymentsList.length > 0) {
      alert("Impossibile eliminare un contratto con pagamenti reali/incassi attivi. Storna prima tutti gli incassi collegati.");
      return;
    }
    const ok = await confirmStore.prompt("Sei sicuro di voler eliminare definitivamente questo contratto? Tutte le rate e le scadenze associate verranno eliminate. Questa azione è irreversibile.");
    if (!ok) return;
    submitting = true;
    try {
      await ContractDetailService.deleteContract(contractId, payload.installmentsList);
      toast.success('Contratto eliminato con successo!');
      setTimeout(() => { goto('/dashboard/contracts'); }, 1500);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Errore durante l'eliminazione del contratto.");
      submitting = false;
    }
  }

  async function handleReopenContract() {
    if (!$auth) return;
    const ok = await confirmStore.prompt("Sei sicuro di voler riaprire questo contratto e riportarlo in stato di attesa (pending)?");
    if (!ok) return;
    submitting = true;
    try {
      await ContractDetailService.reopenContract(contractId, $auth.uid);
      toast.success('Contratto riportato in stato di BOZZA con successo!');
      await fetchContractData();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Errore durante il ripristino del contratto.");
    } finally {
      submitting = false;
    }
  }

  // Signature
  let sigCanvas = $state<HTMLCanvasElement | null>(null);
  let isDrawing = false;

  function startDrawing(e: MouseEvent | TouchEvent) {
    if (!sigCanvas) return;
    const ctx = sigCanvas.getContext('2d');
    if (!ctx) return;

    isDrawing = true;
    const rect = sigCanvas.getBoundingClientRect();
    const x = ('touches' in e) ? (e as TouchEvent).touches[0].clientX - rect.left : (e as MouseEvent).clientX - rect.left;
    const y = ('touches' in e) ? (e as TouchEvent).touches[0].clientY - rect.top : (e as MouseEvent).clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function draw(e: MouseEvent | TouchEvent) {
    if (!isDrawing || !sigCanvas) return;
    const ctx = sigCanvas.getContext('2d');
    if (!ctx) return;

    const rect = sigCanvas.getBoundingClientRect();
    const x = ('touches' in e) ? (e as TouchEvent).touches[0].clientX - rect.left : (e as MouseEvent).clientX - rect.left;
    const y = ('touches' in e) ? (e as TouchEvent).touches[0].clientY - rect.top : (e as MouseEvent).clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  function stopDrawing() {
    isDrawing = false;
  }

  function clearSignature() {
    if (!sigCanvas) return;
    const ctx = sigCanvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, sigCanvas.width, sigCanvas.height);
  }

  async function saveSignature() {
    if (!sigCanvas || !$auth) return;
    submitting = true;
    try {
      const signatureDataUrl = sigCanvas.toDataURL('image/png');
      await ContractDetailService.saveSignature(contractId, signatureDataUrl, $auth.uid);
      toast.success('Firma del cliente salvata con successo!');
      await fetchContractData();
    } catch (err: any) {
      console.error(err);
      toast.error('Errore durante il salvataggio della firma: ' + err.message);
    } finally {
      submitting = false;
    }
  }

  async function handleClearSignatureDb() {
    if (!$auth) return;
    const ok = await confirmStore.prompt("Sei sicuro di voler rimuovere la firma esistente?");
    if (!ok) return;
    submitting = true;
    try {
      await ContractDetailService.clearSignature(contractId, $auth.uid);
      toast.success('Firma rimossa.');
      await fetchContractData();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Errore durante la rimozione della firma.');
    } finally {
      submitting = false;
    }
  }

  // Installments
  let installmentDueDate = $state(new Date().toISOString().split('T')[0]);
  let installmentExpectedAmount = $state<number | null>(null);
  let installmentActualAmount = $state<number | null>(null);
  let showInstallmentModal = $state(false);
  let selectedInstallmentId = $state<string | null>(null);

  async function handleAddInstallment(e: Event) {
    e.preventDefault();
    if (!payload?.contract || !installmentExpectedAmount || !$auth) return;
    submitting = true;
    try {
      await ContractDetailService.addInstallment(
        payload.contract,
        contractId,
        installmentDueDate,
        installmentExpectedAmount,
        $auth.uid,
        $auth.email!
      );
      toast.success('Nuova scadenza di pagamento inserita con successo!');
      installmentExpectedAmount = null;
      showInstallmentModal = false;
      await fetchContractData();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Errore durante l\'inserimento della scadenza.');
    } finally {
      submitting = false;
    }
  }

  async function handlePostponeInstallment(id: string, newDate: string) {
    if (!payload?.contract || !$auth) return;
    submitting = true;
    try {
      await ContractDetailService.postponeInstallment(
        payload.contract,
        contractId,
        id,
        newDate,
        $auth.uid,
        $auth.email!
      );
      toast.success('Scadenza di pagamento posticipata con successo!');
      await fetchContractData();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Errore durante lo slittamento.');
    } finally {
      submitting = false;
    }
  }

  async function handleDeleteInstallment(instId: string) {
    if (!payload) return;
    const inst = payload.installmentsList.find(i => i.id === instId);
    if (!inst) return;
    if (inst.status === 'paid') {
      alert("Impossibile eliminare una rata già pagata. Storna prima il relativo incasso.");
      return;
    }
    const ok = await confirmStore.prompt("Sei sicuro di voler eliminare questa rata dallo scadenziario?");
    if (!ok) return;
    submitting = true;
    try {
      await ContractDetailService.deleteInstallment(contractId, instId);
      toast.success('Rata eliminata dallo scadenziario con successo!');
      await fetchContractData();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Errore durante l'eliminazione della rata.");
    } finally {
      submitting = false;
    }
  }

  async function handleCollectInstallment() {
    if (!payload?.contract || !$auth || !selectedInstallmentId || installmentActualAmount === null) return;
    submitting = true;
    try {
      await ContractDetailService.collectInstallment(
        contractId, 
        selectedInstallmentId, 
        installmentActualAmount, 
        $auth.uid, 
        $auth.email!,
        productAllocations.filter(a => a.amount > 0)
      );
      toast.success(`Rata registrata come incassata per €${installmentActualAmount.toFixed(2)}!`);
      showInstallmentModal = false;
      installmentActualAmount = null;
      await fetchContractData();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Errore durante la registrazione dell\'incasso rata.');
    } finally {
      submitting = false;
    }
  }
</script>

<svelte:head>
  <title>Dettaglio Contratto | Gestoray</title>
</svelte:head>

<div class="contract-details-page animate-fade-in">
  <div class="page-top-actions">
    <button onclick={() => goto('/dashboard/contracts')} class="back-link-btn">
      <ArrowLeft size={16} /> Torna all'elenco contratti
    </button>
    <h2 class="title-header">Gestione Contratto: <code>{contractId}</code></h2>
  </div>

  {#if loading}
    <div class="loading-box">
      <span class="spinner"></span>
      Caricamento dettagli contratto...
    </div>
  {:else if payload?.contract}
    
    <div class="vertical-layout-stack">

      <!-- WARNING BOX -->
      {#if payload.contract.original?.hasWarning || payload.contract.original?.products?.some((p: any) => p.priceSold < p.minPrice)}
        <div class="pricing-warning-banner animate-fade-in">
          <div class="warning-icon-wrapper">
            <AlertTriangle size={32} />
          </div>
          <div class="warning-body">
            <h3>ATTENZIONE: Prezzi di Vendita Inferiori alla Soglia Minima</h3>
            <p>
              Questo contratto contiene uno o più articoli venduti a una quotazione inferiore alla <strong>soglia minima consentita</strong> dal listino prodotti aziendale. 
              Si prega di verificare la redditività dell'operazione. Le provvigioni del commerciale sono state ridotte al minimo garantito per questi articoli.
            </p>
            <ul class="under-min-products-list">
              {#each payload.contract.original?.products?.filter((p: any) => p.priceSold < p.minPrice) as item}
                <li>
                  <strong>{item.name}</strong>: Venduto a €{item.priceSold.toFixed(2)} (Minimo consentito: €{item.minPrice.toFixed(2)})
                  &mdash; Scostamento: <span class="negative-gap">-€{(item.minPrice - item.priceSold).toFixed(2)}</span>
                </li>
              {/each}
            </ul>
          </div>
        </div>
      {/if}

      <!-- Contract Info Cards -->
      <ContractSummary 
        contract={payload.contract} 
        vendorQual={payload.vendorQual} 
      />

      <!-- Products Table Widescreen -->
      <ContractProductsList
        contract={payload.contract}
        productsList={payload.productsList}
        usersList={payload.usersList}
        bind:isEditingProducts
        bind:editSelectedProductId
        bind:editItemPriceSold
        bind:editItemQuantity
        bind:editQuoteItems
        bind:editQuoteTotal
        bind:editSecondVendorUid
        bind:editSecondVendorShare
        {submitting}
        {startEditingProducts}
        {handleEditProductSelectChange}
        {handleAddEditQuoteItem}
        {handleRemoveEditQuoteItem}
        {cancelEditingProducts}
        {saveEditedProducts}
      />

      <!-- Signature Card -->
      <ContractSignatures
        contract={payload.contract}
        activeRole={$activeRole}
        bind:sigCanvas
        {startDrawing}
        {draw}
        {stopDrawing}
        {clearSignature}
        {saveSignature}
        {handleClearSignatureDb}
      />

      <!-- Admin Actions Card -->
      <ContractAdminActions
        contract={payload.contract}
        activeRole={$activeRole}
        {submitting}
        onApproveOnly={handleApproveOnly}
        onApproveAndPlan={handleApproveAndPlanInstallments}
        onApproveAndCollect={handleApproveAndCollect}
        onDeleteContract={handleDeleteContract}
        onReopenContract={handleReopenContract}
      />

      <!-- PIANO RECUPERO CREDITI / SCADENZE PAGAMENTI CARD -->
      <ContractInstallments
        installmentsList={payload.installmentsList}
        contract={payload.contract}
        activeRole={$activeRole}
        {formatDate}
        bind:selectedInstallmentId
        bind:installmentActualAmount
        bind:productAllocations
        bind:showInstallmentModal
        bind:installmentDueDate
        bind:installmentExpectedAmount
        {handlePostponeInstallment}
        {handleDeleteInstallment}
        {handleAddInstallment}
      />

      <!-- INCASSI COLLEGATI CARD -->
      <ContractPaymentsList 
        paymentsList={payload.paymentsList} 
      />

    </div>
  {/if}
</div>

{#if showInstallmentModal}
  <ContractInstallmentModal
    bind:installmentActualAmount
    {productsStatus}
    bind:productAllocations
    {selectedInstallmentId}
    onClose={() => showInstallmentModal = false}
    onCollect={handleCollectInstallment}
  />
{/if}

<style>
  .contract-details-page {
    width: 100%;
  }

  .page-top-actions {
    display: flex;
    align-items: center;
    gap: 20px;
    margin-bottom: 25px;
    flex-wrap: wrap;
  }

  .back-link-btn {
    background: var(--color-white);
    border: 1px solid var(--color-neutral-300);
    color: var(--color-neutral-600);
    padding: 8px 14px;
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-family: inherit;
    font-size: 13px;
    font-weight: 600;
    transition: all 0.2s;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .back-link-btn:hover {
    background: var(--color-neutral-100);
    color: var(--color-neutral-800);
  }

  .title-header {
    margin: 0;
    font-size: 20px;
    font-weight: 700;
    color: var(--color-neutral-800);
  }

  .loading-box {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 40px;
    color: var(--color-neutral-500);
    background: var(--color-white);
    border: 1px solid var(--color-neutral-200);
    border-radius: var(--radius-lg);
  }

  .spinner {
    width: 20px;
    height: 20px;
    border: 2px solid hsla(var(--brand-h), var(--brand-s), var(--brand-l), 0.15);
    border-radius: 50%;
    border-top-color: var(--color-primary-500);
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .vertical-layout-stack {
    display: flex;
    flex-direction: column;
    gap: 30px;
  }

  .pricing-warning-banner {
    display: flex;
    gap: 20px;
    background: hsla(0, 100%, 97%, 1);
    border: 1px solid var(--color-error-border);
    border-left: 6px solid var(--color-error);
    border-radius: var(--radius-md);
    padding: 20px;
    align-items: flex-start;
  }

  .warning-icon-wrapper {
    color: var(--color-error);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .warning-body {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .warning-body h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 700;
    color: var(--color-error-text);
  }

  .warning-body p {
    margin: 0;
    font-size: 13px;
    color: var(--color-neutral-700);
    line-height: 1.5;
  }

  .under-min-products-list {
    margin: 8px 0 0 0;
    padding-left: 20px;
    font-size: 12.5px;
    color: var(--color-neutral-800);
  }

  .under-min-products-list li {
    margin-bottom: 4px;
  }

  .negative-gap {
    color: var(--color-error-text);
    font-weight: 700;
  }

  .animate-fade-in {
    animation: fadeIn 0.3s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  }
</style>
