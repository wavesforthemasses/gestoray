<script lang="ts">
  import { hasAccess } from '$lib/utils/authCheck';
  import { authState, activeRoleState } from '$lib/auth.svelte';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  
  import { UsersService, type UserData } from './users.service';
  import { QualificationsService, type Qualification } from '$lib/services/qualifications';
  import UsersTable from './components/UsersTable.svelte';
  import UserAddForm from './components/UserAddForm.svelte';
  import { pageTitle } from '$lib/stores/page';
  import { toast } from '$lib/stores/toast.svelte';
  
  import SearchToolbar from '$lib/components/SearchToolbar.svelte';
  import FilterSelect from '$lib/components/FilterSelect.svelte';
  import AnonymizeModal from '$lib/components/AnonymizeModal.svelte';

  import { AnonymizationService, USERS_ANONYMIZATION_SPEC } from '$lib/services/anonymizationService';
  import { db, doc, getDoc } from '$lib/firebase';
  import { Search, Filter, Shield, Users, UserPlus } from '@lucide/svelte';




  pageTitle.set('Gestione Utenti');

  let showAddForm = $state(false);
  let registeredUsers = $state<UserData[]>([]);
  let qualificationsList = $state<Qualification[]>([]);

  // Search & Filter state
  let searchVal = $state('');
  let filterStatus = $state<'all' | 'active' | 'inactive'>('all');
  let filterRole = $state('');

  let anonymizeModalOpen = $state(false);
  let selectedUserForAnonymization = $state<Record<string, any> | null>(null);

  async function handleAnonymizeClick(uid: string) {
    try {
      const docSnap = await getDoc(doc(db, 'users', uid));
      if (!docSnap.exists()) {
        toast.error('Utente non trovato nel database.');
        return;
      }
      const data = docSnap.data();
      data.uid = uid; // Ensure ID is present for modal
      selectedUserForAnonymization = data;
      anonymizeModalOpen = true;
    } catch (e: any) {
      toast.error('Errore durante il caricamento utente: ' + e.message);
    }
  }

  async function handleToggleStatusClick(uid: string, currentIsActive: boolean) {
    const newStatus = !currentIsActive;
    const actionLabel = newStatus ? 'riattivare' : 'disattivare';
    if (!confirm(`Sei sicuro di voler ${actionLabel} questo utente?`)) return;

    try {
      await UsersService.toggleUserActiveStatus(uid, newStatus, authState.user?.uid || 'system');
      toast.success(newStatus ? 'Utente riattivato.' : 'Utente disattivato.');
      await fetchUsers();
    } catch (e: any) {
      toast.error('Errore durante il cambio di stato: ' + (e?.message || e));
    }
  }

  async function confirmAnonymize() {
    if (!selectedUserForAnonymization || !selectedUserForAnonymization.uid) return;
    try {
      await AnonymizationService.anonymizeEntity('users', selectedUserForAnonymization.uid, USERS_ANONYMIZATION_SPEC, authState.user?.uid || 'system');
      toast.success('Utente anonimizzato con successo.');
      await fetchUsers();
    } catch (e: any) {
      toast.error('Errore durante l\'anonimizzazione: ' + e.message);
    }
  }

  async function fetchUsers() {
    try {
      const [users, quals] = await Promise.all([
        UsersService.getUsers(searchVal, filterStatus, filterRole),
        QualificationsService.getAll()
      ]);
      registeredUsers = users;
      qualificationsList = quals;
    } catch (e) {
      console.error('Error fetching users/qualifications:', e);
    }
  }

  $effect(() => {
    const currentRole = activeRoleState.role;
    if (currentRole && !hasAccess(currentRole, ['superadmin'])) {
      goto('/dashboard');
    }
  });

  onMount(() => {

    fetchUsers();
  });

  async function handleAddSuccess() {
    showAddForm = false;
    await fetchUsers();
  }
</script>

