<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    type?: 'button' | 'submit' | 'reset';
    variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'warning';
    size?: 'sm' | 'md' | 'lg';
    disabled?: boolean;
    class?: string;
    style?: string;
    onclick?: (e: MouseEvent) => void;
    children?: Snippet;
  }

  let {
    type = 'button',
    variant = 'primary',
    size = 'md',
    disabled = false,
    class: className = '',
    style = '',
    onclick,
    children
  }: Props = $props();

  function handleClick(e: MouseEvent) {
    if (!disabled && onclick) {
      onclick(e);
    }
  }
</script>

<button
  {type}
  class="btn-generic variant-{variant} size-{size} {className}"
  {style}
  {disabled}
  onclick={handleClick}
>
  {#if children}
    {@render children()}
  {/if}
</button>

<style>
  .btn-generic {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    font-family: inherit;
    font-weight: 600;
    border: none;
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .btn-generic:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    box-shadow: none !important;
    transform: none !important;
  }

  /* Sizes */
  .size-sm {
    padding: 8px 14px;
    font-size: 13px;
    border-radius: var(--radius-sm);
  }

  .size-md {
    padding: 12px 20px;
    font-size: 14px;
    border-radius: var(--radius-md);
  }

  .size-lg {
    padding: 14px 24px;
    font-size: 15px;
    border-radius: var(--radius-lg);
  }

  /* Variants */
  .variant-primary {
    background: linear-gradient(135deg, var(--color-primary-500), var(--color-primary-600));
    color: var(--color-white);
    box-shadow: 0 4px 12px hsla(var(--brand-h), var(--brand-s), var(--brand-l), 0.2);
  }
  .variant-primary:hover:not(:disabled) {
    background: linear-gradient(135deg, var(--color-secondary-500), var(--color-secondary-600));
    color: var(--color-secondary-text-contrast);
    box-shadow: 0 6px 16px hsla(var(--sec-h), var(--sec-s), var(--sec-l), 0.25);
    transform: translateY(-1px);
  }

  .variant-secondary {
    background: var(--color-white);
    color: var(--color-neutral-600);
    border: 1px solid var(--color-neutral-300);
  }
  .variant-secondary:hover:not(:disabled) {
    background: var(--color-neutral-100);
    color: var(--color-neutral-800);
  }

  .variant-danger {
    background: var(--color-error);
    color: var(--color-white);
  }
  .variant-danger:hover:not(:disabled) {
    background: hsl(346, 84%, 40%);
  }

  .variant-success {
    background: var(--color-success);
    color: var(--color-white);
  }
  .variant-success:hover:not(:disabled) {
    background: hsl(142, 76%, 30%);
  }

  .variant-warning {
    background: var(--color-warning);
    color: var(--color-white);
  }
  .variant-warning:hover:not(:disabled) {
    background: hsl(38, 92%, 40%);
  }
</style>
