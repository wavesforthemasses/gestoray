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
  pageTitle.set('Gestione Utenti');

  let showAddForm = $state(false);
  let registeredUsers = $state<UserData[]>([]);
  let qualificationsList = $state<Qualification[]>([]);

  async function fetchUsers() {
    try {
      const [users, quals] = await Promise.all([
        UsersService.getUsers(),
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
    <UsersTable 
      users={registeredUsers} 
      activeRole={activeRoleState.role} 
      onAddClick={() => showAddForm = true} 
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

<style>
  .users-container {
    width: 100%;
  }

  .animate-fade-in {
    animation: fadeIn 0.3s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  }
</style>
