<script lang="ts">
  import { hasAccess } from '$lib/utils/authCheck';
  import { toast } from '$lib/stores/toast.svelte';
  import { page } from '$app/stores';
  import { activeRole } from '$lib/auth';
  import { pageTitle } from '$lib/stores/page';
  pageTitle.set('Dettagli Utente');
  import { UserDetailService } from './user-detail.service';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { Card } from '$lib';
  import { User, ArrowLeft } from '@lucide/svelte';
  import UserDetailForm from './components/UserDetailForm.svelte';

  let uid = $page.params.id as string;

  let userEmail = $state('');
  let userNome = $state('');
  let userCognome = $state('');
  let createdAt = $state('');
  let selectedRoles = $state<string[]>([]);
  let qualification = $state('');
  let supervisorUid = $state('');

  let qualificationsList = $state<any[]>([]);
  let supervisorsList = $state<any[]>([]);

  let loadingDetails = $state(true);
  let saving = $state(false);

  async function fetchUserDetails() {
    try {
      const data = await UserDetailService.fetchUserDetails(uid);
      userEmail = data.email;
      userNome = data.nome;
      userCognome = data.cognome;
      createdAt = data.createdAt;
      selectedRoles = data.roles;
      qualification = data.qualification;
      supervisorUid = data.supervisorUid;
    } catch (e: any) {
      console.error('Error fetching user details:', e);
      toast.error('Errore nel recupero dei dettagli: ' + e.message);
    } finally {
      loadingDetails = false;
    }
  }

  async function fetchQualificationsAndSupervisors() {
    try {
      const refs = await UserDetailService.fetchQualificationsAndSupervisors();
      qualificationsList = refs.qualificationsList;
      supervisorsList = refs.supervisorsList;
    } catch (e) {
      console.error('Error fetching refs:', e);
    }
  }

  onMount(() => {
    const unsubscribe = activeRole.subscribe(($activeRole) => {
      if ($activeRole && !hasAccess($activeRole, ['superadmin'])) {
        goto('/dashboard');
      }
    });

    fetchUserDetails();
    fetchQualificationsAndSupervisors();

    return () => unsubscribe();
  });

  async function handleUpdateUser(e: Event) {
    e.preventDefault();
    if (!userEmail || !userNome || !userCognome) return;

    saving = true;

    try {
      await UserDetailService.updateUser({
        uid,
        email: userEmail,
        nome: userNome,
        cognome: userCognome,
        roles: selectedRoles,
        qualification,
        supervisorUid
      });

      toast.success('Dati utente aggiornati con successo!');
    } catch (err: any) {
      console.error('Error saving user data:', err);
      toast.error(err.message || 'Errore durante il salvataggio.');
    } finally {
      saving = false;
    }
  }
</script>



<div class="details-page-container animate-fade-in">
  <Card
    title="Dettagli Utente e Configurazione Ruoli"
    description="UID Utente: {uid}"
    class="details-card"
  >
    {#snippet icon()}
      <User size={20} class="icon-accent" />
    {/snippet}

    {#snippet headerSnippet()}
      <button onclick={() => goto('/dashboard/users')} class="back-link">
        <ArrowLeft size={14} /> Torna all'elenco
      </button>
    {/snippet}

    {#if loadingDetails}
      <div class="loading-spinner-box">
        <div class="spinner"></div>
        <p>Caricamento dettagli utente...</p>
      </div>
    {:else}
      <UserDetailForm
        {uid}
        bind:userNome
        bind:userCognome
        bind:userEmail
        {createdAt}
        bind:qualification
        bind:supervisorUid
        bind:selectedRoles
        {qualificationsList}
        {supervisorsList}
        {saving}
        onUpdate={handleUpdateUser}
      />
    {/if}
  </Card>
</div>

<style>
  .details-page-container {
    width: 100%;
  }

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

  .loading-spinner-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 14px;
    padding: 40px;
  }

  .spinner {
    width: 24px;
    height: 24px;
    border: 3px solid hsla(var(--brand-h), var(--brand-s), var(--brand-l), 0.15);
    border-radius: 50%;
    border-top-color: var(--color-primary-500);
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .animate-fade-in {
    animation: fadeIn 0.3s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  }
</style>
