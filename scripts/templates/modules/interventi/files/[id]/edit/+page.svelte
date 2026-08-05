<script lang="ts">
  import { projectStore } from '$lib/stores/project';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { InterventiService } from '../../interventi.service';
  import { TeamsService } from '../../teams.service';
  import { VehiclesService } from '../../vehicles.service';
  import type { InterventionItem, LocationItem, TeamItem, VehicleItem, InterventionConsuntivoItem } from '../../schema';
  import { InterventionSettingsService, type InterventionSettingsConfig, DEFAULT_INTERVENTION_SETTINGS } from '$lib/services/interventionSettings';
  import { CustomFieldsService } from '$lib/services/customFieldsService';
  import { CacheLookupService } from '$lib/services/cacheLookupService';
  import type { CustomFieldDefinition, CustomFieldValues } from '$lib/types/customFields';
  import CustomFieldsRenderer from '$lib/components/CustomFieldsRenderer.svelte';
  import Autocomplete from '$lib/components/Autocomplete.svelte';
  import MultiComplete from '$lib/components/MultiComplete.svelte';
  import { toast } from '$lib/stores/toast.svelte';
  
  import InterventionItemsForm from '../../add/components/InterventionItemsForm.svelte';

  let interventionId = $derived(page.params.id);
  let intervention = $state<InterventionItem | null>(null);

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
  let status = $state<InterventionItem['status']>('pianificato');
  let mode = $state<'a_bolla' | 'ad_erogazione'>('a_bolla');
  let estimatedQuantity = $state(2);

  // Multi-Voce / Attività dell'Intervento
  let items = $state<InterventionConsuntivoItem[]>([]);

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

  onMount(async () => {
    try {
      settings = await InterventionSettingsService.getSettings();
      teams = await TeamsService.getTeams();
      vehicles = await VehiclesService.getVehicles();
      customFieldsList = await CustomFieldsService.getFieldsForModule('interventi');
      
      // Load lookups using CacheLookupService
      clients = await CacheLookupService.getLookup('clients');
      contracts = (await CacheLookupService.getLookup('contracts')).map((c) => ({ id: c.id, title: c.name, clientId: '' }));
      tickets = (await CacheLookupService.getLookup('tickets')).map((t) => ({ id: t.id, subject: t.name, clientId: '' }));
      users = await CacheLookupService.getLookup('users');

      // Load intervention details
      if (interventionId) {
        intervention = await InterventiService.getInterventionById(interventionId);
        if (intervention) {
          title = intervention.title || '';
          description = intervention.description || '';
          status = intervention.status || 'pianificato';
          mode = intervention.mode || 'a_bolla';
          clientId = intervention.clientId || '';
          locationId = intervention.locationId || '';
          contractId = intervention.contractId || '';
          ticketId = intervention.ticketId || '';
          teamId = intervention.teamId || '';
          selectedOperatorUids = intervention.assignedOperatorUids ? [...intervention.assignedOperatorUids] : [];
          selectedVehicleIds = intervention.vehicleIds ? [...intervention.vehicleIds] : [];
          customFieldsValues = intervention.customFields ? { ...intervention.customFields } : {};

          if (intervention.items && intervention.items.length > 0) {
            items = [...intervention.items];
          } else {
            items = [
              {
                id: 'item_1',
                type: intervention.type || 'Manutenzione Ordinaria',
                description: 'Attività principale',
                pricingUnit: intervention.pricingUnit || 'ora',
                quantity: intervention.estimatedQuantity || 1,
                unitPrice: intervention.unitPriceSnapshot || 45,
                total: (intervention.estimatedQuantity || 1) * (intervention.unitPriceSnapshot || 45)
              }
            ];
          }

          if (intervention.scheduledStartAt) {
            const dStart = new Date(intervention.scheduledStartAt);
            if (!isNaN(dStart.getTime())) {
              scheduledStartDate = dStart.toISOString().slice(0, 10);
              scheduledStartTime = dStart.toTimeString().slice(0, 5);
            }
          }

          if (intervention.scheduledEndAt) {
            const dEnd = new Date(intervention.scheduledEndAt);
            if (!isNaN(dEnd.getTime())) {
              scheduledEndDate = dEnd.toISOString().slice(0, 10);
              scheduledEndTime = dEnd.toTimeString().slice(0, 5);
            }
          }

          if (clientId) {
            clientLocations = await InterventiService.getLocationsForClient(clientId);
          }
        }
      }
    } catch (err) {
      console.error('Errore inizializzazione form modifica intervento:', err);
    } finally {
      loading = false;
    }
  });

  let filteredContracts = $derived(
    clientId ? contracts.filter(c => !c.clientId || c.clientId === clientId) : contracts
  );

  let filteredTickets = $derived(
    clientId ? tickets.filter(t => !t.clientId || t.clientId === clientId) : tickets
  );

  // Auto-Routing Modalità in base alle Impostazioni ed al Contratto
  $effect(() => {
    if (contractId && settings.enableAdErogazione) {
      mode = 'ad_erogazione';
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
      InterventiService.getLocationsForClient(targetClientId).then((locs) => {
        if (isActive) {
          clientLocations = locs;
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

  // Controllo Overbooking Mezzi
  $effect(() => {
    const vIds = selectedVehicleIds;
    const sDate = scheduledStartDate;
    const sTime = scheduledStartTime;
    const eDate = scheduledEndDate;
    const eTime = scheduledEndTime;

    if (vIds.length > 0 && sDate && sTime && eDate && eTime) {
      const startIso = new Date(`${sDate}T${sTime}`).toISOString();
      const endIso = new Date(`${eDate}T${eTime}`).toISOString();

      InterventiService.checkVehicleOverbooking(vIds, startIso, endIso, interventionId).then(res => {
        if (res.overbooked) {
          overbookingWarning = `⚠️ Attenzione: Uno o più mezzi selezionati (${res.vehicleNames.join(', ')}) risultano già impegnati in un altro intervento nella stessa fascia oraria!`;
        } else {
          overbookingWarning = '';
        }
      });
    } else {
      overbookingWarning = '';
    }
  });

  async function handleCreateInlineLocation(e: MouseEvent) {
    e.preventDefault();
    if (!clientId || !newLocName.trim()) return;
    try {
      const newId = await InterventiService.createLocationForClient(clientId, {
        name: newLocName.trim(),
        address: newLocAddress.trim(),
        city: newLocCity.trim()
      });
      clientLocations = await InterventiService.getLocationsForClient(clientId);
      locationId = newId;
      showNewLocForm = false;
      newLocName = '';
      newLocAddress = '';
      newLocCity = '';
    } catch (err: any) {
      alert('Errore creazione destinazione: ' + err.message);
    }
  }

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (!interventionId || !title.trim() || !clientId) {
      errorMsg = 'Compila tutti i campi obbligatori (Titolo e Cliente).';
      return;
    }

    saving = true;
    errorMsg = '';

    try {
      const startIso = new Date(`${scheduledStartDate}T${scheduledStartTime}`).toISOString();
      const endIso = new Date(`${scheduledEndDate}T${scheduledEndTime}`).toISOString();

      const selectedClient = clients.find(c => c.id === clientId);
      const selectedLoc = clientLocations.find(l => l.id === locationId);
      const selectedContract = contracts.find(c => c.id === contractId);
      const selectedTicket = tickets.find(t => t.id === ticketId);
      const selectedTeam = teams.find(t => t.id === teamId);

      const firstItem = items[0] || {};

      await InterventiService.updateIntervention(interventionId, {
        title: title.trim(),
        description: description.trim(),
        clientId,
        clientName: selectedClient ? selectedClient.name : (intervention?.clientName || ''),
        locationId,
        locationName: selectedLoc ? selectedLoc.name : (intervention?.locationName || ''),
        contractId: contractId || '',
        contractTitle: selectedContract ? selectedContract.title : '',
        ticketId: ticketId || '',
        ticketSubject: selectedTicket ? selectedTicket.subject : '',
        teamId: teamId || '',
        teamName: selectedTeam ? selectedTeam.name : '',
        assignedOperatorUids: selectedOperatorUids,
        vehicleIds: selectedVehicleIds,
        type: firstItem.type || 'Manutenzione Ordinaria',
        pricingUnit: firstItem.pricingUnit || 'ora',
        unitPriceSnapshot: firstItem.unitPrice || 45,
        hourlyRateSnapshot: firstItem.unitPrice || 45,
        mode,
        status,
        scheduledStartAt: startIso,
        scheduledEndAt: endIso,
        estimatedQuantity: firstItem.quantity || 1,
        estimatedHours: firstItem.quantity || 1,
        totalAmount,
        items,
        customFields: customFieldsValues
      });

      toast.success('Intervento aggiornato con successo!');
      goto(`/dashboard/interventi/${interventionId}`);
    } catch (err: any) {
      console.error('Errore salvataggio intervento:', err);
      errorMsg = err.message || 'Errore durante il salvataggio delle modifiche.';
    } finally {
      saving = false;
    }
  }
</script>

<svelte:head>
  <title>Modifica Intervento | {$projectStore?.projectName || 'ERP'}</title>
</svelte:head>

<div class="add-intervention-page animate-fade-in">
  <div class="page-top">
    <a href="/dashboard/interventi/{interventionId}" class="back-link">← Torna al Dettaglio Intervento</a>
    <h2>✏️ Modifica Intervento Tecnico</h2>
  </div>

  {#if loading}
    <div class="loader-box">
      <span class="spinner"></span>
      Caricamento dati intervento in corso...
    </div>
  {:else if !intervention}
    <div class="alert error-box">⚠️ Intervento non trovato o eliminato.</div>
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
          <p class="card-subtitle">Seleziona il cliente e la destinazione ({settings.locationLabel}).</p>
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

            <select id="location-select" bind:value={locationId} class="form-control" disabled={!clientId || clientLocations.length === 0}>
              {#if !clientId}
                <option value="">-- Seleziona prima un cliente --</option>
              {:else if clientLocations.length === 0}
                <option value="">Nessuna destinazione registrata</option>
              {:else}
                <option value="">-- Seleziona {settings.locationLabel} --</option>
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
          <p class="card-subtitle">Titolo, descrizione e modalità operativa.</p>
        </div>

        <div class="form-group mb-16">
          <label for="title">Titolo Intervento *</label>
          <input 
            id="title" 
            type="text" 
            bind:value={title} 
            placeholder="es. Manutenzione Impianto di Condizionamento Sede Nord" 
            required 
            class="form-control" 
          />
        </div>

        <div class="grid-2 mb-16">
          <div class="form-group">
            <label for="status-select">Stato Intervento</label>
            <select id="status-select" bind:value={status} class="form-control">
              <option value="pianificato">📅 Pianificato</option>
              <option value="in_lavorazione">🔄 In Lavorazione</option>
              <option value="completato">✅ Completato</option>
              <option value="inviato_cliente">📩 Inviato al Cliente</option>
              <option value="approvato">👍 Approvato</option>
              <option value="fatturato">💶 Fatturato</option>
            </select>
          </div>

          <div class="form-group">
            <label for="mode-select">Modalità Operativa</label>
            <select id="mode-select" bind:value={mode} class="form-control">
              <option value="a_bolla">📄 A Bolla / Consuntivo (Fatturabile separatamente)</option>
              <option value="ad_erogazione">📦 Ad Erogazione (Decurtato dal Monte Ore Contratto)</option>
            </select>
          </div>
        </div>

        <div class="form-group">
          <label for="description">Descrizione & Istruzioni per Operatori</label>
          <textarea 
            id="description" 
            bind:value={description} 
            rows="3" 
            placeholder="Dettagli sulle attività da svolgere, dispositivi da verificare o note tecniche..." 
            class="form-control"
          ></textarea>
        </div>
      </div>

      <!-- 3. ATTIVITÀ & VOCI CONSUNTIVO / STIMA -->
      <InterventionItemsForm 
        bind:items={items} 
        {settings} 
        {totalAmount} 
        {addItem} 
        {removeItem} 
      />

      <!-- 4. SCHEDULAZIONE E ASSEGNAZIONE RISORSE -->
      <div class="card form-card">
        <div class="card-header">
          <h3 class="card-title">📅 Schedulazione & Assegnazione Risorse</h3>
          <p class="card-subtitle">Imposta le tempistiche e assegna la squadra, gli operatori ed i mezzi.</p>
        </div>

        <div class="grid-2 mb-16">
          <div class="form-group">
            <label for="sched-start-date">Data e Ora Inizio *</label>
            <div class="date-time-group">
              <input id="sched-start-date" type="date" bind:value={scheduledStartDate} required class="form-control" />
              <input id="sched-start-time" type="time" bind:value={scheduledStartTime} required class="form-control" />
            </div>
          </div>

          <div class="form-group">
            <label for="sched-end-date">Data e Ora Fine Prevista *</label>
            <div class="date-time-group">
              <input id="sched-end-date" type="date" bind:value={scheduledEndDate} required class="form-control" />
              <input id="sched-end-time" type="time" bind:value={scheduledEndTime} required class="form-control" />
            </div>
          </div>
        </div>

        <div class="grid-3">
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
            <MultiComplete 
              options={users.map(u => ({ id: u.id, label: u.name }))} 
              bind:value={selectedOperatorUids} 
              placeholder="Scegli operatori..." 
            />
          </div>

          <div class="form-group">
            <label for="vehicles-select">Mezzi Assegnati</label>
            <MultiComplete 
              options={vehicles.map(v => ({ id: v.id || '', label: `${v.name} (${v.plate || 'No Targa'})` }))} 
              bind:value={selectedVehicleIds} 
              placeholder="Scegli mezzi..." 
            />
          </div>
        </div>
      </div>

      <!-- 5. CAMPI PERSONALIZZATI (CUSTOM FIELDS) -->
      {#if customFieldsList.length > 0}
        <div class="card form-card">
          <div class="card-header">
            <h3 class="card-title">🧩 Campi Personalizzati</h3>
            <p class="card-subtitle">Informazioni aggiuntive configurate per gli interventi.</p>
          </div>
          <CustomFieldsRenderer 
            fields={customFieldsList} 
            bind:values={customFieldsValues} 
          />
        </div>
      {/if}

      <!-- FORM ACTIONS -->
      <div class="form-actions-bar">
        <a href="/dashboard/interventi/{interventionId}" class="btn-cancel">Annulla</a>
        <button type="submit" class="btn-submit" disabled={saving}>
          {saving ? 'Salvataggio...' : '💾 Aggiorna Intervento'}
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
    color: var(--color-neutral-600);
    text-decoration: none;
    font-size: 13px;
    font-weight: 600;
  }
  .back-link:hover {
    color: var(--color-primary-600);
  }

  .page-top h2 {
    margin: 6px 0 0 0;
    font-size: 22px;
    font-weight: 700;
    color: var(--color-neutral-900);
  }

  .form-card {
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

  .mb-16 {
    margin-bottom: 16px;
  }
  .mt-16 {
    margin-top: 16px;
  }
  .mt-10 {
    margin-top: 10px;
  }

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
    background: none;
    border: none;
    color: var(--color-primary-600);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    padding: 0;
  }
  .btn-text-action:hover {
    text-decoration: underline;
  }

  .form-control {
    padding: 10px 14px;
    font-size: 14px;
    border: 1px solid var(--color-neutral-300);
    border-radius: var(--radius-md);
    background: var(--color-white);
    color: var(--color-neutral-800);
    outline: none;
    box-sizing: border-box;
    width: 100%;
    transition: border-color 0.15s ease;
  }
  .form-control:focus {
    border-color: var(--color-primary-500);
    box-shadow: 0 0 0 3px rgba(var(--color-primary-500-rgb, 59, 130, 246), 0.15);
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
    margin-top: 16px;
  }
  .inline-form-box h4 {
    margin: 0 0 12px 0;
    font-size: 13px;
    font-weight: 700;
    color: var(--color-primary-700);
  }

  .btn-small-save {
    background: var(--color-primary-600);
    color: var(--color-white);
    border: none;
    padding: 6px 14px;
    font-size: 12px;
    font-weight: 600;
    border-radius: var(--radius-md);
    cursor: pointer;
  }

  .form-actions-bar {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 16px;
    margin-top: 32px;
    margin-bottom: 48px;
  }

  .btn-cancel {
    padding: 12px 24px;
    font-size: 14px;
    font-weight: 600;
    color: var(--color-neutral-600);
    background: var(--color-neutral-100);
    border: 1px solid var(--color-neutral-300);
    border-radius: var(--radius-md);
    text-decoration: none;
  }
  .btn-cancel:hover {
    background: var(--color-neutral-200);
  }

  .btn-submit {
    padding: 12px 28px;
    font-size: 14px;
    font-weight: 700;
    color: var(--color-white);
    background: var(--color-primary-600);
    border: none;
    border-radius: var(--radius-md);
    cursor: pointer;
    box-shadow: var(--shadow-sm);
  }
  .btn-submit:hover {
    background: var(--color-primary-700);
  }

  .alert {
    padding: 14px 18px;
    border-radius: var(--radius-md);
    margin-bottom: 20px;
    font-size: 14px;
    font-weight: 600;
  }
  .error-box {
    background: #fef2f2;
    color: #991b1b;
    border: 1px solid #fca5a5;
  }
  .warning-box {
    background: #fffbeb;
    color: #92400e;
    border: 1px solid #fcd34d;
  }

  .loader-box {
    padding: 40px;
    text-align: center;
    color: var(--color-neutral-500);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }
  .spinner {
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
</style>
