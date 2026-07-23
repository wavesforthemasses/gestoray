<script lang="ts">
  import { hasAccess } from '$lib/utils/authCheck';
  import { toast } from '$lib/stores/toast.svelte';
  import { activeRoleState } from '$lib/auth.svelte';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { Card } from '$lib';
  import { FileText, ArrowLeft } from '@lucide/svelte';
  import { __Name__Service } from '../__name__.service';
  import { confirmStore } from '$lib/stores/confirm.svelte';
  import __Name__Form from '../components/__Name__Form.svelte';
  import { pageTitle } from '$lib/stores/page';
  pageTitle.set('Dettaglio __Name__');

  let uid = $page.params.id as string;

  let name = $state('');
  let loading = $state(true);
  let submitting = $state(false);

  $effect(() => {
    const currentRole = activeRoleState.role;
    if (currentRole && !hasAccess(currentRole, ['superadmin', 'amministrazione'])) {
      goto('/dashboard');
    }
  });

  onMount(() => {
    fetchItem();
  });

  async function fetchItem() {
    loading = true;
    try {
      const item = await __Name__Service.getOne(uid);
      if (item) {
        name = item.name;
      } else {
        toast.error("Elemento non trovato.");
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
      toast.error("Il nome è obbligatorio.");
      return;
    }

    submitting = true;

    try {
      await __Name__Service.update(uid, {
        name: name.trim()
      });
      toast.success("Elemento aggiornato con successo!");
    } catch (err: any) {
      toast.error(err.message || 'Errore durante il salvataggio.');
    } finally {
      submitting = false;
    }
  }

  async function handleDelete() {
    const ok = await confirmStore.prompt("Sei sicuro di voler eliminare questo elemento? Questa azione non può essere annullata.");
    if (!ok) return;
    submitting = true;
    try {
      await __Name__Service.remove(uid);
      goto('/dashboard/__name__');
    } catch (e: any) {
      toast.error(e.message || "Errore durante l'eliminazione.");
    } finally {
      submitting = false;
    }
  }
</script>



<div class="edit-page animate-fade-in">
  <Card
    title="Dettaglio __Name__"
    description="Modifica o elimina questo elemento."
    class="form-card"
  >
    {#snippet icon()}
      <FileText size={20} class="icon-accent" />
    {/snippet}

    {#snippet headerSnippet()}
      <a href="/dashboard/__name__" class="back-link">
        <ArrowLeft size={14} /> Torna all'elenco
      </a>
    {/snippet}

    {#if loading}
      <div class="loader-box">
        <span class="spinner"></span>
        Caricamento dati...
      </div>
    {:else}
      <__Name__Form 
        isEditMode={true}
        bind:name
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
