<script lang="ts">
  import { confirmStore } from '$lib/stores/confirm.svelte';
  import { ShieldAlert, X } from '@lucide/svelte';
  import { fade, scale } from 'svelte/transition';
  import Button from './Button.svelte';

  let inputValue = $state('');

  $effect(() => {
    if (confirmStore.isOpen) {
      inputValue = confirmStore.defaultValue || '';
    }
  });

  function handleKeydown(e: KeyboardEvent) {
    if (!confirmStore.isOpen) return;
    if (e.key === 'Escape') confirmStore.close();
    if (e.key === 'Enter') handleConfirm();
  }

  function handleConfirm() {
    if (confirmStore.inputMode === 'match') {
      if (inputValue !== confirmStore.expectedText) return;
      confirmStore.onConfirm();
    } else if (confirmStore.inputMode === 'text') {
      confirmStore.onConfirm(inputValue);
    } else {
      confirmStore.onConfirm();
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

{#if confirmStore.isOpen}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="modal-overlay" transition:fade={{ duration: 150 }} onclick={() => confirmStore.close()}>
    <div class="modal-content" transition:scale={{ duration: 200, start: 0.95 }} onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <div class="modal-title">
          <ShieldAlert size={20} class="warning-icon" />
          Conferma Azione
        </div>
        <button class="close-btn" onclick={() => confirmStore.close()}>
          <X size={18} />
        </button>
      </div>

      <div class="modal-body">
        <p>{confirmStore.message}</p>
        
        {#if confirmStore.inputMode !== 'none'}
          <div class="input-container">
            <!-- svelte-ignore a11y_autofocus -->
            <input 
              type="text" 
              bind:value={inputValue} 
              class="confirm-input"
              placeholder={confirmStore.inputMode === 'match' ? `Scrivi '${confirmStore.expectedText}'` : ''}
              autofocus
            />
          </div>
        {/if}
      </div>

      <div class="modal-actions">
        <Button variant="secondary" onclick={() => confirmStore.close()}>Annulla</Button>
        <Button 
          variant="danger" 
          disabled={confirmStore.inputMode === 'match' && inputValue !== confirmStore.expectedText}
          onclick={handleConfirm}
        >
          Conferma
        </Button>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(2px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    padding: 20px;
  }

  .modal-content {
    background: var(--color-white);
    border-radius: var(--radius-lg);
    width: 100%;
    max-width: 400px;
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1);
    overflow: hidden;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    border-bottom: 1px solid var(--color-neutral-100);
  }

  .modal-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--color-neutral-800);
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .close-btn {
    background: none;
    border: none;
    color: var(--color-neutral-400);
    cursor: pointer;
    padding: 4px;
    border-radius: var(--radius-sm);
    transition: all 0.2s;
    display: flex;
    align-items: center;
  }

  .close-btn:hover {
    background: var(--color-neutral-100);
    color: var(--color-neutral-600);
  }

  .modal-body {
    padding: 24px 20px;
    font-size: 15px;
    line-height: 1.5;
    color: var(--color-neutral-600);
  }

  .modal-actions {
    padding: 16px 20px;
    background: var(--color-neutral-50);
    border-top: 1px solid var(--color-neutral-100);
    display: flex;
    justify-content: flex-end;
    gap: 12px;
  }

  .input-container {
    margin-top: 16px;
  }

  .confirm-input {
    width: 100%;
    padding: 10px 12px;
    border: 1px solid var(--color-neutral-300);
    border-radius: var(--radius-md);
    font-size: 14px;
    font-family: inherit;
    outline: none;
    transition: all 0.2s;
  }

  .confirm-input:focus {
    border-color: var(--color-primary-500);
    box-shadow: 0 0 0 3px var(--color-primary-100);
  }
</style>
