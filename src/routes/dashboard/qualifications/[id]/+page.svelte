<script lang="ts">
  import { hasAccess } from '$lib/utils/authCheck';
  import { toast } from '$lib/stores/toast.svelte';
  import { activeRoleState } from '$lib/auth.svelte';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { Card } from '$lib';
  import { Award, List } from '@lucide/svelte';
  import { QualificationsService } from '$lib/services/qualifications';
  import { confirmStore } from '$lib/stores/confirm.svelte';
  import QualificationForm from '../components/QualificationForm.svelte';
  import { pageTitle } from '$lib/stores/page';
  pageTitle.set('Modifica Qualifica');

  let uid = $page.params.id as string;

  let name = $state('');
  let percentage = $state(0);
  let supervisorPercentage = $state(0);

  let loading = $state(true);
  let submitting = $state(false);

  $effect(() => {
    const currentRole = activeRoleState.role;
    if (currentRole && !hasAccess(currentRole, ['superadmin'])) {
      goto('/dashboard');
    }
  });

  onMount(() => {

    fetchQualification();
  });

  async function fetchQualification() {
    loading = true;
    try {
      const q = await QualificationsService.getOne(uid);
      if (q) {
        name = q.name;
        percentage = q.percentage;
        supervisorPercentage = q.supervisorPercentage;
      } else {
        toast.error("Qualifica non trovata.");
      }
    } catch (e: any) {
      toast.error("Errore durante il caricamento: " + e.message);
    } finally {
      loading = false;
    }
  }

  async function handleUpdate(e: Event) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Il nome della qualifica è obbligatorio.");
      return;
    }

    submitting = true;

    try {
      await QualificationsService.update(uid, {
        name: name.trim(),
        percentage: Number(percentage),
        supervisorPercentage: Number(supervisorPercentage)
      });
      toast.success("Qualifica aggiornata con successo!");
    } catch (err: any) {
      toast.error(err.message || 'Errore durante il salvataggio.');
    } finally {
      submitting = false;
    }
  }

  async function handleDelete() {
    const ok = await confirmStore.prompt("Sei sicuro di voler eliminare questa qualifica? Questa azione non può essere annullata.");
    if (!ok) return;
    submitting = true;
    try {
      await QualificationsService.remove(uid);
      goto('/dashboard/qualifications');
    } catch (e: any) {
      toast.error(e.message || "Errore durante l'eliminazione.");
    } finally {
      submitting = false;
    }
  }
</script>



<div class="edit-page animate-fade-in">
  <Card
    title="Dettagli Qualifica"
    description="Modifica i parametri o elimina questa qualifica."
    class="form-card"
  >
    {#snippet icon()}
      <Award size={20} class="icon-accent" />
    {/snippet}

    {#snippet headerSnippet()}
      <a href="/dashboard/qualifications" class="btn-module-list" title="Vai all'elenco qualifiche" aria-label="Vai all'elenco qualifiche">
        <List size={20} />
      </a>
    {/snippet}

    {#if loading}
      <div class="loader-box">
        <span class="spinner"></span>
        Caricamento dati...
      </div>
    {:else}
      <QualificationForm 
        isEditMode={true}
        bind:name
        bind:percentage
        bind:supervisorPercentage
        {submitting}
        onSubmit={handleUpdate}
        onDelete={handleDelete}
      />
    {/if}
  </Card>
</div>

<style>
  .edit-page {
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

  .loader-box {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 40px;
    color: var(--color-neutral-500);
  }

  .spinner {
    width: 20px;
    height: 20px;
    border: 2px solid hsla(var(--brand-h), var(--brand-s), var(--brand-l), 0.15);
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
