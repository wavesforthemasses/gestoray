<script lang="ts">
  import { X, Search } from '@lucide/svelte';

  interface Props {
    searchQuery: string;
    selectedStatus: string;
    selectedMode: string;
    selectedOperator: string;
    users: { id: string; name: string }[];
  }

  let {
    searchQuery = $bindable(''),
    selectedStatus = $bindable(''),
    selectedMode = $bindable(''),
    selectedOperator = $bindable(''),
    users = []
  }: Props = $props();

  function resetFilters() {
    searchQuery = '';
    selectedStatus = '';
    selectedMode = '';
    selectedOperator = '';
  }
</script>

<div class="filters-card">
  <div class="filter-group main-search">
    <input 
      type="text" 
      placeholder="Cerca per titolo, cliente o luogo..." 
      bind:value={searchQuery}
      class="form-control search-input"
    />
  </div>

  <div class="filter-group">
    <select bind:value={selectedStatus} class="form-control">
      <option value="">Tutti gli Stati</option>
      <option value="pianificato">Pianificato</option>
      <option value="in_lavorazione">In Lavorazione</option>
      <option value="completato">Consuntivato</option>
      <option value="approvato">Approvato</option>
      <option value="fatturato">Fatturato</option>
    </select>
  </div>

  <div class="filter-group">
    <select bind:value={selectedMode} class="form-control">
      <option value="">Tutte le Modalità</option>
      <option value="a_bolla">A Bolla / Consuntivo</option>
      <option value="ad_erogazione">Ad Erogazione (Contratto)</option>
    </select>
  </div>

  <div class="filter-group">
    <select bind:value={selectedOperator} class="form-control">
      <option value="">Tutti gli Operatori</option>
      {#each users as u}
        <option value={u.id}>{u.name}</option>
      {/each}
    </select>
  </div>

  {#if searchQuery || selectedStatus || selectedMode || selectedOperator}
    <button onclick={resetFilters} class="btn-reset" title="Resetta Filtri">
      <X size={14} class="inline-icon" /> Resetta
    </button>
  {/if}
</div>

<style>
  .filters-card {
    background: var(--color-white);
    border: 1px solid var(--color-neutral-200);
    border-radius: var(--radius-lg);
    padding: 14px 16px;
    margin-bottom: 24px;
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    box-shadow: var(--shadow-sm);
  }
  .filter-group {
    flex: 1;
    min-width: 160px;
  }
  .filter-group.main-search {
    flex: 2;
    min-width: 240px;
  }
  .form-control {
    width: 100%;
    padding: 8px 12px;
    font-size: 13px;
    border: 1px solid var(--color-neutral-300);
    border-radius: var(--radius-md);
    background: var(--color-white);
    color: var(--color-neutral-800);
    outline: none;
    box-sizing: border-box;
  }
  .form-control:focus {
    border-color: var(--color-primary-500);
  }
  .btn-reset {
    background: transparent;
    border: none;
    color: var(--color-neutral-500);
    font-size: 13px;
    cursor: pointer;
    font-weight: 600;
  }
  .btn-reset:hover {
    color: var(--color-error);
  }
</style>
