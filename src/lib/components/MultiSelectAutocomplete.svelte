<script lang="ts">
  import { onMount } from 'svelte';
  import { Search } from '@lucide/svelte';

  export interface AutocompleteOption {
    id: string;
    label: string;
    sublabel?: string;
  }

  let { 
    options = [], 
    value = $bindable([]), 
    placeholder = 'Cerca...', 
    disabled = false,
    onchange
  }: {
    options: AutocompleteOption[];
    value: string[];
    placeholder?: string;
    disabled?: boolean;
    onchange?: (selectedIds: string[]) => void;
  } = $props();

  let isOpen = $state(false);
  let searchText = $state('');
  let containerRef: HTMLDivElement | null = $state(null);

  // Derived filtered options
  let filteredOptions = $derived(
    options.filter(o => {
      // Exclude already selected options
      if (value.includes(o.id)) return false;
      if (!searchText || isOpen === false) return true;
      const q = searchText.toLowerCase();
      return o.label.toLowerCase().includes(q) || (o.sublabel && o.sublabel.toLowerCase().includes(q));
    })
  );

  let selectedOptions = $derived(
    value.map(id => options.find(o => o.id === id)).filter(Boolean) as AutocompleteOption[]
  );

  function handleInputFocus() {
    if (!disabled) {
      isOpen = true;
    }
  }

  function handleSelect(option: AutocompleteOption) {
    if (!value.includes(option.id)) {
      value = [...value, option.id];
      searchText = '';
      if (onchange) onchange(value);
    }
  }

  function handleRemove(id: string) {
    if (disabled) return;
    value = value.filter(v => v !== id);
    if (onchange) onchange(value);
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

<div class="multi-autocomplete-container" bind:this={containerRef}>
  <div class="selected-tags">
    {#each selectedOptions as opt (opt.id)}
      <span class="tag">
        {opt.label}
        <button type="button" class="tag-remove" onclick={() => handleRemove(opt.id)} disabled={disabled}>&times;</button>
      </span>
    {/each}
  </div>

  <div class="input-wrapper">
    <input
      type="text"
      bind:value={searchText}
      onfocus={handleInputFocus}
      {placeholder}
      {disabled}
      class="form-input autocomplete-input"
    />
    <div class="search-icon"><Search size={16} /></div>
  </div>

  {#if isOpen && !disabled && filteredOptions.length > 0}
    <ul class="autocomplete-dropdown">
      {#each filteredOptions as option (option.id)}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
        <li class="autocomplete-item" onclick={() => handleSelect(option)}>
          <div class="opt-label">{option.label}</div>
          {#if option.sublabel}
            <div class="opt-sublabel">{option.sublabel}</div>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
  {#if isOpen && !disabled && filteredOptions.length === 0 && searchText}
    <ul class="autocomplete-dropdown">
      <li class="autocomplete-item empty">Nessun risultato trovato</li>
    </ul>
  {/if}
</div>

<style>
  .multi-autocomplete-container {
    position: relative;
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .selected-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }

  .tag {
    display: inline-flex;
    align-items: center;
    background: #e0e7ff;
    color: #3730a3;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.85rem;
    font-weight: 500;
  }

  .tag-remove {
    background: transparent;
    border: none;
    color: #4f46e5;
    margin-left: 0.3rem;
    cursor: pointer;
    font-size: 1.1rem;
    line-height: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
  }

  .tag-remove:hover {
    color: #312e81;
  }

  .tag-remove:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  .input-wrapper {
    position: relative;
    width: 100%;
  }

  .autocomplete-input {
    width: 100%;
    padding-right: 2rem;
  }

  .search-icon {
    position: absolute;
    right: 0.8rem;
    top: 50%;
    transform: translateY(-50%);
    font-size: 0.9rem;
    color: #6b7280;
    pointer-events: none;
  }

  .autocomplete-dropdown {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    width: 100%;
    max-height: 250px;
    overflow-y: auto;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06);
    z-index: 50;
    margin: 0;
    padding: 0.4rem 0;
    list-style: none;
  }

  .autocomplete-item {
    padding: 0.6rem 1rem;
    cursor: pointer;
    transition: background-color 0.15s ease;
  }

  .autocomplete-item:hover {
    background-color: #f3f4f6;
  }

  .opt-label {
    font-weight: 500;
    color: #111827;
  }

  .opt-sublabel {
    font-size: 0.85rem;
    color: #6b7280;
    margin-top: 0.1rem;
  }

  .empty {
    color: #6b7280;
    font-style: italic;
    cursor: default;
  }
  .empty:hover {
    background-color: transparent;
  }
</style>
