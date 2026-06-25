<script lang="ts">
  import { auth, activeRole } from '$lib/auth';
  import { db, doc, setDoc, collection, getDocs } from '$lib/firebase';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { Card, Table, Pagination, FormField, RoleSelector } from '$lib';
  import { Database, UserPlus, ArrowLeft } from '@lucide/svelte';

  let showAddForm = $state(false);

  let newEmail = $state('');
  let nome = $state('');
  let cognome = $state('');
  let selectedRoles = $state<string[]>([]);

  let statusMessage = $state('');
  let isError = $state(false);
  let creatingUser = $state(false);
  
  let registeredUsers = $state<Array<{ uid: string, email: string, roles: string[], nome?: string, cognome?: string, createdAt?: string }>>([]);

  // Pagination state
  let currentPage = $state(1);
  const itemsPerPage = 5;

  let paginatedUsers = $derived(
    registeredUsers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
  );

  const columns = [
    { key: 'nome', header: 'Nome' },
    { key: 'cognome', header: 'Cognome' },
    { key: 'email', header: 'Indirizzo Email' },
    { key: 'roles', header: 'Ruoli Assegnati' }
  ];

  async function fetchUsers() {
    try {
      const querySnapshot = await getDocs(collection(db, 'users'));
      const list: Array<{ uid: string, email: string, roles: string[], nome?: string, cognome?: string, createdAt?: string }> = [];
      querySnapshot.forEach((doc: any) => {
        const data = doc.data();
        list.push({
          uid: doc.id,
          email: data.email,
          roles: data.roles || [],
          nome: data.nome,
          cognome: data.cognome,
          createdAt: data.createdAt
        });
      });
      registeredUsers = list;
    } catch (e) {
      console.error('Error fetching users:', e);
    }
  }

  onMount(() => {
    const unsubscribe = activeRole.subscribe(($activeRole) => {
      if ($activeRole && $activeRole !== 'superadmin') {
        goto('/dashboard');
      }
    });

    fetchUsers();

    return () => unsubscribe();
  });

  async function handleCreateUser(e: Event) {
    e.preventDefault();
    if (!newEmail || !nome || !cognome) return;

    creatingUser = true;
    statusMessage = '';
    isError = false;

    try {
      if (selectedRoles.length === 0) {
        throw new Error('Seleziona almeno un ruolo per il nuovo utente.');
      }

      const cleanEmail = newEmail.trim().toLowerCase();
      const cleanNome = nome.trim();
      const cleanCognome = cognome.trim();

      const emailExists = registeredUsers.some(u => u.email === cleanEmail);
      if (emailExists) {
        throw new Error('L\'indirizzo email inserito è già registrato.');
      }

      const uid = 'uid_' + Math.random().toString(36).substring(2, 11);

      await setDoc(doc(db, 'users', uid), {
        nome: cleanNome,
        cognome: cleanCognome,
        email: cleanEmail,
        roles: selectedRoles,
        createdAt: new Date().toISOString()
      });

      statusMessage = `Utente ${cleanNome} ${cleanCognome} creato con successo!`;
      newEmail = '';
      nome = '';
      cognome = '';
      selectedRoles = [];
      
      await fetchUsers();
      showAddForm = false; // Redirect back to list
      currentPage = 1; // Reset to page 1
    } catch (err: any) {
      isError = true;
      statusMessage = err.message || 'Errore durante la creazione dell\'utente.';
    } finally {
      creatingUser = false;
    }
  }

  function handleSelectUser(item: any) {
    goto(`/dashboard/users/${item.uid}`);
  }
</script>

<svelte:head>
  <title>Gestione Utenti | Gestoray</title>
</svelte:head>

<div class="users-container animate-fade-in">
  {#if !showAddForm}
    <Card
      title="Database Utenti Registrati"
      description="Clicca su un utente per visualizzarne i dettagli o ruoli in una pagina dedicata."
      class="list-card"
    >
      {#snippet icon()}
        <Database size={20} class="icon-accent" />
      {/snippet}

      {#snippet headerSnippet()}
        {#if $activeRole === 'superadmin'}
          <button onclick={() => { showAddForm = true; statusMessage = ''; isError = false; }} class="add-user-btn">
            <UserPlus size={16} /> Aggiungi Nuovo Utente
          </button>
        {/if}
      {/snippet}

      {#if statusMessage}
        <div class="status-alert animate-fade-in" class:error={isError}>
          {statusMessage}
        </div>
      {/if}

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
          totalItems={registeredUsers.length}
          {itemsPerPage}
          currentPage={currentPage}
          onPageChange={(page) => currentPage = page}
        />
      </div>
    </Card>
  {:else}
    <Card
      title="Aggiungi Nuovo Utente"
      description="Configura i ruoli nel database locale per abilitare gli accessi."
      class="form-card"
    >
      {#snippet icon()}
        <UserPlus size={20} class="icon-accent" />
      {/snippet}

      {#snippet headerSnippet()}
        <button onclick={() => { showAddForm = false; statusMessage = ''; isError = false; }} class="back-link">
          <ArrowLeft size={14} /> Annulla e Torna all'elenco
        </button>
      {/snippet}

      {#if statusMessage}
        <div class="status-alert animate-fade-in" class:error={isError}>
          {statusMessage}
        </div>
      {/if}

      <form onsubmit={handleCreateUser} class="create-user-form">
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
  {/if}
</div>

<style>
  .users-container {
    width: 100%;
  }

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
    box-shadow: 0 4px 10px hsla(var(--brand-h), var(--brand-s), 50%, 0.15);
  }

  .add-user-btn:hover {
    opacity: 0.9;
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

  .create-user-form {
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
    padding: 12px 14px;
    border-radius: var(--radius-md);
    font-size: 14px;
    margin-bottom: 20px;
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
