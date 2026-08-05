<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { db, doc, getDoc, setDoc } from '$lib/firebase';
  import { activeRoleState } from '$lib/auth.svelte';
  import { hasAccess } from '$lib/utils/authCheck';
  import { toast } from '$lib/stores/toast.svelte';
  import { Card, FormField, Button } from '$lib';
  import { pageTitle } from '$lib/stores/page';
  pageTitle.set('Configurazione Progetto');
  import { ArrowLeft, AlertTriangle } from '@lucide/svelte';

  let projectName = $state('');
  let projectEmail = $state('');
  let resendApiKey = $state('');
  let enableHistoryLogs = $state(true);
  let loading = $state(true);
  let submitting = $state(false);

  $effect(() => {
    const currentRole = activeRoleState.role;
    if (currentRole && !hasAccess(currentRole, ['superadmin'])) {
      goto('/dashboard');
    }
  });

  onMount(async () => {
    try {
      const docRef = doc(db, 'settings', 'project');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        projectName = data.projectName || '';
        projectEmail = data.projectEmail || '';
        resendApiKey = data.resendApiKey || '';
        enableHistoryLogs = data.enableHistoryLogs !== false; // Default true
      }
    } catch (e: any) {
      toast.error('Errore durante il caricamento delle impostazioni: ' + e.message);
    } finally {
      loading = false;
    }
  });

  async function handleSubmit(e: Event) {
    e.preventDefault();
    submitting = true;
    try {
      const docRef = doc(db, 'settings', 'project');
      await setDoc(docRef, {
        projectName,
        projectEmail,
        resendApiKey,
        enableHistoryLogs,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      toast.success('Impostazioni di progetto salvate con successo');
    } catch (e: any) {
      toast.error('Errore durante il salvataggio: ' + e.message);
    } finally {
      submitting = false;
    }
  }
</script>

<div class="project-settings-page animate-fade-in">
  <Card title="Configurazione Progetto" description="Modifica il nome del progetto, l'email aziendale principale ed integra le API di notifica per Resend." class="settings-card">
    {#snippet headerSnippet()}
      <a href="/dashboard/settings" class="back-link">
        <ArrowLeft size={14} /> Torna a Impostazioni
      </a>
    {/snippet}

    {#if loading}
      <p class="loading-text">Caricamento impostazioni...</p>
    {:else}
      <form onsubmit={handleSubmit} class="settings-form">
        <FormField id="projectName" label="Nome Progetto / Ragione Sociale">
          <input
            id="projectName"
            type="text"
            bind:value={projectName}
            placeholder="Acme S.r.l."
            required
          />
        </FormField>

        <FormField id="projectEmail" label="Email Aziendale di Contatto">
          <input
            id="projectEmail"
            type="email"
            bind:value={projectEmail}
            placeholder="info@azienda.it"
            required
          />
        </FormField>

        <FormField id="resendApiKey" label="API Key Resend (Email Transazionali)">
          <input
            id="resendApiKey"
            type="password"
            bind:value={resendApiKey}
            placeholder="re_xxxxxxxxxxxxxx"
          />

          {#if !resendApiKey}
            <div class="alert warning warning-box">
              <AlertTriangle size={16} /> <strong>Nessuna API Key inserita.</strong> L'invio reale delle email (ad es. i PIN d'accesso) è disattivato. I codici PIN verranno salvati solo nei log.
            </div>
          {/if}
        </FormField>

        <div class="checkbox-group privacy-settings mt-6">
          <label class="checkbox-container">
            <input type="checkbox" bind:checked={enableHistoryLogs} />
            <span class="checkbox-label">
              <strong>Abilita Log di Modifica (History)</strong>
              <p class="checkbox-desc">Quando attivo, il sistema registra le variazioni sui dati per fini di audit. Disattivare questa voce impedirà al sistema di scrivere la cronologia delle modifiche.</p>
            </span>
          </label>
        </div>

        <div class="form-actions">
          <Button variant="primary" type="submit" disabled={submitting}>
            {submitting ? 'Salvataggio in corso...' : 'Salva Modifiche'}
          </Button>
        </div>
      </form>
    {/if}
  </Card>
</div>

<style>
  .project-settings-page {
    width: 100%;
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
  .action-link {
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: transparent;
    border: none;
    color: var(--color-neutral-500);
    padding: 0;
    cursor: pointer;
    font-family: inherit;
    font-size: 14px;
    font-weight: 600;
    transition: color 0.2s;
  }
  .action-link:hover {
    color: var(--color-neutral-800);
  }
  .warning-box {
    margin-top: -8px;
    font-size: 13px;
    color: #b45309;
    background: #fef3c7;
    padding: 8px 12px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .mt-6 { margin-top: 24px; }
  .checkbox-group {
    background: var(--color-neutral-50);
    padding: 16px;
    border-radius: var(--radius-md);
    border: 1px solid var(--color-neutral-200);
  }
  .checkbox-container {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    cursor: pointer;
  }
  .checkbox-container input {
    margin-top: 4px;
    cursor: pointer;
  }
  .checkbox-desc {
    margin: 4px 0 0 0;
    font-size: 13px;
    color: var(--color-neutral-500);
    line-height: 1.4;
  }
</style>
