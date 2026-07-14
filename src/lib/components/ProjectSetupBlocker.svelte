<script lang="ts">
  import { db, doc, setDoc } from '$lib/firebase';
  import { projectStore } from '$lib/stores/project';
  import { activeRoleState } from '$lib/auth.svelte';
  import { hasAccess } from '$lib/utils/authCheck';
  import Button from '$lib/components/Button.svelte';

  let projectName = $state('');
  let projectEmail = $state('');
  let saving = $state(false);
  let error = $state('');

  // Block only if missing name AND the user is an admin.
  // Wait, if projectEmail is missing, we block too.
  let needsSetup = $derived($projectStore && (!$projectStore.projectName || !$projectStore.projectEmail));
  let isAdmin = $derived(activeRoleState.role && hasAccess(activeRoleState.role, ['superadmin', 'amministrazione', 'direzione']));

  let showBlocker = $derived(needsSetup && isAdmin);

  async function saveSettings() {
    if (!projectName.trim() || !projectEmail.trim()) {
      error = "Tutti i campi sono obbligatori.";
      return;
    }
    saving = true;
    error = '';
    try {
      await setDoc(doc(db, 'settings', 'project'), {
        projectName: projectName.trim(),
        projectEmail: projectEmail.trim()
      }, { merge: true });
    } catch (e: any) {
      error = e.message || 'Errore nel salvataggio.';
    } finally {
      saving = false;
    }
  }
</script>

{#if showBlocker}
<div class="blocker-overlay animate-fade-in">
  <div class="blocker-modal">
    <div class="blocker-header">
      <h2>Configurazione Iniziale CRM</h2>
      <p>Benvenuto! Prima di iniziare, devi configurare i dettagli base della piattaforma. Questi dati verranno usati nelle email e in tutta l'interfaccia.</p>
    </div>

    {#if error}
      <div class="error-banner">{error}</div>
    {/if}

    <div class="form-group">
      <label for="projectName">Nome del Progetto / Azienda</label>
      <input type="text" id="projectName" bind:value={projectName} placeholder="es. Acme CRM" disabled={saving} />
    </div>

    <div class="form-group">
      <label for="projectEmail">Email di Sistema (No-Reply)</label>
      <input type="email" id="projectEmail" bind:value={projectEmail} placeholder="es. no-reply@acme.it" disabled={saving} />
    </div>

    <div class="blocker-footer">
      <Button variant="primary" onclick={saveSettings} disabled={saving || !projectName || !projectEmail} class="w-full">
        {saving ? 'Salvataggio...' : 'Salva e Inizia'}
      </Button>
    </div>
  </div>
</div>
{/if}

<style>
  .blocker-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(10px);
    z-index: 99999;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .blocker-modal {
    background: #ffffff;
    border-radius: 12px;
    padding: 32px;
    width: 100%;
    max-width: 480px;
    box-shadow: 0 20px 40px rgba(0,0,0,0.1);
    border: 1px solid var(--color-neutral-200);
  }

  .blocker-header h2 {
    margin: 0 0 12px 0;
    font-size: 24px;
    color: var(--color-neutral-800);
  }

  .blocker-header p {
    margin: 0 0 24px 0;
    font-size: 14px;
    color: var(--color-neutral-500);
    line-height: 1.5;
  }

  .error-banner {
    background: hsla(var(--error-h), var(--error-s), var(--error-l), 0.1);
    color: hsla(var(--error-h), var(--error-s), var(--error-l), 1);
    padding: 12px;
    border-radius: 8px;
    font-size: 14px;
    margin-bottom: 20px;
  }

  .form-group {
    margin-bottom: 20px;
  }

  .form-group label {
    display: block;
    margin-bottom: 8px;
    font-size: 14px;
    font-weight: 500;
    color: var(--color-neutral-700);
  }

  .form-group input {
    width: 100%;
    box-sizing: border-box;
    padding: 12px 16px;
    border: 1px solid var(--color-neutral-300);
    border-radius: 8px;
    font-size: 15px;
    font-family: inherit;
    transition: all 0.2s ease;
  }

  .form-group input:focus {
    outline: none;
    border-color: hsla(var(--brand-h), var(--brand-s), var(--brand-l), 1);
    box-shadow: 0 0 0 3px hsla(var(--brand-h), var(--brand-s), var(--brand-l), 0.15);
  }

  .blocker-footer {
    margin-top: 32px;
  }
</style>
