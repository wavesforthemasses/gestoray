<script lang="ts">
  import { hasAccess } from '$lib/utils/authCheck';
  import { activeRoleState } from '$lib/auth.svelte';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { Settings, Percent, Building, Menu, ActivitySquare } from '@lucide/svelte';
  import SettingsNavCard from './components/SettingsNavCard.svelte';
  import { pageTitle } from '$lib/stores/page';
  pageTitle.set('Impostazioni');

  $effect(() => {
    const currentRole = activeRoleState.role;
    if (currentRole && !hasAccess(currentRole, ['superadmin', 'amministrazione', 'direzione'])) {
      goto('/dashboard');
    }
  });
</script>



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
      href="/dashboard/settings/project"
      title="Configurazione Progetto"
      description="Imposta il nome della piattaforma, l'email di sistema per le notifiche e altri parametri di base."
      icon={Building}
    />
    <SettingsNavCard 
      href="/dashboard/settings/commissions"
      title="Regole Provvigionali"
      description="Configura i metodi di calcolo, le penalizzazioni sugli sconti e le logiche matematiche globali."
      icon={Percent}
    />
    <SettingsNavCard 
      href="/dashboard/settings/activities"
      title="KPI e Attività"
      description="Configura i tipi di attività e interazioni (Telefonate, Appuntamenti) e i relativi permessi."
      icon={ActivitySquare}
    />
    <SettingsNavCard 
      href="/dashboard/settings/menu"
      title="Gestione Menu"
      description="Configura la visibilità delle voci di menu laterale per i vari ruoli."
      icon={Menu}
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
