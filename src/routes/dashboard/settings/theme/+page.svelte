<script lang="ts">
  import { hasAccess } from '$lib/utils/authCheck';
  import { activeRoleState } from '$lib/auth.svelte';
  import { goto } from '$app/navigation';
  import { onMount, onDestroy } from 'svelte';
  import { pageTitle } from '$lib/stores/page';
  import { Card, FormField } from '$lib';
  import { Palette, ArrowLeft, RefreshCcw, Save, Pipette } from '@lucide/svelte';
  import { projectStore } from '$lib/stores/project';
  import { SettingsService } from '$lib/services/settingsService';
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

  // Color Utility Functions: HSL <-> HEX
  function hslToHex(h: number, s: number, l: number): string {
    const lNorm = l / 100;
    const a = (s * Math.min(lNorm, 1 - lNorm)) / 100;
    const f = (n: number) => {
      const k = (n + h / 30) % 12;
      const color = lNorm - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`.toUpperCase();
  }

  function hexToHsl(hex: string): { h: number; s: number; l: number } | null {
    let clean = hex.replace(/^#/, '');
    if (clean.length === 3) {
      clean = clean.split('').map(c => c + c).join('');
    }
    if (clean.length !== 6) return null;
    const num = parseInt(clean, 16);
    if (isNaN(num)) return null;

    const r = ((num >> 16) & 255) / 255;
    const g = ((num >> 8) & 255) / 255;
    const b = (num & 255) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }

    return {
      h: Math.round(h * 360),
      s: Math.round(s * 100),
      l: Math.round(l * 100)
    };
  }

  // Reactive State variables
  let brandHue = $state(DEFAULTS.brandHue);
  let brandSaturation = $state(DEFAULTS.brandSaturation);
  let brandLightness = $state(DEFAULTS.brandLightness);
  let brandHexInput = $state(hslToHex(DEFAULTS.brandHue, DEFAULTS.brandSaturation, DEFAULTS.brandLightness));

  let secondaryHue = $state(DEFAULTS.secondaryHue);
  let secondarySaturation = $state(DEFAULTS.secondarySaturation);
  let secondaryLightness = $state(DEFAULTS.secondaryLightness);
  let secondaryHexInput = $state(hslToHex(DEFAULTS.secondaryHue, DEFAULTS.secondarySaturation, DEFAULTS.secondaryLightness));

  let neutralChroma = $state(DEFAULTS.neutralChroma);
  let saving = $state(false);
  let savedSuccessfully = $state(false);

  $effect(() => {
    const currentRole = activeRoleState.role;
    if (currentRole && !hasAccess(currentRole, ['superadmin'])) {
      goto('/dashboard');
    }
  });

  // REAL-TIME LIVE PREVIEW EFFECT: Direct inline style application on html element
  $effect(() => {
    const bh = brandHue;
    const bs = brandSaturation;
    const bl = brandLightness;
    const sh = secondaryHue;
    const ss = secondarySaturation;
    const sl = secondaryLightness;
    const nc = neutralChroma;

    if (typeof document !== 'undefined') {
      const root = document.documentElement.style;
      root.setProperty('--brand-h', String(bh));
      root.setProperty('--brand-s', `${bs}%`);
      root.setProperty('--brand-l-num', String(bl));
      root.setProperty('--brand-l', `${bl}%`);

      root.setProperty('--sec-h', String(sh));
      root.setProperty('--sec-s', `${ss}%`);
      root.setProperty('--sec-l-num', String(sl));
      root.setProperty('--sec-l', `${sl}%`);

      root.setProperty('--neutral-s', `${nc}%`);
    }
  });

  // Keep HEX inputs in sync when HSL changes
  function updatePrimaryHexFromHsl() {
    brandHexInput = hslToHex(brandHue, brandSaturation, brandLightness);
  }

  function updateSecondaryHexFromHsl() {
    secondaryHexInput = hslToHex(secondaryHue, secondarySaturation, secondaryLightness);
  }

  // Handle HEX inputs for Primary
  function handlePrimaryHexChange(val: string) {
    brandHexInput = val;
    const hsl = hexToHsl(val);
    if (hsl) {
      brandHue = hsl.h;
      brandSaturation = hsl.s;
      brandLightness = hsl.l;
    }
  }

  // Handle HEX inputs for Secondary
  function handleSecondaryHexChange(val: string) {
    secondaryHexInput = val;
    const hsl = hexToHsl(val);
    if (hsl) {
      secondaryHue = hsl.h;
      secondarySaturation = hsl.s;
      secondaryLightness = hsl.l;
    }
  }

  onMount(async () => {
    try {
      let settings = await SettingsService.getProjectConfig();
      if (!settings && $projectStore) {
        settings = $projectStore;
      }
      if (settings) {
        if (settings.brandHue !== undefined) brandHue = settings.brandHue;
        if (settings.brandSaturation !== undefined) brandSaturation = settings.brandSaturation;
        if (settings.brandLightness !== undefined) brandLightness = settings.brandLightness;
        brandHexInput = hslToHex(brandHue, brandSaturation, brandLightness);

        if (settings.secondaryHue !== undefined) secondaryHue = settings.secondaryHue;
        if (settings.secondarySaturation !== undefined) secondarySaturation = settings.secondarySaturation;
        if (settings.secondaryLightness !== undefined) secondaryLightness = settings.secondaryLightness;
        secondaryHexInput = hslToHex(secondaryHue, secondarySaturation, secondaryLightness);

        if (settings.neutralChroma !== undefined) neutralChroma = settings.neutralChroma;
      }
    } catch (e) {
      console.warn('Errore lettura impostazioni tema da Firestore:', e);
    }
  });

  onDestroy(() => {
    // If the user leaves without saving, revert inline styles back to stored projectStore
    if (!savedSuccessfully && $projectStore && typeof document !== 'undefined') {
      const root = document.documentElement.style;
      const ps = $projectStore;
      if (ps.brandHue !== undefined) root.setProperty('--brand-h', String(ps.brandHue));
      if (ps.brandSaturation !== undefined) root.setProperty('--brand-s', `${ps.brandSaturation}%`);
      if (ps.brandLightness !== undefined) {
        root.setProperty('--brand-l-num', String(ps.brandLightness));
        root.setProperty('--brand-l', `${ps.brandLightness}%`);
      }
      if (ps.secondaryHue !== undefined) root.setProperty('--sec-h', String(ps.secondaryHue));
      if (ps.secondarySaturation !== undefined) root.setProperty('--sec-s', `${ps.secondarySaturation}%`);
      if (ps.secondaryLightness !== undefined) {
        root.setProperty('--sec-l-num', String(ps.secondaryLightness));
        root.setProperty('--sec-l', `${ps.secondaryLightness}%`);
      }
      if (ps.neutralChroma !== undefined) root.setProperty('--neutral-s', `${ps.neutralChroma}%`);
    }
  });

  function restoreDefaults() {
    brandHue = DEFAULTS.brandHue;
    brandSaturation = DEFAULTS.brandSaturation;
    brandLightness = DEFAULTS.brandLightness;
    brandHexInput = hslToHex(brandHue, brandSaturation, brandLightness);

    secondaryHue = DEFAULTS.secondaryHue;
    secondarySaturation = DEFAULTS.secondarySaturation;
    secondaryLightness = DEFAULTS.secondaryLightness;
    secondaryHexInput = hslToHex(secondaryHue, secondarySaturation, secondaryLightness);

    neutralChroma = DEFAULTS.neutralChroma;
    toast.info('Valori predefiniti ripristinati. Clicca su "Salva Tema" per renderli permanenti.');
  }

  async function handleSave(e: Event) {
    e.preventDefault();
    saving = true;

    try {
      const payload = {
        brandHue,
        brandSaturation,
        brandLightness,
        secondaryHue,
        secondarySaturation,
        secondaryLightness,
        neutralChroma,
        updatedAt: new Date().toISOString()
      };

      await SettingsService.saveProjectConfig(payload);

      // Synchronize in-memory projectStore for immediate global reactivity across the entire app
      projectStore.update((curr) => ({
        ...(curr || { projectName: '', projectEmail: '' }),
        ...payload
      }));

      savedSuccessfully = true;
      toast.success('Tema salvato con successo! Le impostazioni sono ora permanenti.');
    } catch (err: any) {
      toast.error('Errore durante il salvataggio: ' + err.message);
    } finally {
      saving = false;
    }
  }

  // Anteprima live: ricalcoliamo le scale L per primary e secondary
  let primaryShades = $derived([95, 90, 80, 70, 60, 50, 40, 30, 20, 10].map(l => 
    `hsl(${brandHue}, ${brandSaturation}%, ${l}%)`
  ));
  let secondaryShades = $derived([95, 90, 80, 70, 60, 50, 40, 30, 20, 10].map(l => 
    `hsl(${secondaryHue}, ${secondarySaturation}%, ${l}%)`
  ));
</script>

<div class="theme-settings-page animate-fade-in">
  <Card
    title="Personalizza Tema e Branding"
    description="Modifica i colori principali dell'applicazione inserendo i codici HEX o usando i cursori. La piattaforma si trasforma istantaneamente in tempo reale davanti ai tuoi occhi!"
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
          <div class="section-title-row">
            <h3>Colore Primario</h3>
            <div class="hex-picker-group">
              <label for="brand-picker" class="picker-label" title="Scegli Colore">
                <Pipette size={14} />
                <input
                  type="color"
                  id="brand-picker"
                  value={brandHexInput}
                  oninput={(e) => handlePrimaryHexChange((e.target as HTMLInputElement).value)}
                  class="color-picker-input"
                />
              </label>
              <input
                type="text"
                placeholder="#1E40AF"
                value={brandHexInput}
                oninput={(e) => handlePrimaryHexChange((e.target as HTMLInputElement).value)}
                class="hex-text-input"
              />
            </div>
          </div>
          
          <FormField id="brand-hue" label={`Tonalità (Hue): ${brandHue}°`}>
            <input type="range" id="brand-hue" min="0" max="360" bind:value={brandHue} oninput={updatePrimaryHexFromHsl} />
          </FormField>
          
          <FormField id="brand-saturation" label={`Saturazione: ${brandSaturation}%`}>
            <input type="range" id="brand-saturation" min="0" max="100" bind:value={brandSaturation} oninput={updatePrimaryHexFromHsl} />
          </FormField>
          
          <FormField id="brand-lightness" label={`Luminosità (Lightness): ${brandLightness}%`}>
            <input type="range" id="brand-lightness" min="0" max="100" bind:value={brandLightness} oninput={updatePrimaryHexFromHsl} />
          </FormField>

          <div class="shades-preview">
            {#each primaryShades as shade}
              <div class="shade-box" style="background-color: {shade};"></div>
            {/each}
          </div>
        </div>

        <!-- Secondary Color -->
        <div class="color-section">
          <div class="section-title-row">
            <h3>Colore Secondario (Accenti)</h3>
            <div class="hex-picker-group">
              <label for="sec-picker" class="picker-label" title="Scegli Colore">
                <Pipette size={14} />
                <input
                  type="color"
                  id="sec-picker"
                  value={secondaryHexInput}
                  oninput={(e) => handleSecondaryHexChange((e.target as HTMLInputElement).value)}
                  class="color-picker-input"
                />
              </label>
              <input
                type="text"
                placeholder="#F59E0B"
                value={secondaryHexInput}
                oninput={(e) => handleSecondaryHexChange((e.target as HTMLInputElement).value)}
                class="hex-text-input"
              />
            </div>
          </div>
          
          <FormField id="sec-hue" label={`Tonalità (Hue): ${secondaryHue}°`}>
            <input type="range" id="sec-hue" min="0" max="360" bind:value={secondaryHue} oninput={updateSecondaryHexFromHsl} />
          </FormField>
          
          <FormField id="sec-saturation" label={`Saturazione: ${secondarySaturation}%`}>
            <input type="range" id="sec-saturation" min="0" max="100" bind:value={secondarySaturation} oninput={updateSecondaryHexFromHsl} />
          </FormField>
          
          <FormField id="sec-lightness" label={`Luminosità (Lightness): ${secondaryLightness}%`}>
            <input type="range" id="sec-lightness" min="0" max="100" bind:value={secondaryLightness} oninput={updateSecondaryHexFromHsl} />
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

  .section-title-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 5px;
  }

  .hex-picker-group {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .picker-label {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    border: 1px solid var(--color-neutral-300);
    background: var(--color-white);
    cursor: pointer;
    position: relative;
    color: var(--color-neutral-700);
  }

  .color-picker-input {
    position: absolute;
    opacity: 0;
    width: 100%;
    height: 100%;
    cursor: pointer;
  }

  .hex-text-input {
    width: 90px;
    padding: 5px 8px;
    border-radius: 6px;
    border: 1px solid var(--color-neutral-300);
    font-family: monospace;
    font-size: 13px;
    font-weight: 700;
    text-transform: uppercase;
    color: var(--color-neutral-800);
    background: var(--color-white);
  }

  .full-width {
    grid-column: 1 / -1;
  }

  h3 {
    margin: 0;
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
