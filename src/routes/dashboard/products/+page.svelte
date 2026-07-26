<script lang="ts">
  import { onMount } from 'svelte';
  import { ProductsService } from './products.service';
  import type { ProductItem } from './schema';
  import { toast } from '$lib/stores/toast.svelte';

  let products = $state<ProductItem[]>([]);
  let loading = $state(true);
  let searchQuery = $state('');

  onMount(async () => {
    try {
      products = await ProductsService.getProducts();
    } catch (e) {
      console.error('Errore caricamento prodotti:', e);
    } finally {
      loading = false;
    }
  });

  let filteredProducts = $derived(
    products.filter(p => {
      return !searchQuery.trim() || 
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.category.toLowerCase().includes(searchQuery.toLowerCase());
    })
  );

  let totalProducts = $derived(products.length);
  let totalStockValue = $derived(products.reduce((acc, curr) => acc + ((curr.price || 0) * (curr.stockQty || 0)), 0));

  async function handleDelete(id?: string) {
    if (!id || !confirm('Sei sicuro di voler eliminare questo articolo dal catalogo?')) return;
    try {
      await ProductsService.deleteProduct(id);
      products = products.filter(p => p.id !== id);
      toast.success('Prodotto eliminato con successo');
    } catch (err: any) {
      toast.error('Errore eliminazione prodotto: ' + err.message);
    }
  }
</script>

<svelte:head>
  <title>Catalogo Prodotti & Ricambi | Gestoray</title>
</svelte:head>

