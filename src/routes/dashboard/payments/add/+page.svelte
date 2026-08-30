<script lang="ts">
  import { projectStore } from '$lib/stores/project';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { authState } from '$lib/auth.svelte';
  import { PaymentsService } from '../payments.service';
  import { PaymentSettingsService, DEFAULT_VAT_RATES, DEFAULT_PAYMENT_METHODS } from '../paymentSettingsService';
  import { PaymentsContractsBridge, type PendingInstallmentOption } from '../payments.contracts.bridge';
  import type { PaymentMethod, PaymentStatus, PaymentSettings, VatRateOption, PaymentMethodOption } from '../schema';
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
  // Pure client name mapping (ragione sociale)
  let clientOptions = $derived(clients.map(c => ({ id: c.id, label: c.name })));
  let customFieldsList = $state<CustomFieldDefinition[]>([]);
  let customFieldsValues = $state<CustomFieldValues>({});

  let loading = $state(true);
  let saving = $state(false);
  let errorMsg = $state('');

  // Form State - grossAmount starts empty
  let paymentNumber = $state('');
  let clientId = $state('');
  let grossAmount = $state<number | undefined>(undefined);
  let vatRate = $state<number>(22);
  let isCustomVat = $state(false);
  let paymentDate = $state(new Date().toISOString().slice(0, 10));
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
      const [s, pNum, cList, cf] = await Promise.all([
        PaymentSettingsService.getSettings(),
        PaymentsService.previewNextPaymentNumber(),
        CacheLookupService.getLookup('clients'),
        CustomFieldsService.getFieldsForModule('payments')
      ]);
      settings = s;
      paymentNumber = pNum;
      clients = cList;
      customFieldsList = cf;
      if (s.defaultVatRate != null) vatRate = s.defaultVatRate;
      if (s.defaultMethod) method = s.defaultMethod;
    } catch (e) {
      console.error('Errore caricamento dati creazione incasso:', e);
    } finally {
      loading = false;
    }
  });

  async function onClientSelected(selectedId: string) {
    clientId = selectedId;
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
      vatRate = Number(val);
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

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (!clientId) {
      errorMsg = 'Seleziona il cliente intestatario del pagamento.';
      toast.error(errorMsg);
      return;
    }
    if (!grossAmount || grossAmount <= 0) {
      errorMsg = 'Inserisci un importo incassato valido maggiore di zero.';
      toast.error(errorMsg);
      return;
    }

    saving = true;
    errorMsg = '';

    try {
      const selectedClient = clients.find(c => c.id === clientId);
      const clientNameStr = selectedClient ? selectedClient.name : 'Cliente';

      // 1. Crea documento Incasso Standalone
      const paymentId = await PaymentsService.createPayment({
        paymentNumber: paymentNumber.trim(),
        clientId,
        clientName: clientNameStr,
        grossAmount,
        vatRate: effectiveVatRate,
        vatAmount,
        netAmount,
        paymentDate,
        method,
        transactionReference: transactionReference.trim(),
        status,
        notes: notes.trim(),
        customFields: customFieldsValues
      }, authState.user ? { uid: authState.user.uid, email: authState.user.email || '' } : undefined);

      // 2. Se ci sono allocazioni selezionate via Bridge, registrale
      if (isContractsActive && Object.keys(selectedAllocations).length > 0 && authState.user) {
        const allocList = Object.entries(selectedAllocations)
          .filter(([_, amt]) => amt > 0)
          .map(([key, amt]) => {
            const [contractId, installmentId] = key.split('_');
            return { contractId, installmentId, amount: amt };
          });

        if (allocList.length > 0) {
          await PaymentsContractsBridge.allocatePayment(
            paymentId,
            clientId,
            clientNameStr,
            allocList,
            { uid: authState.user.uid, email: authState.user.email || '' }
          );
        }
      }

      toast.success(`${labels.singular} registrato con successo!`);
      goto(`/dashboard/payments/${paymentId}`);
    } catch (err: any) {
      console.error('Errore salvataggio incasso:', err);
      errorMsg = err.message || 'Errore durante la registrazione dell\'incasso.';
      toast.error(errorMsg);
    } finally {
      saving = false;
    }
  }
