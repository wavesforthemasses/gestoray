<script lang="ts">
  import { FormField } from '$lib';

  interface Props {
    installmentActualAmount: number | null;
    onClose: () => void;
    onConfirm: (amount: number) => void;
  }

  let {
    installmentActualAmount = $bindable(),
    onClose,
    onConfirm
  }: Props = $props();

  function scuorporaIva() {
    if (installmentActualAmount) {
      installmentActualAmount = parseFloat((installmentActualAmount / 1.22).toFixed(2));
    }
  }

  function handleConfirm() {
    onConfirm(installmentActualAmount || 0);
  }
</script>

<div class="installment-modal-overlay">
  <div class="installment-modal-box">
    <h3>Registra Incasso Rata</h3>
    <p>Digita l'importo effettivo al netto di IVA riscosso per questa scadenza.</p>
    
    <FormField id="todo-actual-amount" label="Importo Imponibile Incassato (€)">
      <div class="input-with-button">
        <input type="number" id="todo-actual-amount" bind:value={installmentActualAmount} min="0" step="0.01" required />
        <button type="button" class="back-link-btn" onclick={scuorporaIva}>
          Scorpora IVA (22%)
        </button>
      </div>
    </FormField>

    <div class="modal-buttons">
      <button type="button" class="back-link-btn" onclick={onClose}>Annulla</button>
      <button type="button" class="approve-collect-btn" onclick={handleConfirm}>
        Conferma Incasso Rata
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
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    animation: modalFade 0.2s ease-out;
  }

  @keyframes modalFade {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .installment-modal-box {
    background: var(--color-white);
    padding: 24px;
    border-radius: var(--radius-lg);
    width: 100%;
    max-width: 400px;
    box-shadow: var(--shadow-lg);
  }

  .installment-modal-box h3 {
    margin-top: 0;
    font-size: 16px;
    font-weight: 700;
    color: var(--color-neutral-800);
    margin-bottom: 12px;
  }

  .installment-modal-box p {
    font-size: 13px;
    color: var(--color-neutral-500);
    margin-bottom: 16px;
    line-height: 1.4;
  }

  .input-with-button {
    display: flex;
    gap: 8px;
    width: 100%;
  }

  .input-with-button input {
    flex: 1;
  }

  .modal-buttons {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    margin-top: 20px;
  }

  .approve-collect-btn {
    background: var(--color-primary-500);
    color: var(--color-white);
    border: none;
    padding: 8px 16px;
    border-radius: var(--radius-sm);
    font-family: inherit;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: opacity 0.2s;
  }

  .approve-collect-btn:hover {
    opacity: 0.9;
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
</style>
