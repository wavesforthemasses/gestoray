<script lang="ts">
  import { hasAccess } from '$lib/utils/authCheck';
  import { activeRoleState } from '$lib/auth.svelte';
  import { goto } from '$app/navigation';
  import { Settings, Building, Menu, Palette, Shield, Ticket, Wrench, FileSpreadsheet, Ruler, ClipboardList, Package, Briefcase, FileText, TrendingUp } from '@lucide/svelte';
  import SettingsNavCard from './components/SettingsNavCard.svelte';
  import { pageTitle } from '$lib/stores/page';
  import { menuConfigStore } from '$lib/stores/menu';

  pageTitle.set('Impostazioni');

  $effect(() => {
    const currentRole = activeRoleState.role;
    if (currentRole && !hasAccess(currentRole, ['superadmin', 'amministrazione', 'direzione'])) {
      goto('/dashboard');
    }
  });

  const iconMap: Record<string, any> = {
    Ticket, Wrench, ClipboardList, Package, FileText, Settings, Shield, Building, Menu, Palette, FileSpreadsheet, Ruler, Briefcase, TrendingUp
  };

  // Dynamic Module Settings Cards
  const dynamicModuleSettings = $derived(
    $menuConfigStore
      .filter((m: any) => m.settingsCard)
      .map((m: any) => ({
        id: m.id,
        href: m.settingsCard.path || `/dashboard/settings/${m.id}`,
        title: m.settingsCard.title || `Configurazione ${m.label}`,
        description: m.settingsCard.description || `Personalizza le impostazioni ed il comportamento del modulo ${m.label}.`,
        icon: iconMap[m.settingsCard.icon] || Settings
      }))
  );
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
      href="/dashboard/settings/roles"
      title="Gestione Ruoli e Permessi"
      description="Crea e gestisci ruoli aziendali (es. Amministrazione, Commerciale, Operaio, Tecnico) e imposta i permessi della Dashboard."
      icon={Shield}
    />

    <SettingsNavCard 
      href="/dashboard/settings/project"
      title="Configurazione Progetto"
      description="Imposta il nome della piattaforma, l'email di sistema per le notifiche e altri parametri di base."
      icon={Building}
    />

    <SettingsNavCard 
      href="/dashboard/settings/menu"
      title="Gestione Menu"
      description="Configura la visibilità delle voci di menu laterale per i vari ruoli."
      icon={Menu}
    />

    <SettingsNavCard 
      href="/dashboard/settings/modules"
      title="Gestione Moduli & Plugin Bridges"
      description="Visualizza i moduli e i ponti di integrazione del sistema, verifica i prerequisiti e copia i comandi di installazione."
      icon={Package}
    />

    <SettingsNavCard 
      href="/dashboard/settings/units"
      title="Gestione Unità di Misura"
      description="Configura le unità di misura aziendali (mc, mq, pz, kg, ore) ed i sinonimi per l'importazione automatica CSV."
      icon={Ruler}
    />

    <SettingsNavCard 
      href="/dashboard/settings/clients"
      title="Configurazione Campi Scheda Cliente"
      description="Personalizza la visibilità e l'organizzazione dei gruppi di campi nei form e nella scheda cliente."
      icon={Briefcase}
    />

    {#each dynamicModuleSettings as card}
      <SettingsNavCard 
        href={card.href}
        title={card.title}
        description={card.description}
        icon={card.icon}
      />
    {/each}

    <SettingsNavCard 
      href="/dashboard/settings/theme"
      title="Tema e Branding"
      description="Personalizza i colori principali dell'applicazione in tempo reale."
      icon={Palette}
    />

    <SettingsNavCard 
      href="/dashboard/settings/import"
      title="Importazione Dati Centralizzata"
      description="Carica file CSV/TSV per anagrafiche, prodotti e attività con mappatura dinamica e riconciliazione."
      icon={FileSpreadsheet}
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
