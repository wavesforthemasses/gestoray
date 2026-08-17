<script lang="ts">
  import { onMount } from 'svelte';
  import { Loader2, X, ChevronDown } from '@lucide/svelte';

  export interface AutocompleteOption {
    id: string;
    label: string;
    sublabel?: string;
  }

  let { 
    options = [], 
    value = $bindable(''), 
    placeholder = 'Cerca...', 
    disabled = false,
    mode = 'local',
    debounceMs = 300,
    fetchOptions,
    onchange
  }: {
    options?: AutocompleteOption[];
    value: string;
    placeholder?: string;
    disabled?: boolean;
    mode?: 'local' | 'remote';
    debounceMs?: number;
    fetchOptions?: (searchQuery: string) => Promise<AutocompleteOption[]>;
    onchange?: (selectedId: string) => void;
  } = $props();

  let isOpen = $state(false);
  let searchText = $state('');
  let loadingRemote = $state(false);
  let remoteOptions = $state<AutocompleteOption[]>([]);
  let containerRef: HTMLDivElement | null = $state(null);

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  // Active options pool depending on mode
  let currentOptions = $derived(mode === 'remote' ? remoteOptions : options);

  // Sync searchText when value changes externally
  $effect(() => {
    const selectedOpt = currentOptions.find(o => o.id === value);
    if (selectedOpt) {
      searchText = selectedOpt.label;
    } else if (!value && !isOpen) {
      searchText = '';
    }
  });

  let filteredOptions = $derived.by(() => {
    if (mode === 'remote') {
      return remoteOptions;
    }
    if (!searchText || !isOpen) return options;
    const q = searchText.toLowerCase().trim();
    return options.filter(o => 
      o.label.toLowerCase().includes(q) || (o.sublabel && o.sublabel.toLowerCase().includes(q))
    );
  });

  function handleInputFocus() {
    if (!disabled) {
      isOpen = true;
      if (mode === 'remote' && fetchOptions && remoteOptions.length === 0) {
        triggerRemoteSearch(searchText);
      }
    }
  }

  function handleInputText(e: Event) {
    const inputVal = (e.target as HTMLInputElement).value;
    searchText = inputVal;
    isOpen = true;

    if (mode === 'remote' && fetchOptions) {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        triggerRemoteSearch(inputVal);
      }, debounceMs);
    }
  }

  async function triggerRemoteSearch(queryStr: string) {
    if (!fetchOptions) return;
    loadingRemote = true;
    try {
      remoteOptions = await fetchOptions(queryStr);
    } catch (err) {
      console.warn('Errore ricerca remota autocomplete:', err);
      remoteOptions = [];
    } finally {
      loadingRemote = false;
    }
  }

  function handleSelectOption(opt: AutocompleteOption) {
    value = opt.id;
    searchText = opt.label;
    isOpen = false;
    if (onchange) onchange(opt.id);
  }

  function handleClear() {
    value = '';
    searchText = '';
    remoteOptions = [];
    isOpen = false;
    if (onchange) onchange('');
  }

  function handleOutsideClick(e: MouseEvent) {
    if (containerRef && !containerRef.contains(e.target as Node)) {
      isOpen = false;
      const selectedOpt = currentOptions.find(o => o.id === value);
      if (selectedOpt) {
        searchText = selectedOpt.label;
      } else if (!value) {
        searchText = '';
      }
    }
  }

  onMount(() => {
    document.addEventListener('click', handleOutsideClick);
    return () => {
      document.removeEventListener('click', handleOutsideClick);
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  });
</script>

<div class="autocomplete-container" bind:this={containerRef}>
  <div class="input-wrapper">
    <input 
      type="text" 
      class="autocomplete-input"
      {placeholder}
      {disabled}
      bind:value={searchText}
      onfocus={handleInputFocus}
      oninput={handleInputText}
    />
    {#if loadingRemote}
      <span class="loading-spinner">
        <Loader2 size={15} />
      </span>
    {:else if value && !disabled}
      <button type="button" class="btn-clear" onclick={handleClear} aria-label="Cancella">
        <X size={14} />
      </button>
    {/if}
    <span class="dropdown-arrow">
      <ChevronDown size={14} />
    </span>
  </div>

  {#if isOpen && !disabled}
    <ul class="options-list">
      {#if loadingRemote}
        <li class="no-options">Ricerca in corso...</li>
      {:else if filteredOptions.length === 0}
        <li class="no-options">Nessun risultato trovato</li>
      {:else}
        {#each filteredOptions as opt}
          <li>
            <button
              type="button"
              class="option-item {opt.id === value ? 'selected' : ''}" 
              onclick={() => handleSelectOption(opt)}
            >
              <span class="opt-label">{opt.label}</span>
              {#if opt.sublabel}
                <span class="opt-sublabel">{opt.sublabel}</span>
              {/if}
            </button>
          </li>
        {/each}
      {/if}
    </ul>
  {/if}
</div>

<style>
  .autocomplete-container {
    position: relative;
    width: 100%;
  }

  .input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
  }

  .autocomplete-input {
    width: 100%;
    padding: 0.6rem 2.2rem 0.6rem 0.8rem;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    font-size: 0.88rem;
    background: #ffffff;
  }

  .autocomplete-input:disabled {
    background: #f1f5f9;
    cursor: not-allowed;
  }

  .loading-spinner {
    position: absolute;
    right: 1.8rem;
    font-size: 0.75rem;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  .btn-clear {
    position: absolute;
    right: 1.8rem;
    background: none;
    border: none;
    color: #94a3b8;
    cursor: pointer;
    font-size: 0.8rem;
    padding: 0.2rem;
  }

  .btn-clear:hover {
    color: #ef4444;
  }

  .dropdown-arrow {
    position: absolute;
    right: 0.6rem;
    font-size: 0.65rem;
    color: #94a3b8;
    pointer-events: none;
  }

  .options-list {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    margin-top: 0.2rem;
    background: #ffffff;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    max-height: 200px;
    overflow-y: auto;
    z-index: 100;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    list-style: none;
    padding: 0.2rem 0;
  }

  .option-item {
    width: 100%;
    border: none;
    background: none;
    text-align: left;
    padding: 0.6rem 0.8rem;
    display: flex;
    flex-direction: column;
    cursor: pointer;
    font-size: 0.88rem;
  }

  .option-item:hover, .option-item.selected {
    background: #eff6ff;
    color: #1d4ed8;
  }

  .opt-label {
    font-weight: 600;
  }

  .opt-sublabel {
    font-size: 0.78rem;
    color: #64748b;
  }

  .no-options {
    padding: 0.8rem;
    font-size: 0.85rem;
    color: #94a3b8;
    text-align: center;
  }
</style>
