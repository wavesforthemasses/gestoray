<script lang="ts">
  import { hasAccess } from '$lib/utils/authCheck';
  import { activeRoleState } from '$lib/auth.svelte';
  import { pageTitle } from '$lib/stores/page';
  pageTitle.set('Gestione Qualifiche');
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { QualificationsService, type Qualification } from '$lib/services/qualifications';
  
  import QualificationsTable from './components/QualificationsTable.svelte';

  let qualificationsList = $state<Qualification[]>([]);
  let loading = $state(true);

  $effect(() => {
    const currentRole = activeRoleState.role;
    if (currentRole && !hasAccess(currentRole, ['superadmin'])) {
      goto('/dashboard');
    }
  });

  onMount(() => {

    fetchQualifications();
  });

  async function fetchQualifications() {
    loading = true;
    try {
      qualificationsList = await QualificationsService.getAll();
    } catch (e) {
      console.error('Error fetching qualifications:', e);
    } finally {
      loading = false;
    }
  }

  function handleAddNew() {
    goto('/dashboard/qualifications/add');
  }

  function handleSelectRow(item: Qualification) {
    goto(`/dashboard/qualifications/${item.id}`);
  }
</script>



<div class="qualifications-page animate-fade-in">
  {#if loading}
    <div class="loader-box">
      <span class="spinner"></span>
      Caricamento qualifiche...
    </div>
  {:else}
    <QualificationsTable 
      {qualificationsList} 
      onAddNew={handleAddNew} 
      onSelectRow={handleSelectRow} 
    />
  {/if}
</div>

<style>
  .qualifications-page {
    width: 100%;
  }

  .loader-box {
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
