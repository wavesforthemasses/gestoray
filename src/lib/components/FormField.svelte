<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    id: string;
    label: string;
    type?: string;
    value?: string;
    placeholder?: string;
    required?: boolean;
    disabled?: boolean;
    helpText?: string;
    class?: string;
    children?: Snippet;
  }

  let {
    id,
    label,
    type = 'text',
    value = $bindable(''),
    placeholder = '',
    required = false,
    disabled = false,
    helpText = '',
    class: className = '',
    children
  }: Props = $props();
</script>

<div class="form-group {className}">
  <label for={id}>{label}</label>
  {#if children}
    {@render children()}
  {:else}
    <input
      {id}
      {type}
      bind:value
      {placeholder}
      {required}
      {disabled}
    />
  {/if}
  {#if helpText}
    <span class="input-help">{helpText}</span>
  {/if}
</div>

<style>
  .form-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .form-group label {
    font-size: 12px;
    font-weight: 600;
    color: var(--color-neutral-500);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    display: inline-block;
  }

  .form-group input,
  :global(.form-group select) {
    background: var(--color-white);
    border: 1px solid var(--color-neutral-300);
    border-radius: var(--radius-md);
    padding: 12px 14px;
    font-family: inherit;
    font-size: 14px;
    color: var(--color-neutral-800);
    transition: border-color var(--transition-fast);
    width: 100%;
    box-sizing: border-box;
    height: 46px;
  }

  :global(.form-group select) {
    appearance: none;
    -webkit-appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23475569'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 14px center;
    background-size: 14px;
    padding-right: 36px;
    cursor: pointer;
  }

  .form-group input:focus:not(:disabled),
  :global(.form-group select:focus:not(:disabled)) {
    outline: none;
    border-color: var(--color-primary-500);
    box-shadow: 0 0 0 3px hsla(var(--brand-h), var(--brand-s), 50%, 0.15);
  }

  /* Globally override disabled styling for target inputs inside children snippets if disabled is passed */
  :global(.form-group input:disabled),
  :global(.form-group select:disabled) {
    background: var(--color-neutral-100) !important;
    border-color: var(--color-neutral-200) !important;
    color: var(--color-neutral-400) !important;
    cursor: not-allowed;
  }

  .input-help {
    font-size: 11px;
    color: var(--color-neutral-400);
  }
</style>
