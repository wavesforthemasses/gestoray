<script lang="ts">
  interface Props {
    totalItems: number;
    itemsPerPage: number;
    currentPage: number;
    onPageChange: (page: number) => void;
  }

  let {
    totalItems,
    itemsPerPage,
    currentPage = 1,
    onPageChange
  }: Props = $props();

  let totalPages = $derived(Math.max(1, Math.ceil(totalItems / itemsPerPage)));
  
  let pages = $derived(
    Array.from({ length: totalPages }, (_, i) => i + 1)
  );
</script>

{#if totalPages > 1}
  <div class="pagination-container">
    <button
      class="page-nav-btn"
      disabled={currentPage === 1}
      onclick={() => onPageChange(currentPage - 1)}
      aria-label="Pagina precedente"
    >
      &larr; Prec
    </button>

    <div class="pages-list">
      {#each pages as p}
        <button
          class="page-num-btn"
          class:active={currentPage === p}
          onclick={() => onPageChange(p)}
        >
          {p}
        </button>
      {/each}
    </div>

    <button
      class="page-nav-btn"
      disabled={currentPage === totalPages}
      onclick={() => onPageChange(currentPage + 1)}
      aria-label="Pagina successiva"
    >
      Succ &rarr;
    </button>
  </div>
{/if}

<style>
  .pagination-container {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-top: 1px solid var(--color-neutral-100);
    margin-top: 10px;
  }

  .pages-list {
    display: flex;
    gap: 6px;
  }

  .page-num-btn,
  .page-nav-btn {
    background: var(--color-white);
    border: 1px solid var(--color-neutral-300);
    color: var(--color-neutral-600);
    padding: 6px 12px;
    border-radius: var(--radius-sm);
    font-family: inherit;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .page-num-btn:hover:not(.active),
  .page-nav-btn:hover:not(:disabled) {
    background: var(--color-neutral-100);
    color: var(--color-neutral-800);
  }

  .page-num-btn.active {
    background: var(--color-primary-500);
    border-color: var(--color-primary-500);
    color: var(--color-white);
    font-weight: 600;
  }

  .page-nav-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    background: var(--color-neutral-50);
  }
</style>
