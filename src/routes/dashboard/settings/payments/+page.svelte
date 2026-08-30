<script lang="ts">
  import { projectStore } from '$lib/stores/project';
  import { onMount } from 'svelte';
  import { PaymentSettingsService, DEFAULT_VAT_RATES, DEFAULT_PAYMENT_METHODS } from '../../payments/paymentSettingsService';
  import type { PaymentSettings, VatRateOption, PaymentMethodOption } from '../../payments/schema';
  import { toast } from '$lib/stores/toast.svelte';
  import { Card, FormField, Button } from '$lib';
  import { Settings, CreditCard, Save, Percent, Plus, Trash2, ShieldCheck, Lock } from '@lucide/svelte';

  let settings = $state<PaymentSettings>({
    entityNaming: 'payment',
    prefix: 'INC-',
    includeYear: true,
    numberPadding: 4,
    lastNumber: 0,
    resetCounterAnnually: true,
    defaultVatRate: 22,
    defaultMethod: 'bonifico',
    vatRates: [...DEFAULT_VAT_RATES],
    paymentMethods: [...DEFAULT_PAYMENT_METHODS]
  });

  let loading = $state(true);
  let saving = $state(false);

  // Nuova aliquota IVA temporanea
  let newVatRate = $state<number>(5);
  let newVatLabel = $state<string>('5% (Agevolata / Erogazioni)');

  // Nuovo metodo di pagamento temporaneo
  let newMethodLabel = $state<string>('');

  onMount(async () => {
    try {
      settings = await PaymentSettingsService.getSettings();
      if (!settings.vatRates || settings.vatRates.length === 0) {
        settings.vatRates = [...DEFAULT_VAT_RATES];
      }
      if (!settings.paymentMethods || settings.paymentMethods.length === 0) {
        settings.paymentMethods = [...DEFAULT_PAYMENT_METHODS];
      }
    } catch (e) {
      console.error('Errore caricamento impostazioni incassi:', e);
    } finally {
      loading = false;
    }
  });

  // GESTIONE ALIQUOTE IVA
  function handleAddVatRate() {
    if (newVatRate == null || newVatRate < 0 || newVatRate > 100) {
      toast.error('Inserisci una percentuale IVA valida tra 0 e 100');
      return;
    }
    if (!newVatLabel.trim()) {
      toast.error('Inserisci una descrizione per l\'aliquota IVA');
      return;
    }

    const exists = (settings.vatRates || []).some(v => v.rate === newVatRate);
    if (exists) {
      toast.error(`Un'aliquota con il ${newVatRate}% è già presente`);
      return;
    }

    settings.vatRates = [
      ...(settings.vatRates || []),
      { rate: newVatRate, label: newVatLabel.trim() }
    ];
    newVatRate = 0;
    newVatLabel = '';
    toast.success('Aliquota IVA aggiunta alla lista');
  }

  function handleRemoveVatRate(rateToRemove: number) {
    if ((settings.vatRates || []).length <= 1) {
      toast.error('Deve rimanere almeno un\'aliquota IVA configurata');
      return;
    }
    settings.vatRates = (settings.vatRates || []).filter(v => v.rate !== rateToRemove);
    if (settings.defaultVatRate === rateToRemove) {
      settings.defaultVatRate = settings.vatRates[0]?.rate || 22;
    }
    toast.success('Aliquota IVA rimossa');
  }

  // GESTIONE METODI DI PAGAMENTO
  function handleAddPaymentMethod() {
    if (!newMethodLabel.trim()) {
      toast.error('Inserisci il nome del nuovo metodo di pagamento');
      return;
    }

    const cleanLabel = newMethodLabel.trim();
    const generatedId = 'custom_' + cleanLabel.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 20);

    const exists = (settings.paymentMethods || []).some(m => m.id === generatedId || m.label.toLowerCase() === cleanLabel.toLowerCase());
    if (exists) {
      toast.error('Un metodo con questo nome è già presente');
      return;
    }

    settings.paymentMethods = [
      ...(settings.paymentMethods || []),
      { id: generatedId, label: cleanLabel, enabled: true, isSystem: false }
    ];
    newMethodLabel = '';
    toast.success('Nuovo metodo di pagamento aggiunto');
  }

  function handleRemovePaymentMethod(methodId: string) {
    const target = (settings.paymentMethods || []).find(m => m.id === methodId);
    if (target?.isSystem) {
      toast.error('I metodi di sistema non possono essere eliminati: puoi disattivarli.');
      return;
    }

    settings.paymentMethods = (settings.paymentMethods || []).filter(m => m.id !== methodId);
    if (settings.defaultMethod === methodId) {
      const firstEnabled = settings.paymentMethods.find(m => m.enabled);
      settings.defaultMethod = firstEnabled ? firstEnabled.id : 'bonifico';
    }
    toast.success('Metodo personalizzato rimosso');
  }

  function toggleMethod(method: PaymentMethodOption) {
    method.enabled = !method.enabled;
    // Se disattiviamo il default, spostiamo il default sul primo abilitato
    if (!method.enabled && settings.defaultMethod === method.id) {
      const anotherEnabled = (settings.paymentMethods || []).find(m => m.enabled && m.id !== method.id);
      if (anotherEnabled) {
        settings.defaultMethod = anotherEnabled.id;
      }
    }
  }

  async function handleSave(e: SubmitEvent) {
    e.preventDefault();
    saving = true;
    try {
      await PaymentSettingsService.saveSettings(settings);
      toast.success('Impostazioni incassi salvate con successo!');
    } catch (e: any) {
      toast.error('Errore salvataggio: ' + e.message);
    } finally {
      saving = false;
    }
  }
