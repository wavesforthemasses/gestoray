<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { InterventiService } from '../interventi.service';
  import { TeamsService } from '../teams.service';
  import { VehiclesService } from '../vehicles.service';
  import type { LocationItem, TeamItem, VehicleItem, PricingUnit, InterventionConsuntivoItem } from '../schema';
  import { InterventionSettingsService, type InterventionSettingsConfig, DEFAULT_INTERVENTION_SETTINGS } from '$lib/services/interventionSettings';
  import { CustomFieldsService } from '$lib/services/customFieldsService';
  import { CacheLookupService } from '$lib/services/cacheLookupService';
  import type { CustomFieldDefinition, CustomFieldValues } from '$lib/types/customFields';
  import CustomFieldsRenderer from '$lib/components/CustomFieldsRenderer.svelte';
  import { db, collection, getDocs } from '$lib/firebase';
  import Autocomplete from '$lib/components/Autocomplete.svelte';
  import MultiSelectAutocomplete from '$lib/components/MultiSelectAutocomplete.svelte';
  
  import InterventionItemsForm from './components/InterventionItemsForm.svelte';

  let settings = $state<InterventionSettingsConfig>({ ...DEFAULT_INTERVENTION_SETTINGS });
  let clients = $state<{ id: string; name: string }[]>([]);
  let contracts = $state<{ id: string; title: string; clientId: string }[]>([]);
  let tickets = $state<{ id: string; subject: string; clientId: string }[]>([]);
  let users = $state<{ id: string; name: string }[]>([]);
  let teams = $state<TeamItem[]>([]);
  let vehicles = $state<VehicleItem[]>([]);
  let clientLocations = $state<LocationItem[]>([]);

  let customFieldsList = $state<CustomFieldDefinition[]>([]);
  let customFieldsValues = $state<CustomFieldValues>({});

  let loading = $state(true);
  let saving = $state(false);
  let errorMsg = $state('');
  let overbookingWarning = $state('');

  // Form State
  let title = $state('');
  let description = $state('');
  let mode = $state<'a_bolla' | 'ad_erogazione'>('a_bolla');
  let estimatedQuantity = $state(2);

  // Multi-Voce / Attività dell'Intervento
  let items = $state<InterventionConsuntivoItem[]>([
    {
      id: 'item_1',
      type: 'Manutenzione Ordinaria',
      description: 'Attività principale',
      pricingUnit: 'ora',
      quantity: 2,
      unitPrice: 45,
      total: 90
    }
  ]);

  function addItem() {
    const newId = 'item_' + Date.now();
    items = [
      ...items,
      {
        id: newId,
        type: settings.interventionTypes[0]?.label || 'Manutenzione Ordinaria',
        description: '',
        pricingUnit: settings.interventionTypes[0]?.defaultPricingUnit || 'ora',
        quantity: 1,
        unitPrice: settings.interventionTypes[0]?.defaultHourlyRate || 45,
        total: 45
      }
    ];
  }

  function removeItem(id: string) {
    if (items.length > 1) {
      items = items.filter(i => i.id !== id);
    }
  }

  let totalAmount = $derived(
    items.reduce((acc, curr) => acc + ((curr.quantity || 0) * (curr.unitPrice || 0)), 0)
  );

  let clientId = $state('');
  let locationId = $state('');
  let contractId = $state('');
  let ticketId = $state('');

  let teamId = $state('');
  let selectedOperatorUids = $state<string[]>([]);
  let selectedVehicleIds = $state<string[]>([]);

  // Schedulazione
  let scheduledStartDate = $state(new Date().toISOString().slice(0, 10));
  let scheduledStartTime = $state('09:00');
  let scheduledEndDate = $state(new Date().toISOString().slice(0, 10));
  let scheduledEndTime = $state('11:00');

  // Nuova Location Inline Form
  let showNewLocForm = $state(false);
  let newLocName = $state('');
  let newLocAddress = $state('');
  let newLocCity = $state('');
  let newLocType = $state<'cantiere' | 'sede_cliente' | 'ufficio' | 'stabilimento' | 'da_remoto' | 'consegna'>('cantiere');

  onMount(async () => {
    try {
      settings = await InterventionSettingsService.getSettings();
      teams = await TeamsService.getTeams();
      vehicles = await VehiclesService.getVehicles();
      customFieldsList = await CustomFieldsService.getFieldsForModule('interventi');
      
      // Load lookups using CacheLookupService (Ultra-fast sharded chunk cache)
      clients = await CacheLookupService.getLookup('clients');
      contracts = (await CacheLookupService.getLookup('contracts')).map((c) => ({ id: c.id, title: c.name, clientId: '' }));
      tickets = (await CacheLookupService.getLookup('tickets')).map((t) => ({ id: t.id, subject: t.name, clientId: '' }));
      users = await CacheLookupService.getLookup('users');
    } catch (err) {
      console.error('Errore inizializzazione form interventi:', err);
    } finally {
      loading = false;
    }
  });

  // Filtra Contratti e Ticket in base al Cliente Selezionato
  let filteredContracts = $derived(
    clientId ? contracts.filter(c => c.clientId === clientId) : contracts
  );

  let filteredTickets = $derived(
    clientId ? tickets.filter(t => t.clientId === clientId) : tickets
  );

  // Auto-Routing Modalità in base alle Impostazioni ed al Contratto
  $effect(() => {
    if (contractId && settings.enableAdErogazione) {
      mode = 'ad_erogazione';
    } else if (!settings.enableABolla && settings.enableAdErogazione) {
      mode = 'ad_erogazione';
    } else if (settings.enableABolla && !settings.enableAdErogazione) {
      mode = 'a_bolla';
    } else if (settings.defaultMode) {
      mode = settings.defaultMode;
    } else {
      mode = 'a_bolla';
    }
  });

  // Precompila Operatori e Mezzo di Default quando si seleziona una Squadra
  $effect(() => {
    if (teamId) {
      const selectedTeam = teams.find(t => t.id === teamId);
      if (selectedTeam) {
        if (selectedTeam.memberUids && selectedTeam.memberUids.length > 0) {
          selectedOperatorUids = [...selectedTeam.memberUids];
        }
        if (selectedTeam.defaultVehicleId && !selectedVehicleIds.includes(selectedTeam.defaultVehicleId)) {
          selectedVehicleIds = [...selectedVehicleIds, selectedTeam.defaultVehicleId];
        }
      }
    }
  });

  // Carica Luoghi del Cliente
  $effect(() => {
    const targetClientId = clientId;
    let isActive = true;

    if (targetClientId) {
      InterventiService.getLocationsForClient(targetClientId).then(locs => {
        if (!isActive) return;
        clientLocations = locs;
        if (locs.length > 0 && !locationId) {
          locationId = locs[0].id || '';
        }
      });
    } else {
      clientLocations = [];
      locationId = '';
    }

    return () => {
      isActive = false;
    };
  });

  // Verifica Overbooking Mezzi & Risorse
  $effect(() => {
    const vIds = [...selectedVehicleIds];
    const sDate = scheduledStartDate;
    const sTime = scheduledStartTime;
    const eDate = scheduledEndDate;
    const eTime = scheduledEndTime;
    let isActive = true;

    if (vIds.length > 0 && sDate && sTime && eDate && eTime) {
      const startIso = `${sDate}T${sTime}:00`;
      const endIso = `${eDate}T${eTime}:00`;
      
      InterventiService.checkVehicleOverbooking(vIds, startIso, endIso).then(res => {
        if (!isActive) return;
        if (res.overbooked) {
          overbookingWarning = `⚠️ ATTENZIONE OVERBOOKING: I seguenti mezzi risultano già prenotati in questo orario: ${res.vehicleNames.join(', ')}`;
        } else {
          overbookingWarning = '';
        }
      });
    } else {
      overbookingWarning = '';
    }

    return () => {
      isActive = false;
    };
  });

  async function handleCreateInlineLocation(e?: Event) {
    if (e) e.preventDefault();
    if (!clientId || !newLocName.trim()) return;

    try {
      const locId = await InterventiService.createLocationForClient(clientId, {
        name: newLocName.trim(),
        address: newLocAddress.trim(),
        city: newLocCity.trim(),
        type: newLocType
      });

      const updatedLocs = await InterventiService.getLocationsForClient(clientId);
      clientLocations = updatedLocs;
      locationId = locId;
      showNewLocForm = false;
      newLocName = '';
      newLocAddress = '';
      newLocCity = '';
    } catch (err: any) {
      alert('Errore creazione nuovo luogo: ' + err.message);
    }
  }

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (!title.trim() || !clientId) {
      errorMsg = 'Titolo dell\'intervento e Cliente sono obbligatori.';
      return;
    }

    saving = true;
    errorMsg = '';

    try {
      const selectedClient = clients.find(c => c.id === clientId);
      const selectedLoc = clientLocations.find(l => l.id === locationId);
      const selectedContract = contracts.find(c => c.id === contractId);
      const selectedTicket = tickets.find(t => t.id === ticketId);
      const selectedTeamObj = teams.find(t => t.id === teamId);

      const scheduledStartAt = scheduledStartDate && scheduledStartTime ? `${scheduledStartDate}T${scheduledStartTime}:00` : '';
      const scheduledEndAt = scheduledEndDate && scheduledEndTime ? `${scheduledEndDate}T${scheduledEndTime}:00` : '';

      const firstItem = items[0] || {};

      const newId = await InterventiService.createIntervention({
        title: title.trim(),
        description: description.trim(),
        mode,
        type: firstItem.type || 'Manutenzione Ordinaria',
        pricingUnit: firstItem.pricingUnit || 'ora',
        unitPriceSnapshot: firstItem.unitPrice || 45,
        estimatedQuantity: firstItem.quantity || estimatedQuantity || 2,
        estimatedHours: firstItem.quantity || estimatedQuantity || 2,
        totalAmount,
        items,
        clientId,
        clientName: selectedClient?.name || '',
        locationId,
        locationName: selectedLoc?.name || 'Sede Principale',
        contractId: contractId || undefined,
        contractTitle: selectedContract?.title || undefined,
        ticketId: ticketId || undefined,
        ticketSubject: selectedTicket?.subject || undefined,
        teamId: teamId || undefined,
        teamName: selectedTeamObj?.name || undefined,
        assignedOperatorUids: selectedOperatorUids,
        vehicleIds: selectedVehicleIds,
        scheduledStartAt,
        scheduledEndAt,
        status: 'pianificato',
        customFields: customFieldsValues
      });

      goto(`/dashboard/interventi/${newId}`);
    } catch (err: any) {
      console.error('Errore salvataggio intervento:', err);
      errorMsg = err.message || 'Errore durante il salvataggio.';
    } finally {
      saving = false;
    }
  }
