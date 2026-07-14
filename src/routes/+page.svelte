<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { authState } from '$lib/auth.svelte';
  import { projectStore } from '$lib/stores/project';

  $effect(() => {
    if (authState.user) {
      goto('/dashboard');
    } else if (authState.user === null) {
      goto('/login');
    }
  });
</script>

<svelte:head>
  <title>{$projectStore?.projectName || 'CRM'}</title>
</svelte:head>

<div class="homepage-redirect-loader">
  <div class="spinner"></div>
  <p>Reindirizzamento in corso...</p>
</div>

<style>
  .homepage-redirect-loader {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    gap: 16px;
    font-family: 'Outfit', sans-serif;
    color: var(--color-neutral-600);
    background-color: var(--color-neutral-50);
  }

  .spinner {
    width: 28px;
    height: 28px;
    border: 3px solid hsla(var(--brand-h), var(--brand-s), var(--brand-l), 0.15);
    border-radius: 50%;
    border-top-color: var(--color-primary-500);
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>