</script>

<svelte:head>
  <title>Impostazioni Incassi & Cassa | {$projectStore?.projectName || 'ERP'}</title>
</svelte:head>

<div class="settings-page animate-fade-in">
  <header class="page-header">
    <div>
      <h1 class="page-title"><Settings size={24} /> Impostazioni Incassi & Cassa</h1>
      <p class="page-subtitle">Configura prefissi, numerazione progressiva, aliquote IVA gestite e metodi di pagamento.</p>
    </div>
  </header>

  {#if loading}
    <div class="loader-box">Caricamento impostazioni...</div>
  {:else}
    <form onsubmit={handleSave} class="settings-form">
      <!-- 1. TERMINOLOGIA & NUMERAZIONE -->
      <Card title="Terminologia & Numerazione Progressiva">
        {#snippet icon()}
          <CreditCard size={20} class="icon-accent" />
        {/snippet}

        <div class="form-grid">
          <FormField id="naming" label="Denominazione Entità">
            <select id="naming" bind:value={settings.entityNaming} class="form-control">
              <option value="payment">Incassi (Incasso)</option>
              <option value="receipt">Ricevute (Ricevuta)</option>
              <option value="income">Entrate (Entrata)</option>
            </select>
          </FormField>

          <FormField id="prefix" label="Prefisso Codice">
            <input type="text" id="prefix" bind:value={settings.prefix} placeholder="INC-" class="form-control" />
          </FormField>

          <FormField id="padding" label="Lunghezza Cifre (Padding)">
            <input type="number" id="padding" bind:value={settings.numberPadding} min="1" max="8" class="form-control" />
          </FormField>

          <FormField id="lastNum" label="Ultimo Numero Utilizzato">
            <input type="number" id="lastNum" bind:value={settings.lastNumber} min="0" class="form-control" />
          </FormField>
        </div>

        <div class="checkbox-row margin-top-12">
          <label class="checkbox-label">
            <input type="checkbox" bind:checked={settings.includeYear} />
            <span>Includi anno corrente nella numerazione (es. <code>INC-2026-0001</code>)</span>
          </label>
        </div>

        <div class="checkbox-row margin-top-8">
          <label class="checkbox-label">
            <input type="checkbox" bind:checked={settings.resetCounterAnnually} />
            <span>Resetta contatore progressivo automaticamente ad inizio anno</span>
          </label>
        </div>
      </Card>

      <!-- 2. METODI DI PAGAMENTO GESTITI -->
      <Card title="Metodi di Pagamento Gestiti" description="Attiva o disattiva i metodi di pagamento abilitati nella piattaforma. I metodi di sistema non possono essere eliminati per proteggere l'integrità dei dati storici, ma possono essere disattivati.">
        {#snippet icon()}
          <CreditCard size={20} class="icon-accent" />
        {/snippet}

        <div class="table-wrapper">
          <table class="styled-table">
            <thead>
              <tr>
                <th style="width: 220px;">Metodo di Pagamento</th>
                <th style="width: 140px;">Tipo</th>
                <th style="width: 120px;" class="text-center">Stato</th>
                <th style="width: 130px;" class="text-center">Predefinito</th>
                <th style="width: 80px;" class="text-right">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {#each (settings.paymentMethods || []) as method}
                <tr class:row-disabled={!method.enabled}>
                  <td>
                    <input 
                      type="text" 
                      bind:value={method.label} 
                      placeholder="Nome metodo..." 
                      class="form-control-inline font-medium" 
                    />
                  </td>
                  <td>
                    {#if method.isSystem}
                      <span class="badge badge-system"><ShieldCheck size={12} /> Sistema</span>
                    {:else}
                      <span class="badge badge-custom">Personalizzato</span>
                    {/if}
                  </td>
                  <td class="text-center">
                    <button 
                      type="button" 
                      class="toggle-btn" 
                      class:active={method.enabled} 
                      onclick={() => toggleMethod(method)}
                    >
                      {method.enabled ? 'Attivo' : 'Disattivo'}
                    </button>
                  </td>
                  <td class="text-center">
                    <input 
                      type="radio" 
                      name="defaultMethodGroup" 
                      value={method.id} 
                      disabled={!method.enabled}
                      checked={settings.defaultMethod === method.id}
                      onchange={() => settings.defaultMethod = method.id}
                    />
                  </td>
                  <td class="text-right">
                    {#if !method.isSystem}
                      <button 
                        type="button" 
                        class="btn-icon text-danger" 
                        title="Elimina metodo personalizzato"
                        onclick={() => handleRemovePaymentMethod(method.id)}
                      >
                        <Trash2 size={15} />
                      </button>
                    {:else}
                      <span class="icon-locked" title="Metodo di sistema: non eliminabile, solo disattivabile">
                        <Lock size={14} />
                      </span>
                    {/if}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>

        <!-- FORM AGGIUNTA METODO -->
        <div class="add-box">
          <div class="add-inputs">
            <div class="input-group-sm flex-1">
              <label for="newMethod" class="label-xs">Nome Nuovo Metodo di Pagamento</label>
              <input 
                type="text" 
                id="newMethod" 
                bind:value={newMethodLabel} 
                placeholder="es. Finanziamento Findomestic, Vaglia, Crypto..." 
                class="form-control" 
              />
            </div>

            <button type="button" class="btn btn-secondary btn-align-end" onclick={handleAddPaymentMethod}>
              <Plus size={15} /> Aggiungi Metodo
            </button>
          </div>
        </div>
      </Card>

      <!-- 3. ALIQUOTE IVA GESTITE -->
      <Card title="Aliquote IVA Gestite" description="Definisci le aliquote IVA disponibili nei moduli di incasso. Puoi aggiungere aliquote personalizzate con la relativa dicitura.">
        {#snippet icon()}
          <Percent size={20} class="icon-accent" />
        {/snippet}

        <div class="table-wrapper">
          <table class="styled-table">
            <thead>
              <tr>
                <th style="width: 120px;">Aliquota (%)</th>
                <th>Descrizione / Dicitura</th>
                <th style="width: 140px;" class="text-center">Predefinita</th>
                <th style="width: 80px;" class="text-right">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {#each (settings.vatRates || []) as vOption}
                <tr>
                  <td>
                    <strong>{vOption.rate}%</strong>
                  </td>
                  <td>
                    <input 
                      type="text" 
                      bind:value={vOption.label} 
                      placeholder="es. 22% (Ordinaria)" 
                      class="form-control-inline" 
                    />
                  </td>
                  <td class="text-center">
                    <input 
                      type="radio" 
                      name="defaultVatRateGroup" 
                      value={vOption.rate} 
                      checked={settings.defaultVatRate === vOption.rate}
                      onchange={() => settings.defaultVatRate = vOption.rate}
                    />
                  </td>
                  <td class="text-right">
                    <button 
                      type="button" 
                      class="btn-icon text-danger" 
                      title="Rimuovi aliquota"
                      onclick={() => handleRemoveVatRate(vOption.rate)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>

        <!-- FORM AGGIUNTA ALIQUOTA -->
        <div class="add-box">
          <div class="add-inputs">
            <div class="input-group-sm" style="width: 120px;">
              <label for="newVatRate" class="label-xs">Percentuale (%)</label>
              <input type="number" id="newVatRate" bind:value={newVatRate} min="0" max="100" class="form-control" />
            </div>

            <div class="input-group-sm flex-1">
              <label for="newVatLabel" class="label-xs">Descrizione / Tipo IVA</label>
              <input type="text" id="newVatLabel" bind:value={newVatLabel} placeholder="es. 5% (Agevolata / Erogazioni)" class="form-control" />
            </div>

            <button type="button" class="btn btn-secondary btn-align-end" onclick={handleAddVatRate}>
              <Plus size={15} /> Aggiungi Aliquota
            </button>
          </div>
        </div>
      </Card>

      <div class="form-actions">
        <Button type="submit" disabled={saving}>
          <Save size={16} /> {saving ? 'Salvataggio...' : 'Salva Impostazioni'}
        </Button>
      </div>
    </form>
  {/if}
</div>

<style>
  .settings-page { display: flex; flex-direction: column; gap: 20px; width: 100%; box-sizing: border-box; }
  .page-header { display: flex; justify-content: space-between; align-items: center; }
  .page-title { font-size: 24px; font-weight: 700; display: flex; align-items: center; gap: 10px; margin: 0; color: var(--color-neutral-900); }
  .page-subtitle { font-size: 14px; color: var(--color-neutral-600); margin: 4px 0 0 0; }
  .settings-form { display: flex; flex-direction: column; gap: 20px; width: 100%; }
  .form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; }
  .form-control { width: 100%; padding: 8px 12px; border: 1px solid var(--color-neutral-300); border-radius: 6px; font-size: 14px; box-sizing: border-box; }
  .form-control-inline { width: 100%; padding: 6px 10px; border: 1px solid var(--color-neutral-300); border-radius: 4px; font-size: 13px; box-sizing: border-box; }
  .font-medium { font-weight: 500; }

  .table-wrapper { width: 100%; overflow-x: auto; margin-top: 8px; border: 1px solid var(--color-neutral-200); border-radius: 8px; }
  .styled-table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
  .styled-table th { background: var(--color-neutral-50); padding: 10px 14px; text-align: left; font-weight: 600; color: var(--color-neutral-600); border-bottom: 1px solid var(--color-neutral-200); }
  .styled-table td { padding: 10px 14px; border-bottom: 1px solid var(--color-neutral-200); }
  .row-disabled td { opacity: 0.6; background: #fafafa; }

  .add-box { background: var(--color-neutral-50); border: 1px solid var(--color-neutral-200); border-radius: 8px; padding: 14px; margin-top: 14px; }
  .add-inputs { display: flex; gap: 12px; align-items: flex-end; flex-wrap: wrap; }
  .input-group-sm { display: flex; flex-direction: column; gap: 4px; }
  .label-xs { font-size: 11.5px; font-weight: 600; color: var(--color-neutral-600); }
  .flex-1 { flex: 1; min-width: 200px; }
  .btn-align-end { height: 38px; }

  .badge { display: inline-flex; align-items: center; gap: 4px; padding: 3px 8px; border-radius: 9999px; font-size: 11.5px; font-weight: 600; }
  .badge-system { background: #e0f2fe; color: #0369a1; }
  .badge-custom { background: #fef3c7; color: #b45309; }

  .toggle-btn { padding: 4px 10px; border-radius: 9999px; font-size: 12px; font-weight: 600; cursor: pointer; border: 1px solid var(--color-neutral-300); background: #f1f5f9; color: #64748b; }
  .toggle-btn.active { background: #dcfce7; color: #15803d; border-color: #86efac; }
  .icon-locked { color: var(--color-neutral-400); display: inline-flex; align-items: center; justify-content: center; }

  .checkbox-row { display: flex; align-items: center; gap: 8px; }
  .checkbox-label { font-size: 13.5px; color: var(--color-neutral-700); display: flex; align-items: center; gap: 8px; cursor: pointer; }
  .margin-top-8 { margin-top: 8px; }
  .margin-top-12 { margin-top: 12px; }
  .form-actions { display: flex; justify-content: flex-end; margin-top: 10px; }
  .loader-box { padding: 40px; text-align: center; color: var(--color-neutral-500); }
  
  .btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; border: none; }
  .btn-secondary { background: white; border: 1px solid var(--color-neutral-300); color: var(--color-neutral-700); }
  .btn-icon { background: none; border: 1px solid var(--color-neutral-300); border-radius: 4px; padding: 4px 6px; cursor: pointer; display: inline-flex; align-items: center; }
  .btn-icon:hover { background: var(--color-neutral-100); }
  .text-danger { color: #dc2626; }
  .text-center { text-align: center; }
  .text-right { text-align: right; }
  :global(.icon-accent) { color: var(--color-primary-600); }
</style>
