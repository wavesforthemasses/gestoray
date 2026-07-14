<script lang="ts">
  import { activeRole } from '$lib/auth';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { confirmStore } from '$lib/stores/confirm.svelte';
  import { toast } from '$lib/stores/toast.svelte';

  import { ProductsService, type ProductData } from './products.service';
  import ProductsTable from './components/ProductsTable.svelte';
  import ProductAddForm from './components/ProductAddForm.svelte';
  import { pageTitle } from '$lib/stores/page';
  pageTitle.set('Catalogo Prodotti');

  let productsList = $state<Array<ProductData & { id: string }>>([]);
  let loading = $state(true);
  let showAddForm = $state(false);
  let editingProduct = $state<ProductData & { id: string } | null>(null);

  onMount(() => {
    const unsubscribe = activeRole.subscribe(($activeRole) => {
      if ($activeRole && $activeRole !== 'superadmin' && $activeRole !== 'amministrazione') {
        goto('/dashboard');
      }
    });

    loadData();
    return () => unsubscribe();
  });

  async function loadData() {
    loading = true;
    try {
      productsList = await ProductsService.fetchProducts();
    } catch (e) {
      console.error('Error fetching products:', e);
    } finally {
      loading = false;
    }
  }

  function handleAddNew() {
    editingProduct = null;
    showAddForm = true;
  }

  function handleEdit(product: ProductData & { id: string }) {
    editingProduct = product;
    showAddForm = true;
  }

  function handleCancel() {
    showAddForm = false;
    editingProduct = null;
  }

  function handleSuccess(msg: string) {
    toast.success(msg);
    showAddForm = false;
    editingProduct = null;
    loadData();
  }

  function handleError(msg: string) {
    toast.error(msg);
  }

  async function handleDelete(id: string) {
    const ok = await confirmStore.prompt('Sei sicuro di voler rimuovere questo prodotto dal catalogo?');
    if (!ok) return;
    try {
      await ProductsService.deleteProduct(id);
      toast.success('Prodotto rimosso con successo!');
      await loadData();
    } catch (e: any) {
      toast.error("Errore durante il salvataggio del prodotto.");
    }
  }
</script>



<div class="products-page animate-fade-in">
  {#if showAddForm}
    <ProductAddForm 
      {editingProduct} 
      onCancel={handleCancel}
      onSuccess={handleSuccess}
      onError={handleError}
    />
  {:else}
    {#if loading}
      <div class="loader-box">
        <span class="spinner"></span>
        Caricamento catalogo...
      </div>
    {:else}
      <ProductsTable 
        {productsList}
        onAddNew={handleAddNew}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />
    {/if}
  {/if}
</div>

<style>
  .products-page {
    width: 100%;
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

  .animate-fade-in {
    animation: fadeIn 0.3s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  }
</style>
