<script lang="ts">
  import type { InterventionItem, LocationItem } from '../../schema';
  import type { InterventionSettingsConfig } from '$lib/services/interventionSettings';
  import { CacheLookupService, type CacheLookupItem } from '$lib/services/cacheLookupService';
  import { InterventiService } from '../../interventi.service';
  import { TeamsService } from '../../teams.service';
  import { VehiclesService } from '../../vehicles.service';
  import type { TeamItem, VehicleItem } from '../../schema';

  interface Props {
    intervention: InterventionItem;
    settings: InterventionSettingsConfig;
    isOpen: boolean;
    onClose: () => void;
    onSave: (updated: Partial<InterventionItem>) => Promise<void>;
  }

  let { intervention, settings, isOpen, onClose, onSave }: Props = $props();

  // Form State
  let title = $state('');
  let description = $state('');
  let clientId = $state('');
  let clientName = $state('');
  let locationId = $state('');
  let locationName = $state('');
  let contractId = $state('');
  let contractTitle = $state('');
  let ticketId = $state('');
  let ticketSubject = $state('');
  let teamId = $state('');
  let teamName = $state('');
  let status = $state<InterventionItem['status']>('pianificato');
  let mode = $state<'a_bolla' | 'ad_erogazione'>('a_bolla');
  let type = $state('Manutenzione');
  let scheduledStartAt = $state('');
  let scheduledEndAt = $state('');

  let selectedOperatorUids = $state<string[]>([]);
  let selectedVehicleIds = $state<string[]>([]);

  // Lookups Data
  let clients = $state<CacheLookupItem[]>([]);
  let clientLocations = $state<LocationItem[]>([]);
  let contracts = $state<CacheLookupItem[]>([]);
  let tickets = $state<CacheLookupItem[]>([]);
  let teams = $state<TeamItem[]>([]);
  let users = $state<CacheLookupItem[]>([]);
  let vehicles = $state<VehicleItem[]>([]);

  let isSubmitting = $state(false);

  $effect(() => {
    if (isOpen && intervention) {
      title = intervention.title || '';
      description = intervention.description || '';
      clientId = intervention.clientId || '';
      clientName = intervention.clientName || '';
      locationId = intervention.locationId || '';
      locationName = intervention.locationName || '';
      contractId = intervention.contractId || '';
      contractTitle = intervention.contractTitle || '';
      ticketId = intervention.ticketId || '';
      ticketSubject = intervention.ticketSubject || '';
      teamId = intervention.teamId || '';
      teamName = intervention.teamName || '';
      status = intervention.status || 'pianificato';
      mode = intervention.mode || 'a_bolla';
      type = intervention.type || 'Manutenzione';
      scheduledStartAt = intervention.scheduledStartAt ? intervention.scheduledStartAt.substring(0, 16) : '';
      scheduledEndAt = intervention.scheduledEndAt ? intervention.scheduledEndAt.substring(0, 16) : '';
      selectedOperatorUids = intervention.assignedOperatorUids ? [...intervention.assignedOperatorUids] : [];
      selectedVehicleIds = intervention.vehicleIds ? [...intervention.vehicleIds] : [];

      loadLookups();
    }
  });

  async function loadLookups() {
    try {
      clients = await CacheLookupService.getLookup('clients');
      contracts = await CacheLookupService.getLookup('contracts');
      tickets = await CacheLookupService.getLookup('tickets');
      users = await CacheLookupService.getLookup('users');
      teams = await TeamsService.getTeams();
      vehicles = await VehiclesService.getVehicles();

      if (clientId) {
        clientLocations = await InterventiService.getLocationsForClient(clientId);
      }
    } catch (e) {
      console.warn('Errore caricamento lookups per modale modifica:', e);
    }
  }

  // Reload locations on client change
  $effect(() => {
    if (clientId) {
      const selected = clients.find(c => c.id === clientId);
      if (selected) clientName = selected.name;
      InterventiService.getLocationsForClient(clientId).then(locs => {
        clientLocations = locs;
      });
    } else {
      clientLocations = [];
      locationId = '';
      locationName = '';
    }
  });

  function toggleOperator(uId: string) {
    if (selectedOperatorUids.includes(uId)) {
      selectedOperatorUids = selectedOperatorUids.filter(id => id !== uId);
    } else {
      selectedOperatorUids = [...selectedOperatorUids, uId];
    }
  }

  function toggleVehicle(vId: string) {
    if (selectedVehicleIds.includes(vId)) {
      selectedVehicleIds = selectedVehicleIds.filter(id => id !== vId);
    } else {
      selectedVehicleIds = [...selectedVehicleIds, vId];
    }
  }

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    // Resolve names
    const selClient = clients.find(c => c.id === clientId);
    const selLoc = clientLocations.find(l => l.id === locationId);
    const selContract = contracts.find(c => c.id === contractId);
    const selTicket = tickets.find(t => t.id === ticketId);
    const selTeam = teams.find(t => t.id === teamId);

    isSubmitting = true;
    try {
      await onSave({
        title: title.trim(),
        description: description.trim(),
        clientId,
        clientName: selClient ? selClient.name : clientName,
        locationId,
        locationName: selLoc ? selLoc.name : locationName,
        contractId,
        contractTitle: selContract ? selContract.name : contractTitle,
        ticketId,
        ticketSubject: selTicket ? selTicket.name : ticketSubject,
        teamId,
        teamName: selTeam ? selTeam.name : teamName,
        status,
        mode,
        type,
        scheduledStartAt: scheduledStartAt ? new Date(scheduledStartAt).toISOString() : intervention.scheduledStartAt,
        scheduledEndAt: scheduledEndAt ? new Date(scheduledEndAt).toISOString() : intervention.scheduledEndAt,
        assignedOperatorUids: selectedOperatorUids,
        vehicleIds: selectedVehicleIds
      });
      onClose();
    } catch (err: any) {
      alert('Errore durante la modifica dell\'intervento: ' + err.message);
    } finally {
      isSubmitting = false;
    }
  }
