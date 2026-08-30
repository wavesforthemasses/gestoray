<script lang="ts">
  import { page } from '$app/stores';
  import { authState, activeRoleState } from '$lib/auth.svelte';
  import { auth as clientAuth } from '$lib/firebase';
  import { signOut as clientSignOut } from '$lib/firebase';
  import { goto, afterNavigate } from '$app/navigation';
  import { onMount } from 'svelte';
  import { LayoutDashboard, LogOut, Menu, ChevronLeft, ChevronRight, Info, X, Settings, FileText, WifiOff, ArrowLeft } from '@lucide/svelte';
  import { iconMap } from '$lib/utils/iconMap';
  import { ChartSettingsService } from '$lib';
  import ProjectSetupBlocker from '$lib/components/ProjectSetupBlocker.svelte';
  import { projectStore } from '$lib/stores/project';
  import { pageTitle } from '$lib/stores/page';
  import { menuConfigStore } from '$lib/stores/menu';
  import { menuBadgesStore, initTicketsBadgeListener, destroyBadgesListeners } from '$lib/stores/badges';
  import { canGoBackStore, recordNavigation, executeGlobalBack } from '$lib/stores/navigationHistory';
  import SidebarNav from './components/SidebarNav.svelte';

  import { isOnlineStore, initNetworkStateListener } from '$lib/stores/networkState';

  let { children } = $props();

  let isCollapsed = $state(false);
  let isMobileOpen = $state(false);
  let showLegend = $state(false);

  afterNavigate((nav) => {
    recordNavigation(nav);
  });

  let dynamicLegendKpis = $derived.by(() => {
    return ChartSettingsService.getAllKpisMasterListSync().filter(k => k.enabled);
  });

  onMount(() => {
    initNetworkStateListener();
  });

  $effect(() => {
    const role = activeRoleState.role;
    const uid = authState.user?.uid || null;
    const isExecutive = role === 'superadmin' || role === 'amministrazione' || role === 'direzione';
    initTicketsBadgeListener(uid, isExecutive);
  });

  let SentinelComponent = $state<any>(null);

  $effect(() => {
    const isPlacesActive = $menuConfigStore.some(m => m.id === 'places');
    if (isPlacesActive && authState.user) {
      import('./places/ui/components/GlobalPresenceSentinel.svelte')
        .then(mod => {
          SentinelComponent = mod.default;
        })
        .catch(() => {
          SentinelComponent = null;
        });
    } else {
      SentinelComponent = null;
    }
  });

  onMount(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sidebar_collapsed');
      if (saved) {
        isCollapsed = saved === 'true';
      }
    }
  });

  function toggleSidebar() {
    isCollapsed = !isCollapsed;
    if (typeof window !== 'undefined') {
      localStorage.setItem('sidebar_collapsed', String(isCollapsed));
    }
  }

  async function handleLogout() {
    await clientSignOut(clientAuth);
    authState.user = null;
    goto('/login');
  }

  $effect(() => {
    // Se l'autenticazione è stata controllata ma l'utente non c'è, redirect a login
    if (authState.initialized && !authState.user) {
      goto('/login');
    }
  });
</script>

<svelte:head>
  <title>{$pageTitle} | {$projectStore?.projectName || 'ERP'}</title>
</svelte:head>

<ProjectSetupBlocker />

