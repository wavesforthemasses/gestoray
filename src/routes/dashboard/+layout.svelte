<script lang="ts">
  import { page } from '$app/stores';
  import { auth, activeRole } from '$lib/auth';
  import { auth as clientAuth } from '$lib/firebase';
  import { signOut as clientSignOut } from '$lib/firebase';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { LayoutDashboard, CheckSquare, Users, Settings, LogOut, Menu, ChevronLeft, ChevronRight, Briefcase, Tag, FileText, Wallet, ClipboardList, Award, Info, X } from '@lucide/svelte';
  import { KPI_LEGEND } from '$lib/kpiLegend';
  import ProjectSetupBlocker from '$lib/components/ProjectSetupBlocker.svelte';
  import { projectStore } from '$lib/stores/project';
  import { pageTitle } from '$lib/stores/page';
  import { menuConfigStore } from '$lib/stores/menu';

  let { children } = $props();

  let isCollapsed = $state(false);
  let isMobileOpen = $state(false);
  let showLegend = $state(false);

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
    auth.set(null);
    goto('/login');
  }
</script>

<svelte:head>
  <title>{$pageTitle} | {$projectStore?.projectName || 'CRM'}</title>
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
        <img src="/logo.png" alt="{$projectStore?.projectName || 'CRM'} Logo" class="sidebar-logo" />
        <button onclick={toggleSidebar} class="toggle-btn" aria-label="Nascondi barra laterale">
          <ChevronLeft size={18} />
        </button>
      {:else}
        <button onclick={toggleSidebar} class="toggle-btn collapsed-toggle" aria-label="Mostra barra laterale">
          <ChevronRight size={18} />
        </button>
      {/if}
    </div>

    {#if $auth}
      <div class="user-card" class:hidden-collapsed={isCollapsed}>
        <div class="user-avatar" title={$auth.email}>
          {($auth.email || 'U').substring(0, 1).toUpperCase()}
        </div>
        <div class="user-info">
          <span class="user-name">{$auth.email}</span>
          {#if $auth.roles.length > 1}
            <div class="role-selector">
              <span class="role-label">Ruolo Attivo</span>
              <select bind:value={$activeRole} class="role-select">
                {#each $auth.roles as r}
                  <option value={r}>{r}</option>
                {/each}
              </select>
            </div>
          {:else}
            <span class="role-badge">{$auth.roles[0] || 'nessun ruolo'}</span>
          {/if}
        </div>
      </div>
      {#if isCollapsed}
        <div class="user-card-collapsed" title="{$auth.email} - {$activeRole || $auth.roles[0]}">
          <div class="user-avatar">
            {($auth.email || 'U').substring(0, 1).toUpperCase()}
          </div>
        </div>
      {/if}
    {/if}

    <nav class="nav-menu">
      {#if $activeRole}
        {@const menuConf = $menuConfigStore.reduce((acc, curr) => ({ ...acc, [curr.id]: curr.rolesView.includes($activeRole || '') }), {})}

        <a href="/dashboard" class="nav-item" class:active={$page.url.pathname === '/dashboard'} title="Dashboard">
          <span class="nav-icon"><LayoutDashboard size={18} /></span>
          <span class="nav-label">Dashboard</span>
        </a>

        {#if menuConf['todo']}
          <a href="/dashboard/todo" class="nav-item" class:active={$page.url.pathname.startsWith('/dashboard/todo')} title="Cose da Fare">
            <span class="nav-icon"><CheckSquare size={18} /></span>
            <span class="nav-label">Cose da Fare</span>
          </a>
        {/if}

        {#if menuConf['clients']}
          <a href="/dashboard/clients" class="nav-item" class:active={$page.url.pathname.startsWith('/dashboard/clients')} title="Gestione Clienti">
            <span class="nav-icon"><Briefcase size={18} /></span>
            <span class="nav-label">Gestione Clienti</span>
          </a>
        {/if}

        {#if menuConf['activities']}
          <a href="/dashboard/activities" class="nav-item" class:active={$page.url.pathname.startsWith('/dashboard/activities')} title="Gestione Attività">
            <span class="nav-icon"><ClipboardList size={18} /></span>
            <span class="nav-label">Gestione Attività</span>
          </a>
        {/if}

        {#if menuConf['contracts']}
          <a href="/dashboard/contracts" class="nav-item" class:active={$page.url.pathname.startsWith('/dashboard/contracts')} title="Gestione Contratti">
            <span class="nav-icon"><FileText size={18} /></span>
            <span class="nav-label">Gestione Contratti</span>
          </a>
        {/if}

        {#if menuConf['my-commissions']}
          <a href="/dashboard/my-commissions" class="nav-item" class:active={$page.url.pathname.startsWith('/dashboard/my-commissions')} title="Le Mie Provvigioni">
            <span class="nav-icon"><Award size={18} /></span>
            <span class="nav-label">Le Mie Provvigioni</span>
          </a>
        {/if}

        {#if menuConf['payments']}
          <a href="/dashboard/payments" class="nav-item" class:active={$page.url.pathname.startsWith('/dashboard/payments')} title="Gestione Incassi">
            <span class="nav-icon"><Wallet size={18} /></span>
            <span class="nav-label">Gestione Incassi</span>
          </a>
        {/if}

        {#if menuConf['commissions']}
          <a href="/dashboard/commissions" class="nav-item" class:active={$page.url.pathname.startsWith('/dashboard/commissions')} title="Gestione Provvigioni">
            <span class="nav-icon"><Award size={18} /></span>
            <span class="nav-label">Gestione Provvigioni</span>
          </a>
        {/if}

        {#if menuConf['products']}
          <a href="/dashboard/products" class="nav-item" class:active={$page.url.pathname.startsWith('/dashboard/products')} title="Catalogo Prodotti">
            <span class="nav-icon"><Tag size={18} /></span>
            <span class="nav-label">Catalogo Prodotti</span>
          </a>
        {/if}

        {#if menuConf['users']}
          <a href="/dashboard/users" class="nav-item" class:active={$page.url.pathname.startsWith('/dashboard/users')} title="Gestione Utenti">
            <span class="nav-icon"><Users size={18} /></span>
            <span class="nav-label">Gestione Utenti</span>
          </a>
        {/if}

        {#if menuConf['qualifications']}
          <a href="/dashboard/qualifications" class="nav-item" class:active={$page.url.pathname.startsWith('/dashboard/qualifications')} title="Gestione Qualifiche">
            <span class="nav-icon"><Award size={18} /></span>
            <span class="nav-label">Gestione Qualifiche</span>
          </a>
        {/if}

        {#if menuConf['settings']}
          <a href="/dashboard/settings" class="nav-item" class:active={$page.url.pathname === '/dashboard/settings'} title="Impostazioni">
            <span class="nav-icon"><Settings size={18} /></span>
            <span class="nav-label">Impostazioni</span>
          </a>
        {/if}
      {/if}

      <a href="/dashboard/profile" class="nav-item" class:active={$page.url.pathname.startsWith('/dashboard/profile')} title="Profilo">
        <span class="nav-icon"><Settings size={18} /></span>
        <span class="nav-label">Profilo</span>
      </a>
    </nav>

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
      {@render children()}
    </main>

    <!-- KPI Legend Floating Button -->
    <button class="floating-legend-btn" onclick={() => showLegend = true} title="Legenda KPI">
      <Info size={24} />
    </button>

    <!-- KPI Legend Modal -->
    {#if showLegend}
      <div class="legend-modal-overlay" onclick={() => showLegend = false} role="presentation">
        <div class="legend-modal" onclick={(e) => e.stopPropagation()} role="dialog">
          <div class="legend-header">
            <h3>Legenda KPI</h3>
            <button class="close-btn" onclick={() => showLegend = false} aria-label="Chiudi">
              <X size={20} />
            </button>
          </div>
          <div class="legend-body">
            {#each Object.entries(KPI_LEGEND) as [key, value]}
              <div class="legend-item">
                <span class="legend-key">{key}</span>
                <div class="legend-desc">
                  <strong>{value.label}</strong>
                  <p>{value.description}</p>
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

  .nav-menu {
    display: flex;
    flex-direction: column;
    gap: 6px;
    flex: 1;
  }

  .nav-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 14px;
    border-radius: 12px;
    color: var(--color-neutral-500);
    text-decoration: none;
    font-size: 14px;
    font-weight: 600;
    border: 1px solid transparent;
    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    white-space: nowrap;
  }

  .nav-item:hover {
    background: rgba(255, 255, 255, 0.6);
    color: var(--color-neutral-900);
    box-shadow: 0 4px 12px rgba(0,0,0,0.02);
  }

  .nav-item.active {
    background: var(--color-white);
    border-color: rgba(255, 255, 255, 0.9);
    color: var(--color-primary-600);
    box-shadow: 0 8px 24px rgba(0,0,0,0.04);
  }

  .nav-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    flex-shrink: 0;
  }

  .nav-label {
    transition: opacity var(--transition-speed);
  }

  .collapsed .nav-label {
    opacity: 0;
    pointer-events: none;
    width: 0;
    overflow: hidden;
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

    .floating-legend-btn {
      top: 16px;
      right: 70px;
    }

    .legend-modal {
      width: 90%;
      max-height: 80vh;
    }

    .toggle-btn {
      display: none;
    }
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
    .floating-legend-btn {
      right: 70px; /* Make space for mobile menu button */
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
</style>
