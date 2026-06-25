<script lang="ts">
  import { auth } from '$lib/auth';
  import { Card, FormField } from '$lib';
  import { UserCog } from '@lucide/svelte';

  let newEmail = $state('');
  let nome = $state('');
  let cognome = $state('');
  let statusMessage = $state('');
  let isError = $state(false);
  let loading = $state(false);

  $effect(() => {
    if ($auth) {
      if (!newEmail) newEmail = $auth.email || '';
      if (!nome) nome = $auth.nome || '';
      if (!cognome) cognome = $auth.cognome || '';
    }
  });

  async function handleUpdateProfile(e: Event) {
    e.preventDefault();
    if (!newEmail || !nome || !cognome || !$auth) return;

    const cleanEmail = newEmail.trim().toLowerCase();
    const cleanNome = nome.trim();
    const cleanCognome = cognome.trim();

    loading = true;
    statusMessage = '';
    isError = false;

    try {
      const response = await fetch('/api/profile/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: $auth.uid,
          email: cleanEmail,
          nome: cleanNome,
          cognome: cleanCognome
        })
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || 'Errore durante l\'aggiornamento del profilo.');
      }

      auth.set({
        ...$auth,
        email: cleanEmail,
        nome: cleanNome,
        cognome: cleanCognome
      });

      statusMessage = 'Profilo aggiornato con successo!';
    } catch (err: any) {
      isError = true;
      statusMessage = err.message || 'Errore durante la modifica del profilo.';
    } finally {
      loading = false;
    }
  }
</script>

<svelte:head>
  <title>Il Mio Profilo | Gestoray</title>
</svelte:head>

<div class="profile-container animate-fade-in">
  <Card
    title="Impostazioni Profilo Personale"
    description="Modifica le tue credenziali e i dati di profilo associati al tuo account."
    class="profile-card"
  >
    {#snippet icon()}
      <UserCog size={20} class="icon-accent" />
    {/snippet}

    {#if statusMessage}
      <div class="status-alert animate-fade-in" class:error={isError}>
        {statusMessage}
      </div>
    {/if}

    {#if $auth}
      <form onsubmit={handleUpdateProfile} class="profile-form">
        <FormField id="profile-uid" label="ID Utente (UID)" helpText="L'ID utente è gestito dal sistema e non può essere modificato.">
          <input type="text" id="profile-uid" value={$auth.uid} disabled class="disabled-input" />
        </FormField>

        <div class="form-group">
          <span class="field-label">Ruoli Assegnati</span>
          <div class="roles-row">
            {#each $auth.roles as r}
              <span class="role-tag {r}">{r}</span>
            {/each}
          </div>
          <span class="input-help">Contatta un amministratore per modificare i ruoli assegnati al tuo account.</span>
        </div>

        <div class="form-group-row">
          <FormField id="profile-nome" label="Nome">
            <input
              type="text"
              id="profile-nome"
              bind:value={nome}
              placeholder="Nome"
              required
              disabled={loading}
            />
          </FormField>
          <FormField id="profile-cognome" label="Cognome">
            <input
              type="text"
              id="profile-cognome"
              bind:value={cognome}
              placeholder="Cognome"
              required
              disabled={loading}
            />
          </FormField>
        </div>

        <FormField id="profile-email" label="Modifica Indirizzo Email" helpText="Inserisci un nuovo indirizzo email unico. Riceverai i successivi PIN a questa email.">
          <input
            type="email"
            id="profile-email"
            bind:value={newEmail}
            placeholder="nome@azienda.com"
            required
            disabled={loading}
          />
        </FormField>

        <button type="submit" class="save-btn" disabled={loading || (newEmail === $auth.email && nome === $auth.nome && cognome === $auth.cognome)}>
          {#if loading}
            Salvataggio in corso...
          {:else}
            Salva Modifiche
          {/if}
        </button>
      </form>
    {/if}
  </Card>
</div>

<style>
  .profile-container {
    width: 100%;
  }

  :global(.icon-accent) {
    color: var(--color-primary-500);
  }

  .profile-form {
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

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .field-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--color-neutral-500);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .disabled-input {
    background: var(--color-neutral-100) !important;
    border-color: var(--color-neutral-200) !important;
    color: var(--color-neutral-400) !important;
    cursor: not-allowed;
  }

  .input-help {
    font-size: 11px;
    color: var(--color-neutral-400);
  }

  .roles-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    background: var(--color-neutral-100);
    padding: 10px 14px;
    border-radius: var(--radius-md);
    border: 1px solid var(--color-neutral-200);
  }

  .role-tag {
    font-size: 10px;
    font-weight: 600;
    padding: 2px 6px;
    border-radius: 4px;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    display: inline-block;
  }

  .role-tag.superadmin {
    background: var(--color-primary-100);
    color: var(--color-primary-800);
    border: 1px solid var(--color-primary-300);
  }

  .role-tag.amministrazione {
    background: var(--color-primary-50);
    color: var(--color-primary-700);
    border: 1px solid var(--color-primary-200);
  }

  .role-tag.commerciale {
    background: var(--color-neutral-100);
    color: var(--color-neutral-700);
    border: 1px solid var(--color-neutral-300);
  }

  .role-tag.direzione {
    background: var(--color-primary-50);
    color: var(--color-primary-600);
    border: 1px solid var(--color-primary-200);
  }

  .save-btn {
    background: linear-gradient(135deg, var(--color-primary-500), var(--color-primary-600));
    color: var(--color-white);
    padding: 14px;
    border: none;
    border-radius: var(--radius-md);
    font-family: inherit;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: opacity var(--transition-fast);
    margin-top: 10px;
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

  .animate-fade-in {
    animation: fadeIn 0.3s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  }
</style>
