<script lang="ts">
  import { onMount } from 'svelte';
  import { 
    InterventionSettingsService, 
    type InterventionSettingsConfig, 
    DEFAULT_INTERVENTION_SETTINGS 
  } from '$lib/services/interventionSettings';
  import type { PricingUnit } from '$lib/types/interventi';
  import { toast } from '$lib/stores/toast.svelte';

  let config = $state<InterventionSettingsConfig>({ ...DEFAULT_INTERVENTION_SETTINGS });
  let loading = $state(true);
  let saving = $state(false);

  let newTypeLabel = $state('');
  let newTypeRate = $state<number>(45);
  let newTypeUnit = $state<PricingUnit>('ora');

  onMount(async () => {
    try {
      config = await InterventionSettingsService.getSettings();
    } catch (e) {
      console.error('Errore caricamento impostazioni interventi:', e);
    } finally {
      loading = false;
    }
  });

  function addType() {
    if (!newTypeLabel.trim()) return;
    const id = newTypeLabel.trim().toLowerCase().replace(/\s+/g, '_');
    config.interventionTypes = [
      ...config.interventionTypes,
      { id, label: newTypeLabel.trim(), defaultHourlyRate: newTypeRate, defaultPricingUnit: newTypeUnit }
    ];
    newTypeLabel = '';
  }

  function removeType(id: string) {
    config.interventionTypes = config.interventionTypes.filter(t => t.id !== id);
  }

  async function handleSave() {
    saving = true;
    try {
      await InterventionSettingsService.saveSettings(config);
      toast.success('Impostazioni Interventi salvate con successo!');
    } catch (err: any) {
      toast.error('Errore salvataggio impostazioni: ' + err.message);
    } finally {
      saving = false;
    }
  }
</script>

<svelte:head>
  <title>Impostazioni Interventi | Gestoray</title>
</svelte:head>

<div class="interventi-settings-page animate-fade-in">
  <div class="page-top">
    <a href="/dashboard/settings" class="back-link">← Torna alle Impostazioni Generali</a>
    <h2>⚙️ Configurazione Field Service & Interventi</h2>
  </div>

  {#if loading}
    <div class="loader-box">
      <span class="spinner"></span>
      Caricamento in corso...
    </div>
  {:else}
    <div class="card form-card mb-24">
      <h3 class="card-title">🏷️ Tipi di Intervento & Tariffe Predefinite</h3>
      <p class="card-subtitle">Personalizza le categorie di intervento e le tariffe orarie base.</p>

      <div class="types-list mb-16">
        {#each config.interventionTypes as t}
          <div class="type-pill">
            <span><strong>{t.label}</strong> (€ {t.defaultHourlyRate || 0}/h)</span>
            <button type="button" onclick={() => removeType(t.id)} class="btn-remove">✕</button>
          </div>
        {/each}
      </div>

      <div class="add-type-bar">
        <input type="text" bind:value={newTypeLabel} placeholder="Nuova Categoria (es. Collaudo)" class="form-control" />
        <input type="number" bind:value={newTypeRate} placeholder="Tariffa €/h" class="form-control short" />
        <button type="button" onclick={addType} class="btn-add">+ Aggiungi</button>
      </div>
    </div>

    <div class="form-actions-bar">
      <button type="button" onclick={handleSave} disabled={saving} class="btn-submit">
        {saving ? 'Salvataggio...' : '💾 Salva Impostazioni Interventi'}
      </button>
    </div>
  {/if}
</div>

<style>
  .interventi-settings-page { max-width: 800px; margin: 0 auto; padding: 24px 16px; }
  .page-top { margin-bottom: 20px; }
  .back-link { color: var(--color-neutral-600); text-decoration: none; font-size: 13px; font-weight: 600; }
  .page-top h2 { margin: 6px 0 0 0; font-size: 22px; font-weight: 700; color: var(--color-neutral-900); }

  .form-card { background: white; border: 1px solid var(--color-neutral-200); border-radius: var(--radius-lg); padding: 24px; box-shadow: var(--shadow-sm); }
  .card-title { margin: 0 0 4px 0; font-size: 16px; font-weight: 600; color: var(--color-neutral-800); }
  .card-subtitle { margin: 0 0 16px 0; font-size: 13px; color: var(--color-neutral-500); }
  .mb-24 { margin-bottom: 24px; }
  .mb-16 { margin-bottom: 16px; }

  .types-list { display: flex; flex-wrap: wrap; gap: 8px; }
  .type-pill { background: var(--color-neutral-100); border: 1px solid var(--color-neutral-300); padding: 6px 12px; border-radius: 16px; font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 6px; }
  .btn-remove { background: none; border: none; cursor: pointer; color: var(--color-neutral-500); font-size: 12px; }

  .add-type-bar { display: flex; gap: 12px; }
  .short { max-width: 120px; }
  .form-control { padding: 10px 14px; font-size: 14px; border: 1px solid var(--color-neutral-300); border-radius: var(--radius-md); outline: none; width: 100%; box-sizing: border-box; }
  .btn-add { padding: 10px 18px; font-weight: 600; background: var(--color-neutral-800); color: white; border: none; border-radius: var(--radius-md); cursor: pointer; white-space: nowrap; }

  .form-actions-bar { display: flex; justify-content: flex-end; }
  .btn-submit { padding: 12px 28px; font-size: 14px; font-weight: 700; color: white; background: var(--color-primary-600); border: none; border-radius: var(--radius-md); cursor: pointer; }
  .loader-box { padding: 40px; text-align: center; color: var(--color-neutral-500); }
</style>
