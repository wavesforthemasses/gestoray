<script lang="ts">
  import { onMount } from 'svelte';
  import { ContractSettingsService } from '../../contracts/contractSettingsService';
  import type { ContractSettings, ContractType, NonRecurringEndDateMode } from '../../contracts/schema';

  import { toast } from '$lib/stores/toast.svelte';
  import { Card, FormField, Button } from '$lib';
  import { FileText, Save, RefreshCw, Hash, Settings, Calendar } from '@lucide/svelte';

  let settings = $state<ContractSettings>({
    entityNaming: 'contract',
    prefix: 'CTR-',
    includeYear: true,
    numberPadding: 4,
    lastNumber: 0,
    resetCounterAnnually: true,
    lastCounterYear: new Date().getFullYear(),
    allowedTypes: ['Ricorrente', 'Non Ricorrente'],
    defaultInitialStatus: 'bozza',
    defaultTermsAndConditions: '',
    nonRecurringEndDateMode: 'optional'
  });

  let loading = $state(true);
  let saving = $state(false);

  const ALL_CONTRACT_TYPES: ContractType[] = [
    'Ricorrente',
    'Non Ricorrente'
  ];

  onMount(async () => {
    try {
      const s = await ContractSettingsService.getSettings();
      settings = {
        ...s,
        allowedTypes: s.allowedTypes && s.allowedTypes.length > 0 
          ? s.allowedTypes 
          : ['Ricorrente', 'Non Ricorrente'],
        nonRecurringEndDateMode: s.nonRecurringEndDateMode || 'optional'
      };
    } catch (e) {
      console.error('Errore caricamento impostazioni contratti:', e);
      toast.error('Impossibile caricare le impostazioni');
    } finally {
      loading = false;
    }
  });

  function toggleType(type: ContractType) {
    let current = settings.allowedTypes || [];
    if (current.includes(type)) {
      if (current.length === 1) {
        toast.info('Devi mantenere abilitata almeno una tipologia contrattuale');
        return;
      }
      settings.allowedTypes = current.filter(t => t !== type);
    } else {
      settings.allowedTypes = [...current, type];
    }
  }

  async function handleSave(e: Event) {
    e.preventDefault();
    saving = true;
    try {
      await ContractSettingsService.saveSettings(settings);
      toast.success('Impostazioni salvate con successo!');
    } catch (err: any) {
      console.error('Errore salvataggio impostazioni:', err);
      toast.error('Errore salvataggio impostazioni: ' + err.message);
    } finally {
      saving = false;
    }
  }

  function handleResetCounter() {
    if (confirm('Sei sicuro di voler azzerare il contatore numerico progressivo a 0?')) {
      settings.lastNumber = 0;
      toast.info('Contatore azzerato. Salva le impostazioni per confermare.');
    }
  }
</script>

<svelte:head>
  <title>Impostazioni Contratti e Preventivi | Gestoray</title>
</svelte:head>

