<script lang="ts">
  import { Card, FormField, RoleSelector } from '$lib';
  import { UserPlus, ArrowLeft } from '@lucide/svelte';
  import { toast } from '$lib/stores/toast.svelte';
  import { UsersService, type UserData } from '../users.service';

  interface Props {
    usersList: UserData[];
    qualificationsList: any[];
    creatorUid: string;
    onCancel: () => void;
    onSuccess: () => void;
  }

  let { usersList, qualificationsList, creatorUid, onCancel, onSuccess } = $props();

  let newEmail = $state('');
  let nome = $state('');
  let cognome = $state('');
  let selectedRoles = $state<string[]>([]);
  let qualification = $state('');

  let creatingUser = $state(false);

  async function handleCreateUser(e: Event) {
    e.preventDefault();
    if (!newEmail || !nome || !cognome) return;

    creatingUser = true;

    try {
      await UsersService.createUser(
        nome,
        cognome,
        newEmail,
        selectedRoles,
        qualification,
        creatorUid,
        usersList
      );

      toast.success(`Utente ${nome.trim()} ${cognome.trim()} creato con successo!`);
      
      newEmail = '';
      nome = '';
      cognome = '';
      selectedRoles = [];
      qualification = '';
      
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || "Errore durante la creazione dell'utente.");
    } finally {
      creatingUser = false;
    }
  }
</script>

<Card
  title="Aggiungi Nuovo Utente"
  description="Configura i ruoli nel database locale per abilitare gli accessi."
  class="form-card"
>
  {#snippet icon()}
    <UserPlus size={20} class="icon-accent" />
  {/snippet}

  {#snippet headerSnippet()}
    <button onclick={onCancel} class="back-link">
      <ArrowLeft size={14} /> Annulla e Torna all'elenco
    </button>
  {/snippet}

  <form onsubmit={handleCreateUser} class="form-grid">
    <div class="form-group-row">
      <FormField id="new-nome" label="Nome">
        <input
          type="text"
          id="new-nome"
          bind:value={nome}
          placeholder="Nome"
          required
          disabled={creatingUser}
        />
      </FormField>
      <FormField id="new-cognome" label="Cognome">
        <input
          type="text"
          id="new-cognome"
          bind:value={cognome}
          placeholder="Cognome"
          required
          disabled={creatingUser}
        />
      </FormField>
    </div>

    <FormField id="new-email" label="Email">
      <input
        type="email"
        id="new-email"
        bind:value={newEmail}
        placeholder="nome@azienda.com"
        required
        disabled={creatingUser}
      />
    </FormField>

    <FormField id="new-qualification" label="Qualifica Consulente">
      <select id="new-qualification" bind:value={qualification} disabled={creatingUser}>
        <option value="">Nessuna qualifica</option>
        {#each qualificationsList as q}
          <option value={q.id}>{q.name} ({q.percentage}% / {q.supervisorPercentage}%)</option>
        {/each}
      </select>
    </FormField>

    <RoleSelector bind:selectedRoles={selectedRoles} showDescriptions={false} disabled={creatingUser} />

    <button type="submit" class="save-btn" disabled={creatingUser}>
      {#if creatingUser}
        Salvataggio...
      {:else}
        Crea Nuovo Account
      {/if}
    </button>
  </form>
</Card>

<style>
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

  .form-grid {
    display: flex;
    flex-direction: column;
    gap: 20px;
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