</script>

<svelte:head>
  <title>{labels.newSingular} | {$projectStore?.projectName || 'ERP'}</title>
</svelte:head>

<div class="add-payment-page animate-fade-in">
  <div class="page-top-nav">
    <a href="/dashboard/payments" class="btn-back">
      <ArrowLeft size={16} /> Torna a {labels.plural}
    </a>
  </div>

  <header class="page-header">
    <h1 class="page-title"><CreditCard size={24} /> {labels.newSingular}</h1>
    <p class="page-subtitle">Inserisci i dettagli del flusso finanziario ricevuto, scorporo IVA ed eventuale abbinamento alle rate aperte.</p>
  </header>

  {#if loading}
    <div class="loader-box">Caricamento modulo in corso...</div>
  {:else}
    {#if errorMsg}
      <div class="alert error-box">{errorMsg}</div>
    {/if}

    <form onsubmit={handleSubmit} class="payment-form">
      <!-- 1. INFORMAZIONI GENERALI -->
      <Card title="Cliente & Riferimenti">
        {#snippet icon()}
          <Building2 size={20} class="icon-accent" />
        {/snippet}

        <div class="form-grid">
          <FormField id="payNum" label="{labels.numberLabel} (Progressivo)">
            <input type="text" id="payNum" bind:value={paymentNumber} required class="form-control" />
          </FormField>

          <FormField id="clientSel" label="Cliente Intestatario *">
            <Autocomplete 
              options={clientOptions} 
              bind:value={clientId} 
              onchange={(selectedId) => onClientSelected(selectedId)} 
              placeholder="Cerca e seleziona cliente (Ragione Sociale)..." 
            />
          </FormField>

          <FormField id="payDate" label="Data Incasso *">
            <input type="date" id="payDate" bind:value={paymentDate} required class="form-control" />
          </FormField>
        </div>
      </Card>

      <!-- 2. SCORPORO IVA & IMPORTI -->
      <Card title="Importi & Scorporo IVA" description="Inserisci il totale lordo ricevuto. L'imponibile netto e l'IVA verranno calcolati automaticamente.">
        {#snippet icon()}
          <Euro size={20} class="icon-accent" />
        {/snippet}

        <div class="form-grid">
          <FormField id="grossAmt" label="Totale Lordo Incassato (€) *">
            <input 
              type="number" 
              id="grossAmt" 
              bind:value={grossAmount} 
              step="0.01" 
              min="0.01" 
              placeholder="Es. 1220.00" 
              required 
              class="form-control font-bold" 
            />
          </FormField>

          <FormField id="vatRateSelect" label="Aliquota IVA">
            <select 
              id="vatRateSelect" 
              value={isCustomVat ? 'custom' : vatRate} 
              onchange={(e) => handleVatSelect((e.target as HTMLSelectElement).value)}
              class="form-control"
            >
              {#each (settings.vatRates || DEFAULT_VAT_RATES) as vOpt}
                <option value={vOpt.rate}>{vOpt.label}</option>
              {/each}
              <option value="custom">Altra Aliquota (Personalizzata...)</option>
            </select>
          </FormField>

          {#if isCustomVat}
            <FormField id="customVatInput" label="Percentuale IVA Custom (%)">
              <input 
                type="number" 
                id="customVatInput" 
                bind:value={vatRate} 
                min="0" 
                max="100" 
                step="0.1" 
                class="form-control" 
              />
            </FormField>
          {/if}

          <div class="vat-breakdown-box">
            <div class="vat-stat-item">
              <span class="v-label">Imponibile Netto:</span>
              <strong class="v-val text-success">€ {(Number(netAmount) || 0).toFixed(2)}</strong>
            </div>
            <div class="vat-stat-item">
              <span class="v-label">Quota IVA ({effectiveVatRate}%):</span>
              <strong class="v-val text-warning">€ {(Number(vatAmount) || 0).toFixed(2)}</strong>
            </div>
          </div>
        </div>
      </Card>

      <!-- 3. METODO & TRANSAZIONE -->
      <Card title="Metodo di Pagamento & Stato">
        {#snippet icon()}
          <CreditCard size={20} class="icon-accent" />
        {/snippet}

        <div class="form-grid">
          <FormField id="method" label="Metodo di Pagamento">
            <select id="method" bind:value={method} class="form-control">
              {#each enabledPaymentMethods as pMethod}
                <option value={pMethod.id}>{pMethod.label}</option>
              {/each}
            </select>
          </FormField>

          <FormField id="ref" label="Riferimento Transazione (CRO, TRN, n. assegno)">
            <input type="text" id="ref" bind:value={transactionReference} placeholder="es. TRN 1234567890..." class="form-control" />
          </FormField>

          <FormField id="status" label="Stato Movimento">
            <select id="status" bind:value={status} class="form-control">
              <option value="registrato">Registrato (Valido / Confermato in cassa)</option>
              <option value="in_verifica">In Verifica (Sospeso / In attesa riscontro)</option>
              <option value="annullato">Annullato (Stornato / Assegno insoluto)</option>
            </select>
          </FormField>
        </div>

        <div class="form-group margin-top-12">
          <label for="notes" class="form-label">Note Amministrative</label>
          <textarea id="notes" bind:value={notes} rows="2" placeholder="Eventuali annotazioni o causali..." class="form-control"></textarea>
        </div>
      </Card>

      <!-- 4. DYNAMIC BRIDGE: ABBINAMENTO CONTRATTI & RATE (Opzionale) -->
      {#if isContractsActive && clientId}
        <Card title="Abbinamento Contratti & Rate (Dynamic Bridge)" description="Collega l'imponibile netto incassato alle scadenze contrattuali aperte del cliente.">
          {#snippet icon()}
            <Layers size={20} class="icon-accent" />
          {/snippet}

          {#if loadingContracts}
            <div class="empty-subtext">Ricerca rate aperte per il cliente...</div>
          {:else if pendingInstallments.length === 0}
            <div class="empty-subtext">Nessuna rata contrattuale aperta trovata per questo cliente. L'incasso verrà registrato a cassa generale.</div>
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

            <div class="table-wrapper margin-top-8">
              <table class="widescreen-table">
                <thead>
                  <tr>
                    <th>Contratto / Rata</th>
                    <th>Scadenza</th>
                    <th>Importo Dovuto</th>
                    <th>Restante da Saldare</th>
                    <th>Quota Assegnata (€)</th>
                  </tr>
                </thead>
                <tbody>
                  {#each pendingInstallments as inst}
                    {@const key = inst.installmentId ? `${inst.contractId}_${inst.installmentId}` : inst.contractId}
                    {@const rem = Number(inst.remainingAmount || 0)}
                    <tr>
                      <td>
                        <strong>{inst.contractNumber}</strong> - {inst.contractTitle}
                        {#if inst.installmentNumber}
                          <div class="text-sub">Rata #{inst.installmentNumber}</div>
                        {/if}
                      </td>
                      <td>{inst.dueDate || 'A vista'}</td>
                      <td>€ {(Number(inst.expectedAmount) || 0).toFixed(2)}</td>
                      <td><strong class="text-warning">€ {(Number(rem) || 0).toFixed(2)}</strong></td>
                      <td>
                        <div class="alloc-input-group">
                          <input 
                            type="number" 
                            bind:value={selectedAllocations[key]} 
                            min="0" 
                            max={grossAmount || rem}
                            step="0.01" 
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
          {/if}
        </Card>
      {/if}

      <!-- 5. CAMPI PERSONALIZZATI -->
      {#if customFieldsList.length > 0}
        <Card title="Campi Personalizzati">
          <CustomFieldsRenderer fields={customFieldsList} bind:values={customFieldsValues} />
        </Card>
      {/if}

      <div class="form-actions">
        <a href="/dashboard/payments" class="btn btn-secondary">Annulla</a>
        <Button type="submit" disabled={saving}>
          <Save size={16} /> {saving ? 'Salvataggio...' : 'Conferma e Registra Incasso'}
        </Button>
      </div>
    </form>
  {/if}
</div>

<style>
  .add-payment-page { display: flex; flex-direction: column; gap: 20px; width: 100%; box-sizing: border-box; }
  .page-top-nav { display: flex; align-items: center; }
  .btn-back { display: inline-flex; align-items: center; gap: 8px; padding: 8px 14px; background: white; border: 1px solid var(--color-neutral-300); border-radius: 8px; color: var(--color-neutral-700); font-size: 13px; font-weight: 600; text-decoration: none; white-space: nowrap; width: fit-content; box-shadow: 0 1px 2px rgba(0,0,0,0.03); }
  .btn-back:hover { background: var(--color-neutral-100); }

  .page-header { display: flex; flex-direction: column; gap: 4px; }
  .page-title { margin: 0; font-size: 24px; font-weight: 700; color: var(--color-neutral-900); display: flex; align-items: center; gap: 10px; }
  .page-subtitle { margin: 0; font-size: 14px; color: var(--color-neutral-600); }

  .payment-form { display: flex; flex-direction: column; gap: 20px; width: 100%; }
  .form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; align-items: end; }
  .form-control { width: 100%; padding: 8px 12px; border: 1px solid var(--color-neutral-300); border-radius: 6px; font-size: 14px; box-sizing: border-box; }
  .form-group { display: flex; flex-direction: column; gap: 6px; }
  .form-label { font-size: 13px; font-weight: 600; color: var(--color-neutral-700); }

  .vat-breakdown-box { background: var(--color-neutral-50); border: 1px solid var(--color-neutral-200); border-radius: 8px; padding: 10px 14px; display: flex; justify-content: space-around; }
  .vat-stat-item { display: flex; flex-direction: column; gap: 2px; }
  .v-label { font-size: 11px; color: var(--color-neutral-500); text-transform: uppercase; font-weight: 600; }
  .v-val { font-size: 15px; }

  .bridge-actions-bar { display: flex; justify-content: flex-start; align-items: center; gap: 8px; }
  .alloc-input-group { display: inline-flex; align-items: center; gap: 4px; }
  .btn-quick-max { background: var(--color-neutral-100); border: 1px solid var(--color-neutral-300); color: var(--color-neutral-800); border-radius: 4px; font-size: 11px; font-weight: 700; padding: 4px 8px; cursor: pointer; text-transform: uppercase; transition: all 0.15s ease; }
  .btn-quick-max:hover { background: var(--color-primary-600); color: white; border-color: var(--color-primary-600); }
  .btn-outline-danger { background: white; border: 1px solid #fca5a5; color: #dc2626; }
  .btn-outline-danger:hover { background: #fef2f2; }

  .table-wrapper { width: 100%; overflow-x: auto; }
  .widescreen-table { width: 100%; border-collapse: collapse; font-size: 13px; }
  .widescreen-table th { background: var(--color-neutral-50); padding: 10px 12px; text-align: left; font-weight: 600; color: var(--color-neutral-600); border-bottom: 1px solid var(--color-neutral-200); }
  .widescreen-table td { padding: 10px 12px; border-bottom: 1px solid var(--color-neutral-200); color: var(--color-neutral-800); }

  .alloc-input { width: 100px; padding: 6px 8px; border: 1px solid var(--color-neutral-300); border-radius: 4px; font-size: 13px; font-weight: 700; }
  .text-sub { font-size: 11px; color: var(--color-neutral-500); }

  .form-actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 10px; }
  .btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; text-decoration: none; border: none; }
  .btn-secondary { background: white; border: 1px solid var(--color-neutral-300); color: var(--color-neutral-700); }
  .btn-sm { padding: 6px 12px; font-size: 12px; }

  .alert { padding: 12px; border-radius: 6px; font-size: 13px; }
  .error-box { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }
  .empty-subtext { font-size: 13px; color: var(--color-neutral-500); font-style: italic; padding: 12px 0; }

  .text-success { color: #16a34a; }
  .text-warning { color: #d97706; }
  .font-bold { font-weight: 700; }
  .margin-top-8 { margin-top: 8px; }
  .margin-top-12 { margin-top: 12px; }
  :global(.icon-accent) { color: var(--color-primary-600); }
</style>
