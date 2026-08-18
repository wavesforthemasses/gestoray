<script lang="ts">
  import { pageTitle } from '$lib/stores/page';
  import { menuConfigStore } from '$lib/stores/menu';
  import modulesRegistry from '$lib/config/modules.registry.json';
  import { toast } from '$lib/stores/toast.svelte';
  import { Card, StatusBadge, Button } from '$lib';
  import { 
    Package, 
    CheckCircle2, 
    AlertTriangle, 
    Copy, 
    Terminal, 
    Layers, 
    ArrowRight, 
    Lock, 
    Unlock,
    Building2,
    FolderKanban,
    FileText,
    CreditCard,
    ClipboardList,
    Award,
    Wrench,
    Ticket,
    Shield,
    MapPin,
    Truck,
    Users,
    Calendar,
    TrendingUp
  } from '@lucide/svelte';

  import { onMount } from 'svelte';
  import { ALL_BRIDGES_SPECS, BridgesSettingsService, bridgesConfigStore } from '$lib/services/bridgesSettingsService';

  pageTitle.set('Gestione Moduli & Plugin Bridges');

  onMount(async () => {
    await BridgesSettingsService.init();
  });

  // Master list of all available pure modules & their metadata
  const ALL_MODULE_SPECS = [
    {
      id: 'products',
      label: 'Prodotti',
      description: 'Catalogo prodotti, servizi, articoli di magazzino e listini prezzi.',
      icon: Package,
      requirements: []
    },
    {
      id: 'contracts',
      label: 'Contratti & Preventivi',
      description: 'Gestione contratti, preventivi, canoni ed il ciclo di approvazione commerciale.',
      icon: FileText,
      requirements: ['products']
    },
    {
      id: 'payments',
      label: 'Scadenzario & Incassi',
      description: 'Gestione rateizzazioni, scadenze ed incassi clienti.',
      icon: CreditCard,
      requirements: ['contracts']
    },
    {
      id: 'activities',
      label: 'Attività & Task',
      description: 'Tracciamento attività commerciali, appuntamenti e chiamate.',
      icon: ClipboardList,
      requirements: []
    },
    {
      id: 'commissions',
      label: 'Provvigioni & Chiusure',
      description: 'Calcolo provvigioni agenti, maturazione e chiusure periodiche.',
      icon: Award,
      requirements: ['contracts']
    },
    {
      id: 'interventi',
      label: 'Interventi & Rapportini',
      description: 'Rapportini tecnici, interventi sul campo, tracciamento ore lavorate e materiale.',
      icon: Wrench,
      requirements: []
    },
    {
      id: 'tickets',
      label: 'Ticket & Assistenza',
      description: 'Helpdesk, ticketing system, presa in carico e gestione SLA di supporto.',
      icon: Ticket,
      requirements: []
    },
    {
      id: 'privacy',
      label: 'Privacy & GDPR',
      description: 'Gestione consensi GDPR, informative, consensi marketing e registro trattamenti.',
      icon: Shield,
      requirements: []
    },
    {
      id: 'projects',
      label: 'Gestione Progetti',
      description: 'Contenitore agnostico di progetti, commesse, avanzamento ed integrazione bridge.',
      icon: FolderKanban,
      requirements: []
    },
    {
      id: 'places',
      label: 'Gestione Luoghi',
      description: 'Anagrafica dei luoghi fisici, cantieri, sedi operative e destinazioni.',
      icon: MapPin,
      requirements: []
    },
    {
      id: 'vehicles',
      label: 'Mezzi & Attrezzature',
      description: 'Anagrafica e parco mezzi aziendali, furgoni, macchinari e strumentazione.',
      icon: Truck,
      requirements: []
    },
    {
      id: 'teams',
      label: 'Squadre & Risorse',
      description: 'Gestione squadre di lavoro, operatori di campo e composizione team.',
      icon: Users,
      requirements: []
    },
    {
      id: 'scheduling',
      label: 'Pianificazione & Agenda',
      description: 'Assegnazione e pianificazione giornaliera/settimanale di squadre, operatori e mezzi nei vari luoghi di lavoro.',
      icon: Calendar,
      requirements: []
    },
    {
      id: 'deadlines',
      label: 'Scadenzario & Allarmi',
      description: 'Motore di allarmi ed avvisi automatici per scadenze furgoni, visite mediche, corsi sicurezza, contratti e certificazioni.',
      icon: AlertTriangle,
      requirements: []
    },
    {
      id: 'chart',
      label: 'Analytics & Grafici BI',
      description: 'Modulo opzionale per la visualizzazione dinamica dei grafici e trend analitici trasversali.',
      icon: TrendingUp,
      requirements: []
    }
  ];

  let activeModuleIds = $derived(
    new Set([
      'clients', 'contacts', 'users', 'qualifications', 'todo', 'settings',
      ...(modulesRegistry.modules || []).map((m: any) => m.id),
      ...$menuConfigStore.map(m => m.id)
    ])
  );

  function isInstalled(id: string): boolean {
    return activeModuleIds.has(id);
  }

  function getMissingRequirements(requirements: string[]): string[] {
    return requirements.filter(reqId => !activeModuleIds.has(reqId));
  }

  function getActiveDependents(moduleId: string): { id: string; label: string }[] {
    return ALL_MODULE_SPECS
      .filter(mod => isInstalled(mod.id) && mod.requirements.includes(moduleId))
      .map(mod => ({ id: mod.id, label: mod.label }));
  }

  function copyToClipboard(text: string, label: string) {
    navigator.clipboard.writeText(text);
    toast.success(`Comando per ${label} copiato negli appunti!`);
  }

  async function toggleBridge(bridgeId: string) {
    const isCurrentlyEnabled = BridgesSettingsService.isBridgeEnabled(bridgeId, $bridgesConfigStore);
    const nextState = !isCurrentlyEnabled;
    try {
      await BridgesSettingsService.setBridgeStatus(bridgeId, nextState);
      toast.success(`Bridge ${bridgeId} ${nextState ? 'attivato' : 'disattivato'} con successo!`);
    } catch (e) {
      console.error('Errore aggiornamento bridge:', e);
      toast.error('Impossibile aggiornare lo stato del bridge.');
    }
  }
