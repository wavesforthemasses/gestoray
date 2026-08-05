<script lang="ts">
  import { onMount } from 'svelte';
  import { TenantFeaturesService, DEFAULT_TENANT_FEATURES } from '$lib/services/tenantFeaturesService';
  import { tenantFeaturesStore } from '$lib/stores/tenantFeatures';
  import { projectStore } from '$lib/stores/project';
  import { Plug } from '@lucide/svelte';

  let features = $state<Record<string, boolean>>({});
  let loading = $state(true);
  let savingKey = $state<string | null>(null);

  onMount(async () => {
    try {
      features = await TenantFeaturesService.getTenantFeatures();
    } finally {
      loading = false;
    }
  });

  async function toggleFeature(key: string, currentVal: boolean) {
    savingKey = key;
    const newVal = !currentVal;
    try {
      await TenantFeaturesService.updateTenantFeature(key, newVal);
      features = { ...features, [key]: newVal };
      tenantFeaturesStore.update(s => ({ ...s, [key]: newVal }));
    } catch (e: any) {
      alert('Errore aggiornamento modulo: ' + e.message);
    } finally {
      savingKey = null;
    }
  }
</script>

<svelte:head>
  <title>Attivazione Moduli Tenant | {$projectStore?.projectName || 'ERP'}</title>
</svelte:head>

<div class="tenant-features-page animate-fade-in">
  <div class="page-header">
    <div>
      <h1 class="page-title"><Plug size={24} class="title-icon" /> Moduli & Funzionalità Attive (Tenant Flags)</h1>
      <p class="page-subtitle">Attiva o disattiva dinamicamente i moduli applicativi per la tua azienda senza disinstallare codice.</p>
    </div>
  </div>

  {#if loading}
    <div class="loader-box">Caricamento funzionalità tenant in corso...</div>
  {:else}
    <div class="features-grid">
      {#each Object.entries(DEFAULT_TENANT_FEATURES) as [key, config] (key)}
        {@const isEnabled = features[key] !== undefined ? features[key] : config.enabled}
        <div class="feature-card" class:enabled={isEnabled}>
          <div class="feature-header">
            <div class="feature-info">
              <h3>{config.label}</h3>
              <p>{config.description}</p>
            </div>
            <label class="switch">
              <input 
                type="checkbox" 
                checked={isEnabled} 
                disabled={savingKey === key} 
                onchange={() => toggleFeature(key, isEnabled)} 
              />
              <span class="slider"></span>
            </label>
          </div>

          <div class="feature-footer">
            <span class="status-indicator" class:active={isEnabled}>
              {isEnabled ? '● Modulo Attivo' : '○ Modulo Disattivato'}
            </span>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .tenant-features-page { max-width: 900px; margin: 0 auto; }
  .page-header { margin-bottom: 24px; }
  .page-title { font-size: 24px; font-weight: 700; margin: 0 0 4px 0; color: var(--color-neutral-800); }
  .page-subtitle { margin: 0; font-size: 14px; color: var(--color-neutral-500); }
  .features-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(380px, 1fr)); gap: 16px; }
  .feature-card { background: white; border: 1px solid var(--color-neutral-200); border-radius: var(--radius-lg); padding: 20px; box-shadow: var(--shadow-sm); transition: all 0.2s ease; }
  .feature-card.enabled { border-color: var(--color-primary-300); background: var(--color-primary-50); }
  .feature-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
  .feature-info h3 { margin: 0 0 4px 0; font-size: 16px; font-weight: 600; color: var(--color-neutral-800); }
  .feature-info p { margin: 0; font-size: 13px; color: var(--color-neutral-500); }
  .feature-footer { margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--color-neutral-200); display: flex; justify-content: flex-end; }
  .status-indicator { font-size: 12px; font-weight: 600; color: var(--color-neutral-400); }
  .status-indicator.active { color: var(--color-success); }
  .loader-box { padding: 40px; text-align: center; color: var(--color-neutral-500); }

  /* Switch styling */
  .switch { position: relative; display: inline-block; width: 44px; height: 24px; }
  .switch input { opacity: 0; width: 0; height: 0; }
  .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #ccc; transition: .3s; border-radius: 24px; }
  .slider:before { position: absolute; content: ""; height: 18px; width: 18px; left: 3px; bottom: 3px; background-color: white; transition: .3s; border-radius: 50%; }
  input:checked + .slider { background-color: var(--color-primary-500); }
  input:checked + .slider:before { transform: translateX(20px); }
</style>
