<script lang="ts">
  import { activeRole } from '$lib/auth';
  import { db, doc, setDoc, collection, getDocs } from '$lib/firebase';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { Card, Table, FormField } from '$lib';
  import { Tag, Plus, Trash, ArrowLeft } from '@lucide/svelte';

  onMount(() => {
    const unsubscribe = activeRole.subscribe(($activeRole) => {
      if ($activeRole && $activeRole !== 'superadmin' && $activeRole !== 'amministrazione') {
        goto('/dashboard');
      }
    });

    fetchProducts();
    return () => unsubscribe();
  });

  let productsList = $state<Array<{ id: string, name: string, listPrice: number, minPrice: number }>>([]);
  let loading = $state(true);
  let showAddForm = $state(false);

  // Form state
  let name = $state('');
  let listPrice = $state<number | null>(null);
  let minPrice = $state<number | null>(null);
  let submitting = $state(false);
  let errorMsg = $state('');
  let successMsg = $state('');

  const columns = [
    { key: 'name', header: 'Nome Prodotto' },
    { key: 'listPrice', header: 'Prezzo Listino' },
    { key: 'minPrice', header: 'Soglia Minima' },
    { key: 'actions', header: 'Azioni' }
  ];

  async function fetchProducts() {
    loading = true;
    try {
      const querySnapshot = await getDocs(collection(db, 'products'));
      const list: typeof productsList = [];
      querySnapshot.forEach((doc: any) => {
        const data = doc.data();
        list.push({
          id: doc.id,
          name: data.name,
          listPrice: data.listPrice,
          minPrice: data.minPrice
        });
      });
      productsList = list;
    } catch (e) {
      console.error('Error fetching products:', e);
    } finally {
      loading = false;
    }
  }

  async function handleAddProduct(e: Event) {
    e.preventDefault();
    if (!name || listPrice === null || minPrice === null) return;

    if (minPrice > listPrice) {
      errorMsg = 'La soglia minima di vendita non può essere superiore al prezzo di listino.';
      return;
    }

    submitting = true;
    errorMsg = '';
    successMsg = '';

    try {
      const id = 'prod_' + Math.random().toString(36).substring(2, 11);
      const newProd = {
        name: name.trim(),
        listPrice,
        minPrice
      };

      await setDoc(doc(db, 'products', id), newProd);
      successMsg = `Prodotto "${name}" aggiunto con successo!`;
      
      // Reset form
      name = '';
      listPrice = null;
      minPrice = null;

      await fetchProducts();
      showAddForm = false; // Hide form on success
    } catch (err: any) {
      errorMsg = err.message || 'Errore durante il salvataggio.';
    } finally {
      submitting = false;
    }
  }

  async function handleDeleteProduct(id: string) {
    if (!confirm('Sei sicuro di voler rimuovere questo prodotto dal catalogo?')) return;
    try {
      await fetch('/api/mock-db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete',
          collection: 'products',
          id
        })
      });
      successMsg = 'Prodotto rimosso con successo!';
      await fetchProducts();
    } catch (e: any) {
      errorMsg = 'Errore durante la cancellazione.';
    }
  }
</script>

<svelte:head>
  <title>Catalogo Prodotti | Gestoray</title>
</svelte:head>

