<script lang="ts">
  import { FormField, RoleSelector } from '$lib';
  import { formatDateTime } from '$lib/utils/formatters';

  interface Props {
    uid: string;
    userNome: string;
    userCognome: string;
    userEmail: string;
    createdAt: string;
    qualification: string;
    supervisorUid: string;
    selectedRoles: string[];
    qualificationsList: any[];
    supervisorsList: any[];
    saving: boolean;
    onUpdate: (e: Event) => void;
  }

  let {
    uid,
    userNome = $bindable(),
    userCognome = $bindable(),
    userEmail = $bindable(),
    createdAt,
    qualification = $bindable(),
    supervisorUid = $bindable(),
    selectedRoles = $bindable(),
    qualificationsList,
    supervisorsList,
    saving,
    onUpdate
  }: Props = $props();

</script>

<form onsubmit={onUpdate} class="details-form">
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
      value={createdAt ? formatDateTime(createdAt) : 'N/D'}
      disabled
      class="disabled-input"
    />
  </FormField>

  <FormField id="user-qualification" label="Qualifica Consulente">
    <select id="user-qualification" bind:value={qualification} disabled={saving}>
      <option value="">Nessuna qualifica</option>
      {#each qualificationsList as q}
        <option value={q.id}>{q.name} ({q.percentage}% / {q.supervisorPercentage}%)</option>
      {/each}
    </select>
  </FormField>

  <FormField id="user-supervisor" label="Supervisore">
    <select id="user-supervisor" bind:value={supervisorUid} disabled={saving}>
      <option value="">Nessun supervisore</option>
      {#each supervisorsList as s}
        {#if s.uid !== uid}
          <option value={s.uid}>{s.name}</option>
        {/if}
      {/each}
    </select>
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
    <a href="/dashboard/users" class="cancel-btn {saving ? 'disabled' : ''}" onclick={(e) => { if (saving) e.preventDefault(); }} style="text-decoration: none; display: inline-flex; align-items: center; justify-content: center;">
      Annulla
    </a>
  </div>
</form>

<style>
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

  .cancel-btn.disabled {
    opacity: 0.5;
    cursor: not-allowed;
    pointer-events: none;
  }
</style>
