<script lang="ts">
  import { activeRole } from '$lib/auth';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { Card, FormField } from '$lib';
  import { Award, ArrowLeft } from '@lucide/svelte';
  import { QualificationsService } from '$lib/services/qualifications';

  let name = $state('');
  let percentage = $state(0);
  let supervisorPercentage = $state(0);

  let submitting = $state(false);
  let errorMsg = $state('');

  onMount(() => {
    const unsubscribe = activeRole.subscribe(($activeRole) => {
      if ($activeRole && $activeRole !== 'superadmin') {
        goto('/dashboard');
      }
    });
    return () => unsubscribe();
  });

  async function handleCreate(e: Event) {
    e.preventDefault();
    if (!name.trim()) {
      errorMsg = "Il nome della qualifica è obbligatorio.";
      return;
    }

    submitting = true;
    errorMsg = '';

    try {
      await QualificationsService.create({
        name: name.trim(),
        percentage: Number(percentage),
        supervisorPercentage: Number(supervisorPercentage)
      });
      goto('/dashboard/qualifications');
    } catch (err: any) {
      errorMsg = err.message || 'Errore durante la creazione.';
      submitting = false;
    }
  }
</script>

<svelte:head>
  <title>Aggiungi Qualifica | Gestoray</title>
</svelte:head>

<div class="add-page animate-fade-in">
  {#if errorMsg}
    <div class="alert error animate-fade-in">{errorMsg}</div>
  {/if}

  <Card
    title="Aggiungi Nuova Qualifica"
    description="Crea una nuova qualifica per i commerciali."
    class="form-card"
  >
    {#snippet icon()}
      <Award size={20} class="icon-accent" />
    {/snippet}

    {#snippet headerSnippet()}
      <button onclick={() => goto('/dashboard/qualifications')} class="back-link">
        <ArrowLeft size={14} /> Annulla
      </button>
    {/snippet}

    <form onsubmit={handleCreate} class="qual-form">
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

      <button type="submit" class="submit-btn" disabled={submitting}>
        {#if submitting}
          Salvataggio in corso...
        {:else}
          Crea Qualifica
        {/if}
      </button>
    </form>
  </Card>
</div>

<style>
  .add-page {
    width: 100%;
    max-width: 800px;
    margin: 0 auto;
  }

  :global(.icon-accent) {
    color: var(--color-primary-500);
  }

  .back-link {
    background: var(--color-white);
    border: 1px solid var(--color-neutral-300);
    color: var(--color-neutral-600);
    padding: 8px 14px;
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-family: inherit;
    font-size: 13px;
    font-weight: 600;
    transition: all 0.2s;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .back-link:hover {
    background: var(--color-neutral-100);
    color: var(--color-neutral-800);
  }

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
    align-self: flex-start;
    box-shadow: 0 4px 12px hsla(var(--brand-h), var(--brand-s), var(--brand-l), 0.2);
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

  .alert {
    padding: 14px 16px;
    border-radius: var(--radius-md);
    font-size: 14px;
    margin-bottom: 25px;
  }

  .alert.error {
    background: var(--color-error-light);
    border: 1px solid var(--color-error-border);
    color: var(--color-error-text);
  }

  .animate-fade-in {
    animation: fadeIn 0.3s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  }
</style>
