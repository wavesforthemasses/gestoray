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
  
  import AnonymizeModal from '$lib/components/AnonymizeModal.svelte';
  import { AnonymizationService, USERS_ANONYMIZATION_SPEC } from '$lib/services/anonymizationService';
  import { db, doc, getDoc } from '$lib/firebase';

  pageTitle.set('Gestione Utenti');

  let showAddForm = $state(false);
  let registeredUsers = $state<UserData[]>([]);
  let qualificationsList = $state<Qualification[]>([]);

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
      onAnonymizeClick={handleAnonymizeClick}
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
  }

  .animate-fade-in {
    animation: fadeIn 0.3s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  }
</style>
