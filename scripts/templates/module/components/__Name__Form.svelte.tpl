<script lang="ts">
  import { FormField } from '$lib';
  import { Trash2 } from '@lucide/svelte';

  interface Props {
    isEditMode?: boolean;
    name: string;
    submitting: boolean;
    onSubmit: (e: Event) => void;
    onDelete?: () => void;
  }

  let {
    isEditMode = false,
    name = $bindable(),
    submitting,
    onSubmit,
    onDelete = undefined
  } = $props();
</script>

<form onsubmit={onSubmit} class="entity-form">
  <FormField id="field-name" label="Nome *" helpText="Inserisci il nome dell'elemento.">
    <input
      type="text"
      id="field-name"
      bind:value={name}
      required
      disabled={submitting}
    />
  </FormField>

  {#if isEditMode}
    <div class="actions-row">
      <button type="submit" class="submit-btn" disabled={submitting}>
        {#if submitting}
          Salvataggio in corso...
        {:else}
          Salva Modifiche
        {/if}
      </button>
      
      {#if onDelete}
        <button type="button" class="delete-btn" onclick={onDelete} disabled={submitting}>
          <Trash2 size={16} /> Elimina
        </button>
      {/if}
    </div>
  {:else}
    <button type="submit" class="submit-btn" disabled={submitting}>
      {#if submitting}
        Salvataggio in corso...
      {:else}
        Crea Elemento
      {/if}
    </button>
  {/if}
</form>

<style>
  .entity-form {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .actions-row {
    display: flex;
    gap: 12px;
    margin-top: 10px;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
  }

  .submit-btn {
    background: linear-gradient(135deg, var(--color-primary-500), var(--color-primary-600));
    color: var(--color-white);
    border: none;
    padding: 12px 24px;
    border-radius: var(--radius-md);
    cursor: pointer;
    font-family: inherit;
    font-size: 14px;
    font-weight: 600;
    transition: opacity 0.2s;
    box-shadow: 0 4px 12px hsla(var(--brand-h), var(--brand-s), var(--brand-l), 0.2);
  }

  .submit-btn:hover:not(:disabled) {
    opacity: 0.9;
  }

  .submit-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    box-shadow: none;
  }

  .delete-btn {
    background: var(--color-error-light);
    color: var(--color-error-text);
    border: 1px solid var(--color-error-border);
    padding: 10px 16px;
    border-radius: var(--radius-md);
    cursor: pointer;
    font-family: inherit;
    font-size: 13px;
    font-weight: 600;
    transition: all 0.2s;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .delete-btn:hover:not(:disabled) {
    background: var(--color-error);
    color: var(--color-white);
  }

  .delete-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
