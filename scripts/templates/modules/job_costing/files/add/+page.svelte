<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { 
    Briefcase, 
    List, 
    Save, 
    Calculator, 
    MapPin, 
    Building2, 
    Calendar, 
    DollarSign,
    Layers
  } from '@lucide/svelte';
  import { Autocomplete, type AutocompleteOption } from '$lib';
  import { db, collection, getDocs } from '$lib/firebase';
  import { JobCostingService } from '../jobCosting.service';
  import { JobCostingSettingsService } from '../jobCostingSettingsService';
  import { roundCurrency, formatCurrency } from '$lib/utils/math';

  let code = $state('');
  let title = $state('');
  let description = $state('');
  let selectedPlaceId = $state('');
  let selectedPlaceName = $state('');
  let includeSubPlaces = $state(true);
  let selectedClientId = $state('');
  let selectedClientName = $state('');
  let selectedContractId = $state('');
  let selectedContractTitle = $state('');
  let startDate = $state(new Date().toISOString().split('T')[0]);
  let expectedEndDate = $state('');
  let status = $state<'pianificata' | 'in_corso'>('in_corso');

  // Budget
  let budgetLabor = $state(0);
  let budgetMaterials = $state(0);
  let budgetEquipment = $state(0);
  let budgetSubcontractor = $state(0);
  let budgetOther = $state(0);
  let expectedRevenue = $state(0);

  let totalBudget = $derived(
    roundCurrency(
      (Number(budgetLabor) || 0) + 
      (Number(budgetMaterials) || 0) + 
      (Number(budgetEquipment) || 0) + 
      (Number(budgetSubcontractor) || 0) + 
      (Number(budgetOther) || 0)
    )
  );

  let expectedMargin = $derived(roundCurrency((Number(expectedRevenue) || 0) - totalBudget));
  let expectedMarginPercent = $derived(
    expectedRevenue > 0 ? roundCurrency((expectedMargin / expectedRevenue) * 100, 1) : 0
  );

  // Autocomplete options
  let placeOptions = $state<AutocompleteOption[]>([]);
  let clientOptions = $state<AutocompleteOption[]>([]);
  let contractOptions = $state<AutocompleteOption[]>([]);

  let saving = $state(false);
  let loadingRefs = $state(true);

  onMount(async () => {
    try {
      code = await JobCostingSettingsService.generateNextCode();
      await loadLookups();
    } catch (e) {
      console.error('Errore inizializzazione form commessa:', e);
    } finally {
      loadingRefs = false;
    }
  });

  async function loadLookups() {
    try {
      const [placesSnap, clientsSnap, contractsSnap] = await Promise.all([
        getDocs(collection(db, 'places')),
        getDocs(collection(db, 'clients')),
        getDocs(collection(db, 'contracts')).catch(() => ({ docs: [] } as any))
      ]);

      placeOptions = placesSnap.docs.map(d => {
        const p = d.data();
        return {
          id: d.id,
          label: p.name || p.code || 'Luogo senza nome',
          sublabel: p.address || p.code || undefined
        };
      });

      clientOptions = clientsSnap.docs.map(d => {
        const c = d.data();
        return {
          id: d.id,
          label: c.name || c.ragioneSociale || 'Cliente senza nome',
          sublabel: c.piva ? `P.IVA: ${c.piva}` : (c.codiceFiscale ? `C.F.: ${c.codiceFiscale}` : undefined)
        };
      });

      contractOptions = contractsSnap.docs.map((d: any) => {
        const c = d.data();
        return {
          id: d.id,
          label: c.title || c.code || 'Contratto',
          sublabel: c.totalAmount ? `Valore: ${formatCurrency(c.totalAmount)}` : undefined
        };
      });
    } catch (e) {
      console.warn('Errore lettura referenze lookups:', e);
    }
  }

  function handlePlaceSelect(id: string) {
    selectedPlaceId = id;
    const found = placeOptions.find(o => o.id === id);
    selectedPlaceName = found ? found.label : '';
  }

  function handleClientSelect(id: string) {
    selectedClientId = id;
    const found = clientOptions.find(o => o.id === id);
    selectedClientName = found ? found.label : '';
  }

  function handleContractSelect(id: string) {
    selectedContractId = id;
    const found = contractOptions.find(o => o.id === id);
    selectedContractTitle = found ? found.label : '';
  }

  async function handleSubmit(e: Event) {
    e.preventDefault();
    if (!title.trim()) {
      alert('Inserisci il titolo della commessa');
      return;
    }

    saving = true;
    try {
      const newId = await JobCostingService.createProject({
        code,
        title,
        description,
        placeId: selectedPlaceId,
        placeName: selectedPlaceName,
        includeSubPlaces,
        clientId: selectedClientId,
        clientName: selectedClientName,
        contractId: selectedContractId,
        contractTitle: selectedContractTitle,
        status,
        startDate,
        expectedEndDate,
        budget: {
          labor: Number(budgetLabor) || 0,
          materials: Number(budgetMaterials) || 0,
          equipment: Number(budgetEquipment) || 0,
          subcontractor: Number(budgetSubcontractor) || 0,
          other: Number(budgetOther) || 0,
          total: totalBudget
        },
        revenues: {
          contractValue: Number(expectedRevenue) || 0,
          invoicedTotal: 0,
          paidTotal: 0
        }
      });

      // Esegui sincronizzazione iniziale immediata
      try {
        await JobCostingService.syncProjectSources(newId);
      } catch (err) {
        console.warn('Sincronizzazione iniziale parziale:', err);
      }

      goto(`/dashboard/job_costing/${newId}`);
    } catch (err) {
      console.error('Errore creazione commessa:', err);
      alert('Errore durante il salvataggio della commessa.');
    } finally {
      saving = false;
    }
  }
