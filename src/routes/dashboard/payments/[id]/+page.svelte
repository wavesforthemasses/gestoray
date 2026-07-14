<script lang="ts">
  import { hasAccess } from '$lib/utils/authCheck';
  import { toast } from '$lib/stores/toast.svelte';
  import { confirmStore } from '$lib/stores/confirm.svelte';
  import { page } from '$app/stores';
  import { authState, activeRoleState } from '$lib/auth.svelte';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { pageTitle } from '$lib/stores/page';
  pageTitle.set('Dettaglio Incasso');
  import { ArrowLeft } from '@lucide/svelte';
  
  import { PaymentDetailService, type PaymentDataPayload } from './payment-detail.service';
  import PaymentSummary from './components/PaymentSummary.svelte';
  import PaymentAllocations from './components/PaymentAllocations.svelte';
  import PaymentAdminActions from './components/PaymentAdminActions.svelte';
  import PaymentDistributionModal from './components/PaymentDistributionModal.svelte';

  const paymentId = $page.params.id as string;

  let loading = $state(true);
  let submitting = $state(false);

  let payload = $state<PaymentDataPayload | null>(null);

  let totalDistributedOnProducts = $derived(
    payload?.allocationsList.reduce((acc, alloc) => {
      return acc + (alloc.productAllocations?.reduce((sum: number, p: any) => sum + p.amount, 0) || 0);
    }, 0) || 0
  );

  // Modal State
  let showDistributionModal = $state(false);
  let selectedAlloc = $state<any>(null);
  let distributionProducts = $state<any[]>([]);
  let productAllocations = $state<{productId: string, amount: number}[]>([]);

  async function openDistributionModal(alloc: any) {
    selectedAlloc = alloc;
    loading = true;
    try {
      const cData = await PaymentDetailService.fetchContractForDistribution(alloc.contractId);
      
      distributionProducts = cData.original?.products?.map((p: any) => {
        const totalPaidToProduct = cData.derived?.productPaidAmount?.[p.productId] || 0;
        const paidInThisAlloc = alloc.productAllocations?.find((a: any) => a.productId === p.productId)?.amount || 0;
        const paidBeforeThisAlloc = totalPaidToProduct - paidInThisAlloc;
        const remaining = (p.priceSold * p.quantity) - paidBeforeThisAlloc;
        
        return {
          productId: p.productId,
          name: p.name,
          total: p.priceSold * p.quantity,
          remaining: remaining
        };
      }) || [];
      
      productAllocations = distributionProducts.map(p => {
        const existing = alloc.productAllocations?.find((a: any) => a.productId === p.productId);
        return { productId: p.productId, amount: existing ? existing.amount : 0 };
      });
      
      showDistributionModal = true;
    } catch (e) {
      console.error(e);
      toast.error("Errore caricamento contratto.");
    } finally {
      loading = false;
    }
  }

  async function handleSaveDistribution() {
    if (!selectedAlloc || !authState.user) return;
    submitting = true;
    try {
      await PaymentDetailService.saveDistribution(paymentId, selectedAlloc.id, productAllocations, authState.user.uid);
      showDistributionModal = false;
      toast.success('Distribuzione salvata.');
      await fetchPaymentDetails();
    } catch (e) {
      console.error(e);
      toast.error("Errore salvataggio distribuzione.");
    } finally {
      submitting = false;
    }
  }

  async function fetchPaymentDetails() {
    loading = true;
    try {
      payload = await PaymentDetailService.fetchPaymentData(paymentId);
    } catch (e: any) {
      console.error(e);
      toast.error(e.message);
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    const currentRole = activeRoleState.role;
    if (currentRole && !hasAccess(currentRole, ['superadmin', 'amministrazione', 'direzione'])) {
      goto('/dashboard');
    }
  });

  onMount(() => {

    fetchPaymentDetails();
  });

  async function handleDeletePayment() {
    if (!payload) return;
    const ok = await confirmStore.prompt("Sei sicuro di voler eliminare definitivamente questo incasso? Tutte le quote distribuite sui contratti verranno stornate ed i saldi ricalcolati automaticamente.");
    if (!ok) return;

    submitting = true;
    try {
      await PaymentDetailService.deletePayment(paymentId, payload.allocationsList);
      toast.success('Incasso stornato e rimosso con successo! Reindirizzamento...');
      setTimeout(() => { goto('/dashboard/payments'); }, 1500);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Errore durante l'eliminazione dell'incasso.");
      submitting = false;
    }
  }
</script>



<div class="payment-details-page animate-fade-in">
  <div class="page-top-actions">
    <a href="/dashboard/payments" class="back-link-btn action-link">
      <ArrowLeft size={16} /> Torna al registro incassi
    </a>
    <h2 class="title-header">Dettaglio Incasso</h2>
  </div>

  {#if loading}
    <div class="loading-box">
      <span class="spinner"></span>
      Caricamento dettagli incasso...
    </div>
  {:else if payload?.payment}
    <div class="vertical-layout-stack">

      <!-- Payment Summary Card -->
      <PaymentSummary 
        payment={payload.payment} 
        {totalDistributedOnProducts}
        recordedUserName={payload.recordedUserName}
      />

      <!-- Allocation details -->
      <PaymentAllocations 
        allocationsList={payload.allocationsList}
        onOpenDistributionModal={openDistributionModal}
      />

      <!-- Danger Delete Panel -->
      <PaymentAdminActions 
        activeRole={activeRoleState.role}
        {submitting}
        onDeletePayment={handleDeletePayment}
      />

    </div>
  {/if}
</div>

{#if showDistributionModal}
  <PaymentDistributionModal
    {selectedAlloc}
    {distributionProducts}
    bind:productAllocations
    {submitting}
    onClose={() => showDistributionModal = false}
    onSave={handleSaveDistribution}
  />
{/if}

<style>
  .payment-details-page {
    width: 100%;
  }

  .page-top-actions {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 24px;
  }

  .title-header {
    font-size: 24px;
    font-weight: 700;
    margin: 0;
    color: var(--color-neutral-800);
  }

  .back-link-btn {
    background: transparent;
    border: none;
    color: var(--color-neutral-500);
    padding: 0;
    cursor: pointer;
    font-family: inherit;
    font-size: 14px;
    font-weight: 600;
    transition: color 0.2s;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    align-self: flex-start;
  }

  .back-link-btn:hover {
    color: var(--color-neutral-800);
  }

  .vertical-layout-stack {
    display: flex;
    flex-direction: column;
    gap: 24px;
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

  .animate-fade-in {
    animation: fadeIn 0.3s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .action-link {
    text-decoration: none;
  }
</style>
