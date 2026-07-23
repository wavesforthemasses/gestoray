<script lang="ts">
  import { hasAccess } from '$lib/utils/authCheck';
  import { activeRoleState } from '$lib/auth.svelte';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { pageTitle } from '$lib/stores/page';
  import { Card, FormField, Button } from '$lib';
  import { Palette, ArrowLeft, RefreshCcw, Save } from '@lucide/svelte';
  import { projectStore } from '$lib/stores/project';
  import { db, doc, setDoc } from '$lib/firebase';
  import { toast } from '$lib/stores/toast.svelte';

  pageTitle.set('Tema e Branding');

  // Default values from app.css
  const DEFAULTS = {
    brandHue: 211,
    brandSaturation: 28,
    brandLightness: 26,
    secondaryHue: 38,
    secondarySaturation: 92,
    secondaryLightness: 50,
    neutralChroma: 8
  };

  let brandHue = $state(DEFAULTS.brandHue);
  let brandSaturation = $state(DEFAULTS.brandSaturation);
  let brandLightness = $state(DEFAULTS.brandLightness);

  let secondaryHue = $state(DEFAULTS.secondaryHue);
  let secondarySaturation = $state(DEFAULTS.secondarySaturation);
  let secondaryLightness = $state(DEFAULTS.secondaryLightness);

  let neutralChroma = $state(DEFAULTS.neutralChroma);

  let saving = $state(false);

  $effect(() => {
    const currentRole = activeRoleState.role;
    if (currentRole && !hasAccess(currentRole, ['superadmin'])) {
      goto('/dashboard');
    }
  });

  onMount(() => {
    // Initialize with values from store if available
    const settings = $projectStore;
    if (settings) {
      if (settings.brandHue !== undefined) brandHue = settings.brandHue;
      if (settings.brandSaturation !== undefined) brandSaturation = settings.brandSaturation;
      if (settings.brandLightness !== undefined) brandLightness = settings.brandLightness;
      
      if (settings.secondaryHue !== undefined) secondaryHue = settings.secondaryHue;
      if (settings.secondarySaturation !== undefined) secondarySaturation = settings.secondarySaturation;
      if (settings.secondaryLightness !== undefined) secondaryLightness = settings.secondaryLightness;
      
      if (settings.neutralChroma !== undefined) neutralChroma = settings.neutralChroma;
    }
  });

  function restoreDefaults() {
    brandHue = DEFAULTS.brandHue;
    brandSaturation = DEFAULTS.brandSaturation;
    brandLightness = DEFAULTS.brandLightness;
    secondaryHue = DEFAULTS.secondaryHue;
    secondarySaturation = DEFAULTS.secondarySaturation;
    secondaryLightness = DEFAULTS.secondaryLightness;
    neutralChroma = DEFAULTS.neutralChroma;
  }

  async function handleSave(e: Event) {
    e.preventDefault();
    saving = true;

    try {
      await setDoc(doc(db, 'settings', 'project'), {
        brandHue,
        brandSaturation,
        brandLightness,
        secondaryHue,
        secondarySaturation,
        secondaryLightness,
        neutralChroma
      }, { merge: true });

      toast.success('Tema salvato con successo! (Aggiorna la pagina per renderlo permanente)');
    } catch (err: any) {
      toast.error('Errore durante il salvataggio: ' + err.message);
    } finally {
      saving = false;
    }
  }

  // Anteprima live: ricalcoliamo le scale L per primary e secondary in Svelte 5 style derivato
  let primaryShades = $derived([95, 90, 80, 70, 60, 50, 40, 30, 20, 10].map(l => 
    `hsl(${brandHue}, ${brandSaturation}%, ${l}%)`
  ));
  let secondaryShades = $derived([95, 90, 80, 70, 60, 50, 40, 30, 20, 10].map(l => 
    `hsl(${secondaryHue}, ${secondarySaturation}%, ${l}%)`
  ));
</script>

