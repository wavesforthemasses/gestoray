<script lang="ts">
  import { hasAccess } from '$lib/utils/authCheck';
  import { activeRoleState } from '$lib/auth.svelte';
  import { pageTitle } from '$lib/stores/page';
  pageTitle.set('Gestione Qualifiche');
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { QualificationsService, type Qualification } from '$lib/services/qualifications';
  
  import QualificationsTable from './components/QualificationsTable.svelte';
  import { SearchToolbar } from '$lib';
  import { Award, Plus } from '@lucide/svelte';


  let qualificationsList = $state<Qualification[]>([]);
  let searchQuery = $state('');
  let loading = $state(true);

  let filteredQualifications = $derived(
    searchQuery.trim()
      ? qualificationsList.filter(q => q.name.toLowerCase().includes(searchQuery.trim().toLowerCase()))
      : qualificationsList
  );

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
  <div class="page-top-actions">
    <div>
      <h2 class="title-header">
        <Award size={28} color="var(--color-primary-600)" />
        Gestione Qualifiche
      </h2>
      <p class="subtitle">Configura le qualifiche dei consulenti e le percentuali provvigionali.</p>
    </div>

    <button class="btn-primary" onclick={handleAddNew}>
      <Plus size={18} /> Nuova Qualifica
    </button>
  </div>

  <SearchToolbar
    bind:searchQuery
    placeholder="Cerca qualifica..."
  />

  {#if loading}
    <div class="loader-box">
      <span class="spinner"></span>
      Caricamento qualifiche...
    </div>
  {:else}
    <QualificationsTable 
      qualificationsList={filteredQualifications} 
      onAddNew={handleAddNew} 
      onSelectRow={handleSelectRow} 
    />
  {/if}
</div>

<style>
  .qualifications-page {
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