<div class="products-page animate-fade-in">
  {#if errorMsg}
    <div class="alert error animate-fade-in">{errorMsg}</div>
  {/if}
  {#if successMsg}
    <div class="alert success animate-fade-in">{successMsg}</div>
  {/if}

  {#if !showAddForm}
    <Card
      title="Listino Prodotti Aziendali"
      description="Gestisci i prodotti a catalogo con i rispettivi prezzi di listino e le soglie minime di vendita."
      class="list-card"
    >
      {#snippet icon()}
        <Tag size={20} class="icon-accent" />
      {/snippet}

      {#snippet headerSnippet()}
        <button onclick={() => { showAddForm = true; successMsg = ''; errorMsg = ''; }} class="add-product-btn">
          <Plus size={16} /> Aggiungi Prodotto
        </button>
      {/snippet}

      {#if loading}
        <div class="loader-box">
          <span class="spinner"></span>
          Caricamento catalogo...
        </div>
      {:else}
        {#snippet cell(col: any, row: any)}
          {#if col.key === 'listPrice'}
            <span class="price-val">€ {row.listPrice.toFixed(2)}</span>
          {:else if col.key === 'minPrice'}
            <span class="price-val min-price">€ {row.minPrice.toFixed(2)}</span>
          {:else if col.key === 'actions'}
            <button 
              onclick={(e) => { e.stopPropagation(); handleDeleteProduct(row.id); }} 
              class="delete-btn" 
              title="Elimina Prodotto"
            >
              <Trash size={14} />
            </button>
          {:else}
            <span class="name-val">{row.name}</span>
          {/if}
        {/snippet}

        <div class="table-wrapper">
          <Table
            {columns}
            data={productsList}
            cellSnippet={cell}
            emptyText="Nessun prodotto configurato a catalogo."
          />
        </div>
      {/if}
    </Card>
  {:else}
    <Card
      title="Aggiungi Prodotto"
      description="Crea un nuovo prodotto o servizio definendo i prezzi di soglia."
      class="form-card"
    >
      {#snippet icon()}
        <Plus size={20} class="icon-accent" />
      {/snippet}

      {#snippet headerSnippet()}
        <button onclick={() => { showAddForm = false; successMsg = ''; errorMsg = ''; }} class="back-link">
          <ArrowLeft size={14} /> Annulla e Torna all'elenco
        </button>
      {/snippet}

      <form onsubmit={handleAddProduct} class="product-form">
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
            Aggiungi al Catalogo
          {/if}
        </button>
      </form>
    </Card>
  {/if}
</div>

<style>
  .products-page {
    width: 100%;
  }

  :global(.icon-accent) {
    color: var(--color-primary-500);
  }

  .add-product-btn {
    background: linear-gradient(135deg, var(--color-primary-500), var(--color-primary-600));
    color: var(--color-white);
    border: none;
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
    box-shadow: 0 4px 10px hsla(var(--brand-h), var(--brand-s), 50%, 0.15);
  }

  .add-product-btn:hover {
    opacity: 0.9;
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

  .price-val {
    font-weight: 600;
    color: var(--color-neutral-800);
  }

  .price-val.min-price {
    color: var(--color-error-text);
  }

  .name-val {
    font-weight: 500;
  }

  .delete-btn {
    background: transparent;
    border: none;
    color: var(--color-neutral-400);
    cursor: pointer;
    padding: 6px;
    border-radius: var(--radius-sm);
    transition: all 0.2s;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .delete-btn:hover {
    color: var(--color-error);
    background: var(--color-error-light);
  }

  .loader-box {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 30px;
    color: var(--color-neutral-500);
    font-size: 14px;
  }

  .spinner {
    width: 20px;
    height: 20px;
    border: 2px solid hsla(var(--brand-h), var(--brand-s), 50%, 0.15);
    border-radius: 50%;
    border-top-color: var(--color-primary-500);
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .product-form {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .form-row {
    display: flex;
    gap: 20px;
  }

  .form-row > :global(.form-group) {
    flex: 1;
  }

  @media (max-width: 576px) {
    .form-row {
      flex-direction: column;
      gap: 20px;
    }
  }

  .submit-btn {
    background: linear-gradient(135deg, var(--color-primary-500), var(--color-primary-600));
    color: var(--color-white);
    padding: 12px;
    border: none;
    border-radius: var(--radius-md);
    font-family: inherit;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: opacity var(--transition-fast);
    box-shadow: 0 4px 12px hsla(var(--brand-h), var(--brand-s), 50%, 0.2);
    margin-top: 10px;
    width: 100%;
  }

  .submit-btn:hover:not(:disabled) {
    opacity: 0.9;
  }

  .submit-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .table-wrapper {
    width: 100%;
    overflow-x: auto;
  }

  .alert {
    padding: 12px 14px;
    border-radius: var(--radius-md);
    font-size: 13px;
    margin-bottom: 20px;
  }

  .alert.error {
    background: var(--color-error-light);
    border: 1px solid var(--color-error-border);
    color: var(--color-error-text);
  }

  .alert.success {
    background: var(--color-success-light);
    border: 1px solid var(--color-success-border);
    color: var(--color-success-text);
  }

  .animate-fade-in {
    animation: fadeIn 0.3s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  }
</style>
