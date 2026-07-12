<script lang="ts">
  import { auth } from '$lib/auth';
  import ProfileSettings from './components/ProfileSettings.svelte';

  function handleUpdateSuccess(updatedAuth: any) {
    auth.set(updatedAuth);
  }
</script>

<svelte:head>
  <title>Il Mio Profilo | Gestoray</title>
</svelte:head>

<div class="profile-container animate-fade-in">
  {#if $auth}
    <ProfileSettings 
      authStore={$auth} 
      onUpdateSuccess={handleUpdateSuccess} 
    />
  {/if}
</div>

<style>
  .profile-container {
    width: 100%;
  }

  .animate-fade-in {
    animation: fadeIn 0.3s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  }
</style>
