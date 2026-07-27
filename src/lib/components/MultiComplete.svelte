<script lang="ts">
  import { onMount } from 'svelte';
  import { Search, X } from '@lucide/svelte';

  export interface MultiCompleteOption {
    id: string;
    label: string;
    sublabel?: string;
  }

  let { 
    options = [], 
    value = $bindable([]), 
    placeholder = 'Seleziona...', 
    disabled = false,
    maxItems,
    onchange
  }: {
    options: MultiCompleteOption[];
    value: string[];
    placeholder?: string;
    disabled?: boolean;
    maxItems?: number;
    onchange?: (selectedIds: string[]) => void;
  } = $props();

  let isOpen = $state(false);
  let searchText = $state('');
  let containerRef = $state<HTMLDivElement | null>(null);
  let inputRef = $state<HTMLInputElement | null>(null);

  // Filtered available options excluding already selected items
  let availableOptions = $derived(
    options.filter(o => {
      if (value.includes(o.id)) return false;
      if (!searchText) return true;
      const q = searchText.toLowerCase().trim();
      return o.label.toLowerCase().includes(q) || (o.sublabel && o.sublabel.toLowerCase().includes(q));
    })
  );

  let selectedOptions = $derived(
    value.map(id => options.find(o => o.id === id)).filter(Boolean) as MultiCompleteOption[]
  );

  function handleFocus() {
    if (!disabled) {
      isOpen = true;
    }
  }

  function handleSelect(option: MultiCompleteOption) {
    if (disabled) return;
    if (maxItems && value.length >= maxItems) return;
    if (!value.includes(option.id)) {
      value = [...value, option.id];
      searchText = '';
      if (onchange) onchange(value);
    }
    inputRef?.focus();
  }

  function handleRemove(id: string) {
    if (disabled) return;
    value = value.filter(v => v !== id);
    if (onchange) onchange(value);
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (disabled) return;

    if (e.key === 'Backspace' && !searchText && value.length > 0) {
      // Remove last selected item if search input is empty
      const lastId = value[value.length - 1];
      handleRemove(lastId);
    } else if (e.key === 'Escape') {
      isOpen = false;
    }
  }

  function handleClickOutside(e: MouseEvent) {
    if (containerRef && !containerRef.contains(e.target as Node)) {
      isOpen = false;
    }
  }

  onMount(() => {
    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  });
</script>

<div class="multi-complete-wrapper" bind:this={containerRef}>
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div 
    class="multi-complete-box" 
    class:disabled 
    class:focused={isOpen}
    onclick={() => inputRef?.focus()}
  >
    <div class="pills-container">
      {#each selectedOptions as opt (opt.id)}
        <span class="pill">
          <span class="pill-label">{opt.label}</span>
          <button 
            type="button" 
            class="btn-pill-remove" 
            onclick={(e) => { e.stopPropagation(); handleRemove(opt.id); }} 
            disabled={disabled}
            aria-label="Rimuovi {opt.label}"
          >
            <X size={13} />
          </button>
        </span>
      {/each}

      <input
        bind:this={inputRef}
        type="text"
        bind:value={searchText}
        onfocus={handleFocus}
        onkeydown={handleKeyDown}
        placeholder={value.length === 0 ? placeholder : 'Scegli altri...'}
        {disabled}
        class="inline-input"
      />
    </div>

    <div class="icon-right">
      <Search size={16} />
    </div>
  </div>

  {#if isOpen && !disabled}
    <ul class="dropdown-list">
      {#if availableOptions.length > 0}
        {#each availableOptions as option (option.id)}
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
          <li class="dropdown-item" onclick={() => handleSelect(option)}>
            <div class="item-title">{option.label}</div>
            {#if option.sublabel}
              <div class="item-subtitle">{option.sublabel}</div>
            {/if}
          </li>
        {/each}
      {:else}
        <li class="dropdown-item empty">
          {searchText ? 'Nessun risultato trovato' : 'Tutte le opzioni sono state selezionate'}
        </li>
      {/if}
    </ul>
  {/if}
</div>

<style>
  .multi-complete-wrapper {
    position: relative;
    width: 100%;
  }

  .multi-complete-box {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: var(--color-white, #ffffff);
    border: 1px solid var(--color-neutral-300, #d1d5db);
    border-radius: var(--radius-md, 8px);
    padding: 6px 12px;
    min-height: 42px;
    cursor: text;
    transition: border-color 0.2s, box-shadow 0.2s;
  }

  .multi-complete-box.focused {
    border-color: var(--color-primary-600, #2563eb);
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
  }

  .multi-complete-box.disabled {
    background: var(--color-neutral-100, #f3f4f6);
    cursor: not-allowed;
    opacity: 0.7;
  }

  .pills-container {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    flex: 1;
  }

  .pill {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: var(--color-primary-50, #eff6ff);
    color: var(--color-primary-700, #1d4ed8);
    border: 1px solid var(--color-primary-200, #bfdbfe);
    padding: 3px 8px;
    border-radius: var(--radius-md, 6px);
    font-size: 13px;
    font-weight: 600;
  }

  .btn-pill-remove {
    background: transparent;
    border: none;
    color: var(--color-primary-600, #2563eb);
    padding: 2px;
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
    transition: background 0.15s, color 0.15s;
  }

  .btn-pill-remove:hover {
    background: var(--color-primary-200, #bfdbfe);
    color: var(--color-primary-900, #1e3a8a);
  }

  .btn-pill-remove:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  .inline-input {
    border: none;
    outline: none;
    background: transparent;
    font-size: 14px;
    flex: 1;
    min-width: 120px;
    color: var(--color-neutral-800, #1f2937);
    padding: 2px 0;
  }

  .inline-input::placeholder {
    color: var(--color-neutral-400, #9ca3af);
  }

  .icon-right {
    color: var(--color-neutral-400, #9ca3af);
    display: flex;
    align-items: center;
    margin-left: 8px;
    pointer-events: none;
  }

  .dropdown-list {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    width: 100%;
    max-height: 220px;
    overflow-y: auto;
    background: white;
    border: 1px solid var(--color-neutral-200, #e5e7eb);
    border-radius: var(--radius-md, 8px);
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
    z-index: 100;
    margin: 0;
    padding: 4px 0;
    list-style: none;
  }

  .dropdown-item {
    padding: 8px 14px;
    cursor: pointer;
    transition: background 0.15s;
  }

  .dropdown-item:hover:not(.empty) {
    background: var(--color-neutral-100, #f3f4f6);
  }

  .item-title {
    font-size: 14px;
    font-weight: 500;
    color: var(--color-neutral-800, #1f2937);
  }

  .item-subtitle {
    font-size: 12px;
    color: var(--color-neutral-500, #6b7280);
    margin-top: 2px;
  }

  .empty {
    font-size: 13px;
    color: var(--color-neutral-500, #6b7280);
    font-style: italic;
    cursor: default;
    padding: 12px 14px;
    text-align: center;
  }
</style>
