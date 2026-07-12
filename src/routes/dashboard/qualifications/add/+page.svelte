<script lang="ts">
  import { hasAccess } from '$lib/utils/authCheck';
  import { toast } from '$lib/stores/toast';
  import { activeRole } from '$lib/auth';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { Card } from '$lib';
  import { Award, ArrowLeft } from '@lucide/svelte';
  import { QualificationsService } from '$lib/services/qualifications';
  import QualificationForm from '../components/QualificationForm.svelte';

  let name = $state('');
  let percentage = $state(0);
  let supervisorPercentage = $state(0);

  let submitting = $state(false);

  onMount(() => {
    const unsubscribe = activeRole.subscribe(($activeRole) => {
      if ($activeRole && !hasAccess($activeRole, ['superadmin'])) {
        goto('/dashboard');
      }
    });
    return () => unsubscribe();
  });

  async function handleCreate(e: Event) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Il nome della qualifica è obbligatorio.");
      return;
    }

    submitting = true;

    try {
      await QualificationsService.create({
        name: name.trim(),
        percentage: Number(percentage),
        supervisorPercentage: Number(supervisorPercentage)
      });
      goto('/dashboard/qualifications');
    } catch (err: any) {
      toast.error(err.message || 'Errore durante la creazione.');
      submitting = false;
    }
  }
</script>

<svelte:head>
  <title>Aggiungi Qualifica | Gestoray</title>
</svelte:head>

<div class="add-page animate-fade-in">
  <Card
    title="Nuova Qualifica"
    description="Crea una nuova qualifica per i commerciali."
    class="form-card"
  >
    {#snippet icon()}
      <Award size={20} class="icon-accent" />
    {/snippet}

    {#snippet headerSnippet()}
      <button onclick={() => goto('/dashboard/qualifications')} class="back-link">
        <ArrowLeft size={14} /> Annulla
      </button>
    {/snippet}

    <QualificationForm 
      isEditMode={false}
      bind:name
      bind:percentage
      bind:supervisorPercentage
      {submitting}
      onSubmit={handleCreate}
    />
  </Card>
</div>

<style>
  .add-page {
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

  .animate-fade-in {
    animation: fadeIn 0.3s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  }
</style>
