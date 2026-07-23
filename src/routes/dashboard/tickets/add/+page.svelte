<script lang="ts">
  import { hasAccess } from '$lib/utils/authCheck';
  import { toast } from '$lib/stores/toast.svelte';
  import { activeRoleState } from '$lib/auth.svelte';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { Card } from '$lib';
  import { FileText, ArrowLeft } from '@lucide/svelte';
  import { TicketsService } from '../tickets.service';
  import TicketsForm from '../components/TicketsForm.svelte';
  import { pageTitle } from '$lib/stores/page';
  pageTitle.set('Aggiungi Tickets');

  let name = $state('');
  let submitting = $state(false);

  $effect(() => {
    const currentRole = activeRoleState.role;
    if (currentRole && !hasAccess(currentRole, ['superadmin', 'amministrazione'])) {
      goto('/dashboard');
    }
  });

  async function handleCreate(e: Event) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Il nome è obbligatorio.");
      return;
    }

    submitting = true;

    try {
      await TicketsService.create({
        name: name.trim()
      });
      goto('/dashboard/tickets');
    } catch (err: any) {
      toast.error(err.message || 'Errore durante la creazione.');
      submitting = false;
    }
  }
</script>

<div class="add-page animate-fade-in">
  <Card
    title="Nuovo Tickets"
    description="Compila i campi per creare un nuovo elemento."
    class="form-card"
  >
    {#snippet icon()}
      <FileText size={20} class="icon-accent" />
    {/snippet}

    {#snippet headerSnippet()}
      <a href="/dashboard/tickets" class="back-link">
        <ArrowLeft size={14} /> Torna all'elenco
      </a>
    {/snippet}

    <TicketsForm 
      isEditMode={false}
      bind:name
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
