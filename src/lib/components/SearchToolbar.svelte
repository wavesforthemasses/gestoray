<script lang="ts">
  import { Search, X } from '@lucide/svelte';
  import type { Snippet } from 'svelte';

  interface Props {
    searchQuery?: string;
    placeholder?: string;
    onSearch?: (value: string) => void;
    onReset?: () => void;
    filtersSnippet?: Snippet;
  }

  let {
    searchQuery = $bindable(''),
    placeholder = 'Cerca...',
    onSearch,
    onReset,
    filtersSnippet
  }: Props = $props();

  function handleInput(e: Event) {
    const val = (e.target as HTMLInputElement).value;
    searchQuery = val;
    onSearch?.(val);
  }

  function handleClear() {
    searchQuery = '';
    onSearch?.('');
    onReset?.();
  }
</script>

<div class="search-toolbar-card">
  <div class="search-box">
    <Search size={18} class="search-icon" />
    <input
      type="text"
      {placeholder}
      bind:value={searchQuery}
      oninput={handleInput}
    />
    {#if searchQuery}
      <button type="button" class="btn-clear-input" onclick={handleClear} title="Cancella ricerca">
        <X size={14} />
      </button>
    {/if}
  </div>

  {#if filtersSnippet}
    <div class="toolbar-filters-slot">
      {@render filtersSnippet()}
    </div>
  {/if}
</div>

<style>
  .search-toolbar-card {
    background: var(--color-surface, #ffffff);
    border: 1px solid var(--color-neutral-200, #e5e7eb);
    border-radius: var(--radius-lg, 12px);
    padding: 14px 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    box-shadow: var(--shadow-sm, 0 1px 2px rgba(0,0,0,0.05));
    margin-bottom: 16px;
    width: 100%;
  }

  .search-box {
    position: relative;
    flex: 1;
    max-width: 440px;
    display: flex;
    align-items: center;
  }

  :global(.search-icon) {
    position: absolute;
    left: 12px;
    color: var(--color-neutral-400, #9ca3af);
    pointer-events: none; top: 50%; transform: translateY(-50%);
  }

  .search-box input {
    width: 100%;
    padding: 9px 36px 9px 38px;
    border: 1px solid var(--color-neutral-300, #d1d5db);
    border-radius: var(--radius-md, 8px);
    font-size: 14px;
    background: var(--color-surface, #ffffff);
    color: var(--color-neutral-800, #1f2937);
    outline: none;
    transition: border-color 0.2s, box-shadow 0.2s;
  }

  .search-box input:focus {
    border-color: var(--color-primary-500, #3b82f6);
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
  }

  .btn-clear-input {
    position: absolute;
    right: 8px;
    background: transparent;
    border: none;
    color: var(--color-neutral-400, #9ca3af);
    padding: 4px;
    border-radius: 4px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color 0.2s, background 0.2s;
  }

  .btn-clear-input:hover {
    color: var(--color-neutral-700, #374151);
    background: var(--color-neutral-100, #f3f4f6);
  }

  .toolbar-filters-slot {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  @media (max-width: 650px) {
    .search-toolbar-card {
      flex-direction: column;
      align-items: stretch;
    }
    .search-box {
      max-width: 100%;
    }
    .toolbar-filters-slot {
      width: 100%;
      flex-wrap: wrap;
    }
  }
</style>
