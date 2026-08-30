<script lang="ts">
  import { projectStore } from '$lib/stores/project';
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { authState } from '$lib/auth.svelte';
  import { PaymentsService } from '../../payments.service';
  import { PaymentSettingsService, DEFAULT_VAT_RATES, DEFAULT_PAYMENT_METHODS } from '../../paymentSettingsService';
  import { PaymentsContractsBridge, type PendingInstallmentOption } from '../../payments.contracts.bridge';
  import type { PaymentItem, PaymentMethod, PaymentStatus, PaymentSettings, VatRateOption, PaymentMethodOption } from '../../schema';
  import { CustomFieldsService } from '$lib/services/customFieldsService';
  import { CacheLookupService } from '$lib/services/cacheLookupService';
  import type { CustomFieldDefinition, CustomFieldValues } from '$lib/types/customFields';
  import CustomFieldsRenderer from '$lib/components/CustomFieldsRenderer.svelte';
  import Autocomplete from '$lib/components/Autocomplete.svelte';
  import { toast } from '$lib/stores/toast.svelte';
  import { Card, FormField, Button } from '$lib';
  import { 
    CreditCard, 
    Euro, 
    Calendar, 
    FileText, 
    ArrowLeft, 
    Save, 
    Percent, 
    Layers, 
    Building2,
    CheckCircle2,
    Sparkles,
    RotateCcw
  } from '@lucide/svelte';

  const paymentId = $page.params.id || '';

  let settings = $state<PaymentSettings>({
    entityNaming: 'payment',
    prefix: 'INC-',
    includeYear: true,
    numberPadding: 4,
    lastNumber: 0,
    resetCounterAnnually: true,
    vatRates: [...DEFAULT_VAT_RATES]
  });
  let labels = $derived(PaymentSettingsService.getLabels(settings));

  let clients = $state<{ id: string; name: string }[]>([]);
  let clientOptions = $derived(clients.map(c => ({ id: c.id, label: c.name })));
  let customFieldsList = $state<CustomFieldDefinition[]>([]);
  let customFieldsValues = $state<CustomFieldValues>({});

  let loading = $state(true);
  let saving = $state(false);
  let errorMsg = $state('');

  // Form State
  let paymentNumber = $state('');
  let clientId = $state('');
  let clientName = $state('');
  let grossAmount = $state<number | undefined>(undefined);
  let vatRate = $state<number>(22);
  let isCustomVat = $state(false);
  let paymentDate = $state('');
  let method = $state<PaymentMethod>('bonifico');
  let transactionReference = $state('');
  let status = $state<PaymentStatus>('registrato');
  let notes = $state('');

  // Real-time VAT Math
  let effectiveVatRate = $derived(isCustomVat ? (vatRate || 0) : vatRate);
  let vatBreakdown = $derived(PaymentsService.calculateVatBreakdown(grossAmount || 0, effectiveVatRate || 0));
  let netAmount = $derived(vatBreakdown.netAmount);
  let vatAmount = $derived(vatBreakdown.vatAmount);

  // Dynamic Bridge: Contratti / Rate
  let isContractsActive = $derived(PaymentsContractsBridge.isContractsActive());
  let pendingInstallments = $state<PendingInstallmentOption[]>([]);
  let selectedAllocations = $state<Record<string, number>>({});
  let loadingContracts = $state(false);

  let enabledPaymentMethods = $derived(
    (settings.paymentMethods && settings.paymentMethods.length > 0)
      ? settings.paymentMethods.filter((m: PaymentMethodOption) => m.enabled)
      : DEFAULT_PAYMENT_METHODS.filter((m: PaymentMethodOption) => m.enabled)
  );

  onMount(async () => {
    try {
      const [s, p, cList, cf] = await Promise.all([
        PaymentSettingsService.getSettings(),
        PaymentsService.getPaymentById(paymentId),
        CacheLookupService.getLookup('clients'),
        CustomFieldsService.getFieldsForModule('payments')
      ]);
      settings = s;
      clients = cList;
      customFieldsList = cf;

      if (!p) {
        toast.error('Incasso non trovato');
        goto('/dashboard/payments');
        return;
      }

      paymentNumber = p.paymentNumber || '';
      clientId = p.clientId || '';
      clientName = p.clientName || '';
      grossAmount = p.grossAmount;
      vatRate = p.vatRate ?? 22;
      paymentDate = p.paymentDate || new Date().toISOString().slice(0, 10);
      method = (p.method as PaymentMethod) || 'bonifico';
      transactionReference = p.transactionReference || '';
      status = (p.status as PaymentStatus) || 'registrato';
      notes = p.notes || '';
      customFieldsValues = p.customFields || {};

      // Verifica se l'aliquota è una di quelle predefinite
      const isPreset = (settings.vatRates || []).some(vr => vr.rate === p.vatRate);
      isCustomVat = !isPreset;

      // Inizializza allocazioni contratti salvate
      if (Array.isArray(p.contractAllocations) && p.contractAllocations.length > 0) {
        const allocMap: Record<string, number> = {};
        p.contractAllocations.forEach(a => {
          if (a.contractId) allocMap[a.contractId] = a.amount || 0;
        });
        selectedAllocations = allocMap;
      }

      if (isContractsActive && clientId) {
        loadingContracts = true;
        try {
          pendingInstallments = await PaymentsContractsBridge.getPendingInstallmentsForClient(clientId);
        } catch (e) {
          console.warn('Errore caricamento rate contratti:', e);
        } finally {
          loadingContracts = false;
        }
      }
    } catch (e) {
      console.error('Errore caricamento dati modifica incasso:', e);
      toast.error('Errore caricamento incasso');
    } finally {
      loading = false;
    }
  });

  async function onClientSelected(selectedId: string) {
    clientId = selectedId;
    const found = clients.find(c => c.id === selectedId);
    if (found) clientName = found.name;

    selectedAllocations = {};
    if (isContractsActive && selectedId) {
      loadingContracts = true;
      try {
        pendingInstallments = await PaymentsContractsBridge.getPendingInstallmentsForClient(selectedId);
      } catch (e) {
        console.warn('Errore caricamento rate contratti:', e);
      } finally {
        loadingContracts = false;
      }
    } else {
      pendingInstallments = [];
    }
  }

  function handleVatSelect(val: string) {
    if (val === 'custom') {
      isCustomVat = true;
    } else {
      isCustomVat = false;
      vatRate = parseFloat(val);
    }
  }

  let totalAllocated = $derived(
    Object.values(selectedAllocations).reduce((acc, curr) => acc + (Number(curr) || 0), 0)
  );
  let unallocatedAmount = $derived(Math.max(0, parseFloat(((grossAmount || 0) - totalAllocated).toFixed(2))));

  function fillMaxAllocation(key: string, remainingAmount: number) {
    const currentAlloc = selectedAllocations[key] || 0;
    const available = (Number(grossAmount) || 0) - (Number(totalAllocated) || 0 - currentAlloc);
    const toAssign = Math.max(0, Math.min(available, remainingAmount));
    selectedAllocations[key] = parseFloat((Number(toAssign) || 0).toFixed(2));
  }

  function autoDistribute() {
    if (!grossAmount || grossAmount <= 0) {
      toast.info("Inserisci prima l'importo lordo del movimento.");
      return;
    }
    let available = Number(grossAmount) || 0;
    const newAllocations: Record<string, number> = {};
    for (const inst of pendingInstallments) {
      const key = inst.installmentId ? `${inst.contractId}_${inst.installmentId}` : inst.contractId;
      const rem = Number(inst.remainingAmount || 0);
      if (available <= 0 || rem <= 0) {
        newAllocations[key] = 0;
        continue;
      }
      const assign = Math.min(available, rem);
      newAllocations[key] = parseFloat((Number(assign) || 0).toFixed(2));
      available = Math.max(0, available - assign);
    }
    selectedAllocations = newAllocations;
    toast.success('Quote imputate automaticamente in base ai residui.');
  }

  function resetAllocations() {
    selectedAllocations = {};
    toast.info('Allocazioni azzerate.');
  }

  async function handleSubmit(e: Event) {
    e.preventDefault();
    errorMsg = '';

    if (!clientId) {
      errorMsg = 'Seleziona il cliente intestatario del pagamento.';
      toast.error(errorMsg);
      return;
    }

    if (!grossAmount || grossAmount <= 0) {
      errorMsg = "Inserisci un importo valido maggiore di 0.";
      toast.error(errorMsg);
      return;
    }

    if (totalAllocated > (grossAmount || 0)) {
      errorMsg = `L'importo totale allocato (€ ${(Number(totalAllocated) || 0).toFixed(2)}) supera l'importo dell'incasso (€ ${(Number(grossAmount) || 0).toFixed(2)}).`;
      toast.error(errorMsg);
      return;
    }

    const selectedClient = clients.find(c => c.id === clientId);
    const resolvedClientName = selectedClient ? selectedClient.name : clientName;

    const contractAllocations = Object.entries(selectedAllocations)
      .filter(([_, amt]) => Number(amt) > 0)
      .map(([contractId, amt]) => ({
        contractId,
        amount: Number(amt)
      }));

    saving = true;
    try {
      const payload: Partial<PaymentItem> = {
        paymentNumber: paymentNumber.trim(),
        clientId,
        clientName: resolvedClientName,
        grossAmount,
        vatRate: effectiveVatRate,
        vatAmount,
        netAmount,
        paymentDate,
        method,
        transactionReference: transactionReference.trim(),
        status,
        notes: notes.trim(),
        contractAllocations,
        customFields: customFieldsValues
      };

      await PaymentsService.updatePayment(paymentId, payload, authState.user?.uid);

      toast.success('Movimento di incasso modificato con successo');
      goto(`/dashboard/payments/${paymentId}`);
    } catch (err: any) {
      console.error('Errore aggiornamento incasso:', err);
      errorMsg = err.message || 'Si è verificato un errore durante il salvataggio.';
      toast.error(errorMsg);
    } finally {
      saving = false;
    }
  }
