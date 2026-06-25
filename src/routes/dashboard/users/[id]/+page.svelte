<script lang="ts">
  import { page } from '$app/stores';
  import { auth, activeRole } from '$lib/auth';
  import { db, doc, getDoc } from '$lib/firebase';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { Card, FormField, RoleSelector } from '$lib';
  import { User, ArrowLeft } from '@lucide/svelte';

  let uid = $page.params.id as string;

  let userEmail = $state('');
  let userNome = $state('');
  let userCognome = $state('');
  let createdAt = $state('');
  let selectedRoles = $state<string[]>([]);

  let statusMessage = $state('');
  let isError = $state(false);
  let loadingDetails = $state(true);
  let saving = $state(false);

  async function fetchUserDetails() {
    try {
      const userDoc = await getDoc(doc(db, 'users', uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        userEmail = data.email || '';
        userNome = data.nome || '';
        userCognome = data.cognome || '';
        createdAt = data.createdAt || '';
        selectedRoles = data.roles || [];
      } else {
        isError = true;
        statusMessage = 'Impossibile trovare l\'utente specificato nel database.';
      }
    } catch (e: any) {
      console.error('Error fetching user details:', e);
      isError = true;
      statusMessage = 'Errore nel recupero dei dettagli: ' + e.message;
    } finally {
      loadingDetails = false;
    }
  }

  onMount(() => {
    const unsubscribe = activeRole.subscribe(($activeRole) => {
      if ($activeRole && $activeRole !== 'superadmin') {
        goto('/dashboard');
      }
    });

    fetchUserDetails();

    return () => unsubscribe();
  });

  async function handleUpdateUser(e: Event) {
    e.preventDefault();
    if (!userEmail || !userNome || !userCognome) return;

    saving = true;
    statusMessage = '';
    isError = false;

    try {
      if (selectedRoles.length === 0) {
        throw new Error('Seleziona almeno un ruolo per l\'utente.');
      }

      const cleanEmail = userEmail.trim().toLowerCase();
      const cleanNome = userNome.trim();
      const cleanCognome = userCognome.trim();

      const response = await fetch('/api/users/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid,
          email: cleanEmail,
          nome: cleanNome,
          cognome: cleanCognome,
          roles: selectedRoles
        })
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || 'Errore durante l\'aggiornamento dell\'utente.');
      }

      statusMessage = 'Dati utente aggiornati con successo!';
    } catch (err: any) {
      isError = true;
      statusMessage = err.message || 'Errore durante il salvataggio.';
    } finally {
      saving = false;
    }
  }
</script>

<svelte:head>
  <title>Dettagli Utente | Gestoray</title>
</svelte:head>

<div class="details-page-container animate-fade-in">
  <Card
    title="Dettagli Utente e Configurazione Ruoli"
    description="UID Utente: {uid}"
    class="details-card"
  >
    {#snippet icon()}
      <User size={20} class="icon-accent" />
    {/snippet}

    {#snippet headerSnippet()}
      <button onclick={() => goto('/dashboard/users')} class="back-link">
        <ArrowLeft size={14} /> Torna all'elenco
      </button>
    {/snippet}

    {#if statusMessage}
      <div class="status-alert animate-fade-in" class:error={isError}>
        {statusMessage}
      </div>
    {/if}

    {#if loadingDetails}
      <div class="loading-spinner-box">
        <div class="spinner"></div>
        <p>Caricamento dettagli utente...</p>
      </div>
    {:else if !isError}
      <form onsubmit={handleUpdateUser} class="details-form">
        <div class="form-group-row">
          <FormField id="user-nome" label="Nome">
            <input
              type="text"
              id="user-nome"
              bind:value={userNome}
              required
              disabled={saving}
            />
          </FormField>
          <FormField id="user-cognome" label="Cognome">
            <input
              type="text"
              id="user-cognome"
              bind:value={userCognome}
              required
              disabled={saving}
            />
          </FormField>
        </div>

        <FormField id="user-email" label="Indirizzo Email" helpText="La modifica dell'email si rifletterà anche sul record di autenticazione del PIN.">
          <input
            type="email"
            id="user-email"
            bind:value={userEmail}
            required
            disabled={saving}
          />
        </FormField>

        <FormField id="created-at" label="Data di Creazione">
          <input
            type="text"
            id="created-at"
            value={createdAt ? new Date(createdAt).toLocaleString('it-IT') : 'N/D'}
            disabled
            class="disabled-input"
          />
        </FormField>

        <RoleSelector bind:selectedRoles={selectedRoles} disabled={saving} />

        <div class="actions-row">
          <button type="submit" class="save-btn" disabled={saving}>
            {#if saving}
              Salvataggio...
            {:else}
              Salva Modifiche
            {/if}
          </button>
          <button type="button" onclick={() => goto('/dashboard/users')} class="cancel-btn" disabled={saving}>
            Annulla
          </button>
        </div>
      </form>
    {/if}
  </Card>
</div>

<style>
  .details-page-container {
    width: 100%;
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

  .details-form {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .form-group-row {
    display: flex;
    gap: 20px;
  }

  .form-group-row > :global(.form-group) {
    flex: 1;
  }

  @media (max-width: 576px) {
    .form-group-row {
      flex-direction: column;
      gap: 24px;
    }
  }

  .disabled-input {
    background: var(--color-neutral-100) !important;
    border-color: var(--color-neutral-200) !important;
    color: var(--color-neutral-400) !important;
    cursor: not-allowed;
  }

  .actions-row {
    display: flex;
    gap: 12px;
    margin-top: 10px;
  }

  .save-btn {
    background: linear-gradient(135deg, var(--color-primary-500), var(--color-primary-600));
    color: var(--color-white);
    padding: 14px 24px;
    border: none;
    border-radius: var(--radius-md);
    font-family: inherit;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: opacity var(--transition-fast);
    box-shadow: 0 4px 12px hsla(var(--brand-h), var(--brand-s), 50%, 0.2);
  }

  .save-btn:hover:not(:disabled) {
    opacity: 0.9;
  }

  .save-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    box-shadow: none;
  }

  .cancel-btn {
    background: var(--color-white);
    border: 1px solid var(--color-neutral-300);
    color: var(--color-neutral-600);
    padding: 14px 24px;
    border-radius: var(--radius-md);
    cursor: pointer;
    font-family: inherit;
    font-size: 14px;
    font-weight: 600;
    transition: all 0.2s;
  }

  .cancel-btn:hover {
    background: var(--color-neutral-100);
    color: var(--color-neutral-800);
  }

  .status-alert {
    padding: 14px 16px;
    border-radius: var(--radius-md);
    font-size: 14px;
    margin-bottom: 25px;
    background: var(--color-success-light);
    border: 1px solid var(--color-success-border);
    color: var(--color-success-text);
  }

  .status-alert.error {
    background: var(--color-error-light);
    border: 1px solid var(--color-error-border);
    color: var(--color-error-text);
  }

  .loading-spinner-box {
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
    border: 3px solid hsla(var(--brand-h), var(--brand-s), 50%, 0.15);
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
