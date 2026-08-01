<script lang="ts">
  import type { Component } from 'svelte';

  interface OptionItem {
    value: string;
    label: string;
  }

  interface Props {
    value: string;
    options: OptionItem[];
    icon?: Component<any>;
    onChange?: (val: string) => void;
    ariaLabel?: string;
  }

  let {
    value = $bindable(),
    options,
    icon: IconComponent,
    onChange,
    ariaLabel = 'Filtra'
  }: Props = $props();

  function handleChange(e: Event) {
    const newVal = (e.target as HTMLSelectElement).value;
    value = newVal;
    onChange?.(newVal);
  }
</script>

<div class="filter-select-wrapper" class:has-icon={!!IconComponent}>
  {#if IconComponent}
    <div class="filter-icon-box">
      <IconComponent size={16} />
    </div>
  {/if}
  <select
    bind:value
    onchange={handleChange}
    aria-label={ariaLabel}
  >
    {#each options as opt}
      <option value={opt.value}>{opt.label}</option>
    {/each}
  </select>
</div>

<style>
  .filter-select-wrapper {
    position: relative;
    display: inline-flex;
    align-items: center;
    height: 38px;
  }

  .filter-icon-box {
    position: absolute;
    left: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-neutral-400, #9ca3af);
    pointer-events: none;
    z-index: 2;
  }

  select {
    height: 38px;
    padding: 0 32px 0 12px;
    border: 1px solid var(--color-neutral-300, #d1d5db);
    border-radius: var(--radius-md, 8px);
    font-size: 13px;
    font-weight: 500;
    background-color: var(--color-surface, #ffffff);
    color: var(--color-neutral-700, #374151);
    outline: none;
    cursor: pointer;
    appearance: none;
    -webkit-appearance: none;
    -moz-appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%6B7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 10px center;
    transition: border-color 0.2s, box-shadow 0.2s;
    box-sizing: border-box;
  }

  .filter-select-wrapper.has-icon select {
    padding-left: 36px;
  }

  select:hover {
    border-color: var(--color-neutral-400, #9ca3af);
  }

  select:focus {
    border-color: var(--color-primary-500, #3b82f6);
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
  }
</style>
