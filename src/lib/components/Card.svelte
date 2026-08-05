<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    title?: string;
    description?: string;
    variant?: 'default' | 'glass' | 'accent' | 'error';
    class?: string;
    style?: string;
    icon?: Snippet;
    headerSnippet?: Snippet;
    footerSnippet?: Snippet;
    children?: Snippet;
  }

  let {
    title,
    description,
    variant = 'default',
    class: className = '',
    style = '',
    icon,
    headerSnippet,
    footerSnippet,
    children
  }: Props = $props();
</script>

<div class="app-card card-variant-{variant} {className}" {style}>
  {#if title || description || headerSnippet || icon}
    <div class="card-header">
      <div class="header-main">
        {#if icon}
          <div class="card-icon-container">
            {@render icon()}
          </div>
        {/if}
        <div class="header-text">
          {#if title}
            <h3>{title}</h3>
          {/if}
          {#if description}
            <p>{description}</p>
          {/if}
        </div>
      </div>
      {#if headerSnippet}
        <div class="header-actions">
          {@render headerSnippet()}
        </div>
      {/if}
    </div>
  {/if}

  <div class="card-content">
    {#if children}
      {@render children()}
    {/if}
  </div>

  {#if footerSnippet}
    <div class="card-footer">
      {@render footerSnippet()}
    </div>
  {/if}
</div>

<style>
  .app-card {
    background: var(--color-surface);
    border: 1px solid var(--color-card-border);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-sm);
    padding: 24px;
    box-sizing: border-box;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
  }

  .app-card:hover {
    box-shadow: var(--shadow-md);
    border-color: var(--color-neutral-300);
  }

  /* Glassmorphism Variant */
  .app-card.card-variant-glass {
    background: var(--color-glass-bg);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid var(--color-glass-border);
  }
  
  .app-card.card-variant-glass:hover {
    background: rgba(255, 255, 255, 0.85);
    border-color: var(--color-primary-300);
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01);
  }

  /* Accent Variant (brand color stripe on left border) */
  .app-card.card-variant-accent {
    border-left: 4px solid var(--color-primary-500);
  }

  /* Error Variant (alert state) */
  .app-card.card-variant-error {
    border-left: 4px solid var(--color-red-500);
    background: #fef2f2;
    color: var(--color-error-text);
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
  }

  .header-main {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    flex: 1;
  }

  .card-icon-container {
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-primary-500);
    padding-top: 2px;
  }

  .header-text {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1;
  }

  .card-header h3 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: var(--color-neutral-800);
  }

  .card-header p {
    margin: 0;
    font-size: 13px;
    color: var(--color-neutral-500);
    line-height: 1.45;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .card-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .card-footer {
    display: flex;
    align-items: center;
    gap: 12px;
    border-top: 1px solid var(--color-neutral-100);
    padding-top: 16px;
    margin-top: auto;
  }
</style>
