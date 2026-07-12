<script lang="ts">
  interface Props {
    selectedAlloc: any;
    distributionProducts: any[];
    productAllocations: Array<{ productId: string, amount: number }>;
    submitting: boolean;
    onClose: () => void;
    onSave: () => void;
  }

  let {
    selectedAlloc,
    distributionProducts,
    productAllocations = $bindable(),
    submitting,
    onClose,
    onSave
  } = $props();

  function distributeProportionally() {
    if (!selectedAlloc) return;
    const totalRemaining = distributionProducts.reduce((sum: number, p: any) => sum + p.remaining, 0);
    if (totalRemaining <= 0) return;
    
    const factor = selectedAlloc.amount / totalRemaining;
    productAllocations = distributionProducts.map((p: any) => ({
      productId: p.productId,
      amount: Math.min(p.remaining, Number((p.remaining * factor).toFixed(2)))
    }));
  }

  function distributeToProduct(pid: string) {
    if (!selectedAlloc) return;
    productAllocations = productAllocations.map((a: any) => ({
      productId: a.productId,
      amount: a.productId === pid ? (selectedAlloc.amount || 0) : 0
    }));
  }
</script>

<div class="installment-modal-overlay">
  <div class="installment-modal-box">
    <h3 class="modal-title">Distribuzione sui Servizi</h3>
    <p class="modal-desc">
      Quota allocata al contratto: <strong>€ {selectedAlloc?.amount?.toFixed(2)}</strong>
    </p>
    
    <div class="distribution-section">
      <div class="dist-actions">
        <button type="button" class="back-link-btn" onclick={distributeProportionally}>
          Distribuisci Proporzionalmente
        </button>
        {#each distributionProducts as p}
          {#if selectedAlloc?.amount === p.remaining && p.remaining > 0}
            <button type="button" class="back-link-btn accent-btn" onclick={() => distributeToProduct(p.productId)}>
              Assegna a {p.name}
            </button>
          {/if}
        {/each}
      </div>
      <div class="dist-list">
        {#each distributionProducts as p, idx}
          <div class="dist-row">
            <span class="dist-name">{p.name} (Restante: €{p.remaining.toFixed(2)})</span>
            <div class="dist-input-wrapper">
              € <input type="number" bind:value={productAllocations[idx].amount} min="0" step="0.01" class="dist-input" />
            </div>
          </div>
        {/each}
      </div>
    </div>

    <div class="modal-actions">
      <button type="button" class="back-link-btn cancel-btn" onclick={onClose} disabled={submitting}>Annulla</button>
      <button type="button" class="approve-collect-btn" onclick={onSave} disabled={submitting}>
        {submitting ? 'Salvataggio...' : 'Salva Distribuzione'}
      </button>
    </div>
  </div>
</div>

<style>
  .installment-modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0,0,0,0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .installment-modal-box {
    background: white;
    padding: 24px;
    border-radius: var(--radius-lg);
    width: 100%;
    max-width: 400px;
    box-shadow: var(--shadow-lg);
  }

  .modal-title {
    margin-top: 0;
    font-size: 16px;
    font-weight: 700;
    color: var(--color-neutral-800);
    margin-bottom: 8px;
  }

  .modal-desc {
    font-size: 13px;
    color: var(--color-neutral-500);
    margin-bottom: 16px;
  }

  .distribution-section {
    margin-top: 16px;
  }

  .dist-actions {
    display: flex;
    gap: 8px;
    margin-bottom: 12px;
    flex-wrap: wrap;
  }

  .dist-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .dist-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 12px;
  }

  .dist-name {
    flex: 1;
  }

  .dist-input-wrapper {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .dist-input {
    width: 80px;
    padding: 4px;
    border: 1px solid var(--color-neutral-300);
    border-radius: 4px;
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    margin-top: 20px;
  }

  .back-link-btn {
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
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .back-link-btn:hover:not(:disabled) {
    background: var(--color-neutral-100);
    color: var(--color-neutral-800);
  }

  .back-link-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .accent-btn {
    color: var(--color-primary-600);
    border-color: var(--color-primary-600);
  }

  .cancel-btn {
    padding: 12px 24px;
    font-size: 14px;
  }

  .approve-collect-btn {
    background: linear-gradient(135deg, var(--color-success), #16a34a);
    color: var(--color-white);
    border: none;
    padding: 12px 24px;
    border-radius: var(--radius-md);
    font-family: inherit;
    font-weight: 600;
    font-size: 14px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    box-shadow: 0 4px 12px rgba(22, 163, 74, 0.2);
    transition: opacity 0.2s;
  }

  .approve-collect-btn:hover:not(:disabled) {
    opacity: 0.9;
  }

  .approve-collect-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
</style>
