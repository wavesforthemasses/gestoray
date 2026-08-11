<script lang="ts">
  import { page } from '$app/stores';
  import { LayoutDashboard, FileText, Settings } from '@lucide/svelte';
  import { iconMap } from '$lib/utils/iconMap';

  interface MenuItem {
    id: string;
    label: string;
    path: string;
    icon: string;
    rolesView: string[];
    matchExact?: boolean;
    showInSidebar?: boolean;
  }

  interface Props {
    activeRole: string;
    menuConfig: MenuItem[];
    badges: Record<string, number>;
  }

  let { activeRole, menuConfig = [], badges = {} }: Props = $props();
</script>

<nav class="nav-menu">
  {#if activeRole}
    <a href="/dashboard" class="nav-item" class:active={$page.url.pathname === '/dashboard'} title="Dashboard">
      <span class="nav-icon"><LayoutDashboard size={18} /></span>
      <span class="nav-label">Dashboard</span>
    </a>

    {#each menuConfig.filter(item => item.rolesView.includes(activeRole || '') && item.showInSidebar !== false) as item (item.id)}
      {@const IconComponent = iconMap[item.icon] || FileText}
      <a href={item.path} class="nav-item" 
         class:active={item.matchExact ? $page.url.pathname === item.path : $page.url.pathname.startsWith(item.path)} 
         title={item.label}>
        <span class="nav-icon"><IconComponent size={18} /></span>
        <span class="nav-label">{item.label}</span>
        {#if badges[item.id] && badges[item.id] > 0}
          <span class="nav-badge">{badges[item.id]}</span>
        {/if}
      </a>
    {/each}
  {/if}

  <a href="/dashboard/profile" class="nav-item" class:active={$page.url.pathname.startsWith('/dashboard/profile')} title="Profilo">
    <span class="nav-icon"><Settings size={18} /></span>
    <span class="nav-label">Profilo</span>
  </a>
</nav>

<style>
  .nav-menu {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 12px 8px;
    flex: 1;
    overflow-y: auto;
  }
  .nav-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    color: var(--color-neutral-600);
    text-decoration: none;
    font-size: 14px;
    font-weight: 500;
    border-radius: var(--radius-md);
    transition: all 0.15s ease;
    white-space: nowrap;
  }
  .nav-item:hover {
    background: var(--color-neutral-100);
    color: var(--color-neutral-900);
  }
  .nav-item.active {
    background: var(--color-primary-50);
    color: var(--color-primary-600);
    font-weight: 600;
  }
  .nav-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .nav-label {
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .nav-badge {
    background: var(--color-error);
    color: white;
    font-size: 11px;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: 99px;
    white-space: nowrap;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 18px;
    margin-left: auto;
    flex-shrink: 0;
  }
</style>