</script>

<div class="job-add-page animate-fade-in">
  <!-- 1. Top Actions Bar (Principi 12 & 23) -->
  <div class="page-top-actions">
    <div class="title-with-icon">
      <div class="header-icon-box">
        <Briefcase size={22} class="text-primary" />
      </div>
      <div>
        <h1 class="page-title">Nuova Commessa di Cantiere</h1>
        <p class="page-subtitle">Imposta il cantiere, il preventivo e i tetti di spesa previsti per categoria</p>
      </div>
    </div>

    <div class="actions-group">
      <a href="/dashboard/job_costing" class="btn btn-secondary btn-module-list" title="Vai all'elenco commesse">
        <List size={16} />
        <span>Elenco Commesse</span>
      </a>
    </div>
  </div>

  <!-- 2. Form Container (100% Full-Width, Principio 15) -->
  <form onsubmit={handleSubmit} class="job-form">
    <!-- Scheda 1: Informazioni Generali -->
    <div class="card form-card">
      <div class="card-header">
        <h3 class="card-title">Dati Principali della Commessa</h3>
      </div>
      <div class="card-body form-grid">
        <div class="form-group col-3">
          <label for="pCode">Codice Commessa *</label>
          <input type="text" id="pCode" bind:value={code} class="form-control" required />
        </div>

        <div class="form-group col-9">
          <label for="pTitle">Titolo / Oggetto Commessa *</label>
          <input 
            type="text" 
            id="pTitle" 
            bind:value={title} 
            placeholder="es. Ristrutturazione Impianti e Cappotto Termico..." 
            class="form-control" 
            required 
          />
        </div>

        <div class="form-group col-6">
          <label for="pPlace">Cantiere / Luogo Collegato</label>
          <Autocomplete 
            options={placeOptions} 
            value={selectedPlaceId} 
            onchange={handlePlaceSelect} 
            placeholder="Cerca cantiere per nome o indirizzo..." 
          />
          <label class="checkbox-inline">
            <input type="checkbox" bind:checked={includeSubPlaces} />
            <span>Includi automaticamente le bolle e i movimenti dei sotto-cantieri</span>
          </label>
        </div>

        <div class="form-group col-6">
          <label for="pClient">Cliente Committente</label>
          <Autocomplete 
            options={clientOptions} 
            value={selectedClientId} 
            onchange={handleClientSelect} 
            placeholder="Cerca cliente per ragione sociale o P.IVA..." 
          />
        </div>

        <div class="form-group col-6">
          <label for="pContract">Contratto di Riferimento (Opzionale)</label>
          <Autocomplete 
            options={contractOptions} 
            value={selectedContractId} 
            onchange={handleContractSelect} 
            placeholder="Seleziona contratto per agganciare il valore..." 
          />
        </div>

        <div class="form-group col-3">
          <label for="pStart">Data Inizio *</label>
          <input type="date" id="pStart" bind:value={startDate} class="form-control" required />
        </div>

        <div class="form-group col-3">
          <label for="pEnd">Data Consegna Prevista</label>
          <input type="date" id="pEnd" bind:value={expectedEndDate} class="form-control" />
        </div>
      </div>
    </div>

    <!-- Scheda 2: Budget Preventivo & Redditività Attesa -->
    <div class="card form-card">
      <div class="card-header">
        <h3 class="card-title">Budget Preventivo di Spesa & Redditività Obiettivo</h3>
      </div>
      <div class="card-body">
        <div class="budget-grid">
          <div class="form-group">
            <label for="bLabor">Budget Manodopera (€)</label>
            <input type="number" id="bLabor" step="0.01" min="0" bind:value={budgetLabor} class="form-control" />
            <span class="field-hint">Ore operai e tecnici stimati</span>
          </div>

          <div class="form-group">
            <label for="bMat">Budget Materiali (€)</label>
            <input type="number" id="bMat" step="0.01" min="0" bind:value={budgetMaterials} class="form-control" />
            <span class="field-hint">Materiali da magazzino FIFO</span>
          </div>

          <div class="form-group">
            <label for="bEq">Budget Mezzi & Attrezzature (€)</label>
            <input type="number" id="bEq" step="0.01" min="0" bind:value={budgetEquipment} class="form-control" />
            <span class="field-hint">Ammortamento furgoni / noli</span>
          </div>

          <div class="form-group">
            <label for="bSub">Budget Subappalti (€)</label>
            <input type="number" id="bSub" step="0.01" min="0" bind:value={budgetSubcontractor} class="form-control" />
            <span class="field-hint">Imprese terze e artigiani</span>
          </div>

          <div class="form-group">
            <label for="bOth">Budget Altro (€)</label>
            <input type="number" id="bOth" step="0.01" min="0" bind:value={budgetOther} class="form-control" />
            <span class="field-hint">Spese vive e imprevisti</span>
          </div>

          <div class="form-group highlight-revenue">
            <label for="bRev">Valore Target / Ricavi Stimati (€)</label>
            <input type="number" id="bRev" step="0.01" min="0" bind:value={expectedRevenue} class="form-control" />
            <span class="field-hint">Importo totale offerta al cliente</span>
          </div>
        </div>

        <!-- Riepilogo Sintetico Budget Live -->
        <div class="budget-summary-banner">
          <div class="summary-item">
            <span class="summary-label">Totale Spesa a Budget</span>
            <span class="summary-value text-muted">{formatCurrency(totalBudget)}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">Ricavo Previsto</span>
            <span class="summary-value text-primary">{formatCurrency(expectedRevenue)}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">Utile Previsto Obiettivo</span>
            <span class="summary-value" class:text-success={expectedMargin >= 0} class:text-danger={expectedMargin < 0}>
              {formatCurrency(expectedMargin)} ({expectedMarginPercent}%)
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Pulsanti di Azione Finale -->
    <div class="form-bottom-bar">
      <a href="/dashboard/job_costing" class="btn btn-secondary">Annulla</a>
      <button type="submit" class="btn btn-primary" disabled={saving}>
        <Save size={16} />
        <span>{saving ? 'Creazione in corso...' : 'Salva e Avvia Commessa'}</span>
      </button>
    </div>
  </form>
