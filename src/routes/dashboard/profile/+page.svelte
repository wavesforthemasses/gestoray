<script lang="ts">
  import { authState } from '$lib/auth.svelte';
  import ProfileSettings from './components/ProfileSettings.svelte';
  import { pageTitle } from '$lib/stores/page';
  pageTitle.set('Il Mio Profilo');

  function handleUpdateSuccess(updatedAuth: any) {
    authState.user = updatedAuth;
  }
</script>



<div class="profile-container animate-fade-in">
  {#if authState.user}
    <ProfileSettings 
      authStore={authState.user} 
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
