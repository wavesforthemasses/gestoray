<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { db, doc, getDoc, setDoc } from '$lib/firebase';
  import { activeRole } from '$lib/auth';
  import { hasAccess } from '$lib/utils/authCheck';
  import { toast } from '$lib/stores/toast.svelte';
  import { Card, FormField, Button } from '$lib';
  import { pageTitle } from '$lib/stores/page';
  pageTitle.set('Configurazione Progetto');
  import { ArrowLeft } from '@lucide/svelte';

  let projectName = $state('');
  let projectEmail = $state('');
  let resendApiKey = $state('');
  let loading = $state(true);
  let submitting = $state(false);

  onMount(() => {
    const unsubscribe = activeRole.subscribe(($activeRole) => {
      if ($activeRole && !hasAccess($activeRole, ['superadmin', 'amministrazione', 'direzione'])) {
        goto('/dashboard/settings');
      }
    });

    loadSettings();

    return () => unsubscribe();
  });

  async function loadSettings() {
    try {
      const docSnap = await getDoc(doc(db, 'settings', 'project'));
      if (docSnap.exists()) {
        const data = docSnap.data();
        projectName = data.projectName || '';
        projectEmail = data.projectEmail || '';
        resendApiKey = data.resendApiKey || '';
      }
    } catch (e: any) {
      toast.error("Errore nel caricamento delle impostazioni.");
    } finally {
      loading = false;
    }
  }

  async function saveSettings(e: Event) {
    e.preventDefault();
    if (!projectName.trim() || !projectEmail.trim()) {
      toast.error('Tutti i campi sono obbligatori.');
      return;
    }
    
    submitting = true;
    try {
      await setDoc(doc(db, 'settings', 'project'), {
        projectName: projectName.trim(),
        projectEmail: projectEmail.trim(),
        resendApiKey: resendApiKey.trim()
      }, { merge: true });
      
      toast.success('Impostazioni di progetto salvate con successo.');
    } catch (err: any) {
      toast.error(err.message || 'Errore durante il salvataggio.');
    } finally {
      submitting = false;
    }
  }
</script>

<div class="project-settings-page animate-fade-in">
  <div class="page-top-actions">
    <button onclick={() => goto('/dashboard/settings')} class="back-link-btn">
      <ArrowLeft size={16} /> Torna a Impostazioni
    </button>
    <h2 class="title-header">Configurazione Progetto</h2>
  </div>

  {#if loading}
    <div class="loading-box">
      <span class="spinner"></span>
      Caricamento...
    </div>
  {:else}
    <Card title="Dettagli Piattaforma" description="Modifica il nome del CRM e l'email mittente globale.">
      <form onsubmit={saveSettings} class="project-form">
        <FormField 
          id="projectName"
          label="Nome Progetto / Azienda"
          type="text"
          bind:value={projectName}
          placeholder="es. Acme CRM"
          required
        />

        <FormField 
          id="projectEmail"
          label="Email Mittente (No-Reply)"
          type="email"
          bind:value={projectEmail}
          placeholder="es. no-reply@acme.it"
          required
        />

        <FormField 
          id="resendApiKey"
          label="API Key (Resend) - Opzionale"
          type="password"
          bind:value={resendApiKey}
          placeholder="re_xxxxxxxxxxxxxx"
        />

        {#if !resendApiKey}
          <div class="alert warning" style="margin-top: -8px; font-size: 13px; color: #b45309; background: #fef3c7; padding: 8px 12px; border-radius: 6px;">
            ⚠️ <strong>Nessuna API Key inserita.</strong> L'invio reale delle email (ad es. i PIN d'accesso) è disattivato. I codici PIN verranno salvati solo nei log.
          </div>
        {/if}

        <div class="form-actions">
          <Button variant="primary" type="submit" disabled={submitting}>
            {submitting ? 'Salvataggio in corso...' : 'Salva Modifiche'}
          </Button>
        </div>
      </form>
    </Card>
  {/if}
</div>

<style>
  .project-settings-page {
    max-width: 800px;
    margin: 0 auto;
    padding: 24px 0;
  }
  .page-top-actions {
    margin-bottom: 24px;
  }
  .title-header {
    margin: 12px 0 0 0;
    font-size: 24px;
    font-weight: 600;
    color: var(--color-neutral-800);
  }
  .project-form {
    display: flex;
    flex-direction: column;
    gap: 16px;
    margin-top: 16px;
  }
  .form-actions {
    margin-top: 16px;
    display: flex;
    justify-content: flex-end;
  }
</style>