</script>

{#if isOpen}
  <div class="modal-backdrop animate-fade-in" onclick={onClose} role="presentation">
    <div class="modal-card card" onclick={(e) => e.stopPropagation()} role="presentation">
      <div class="modal-header">
        <h3>✏️ Modifica Dettagli Intervento</h3>
        <button type="button" class="btn-close" onclick={onClose}>✕</button>
      </div>

      <form onsubmit={handleSubmit} class="modal-body">
        <!-- 1. CLIENTE E DESTINAZIONE -->
        <div class="form-section">
          <h4>👤 Cliente & Destinazione</h4>
          <div class="grid-2">
            <div class="form-group">
              <label for="edit-client">Cliente *</label>
              <select id="edit-client" bind:value={clientId} class="form-control" required>
                <option value="">-- Seleziona Cliente --</option>
                {#each clients as c}
                  <option value={c.id}>{c.name}</option>
                {/each}
              </select>
            </div>

            <div class="form-group">
              <label for="edit-loc">{settings.locationLabel}</label>
              <select id="edit-loc" bind:value={locationId} class="form-control" disabled={!clientId}>
                <option value="">-- Seleziona {settings.locationLabel} --</option>
                {#each clientLocations as l}
                  <option value={l.id}>{l.name} ({l.city || l.address})</option>
                {/each}
              </select>
            </div>
          </div>

          <div class="grid-2 mt-10">
            <div class="form-group">
              <label for="edit-contract">Contratto (Opzionale)</label>
              <select id="edit-contract" bind:value={contractId} class="form-control" disabled={!clientId}>
                <option value="">-- Nessun Contratto --</option>
                {#each contracts as c}
                  <option value={c.id}>{c.name}</option>
                {/each}
              </select>
            </div>

            <div class="form-group">
              <label for="edit-ticket">Ticket (Opzionale)</label>
              <select id="edit-ticket" bind:value={ticketId} class="form-control" disabled={!clientId}>
                <option value="">-- Nessun Ticket --</option>
                {#each tickets as t}
                  <option value={t.id}>{t.name}</option>
                {/each}
              </select>
            </div>
          </div>
        </div>

        <!-- 2. INFORMAZIONI INTERVENTO -->
        <div class="form-section">
          <h4>ℹ️ Informazioni Intervento</h4>
          <div class="form-group">
            <label for="edit-title">Titolo Intervento *</label>
            <input id="edit-title" type="text" bind:value={title} required class="form-control" />
          </div>

          <div class="grid-2 mt-10">
            <div class="form-group">
              <label for="edit-status">Stato Intervento</label>
              <select id="edit-status" bind:value={status} class="form-control">
                <option value="pianificato">Pianificato</option>
                <option value="in_lavorazione">In Lavorazione</option>
                <option value="completato">Completato</option>
                <option value="inviato_cliente">Inviato al Cliente</option>
                <option value="approvato">Approvato</option>
                <option value="fatturato">Fatturato</option>
              </select>
            </div>

            <div class="form-group">
              <label for="edit-mode">Modalità Operativa</label>
              <select id="edit-mode" bind:value={mode} class="form-control">
                <option value="a_bolla">A Bolla (Fatturabile separatamente)</option>
                <option value="ad_erogazione">Ad Erogazione (Monte Ore Contratto)</option>
              </select>
            </div>
          </div>

          <div class="grid-2 mt-10">
            <div class="form-group">
              <label for="edit-type">Tipologia Intervento</label>
              <select id="edit-type" bind:value={type} class="form-control">
                {#each settings.interventionTypes as t}
                  <option value={t.label}>{t.label}</option>
                {/each}
              </select>
            </div>

            <div class="form-group">
              <label for="edit-start">Data e Ora Inizio Prevista</label>
              <input id="edit-start" type="datetime-local" bind:value={scheduledStartAt} class="form-control" />
            </div>
          </div>

          <div class="form-group mt-10">
            <label for="edit-desc">Descrizione & Istruzioni Tecniche</label>
            <textarea id="edit-desc" bind:value={description} rows="3" class="form-control"></textarea>
          </div>
        </div>

        <!-- 3. SQUADRE, OPERATORI E MEZZI -->
        <div class="form-section">
          <h4>📅 Assegnazione Risorse Umane & Mezzi</h4>
          <div class="form-group">
            <label for="edit-team">Squadra di Lavoro (Opzionale)</label>
            <select id="edit-team" bind:value={teamId} class="form-control">
              <option value="">-- Seleziona Squadra --</option>
              {#each teams as tm}
                <option value={tm.id}>{tm.name}</option>
              {/each}
            </select>
          </div>

          <div class="form-group mt-10">
            <span class="label-sm">👷 Operatori Assegnati</span>
            <div class="checkbox-grid">
              {#each users as u}
                <label class="checkbox-pill">
                  <input 
                    type="checkbox" 
                    checked={selectedOperatorUids.includes(u.id)} 
                    onchange={() => toggleOperator(u.id)} 
                  />
                  <span>{u.name}</span>
                </label>
              {/each}
            </div>
          </div>

          <div class="form-group mt-10">
            <span class="label-sm">🚚 Mezzi Aziendali Assegnati</span>
            <div class="checkbox-grid">
              {#each vehicles as v}
                {#if v.id}
                  <label class="checkbox-pill">
                    <input 
                      type="checkbox" 
                      checked={selectedVehicleIds.includes(v.id)} 
                      onchange={() => toggleVehicle(v.id!)} 
                    />
                    <span>🚚 {v.name} ({v.plate || 'No Targa'})</span>
                  </label>
                {/if}
              {/each}
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" onclick={onClose} disabled={isSubmitting}>Annulla</button>
          <button type="submit" class="btn btn-primary" disabled={isSubmitting}>
            {isSubmitting ? 'Salvataggio...' : '💾 Salva Modifiche'}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
  }

  .modal-card {
    background: var(--color-white);
    border-radius: var(--radius-lg);
    width: 100%;
    max-width: 680px;
    max-height: 90vh;
    box-shadow: var(--shadow-xl);
    border: 1px solid var(--color-neutral-200);
    overflow-y: auto;
    display: flex;
    flex-direction: column;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    border-bottom: 1px solid var(--color-neutral-200);
    background: var(--color-neutral-50);
  }

  .modal-header h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 700;
    color: var(--color-neutral-800);
  }

  .btn-close {
    background: transparent;
    border: none;
    font-size: 18px;
    cursor: pointer;
    color: var(--color-neutral-500);
  }

  .modal-body {
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 18px;
  }

  .form-section {
    background: var(--color-neutral-50);
    border: 1px solid var(--color-neutral-200);
    border-radius: var(--radius-md);
    padding: 14px;
  }

  .form-section h4 {
    margin: 0 0 10px 0;
    font-size: 13px;
    font-weight: 700;
    color: var(--color-primary-700);
  }

  .grid-2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  .mt-10 {
    margin-top: 10px;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .form-group label, .label-sm {
    font-size: 12px;
    font-weight: 600;
    color: var(--color-neutral-700);
  }

  .form-control {
    padding: 8px 12px;
    font-size: 13px;
    border: 1px solid var(--color-neutral-300);
    border-radius: var(--radius-md);
    outline: none;
    background: var(--color-white);
  }

  .checkbox-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .checkbox-pill {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border: 1px solid var(--color-neutral-300);
    border-radius: 16px;
    background: var(--color-white);
    cursor: pointer;
    font-size: 12px;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    margin-top: 10px;
    padding-top: 14px;
    border-top: 1px solid var(--color-neutral-200);
  }

  .btn {
    padding: 8px 16px;
    font-size: 13px;
    font-weight: 600;
    border-radius: var(--radius-md);
    cursor: pointer;
    border: none;
  }

  .btn-secondary {
    background: var(--color-neutral-100);
    color: var(--color-neutral-700);
    border: 1px solid var(--color-neutral-300);
  }

  .btn-primary {
    background: var(--color-primary-600);
    color: var(--color-white);
  }

  .animate-fade-in {
    animation: fadeIn 0.2s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
</style>
