<script lang="ts">
  import { Card, Table, Pagination } from '$lib';
  import { Database, UserPlus } from '@lucide/svelte';
  import { goto } from '$app/navigation';
  import type { UserData } from '../users.service';

  interface Props {
    users: UserData[];
    activeRole: string;
    onAddClick: () => void;
  }

  let { users, activeRole, onAddClick } = $props();

  let currentPage = $state(1);
  const itemsPerPage = 5;

  let paginatedUsers = $derived(
    users.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
  );

  const columns = [
    { key: 'nome', header: 'Nome' },
    { key: 'cognome', header: 'Cognome' },
    { key: 'email', header: 'Indirizzo Email' },
    { key: 'roles', header: 'Ruoli Assegnati' }
  ];

  function handleSelectUser(item: any) {
    goto(`/dashboard/users/${item.uid}`);
  }
</script>

<Card
  title="Database Utenti Registrati"
  description="Clicca su un utente per visualizzarne i dettagli o ruoli in una pagina dedicata."
  class="list-card"
>
  {#snippet icon()}
    <Database size={20} class="icon-accent" />
  {/snippet}

  {#snippet headerSnippet()}
    {#if activeRole === 'superadmin'}
      <button onclick={onAddClick} class="add-user-btn">
        <UserPlus size={16} /> Aggiungi Nuovo Utente
      </button>
    {/if}
  {/snippet}

  <div class="users-table-view">
    {#snippet cell(col: any, row: any)}
      {#if col.key === 'roles'}
        {#each row.roles as r}
          <span class="role-tag {r}">{r}</span>
        {/each}
      {:else if col.key === 'email'}
        <span class="email-cell">{row.email}</span>
      {:else}
        <span class="name-cell">{row[col.key] || 'N/D'}</span>
      {/if}
    {/snippet}

    <Table
      {columns}
      data={paginatedUsers}
      cellSnippet={cell}
      onRowClick={handleSelectUser}
      emptyText="Nessun utente presente. Visita /init per configurare il superadmin."
    />

    <Pagination
      totalItems={users.length}
      {itemsPerPage}
      currentPage={currentPage}
      onPageChange={(page) => currentPage = page}
    />
  </div>
</Card>

<style>
  :global(.icon-accent) {
    color: var(--color-primary-500);
  }

  .add-user-btn {
    background: linear-gradient(135deg, var(--color-primary-500), var(--color-primary-600));
    color: var(--color-white);
    border: none;
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
    box-shadow: 0 4px 10px hsla(var(--brand-h), var(--brand-s), var(--brand-l), 0.15);
  }

  .add-user-btn:hover {
    opacity: 0.9;
  }

  .name-cell {
    font-weight: 500;
  }

  .email-cell {
    color: var(--color-neutral-500);
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
</style>
