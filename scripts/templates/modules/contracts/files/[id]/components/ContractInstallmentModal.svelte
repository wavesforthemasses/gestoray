<script lang="ts">
  import { FormField } from '$lib';

  interface Props {
    installmentActualAmount: number | null;
    productsStatus: any[];
    productAllocations: Array<{ productId: string, amount: number }>;
    selectedInstallmentId: string | null;
    onClose: () => void;
    onCollect: () => void;
  }

  let {
    installmentActualAmount = $bindable(),
    productsStatus,
    productAllocations = $bindable(),
    selectedInstallmentId,
    onClose,
    onCollect
  } = $props();

  function distributeProportionally() {
    let toDistribute = installmentActualAmount || 0;
    const totalRemaining = productsStatus.reduce((sum: number, p: any) => sum + p.remaining, 0);
    if (totalRemaining <= 0) return;

    productAllocations = productsStatus.map((p: any) => {
      const ratio = p.remaining / totalRemaining;
      return {
        productId: p.productId,
        amount: parseFloat(((Number(toDistribute * ratio) || 0)).toFixed(2))
      };
    });
  }

  function distributeToProduct(productId: string) {
    productAllocations = productsStatus.map((p: any) => {
      if (p.productId === productId) {
        return { productId: p.productId, amount: installmentActualAmount || 0 };
      }
      return { productId: p.productId, amount: 0 };
    });
  }
</script>

<div class="installment-modal-overlay">
  <div class="installment-modal-box">
    <h3 class="modal-title">Registra Incasso Rata</h3>
    <p class="modal-desc">
      Inserisci l'importo imponibile effettivamente incassato per questa rata (al netto di IVA). 
      Puoi scorporare l'IVA al 22% se l'importo inserito è lordo.
    </p>
    <FormField id="inst-actual-amount" label="Importo Effettivo Incassato (€)">
      <div class="input-with-button">
        <input type="number" id="inst-actual-amount" bind:value={installmentActualAmount} min="0" step="0.01" required />
        <button type="button" class="back-link-btn" onclick={() => {
          if (installmentActualAmount) {
            installmentActualAmount = parseFloat(((Number(installmentActualAmount) || 0) / 1.22).toFixed(2));
          }
        }}>
          Scorpora IVA
        </button>
      </div>
    </FormField>
    
    <div class="distribution-section">
      <h4 class="dist-title">Distribuzione sui Servizi</h4>
      <div class="dist-actions">
        <button type="button" class="back-link-btn" onclick={distributeProportionally}>
          Distribuisci Proporzionalmente
        </button>
        {#each productsStatus as p}
          {#if installmentActualAmount === p.remaining && p.remaining > 0}
            <button type="button" class="back-link-btn accent-btn" onclick={() => distributeToProduct(p.productId)}>
              Assegna a {p.name}
            </button>
          {/if}
        {/each}
      </div>
      <div class="dist-list">
        {#each productsStatus as p, idx}
          <div class="dist-row">
            <span class="dist-name">{p.name} (Restante: €{(Number(p.remaining) || 0).toFixed(2)})</span>
            <div class="dist-input-wrapper">
              € <input type="number" bind:value={productAllocations[idx].amount} min="0" step="0.01" class="dist-input" />
            </div>
          </div>
        {/each}
      </div>
    </div>

    <div class="modal-actions">
      <button type="button" class="back-link-btn cancel-btn" onclick={onClose}>Annulla</button>
      <button type="button" class="approve-collect-btn" onclick={() => {
        if (installmentActualAmount !== null && selectedInstallmentId !== null) {
          onCollect();
        }
      }}>
        Conferma Incasso
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
    margin-bottom: 12px;
  }

  .modal-desc {
    font-size: 13px;
    color: var(--color-neutral-500);
    margin-bottom: 16px;
  }

  .input-with-button {
    display: flex;
    gap: 8px;
  }

  .input-with-button input {
    flex: 1;
  }

  .distribution-section {
    margin-top: 16px;
  }

  .dist-title {
    font-size: 13px;
    font-weight: 700;
    margin-bottom: 8px;
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
    padding: 8px 14px;
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

  .back-link-btn:hover {
    background: var(--color-neutral-100);
    color: var(--color-neutral-800);
  }

  .cancel-btn {
    padding: 12px 24px;
    font-size: 14px;
  }

  .accent-btn {
    color: var(--color-primary-600);
    border-color: var(--color-primary-600);
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

  .approve-collect-btn:hover {
    opacity: 0.9;
  }
</style>
