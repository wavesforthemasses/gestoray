<script lang="ts">
  import { toast } from '$lib/stores/toast.svelte';
  import { CheckCircle, AlertCircle, Info, X } from '@lucide/svelte';
  import { fade, slide } from 'svelte/transition';
  import { flip } from 'svelte/animate';
</script>

<div class="toast-container">
  {#each toast.messages as t (t.id)}
    <div 
      class="toast toast-{t.type}" 
      in:slide={{ duration: 300 }} 
      out:fade={{ duration: 200 }}
      animate:flip={{ duration: 300 }}
    >
      <div class="toast-icon">
        {#if t.type === 'success'}
          <CheckCircle size={20} />
        {:else if t.type === 'error'}
          <AlertCircle size={20} />
        {:else}
          <Info size={20} />
        {/if}
      </div>
      <div class="toast-message">{t.message}</div>
      <button class="toast-close" onclick={() => toast.remove(t.id)}>
        <X size={16} />
      </button>
    </div>
  {/each}
</div>

<style>
  .toast-container {
    position: fixed;
    top: 24px;
    right: 24px;
    z-index: 9999;
    display: flex;
    flex-direction: column;
    gap: 12px;
    pointer-events: none;
  }

  .toast {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    min-width: 300px;
    max-width: 400px;
    padding: 16px;
    border-radius: var(--radius-md);
    background: var(--color-white);
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
    pointer-events: auto;
    border-left: 4px solid transparent;
  }

  .toast-success {
    border-left-color: var(--color-success);
  }

  .toast-error {
    border-left-color: var(--color-error);
  }

  .toast-info {
    border-left-color: var(--color-primary-500);
  }

  .toast-icon {
    flex-shrink: 0;
    margin-top: 2px;
  }

  .toast-success .toast-icon {
    color: var(--color-success);
  }

  .toast-error .toast-icon {
    color: var(--color-error);
  }

  .toast-info .toast-icon {
    color: var(--color-primary-500);
  }

  .toast-message {
    flex-grow: 1;
    font-size: 14px;
    font-weight: 500;
    color: var(--color-neutral-800);
    line-height: 1.4;
  }

  .toast-close {
    flex-shrink: 0;
    background: none;
    border: none;
    padding: 2px;
    margin: -2px;
    color: var(--color-neutral-400);
    cursor: pointer;
    border-radius: var(--radius-sm);
    transition: all 0.2s;
  }

  .toast-close:hover {
    color: var(--color-neutral-600);
    background: var(--color-neutral-100);
  }
</style>
