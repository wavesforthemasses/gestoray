<script lang="ts">
  import { onMount } from 'svelte';
  import { 
    InterventionSettingsService, 
    type InterventionSettingsConfig, 
    DEFAULT_INTERVENTION_SETTINGS 
  } from '$lib/services/interventionSettings';

  import type { PricingUnit } from '../../interventi/schema';

  let config = $state<InterventionSettingsConfig>({ ...DEFAULT_INTERVENTION_SETTINGS });
  let loading = $state(true);
  let saving = $state(false);
  let successMsg = $state('');
  let errorMsg = $state('');

  // Nuova Categoria form
  let newTypeLabel = $state('');
  let newTypeRate = $state(45);
  let newTypeUnit = $state<PricingUnit>('ora');

  onMount(async () => {
    try {
      config = await InterventionSettingsService.getSettings();
      if (!config.interventionTypes) config.interventionTypes = [...DEFAULT_INTERVENTION_SETTINGS.interventionTypes];
    } catch (e: any) {
      console.error('Errore caricamento impostazioni interventi:', e);
    } finally {
      loading = false;
    }
  });

  function addType() {
    if (!newTypeLabel.trim()) return;
    const id = newTypeLabel.trim().toLowerCase().replace(/\s+/g, '_');
    if (config.interventionTypes.some(t => t.id === id)) {
      errorMsg = 'Esiste già una tipologia con questo nome.';
      return;
    }
    config.interventionTypes = [
      ...config.interventionTypes,
      { id, label: newTypeLabel.trim(), defaultHourlyRate: newTypeRate, defaultPricingUnit: newTypeUnit }
    ];
    newTypeLabel = '';
    newTypeRate = 45;
    newTypeUnit = 'ora';
  }

  function removeType(id: string) {
    config.interventionTypes = config.interventionTypes.filter(t => t.id !== id);
  }

  async function handleSave(e: SubmitEvent) {
    e.preventDefault();
    saving = true;
    successMsg = '';
    errorMsg = '';
    try {
      await InterventionSettingsService.saveSettings(config);
      successMsg = 'Impostazioni generali del modulo Interventi salvate con successo!';
    } catch (err: any) {
      errorMsg = 'Errore salvataggio: ' + err.message;
    } finally {
      saving = false;
    }
  }
</script>

<svelte:head>
  <title>Configurazione Interventi | Gestoray</title>
</svelte:head>