<div class="products-page animate-fade-in">
  <header class="page-header">
    <div>
      <h1 class="page-title">📦 Catalogo Prodotti & Ricambi</h1>
      <p class="page-subtitle">Gestisci gli articoli a magazzino, il listino prezzi ed i componenti di ricambio.</p>
    </div>
    <div class="header-actions">
      <a href="/dashboard/products/add" class="btn btn-primary">+ Nuovo Articolo</a>
    </div>
  </header>

  <!-- KPI CARDS -->
  <div class="kpi-grid">
    <div class="kpi-card">
      <span class="kpi-icon">📦</span>
      <div>
        <div class="kpi-value">{totalProducts}</div>
        <div class="kpi-label">Articoli a Catalogo</div>
      </div>
    </div>

    <div class="kpi-card">
      <span class="kpi-icon">💶</span>
      <div>
        <div class="kpi-value">€ {totalStockValue.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</div>
        <div class="kpi-label">Valore Stimato Scorte</div>
      </div>
    </div>
  </div>

  <!-- SEARCH -->
  <div class="filter-card">
    <input 
      type="text" 
      placeholder="🔍 Cerca prodotto per SKU, nome articolo o categoria..." 
      bind:value={searchQuery} 
      class="search-input"
    />
  </div>

  <!-- TABLE -->
  {#if loading}
    <div class="loading-state">
      <span class="spinner"></span>
      Caricamento prodotti...
    </div>
  {:else if filteredProducts.length === 0}
    <div class="empty-state">
      <span class="empty-icon">📦</span>
      <h3>Nessun prodotto trovato</h3>
      <p>Aggiungi il tuo primo articolo al catalogo per gestirne i prezzi e la giacenza.</p>
      <a href="/dashboard/products/add" class="btn btn-primary">+ Nuovo Articolo</a>
    </div>
  {:else}
    <div class="table-card">
      <table class="data-table">
        <thead>
          <tr>
            <th>SKU / Codice</th>
            <th>Nome Articolo</th>
            <th>Categoria</th>
            <th>Unità</th>
            <th>Prezzo Unitario</th>
            <th>Giacenza</th>
            <th class="text-right">Azioni</th>
          </tr>
        </thead>
        <tbody>
          {#each filteredProducts as p}
            <tr>
              <td class="font-mono">{p.sku}</td>
              <td><strong class="text-neutral-800">{p.name}</strong></td>
              <td><span class="type-pill">{p.category}</span></td>
              <td class="uppercase">{p.unit}</td>
              <td class="font-bold text-primary">€ {(p.price || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}</td>
              <td>
                <span class="stock-badge {p.stockQty > 0 ? 'stock-ok' : 'stock-zero'}">
                  {p.stockQty} {p.unit}
                </span>
              </td>
              <td class="text-right">
                <div class="action-buttons">
                  <a href="/dashboard/products/{p.id}" class="btn-icon" title="Dettaglio">👁️</a>
                  <a href="/dashboard/products/{p.id}/edit" class="btn-icon" title="Modifica">✏️</a>
                  <button type="button" class="btn-icon-danger" onclick={() => handleDelete(p.id)} title="Elimina">🗑️</button>
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>

<style>
  .products-page { padding: 1.5rem; display: flex; flex-direction: column; gap: 1.5rem; max-width: 1200px; margin: 0 auto; }
  .page-header { display: flex; justify-content: space-between; align-items: center; }
  .page-title { font-size: 1.6rem; font-weight: 800; margin: 0; color: var(--color-neutral-900); }
  .page-subtitle { color: var(--color-neutral-500); font-size: 0.9rem; margin: 0.2rem 0 0 0; }

  .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; }
  .kpi-card { background: white; border: 1px solid var(--color-neutral-200); border-radius: var(--radius-lg); padding: 1rem 1.2rem; display: flex; align-items: center; gap: 1rem; box-shadow: var(--shadow-sm); }
  .kpi-icon { font-size: 2rem; }
  .kpi-value { font-size: 1.4rem; font-weight: 800; color: var(--color-neutral-900); }
  .kpi-label { font-size: 0.8rem; color: var(--color-neutral-500); font-weight: 600; }

  .filter-card { background: white; border: 1px solid var(--color-neutral-200); border-radius: var(--radius-lg); padding: 1rem; }
  .search-input { width: 100%; padding: 0.6rem 0.9rem; border: 1px solid var(--color-neutral-300); border-radius: var(--radius-md); font-size: 0.9rem; outline: none; box-sizing: border-box; }

  .table-card { background: white; border: 1px solid var(--color-neutral-200); border-radius: var(--radius-lg); overflow: hidden; box-shadow: var(--shadow-sm); }
  .data-table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
  .data-table th, .data-table td { padding: 0.8rem 1rem; text-align: left; border-bottom: 1px solid var(--color-neutral-200); }
  .data-table th { background: var(--color-neutral-50); font-weight: 700; color: var(--color-neutral-700); font-size: 0.8rem; text-transform: uppercase; }

  .type-pill { font-size: 0.78rem; background: var(--color-neutral-100); padding: 0.2rem 0.5rem; border-radius: 6px; color: var(--color-neutral-700); }
  .stock-badge { font-size: 0.8rem; font-weight: 700; padding: 0.2rem 0.5rem; border-radius: 6px; }
  .stock-ok { background: #dcfce7; color: #15803d; }
  .stock-zero { background: #fee2e2; color: #b91c1c; }

  .action-buttons { display: flex; gap: 0.4rem; justify-content: flex-end; }
  .btn { padding: 0.6rem 1.2rem; border-radius: var(--radius-md); font-weight: 600; cursor: pointer; border: none; text-decoration: none; font-size: 0.88rem; }
  .btn-primary { background: var(--color-primary-600); color: white; }
  .btn-icon, .btn-icon-danger { background: none; border: none; cursor: pointer; font-size: 1rem; text-decoration: none; }

  .loading-state, .empty-state { text-align: center; padding: 3rem; background: white; border-radius: var(--radius-lg); border: 1px solid var(--color-neutral-200); }
  .empty-icon { font-size: 3rem; display: block; margin-bottom: 0.5rem; }
  .font-mono { font-family: monospace; font-weight: 600; }
  .font-bold { font-weight: 700; }
  .text-right { text-align: right; }
  .uppercase { text-transform: uppercase; }
</style>
