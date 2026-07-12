<script lang="ts">
  import { Card, FormField } from '$lib';
  import { Wallet, ArrowLeft, Percent } from '@lucide/svelte';
  import { PaymentsService } from '../payments.service';

  interface Props {
    clientsList: any[];
    onCancel: () => void;
    onSuccess: (msg: string) => void;
    authUser: any;
  }

  let { clientsList, onCancel, onSuccess, authUser } = $props();

  let loadingDropdowns = $state(false);
  let clientContracts = $state<any[]>([]);

  let selectedClientId = $state('');
  let selectedContractId = $state('');
  let amountInput = $state<number | null>(null);
  let submitting = $state(false);
  let errorMsg = $state('');

  async function handleClientChange() {
    selectedContractId = '';
    amountInput = null;
    if (selectedClientId) {
      loadingDropdowns = true;
      try {
        clientContracts = await PaymentsService.fetchClientContracts(selectedClientId);
      } catch (e) {
        console.error(e);
      } finally {
        loadingDropdowns = false;
      }
    } else {
      clientContracts = [];
    }
  }

  function handleContractChange(id: string) {
    const contr = clientContracts.find(c => c.id === id);
    if (contr) {
      amountInput = contr.totalPrice;
    } else {
      amountInput = null;
    }
  }

  function handleScorporoIva() {
    if (amountInput !== null) {
      amountInput = parseFloat((amountInput / 1.22).toFixed(2));
    }
  }

  async function handleSubmit(e: Event) {
    e.preventDefault();
    errorMsg = '';
    submitting = true;

    try {
      const result = await PaymentsService.registerPayment(
        selectedClientId,
        selectedContractId,
        amountInput!,
        clientsList,
        authUser
      );
      
      onSuccess(`Incasso registrato con successo per €${result.amountInput.toFixed(2)}. Il contratto è in fase di approvazione!`);
      
      // Form reset
      selectedClientId = '';
      selectedContractId = '';
      amountInput = null;
      clientContracts = [];
      
    } catch (err: any) {
      errorMsg = err.message || 'Errore durante la registrazione dell\'incasso.';
    } finally {
      submitting = false;
    }
  }
</script>

<Card
  title="Registra Nuovo Incasso"
  description="Seleziona il cliente e il relativo contratto per cui registrare l'avvenuto pagamento."
  class="form-card"
