<script lang="ts" generics="T extends Record<string, any>">
  import type { Snippet } from 'svelte';

  interface Column {
    key: string;
    header: string;
    class?: string;
  }

  interface Props {
    columns: Column[];
    data: T[];
    emptyText?: string;
    onRowClick?: (item: T) => void;
    cellSnippet?: Snippet<[Column, T]>;
  }

  let {
    columns,
    data,
    emptyText = 'Nessun dato presente.',
    onRowClick,
    cellSnippet
  }: Props = $props();
</script>

<div class="app-table-container">
  <table class="app-table">
    <thead>
      <tr>
        {#each columns as col}
          <th class={col.class}>{col.header}</th>
        {/each}
      </tr>
    </thead>
    <tbody>
      {#if data.length === 0}
        <tr>
          <td colspan={columns.length} class="empty-cell">
            {emptyText}
          </td>
        </tr>
      {:else}
        {#each data as row, i}
          <tr 
            class:clickable={!!onRowClick} 
            onclick={() => onRowClick?.(row)}
          >
            {#each columns as col}
              <td class={col.class}>
                {#if cellSnippet}
                  {@render cellSnippet(col, row)}
                {:else}
                  {row[col.key]}
                {/if}
              </td>
            {/each}
          </tr>
        {/each}
      {/if}
    </tbody>
  </table>
</div>

<style>
  .app-table-container {
    width: 100%;
    overflow-x: auto;
    border-radius: var(--radius-md);
    border: 1px solid var(--color-neutral-200);
    background: var(--color-surface);
  }

  .app-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
    text-align: left;
  }

  .app-table th {
    background: var(--color-neutral-50);
    color: var(--color-neutral-600);
    font-weight: 600;
    padding: 12px 16px;
    border-bottom: 1px solid var(--color-neutral-200);
    white-space: nowrap;
  }

  .app-table td {
    padding: 14px 16px;
    color: var(--color-neutral-800);
    border-bottom: 1px solid var(--color-neutral-100);
  }

  .table-row.clickable {
    cursor: pointer;
    transition: background 0.2s;
  }

  .table-row.clickable:hover {
    background: var(--color-neutral-100);
  }

  .empty-cell {
    text-align: center;
    padding: 30px;
    color: var(--color-neutral-400);
  }
</style>
