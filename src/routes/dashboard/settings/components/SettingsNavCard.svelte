<script lang="ts">
  import { ChevronRight } from '@lucide/svelte';

  interface Props {
    href: string;
    title: string;
    description: string;
    icon: any; // Lucide icon component
  }

  let { href, title, description, icon: Icon } = $props();
</script>

<a {href} class="settings-card">
  <div class="card-icon">
    <Icon size={24} />
  </div>
  <div class="card-content">
    <h3>{title}</h3>
    <p>{description}</p>
  </div>
  <div class="card-action">
    <ChevronRight size={20} />
  </div>
</a>

<style>
  .settings-card {
    display: flex;
    align-items: center;
    gap: 16px;
    background: var(--color-white);
    border: 1px solid var(--color-neutral-200);
    border-radius: var(--radius-lg);
    padding: 20px;
    text-decoration: none;
    color: inherit;
    transition: all 0.2s ease;
    box-shadow: 0 2px 4px rgba(0,0,0,0.02);
  }
  .settings-card:hover {
    border-color: var(--color-primary-300);
    box-shadow: 0 4px 12px rgba(var(--brand-h), var(--brand-s), var(--brand-l), 0.1);
    transform: translateY(-2px);
  }
  
  .card-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    background: var(--color-primary-50);
    color: var(--color-primary-600);
    border-radius: var(--radius-md);
    flex-shrink: 0;
  }
  
  .card-content {
    flex: 1;
  }
  .card-content h3 {
    margin: 0 0 4px 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--color-neutral-800);
  }
  .card-content p {
    margin: 0;
    font-size: 13px;
    color: var(--color-neutral-500);
    line-height: 1.4;
  }
  
  .card-action {
    color: var(--color-neutral-400);
    transition: transform 0.2s ease, color 0.2s ease;
  }
  .settings-card:hover .card-action {
    transform: translateX(4px);
    color: var(--color-primary-600);
  }
</style>