</div>

<style>
  .job-add-page {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    width: 100%;
  }

  .page-top-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 1rem;
  }

  .title-with-icon {
    display: flex;
    align-items: center;
    gap: 0.85rem;
  }

  .header-icon-box {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    background: rgba(59, 130, 246, 0.1);
    color: #3b82f6;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .page-title {
    font-size: 1.5rem;
    font-weight: 700;
    margin: 0;
    color: var(--color-text-main, #0f172a);
  }

  .page-subtitle {
    font-size: 0.875rem;
    color: var(--color-text-muted, #64748b);
    margin: 0.15rem 0 0 0;
  }

  .btn-module-list {
    white-space: nowrap;
  }

  .job-form {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    width: 100%;
  }

  .form-card {
    background: var(--color-surface, #ffffff);
    border: 1px solid var(--color-border, #e2e8f0);
    border-radius: 14px;
    overflow: hidden;
  }

  .card-header {
    padding: 1rem 1.25rem;
    border-bottom: 1px solid var(--color-border, #e2e8f0);
    background: var(--color-bg-subtle, #f8fafc);
  }

  .card-title {
    font-size: 1rem;
    font-weight: 600;
    color: var(--color-text-main, #1e293b);
    margin: 0;
  }

  .card-body {
    padding: 1.25rem;
  }

  .form-grid {
    display: grid;
    grid-template-columns: repeat(12, 1fr);
    gap: 1rem;
  }

  .col-3 { grid-column: span 3; }
  .col-6 { grid-column: span 6; }
  .col-9 { grid-column: span 9; }
  .col-12 { grid-column: span 12; }

  @media (max-width: 768px) {
    .col-3, .col-6, .col-9 { grid-column: span 12; }
  }

  .budget-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .form-group label {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--color-text-muted, #475569);
  }

  .field-hint {
    font-size: 0.725rem;
    color: var(--color-text-muted, #94a3b8);
  }

  .highlight-revenue {
    background: rgba(59, 130, 246, 0.04);
    padding: 0.75rem;
    border-radius: 10px;
    border: 1px dashed rgba(59, 130, 246, 0.3);
  }

  .checkbox-inline {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.775rem;
    color: var(--color-text-muted, #64748b);
    margin-top: 0.25rem;
    cursor: pointer;
  }

  .budget-summary-banner {
    display: flex;
    justify-content: space-around;
    flex-wrap: wrap;
    gap: 1rem;
    margin-top: 1.25rem;
    padding: 1rem;
    background: var(--color-bg-subtle, #f8fafc);
    border: 1px solid var(--color-border, #e2e8f0);
    border-radius: 12px;
  }

  .summary-item {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .summary-label {
    font-size: 0.75rem;
    color: var(--color-text-muted, #64748b);
    text-transform: uppercase;
    font-weight: 600;
  }

  .summary-value {
    font-size: 1.25rem;
    font-weight: 700;
    margin-top: 0.15rem;
  }

  .text-success { color: #059669; }
  .text-danger { color: #dc2626; }
  .text-primary { color: #2563eb; }

  .form-bottom-bar {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    padding: 1rem 0;
  }
</style>