<div class="intervention-settings-page">
  <header class="page-header">
    <a href="/dashboard/settings" class="back-link">← Torna alle Impostazioni</a>
    <h1 class="page-title">⚙️ Configurazione Modulo Interventi & Cantieri</h1>
    <p class="page-subtitle">Personalizza la denominazione White-Label delle sedi, le tariffe base e le opzioni di firma.</p>
  </header>

  {#if successMsg}
    <div class="alert-success">{successMsg}</div>
  {/if}

  {#if errorMsg}
    <div class="alert-danger">{errorMsg}</div>
  {/if}

  {#if loading}
    <div class="loading-state">Caricamento impostazioni...</div>
  {:else}
    <form onsubmit={handleSave} class="settings-form">
      <!-- 1. WHITE-LABEL LABELING & GENERAL -->
      <section class="settings-card">
        <h2 class="card-section-title">🏷️ Denominazione White-Label Sedi & General</h2>

        <div class="form-group">
          <label for="locLabel">Denominazione Preferita per i Luoghi del Cliente</label>
          <select id="locLabel" bind:value={config.locationLabel}>
            <option value="Luoghi di Intervento">Luoghi di Intervento (Standard Generico)</option>
            <option value="Cantieri">Cantieri (Aziende Edili / Impianti)</option>
            <option value="Sedi & Impianti">Sedi & Impianti (IT / Consulting / Manutenzioni)</option>
          </select>
          <span class="field-desc">Questa dicitura aggiornerà dinamicamente l'interfaccia ed il menu laterale per la tua azienda.</span>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="defRate">Tariffa Oraria Predefinita (€/h)</label>
            <input type="number" id="defRate" bind:value={config.defaultHourlyRate} />
          </div>

          <div class="form-group">
            <label class="toggle-container">
              <input type="checkbox" bind:checked={config.requireSignatureForBilling} />
              <div>
                <span class="toggle-title">✍️ Richiedi Obbligatoriamente Firma Cliente per Fatturazione</span>
              </div>
            </label>
          </div>
        </div>
      </section>

      <!-- 2. MODALITÀ DI VALORIZZAZIONE ABILITATE -->
      <section class="settings-card">
        <h2 class="card-section-title">💼 Modalità di Valorizzazione Abilitate in Piattaforma</h2>
        <span class="field-desc">Se abiliti una sola modalità, la scelta scomparirà dal form interventi e sarà impostata automaticamente. Se abiliti entrambe, l'utente potrà scegliere durante la pianificazione.</span>

        <div class="form-row">
          <div class="form-group">
            <label class="toggle-container">
              <input type="checkbox" bind:checked={config.enableABolla} />
              <div>
                <span class="toggle-title">📄 Abilita Interventi "A Bolla" (Fatturabili a Consuntivo)</span>
              </div>
            </label>
          </div>

          <div class="form-group">
            <label class="toggle-container">
              <input type="checkbox" bind:checked={config.enableAdErogazione} />
              <div>
                <span class="toggle-title">📦 Abilita Interventi "Ad Erogazione" (Scarico Monte Ore Contratto)</span>
              </div>
            </label>
          </div>
        </div>

        {#if config.enableABolla && config.enableAdErogazione}
          <div class="form-group">
            <label for="defMode">Modalità Predefinita Selezionata all'Apertura Form</label>
            <select id="defMode" bind:value={config.defaultMode}>
              <option value="a_bolla">📄 A Bolla (Fatturabile)</option>
              <option value="ad_erogazione">📦 Ad Erogazione (Monte Ore)</option>
            </select>
          </div>
        {/if}
      </section>

      <!-- 3. UNITÀ DI MISURA ABILITATE -->
      <section class="settings-card">
        <h2 class="card-section-title">📐 Unità di Misura Abilitate in Piattaforma</h2>
        <span class="field-desc">Seleziona quali unità di misura sono utilizzabili per i tuoi interventi. Le unità non selezionate non compariranno nei form di creazione.</span>

        <div class="checkbox-grid" style="display: flex; flex-wrap: wrap; gap: 0.8rem; margin-top: 0.5rem;">
          {#each [
            { id: 'ora', label: '⏱️ Ore (h)' },
            { id: 'mq', label: '📐 Metri Quadri (m²)' },
            { id: 'mc', label: '🧊 Metri Cubi (m³)' },
            { id: 'quantita', label: '🔢 Quantità Generica (u)' },
            { id: 'corpo', label: '💼 A Corpo (€)' }
          ] as unit}
            <label class="toggle-container" style="background: #f8fafc; border: 1px solid #cbd5e1; padding: 0.5rem 0.9rem; border-radius: 20px;">
              <input 
                type="checkbox" 
                checked={(config.enabledPricingUnits || []).includes(unit.id as any)}
                onchange={(e) => {
                  const checked = (e.target as HTMLInputElement).checked;
                  const current = config.enabledPricingUnits || ['ora', 'mq', 'mc', 'quantita', 'corpo'];
                  if (checked) {
                    if (!current.includes(unit.id as any)) {
                      config.enabledPricingUnits = [...current, unit.id as any];
                    }
                  } else {
                    if (current.length > 1) {
                      config.enabledPricingUnits = current.filter(u => u !== unit.id);
                    } else {
                      alert('Devi mantenere almeno un unità di misura abilitata!');
                    }
                  }
                }}
              />
              <span class="toggle-title" style="font-size: 0.85rem;">{unit.label}</span>
            </label>
          {/each}
        </div>
      </section>

      <!-- 2. TIPOLOGIE INTERVENTO -->
      <section class="settings-card">
        <h2 class="card-section-title">🛠️ Tipologie Intervento & Tariffe Categoria</h2>

        <div class="items-list">
          {#each config.interventionTypes as t}
            <div class="item-row">
              <div>
                <strong>{t.label}</strong>
                <span class="tag-id">ID: {t.id}</span>
              </div>
              <div class="rate-input" style="display: flex; gap: 0.5rem; align-items: center;">
                <select bind:value={t.defaultPricingUnit} style="padding: 0.4rem; font-size: 0.82rem;">
                  <option value="ora">⏱️ Ore (h)</option>
                  <option value="mq">📐 Metri Quadri (m²)</option>
                  <option value="mc">🧊 Metri Cubi (m³)</option>
                  <option value="quantita">🔢 Quantità (u)</option>
                  <option value="corpo">💼 A Corpo (€)</option>
                </select>
                <input type="number" id="rate-{t.id}" bind:value={t.defaultHourlyRate} style="width: 80px; padding: 0.4rem;" />
              </div>
              <button type="button" class="btn-icon-danger" onclick={() => removeType(t.id)}>🗑️</button>
            </div>
          {/each}
        </div>

        <div class="add-box">
          <input type="text" placeholder="Nome Nuova Tipologia (es. Collaudo)" bind:value={newTypeLabel} />
          <select bind:value={newTypeUnit} style="width: 140px;">
            <option value="ora">⏱️ Ore (h)</option>
            <option value="mq">📐 Metri Quadri (m²)</option>
            <option value="mc">🧊 Metri Cubi (m³)</option>
            <option value="quantita">🔢 Quantità (u)</option>
            <option value="corpo">💼 A Corpo (€)</option>
          </select>
          <input type="number" placeholder="Tariffa €" bind:value={newTypeRate} style="width: 100px;" />
          <button type="button" class="btn btn-secondary" onclick={addType}>+ Aggiungi Categoria</button>
        </div>
      </section>

      <div class="form-actions">
        <button type="submit" class="btn btn-primary" disabled={saving}>
          {saving ? 'Salvataggio...' : 'Salva Impostazioni Modulo Interventi'}
        </button>
      </div>
    </form>
  {/if}
</div>

<style>
  .intervention-settings-page {
    max-width: 900px;
    margin: 0 auto;
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .back-link { color: #64748b; text-decoration: none; font-size: 0.88rem; }
  .page-title { font-size: 1.5rem; font-weight: 800; margin: 0.3rem 0 0 0; }
  .page-subtitle { color: #64748b; font-size: 0.9rem; margin: 0.2rem 0 0 0; }

  .settings-form { display: flex; flex-direction: column; gap: 1.5rem; }

  .settings-card {
    background: #ffffff;
    border-radius: 12px;
    border: 1px solid #e2e8f0;
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .card-section-title { font-size: 1.15rem; font-weight: 700; color: #0f172a; margin: 0; }
  .field-desc { font-size: 0.85rem; color: #64748b; }

  .form-group { display: flex; flex-direction: column; gap: 0.4rem; }
  .form-group label { font-weight: 600; font-size: 0.88rem; color: #334155; }

  .form-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; align-items: center; }

  input, select {
    padding: 0.6rem 0.8rem;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    font-size: 0.88rem;
  }

  .toggle-container { display: flex; align-items: center; gap: 0.8rem; cursor: pointer; }
  .toggle-title { font-weight: 600; font-size: 0.9rem; }

  .items-list { display: flex; flex-direction: column; gap: 0.8rem; }
  .item-row { display: flex; justify-content: space-between; align-items: center; padding: 0.8rem 1rem; border: 1px solid #e2e8f0; border-radius: 8px; background: #f8fafc; }
  .tag-id { font-size: 0.78rem; color: #64748b; display: block; }

  .add-box { display: flex; gap: 0.6rem; flex-wrap: wrap; padding-top: 0.8rem; border-top: 1px dashed #cbd5e1; }

  .form-actions { display: flex; justify-content: flex-end; }

  .btn { padding: 0.65rem 1.4rem; border-radius: 8px; font-weight: 600; cursor: pointer; border: none; }
  .btn-primary { background: #3b82f6; color: white; }
  .btn-secondary { background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; }
  .btn-icon-danger { background: none; border: none; cursor: pointer; font-size: 1rem; }

  .alert-success { background: #dcfce7; color: #166534; padding: 0.8rem; border-radius: 8px; font-weight: 600; }
  .alert-danger { background: #fef2f2; color: #991b1b; padding: 0.8rem; border-radius: 8px; font-weight: 600; }
  .loading-state { text-align: center; padding: 3rem; color: #64748b; }
</style>
