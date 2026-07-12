<script lang="ts">
  import { FormField } from '$lib';
  import { Trash2 } from '@lucide/svelte';

  interface Props {
    isEditMode?: boolean;
    name: string;
    percentage: number;
    supervisorPercentage: number;
    submitting: boolean;
    onSubmit: (e: Event) => void;
    onDelete?: () => void;
  }

  let {
    isEditMode = false,
    name = $bindable(),
    percentage = $bindable(),
    supervisorPercentage = $bindable(),
    submitting,
    onSubmit,
    onDelete = undefined
  } = $props();
</script>

<form onsubmit={onSubmit} class="qual-form">
  <FormField id="qual-name" label="Nome Qualifica *" helpText="Es. Junior, Senior, Top Agent">
    <input
      type="text"
      id="qual-name"
      bind:value={name}
      required
      disabled={submitting}
    />
  </FormField>

  <div class="form-row">
    <FormField id="qual-percentage" label="Provvigione Commerciale (%) *" helpText="Percentuale di provvigione base per il commerciale.">
      <input
        type="number"
        id="qual-percentage"
        bind:value={percentage}
        min="0"
        max="100"
        step="0.01"
        required
        disabled={submitting}
      />
    </FormField>

    <FormField id="qual-super-percentage" label="Provvigione Supervisore (%) *" helpText="Percentuale di provvigione riconosciuta al supervisore.">
      <input
        type="number"
        id="qual-super-percentage"
        bind:value={supervisorPercentage}
        min="0"
        max="100"
        step="0.01"
        required
        disabled={submitting}
      />
    </FormField>
  </div>

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
          <Trash2 size={16} /> Elimina Qualifica
        </button>
      {/if}
    </div>
  {:else}
    <button type="submit" class="submit-btn" disabled={submitting}>
      {#if submitting}
        Salvataggio in corso...
      {:else}
        Crea Qualifica
      {/if}
    </button>
  {/if}
</form>

<style>
  .qual-form {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }

  @media (max-width: 600px) {
    .form-row {
      grid-template-columns: 1fr;
    }
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

  /* Per la pagina add, allinea a sinistra */
  :global(.add-page) .submit-btn {
    align-self: flex-start;
    margin-top: 10px;
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