<div class="dashboard-shell" class:collapsed={isCollapsed} class:mobile-open={isMobileOpen}>
  <!-- Backdrop for mobile drawer -->
  {#if isMobileOpen}
    <div class="sidebar-backdrop" onclick={() => isMobileOpen = false} role="presentation"></div>
  {/if}

  <aside class="sidebar">
    <div class="sidebar-header">
      {#if !isCollapsed}
        <img src="/logo.png?gst" alt="{$projectStore?.projectName || 'ERP'} Logo" class="sidebar-logo" />
        <div class="sidebar-header-actions">
          <button 
            type="button" 
            onclick={executeGlobalBack} 
            disabled={!$canGoBackStore} 
            class="header-back-btn" 
            title={$canGoBackStore ? "Torna indietro (pagina precedente)" : "Nessuna pagina precedente"} 
            aria-label="Torna indietro"
          >
            <ArrowLeft size={16} />
          </button>
          <button onclick={toggleSidebar} class="toggle-btn" aria-label="Nascondi barra laterale">
            <ChevronLeft size={18} />
          </button>
        </div>
      {:else}
        <div class="collapsed-header-actions">
          <button 
            type="button" 
            onclick={executeGlobalBack} 
            disabled={!$canGoBackStore} 
            class="header-back-btn collapsed-back" 
            title={$canGoBackStore ? "Torna indietro (pagina precedente)" : "Nessuna pagina precedente"} 
            aria-label="Torna indietro"
          >
            <ArrowLeft size={16} />
          </button>
          <button onclick={toggleSidebar} class="toggle-btn collapsed-toggle" aria-label="Mostra barra laterale">
            <ChevronRight size={18} />
          </button>
        </div>
      {/if}
    </div>

    {#if authState.user}
      <div class="user-card" class:hidden-collapsed={isCollapsed}>
        <div class="user-avatar" title={authState.user.email}>
          {(authState.user.email || 'U').substring(0, 1).toUpperCase()}
        </div>
        <div class="user-info">
          <span class="user-name">{authState.user.email}</span>
          {#if authState.user.roles.length > 1}
            <div class="role-selector">
              <span class="role-label">Ruolo Attivo</span>
              <select bind:value={activeRoleState.role} class="role-select">
                {#each authState.user.roles as r}
                  <option value={r}>{r}</option>
                {/each}
              </select>
            </div>
          {:else}
            <span class="role-badge">{authState.user.roles[0] || 'nessun ruolo'}</span>
          {/if}
        </div>
      </div>
      {#if isCollapsed}
        <div class="user-card-collapsed" title="{authState.user.email} - {activeRoleState.role || authState.user.roles[0]}">
          <div class="user-avatar">
            {(authState.user.email || 'U').substring(0, 1).toUpperCase()}
          </div>
        </div>
      {/if}
    {/if}

    <SidebarNav 
      activeRole={activeRoleState.role || ''} 
      menuConfig={$menuConfigStore} 
      badges={$menuBadgesStore} 
    />

    <div class="sidebar-footer">
      <button onclick={handleLogout} class="logout-btn" title="Disconnetti">
        <span class="logout-icon"><LogOut size={16} /></span>
        <span class="logout-label">Disconnetti</span>
      </button>
    </div>
  </aside>

  <div class="main-container">
    <button onclick={() => isMobileOpen = true} class="floating-mobile-btn" aria-label="Apri menu">
      <Menu size={24} />
    </button>

    <main class="content-viewport">
      {#if !$isOnlineStore}
        <div class="offline-banner">
          <WifiOff size={16} /> <strong>Sei attualmente offline.</strong> Le modifiche verranno sincronizzate non appena la connessione sarà ripristinata.
        </div>
      {/if}
      {@render children()}
    </main>

    <!-- Global Proactive Presence Sentinel (Mounted conditionally if places module is active) -->
    {#if SentinelComponent && authState.user}
      {@const Sentinel = SentinelComponent}
      <Sentinel currentUser={authState.user} />
    {/if}

    <!-- Global Core Back Floating Button -->
    <button 
      class="floating-back-btn" 
      class:disabled={!$canGoBackStore}
      disabled={!$canGoBackStore}
      onclick={executeGlobalBack} 
      title={$canGoBackStore ? "Torna indietro (pagina precedente)" : "Nessuna pagina precedente"}
      aria-label="Torna indietro"
    >
      <ArrowLeft size={22} />
    </button>

    <!-- KPI Legend Floating Button -->
    <button class="floating-legend-btn" onclick={() => showLegend = true} title="Legenda KPI">
      <Info size={24} />
    </button>

    <!-- KPI Legend Modal -->
    {#if showLegend}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
      <div class="legend-modal-overlay" onclick={() => showLegend = false} role="presentation">
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
        <div class="legend-modal" onclick={(e) => e.stopPropagation()} role="dialog" tabindex="-1">
          <div class="legend-header">
            <h3>Legenda KPI</h3>
            <button class="close-btn" onclick={() => showLegend = false} aria-label="Chiudi">
              <X size={20} />
            </button>
          </div>
          <div class="legend-body">
            {#each dynamicLegendKpis as kpi}
              <div class="legend-item">
                <span class="legend-key">{kpi.acronym}</span>
                <div class="legend-desc">
                  <strong>{kpi.name}</strong>
                  <p>{kpi.description}</p>
                </div>
              </div>
            {/each}
          </div>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  :global(:root) {
    --sidebar-width-expanded: 280px;
    --sidebar-width-collapsed: 80px;
    --sidebar-width: var(--sidebar-width-expanded);
    --transition-speed: 0.3s;
  }

  .dashboard-shell {
    display: flex;
    min-height: 100vh;
    background-color: var(--color-neutral-50);
    color: var(--color-neutral-700);
  }

  .dashboard-shell.collapsed {
    --sidebar-width: var(--sidebar-width-collapsed);
  }

  .sidebar {
    width: var(--sidebar-width);
    position: fixed;
    left: 0;
    top: 0;
    bottom: 0;
    background-color: rgba(255, 255, 255, 0.65);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-right: 1px solid rgba(255, 255, 255, 0.8);
    box-shadow: 10px 0 40px rgba(0, 0, 0, 0.04);
    display: flex;
    flex-direction: column;
    padding: 24px;
    box-sizing: border-box;
    z-index: 100;
    transition: width var(--transition-speed) cubic-bezier(0.4, 0, 0.2, 1);
    overflow-x: hidden;
  }

  .sidebar-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 30px;
    min-height: 38px;
  }

  .sidebar-header-actions {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .collapsed-header-actions {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    margin: 0 auto;
  }

  .header-back-btn {
    background: rgba(255, 255, 255, 0.6);
    border: 1px solid rgba(0, 0, 0, 0.08);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.03);
    color: var(--color-neutral-700);
    width: 28px;
    height: 28px;
    border-radius: var(--radius-sm);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .header-back-btn:hover:not(:disabled) {
    background: var(--color-white);
    color: var(--color-primary-600);
    border-color: var(--color-primary-300);
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.08);
    transform: translateY(-1px);
  }

  .header-back-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
    box-shadow: none;
  }

  .sidebar-logo {
    height: 38px;
    width: auto;
    object-fit: contain;
    display: block;
    transition: opacity var(--transition-speed);
  }

  .toggle-btn {
    background: rgba(255, 255, 255, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.8);
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.03);
    color: var(--color-neutral-600);
    width: 28px;
    height: 28px;
    border-radius: var(--radius-sm);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  }

  .toggle-btn:hover {
    background: var(--color-white);
    color: var(--color-primary-600);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
  }

  .collapsed-toggle {
    margin: 0 auto;
  }

  .user-card {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    background: rgba(255, 255, 255, 0.5);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.9);
    border-radius: 16px;
    padding: 12px;
    margin-bottom: 25px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.03), inset 0 2px 4px rgba(255, 255, 255, 0.5);
    transition: opacity var(--transition-speed);
  }

  .user-card.hidden-collapsed {
    display: none;
  }

  .user-card-collapsed {
    display: flex;
    justify-content: center;
    margin-bottom: 25px;
  }

  .user-avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: linear-gradient(135deg, var(--color-primary-500), var(--color-primary-700));
    color: white;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 15px;
    box-shadow: 0 4px 12px rgba(var(--brand-h), var(--brand-s), var(--brand-l), 0.2);
    flex-shrink: 0;
  }

  .user-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    overflow: hidden;
    width: calc(100% - 52px);
  }

  .user-name {
    font-size: 13.5px;
    font-weight: 700;
    color: var(--color-neutral-900);
    white-space: nowrap;
    text-overflow: ellipsis;
    overflow: hidden;
    letter-spacing: -0.01em;
  }

  .role-badge {
    font-size: 10px;
    font-weight: 700;
    color: var(--color-primary-600);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .role-selector {
    margin-top: 6px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    width: 100%;
  }

  .role-label {
    font-size: 9px;
    font-weight: 700;
    color: var(--color-neutral-500);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .role-select {
    background: rgba(255, 255, 255, 0.8);
    border: 1px solid rgba(0, 0, 0, 0.05);
    border-radius: 8px;
    color: var(--color-neutral-800);
    font-family: inherit;
    font-size: 11px;
    font-weight: 600;
    padding: 6px 10px;
    cursor: pointer;
    width: 100%;
    outline: none;
    transition: all 0.2s ease;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23475569'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 8px center;
    background-size: 12px;
    padding-right: 24px;
    text-transform: uppercase;
    box-shadow: 0 2px 6px rgba(0,0,0,0.02);
  }

  .role-select:hover {
    border-color: var(--color-primary-300);
    background-color: var(--color-white);
  }

  .role-select:focus {
    border-color: var(--color-primary-500);
    box-shadow: 0 0 0 3px hsla(var(--brand-h), var(--brand-s), var(--brand-l), 0.15);
  }

  .collapsed .sidebar {
    padding: 24px 12px;
  }

  .sidebar-footer {
    margin-top: auto;
    padding-top: 20px;
    border-top: 1px solid var(--color-neutral-200);
  }

  .logout-btn {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 12px;
    background: var(--color-white);
    border: 1px solid var(--color-error-border);
    color: var(--color-error-text);
    border-radius: var(--radius-md);
    cursor: pointer;
    font-family: inherit;
    font-size: 14px;
    font-weight: 600;
    transition: all 0.2s ease;
    white-space: nowrap;
    overflow: hidden;
  }

  .logout-btn:hover {
    background: var(--color-error-light);
    color: var(--color-error-text);
    border-color: var(--color-error);
  }

  .logout-icon {
    display: flex;
    align-items: center;
    flex-shrink: 0;
  }

  .logout-label {
    transition: opacity var(--transition-speed);
  }

  .collapsed .logout-label {
    opacity: 0;
    pointer-events: none;
    width: 0;
    overflow: hidden;
  }

  .collapsed .logout-btn {
    padding: 12px 0;
    gap: 0;
  }

  .main-container {
    flex: 1;
    display: flex;
    flex-direction: column;
    margin-left: var(--sidebar-width);
    transition: margin-left var(--transition-speed) cubic-bezier(0.4, 0, 0.2, 1);
    min-width: 0;
  }

  .floating-mobile-btn {
    display: none;
  }

  .content-viewport {
    flex: 1;
    padding: 40px;
    box-sizing: border-box;
    max-width: 1200px;
    width: 100%;
    margin: 0 auto;
  }

  .sidebar-backdrop {
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(15, 23, 42, 0.3);
    backdrop-filter: blur(4px);
    z-index: 90;
  }

  @media (max-width: 768px) {
    .sidebar {
      position: fixed;
      left: 0;
      top: 0;
      bottom: 0;
      width: var(--sidebar-width-expanded) !important;
      transform: translateX(-100%);
      transition: transform var(--transition-speed) ease-in-out;
      z-index: 1000;
      background-color: var(--color-white);
    }

    .mobile-open .sidebar {
      transform: translateX(0);
    }

    .mobile-open .sidebar-backdrop {
      display: block;
    }

    .main-container {
      margin-left: 0 !important;
      width: 100%;
    }

    .floating-mobile-btn {
      display: flex;
      position: fixed;
      top: 16px;
      right: 16px;
      z-index: 900;
      background: var(--color-white);
      border: 1px solid var(--color-neutral-200);
      color: var(--color-neutral-800);
      width: 44px;
      height: 44px;
      border-radius: 50%;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      cursor: pointer;
    }

    .content-viewport {
      padding: 70px 20px 20px 20px;
    }

    .floating-back-btn {
      top: 16px;
      right: 120px;
    }

    .floating-legend-btn {
      top: 16px;
      right: 68px;
    }

    .legend-modal {
      width: 90%;
      max-height: 80vh;
    }

    .toggle-btn {
      display: none;
    }
  }

  /* Global Floating Back Button */
  .floating-back-btn {
    position: fixed;
    top: 20px;
    right: 74px;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: var(--color-white);
    color: var(--color-neutral-800);
    border: 1px solid var(--color-neutral-200);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    cursor: pointer;
    z-index: 990;
    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .floating-back-btn:hover:not(:disabled) {
    transform: scale(1.05);
    background: var(--color-neutral-50);
    border-color: var(--color-primary-400);
    color: var(--color-primary-600);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.12);
  }

  .floating-back-btn:disabled,
  .floating-back-btn.disabled {
    opacity: 0.35;
    cursor: not-allowed;
    background: var(--color-neutral-100);
    color: var(--color-neutral-400);
    border-color: var(--color-neutral-200);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.03);
    transform: none !important;
  }

  /* Legend Floating Button & Modal Styles */
  .floating-legend-btn {
    position: fixed;
    top: 20px;
    right: 20px;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: var(--color-primary-600);
    color: white;
    border: none;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    cursor: pointer;
    z-index: 990;
    transition: all 0.2s ease;
  }
  @media (max-width: 1024px) {
    .floating-back-btn {
      top: 16px;
      right: 120px;
    }
    .floating-legend-btn {
      top: 16px;
      right: 68px; /* Make space for mobile menu button */
    }
  }
  .floating-legend-btn:hover {
    transform: scale(1.05);
    background: var(--color-primary-700);
  }

  .legend-modal-overlay {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.5);
    backdrop-filter: blur(4px);
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    animation: fadeIn 0.2s ease;
  }

  .legend-modal {
    background: var(--color-white);
    border-radius: 12px;
    width: 450px;
    max-width: 90vw;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 10px 40px rgba(0,0,0,0.2);
    animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .legend-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px 24px;
    border-bottom: 1px solid var(--color-neutral-200);
  }
  .legend-header h3 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: var(--color-neutral-800);
  }
  .legend-header .close-btn {
    background: none;
    border: none;
    color: var(--color-neutral-500);
    cursor: pointer;
    padding: 4px;
    display: flex;
    border-radius: 4px;
  }
  .legend-header .close-btn:hover {
    background: var(--color-neutral-100);
    color: var(--color-neutral-800);
  }

  .legend-body {
    padding: 24px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .legend-item {
    display: flex;
    gap: 16px;
    align-items: flex-start;
  }

  .legend-key {
    background: var(--color-primary-50);
    color: var(--color-primary-700);
    padding: 4px 8px;
    border-radius: 6px;
    font-weight: 700;
    font-size: 14px;
    min-width: 50px;
    text-align: center;
    border: 1px solid var(--color-primary-100);
  }

  .legend-desc {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .legend-desc strong {
    font-size: 15px;
    color: var(--color-neutral-800);
  }
  .legend-desc p {
    margin: 0;
    font-size: 13px;
    color: var(--color-neutral-600);
    line-height: 1.4;
  }

  @keyframes slideUp {
    from { opacity: 0; transform: translateY(20px) scale(0.95); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }

  .offline-banner {
    background: #fef3c7;
    color: #92400e;
    border: 1px solid #fde68a;
    padding: 10px 16px;
    border-radius: var(--radius-md);
    margin-bottom: 16px;
    font-size: 13px;
  }
</style>
