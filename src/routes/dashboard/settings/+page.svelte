<script lang="ts">
  import { hasAccess } from '$lib/utils/authCheck';
  import { activeRole } from '$lib/auth';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { Settings, Percent } from '@lucide/svelte';
  import SettingsNavCard from './components/SettingsNavCard.svelte';

  onMount(() => {
    const unsubscribe = activeRole.subscribe(($activeRole) => {
      if ($activeRole && !hasAccess($activeRole, ['superadmin', 'amministrazione', 'direzione'])) {
        goto('/dashboard');
      }
    });
    return () => unsubscribe();
  });
</script>

<svelte:head>
  <title>Impostazioni | Gestoray</title>
</svelte:head>

<div class="settings-hub animate-fade-in">
  <div class="page-top-actions">
    <h2 class="title-header">
      <Settings size={28} color="var(--color-neutral-800)" />
      Impostazioni Generali
    </h2>
    <p class="subtitle">Gestisci le configurazioni globali della piattaforma.</p>
  </div>

  <div class="settings-grid">
    <SettingsNavCard 
      href="/dashboard/settings/commissions"
      title="Regole Provvigionali"
      description="Configura i metodi di calcolo, le penalizzazioni sugli sconti e le logiche matematiche globali."
      icon={Percent}
    />
  </div>
</div>

<style>
  .settings-hub {
    width: 100%;
    padding: 24px 0;
    box-sizing: border-box;
  }
  .page-top-actions {
    margin-bottom: 32px;
  }
  .title-header {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 28px;
    font-weight: 700;
    color: var(--color-neutral-800);
    margin: 0 0 8px 0;
  }
  .subtitle {
    font-size: 15px;
    color: var(--color-neutral-500);
    margin: 0;
  }
  
  .settings-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 20px;
  }
</style>