<div class="users-container animate-fade-in">
  {#if !showAddForm}
    <div class="page-top-actions">
      <div>
        <h2 class="title-header">
          <Users size={28} color="var(--color-primary-600)" />
          Gestione Utenti
        </h2>
        <p class="subtitle">Database degli utenti registrati e configurazione dei ruoli abilitati.</p>
      </div>

      {#if activeRoleState.role === 'superadmin'}
        <button class="btn-primary" onclick={() => showAddForm = true}>
          <UserPlus size={18} /> Nuovo Utente
        </button>
      {/if}
    </div>

    <SearchToolbar
      bind:searchQuery={searchVal}
      placeholder="Cerca per nome, cognome, email..."
      onSearch={() => fetchUsers()}
    >
      {#snippet filtersSnippet()}
        <FilterSelect
          bind:value={filterStatus}
          icon={Filter}
          options={[
            { value: 'all', label: 'Tutti gli stati' },
            { value: 'active', label: 'Solo Attivi' },
            { value: 'inactive', label: 'Disattivati / Bloccati' }
          ]}
          onChange={() => fetchUsers()}
        />

        <FilterSelect
          bind:value={filterRole}
          icon={Shield}
          options={[
            { value: '', label: 'Tutti i Ruoli' },
            { value: 'superadmin', label: 'Superadmin' },
            { value: 'amministrazione', label: 'Amministrazione' },
            { value: 'commerciale', label: 'Commerciale' },
            { value: 'direzione', label: 'Direzione' },
            { value: 'tecnico', label: 'Tecnico / Operaio Campo' }
          ]}
          onChange={() => fetchUsers()}
        />
      {/snippet}
    </SearchToolbar>


    <UsersTable 
      users={registeredUsers} 
      activeRole={activeRoleState.role} 
      onAddClick={() => showAddForm = true} 
      onAnonymizeClick={handleAnonymizeClick}
      onToggleStatusClick={handleToggleStatusClick}
    />

  {:else}
    <UserAddForm 
      usersList={registeredUsers}
      {qualificationsList}
      creatorUid={authState.user?.uid || 'system'} 
      onCancel={() => showAddForm = false} 
      onSuccess={handleAddSuccess} 
    />
  {/if}
</div>

<AnonymizeModal
  isOpen={anonymizeModalOpen}
  entityName="Utente"
  originalDoc={selectedUserForAnonymization}
  specs={USERS_ANONYMIZATION_SPEC}
  onClose={() => { anonymizeModalOpen = false; selectedUserForAnonymization = null; }}
  onConfirm={confirmAnonymize}
/>

<style>
  .users-container {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .page-top-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }

  .title-header {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 24px;
    font-weight: 700;
    color: var(--color-neutral-900, #111827);
    margin: 0 0 4px 0;
  }

  .subtitle {
    font-size: 14px;
    color: var(--color-neutral-500, #6b7280);
    margin: 0;
  }

  .btn-primary {
    display: flex;
    align-items: center;
    gap: 8px;
    background: var(--color-primary-600, #2563eb);
    color: white;
    padding: 10px 18px;
    border: none;
    border-radius: var(--radius-md, 8px);
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
  }

  .btn-primary:hover {
    background: var(--color-primary-700, #1d4ed8);
  }


  .toolbar-card {
    background: var(--color-surface, #ffffff);
    border: 1px solid var(--color-neutral-200, #e5e7eb);
    border-radius: var(--radius-lg, 12px);
    padding: 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    box-shadow: var(--shadow-sm, 0 1px 2px rgba(0,0,0,0.05));
  }

  .search-box {
    position: relative;
    flex: 1;
    max-width: 420px;
    display: flex;
    align-items: center;
  }

  :global(.search-icon) {
    position: absolute;
    left: 12px;
    color: var(--color-neutral-400, #9ca3af);
  }

  .search-box input {
    width: 100%;
    padding: 8px 12px 8px 38px;
    border: 1px solid var(--color-neutral-300, #d1d5db);
    border-radius: var(--radius-md, 8px);
    font-size: 14px;
    outline: none;
    transition: border-color 0.2s;
  }

  .search-box input:focus {
    border-color: var(--color-primary-500, #3b82f6);
  }

  .filters-row {
    display: flex;
    gap: 12px;
  }

  .filter-item {
    position: relative;
    display: flex;
    align-items: center;
  }

  :global(.filter-icon) {
    position: absolute;
    left: 10px;
    color: var(--color-neutral-400, #9ca3af);
    pointer-events: none;
  }

  .filter-item select {
    padding: 8px 12px 8px 32px;
    border: 1px solid var(--color-neutral-300, #d1d5db);
    border-radius: var(--radius-md, 8px);
    font-size: 13px;
    background: var(--color-surface, #ffffff);
    color: var(--color-neutral-700, #374151);
    outline: none;
    cursor: pointer;
  }

  .animate-fade-in {
    animation: fadeIn 0.3s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  }
</style>
