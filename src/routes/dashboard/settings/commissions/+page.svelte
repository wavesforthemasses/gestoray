<script lang="ts">
  import { hasAccess } from '$lib/utils/authCheck';
  import { toast } from '$lib/stores/toast';
  import { auth, activeRole } from '$lib/auth';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  
  import { CommissionsSettingsService, type CommissionsSettingsPayload } from './commissions-settings.service';
  import CommissionsRulesForm from './components/CommissionsRulesForm.svelte';

  let loading = $state(true);
  let submitting = $state(false);

  let settings = $state<CommissionsSettingsPayload>({
    qualificationMode: 'historical',
    discountPenalty: 'linear'
  });

  onMount(() => {
    const unsubscribe = activeRole.subscribe(($activeRole) => {
      if ($activeRole && !hasAccess($activeRole, ['superadmin', 'direzione'])) {
        goto('/dashboard');
      }
    });

    async function load() {
      try {
        settings = await CommissionsSettingsService.loadSettings();
      } catch (e) {
        console.error(e);
        toast.error('Errore nel caricamento impostazioni.');
      } finally {
        loading = false;
      }
    }

    load();
    return () => unsubscribe();
  });

  async function handleSave(e: Event) {
    e.preventDefault();
    submitting = true;

    try {
      await CommissionsSettingsService.saveSettings(settings, $auth?.uid);
      toast.success('Impostazioni salvate con successo!');
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || 'Errore nel salvataggio impostazioni.');
    } finally {
      submitting = false;
    }
  }
</script>

<svelte:head>
  <title>Impostazioni Provvigioni | Gestoray</title>
</svelte:head>

<div class="settings-page animate-fade-in">
  <div class="page-top-actions">
    <h2 class="title-header">Impostazioni Provvigioni</h2>
  </div>

  {#if loading}
    <div class="loading-box">
      <span class="spinner"></span>
      Caricamento impostazioni...
    </div>
  {:else}
    <CommissionsRulesForm
      bind:settings
      {submitting}
      onSubmit={handleSave}
    />
  {/if}
</div>

<style>
  .settings-page {
    width: 100%;
    padding: 24px 0;
    box-sizing: border-box;
  }
  .page-top-actions {
    margin-bottom: 24px;
  }
  .title-header {
    font-size: 24px;
    font-weight: 700;
    color: var(--color-neutral-800);
    margin: 0;
  }
  .loading-box {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 48px 0;
    color: var(--color-neutral-500);
    font-size: 14.5px;
  }
  .spinner {
    border: 2px solid hsla(var(--brand-h), var(--brand-s), var(--brand-l), 0.15);
    border-radius: 50%;
    border-top-color: var(--color-primary-500);
    animation: spin 1s linear infinite;
    width: 20px; 
    height: 20px; 
  }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
