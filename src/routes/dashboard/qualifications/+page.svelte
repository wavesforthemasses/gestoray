<script lang="ts">
  import { activeRole, auth } from '$lib/auth';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { Card, Table } from '$lib';
  import { Award, Plus, ArrowLeft } from '@lucide/svelte';
  import { QualificationsService, type Qualification } from '$lib/services/qualifications';

  let qualificationsList = $state<Qualification[]>([]);
  let loading = $state(true);

  onMount(() => {
    const unsubscribe = activeRole.subscribe(($activeRole) => {
      if ($activeRole && $activeRole !== 'superadmin') {
        goto('/dashboard');
      }
    });

    fetchQualifications();
    return () => unsubscribe();
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

  const columns = [
    { key: 'name', header: 'Nome Qualifica' },
    { key: 'percentage', header: 'Provvigione Commerciale (%)' },
    { key: 'supervisorPercentage', header: 'Provvigione Supervisore (%)' }
  ];

  function handleSelectRow(item: Qualification) {
    goto(`/dashboard/qualifications/${item.id}`);
  }
</script>

<svelte:head>
  <title>Gestione Qualifiche | Gestoray</title>
</svelte:head>

<div class="qualifications-page animate-fade-in">
  <Card
    title="Gestione Qualifiche"
    description="Configura le qualifiche dei consulenti e le relative percentuali provvigionali."
    class="list-card"
  >
    {#snippet icon()}
      <Award size={20} class="icon-accent" />
    {/snippet}

    {#snippet headerSnippet()}
      <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
        <button onclick={() => goto('/dashboard/qualifications/add')} class="add-btn">
          <Plus size={16} /> Nuova Qualifica
        </button>
      </div>
    {/snippet}

    {#if loading}
      <div class="loader-box">
        <span class="spinner"></span>
        Caricamento qualifiche...
      </div>
    {:else}
      {#snippet cell(col: any, row: any)}
        {#if col.key === 'name'}
          <span style="font-weight: 600; color: var(--color-neutral-800);">{row.name}</span>
        {:else if col.key === 'percentage'}
          <span>{row.percentage}%</span>
        {:else if col.key === 'supervisorPercentage'}
          <span>{row.supervisorPercentage}%</span>
        {/if}
      {/snippet}

      <div class="table-wrapper">
        <Table
          {columns}
          data={qualificationsList}
          cellSnippet={cell}
          onRowClick={handleSelectRow}
          emptyText="Nessuna qualifica registrata. Creane una nuova."
        />
      </div>
    {/if}
  </Card>
</div>

<style>
  .qualifications-page {
    width: 100%;
  }

  :global(.icon-accent) {
    color: var(--color-primary-500);
  }

  .add-btn {
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

  .add-btn:hover {
    opacity: 0.9;
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
