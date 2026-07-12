<script lang="ts">
  import { Card, FormField } from '$lib';
  import { Plus, ArrowLeft } from '@lucide/svelte';
  import { ProductsService, type ProductData } from '../products.service';

  interface Props {
    editingProduct: ProductData | null;
    onCancel: () => void;
    onSuccess: (msg: string) => void;
    onError: (msg: string) => void;
  }

  let { editingProduct, onCancel, onSuccess, onError } = $props();

  let name = $state(editingProduct?.name || '');
  let listPrice = $state<number | null>(editingProduct?.listPrice ?? null);
  let minPrice = $state<number | null>(editingProduct?.minPrice ?? null);
  let submitting = $state(false);

  $effect(() => {
    if (editingProduct) {
      name = editingProduct.name;
      listPrice = editingProduct.listPrice;
      minPrice = editingProduct.minPrice;
    } else {
      name = '';
      listPrice = null;
      minPrice = null;
    }
  });

  async function handleSubmit(e: Event) {
    e.preventDefault();
    submitting = true;

    try {
      const isEditing = await ProductsService.saveProduct({
        id: editingProduct?.id,
        name,
        listPrice: listPrice as number,
        minPrice: minPrice as number
      });
      
      onSuccess(isEditing 
        ? 'Prodotto aggiornato con successo!' 
        : 'Prodotto aggiunto con successo!'
      );
    } catch (err: any) {
      onError(err.message || 'Errore durante il salvataggio.');
    } finally {
      submitting = false;
    }
  }
</script>

<Card
  title={editingProduct ? "Modifica Prodotto" : "Aggiungi Prodotto"}
  description={editingProduct ? "Modifica i dettagli e le soglie di questo prodotto." : "Crea un nuovo prodotto o servizio definendo i prezzi di soglia."}
  class="form-card"
>
  {#snippet icon()}
    <Plus size={20} class="icon-accent" />
  {/snippet}

  {#snippet headerSnippet()}
    <button onclick={onCancel} class="back-link" type="button">
      <ArrowLeft size={14} /> Annulla e Torna all'elenco
    </button>
  {/snippet}

  <form onsubmit={handleSubmit} class="product-form">
    <FormField id="prod-name" label="Nome Prodotto">
      <input
        type="text"
        id="prod-name"
        bind:value={name}
        placeholder="es. Servizio Web Hosting"
        required
        disabled={submitting}
      />
    </FormField>

    <div class="form-row">
      <FormField id="prod-list-price" label="Prezzo di Listino (€)">
        <input
          type="number"
          id="prod-list-price"
          bind:value={listPrice}
          placeholder="1000.00"
          required
          min="0"
          step="0.01"
          disabled={submitting}
        />
      </FormField>

      <FormField id="prod-min-price" label="Prezzo Minimo Consentito (€)" helpText="Sotto questo prezzo verrà mostrato un warning sul contratto.">
        <input
          type="number"
          id="prod-min-price"
          bind:value={minPrice}
          placeholder="800.00"
          required
          min="0"
          step="0.01"
          disabled={submitting}
        />
      </FormField>
    </div>

    <button type="submit" class="submit-btn" disabled={submitting}>
      {#if submitting}
        Salvataggio...
      {:else}
        {editingProduct ? "Salva Modifiche" : "Aggiungi al Catalogo"}
      {/if}
    </button>
  </form>
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

  .product-form {
    display: flex;
    flex-direction: column;
    gap: 20px;
    max-width: 500px;
  }

  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
  }

  input[type="text"], input[type="number"] {
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

  input:focus {
    border-color: var(--color-primary-500);
    box-shadow: 0 0 0 3px hsla(var(--brand-h), var(--brand-s), var(--brand-l), 0.15);
    outline: none;
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