>
  {#snippet icon()}
    <Wallet size={20} class="icon-accent" />
  {/snippet}

  {#snippet headerSnippet()}
    <button onclick={onCancel} class="back-link">
      <ArrowLeft size={14} /> Annulla e Torna al registro
    </button>
  {/snippet}

  {#if loadingDropdowns}
    <div class="loader-box">
      <span class="spinner"></span>
      Caricamento dati di supporto...
    </div>
  {:else}
    <form onsubmit={handleSubmit} class="payment-form">
      {#if errorMsg}
        <div class="error-banner">
          {errorMsg}
        </div>
      {/if}

      <FormField id="pay-client" label="Seleziona Cliente" helpText="Scegli il cliente per visualizzarne i contratti emessi.">
        <select id="pay-client" bind:value={selectedClientId} onchange={handleClientChange} required disabled={submitting}>
          <option value="">-- Seleziona Cliente --</option>
          {#each clientsList as c}
            <option value={c.id}>{c.nome} {c.cognome || ''}</option>
          {/each}
        </select>
      </FormField>

      {#if selectedClientId}
        <FormField id="pay-contract" label="Seleziona Contratto Associato" helpText="Seleziona il contratto per cui inserire il saldo cassa.">
          <select 
            id="pay-contract" 
            bind:value={selectedContractId} 
            onchange={(e) => handleContractChange((e.target as HTMLSelectElement).value)}
            required 
            disabled={submitting}
          >
            <option value="">-- Seleziona Contratto --</option>
            {#each clientContracts as contr}
              <option value={contr.id}>
                Contratto {contr.id} &mdash; €{contr.totalPrice.toFixed(2)} ({contr.status === 'approved' ? 'Approvato' : 'In attesa'})
              </option>
            {/each}
            {#if clientContracts.length === 0}
              <option value="" disabled>Nessun contratto registrato per questo cliente</option>
            {/if}
          </select>
        </FormField>
      {/if}

      {#if selectedContractId}
        <div class="amount-field-wrapper">
          <FormField 
            id="pay-amount" 
            label="Importo Netto Incassato (€)" 
            helpText="Digita l'importo imponibile al netto di IVA. Il prezzo lordo contrattuale è preselezionato."
          >
            <div class="input-with-button">
              <input
                type="number"
                id="pay-amount"
                bind:value={amountInput}
                placeholder="es. 1000.00"
                required
                min="0"
                step="0.01"
                disabled={submitting}
              />
              <button 
                type="button" 
                onclick={handleScorporoIva} 
                class="vat-btn"
                title="Dividi l'importo immesso per 1.22 per ricavare l'imponibile netto al volo"
                disabled={submitting || amountInput === null}
              >
                <Percent size={14} /> Scorpora IVA (22%)
              </button>
            </div>
          </FormField>
        </div>
      {/if}

      <button type="submit" class="submit-btn" disabled={submitting || !selectedContractId || amountInput === null}>
        {#if submitting}
          Registrazione in corso...
        {:else}
          Registra e Approva Contratto
        {/if}
      </button>
    </form>
  {/if}
</Card>

<style>
  :global(.icon-accent) {
    color: var(--color-primary-500);
  }

  .back-link {
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

  .back-link:hover {
    background: var(--color-neutral-100);
    color: var(--color-neutral-800);
  }

  .loader-box {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 40px;
    color: var(--color-neutral-500);
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

  .payment-form {
    display: flex;
    flex-direction: column;
    gap: 20px;
    max-width: 600px;
  }

  .error-banner {
    background: var(--color-error-light);
    color: var(--color-error-text);
    padding: 12px 16px;
    border-radius: var(--radius-sm);
    border-left: 4px solid var(--color-error-500);
    font-size: 13px;
    font-weight: 500;
  }

  select, input[type="number"] {
    width: 100%;
    padding: 10px;
    border: 1px solid var(--color-neutral-300);
    border-radius: var(--radius-sm);
    background: var(--color-white);
    font-family: inherit;
    font-size: 14px;
    color: var(--color-neutral-800);
    transition: all 0.2s;
  }

  select:focus, input[type="number"]:focus {
    border-color: var(--color-primary-500);
    box-shadow: 0 0 0 3px hsla(var(--brand-h), var(--brand-s), var(--brand-l), 0.15);
    outline: none;
  }

  .input-with-button {
    display: flex;
    gap: 10px;
    width: 100%;
  }

  .input-with-button input {
    flex: 1;
  }

  .vat-btn {
    background: var(--color-neutral-100);
    border: 1px solid var(--color-neutral-300);
    color: var(--color-neutral-600);
    padding: 10px 14px;
    border-radius: var(--radius-sm);
    font-family: inherit;
    font-size: 12.5px;
    font-weight: 600;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    transition: all 0.2s;
    white-space: nowrap;
  }

  .vat-btn:hover:not(:disabled) {
    background: var(--color-neutral-200);
    color: var(--color-neutral-800);
  }

  .vat-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .submit-btn {
    background: linear-gradient(135deg, var(--color-primary-500), var(--color-primary-600));
    color: var(--color-white);
    padding: 12px;
    border: none;
    border-radius: var(--radius-sm);
    font-weight: 600;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s;
    margin-top: 10px;
    box-shadow: 0 4px 10px hsla(var(--brand-h), var(--brand-s), var(--brand-l), 0.2);
  }

  .submit-btn:hover:not(:disabled) {
    box-shadow: 0 6px 15px hsla(var(--brand-h), var(--brand-s), var(--brand-l), 0.3);
    transform: translateY(-1px);
  }

  .submit-btn:disabled {
    background: var(--color-neutral-300);
    color: var(--color-neutral-500);
    cursor: not-allowed;
    box-shadow: none;
    transform: none;
  }
</style>
