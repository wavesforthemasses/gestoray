<script lang="ts">
  import { page } from '$app/stores';
  import { auth, activeRole } from '$lib/auth';
  import { auth as clientAuth } from '$lib/firebase';
  import { signOut as clientSignOut } from '$lib/firebase';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { LayoutDashboard, Users, Settings, LogOut, Menu, ChevronLeft, ChevronRight, Briefcase, Tag, FileText, Wallet, ClipboardList } from '@lucide/svelte';

  let { children } = $props();

  let isCollapsed = $state(false);
  let isMobileOpen = $state(false);

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

<div class="dashboard-shell" class:collapsed={isCollapsed} class:mobile-open={isMobileOpen}>
  <!-- Backdrop for mobile drawer -->
  {#if isMobileOpen}
    <div class="sidebar-backdrop" onclick={() => isMobileOpen = false} role="presentation"></div>
  {/if}

  <aside class="sidebar">
    <div class="sidebar-header">
      {#if !isCollapsed}
        <img src="/logo.png" alt="Gestoray Logo" class="sidebar-logo" />
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
      <a href="/dashboard" class="nav-item" class:active={$page.url.pathname === '/dashboard'} title="Dashboard">
        <span class="nav-icon"><LayoutDashboard size={18} /></span>
        <span class="nav-label">Dashboard</span>
      </a>

      {#if $activeRole === 'commerciale' || $activeRole === 'superadmin'}
        <a href="/dashboard/clients" class="nav-item" class:active={$page.url.pathname.startsWith('/dashboard/clients')} title="Gestione Clienti">
          <span class="nav-icon"><Briefcase size={18} /></span>
          <span class="nav-label">Gestione Clienti</span>
        </a>
      {/if}

      {#if $activeRole === 'commerciale' || $activeRole === 'amministrazione' || $activeRole === 'superadmin'}
        <a href="/dashboard/activities" class="nav-item" class:active={$page.url.pathname.startsWith('/dashboard/activities')} title="Gestione Attività">
          <span class="nav-icon"><ClipboardList size={18} /></span>
          <span class="nav-label">Gestione Attività</span>
        </a>
        <a href="/dashboard/contracts" class="nav-item" class:active={$page.url.pathname.startsWith('/dashboard/contracts')} title="Gestione Contratti">
          <span class="nav-icon"><FileText size={18} /></span>
          <span class="nav-label">Gestione Contratti</span>
        </a>
      {/if}

      {#if $activeRole === 'amministrazione' || $activeRole === 'superadmin'}
        <a href="/dashboard/payments" class="nav-item" class:active={$page.url.pathname.startsWith('/dashboard/payments')} title="Gestione Incassi">
          <span class="nav-icon"><Wallet size={18} /></span>
          <span class="nav-label">Gestione Incassi</span>
        </a>
        <a href="/dashboard/products" class="nav-item" class:active={$page.url.pathname.startsWith('/dashboard/products')} title="Catalogo Prodotti">
          <span class="nav-icon"><Tag size={18} /></span>
          <span class="nav-label">Catalogo Prodotti</span>
        </a>
      {/if}

      {#if $activeRole === 'superadmin'}
        <a href="/dashboard/users" class="nav-item" class:active={$page.url.pathname.startsWith('/dashboard/users')} title="Gestione Utenti">
          <span class="nav-icon"><Users size={18} /></span>
          <span class="nav-label">Gestione Utenti</span>
        </a>
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
    <header class="navbar">
      <div class="navbar-left">
        <button onclick={() => isMobileOpen = !isMobileOpen} class="mobile-menu-btn" aria-label="Apri menu">
          <Menu size={20} />
        </button>
        <div class="navbar-title">
          {#if $page.url.pathname === '/dashboard'}
            <h3>Panoramica</h3>
          {:else if $page.url.pathname.startsWith('/dashboard/users')}
            <h3>Elenco Utenti</h3>
          {:else if $page.url.pathname.startsWith('/dashboard/profile')}
            <h3>Mio Profilo</h3>
          {:else if $page.url.pathname.startsWith('/dashboard/clients/')}
            <h3>Dettaglio Cliente</h3>
          {:else if $page.url.pathname.startsWith('/dashboard/clients')}
            <h3>Gestione Clienti</h3>
          {:else if $page.url.pathname.startsWith('/dashboard/activities')}
            <h3>Gestione Attività</h3>
          {:else if $page.url.pathname.startsWith('/dashboard/contracts/')}
            <h3>Dettaglio Contratto</h3>
          {:else if $page.url.pathname.startsWith('/dashboard/contracts')}
            <h3>Gestione Contratti</h3>
          {:else if $page.url.pathname.startsWith('/dashboard/payments')}
            <h3>Gestione Incassi</h3>
          {:else if $page.url.pathname.startsWith('/dashboard/products')}
            <h3>Catalogo Prodotti</h3>
          {/if}
        </div>
      </div>
      <div class="navbar-actions">
        <div class="navbar-status">
          <span class="status-indicator online"></span>
          <span class="status-text">Simulazione Locale Attiva</span>
        </div>
        <img src="/logo.png" alt="Gestoray Logo" class="navbar-logo-mobile" />
      </div>
    </header>

    <main class="content-viewport">
      {@render children()}
    </main>
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
    background-color: rgba(255, 255, 255, 0.72);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border-right: 1px solid var(--color-glass-border);
    box-shadow: 4px 0 24px rgba(15, 23, 42, 0.02);
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
    background: var(--color-white);
    border: 1px solid var(--color-neutral-300);
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
    background: var(--color-neutral-100);
    color: var(--color-neutral-800);
  }

  .collapsed-toggle {
    margin: 0 auto;
  }

  .user-card {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    background: var(--color-neutral-50);
    border: 1px solid var(--color-neutral-200);
    border-radius: var(--radius-md);
    padding: 12px;
    margin-bottom: 25px;
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
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: linear-gradient(135deg, var(--color-primary-500), var(--color-primary-600));
    color: white;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    box-shadow: 0 4px 10px hsla(var(--brand-h), var(--brand-s), 50%, 0.15);
    flex-shrink: 0;
  }

  .user-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    overflow: hidden;
    width: calc(100% - 48px);
  }

  .user-name {
    font-size: 13px;
    font-weight: 600;
    color: var(--color-neutral-800);
    white-space: nowrap;
    text-overflow: ellipsis;
    overflow: hidden;
  }

  .role-badge {
    font-size: 10px;
    font-weight: 600;
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
    background: var(--color-white);
    border: 1px solid var(--color-neutral-300);
    border-radius: var(--radius-sm);
    color: var(--color-neutral-800);
    font-family: inherit;
    font-size: 11px;
    font-weight: 600;
    padding: 4px 8px;
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
  }

  .role-select:hover {
    border-color: var(--color-primary-400);
    background-color: var(--color-neutral-50);
  }

  .role-select:focus {
    border-color: var(--color-primary-500);
    box-shadow: 0 0 0 2px hsla(var(--brand-h), var(--brand-s), 50%, 0.15);
  }

  .nav-menu {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1;
  }

  .nav-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 14px;
    border-radius: var(--radius-md);
    color: var(--color-neutral-500);
    text-decoration: none;
    font-size: 14px;
    font-weight: 500;
    border: 1px solid transparent;
    transition: all var(--transition-fast);
    white-space: nowrap;
  }

  .nav-item:hover {
    background: var(--color-neutral-50);
    color: var(--color-neutral-800);
  }

  .nav-item.active {
    background: var(--color-neutral-50);
    border-color: var(--color-neutral-200);
    color: var(--color-primary-600);
    font-weight: 600;
    box-shadow: var(--shadow-sm);
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

  .navbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 18px 40px;
    background: rgba(255, 255, 255, 0.8);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    border-bottom: 1px solid var(--color-neutral-200);
    z-index: 10;
  }

  .navbar-left {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .mobile-menu-btn {
    display: none;
    background: none;
    border: none;
    color: var(--color-neutral-600);
    cursor: pointer;
    padding: 4px;
    align-items: center;
    justify-content: center;
  }

  .navbar-title h3 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: var(--color-neutral-800);
  }

  .navbar-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .navbar-status {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .navbar-logo-mobile {
    display: none;
    height: 28px;
    width: auto;
    object-fit: contain;
  }

  .status-indicator {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  .status-indicator.online {
    background-color: var(--color-success);
    box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4);
    animation: pulse-indicator 2s infinite;
  }

  @keyframes pulse-indicator {
    0% {
      transform: scale(0.95);
      box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
    }
    70% {
      transform: scale(1);
      box-shadow: 0 0 0 6px rgba(16, 185, 129, 0);
    }
    100% {
      transform: scale(0.95);
      box-shadow: 0 0 0 0 rgba(16, 185, 129, 0);
    }
  }

  .status-text {
    font-size: 12px;
    color: var(--color-neutral-500);
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

    .mobile-menu-btn {
      display: flex;
    }

    .navbar {
      padding: 16px 20px;
    }

    .content-viewport {
      padding: 20px;
    }

    .toggle-btn {
      display: none;
    }

    .navbar-status {
      display: none;
    }

    .navbar-logo-mobile {
      display: block;
    }
  }
</style>
