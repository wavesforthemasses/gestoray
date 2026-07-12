<script lang="ts">
  import { Scale, Percent, Save } from '@lucide/svelte';
  import { Card } from '$lib';

  interface Props {
    settings: {
      qualificationMode: string;
      discountPenalty: string;
    };
    submitting: boolean;
    onSubmit: (e: Event) => void;
  }

  let {
    settings = $bindable(),
    submitting,
    onSubmit
  } = $props();
</script>

<form onsubmit={onSubmit} class="vertical-layout-stack">
  <Card title="Regole di Calcolo Generali" description="Definisci le logiche matematiche globali per il calcolo delle provvigioni dell'agenzia.">
    <div class="settings-grid">
      
      <div class="setting-group">
        <label class="setting-label">
          <Scale size={16} /> Metodo di Valutazione Qualifica
        </label>
        <p class="setting-desc">Stabilisce quale percentuale base assegnare al commerciale durante il calcolo.</p>
        <div class="radio-options">
          <label class="radio-label">
            <input type="radio" bind:group={settings.qualificationMode} value="historical" />
            <div>
              <strong>Storica (Consigliato)</strong>
              <span>Usa la percentuale della qualifica che l'agente aveva al momento della firma del contratto.</span>
            </div>
          </label>
          <label class="radio-label">
            <input type="radio" bind:group={settings.qualificationMode} value="current" />
            <div>
              <strong>Attuale</strong>
              <span>Usa la percentuale della qualifica che l'agente ha adesso (al momento del calcolo).</span>
            </div>
          </label>
        </div>
      </div>

      <div class="setting-group">
        <label class="setting-label">
          <Percent size={16} /> Penalizzazione per Sconti al Cliente
        </label>
        <p class="setting-desc">Definisce come viene ridotta la provvigione dell'agente se vende a un prezzo inferiore al Listino.</p>
        <div class="radio-options">
          <label class="radio-label">
            <input type="radio" bind:group={settings.discountPenalty} value="linear" />
            <div>
              <strong>Proporzionale Lineare (Consigliato)</strong>
              <span>La provvigione scende gradualmente fino allo 0% quando il prezzo di vendita si avvicina al Prezzo Minimo del servizio.</span>
            </div>
          </label>
          <label class="radio-label">
            <input type="radio" bind:group={settings.discountPenalty} value="none" />
            <div>
              <strong>Nessuna Penalizzazione</strong>
              <span>L'agente prende sempre la % piena, a prescindere dallo sconto (purché il prezzo sia maggiore o uguale al Prezzo Minimo).</span>
            </div>
          </label>
        </div>
      </div>

    </div>
  </Card>

  <div class="form-actions">
    <button type="submit" class="save-btn" disabled={submitting}>
      {#if submitting}
        <span class="spinner-small"></span> Salvataggio...
      {:else}
        <Save size={16} /> Salva Impostazioni
      {/if}
    </button>
  </div>
</form>

<style>
  .vertical-layout-stack { 
    display: flex; 
    flex-direction: column; 
    gap: 24px; 
  }
  
  .settings-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
  }
  @media (max-width: 768px) {
    .settings-grid {
      grid-template-columns: 1fr;
    }
  }

  .setting-group {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .setting-label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 16px;
    font-weight: 600;
    color: var(--color-neutral-800);
  }
  .setting-desc {
    font-size: 13px;
    color: var(--color-neutral-500);
    margin: 0 0 8px 0;
  }
  
  .radio-options {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  
  .radio-label {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 16px;
    border: 1px solid var(--color-neutral-200);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: all 0.2s;
  }
  .radio-label:hover {
    border-color: var(--color-primary-300);
    background: var(--color-primary-50);
  }
  .radio-label input:checked + div strong {
    color: var(--color-primary-600);
  }
  .radio-label input:checked {
    accent-color: var(--color-primary-500);
  }
  
  .radio-label div {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .radio-label strong {
    font-size: 14px;
    font-weight: 600;
    color: var(--color-neutral-800);
  }
  .radio-label span {
    font-size: 12px;
    color: var(--color-neutral-500);
    line-height: 1.4;
  }

  .form-actions {
    display: flex;
    justify-content: flex-end;
  }

  .save-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: linear-gradient(135deg, var(--color-primary-500), var(--color-primary-600));
    color: var(--color-white);
    border: none;
    padding: 12px 24px;
    border-radius: var(--radius-md);
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    box-shadow: 0 4px 12px hsla(var(--brand-h), var(--brand-s), var(--brand-l), 0.2);
  }
  .save-btn:hover:not(:disabled) {
    opacity: 0.9;
  }
  .save-btn:disabled {
    opacity: 0.7;
    cursor: not-allowed;
    box-shadow: none;
  }
  
  .spinner-small {
    width: 14px; 
    height: 14px; 
    border: 2px solid hsla(var(--brand-h), var(--brand-s), var(--brand-l), 0.15);
    border-radius: 50%;
    border-top-color: white;
    animation: spin 1s linear infinite;
  }

  @keyframes spin { 
    to { transform: rotate(360deg); } 
  }
</style>
