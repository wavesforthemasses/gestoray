<script lang="ts">
  import { onMount } from 'svelte';
  import type { PlaceDocument } from '../../domain/models/place';
  import { PlaceFirestoreRepository } from '../../infrastructure/firestore/PlaceFirestoreRepository';
  import { MapPin, Search, ChevronDown, Check, Plus, X } from '@lucide/svelte';

  interface Props {
    selectedPlaceId?: string | null;
    clientId?: string;
    orgId?: string;
    placeholder?: string;
    disabled?: boolean;
    onSelect?: (place: PlaceDocument | null) => void;
  }

  let {
    selectedPlaceId = $bindable(null),
    clientId,
    orgId = 'default',
    placeholder = 'Seleziona un Luogo / Cantiere...',
    disabled = false,
    onSelect
  }: Props = $props();

  const repo = new PlaceFirestoreRepository();
  let places = $state<PlaceDocument[]>([]);
  let isOpen = $state(false);
  let search = $state('');
  let loading = $state(false);

  onMount(async () => {
    loading = true;
    try {
      places = await repo.fetchPlaces(orgId, { clientId });
    } catch (e) {
      console.warn('Errore PlaceSelector load:', e);
    } finally {
      loading = false;
    }
  });

  $effect(() => {
    if (clientId) {
      repo.fetchPlaces(orgId, { clientId }).then(res => {
        places = res;
      });
    }
  });

  const selectedPlace = $derived(
    places.find(p => p.id === selectedPlaceId) || null
  );

  const filteredPlaces = $derived.by(() => {
    if (!search.trim()) return places;
    const s = search.toLowerCase();
    return places.filter(p => 
      p.name.toLowerCase().includes(s) ||
      (p.code && p.code.toLowerCase().includes(s)) ||
      (p.address.city && p.address.city.toLowerCase().includes(s))
    );
  });

  function selectOption(place: PlaceDocument | null) {
    selectedPlaceId = place?.id || null;
    onSelect?.(place);
    isOpen = false;
    search = '';
  }
</script>

<div class="place-selector-wrapper">
  <div 
    class="selector-input-box {disabled ? 'disabled' : ''} {isOpen ? 'focused' : ''}"
    onclick={() => { if (!disabled) isOpen = !isOpen; }}
    role="combobox"
    tabindex="0"
    aria-expanded={isOpen}
    onkeydown={(e) => { if (e.key === 'Enter' && !disabled) isOpen = !isOpen; }}
  >
    <div class="input-left">
      <MapPin size={16} class="text-blue-600" />
      {#if selectedPlace}
        <span class="selected-text">
          {selectedPlace.name} 
          {#if selectedPlace.code}
            <span class="code-badge">{selectedPlace.code}</span>
          {/if}
        </span>
      {:else}
        <span class="placeholder-text">{placeholder}</span>
      {/if}
    </div>

    <div class="input-right">
      {#if selectedPlace && !disabled}
        <button 
          type="button" 
          class="btn-clear" 
          onclick={(e) => { e.stopPropagation(); selectOption(null); }}
          aria-label="Rimuovi selezione"
        >
          <X size={14} />
        </button>
      {/if}
      <ChevronDown size={16} class="text-slate-400" />
    </div>
  </div>

  {#if isOpen}
    <div class="dropdown-panel" onclick={(e) => e.stopPropagation()} role="presentation">
      <div class="dropdown-search-box">
        <Search size={14} class="text-slate-400" />
        <input 
          type="text" 
          bind:value={search} 
          placeholder="Cerca per nome, codice, città..." 
          class="search-input"
          autofocus
        />
      </div>

      <div class="options-list">
        {#if loading}
          <div class="option-empty">Caricamento luoghi...</div>
        {:else if filteredPlaces.length === 0}
          <div class="option-empty">Nessun luogo trovato</div>
        {:else}
          {#each filteredPlaces as place (place.id)}
            {@const isSelected = place.id === selectedPlaceId}
            <div 
              class="option-row {isSelected ? 'selected' : ''}"
              onclick={() => selectOption(place)}
              role="option"
              aria-selected={isSelected}
              tabindex="0"
              onkeydown={(e) => { if (e.key === 'Enter') selectOption(place); }}
            >
              <div class="option-info" style="padding-left: {place.depth * 12}px;">
                {#if place.depth > 0}
                  <span class="tree-dash">└─</span>
                {/if}
                <span class="option-name">{place.name}</span>
                {#if place.code}
                  <span class="option-code">{place.code}</span>
                {/if}
                {#if place.address?.city}
                  <span class="option-city">({place.address.city})</span>
                {/if}
              </div>

              {#if isSelected}
                <Check size={14} class="text-blue-600" />
              {/if}
            </div>
          {/each}
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .place-selector-wrapper {
    position: relative;
    width: 100%;
  }

  .selector-input-box {
    width: 100%;
    min-height: 42px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    background: #ffffff;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .selector-input-box:hover:not(.disabled) {
    border-color: #94a3b8;
  }

  .selector-input-box.focused {
    border-color: #2563eb;
    box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15);
  }

  .selector-input-box.disabled {
    background: #f1f5f9;
    cursor: not-allowed;
    opacity: 0.7;
  }

  .input-left {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
    min-width: 0;
  }

  .input-right {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .selected-text {
    font-size: 14px;
    font-weight: 500;
    color: #0f172a;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .placeholder-text {
    font-size: 14px;
    color: #94a3b8;
  }

  .code-badge {
    font-size: 11px;
    font-weight: 700;
    color: #2563eb;
    background: #eff6ff;
    padding: 1px 6px;
    border-radius: 4px;
  }

  .btn-clear {
    background: none;
    border: none;
    padding: 2px;
    color: #94a3b8;
    cursor: pointer;
  }

  .btn-clear:hover {
    color: #0f172a;
  }

  .dropdown-panel {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    right: 0;
    background: #ffffff;
    border: 1px solid #cbd5e1;
    border-radius: 10px;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
    z-index: 1000;
    overflow: hidden;
  }

  .dropdown-search-box {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-bottom: 1px solid #f1f5f9;
    background: #f8fafc;
  }

  .search-input {
    border: none;
    background: transparent;
    outline: none;
    width: 100%;
    font-size: 13px;
    color: #0f172a;
  }

  .options-list {
    max-height: 220px;
    overflow-y: auto;
    padding: 4px 0;
  }

  .option-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    cursor: pointer;
    font-size: 13px;
    transition: background 0.1s ease;
  }

  .option-row:hover {
    background: #f1f5f9;
  }

  .option-row.selected {
    background: #eff6ff;
    font-weight: 600;
  }

  .option-info {
    display: flex;
    align-items: center;
    gap: 6px;
    flex: 1;
  }

  .tree-dash {
    color: #94a3b8;
    font-family: monospace;
  }

  .option-name {
    color: #0f172a;
  }

  .option-code {
    font-size: 11px;
    color: #64748b;
    background: #f1f5f9;
    padding: 1px 4px;
    border-radius: 3px;
  }

  .option-city {
    font-size: 11px;
    color: #64748b;
  }

  .option-empty {
    padding: 12px;
    text-align: center;
    font-size: 12px;
    color: #64748b;
  }
</style>
