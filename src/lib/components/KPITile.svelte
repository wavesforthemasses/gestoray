<script lang="ts">
  import type { ComponentType } from 'svelte';
  import type { Icon } from '@lucide/svelte';

  interface Props {
    title: string;
    value: string | number;
    subtitle?: string;
    theme?: 'primary' | 'success' | 'warning' | 'error' | 'info' | 'teal' | 'indigo';
    icon?: any;
    onclick?: () => void;
    titleAttr?: string;
    isActive?: boolean;
    inlineSubtitle?: boolean;
  }

  let { 
    title, 
    value, 
    subtitle, 
    theme = 'primary', 
    icon: IconComponent, 
    onclick,
    titleAttr,
    isActive = false,
    inlineSubtitle = false
  }: Props = $props();
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div 
  class="kpi-tile border-{theme}" 
  class:clickable={!!onclick}
  class:active={isActive}
  title={titleAttr}
  onclick={onclick}
  role={onclick ? "button" : undefined}
  tabindex={onclick ? 0 : undefined}
  onkeydown={onclick ? (e) => { if(e.key==='Enter' || e.key===' ') onclick(); } : undefined}
>
  {#if IconComponent}
    <div class="kpi-icon {theme}">
      <IconComponent size={20} />
    </div>
  {/if}
  <div class="kpi-text">
    <span class="kpi-lbl">{title}</span>
    {#if inlineSubtitle}
      <div class="kpi-val-row">
        <span class="kpi-val">{value}</span>
        {#if subtitle}
          <span class="kpi-sub">{subtitle}</span>
        {/if}
      </div>
    {:else}
      <span class="kpi-val">{value}</span>
      {#if subtitle}
        <span class="kpi-sub">{subtitle}</span>
      {/if}
    {/if}
  </div>
</div>

<style>
  .kpi-tile {
    background: rgba(255, 255, 255, 0.7);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.5);
    border-radius: 16px;
    padding: 16px 20px;
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 16px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.02), inset 0 2px 0 rgba(255, 255, 255, 0.8);
    transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.3s ease;
    position: relative;
    overflow: hidden;
  }
  
  .kpi-tile.clickable {
    cursor: pointer;
  }

  .kpi-tile.active {
    box-shadow: 0 0 0 2px var(--color-primary-500);
    transform: translateY(-4px);
  }

  .kpi-tile::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 4px;
    background: linear-gradient(90deg, var(--color-primary-400), var(--color-primary-600));
    opacity: 0.8;
  }
  .kpi-tile.border-success::before { background: linear-gradient(90deg, var(--color-success-400), var(--color-success-600)); }
  .kpi-tile.border-warning::before { background: linear-gradient(90deg, var(--color-warning-400), var(--color-warning-600)); }
  .kpi-tile.border-error::before { background: linear-gradient(90deg, var(--color-error-400), var(--color-error-600)); }
  .kpi-tile.border-info::before { background: linear-gradient(90deg, var(--color-secondary-400), var(--color-secondary-600)); }
  .kpi-tile.border-teal::before { background: linear-gradient(90deg, var(--color-primary-300), var(--color-primary-500)); }
  .kpi-tile.border-indigo::before { background: linear-gradient(90deg, var(--color-secondary-500), var(--color-secondary-700)); }

  .kpi-tile:hover {
    transform: translateY(-4px);
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.06), inset 0 2px 0 rgba(255, 255, 255, 0.9);
  }

  .kpi-icon {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    background: linear-gradient(135deg, var(--color-primary-100), var(--color-primary-200));
    color: var(--color-primary-700);
    box-shadow: 0 4px 12px rgba(0,0,0,0.06);
  }
  .kpi-tile.border-success .kpi-icon { background: linear-gradient(135deg, var(--color-success-100), var(--color-success-200)); color: var(--color-success-800); }
  .kpi-tile.border-warning .kpi-icon { background: linear-gradient(135deg, var(--color-warning-100), var(--color-warning-200)); color: var(--color-warning-800); }
  .kpi-tile.border-error .kpi-icon { background: linear-gradient(135deg, var(--color-error-100), var(--color-error-200)); color: var(--color-error-800); }
  .kpi-tile.border-info .kpi-icon { background: linear-gradient(135deg, var(--color-secondary-100), var(--color-secondary-200)); color: var(--color-secondary-800); }
  .kpi-tile.border-teal .kpi-icon { background: linear-gradient(135deg, var(--color-primary-50), var(--color-primary-100)); color: var(--color-primary-600); }
  .kpi-tile.border-indigo .kpi-icon { background: linear-gradient(135deg, var(--color-secondary-200), var(--color-secondary-300)); color: var(--color-secondary-900); }

  .kpi-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
  }

  .kpi-lbl {
    font-size: 11.5px;
    font-weight: 700;
    color: var(--color-neutral-500);
    letter-spacing: 0.02em;
    text-transform: uppercase;
  }

  .kpi-val-row {
    display: flex;
    align-items: baseline;
    gap: 8px;
    flex-wrap: wrap;
  }

  .kpi-val {
    font-size: 20px;
    font-weight: 800;
    color: var(--color-neutral-900);
    line-height: 1.1;
    letter-spacing: -0.02em;
  }

  .kpi-sub {
    font-size: 11px;
    color: var(--color-neutral-400);
    font-weight: 500;
  }
</style>