<div class="contracts-settings-page animate-fade-in">
  <div class="page-top-actions">
    <div>
      <h2 class="title-header">
        <Settings size={28} color="var(--color-primary-600)" />
        Impostazioni Contratti & Preventivi
      </h2>
      <p class="subtitle">Configura la denominazione ufficiale, il formato di numerazione automatica, le tipologie abilitate e la gestione della data di scadenza.</p>
    </div>
  </div>

  {#if loading}
    <div class="loading-box">Caricamento impostazioni in corso...</div>
  {:else}
    <form onsubmit={handleSave} class="settings-form">
      <!-- 1. DENOMINAZIONE E TERMINOLOGIA -->
      <Card title="Denominazione Ufficiale Modulo" description="Scegli se chiamare questo modulo 'Contratti' o 'Preventivi' in tutta l'applicazione.">
        <div class="form-grid">
          <div class="radio-group">
            <label class="radio-label {settings.entityNaming === 'contract' ? 'active' : ''}">
              <input type="radio" name="entityNaming" value="contract" bind:group={settings.entityNaming} />
              <div>
                <strong>📄 Contratti & Canoni (Predefinito)</strong>
                <p>Terminologia incentrata su Contratti, Canoni ricorrenti e Scadenze aziendali.</p>
              </div>
            </label>

            <label class="radio-label {settings.entityNaming === 'quote' ? 'active' : ''}">
              <input type="radio" name="entityNaming" value="quote" bind:group={settings.entityNaming} />
              <div>
                <strong>🏷️ Preventivi & Quotazioni</strong>
                <p>Terminologia incentrata su Preventivi commercializzati, Offerte e Quotazioni ai clienti.</p>
              </div>
            </label>
          </div>
        </div>
      </Card>

      <!-- 2. TIPOLOGIE CONTRATTUALI ABILITATE -->
      <Card title="Tipologie Contrattuali Abilitate nel Workspace" description="Seleziona quali tipologie mostrare nei form (Ricorrente / Non Ricorrente). Se è attiva una sola tipologia, verrà pre-selezionata automaticamente.">
        <div class="checkbox-group-grid">
          {#each ALL_CONTRACT_TYPES as t}
            <label class="checkbox-box-label {settings.allowedTypes?.includes(t) ? 'active' : ''}">
              <input 
                type="checkbox" 
                checked={settings.allowedTypes?.includes(t)} 
                onchange={() => toggleType(t)}
              />
              <span class="type-name">{t === 'Ricorrente' ? 'Ricorrente (Canoni & Abbonamenti)' : 'Non Ricorrente (Forniture & Quotazioni una tantum)'}</span>
            </label>
          {/each}
        </div>
      </Card>

      <!-- 3. DATA DI SCADENZA PER CONTRATTI NON RICORRENTI -->
      <Card title="Gestione Data Scadenza per Contratti Non Ricorrenti" description="Pianifica come deve comportarsi il campo 'Data Scadenza' quando l'utente crea o modifica un contratto o preventivo Non Ricorrente (una tantum).">
        <div class="grid-2">
          <FormField id="nonRecurringEndDateMode" label="MODALITÀ DATA SCADENZA PER NON RICORRENTI">
            <select id="nonRecurringEndDateMode" bind:value={settings.nonRecurringEndDateMode} class="form-select">
              <option value="optional">Opzionale (Consigliato - la data di fine è mostrata ma facoltativa)</option>
              <option value="hidden">Nascosta (la data di fine viene del tutto rimossa dai contratti non ricorrenti)</option>
              <option value="required">Obbligatoria (la data di fine è sempre richiesta)</option>
            </select>
          </FormField>
        </div>
      </Card>

      <!-- 4. STATO INIZIALE & VALORI PREDEFINITI -->
      <Card title="Stato Iniziale & Valori Predefiniti Documento" description="Configura lo stato predefinito (Bozza) ed i termini contrattuali standard per i nuovi documenti.">
        <div class="grid-2">
          <FormField id="defaultInitialStatus" label="STATO INIZIALE PREDEFINITO PER NUOVI DOCUMENTI">
            <select id="defaultInitialStatus" bind:value={settings.defaultInitialStatus} class="form-select">
              <option value="bozza">Bozza (Consigliato)</option>
              <option value="inviato">Inviato al Cliente</option>
              <option value="attivo">Attivo / Accettato</option>
            </select>
          </FormField>
        </div>

        <div class="form-group margin-top-12">
          <label for="defaultTerms">Termini & Condizioni Predefiniti (Footer Documento)</label>
          <textarea id="defaultTerms" bind:value={settings.defaultTermsAndConditions} rows="3" placeholder="es. Offerta valida 30 giorni dalla data di emissione. Pagamento come da accordi contrattuali..."></textarea>
        </div>
      </Card>

      <!-- 5. FORMATO NUMERAZIONE AUTOMATICA -->
      <Card title="Formato Numerazione Automatica" description="Personalizza il prefisso, l'anno e la lunghezza delle cifre del numero sequenziale.">
        <div class="grid-2">
          <FormField id="prefix" label="PREFISSO NUMERAZIONE">
            <input type="text" id="prefix" bind:value={settings.prefix} placeholder="es. CTR- oppure PREV-" />
          </FormField>

          <FormField id="numberPadding" label="NUMERO DI CIFRE (ZERO PADDING)">
            <input type="number" id="numberPadding" bind:value={settings.numberPadding} min="1" max="8" />
          </FormField>
        </div>

        <div class="toggles-grid margin-top-12">
          <label class="checkbox-label">
            <input type="checkbox" bind:checked={settings.includeYear} />
            <span>Includi l'anno corrente nel numero (es. {settings.prefix || ''}{new Date().getFullYear()}-0001)</span>
          </label>

          <label class="checkbox-label">
            <input type="checkbox" bind:checked={settings.resetCounterAnnually} />
            <span>Azzera automaticamente il contatore progressivo ad ogni nuovo anno solare</span>
          </label>
        </div>
      </Card>

      <!-- 6. GESTIONE CONTATORE PROGRESSIVO -->
      <Card title="Contatore Progressivo Attuale" description="Visualizza e modifica manualmente l'ultimo numero progressivo generato.">
        <div class="grid-2 align-end">
          <FormField id="lastNumber" label="ULTIMO NUMERO PROGRESSIVO GENERATO">
            <input type="number" id="lastNumber" bind:value={settings.lastNumber} min="0" />
          </FormField>

          <div class="actions-row">
            <button type="button" class="btn-secondary" onclick={handleResetCounter}>
              <RefreshCw size={16} /> Azzerati Contatore a 0
            </button>
          </div>
        </div>
      </Card>

      <!-- BOTTONE SALVATAGGIO -->
      <div class="submit-bar">
        <button type="submit" class="btn-primary" disabled={saving}>
          <Save size={18} /> {saving ? 'Salvataggio in corso...' : 'Salva Impostazioni'}
        </button>
      </div>
    </form>
  {/if}
</div>

<style>
  .contracts-settings-page {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .title-header {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 24px;
    font-weight: 700;
    margin: 0 0 4px 0;
  }

  .subtitle {
    font-size: 14px;
    color: var(--color-neutral-500, #6b7280);
    margin: 0;
  }

  .settings-form {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .radio-group {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 16px;
  }

  .radio-label {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 16px;
    border: 1px solid var(--border-color, #e2e8f0);
    border-radius: 10px;
    cursor: pointer;
    background: var(--bg-surface, #ffffff);
  }

  .radio-label.active {
    border-color: var(--color-primary, #2563eb);
    background: var(--bg-subtle, #f8fafc);
  }

  .radio-label p {
    font-size: 0.8125rem;
    color: var(--text-muted, #64748b);
    margin: 4px 0 0 0;
  }

  .checkbox-group-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: 12px;
  }

  .checkbox-box-label {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 14px;
    border: 1px solid var(--border-color, #e2e8f0);
    border-radius: 8px;
    cursor: pointer;
    background: var(--bg-surface, #ffffff);
    font-size: 0.875rem;
    font-weight: 500;
  }

  .checkbox-box-label.active {
    border-color: var(--color-primary, #2563eb);
    background: var(--bg-subtle, #f8fafc);
    color: var(--color-primary, #2563eb);
    font-weight: 600;
  }

  .grid-2 {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: 16px;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .form-group label {
    font-size: 0.875rem;
    font-weight: 600;
  }

  .form-select, textarea {
    padding: 10px 12px;
    border-radius: 8px;
    border: 1px solid var(--border-color, #cbd5e1);
    font-size: 0.875rem;
    background: var(--bg-surface, #ffffff);
    color: var(--text-main, #334155);
  }

  .checkbox-label {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: 0.875rem;
    cursor: pointer;
  }

  .toggles-grid {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .actions-row {
    display: flex;
    align-items: center;
    padding-bottom: 2px;
  }

  .btn-secondary {
    background: var(--bg-surface, #ffffff);
    border: 1px solid var(--border-color, #cbd5e1);
    padding: 10px 16px;
    border-radius: 8px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .submit-bar {
    display: flex;
    justify-content: flex-end;
    padding: 12px 0;
  }

  .btn-primary {
    background: var(--color-primary, #2563eb);
    color: #ffffff;
    border: none;
    padding: 12px 24px;
    border-radius: 8px;
    font-size: 0.9375rem;
    font-weight: 600;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }

  .loading-box {
    padding: 40px;
    text-align: center;
    color: var(--text-muted, #64748b);
  }

  .margin-top-12 { margin-top: 12px; }
  .align-end { align-items: flex-end; }
</style>
