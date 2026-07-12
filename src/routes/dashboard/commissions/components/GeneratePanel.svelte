<script lang="ts">
  import { Card } from '$lib';
  import { Settings, Save, Unlock } from '@lucide/svelte';

  interface Props {
    hasAnyFinalized: boolean;
    loading: boolean;
    generating: boolean;
    onCalculate: () => void;
  }

  let { hasAnyFinalized, loading, generating, onCalculate } = $props();
</script>

<div class="panel-generate">
  <Card title="Nuovo Calcolo Provvigioni" description="Scegli la modalità con cui calcolare le provvigioni e salva una nuova versione.">
    {#snippet icon()}
      <Settings size={20} class="icon-accent" />
    {/snippet}

    <div class="calculation-settings">
      <div class="info-box">
        <p>Il motore calcolerà le provvigioni analizzando gli incassi del mese e applicando le regole di calcolo impostate nella sezione <strong>Impostazioni &gt; Provvigioni</strong>.</p>
      </div>

      <button class="generate-btn" onclick={onCalculate} disabled={loading || generating}>
        {#if generating}
          <span class="spinner-small"></span> Elaborazione in corso...
        {:else}
          {#if hasAnyFinalized}
            <Unlock size={16} /> Sblocca e Genera Nuova Bozza
          {:else}
            <Save size={16} /> Genera Nuova Bozza
          {/if}
        {/if}
      </button>
    </div>
  </Card>
</div>

<style>
  :global(.icon-accent) {
    color: var(--color-primary-500);
  }

  .panel-generate {
    flex: 2;
    min-width: 400px;
  }

  .calculation-settings {
    display: flex;
    align-items: flex-end;
    gap: 16px;
    margin-top: 16px;
    flex-wrap: wrap;
  }

  .info-box {
    background: var(--color-primary-50);
    border: 1px solid var(--color-primary-100);
    padding: 12px 16px;
    border-radius: var(--radius-md);
    color: var(--color-primary-800);
    font-size: 13.5px;
    line-height: 1.5;
  }
  .info-box p {
    margin: 0;
  }

  .generate-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    background: var(--color-primary-600);
    color: white;
    border: none;
    border-radius: var(--radius-sm);
    padding: 0 16px;
    height: 38px;
    font-weight: 600;
    font-size: 13px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .generate-btn:hover:not(:disabled) {
    background: var(--color-primary-700);
  }
  
  .generate-btn:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  .spinner-small {
    display: inline-block;
    width: 14px;
    height: 14px;
    border: 2px solid rgba(255,255,255,0.3);
    border-radius: 50%;
    border-top-color: #fff;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>
