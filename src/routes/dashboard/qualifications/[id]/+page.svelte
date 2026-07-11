<script lang="ts">
  import { activeRole } from '$lib/auth';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { Card, FormField } from '$lib';
  import { Award, ArrowLeft, Trash2 } from '@lucide/svelte';
  import { QualificationsService, type Qualification } from '$lib/services/qualifications';

  let uid = $page.params.id as string;

  let name = $state('');
  let percentage = $state(0);
  let supervisorPercentage = $state(0);

  let loading = $state(true);
  let submitting = $state(false);
  let errorMsg = $state('');
  let successMsg = $state('');

  onMount(() => {
    const unsubscribe = activeRole.subscribe(($activeRole) => {
      if ($activeRole && $activeRole !== 'superadmin') {
        goto('/dashboard');
      }
    });

    fetchQualification();

    return () => unsubscribe();
  });

  async function fetchQualification() {
    loading = true;
    try {
      const q = await QualificationsService.getOne(uid);
      if (q) {
        name = q.name;
        percentage = q.percentage;
        supervisorPercentage = q.supervisorPercentage;
      } else {
        errorMsg = "Qualifica non trovata.";
      }
    } catch (e: any) {
      errorMsg = "Errore durante il caricamento: " + e.message;
    } finally {
      loading = false;
    }
  }

  async function handleUpdate(e: Event) {
    e.preventDefault();
    if (!name.trim()) {
      errorMsg = "Il nome della qualifica è obbligatorio.";
      return;
    }

    submitting = true;
    errorMsg = '';
    successMsg = '';

    try {
      await QualificationsService.update(uid, {
        name: name.trim(),
        percentage: Number(percentage),
        supervisorPercentage: Number(supervisorPercentage)
      });
      successMsg = "Qualifica aggiornata con successo!";
    } catch (err: any) {
      errorMsg = err.message || 'Errore durante il salvataggio.';
    } finally {
      submitting = false;
    }
  }

  async function handleDelete() {
    if (!confirm("Sei sicuro di voler eliminare questa qualifica? Questa azione non può essere annullata.")) {
      return;
    }
    submitting = true;
    try {
      await QualificationsService.remove(uid);
      goto('/dashboard/qualifications');
    } catch (err: any) {
      errorMsg = err.message || 'Errore durante l\'eliminazione.';
      submitting = false;
    }
  }
</script>

<svelte:head>
  <title>Modifica Qualifica | Gestoray</title>
</svelte:head>

<div class="edit-page animate-fade-in">
  {#if errorMsg}
    <div class="alert error animate-fade-in">{errorMsg}</div>
  {/if}
  {#if successMsg}
    <div class="alert success animate-fade-in">{successMsg}</div>
  {/if}

  <Card
    title="Modifica Qualifica"
    description="Modifica i parametri o elimina questa qualifica."
    class="form-card"
  >
    {#snippet icon()}
      <Award size={20} class="icon-accent" />
    {/snippet}

    {#snippet headerSnippet()}
      <button onclick={() => goto('/dashboard/qualifications')} class="back-link">
        <ArrowLeft size={14} /> Torna all'elenco
      </button>
    {/snippet}

    {#if loading}
      <div class="loader-box">
        <span class="spinner"></span>
        Caricamento dati...
      </div>
    {:else}
      <form onsubmit={handleUpdate} class="qual-form">
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

        <div class="actions-row">
          <button type="submit" class="submit-btn" disabled={submitting}>
            {#if submitting}
              Salvataggio in corso...
            {:else}
              Salva Modifiche
            {/if}
          </button>
          
          <button type="button" class="delete-btn" onclick={handleDelete} disabled={submitting}>
            <Trash2 size={16} /> Elimina Qualifica
          </button>
        </div>
      </form>
    {/if}
  </Card>
</div>

<style>
  .edit-page {
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

  .alert.success {
    background: var(--color-success-light);
    border: 1px solid var(--color-success-border);
    color: var(--color-success-text);
  }

  .loader-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 14px;
    padding: 40px;
  }

  .spinner {
    width: 24px;
    height: 24px;
    border: 3px solid hsla(var(--brand-h), var(--brand-s), var(--brand-l), 0.15);
    border-radius: 50%;
    border-top-color: var(--color-primary-500);
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .animate-fade-in {
    animation: fadeIn 0.3s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  }
</style>
