<script lang="ts">
  import { hasAccess } from '$lib/utils/authCheck';
  import { auth, activeRole } from '$lib/auth';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  
  import { UsersService, type UserData } from './users.service';
  import UsersTable from './components/UsersTable.svelte';
  import UserAddForm from './components/UserAddForm.svelte';

  let showAddForm = $state(false);
  let registeredUsers = $state<UserData[]>([]);

  async function fetchUsers() {
    try {
      registeredUsers = await UsersService.getUsers();
    } catch (e) {
      console.error('Error fetching users:', e);
    }
  }

  onMount(() => {
    const unsubscribe = activeRole.subscribe(($activeRole) => {
      if ($activeRole && !hasAccess($activeRole, ['superadmin'])) {
        goto('/dashboard');
      }
    });

    fetchUsers();

    return () => unsubscribe();
  });

  async function handleAddSuccess() {
    showAddForm = false;
    await fetchUsers();
  }
</script>

<svelte:head>
  <title>Gestione Utenti | Gestoray</title>
</svelte:head>

<div class="users-container animate-fade-in">
  {#if !showAddForm}
    <UsersTable 
      users={registeredUsers} 
      activeRole={$activeRole} 
      onAddClick={() => showAddForm = true} 
    />
  {:else}
    <UserAddForm 
      usersList={registeredUsers} 
      creatorUid={$auth?.uid || 'system'} 
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
