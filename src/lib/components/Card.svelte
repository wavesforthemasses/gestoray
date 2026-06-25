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

<div class="gestoray-card card-variant-{variant} {className}" {style}>
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
  .gestoray-card {
    background-color: var(--card-bg, var(--color-white));
    border: var(--card-border, 1px solid var(--color-neutral-200));
    border-radius: var(--card-radius, var(--radius-lg));
    padding: var(--card-padding, 30px);
    box-shadow: var(--card-shadow, var(--shadow-md));
    display: flex;
    flex-direction: column;
    gap: 20px;
    transition: transform var(--transition-normal), box-shadow var(--transition-normal), border-color var(--transition-normal), background-color var(--transition-normal);
  }

  .gestoray-card:hover {
    box-shadow: var(--card-shadow-hover, var(--shadow-lg));
  }

  /* Glassmorphism Variant */
  .gestoray-card.card-variant-glass {
    background-color: var(--card-bg, var(--color-glass-bg));
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: var(--card-border, 1px solid var(--color-glass-border));
    box-shadow: var(--card-shadow, var(--color-glass-shadow));
  }
  
  .gestoray-card.card-variant-glass:hover {
    background-color: var(--card-bg-hover, var(--color-glass-bg-hover));
    border-color: hsla(var(--brand-h), var(--brand-s), 50%, 0.2);
    box-shadow: 0 12px 40px 0 rgba(0, 0, 0, 0.04);
  }

  /* Accent Variant (brand color stripe on left border) */
  .gestoray-card.card-variant-accent {
    border-left: 4px solid var(--color-primary-500);
  }

  /* Error Variant (alert state) */
  .gestoray-card.card-variant-error {
    border-color: var(--color-error-border);
    background-color: var(--color-error-light);
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