<div class="theme-settings-page animate-fade-in">
  <Card
    title="Personalizza Tema"
    description="Modifica i colori principali dell'applicazione. Le modifiche vengono applicate in tempo reale ma saranno permanenti solo dopo il salvataggio."
    class="settings-card"
  >
    {#snippet icon()}
      <Palette size={20} class="icon-accent" />
    {/snippet}

    {#snippet headerSnippet()}
      <a href="/dashboard/settings" class="back-link">
        <ArrowLeft size={14} /> Torna a Impostazioni
      </a>
    {/snippet}

    <form onsubmit={handleSave} class="theme-form">
      <div class="settings-grid">
        
        <!-- Primary Color -->
        <div class="color-section">
          <h3>Colore Primario</h3>
          
          <FormField id="brand-hue" label={`Tonalità (Hue): ${brandHue}°`}>
            <input type="range" id="brand-hue" min="0" max="360" bind:value={brandHue} />
          </FormField>
          
          <FormField id="brand-saturation" label={`Saturazione: ${brandSaturation}%`}>
            <input type="range" id="brand-saturation" min="0" max="100" bind:value={brandSaturation} />
          </FormField>
          
          <FormField id="brand-lightness" label={`Luminosità (Lightness): ${brandLightness}%`}>
            <input type="range" id="brand-lightness" min="0" max="100" bind:value={brandLightness} />
          </FormField>

          <div class="shades-preview">
            {#each primaryShades as shade}
              <div class="shade-box" style="background-color: {shade};"></div>
            {/each}
          </div>
        </div>

        <!-- Secondary Color -->
        <div class="color-section">
          <h3>Colore Secondario (Accenti)</h3>
          
          <FormField id="sec-hue" label={`Tonalità (Hue): ${secondaryHue}°`}>
            <input type="range" id="sec-hue" min="0" max="360" bind:value={secondaryHue} />
          </FormField>
          
          <FormField id="sec-saturation" label={`Saturazione: ${secondarySaturation}%`}>
            <input type="range" id="sec-saturation" min="0" max="100" bind:value={secondarySaturation} />
          </FormField>
          
          <FormField id="sec-lightness" label={`Luminosità (Lightness): ${secondaryLightness}%`}>
            <input type="range" id="sec-lightness" min="0" max="100" bind:value={secondaryLightness} />
          </FormField>

          <div class="shades-preview">
            {#each secondaryShades as shade}
              <div class="shade-box" style="background-color: {shade};"></div>
            {/each}
          </div>
        </div>

        <!-- Neutrals -->
        <div class="color-section full-width">
          <h3>Colori Neutri (Grigi)</h3>
          <FormField id="neutral-chroma" label={`Saturazione Neutri (Chroma): ${neutralChroma}%`} helpText="Aumenta questo valore per dare ai grigi una sfumatura del colore primario.">
            <input type="range" id="neutral-chroma" min="0" max="25" bind:value={neutralChroma} />
          </FormField>
        </div>

      </div>

      <div class="actions">
        <button type="button" class="restore-btn" onclick={restoreDefaults}>
          <RefreshCcw size={16} /> Ripristina Predefiniti
        </button>
        
        <button type="submit" class="save-btn" disabled={saving}>
          <Save size={16} /> {saving ? 'Salvataggio...' : 'Salva Tema'}
        </button>
      </div>
    </form>
  </Card>
</div>

<!-- Iniettore Live Preview -->
<svelte:head>
  <style>
    :root {
      --brand-h: {brandHue} !important;
      --brand-s: {brandSaturation}% !important;
      --brand-l-num: {brandLightness} !important;
      --sec-h: {secondaryHue} !important;
      --sec-s: {secondarySaturation}% !important;
      --sec-l-num: {secondaryLightness} !important;
      --neutral-s: {neutralChroma}% !important;
    }
  </style>
</svelte:head>

<style>
  .theme-settings-page {
    width: 100%;
  }

  .back-link {
    background: var(--color-white);
    border: 1px solid var(--color-neutral-300);
    color: var(--color-neutral-600);
    padding: 8px 14px;
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-family: inherit;
    font-size: 13px;
    font-weight: 600;
    transition: all 0.2s;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .back-link:hover {
    background: var(--color-neutral-100);
    color: var(--color-neutral-800);
  }

  :global(.icon-accent) {
    color: var(--color-primary-500);
  }

  .theme-form {
    display: flex;
    flex-direction: column;
    gap: 30px;
  }

  .settings-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 30px;
  }

  @media (max-width: 800px) {
    .settings-grid {
      grid-template-columns: 1fr;
    }
  }

  .color-section {
    background: var(--color-neutral-50);
    padding: 20px;
    border-radius: var(--radius-md);
    border: 1px solid var(--color-neutral-200);
    display: flex;
    flex-direction: column;
    gap: 15px;
  }

  .full-width {
    grid-column: 1 / -1;
  }

  h3 {
    margin: 0 0 10px 0;
    font-size: 16px;
    color: var(--color-neutral-800);
    font-weight: 600;
  }

  input[type="range"] {
    width: 100%;
    accent-color: var(--color-primary-500);
  }

  .shades-preview {
    display: flex;
    height: 40px;
    border-radius: var(--radius-sm);
    overflow: hidden;
    margin-top: 10px;
    border: 1px solid var(--color-neutral-300);
  }

  .shade-box {
    flex: 1;
    height: 100%;
  }

  .actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: 20px;
    border-top: 1px solid var(--color-neutral-200);
  }

  .restore-btn {
    background: transparent;
    color: var(--color-neutral-600);
    border: 1px solid var(--color-neutral-300);
    padding: 10px 16px;
    border-radius: var(--radius-md);
    cursor: pointer;
    font-family: inherit;
    font-size: 14px;
    font-weight: 500;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    transition: all 0.2s;
  }

  .restore-btn:hover {
    background: var(--color-neutral-100);
    color: var(--color-neutral-900);
  }

  .save-btn {
    background: linear-gradient(135deg, var(--color-primary-500), var(--color-primary-600));
    color: var(--color-white);
    border: none;
    padding: 12px 24px;
    border-radius: var(--radius-md);
    cursor: pointer;
    font-family: inherit;
    font-size: 14px;
    font-weight: 600;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    transition: opacity 0.2s;
    box-shadow: 0 4px 12px hsla(var(--brand-h), var(--brand-s), var(--brand-l), 0.2);
  }

  .save-btn:hover:not(:disabled) {
    opacity: 0.9;
  }

  .save-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .animate-fade-in {
    animation: fadeIn 0.3s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  }
</style>
