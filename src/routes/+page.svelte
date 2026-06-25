<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { auth } from '$lib/auth';

  onMount(() => {
    const unsubscribe = auth.subscribe(($auth) => {
      if ($auth) {
        goto('/dashboard');
      } else {
        goto('/login');
      }
    });
    return () => unsubscribe();
  });
</script>

<svelte:head>
  <title>Gestoray</title>
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
    border: 3px solid hsla(var(--brand-h), var(--brand-s), 50%, 0.15);
    border-radius: 50%;
    border-top-color: var(--color-primary-500);
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>
