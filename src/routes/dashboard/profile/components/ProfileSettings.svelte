<script lang="ts">
  import { Card, FormField } from '$lib';
  import { UserCog } from '@lucide/svelte';
  import { toast } from '$lib/stores/toast.svelte';
  import { ProfileService } from '../profile.service';

  interface Props {
    authStore: any;
    onUpdateSuccess: (updatedAuth: any) => void;
  }

  let { authStore, onUpdateSuccess } = $props();

  let newEmail = $state(authStore.email || '');
  let nome = $state(authStore.nome || '');
  let cognome = $state(authStore.cognome || '');
  let loading = $state(false);

  async function handleUpdateProfile(e: Event) {
    e.preventDefault();
    if (!newEmail || !nome || !cognome) return;

    const cleanEmail = newEmail.trim().toLowerCase();
    const cleanNome = nome.trim();
    const cleanCognome = cognome.trim();

    loading = true;

    try {
      await ProfileService.updateProfile(authStore.uid, cleanEmail, cleanNome, cleanCognome);

      onUpdateSuccess({
        ...authStore,
        email: cleanEmail,
        nome: cleanNome,
        cognome: cleanCognome
      });

      toast.success('Profilo aggiornato con successo!');
    } catch (err: any) {
      toast.error(err.message || 'Errore durante la modifica del profilo.');
    } finally {
      loading = false;
    }
  }
</script>

<Card
  title="Impostazioni Profilo Personale"
  description="Modifica le tue credenziali e i dati di profilo associati al tuo account."
  class="profile-card"
>
  {#snippet icon()}
    <UserCog size={20} class="icon-accent" />
  {/snippet}

  <form onsubmit={handleUpdateProfile} class="profile-form">
    <FormField id="profile-uid" label="ID Utente (UID)" helpText="L'ID utente è gestito dal sistema e non può essere modificato.">
      <input type="text" id="profile-uid" value={authStore.uid} disabled class="disabled-input" />
    </FormField>

    <div class="form-group">
      <span class="field-label">Ruoli Assegnati</span>
      <div class="roles-row">
        {#each authStore.roles as r}
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

    <button type="submit" class="save-btn" disabled={loading || (newEmail === authStore.email && nome === authStore.nome && cognome === authStore.cognome)}>
      {#if loading}
        Salvataggio in corso...
      {:else}
        Salva Modifiche
      {/if}
    </button>
  </form>
</Card>

<style>
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
    margin-right: 4px;
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
    padding: 12px;
    border: none;
    border-radius: var(--radius-md);
    font-family: inherit;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: opacity var(--transition-fast);
    box-shadow: 0 4px 12px hsla(var(--brand-h), var(--brand-s), var(--brand-l), 0.2);
  }

  .save-btn:hover:not(:disabled) {
    opacity: 0.9;
  }

  .save-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    box-shadow: none;
  }
</style>