</script>

<svelte:head>
  <title>Nuovo Intervento | Gestoray</title>
</svelte:head>

<div class="add-intervention-page animate-fade-in">
  <div class="page-top">
    <a href="/dashboard/interventi" class="back-link">← Torna agli Interventi</a>
    <h2>➕ Pianifica Nuovo Intervento</h2>
  </div>

  {#if loading}
    <div class="loader-box">
      <span class="spinner"></span>
      Inizializzazione parametri intervento...
    </div>
  {:else}
    {#if errorMsg}
      <div class="alert error-box">⚠️ {errorMsg}</div>
    {/if}

    {#if overbookingWarning}
      <div class="alert warning-box">{overbookingWarning}</div>
    {/if}

    <form onsubmit={handleSubmit} class="intervention-form">
      <!-- 1. DETTAGLI PRINCIPALI & CLIENTE -->
      <div class="card form-card">
        <div class="card-header">
          <h3 class="card-title">👤 Cliente & Riferimenti</h3>
          <p class="card-subtitle">Seleziona il cliente ed la destinazione ({settings.locationLabel}).</p>
        </div>

        <div class="grid-2">
          <div class="form-group">
            <label for="client-select">Cliente *</label>
            <Autocomplete 
              options={clients.map(c => ({ id: c.id, label: c.name }))} 
              bind:value={clientId} 
              placeholder="🔍 Cerca cliente per ragione sociale..."
            />
          </div>

          <div class="form-group">
            <div class="label-with-btn">
              <label for="location-select">{settings.locationLabel} / Destinazione</label>
              {#if clientId}
                <button type="button" onclick={() => showNewLocForm = !showNewLocForm} class="btn-text-action">
                  {showNewLocForm ? 'Annulla' : `+ Nuovo ${settings.locationLabel}`}
                </button>
              {/if}
            </div>
            
            <select id="location-select" bind:value={locationId} class="form-control" disabled={!clientId}>
              {#if !clientId}
                <option value="">-- Seleziona prima un cliente --</option>
              {:else if clientLocations.length === 0}
                <option value="">Nessuna destinazione registrata</option>
              {:else}
                {#each clientLocations as loc}
                  <option value={loc.id}>{loc.name} {loc.city ? `(${loc.city})` : ''}</option>
                {/each}
              {/if}
            </select>
          </div>
        </div>

        <!-- Inline New Location Form -->
        {#if showNewLocForm && clientId}
          <div class="inline-form-box">
            <h4>Aggiungi {settings.locationLabel} per questo Cliente</h4>
            <div class="grid-3">
              <input type="text" placeholder="Nome (es. Cantiere Via Roma)" bind:value={newLocName} class="form-control" />
              <input type="text" placeholder="Indirizzo" bind:value={newLocAddress} class="form-control" />
              <input type="text" placeholder="Città" bind:value={newLocCity} class="form-control" />
            </div>
            <div class="form-actions mt-10">
              <button type="button" onclick={(e) => handleCreateInlineLocation(e)} class="btn-small-save">Salva Destinazione</button>
            </div>
          </div>
        {/if}

        <div class="grid-2 mt-16">
          <div class="form-group">
            <label for="contract-select">Contratto (Opzionale)</label>
            <select id="contract-select" bind:value={contractId} class="form-control" disabled={!clientId}>
              <option value="">-- Nessun Contratto --</option>
              {#each filteredContracts as c}
                <option value={c.id}>{c.title}</option>
              {/each}
            </select>
          </div>

          <div class="form-group">
            <label for="ticket-select">Ticket di Assistenza (Opzionale)</label>
            <select id="ticket-select" bind:value={ticketId} class="form-control" disabled={!clientId}>
              <option value="">-- Nessun Ticket --</option>
              {#each filteredTickets as t}
                <option value={t.id}>{t.subject}</option>
              {/each}
            </select>
          </div>
        </div>
      </div>

      <!-- 2. INFORMAZIONI INTERVENTO -->
      <div class="card form-card">
        <div class="card-header">
          <h3 class="card-title">ℹ️ Dettagli dell'Intervento</h3>
        </div>

        <div class="form-group">
          <label for="intervention-title">Titolo Intervento *</label>
          <input 
            id="intervention-title"
            type="text" 
            placeholder="es. Manutenzione Impianto di Condizionamento Sede Nord" 
            bind:value={title}
            class="form-control" 
            required 
          />
        </div>

        <div class="form-group mt-12">
          <label for="intervention-desc">Descrizione & Istruzioni per Operatori</label>
          <textarea 
            id="intervention-desc"
            rows="3" 
            placeholder="Dettagli sulle attività da svolgere, dispositivi da verificare o note tecniche..." 
            bind:value={description}
            class="form-control"
          ></textarea>
        </div>

        <div class="grid-2 mt-16">
          <div class="form-group">
            <label for="intervention-mode">Modalità Operativa</label>
            <select id="intervention-mode" bind:value={mode} class="form-control">
              {#if settings.enableABolla}
                <option value="a_bolla">📄 A Bolla / Consuntivo (Fatturabile separatamente)</option>
              {/if}
              {#if settings.enableAdErogazione}
                <option value="ad_erogazione">🔄 Ad Erogazione (Compreso nel Contratto)</option>
              {/if}
            </select>
          </div>
        </div>
      </div>

      <!-- 3. ATTIVITA' & VOCI CONSUNTIVO COMPONENT -->
      <InterventionItemsForm 
        bind:items={items} 
        {settings} 
        {totalAmount} 
        {addItem} 
        {removeItem} 
      />

      <!-- 4. RISORSE & SCHEDULAZIONE TEMPORALE -->
      <div class="card form-card">
        <div class="card-header">
          <h3 class="card-title">📅 Schedulazione & Assegnazione Risorse</h3>
        </div>

        <div class="grid-2">
          <div class="form-group">
            <label for="scheduled-start-date">Data e Ora Inizio *</label>
            <div class="date-time-group">
              <input type="date" id="scheduled-start-date" bind:value={scheduledStartDate} class="form-control" required />
              <input type="time" bind:value={scheduledStartTime} class="form-control" required />
            </div>
          </div>

          <div class="form-group">
            <label for="scheduled-end-date">Data e Ora Fine Prevista *</label>
            <div class="date-time-group">
              <input type="date" id="scheduled-end-date" bind:value={scheduledEndDate} class="form-control" required />
              <input type="time" bind:value={scheduledEndTime} class="form-control" required />
            </div>
          </div>
        </div>

        <div class="grid-3 mt-16">
          <div class="form-group">
            <label for="team-select">Squadra di Lavoro (Opzionale)</label>
            <select id="team-select" bind:value={teamId} class="form-control">
              <option value="">-- Seleziona Squadra --</option>
              {#each teams as t}
                <option value={t.id}>{t.name}</option>
              {/each}
            </select>
          </div>

          <div class="form-group">
            <label for="operators-select">Operatori Assegnati</label>
            <MultiSelectAutocomplete 
              options={users.map(u => ({ id: u.id, label: u.name }))} 
              bind:value={selectedOperatorUids} 
              placeholder="Scegli operatori..." 
            />
          </div>

          <div class="form-group">
            <label for="vehicles-select">Mezzi Assegnati</label>
            <MultiSelectAutocomplete 
              options={vehicles.map(v => ({ id: v.id || '', label: `${v.name} (${v.plate || 'No Targa'})` }))} 
              bind:value={selectedVehicleIds} 
              placeholder="Scegli mezzi..." 
            />
          </div>
        </div>
      </div>

        {#if customFieldsList.length > 0}
          <div class="card form-card">
            <h3 class="card-title">🧩 Campi Personalizzati Aziendali</h3>
            <CustomFieldsRenderer fields={customFieldsList} bind:values={customFieldsValues} />
          </div>
        {/if}

      <!-- FORM ACTIONS -->
      <div class="form-actions-bar">
        <a href="/dashboard/interventi" class="btn btn-secondary">Annulla</a>
        <button type="submit" class="btn btn-primary" disabled={saving}>
          {saving ? 'Salvataggio in corso...' : '💾 Pianifica Intervento'}
        </button>
      </div>
    </form>
  {/if}
</div>

<style>
  .add-intervention-page {
    width: 100%;
    box-sizing: border-box;
  }
  .page-top {
    margin-bottom: 20px;
  }
  .back-link {
    color: var(--color-neutral-500);
    text-decoration: none;
    font-size: 13px;
    font-weight: 600;
  }
  .back-link:hover {
    color: var(--color-neutral-800);
  }
  .page-top h2 {
    margin: 8px 0 0 0;
    font-size: 24px;
    color: var(--color-neutral-800);
  }
  .card {
    background: var(--color-white);
    border: 1px solid var(--color-neutral-200);
    border-radius: var(--radius-lg);
    padding: 24px;
    margin-bottom: 24px;
    box-shadow: var(--shadow-sm);
  }
  .card-title {
    margin: 0 0 4px 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--color-neutral-800);
  }
  .card-subtitle {
    margin: 0 0 16px 0;
    font-size: 13px;
    color: var(--color-neutral-500);
  }
  .grid-2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }
  .grid-3 {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 16px;
  }
  .mt-10 { margin-top: 10px; }
  .mt-12 { margin-top: 12px; }
  .mt-16 { margin-top: 16px; }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .form-group label {
    font-size: 13px;
    font-weight: 600;
    color: var(--color-neutral-700);
  }
  .label-with-btn {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .btn-text-action {
    background: transparent;
    border: none;
    color: var(--color-primary-500);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
  }
  .form-control {
    padding: 10px 12px;
    font-size: 14px;
    border: 1px solid var(--color-neutral-300);
    border-radius: var(--radius-md);
    background: var(--color-white);
    color: var(--color-neutral-800);
    outline: none;
    box-sizing: border-box;
  }
  .date-time-group {
    display: flex;
    gap: 8px;
  }
  .inline-form-box {
    background: var(--color-neutral-50);
    border: 1px solid var(--color-neutral-300);
    border-radius: var(--radius-md);
    padding: 16px;
    margin-top: 12px;
  }
  .inline-form-box h4 {
    margin: 0 0 12px 0;
    font-size: 13px;
    color: var(--color-neutral-700);
  }
  .btn-small-save {
    background: var(--color-primary-500);
    color: var(--color-white);
    border: none;
    padding: 6px 12px;
    border-radius: var(--radius-sm);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
  }
  .form-actions-bar {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    margin-top: 24px;
    margin-bottom: 40px;
  }
  .btn {
    padding: 12px 24px;
    font-size: 14px;
    font-weight: 600;
    border-radius: var(--radius-md);
    cursor: pointer;
    text-decoration: none;
    border: none;
  }
  .btn-primary {
    background: var(--color-primary-500);
    color: var(--color-white);
  }
  .btn-secondary {
    background: var(--color-white);
    border: 1px solid var(--color-neutral-300);
    color: var(--color-neutral-700);
  }
  .alert {
    padding: 12px 16px;
    border-radius: var(--radius-md);
    font-size: 14px;
    margin-bottom: 20px;
  }
  .error-box {
    background: var(--color-error-light);
    color: var(--color-error-text);
    border: 1px solid var(--color-error-border);
  }
  .warning-box {
    background: var(--color-warning-light);
    color: var(--color-warning-text);
    border: 1px solid var(--color-warning-border);
  }
  .loader-box {
    padding: 40px;
    text-align: center;
    color: var(--color-neutral-500);
  }
  .spinner {
    display: inline-block;
    width: 24px;
    height: 24px;
    border: 3px solid var(--color-neutral-200);
    border-top-color: var(--color-primary-500);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  .animate-fade-in {
    animation: fadeIn 0.3s ease;
  }
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  }
</style>
