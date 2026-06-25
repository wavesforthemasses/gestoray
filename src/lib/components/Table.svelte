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

<div class="gestoray-table-container">
  <table class="gestoray-table">
    <thead>
      <tr>
        {#each columns as col}
          <th class={col.class}>{col.header}</th>
        {/each}
      </tr>
    </thead>
    <tbody>
      {#each data as row}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
        <tr class="table-row" class:clickable={!!onRowClick} onclick={() => onRowClick?.(row)}>
          {#each columns as col}
            <td class={col.class}>
              {#if cellSnippet}
                {@render cellSnippet(col, row)}
              {:else}
                {row[col.key] ?? ''}
              {/if}
            </td>
          {/each}
        </tr>
      {/each}
      {#if data.length === 0}
        <tr>
          <td colspan={columns.length} class="empty-cell">{emptyText}</td>
        </tr>
      {/if}
    </tbody>
  </table>
</div>

<style>
  .gestoray-table-container {
    background: var(--color-white);
    border: 1px solid var(--color-neutral-200);
    border-radius: var(--radius-md);
    overflow: hidden;
  }

  .gestoray-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
    text-align: left;
  }

  .gestoray-table th {
    background: var(--color-neutral-100);
    padding: 14px 16px;
    font-weight: 600;
    color: var(--color-neutral-600);
    border-bottom: 1px solid var(--color-neutral-200);
  }

  .gestoray-table td {
    padding: 14px 16px;
    border-bottom: 1px solid var(--color-neutral-100);
    color: var(--color-neutral-700);
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