</script>

<div class="modules-settings-page animate-fade-in">
  <div class="page-header">
    <div>
      <h2 class="title-header">
        <Package size={28} color="var(--color-primary-600)" />
        Gestione Moduli & Plugin Bridges
      </h2>
      <p class="subtitle">
        Pannello di controllo dell'architettura agnostica. Consulta lo stato dei moduli, verifica i prerequisiti e copia i comandi di installazione per il terminale.
      </p>
    </div>
  </div>

  <!-- ARCHITECTURE INFO BOX -->
  <Card variant="glass" class="info-banner-card">
    <div class="info-banner-content">
      <Layers size={32} class="banner-icon" />
      <div>
        <h3>Architettura a Plugin Agnostica</h3>
        <p>
          I moduli dell'applicazione sono 100% indipendenti. I <strong>Plugin Bridges</strong> tra moduli si attivano automaticamente 
          via <code>import.meta.glob</code> e scambi di eventi <strong>SOLO SE entrambi i moduli sono installati</strong>. 
          Disinstallando un modulo, i relativi bridge si disattivano in modo sicuro senza lasciare residui nel Core.
        </p>
      </div>
    </div>
  </Card>

  <!-- 1. MODULI DISPONIBILI & INSTALLATI -->
  <section class="section-container">
    <h3 class="section-title">
      <Package size={20} />
      Registro Moduli Puri
    </h3>

    <div class="modules-grid">
      {#each ALL_MODULE_SPECS as mod}
        {@const installed = isInstalled(mod.id)}
        {@const missingReqs = getMissingRequirements(mod.requirements)}
        {@const canInstall = missingReqs.length === 0}
        {@const activeDependents = getActiveDependents(mod.id)}
        {@const canUninstall = activeDependents.length === 0}
        {@const IconComp = mod.icon}
        {@const installCmd = `npm run module:install -- --name ${mod.id}`}
        {@const uninstallCmd = `npm run module:uninstall -- --name ${mod.id}`}

        <div class="module-card" class:installed={installed} class:locked={(!installed && !canInstall) || (installed && !canUninstall)}>
          <div class="mc-header">
            <div class="mc-icon-box" class:installed={installed}>
              <IconComp size={22} />
            </div>
            <div class="mc-title-box">
              <h4>{mod.label}</h4>
              <span class="module-id-code">ID: {mod.id}</span>
            </div>
            <div class="mc-status">
              {#if installed}
                <span class="badge installed">
                  <CheckCircle2 size={13} /> Installato
                </span>
              {:else}
                <span class="badge available">
                  Disponibile
                </span>
              {/if}
            </div>
          </div>

          <p class="mc-description">{mod.description}</p>

          <!-- REQUIREMENTS / DEPENDENCIES SECTION -->
          {#if mod.requirements.length > 0}
            <div class="requirements-box">
              <span class="req-label">Prerequisiti:</span>
              {#each mod.requirements as reqId}
                {@const reqInstalled = isInstalled(reqId)}
                <span class="req-chip" class:met={reqInstalled} class:missing={!reqInstalled}>
                  {#if reqInstalled}
                    <CheckCircle2 size={12} />
                  {:else}
                    <Lock size={12} />
                  {/if}
                  {reqId}
                </span>
              {/each}
            </div>
          {/if}

          <!-- DEPENDENTS SECTION (if installed & active modules depend on this) -->
          {#if installed && !canUninstall}
            <div class="requirements-box dependents-box">
              <span class="req-label text-amber">Richiesto da:</span>
              {#each activeDependents as dep}
                <span class="req-chip warning">
                  <Lock size={12} />
                  {dep.label}
                </span>
              {/each}
            </div>
          {/if}

          <!-- ACTIONS & TERMINAL COMMANDS -->
          <div class="mc-actions">
            {#if installed && canUninstall}
              <div class="cmd-row">
                <code class="cmd-code">{uninstallCmd}</code>
                <Button 
                  size="sm" 
                  variant="secondary" 
                  onclick={() => copyToClipboard(uninstallCmd, `disinstallare ${mod.label}`)}
                >
                  <Copy size={14} /> Copia
                </Button>
              </div>
            {:else if installed && !canUninstall}
              <div class="locked-warning">
                <Lock size={15} color="var(--color-amber-600)" />
                <span>Non disinstallabile: richiesto da <strong>{activeDependents.map(d => d.label).join(', ')}</strong>. Disinstalla prima i moduli dipendenti.</span>
              </div>
            {:else if !installed && canInstall}
              <div class="cmd-row">
                <code class="cmd-code">{installCmd}</code>
                <Button 
                  size="sm" 
                  variant="primary" 
                  onclick={() => copyToClipboard(installCmd, `installare ${mod.label}`)}
                >
                  <Copy size={14} /> Copia Comando
                </Button>
              </div>
            {:else}
              <div class="locked-warning">
                <AlertTriangle size={15} color="var(--color-amber-600)" />
                <span>Prima di installare questo modulo, installa: <strong>{missingReqs.map(id => ALL_MODULE_SPECS.find(m => m.id === id)?.label || id).join(', ')}</strong></span>
              </div>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  </section>

  <!-- 2. BRIDGES CROSS-MODULO -->
  <section class="section-container">
    <h3 class="section-title">
      <Layers size={20} />
      Stato Plugin Bridges Cross-Modulo
    </h3>

    <div class="bridges-grid">
      {#each ALL_BRIDGES_SPECS as bridge}
        {@const isCoreModule = (m: string) => ['clients', 'contacts', 'users', 'core', 'todo'].includes(m)}
        {@const sourceActive = isCoreModule(bridge.sourceModule) || isInstalled(bridge.sourceModule)}
        {@const targetActive = isCoreModule(bridge.targetModule) || isInstalled(bridge.targetModule)}
        {@const modulesInstalled = sourceActive && targetActive}
        {@const isBridgeEnabled = BridgesSettingsService.isBridgeEnabled(bridge.id, $bridgesConfigStore)}
        {@const bridgeActive = modulesInstalled && isBridgeEnabled}

        <div class="bridge-card" class:active={bridgeActive} class:disabled={!modulesInstalled || !isBridgeEnabled}>
          <div class="bc-header">
            <div class="bc-flow">
              <span class="mod-chip" class:active={sourceActive}>{bridge.sourceModule}</span>
              <ArrowRight size={14} class="flow-arrow" />
              <span class="mod-chip" class:active={targetActive}>{bridge.targetModule}</span>
            </div>

            {#if modulesInstalled}
              <button 
                type="button" 
                class="bridge-toggle-switch"
                class:active={isBridgeEnabled}
                onclick={() => toggleBridge(bridge.id)}
                title={isBridgeEnabled ? 'Disattiva questo bridge' : 'Attiva questo bridge'}
              >
                {#if isBridgeEnabled}
                  <Unlock size={12} /> Attivo
                {:else}
                  <Lock size={12} /> Disattivato
                {/if}
              </button>
            {:else}
              <span class="badge available">
                <Lock size={12} /> Moduli mancanti
              </span>
            {/if}
          </div>

          <h4>{bridge.title}</h4>
          <p class="bc-desc">{bridge.description}</p>
        </div>
      {/each}
    </div>
  </section>
</div>

<style>
  .modules-settings-page {
    width: 100%;
    padding: 20px 0;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 28px;
  }

  .page-header {
    margin-bottom: 4px;
  }
  .title-header {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 26px;
    font-weight: 700;
    color: var(--color-neutral-800);
    margin: 0 0 6px 0;
  }
  .subtitle {
    font-size: 15px;
    color: var(--color-neutral-500);
    margin: 0;
  }

  /* INFO BANNER */
  .info-banner-content {
    display: flex;
    align-items: flex-start;
    gap: 16px;
    padding: 8px 4px;
  }
  .info-banner-content h3 {
    margin: 0 0 6px 0;
    font-size: 16px;
    color: var(--color-primary-700);
  }
  .info-banner-content p {
    margin: 0;
    font-size: 14px;
    color: var(--color-neutral-700);
    line-height: 1.5;
  }

  .section-container {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .section-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 18px;
    font-weight: 700;
    color: var(--color-neutral-800);
    margin: 0;
  }

  /* MODULES GRID */
  .modules-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 20px;
  }

  .module-card {
    background: var(--color-surface, #ffffff);
    border: 1px solid var(--color-neutral-200);
    border-radius: 12px;
    padding: 20px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 14px;
    transition: all 0.2s ease;
  }
  .module-card:hover {
    border-color: var(--color-primary-400);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  }
  .module-card.installed {
    border-left: 4px solid var(--color-emerald-500, #10b981);
  }
  .module-card.locked {
    background: var(--color-neutral-50, #f9fafb);
    opacity: 0.85;
  }

  .mc-header {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .mc-icon-box {
    width: 42px;
    height: 42px;
    border-radius: 10px;
    background: var(--color-neutral-100);
    color: var(--color-neutral-600);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .mc-icon-box.installed {
    background: var(--color-primary-50);
    color: var(--color-primary-600);
  }
  .mc-title-box {
    flex: 1;
    display: flex;
    flex-direction: column;
  }
  .mc-title-box h4 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--color-neutral-800);
  }
  .module-id-code {
    font-size: 11px;
    font-family: monospace;
    color: var(--color-neutral-400);
  }

  .badge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 4px 8px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
  }
  .badge.installed {
    background: #ecfdf5;
    color: #059669;
  }
  .badge.available {
    background: #f1f5f9;
    color: #64748b;
  }

  .mc-description {
    font-size: 13px;
    color: var(--color-neutral-600);
    margin: 0;
    line-height: 1.4;
  }

  .requirements-box {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
  }
  .req-label {
    color: var(--color-neutral-500);
    font-weight: 500;
  }
  .req-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
  }
  .req-chip.met {
    background: #e0f2fe;
    color: #0284c7;
  }
  .req-chip.missing {
    background: #fef3c7;
    color: #d97706;
  }
  .req-chip.warning {
    background: #fff7ed;
    color: #c2410c;
    border: 1px solid #ffedd5;
  }
  .req-label.text-amber {
    color: #c2410c;
    font-weight: 600;
  }

  .mc-actions {
    margin-top: 4px;
  }
  .cmd-row {
    display: flex;
    align-items: center;
    gap: 8px;
    background: var(--color-neutral-900, #0f172a);
    padding: 6px 10px;
    border-radius: 8px;
  }
  .cmd-code {
    flex: 1;
    font-family: monospace;
    font-size: 11px;
    color: var(--color-emerald-400, #34d399);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .locked-warning {
    display: flex;
    align-items: center;
    gap: 8px;
    background: #fffbe6;
    border: 1px solid #ffe58f;
    padding: 8px 12px;
    border-radius: 8px;
    font-size: 12px;
    color: #856404;
  }

  /* BRIDGES GRID */
  .bridges-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 16px;
  }
  .bridge-card {
    background: var(--color-surface, #ffffff);
    border: 1px solid var(--color-neutral-200);
    border-radius: 10px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    transition: all 0.15s ease;
  }
  .bridge-card.active {
    border-color: var(--color-emerald-300, #a7f3d0);
    background: #f0fdf4;
  }
  .bridge-card.disabled {
    opacity: 0.75;
    background: var(--color-neutral-50, #f8fafc);
  }
  .bc-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .bc-flow {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .mod-chip {
    font-size: 11px;
    font-weight: 700;
    font-family: monospace;
    padding: 2px 6px;
    border-radius: 4px;
    background: var(--color-neutral-100);
    color: var(--color-neutral-600);
  }
  .mod-chip.active {
    background: var(--color-primary-100);
    color: var(--color-primary-700);
  }

  .bridge-toggle-switch {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 3px 8px;
    border-radius: 6px;
    font-size: 11.5px;
    font-weight: 600;
    cursor: pointer;
    border: 1px solid var(--color-neutral-300, #cbd5e1);
    background: var(--color-white, #ffffff);
    color: var(--color-neutral-600, #475569);
    transition: all 0.15s ease;
  }
  .bridge-toggle-switch.active {
    background: #ecfdf5;
    color: #047857;
    border-color: #a7f3d0;
  }
  .bridge-toggle-switch:hover {
    transform: translateY(-1px);
    box-shadow: 0 1px 2px rgba(0,0,0,0.05);
  }

  .bridge-card h4 {
    margin: 4px 0 0 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--color-neutral-800);
  }
  .bc-desc {
    font-size: 12px;
    color: var(--color-neutral-600);
    margin: 0;
  }
</style>
