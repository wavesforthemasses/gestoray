<script lang="ts">
  import { onMount } from 'svelte';
  import { 
    TicketSettingsService, 
    type TicketSettingsConfig, 
    type TicketCategoryConfig, 
    type CannedResponseConfig,
    DEFAULT_TICKET_SETTINGS
  } from '$lib/services/ticketSettings';
  import { toast } from '$lib/stores/toast.svelte';

  let config = $state<TicketSettingsConfig>({ ...DEFAULT_TICKET_SETTINGS });

  let loading = $state(true);
  let saving = $state(false);
  let newCatLabel = $state('');

  onMount(async () => {
    try {
      config = await TicketSettingsService.getSettings();
    } catch (e) {
      console.error('Errore caricamento impostazioni ticket:', e);
    } finally {
      loading = false;
    }
  });

  function addCategory() {
    if (!newCatLabel.trim()) return;
    const id = newCatLabel.trim().toLowerCase().replace(/\s+/g, '_');
    if (config.categories.some((c: TicketCategoryConfig) => c.id === id)) {
      toast.error('Esiste già una categoria con questo nome.');
      return;
    }
    config.categories = [...config.categories, { id, label: newCatLabel.trim() }];
    newCatLabel = '';
  }

  function removeCategory(id: string) {
    config.categories = config.categories.filter((c: TicketCategoryConfig) => c.id !== id);
  }

  async function handleSave() {
    saving = true;
    try {
      await TicketSettingsService.saveSettings(config);
      toast.success('Impostazioni Ticket salvate con successo!');
    } catch (err: any) {
      toast.error('Errore salvataggio impostazioni: ' + err.message);
    } finally {
      saving = false;
    }
  }
</script>

<svelte:head>
  <title>Impostazioni Ticket Assistenza | Gestoray</title>
</svelte:head>

<div class="ticket-settings-page animate-fade-in">
  <div class="page-top">
    <a href="/dashboard/settings" class="back-link">← Torna alle Impostazioni Generali</a>
    <h2>⚙️ Configurazione Helpdesk & Ticket Assistenza</h2>
  </div>

  {#if loading}
    <div class="loader-box">
      <span class="spinner"></span>
      Caricamento in corso...
    </div>
  {:else}
    <div class="card form-card mb-24">
      <h3 class="card-title">🏷️ Categorie di Supporto</h3>
      <p class="card-subtitle">Personalizza le opzioni di classificazione dei ticket per i tuoi clienti.</p>

      <div class="categories-list mb-16">
        {#each config.categories as c}
          <div class="category-pill">
            <span>{c.label}</span>
            <button type="button" onclick={() => removeCategory(c.id)} class="btn-remove">✕</button>
          </div>
        {/each}
      </div>

      <div class="add-cat-bar">
        <input type="text" bind:value={newCatLabel} placeholder="Nuova Categoria (es. Fatturazione)" class="form-control" />
        <button type="button" onclick={addCategory} class="btn-add">+ Aggiungi</button>
      </div>
    </div>

    <div class="card form-card mb-24">
      <h3 class="card-title">🔐 Webhook Token (Inbound Email)</h3>
      <p class="card-subtitle">Token di autenticazione per l'importazione automatica delle email via Webhook.</p>
      <input type="text" bind:value={config.inboundWebhookToken} placeholder="Token segreto webhook..." class="form-control" />
    </div>

    <div class="form-actions-bar">
      <button type="button" onclick={handleSave} disabled={saving} class="btn-submit">
        {saving ? 'Salvataggio...' : '💾 Salva Impostazioni Helpdesk'}
      </button>
    </div>
  {/if}
</div>

<style>
  .ticket-settings-page { max-width: 800px; margin: 0 auto; padding: 24px 16px; }
  .page-top { margin-bottom: 20px; }
  .back-link { color: var(--color-neutral-600); text-decoration: none; font-size: 13px; font-weight: 600; }
  .page-top h2 { margin: 6px 0 0 0; font-size: 22px; font-weight: 700; color: var(--color-neutral-900); }

  .form-card { background: white; border: 1px solid var(--color-neutral-200); border-radius: var(--radius-lg); padding: 24px; box-shadow: var(--shadow-sm); }
  .card-title { margin: 0 0 4px 0; font-size: 16px; font-weight: 600; color: var(--color-neutral-800); }
  .card-subtitle { margin: 0 0 16px 0; font-size: 13px; color: var(--color-neutral-500); }
  .mb-24 { margin-bottom: 24px; }
  .mb-16 { margin-bottom: 16px; }

  .categories-list { display: flex; flex-wrap: wrap; gap: 8px; }
  .category-pill { background: var(--color-neutral-100); border: 1px solid var(--color-neutral-300); padding: 6px 12px; border-radius: 16px; font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 6px; }
  .btn-remove { background: none; border: none; cursor: pointer; color: var(--color-neutral-500); font-size: 12px; }
  .btn-remove:hover { color: #b91c1c; }

  .add-cat-bar { display: flex; gap: 12px; }
  .form-control { padding: 10px 14px; font-size: 14px; border: 1px solid var(--color-neutral-300); border-radius: var(--radius-md); outline: none; width: 100%; box-sizing: border-box; }
  .btn-add { padding: 10px 18px; font-weight: 600; background: var(--color-neutral-800); color: white; border: none; border-radius: var(--radius-md); cursor: pointer; white-space: nowrap; }

  .form-actions-bar { display: flex; justify-content: flex-end; }
  .btn-submit { padding: 12px 28px; font-size: 14px; font-weight: 700; color: white; background: var(--color-primary-600); border: none; border-radius: var(--radius-md); cursor: pointer; }
  .loader-box { padding: 40px; text-align: center; color: var(--color-neutral-500); }
</style>