</script>

<svelte:head>
  <title>Modifica {labels.singular} | {$projectStore?.projectName || 'ERP'}</title>
</svelte:head>

<div class="edit-payment-page animate-fade-in">
  <header class="page-top-actions">
    <div class="header-left">
      <a href="/dashboard/payments/{paymentId}" class="back-link">
        <ArrowLeft size={16} /> Torna a Dettaglio Incasso
      </a>
      <h1 class="page-title"><CreditCard size={24} /> Modifica {labels.singular} {paymentNumber}</h1>
    </div>
  </header>

  {#if loading}
    <div class="loader-box">Caricamento dati incasso in corso...</div>
  {:else}
    <form onsubmit={handleSubmit} class="payment-form">
      {#if errorMsg}
        <div class="error-alert">
          {errorMsg}
        </div>
      {/if}

      <div class="form-grid">
        <!-- SEZIONE 1: DATI GENERALI -->
        <Card title="Dati Principali Movimento">
          <div class="grid-2-col">
            <FormField id="payNum" label="{labels.numberLabel}" required>
              <input 
                type="text" 
                bind:value={paymentNumber} 
                required 
                class="form-control font-mono"
              />
            </FormField>

            <FormField id="payDate" label="Data Registrazione" required>
              <input 
                type="date" 
                bind:value={paymentDate} 
                required 
                class="form-control"
              />
            </FormField>
          </div>

          <div class="form-group-full">
            <FormField id="clientSel" label="Cliente Pagatore" required>
              <Autocomplete 
                options={clientOptions}
                bind:value={clientId}
                placeholder="Digita per cercare il cliente..."
                onchange={(selectedId) => onClientSelected(selectedId)}
              />
            </FormField>
          </div>

          <div class="grid-2-col">
            <FormField id="payMethod" label="Metodo di Pagamento" required>
              <select bind:value={method} class="form-control">
                {#each enabledPaymentMethods as pMethod}
                  <option value={pMethod.id}>{pMethod.label}</option>
                {/each}
              </select>
            </FormField>

            <FormField id="payStatus" label="Stato Incasso">
              <select bind:value={status} class="form-control">
                <option value="registrato">Registrato / Incassato</option>
                <option value="in_verifica">In Verifica</option>
                <option value="annullato">Annullato</option>
                <option value="stornato">Stornato</option>
              </select>
            </FormField>
          </div>

          <div class="form-group-full">
            <FormField id="payRef" label="Riferimento Transazione (CRO, TRN, N° Assegno)">
              <input 
                type="text" 
                bind:value={transactionReference} 
                placeholder="es. TRN 948293849204..."
                class="form-control"
              />
            </FormField>
          </div>
        </Card>

        <!-- SEZIONE 2: IMPORTI E SCORPORO IVA -->
        <Card title="Importi & Scorporo IVA">
          <div class="grid-2-col">
            <FormField id="payGross" label="Importo Lordo Incassato (€)" required>
              <div class="input-icon-wrapper">
                <span class="input-icon"><Euro size={16} /></span>
                <input 
                  type="number" 
                  step="0.01" 
                  min="0.01" 
                  bind:value={grossAmount} 
                  required 
                  placeholder="0.00"
                  class="form-control pl-icon font-bold"
                />
              </div>
            </FormField>

            <FormField id="payVat" label="Aliquota IVA Applicata">
              <div class="vat-selection-box">
                <select 
                  class="form-control"
                  value={isCustomVat ? 'custom' : String(vatRate)} 
                  onchange={(e) => handleVatSelect((e.target as HTMLSelectElement).value)}
                >
                  {#each (settings.vatRates || DEFAULT_VAT_RATES) as vr}
                    <option value={String(vr.rate)}>{vr.label} ({vr.rate}%)</option>
                  {/each}
                  <option value="custom">Altra Aliquota (Personalizzata...)</option>
                </select>

                {#if isCustomVat}
                  <div class="custom-vat-field">
                    <input 
                      type="number" 
                      min="0" 
                      max="100" 
                      step="0.1" 
                      bind:value={vatRate} 
                      placeholder="%" 
                      class="form-control vat-mini-input"
                    />
                    <span class="vat-unit">%</span>
                  </div>
                {/if}
              </div>
            </FormField>
          </div>

          <!-- COMPUTED FINANCIAL PREVIEW -->
          <div class="computed-breakdown-card">
            <div class="breakdown-item">
              <span class="lbl">Imponibile Netto:</span>
              <span class="val text-success">€ {netAmount.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div class="breakdown-item">
              <span class="lbl">Quota IVA ({effectiveVatRate}%):</span>
              <span class="val text-warning">€ {vatAmount.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div class="breakdown-item total">
              <span class="lbl">Totale Movimento:</span>
              <span class="val">€ {(grossAmount || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          </div>
        </Card>
      </div>

      <!-- SEZIONE 3: ALLOCAZIONE CONTRATTI / RATE -->
      {#if isContractsActive}
        <Card title="Riconciliazione Contratti & Quote">
          {#if loadingContracts}
            <div class="loader-box-sm">Ricerca contratti attivi per il cliente...</div>
          {:else if !clientId}
            <p class="section-hint">Seleziona prima un cliente per visualizzare i contratti e le rate da riconciliare.</p>
          {:else if pendingInstallments.length === 0}
            <p class="section-hint">Nessuna rata o contratto in attesa di saldo trovato per questo cliente. L'incasso verrà registrato a cassa generale libera.</p>
          {:else}
            <div class="bridge-actions-bar">
              <button type="button" class="btn btn-secondary btn-sm" onclick={autoDistribute}>
                <Sparkles size={14} /> Compila Automaticamente su Residui
              </button>
              {#if totalAllocated > 0}
                <button type="button" class="btn btn-outline-danger btn-sm" onclick={resetAllocations}>
                  <RotateCcw size={14} /> Azzera
                </button>
              {/if}
            </div>

            <div class="table-wrapper">
              <table class="allocations-table">
                <thead>
                  <tr>
                    <th>Contratto</th>
                    <th>Scadenza / Oggetto</th>
                    <th class="text-right">Totale Contratto</th>
                    <th class="text-right">Già Saldato</th>
                    <th class="text-right">Residuo</th>
                    <th class="text-right">Quota da Imputare (€)</th>
                  </tr>
                </thead>
                <tbody>
                  {#each pendingInstallments as inst}
                    {@const key = inst.installmentId ? `${inst.contractId}_${inst.installmentId}` : inst.contractId}
                    {@const exp = Number(inst.expectedAmount || 0)}
                    {@const paid = Number(inst.paidAmount || 0)}
                    {@const rem = Number(inst.remainingAmount || 0)}
                    <tr>
                      <td><strong>{inst.contractNumber}</strong></td>
                      <td>
                        {inst.contractTitle || 'Contratto'}
                        {#if inst.installmentNumber}
                          <span class="text-sub">(Rata #{inst.installmentNumber})</span>
                        {/if}
                        <span class="text-sub"> - {inst.dueDate || 'A vista'}</span>
                      </td>
                      <td class="text-right">€ {(Number(exp) || 0).toFixed(2)}</td>
                      <td class="text-right text-success">€ {(Number(paid) || 0).toFixed(2)}</td>
                      <td class="text-right text-warning font-bold">€ {(Number(rem) || 0).toFixed(2)}</td>
                      <td class="text-right">
                        <div class="alloc-input-group">
                          <input 
                            type="number" 
                            step="0.01" 
                            min="0" 
                            max={grossAmount || rem}
                            bind:value={selectedAllocations[key]}
                            placeholder="0.00"
                            class="alloc-input"
                          />
                          <button 
                            type="button" 
                            class="btn-quick-max" 
                            onclick={() => fillMaxAllocation(key, rem)}
                            title="Compila intero residuo (€ {(Number(rem) || 0).toFixed(2)})"
                          >
                            Max
                          </button>
                        </div>
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>

            <div class="allocation-summary">
              <div><strong>Totale Allocato:</strong> € {(Number(totalAllocated) || 0).toFixed(2)}</div>
              <div><strong>Quota Libera Non Allocata:</strong> € {(Number(unallocatedAmount) || 0).toFixed(2)}</div>
            </div>
          {/if}
        </Card>
      {/if}

      <!-- SEZIONE 4: CAMPI PERSONALIZZATI & NOTE -->
      <Card title="Dettagli Aggiuntivi & Note">
        {#if customFieldsList.length > 0}
          <div class="custom-fields-box">
            <CustomFieldsRenderer 
              definitions={customFieldsList} 
              bind:values={customFieldsValues} 
            />
          </div>
        {/if}

        <div class="form-group-full">
          <FormField id="payNotes" label="Note & Causale">
            <textarea 
              bind:value={notes} 
              rows="3" 
              placeholder="Inserisci eventuali annotazioni o dettagli per la riconciliazione contabile..."
              class="form-control"
            ></textarea>
          </FormField>
        </div>
      </Card>

      <!-- SUBMIT ACTION BAR -->
      <div class="form-actions-bar">
        <a href="/dashboard/payments/{paymentId}" class="btn btn-secondary">Annulla</a>
        <button type="submit" class="btn btn-primary" disabled={saving}>
          <Save size={16} /> {saving ? 'Salvataggio in corso...' : 'Salva Modifiche Incasso'}
        </button>
      </div>
    </form>
  {/if}
</div>

<style>
  .edit-payment-page { display: flex; flex-direction: column; gap: 20px; width: 100%; max-width: 1100px; margin: 0 auto; box-sizing: border-box; }
  .page-top-actions { display: flex; justify-content: space-between; align-items: center; }
  .header-left { display: flex; flex-direction: column; gap: 6px; }
  .back-link { display: inline-flex; align-items: center; gap: 6px; font-size: 13.5px; color: var(--color-neutral-600); text-decoration: none; font-weight: 500; width: fit-content; white-space: nowrap; }
  .back-link:hover { color: var(--color-primary-600); }
  .page-title { font-size: 22px; font-weight: 700; margin: 0; display: flex; align-items: center; gap: 8px; color: var(--color-neutral-900); }

  .payment-form { display: flex; flex-direction: column; gap: 20px; }
  .form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(480px, 1fr)); gap: 20px; }
  .grid-2-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 14px; }
  .form-group-full { margin-bottom: 14px; }

  .form-control { width: 100%; padding: 8px 12px; border: 1px solid var(--color-neutral-300); border-radius: 6px; font-size: 13.5px; box-sizing: border-box; background: white; }
  .font-mono { font-family: monospace; font-size: 14px; }
  .font-bold { font-weight: 700; }
  
  .input-icon-wrapper { position: relative; }
  .input-icon { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--color-neutral-500); }
  .pl-icon { padding-left: 32px; font-size: 15px; }

  .vat-selection-box { display: flex; gap: 8px; align-items: center; }
  .custom-vat-field { display: flex; align-items: center; gap: 4px; }
  .vat-mini-input { width: 70px; text-align: center; }
  .vat-unit { font-size: 13px; font-weight: 600; color: var(--color-neutral-600); }

  .computed-breakdown-card { background: var(--color-neutral-50); border: 1px dashed var(--color-neutral-300); border-radius: 8px; padding: 14px; display: flex; flex-direction: column; gap: 8px; margin-top: 10px; }
  .breakdown-item { display: flex; justify-content: space-between; font-size: 13.5px; color: var(--color-neutral-700); }
  .breakdown-item.total { border-top: 1px solid var(--color-neutral-200); padding-top: 8px; font-weight: 700; font-size: 15px; color: var(--color-neutral-900); }
  .text-success { color: #16a34a; font-weight: 600; }
  .text-warning { color: #d97706; font-weight: 600; }

  .allocations-table { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 10px; }
  .allocations-table th { background: var(--color-neutral-50); padding: 10px; text-align: left; border-bottom: 1px solid var(--color-neutral-200); color: var(--color-neutral-600); }
  .allocations-table td { padding: 10px; border-bottom: 1px solid var(--color-neutral-200); }
  .alloc-input { width: 100px; padding: 6px; border: 1px solid var(--color-neutral-300); border-radius: 4px; text-align: right; font-weight: 600; }
  .allocation-summary { display: flex; justify-content: flex-end; gap: 20px; padding: 12px 0; font-size: 13.5px; }

  .section-hint { font-size: 13.5px; color: var(--color-neutral-500); font-style: italic; margin: 8px 0; }
  .custom-fields-box { margin-bottom: 16px; }

  .bridge-actions-bar { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
  .alloc-input-group { display: inline-flex; align-items: center; gap: 4px; justify-content: flex-end; }
  .btn-quick-max { background: var(--color-neutral-100); border: 1px solid var(--color-neutral-300); color: var(--color-neutral-800); border-radius: 4px; font-size: 11px; font-weight: 700; padding: 4px 8px; cursor: pointer; text-transform: uppercase; transition: all 0.15s ease; }
  .btn-quick-max:hover { background: var(--color-primary-600); color: white; border-color: var(--color-primary-600); }
  .btn-outline-danger { background: white; border: 1px solid #fca5a5; color: #dc2626; }
  .btn-outline-danger:hover { background: #fef2f2; }
  .btn-sm { padding: 6px 12px; font-size: 12.5px; }

  .form-actions-bar { display: flex; justify-content: flex-end; gap: 12px; padding: 16px 0; border-top: 1px solid var(--color-neutral-200); }
  .btn { display: inline-flex; align-items: center; gap: 6px; padding: 9px 18px; border-radius: 6px; font-size: 13.5px; font-weight: 600; cursor: pointer; text-decoration: none; border: none; }
  .btn-primary { background: var(--color-primary-600); color: white; }
  .btn-primary:hover { background: var(--color-primary-700); }
  .btn-secondary { background: white; border: 1px solid var(--color-neutral-300); color: var(--color-neutral-700); }
  .error-alert { background: #fee2e2; border: 1px solid #f87171; color: #b91c1c; padding: 12px 16px; border-radius: 6px; font-size: 13.5px; }
  .loader-box { padding: 40px; text-align: center; color: var(--color-neutral-500); }
  .loader-box-sm { padding: 16px; text-align: center; color: var(--color-neutral-500); font-size: 13px; }
  .text-right { text-align: right; }
  .text-sub { font-size: 11.5px; color: var(--color-neutral-500); margin-top: 2px; }
</style>
