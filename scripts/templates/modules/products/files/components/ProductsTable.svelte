<script lang="ts">
  import { Table, Card } from '$lib';
  import { Tag, Trash, Plus } from '@lucide/svelte';
  import type { ProductData } from '../products.service';

  interface Props {
    productsList: Array<ProductData & { id: string }>;
    onEdit: (product: ProductData & { id: string }) => void;
    onDelete: (id: string) => void;
    onAddNew: () => void;
  }

  let { productsList, onEdit, onDelete, onAddNew } = $props();

  const columns = [
    { key: 'name', header: 'Nome Prodotto' },
    { key: 'listPrice', header: 'Prezzo Listino' },
    { key: 'minPrice', header: 'Soglia Minima' },
    { key: 'actions', header: 'Azioni' }
  ];
</script>

<Card
  title="Listino Prodotti Aziendali"
  description="Gestisci i prodotti a catalogo con i rispettivi prezzi di listino e le soglie minime di vendita."
  class="list-card"
>
  {#snippet icon()}
    <Tag size={20} class="icon-accent" />
  {/snippet}

  {#snippet headerSnippet()}
    <button onclick={onAddNew} class="add-btn">
      <Plus size={16} /> Nuovo Prodotto
    </button>
  {/snippet}

  <div class="table-wrapper">
    <Table
      {columns}
      data={productsList}
      onRowClick={onEdit}
      emptyText="Nessun prodotto configurato a catalogo."
    >
      {#snippet cellSnippet(col: any, row: any)}
        {#if col.key === 'listPrice'}
          <span class="price-val">€ {row.listPrice.toFixed(2)}</span>
        {:else if col.key === 'minPrice'}
          <span class="price-val min-price">€ {row.minPrice.toFixed(2)}</span>
        {:else if col.key === 'actions'}
          <button 
            onclick={(e) => { e.stopPropagation(); onDelete(row.id); }} 
            class="delete-btn" 
            title="Elimina Prodotto"
          >
            <Trash size={14} />
          </button>
        {:else}
          <span class="name-val">{row.name}</span>
        {/if}
      {/snippet}
    </Table>
  </div>
</Card>

<style>
  :global(.icon-accent) {
    color: var(--color-primary-500);
  }

  .add-btn {
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
    box-shadow: 0 4px 10px hsla(var(--brand-h), var(--brand-s), var(--brand-l), 0.15);
  }

  .add-btn:hover {
    opacity: 0.9;
    transform: translateY(-1px);
    box-shadow: 0 6px 15px hsla(var(--brand-h), var(--brand-s), var(--brand-l), 0.25);
  }

  .table-wrapper {
    width: 100%;
    overflow-x: auto;
  }

  .name-val {
    font-weight: 600;
    color: var(--color-neutral-800);
  }

  .price-val {
    font-family: monospace;
    font-size: 14px;
    font-weight: 600;
    color: var(--color-neutral-800);
  }

  .min-price {
    color: var(--color-warning-600);
  }

  .delete-btn {
    background: var(--color-error-light);
    color: var(--color-error-500);
    border: 1px solid transparent;
    padding: 6px;
    border-radius: var(--radius-sm);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  }

  .delete-btn:hover {
    background: var(--color-error-500);
    color: var(--color-white);
    transform: scale(1.05);
  }
</style>
