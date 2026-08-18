<script lang="ts">
  import { projectStore } from '$lib/stores/project';
  import { onMount } from 'svelte';
  import { 
    TicketSettingsService, 
    type TicketSettingsConfig, 
    type TicketCategoryConfig, 
    type CannedResponseConfig,
    DEFAULT_TICKET_SETTINGS
  } from '$lib/services/ticketSettings';
  import { toast } from '$lib/stores/toast.svelte';
  import { Settings, Tag, Key, Save, Plus, X } from '@lucide/svelte';

  let config = $state<TicketSettingsConfig>({ ...DEFAULT_TICKET_SETTINGS });

  let loading = $state(true);
  let saving = $state(false);
  let newCatLabel = $state('');

  onMount(async () => {
    try {
      const data = await TicketSettingsService.getSettings();
      if (data) {
        config = data;
      }
    } catch (e: any) {
      toast.error('Errore caricamento impostazioni ticket');
    } finally {
      loading = false;
    }
  });

  async function handleSave() {
    saving = true;
    try {
      await TicketSettingsService.saveSettings(config);
      toast.success('Impostazioni ticket salvate con successo');
    } catch (e: any) {
      toast.error('Errore durante il salvataggio');
    } finally {
      saving = false;
    }
  }

  function addCategory() {
    if (!newCatLabel.trim()) return;
    const id = newCatLabel.trim().toLowerCase().replace(/\s+/g, '_');
    if (config.categories.some(c => c.id === id)) {
      toast.error('Categoria già esistente');
      return;
    }
    config.categories.push({ id, label: newCatLabel.trim(), enabled: true });
    newCatLabel = '';
  }

  function removeCategory(id: string) {
    config.categories = config.categories.filter(c => c.id !== id);
  }
</script>

<svelte:head>
  <title>Impostazioni Ticket Assistenza | {$projectStore?.projectName || 'ERP'}</title>
</svelte:head>

<div class="ticket-settings-page animate-fade-in">
  <div class="page-top">
    <a href="/dashboard/settings" class="btn-module-list" title="Vai a Impostazioni" aria-label="Vai a Impostazioni">
      <Settings size={20} />
    </a>
    <h2 class="title-header">
      <Settings size={24} /> Configurazione Helpdesk & Ticket Assistenza
    </h2>
  </div>

  {#if loading}
    <div class="loader-box">
      <span class="spinner"></span>
      Caricamento in corso...
    </div>
  {:else}
    <div class="card form-card mb-24">
      <h3 class="card-title"><Tag size={18} /> Categorie di Supporto</h3>
      <p class="card-subtitle">Personalizza le opzioni di classificazione dei ticket per i tuoi clienti.</p>

      <div class="categories-list mb-16">
        {#each config.categories as c}
          <div class="category-pill">
            <span>{c.label}</span>
            <button type="button" onclick={() => removeCategory(c.id)} class="btn-remove" aria-label="Rimuovi categoria">
              <X size={12} />
            </button>
          </div>
        {/each}
      </div>

      <div class="add-cat-bar">
        <input type="text" bind:value={newCatLabel} placeholder="Nuova Categoria (es. Fatturazione)" class="form-control" />
        <button type="button" onclick={addCategory} class="btn-add">
          <Plus size={16} /> Aggiungi
        </button>
      </div>
    </div>

    <div class="card form-card mb-24">
      <h3 class="card-title"><Key size={18} /> Webhook Token (Inbound Email)</h3>
      <p class="card-subtitle">Token di autenticazione per l'importazione automatica delle email via Webhook.</p>
      <input type="text" bind:value={config.inboundWebhookToken} placeholder="Token segreto webhook..." class="form-control" />
    </div>

    <div class="form-actions-bar">
      <button type="button" onclick={handleSave} disabled={saving} class="btn-submit">
        <Save size={16} /> {saving ? 'Salvataggio...' : 'Salva Impostazioni Helpdesk'}
      </button>
    </div>
  {/if}
</div>

<style>
  .ticket-settings-page { width: 100%; box-sizing: border-box; }
  .page-top { margin-bottom: 20px; }
  .back-link { display: inline-flex; align-items: center; gap: 6px; color: var(--color-neutral-600); text-decoration: none; font-size: 13px; font-weight: 600; margin-bottom: 10px; }
  .back-link:hover { color: var(--color-neutral-900); }
  .title-header { display: flex; align-items: center; gap: 10px; margin: 0; font-size: 22px; font-weight: 700; color: var(--color-neutral-900); }

  .form-card { background: white; border: 1px solid var(--color-neutral-200); border-radius: var(--radius-lg); padding: 24px; box-shadow: var(--shadow-sm); }
  .card-title { display: flex; align-items: center; gap: 8px; margin: 0 0 4px 0; font-size: 16px; font-weight: 600; color: var(--color-neutral-800); }
  .card-subtitle { margin: 0 0 16px 0; font-size: 13px; color: var(--color-neutral-500); }
  .mb-24 { margin-bottom: 24px; }
  .mb-16 { margin-bottom: 16px; }

  .categories-list { display: flex; flex-wrap: wrap; gap: 8px; }
  .category-pill { background: var(--color-neutral-100); border: 1px solid var(--color-neutral-300); padding: 6px 12px; border-radius: 16px; font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 6px; }
  .btn-remove { background: none; border: none; cursor: pointer; color: var(--color-neutral-500); display: flex; align-items: center; justify-content: center; padding: 2px; }
  .btn-remove:hover { color: #b91c1c; }

  .add-cat-bar { display: flex; gap: 12px; }
  .form-control { padding: 10px 14px; font-size: 14px; border: 1px solid var(--color-neutral-300); border-radius: var(--radius-md); outline: none; width: 100%; box-sizing: border-box; }
  .btn-add { display: inline-flex; align-items: center; gap: 6px; padding: 10px 18px; font-weight: 600; background: var(--color-neutral-800); color: white; border: none; border-radius: var(--radius-md); cursor: pointer; white-space: nowrap; }

  .form-actions-bar { display: flex; justify-content: flex-end; }
  .btn-submit { display: inline-flex; align-items: center; gap: 8px; padding: 12px 28px; font-size: 14px; font-weight: 700; color: white; background: var(--color-primary-600); border: none; border-radius: var(--radius-md); cursor: pointer; transition: background 0.2s; }
  .btn-submit:hover { background: var(--color-primary-700); }
  .loader-box { padding: 40px; text-align: center; color: var(--color-neutral-500); }
</style>
