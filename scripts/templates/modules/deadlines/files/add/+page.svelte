<script lang="ts">
  import { projectStore } from '$lib/stores/project';
  import { menuConfigStore } from '$lib/stores/menu';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { DeadlinesService } from '../deadlines.service';
  import { DeadlineSettingsService } from '../deadlineSettingsService';
  import type { DeadlineSettings, DeadlineCategory, DeadlineStatus, LinkedEntityType } from '../schema';
  import { pageTitle } from '$lib/stores/page';
  import { Card, Button } from '$lib';
  import { toast } from '$lib/stores/toast.svelte';
  import { AlertTriangle, List, Save, Calendar, Link } from '@lucide/svelte';
  import { CacheLookupService } from '$lib/services/cacheLookupService';

  let settings = $state<DeadlineSettings>({
    entityNaming: 'scadenzario',
    customSingularLabel: '',
    customPluralLabel: '',
    prefix: 'DDL-',
    includeYear: true,
    numberPadding: 4,
    lastNumber: 0,
    lastCounterYear: new Date().getFullYear(),
    defaultStatus: 'attiva',
    defaultReminderDays: [30, 15, 7, 1],
    enablePushNotifications: false
  });

  let title = $state('');
  let category = $state<DeadlineCategory>('vehicle_inspection');
  let expiryDate = $state(new Date().toISOString().slice(0, 10));
  let status = $state<DeadlineStatus>('attiva');
  let isRecurring = $state(false);
  let recurringIntervalMonths = $state(12);
  let notes = $state('');

  let linkedEntityType = $state<LinkedEntityType>('vehicle');
  let linkedEntityId = $state('');
  let linkedEntityName = $state('');

  let vehiclesList = $state<{ id: string; name: string }[]>([]);
  let usersList = $state<{ id: string; name: string }[]>([]);
  let contractsList = $state<{ id: string; name: string }[]>([]);

  let saving = $state(false);
  let labels = $derived(DeadlineSettingsService.getLabels(settings));

  let hasVehiclesModule = $derived($menuConfigStore.some(m => m.id === 'vehicles'));
  let hasContractsModule = $derived($menuConfigStore.some(m => m.id === 'contracts'));

  onMount(async () => {
    try {
      const [s, uList] = await Promise.all([
        DeadlineSettingsService.getSettings(),
        CacheLookupService.getLookup('users')
      ]);
      settings = s;
      status = settings.defaultStatus || 'attiva';
      usersList = uList;

      if ($menuConfigStore.some(m => m.id === 'vehicles')) {
        vehiclesList = await CacheLookupService.getLookup('vehicles');
      }
      if ($menuConfigStore.some(m => m.id === 'contracts')) {
        contractsList = await CacheLookupService.getLookup('contracts');
      }

      pageTitle.set(labels.newBtn);
    } catch (e) {
      console.error('Errore inizializzazione form scadenze:', e);
    }
  });

  function handleEntitySelectChange(e: Event) {
    const target = e.target as HTMLSelectElement;
    const selectedId = target.value;
    linkedEntityId = selectedId;

    if (linkedEntityType === 'vehicle') {
      const found = vehiclesList.find(v => v.id === selectedId);
      linkedEntityName = found ? found.name : '';
    } else if (linkedEntityType === 'user') {
      const found = usersList.find(u => u.id === selectedId);
      linkedEntityName = found ? found.name : '';
    } else if (linkedEntityType === 'contract') {
      const found = contractsList.find(c => c.id === selectedId);
      linkedEntityName = found ? found.name : '';
    }
  }

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (!title.trim() || !expiryDate) {
      toast.error('Oggetto e Data Scadenza sono obbligatori');
      return;
    }

    saving = true;
    try {
      await DeadlinesService.createDeadline({
        title: title.trim(),
        category,
        linkedEntityType: linkedEntityId ? linkedEntityType : undefined,
        linkedEntityId: linkedEntityId || undefined,
        linkedEntityName: linkedEntityName || undefined,
        expiryDate,
        reminderDaysBefore: settings.defaultReminderDays || [30, 15, 7, 1],
        status,
        isRecurring,
        recurringIntervalMonths: isRecurring ? recurringIntervalMonths : undefined,
        notes
      });

      toast.success(`${labels.singular} creata con successo!`);
      goto('/dashboard/deadlines');
    } catch (err: any) {
      console.error('Errore salvataggio scadenza:', err);
      toast.error(err.message || 'Errore durante il salvataggio');
    } finally {
      saving = false;
    }
  }
</script>

<svelte:head>
  <title>{labels.newBtn} | {$projectStore?.projectName || 'ERP'}</title>
</svelte:head>

<div class="add-deadline-container">
  <header class="page-header">
    <div class="header-title-box">
      <a href="/dashboard/deadlines" class="btn-module-list" title="Vai a elenco {labels.plural}" aria-label="Vai a elenco {labels.plural}">
        <List size={20} />
      </a>
      <div class="header-icon">
        <AlertTriangle size={24} color="#D97706" />
      </div>
      <div>
        <h1 class="page-main-title">{labels.newBtn}</h1>
        <p class="page-main-subtitle">Imposta data di scadenza, alert automatici ed inserisci l'entità collegata.</p>
      </div>
    </div>
  </header>

  <form onsubmit={handleSubmit}>
    <div class="form-layout">
      <Card class="form-card">
        <h2 class="section-title">Dati Generali Scadenza</h2>

        <div class="form-grid">
          <div class="form-group span-2">
            <label for="titleInput">Oggetto / Titolo Scadenza *</label>
            <input 
              id="titleInput" 
              type="text" 
              bind:value={title} 
              placeholder="es. Revisione Furgone VEH-01 o Visita Medica Mario Rossi" 
              required 
              class="form-control"
            />
          </div>

          <div class="form-group">
            <label for="catSelect">Categoria *</label>
            <select id="catSelect" bind:value={category} class="form-control">
              <option value="vehicle_inspection">Revisione Mezzo / Furgone</option>
              <option value="vehicle_tax">Bollo Mezzo</option>
              <option value="vehicle_insurance">Assicurazione Mezzo</option>
              <option value="medical_checkup">Visita Medica Dipendente</option>
              <option value="safety_course">Corso Sicurezza / Abilitazione</option>
              <option value="contract_expiry">Scadenza Contratto</option>
              <option value="certification">Certificazione / Rating</option>
              <option value="custom">Personalizzato / Altro</option>
            </select>
          </div>

          <div class="form-group">
            <label for="dateInput">Data Scadenza *</label>
            <input 
              id="dateInput" 
              type="date" 
              bind:value={expiryDate} 
              required 
              class="form-control"
            />
          </div>

          <div class="form-group">
            <label for="statusSelect">Stato Alert</label>
            <select id="statusSelect" bind:value={status} class="form-control">
              <option value="attiva">Attiva</option>
              <option value="in_scadenza">In Scadenza</option>
              <option value="scaduta">Scaduta</option>
              <option value="rinnovata">Rinnovata</option>
              <option value="archiviata">Archiviata</option>
            </select>
          </div>

          <div class="form-group">
            <label for="recurringCheck" class="checkbox-label">
              <input id="recurringCheck" type="checkbox" bind:checked={isRecurring} />
              <span>Scadenza Ricorrente Periodica</span>
            </label>
            {#if isRecurring}
              <div class="recurring-box">
                <label for="monthsInput">Rinnova ogni N mesi:</label>
                <input id="monthsInput" type="number" min="1" max="60" bind:value={recurringIntervalMonths} class="form-control small" />
              </div>
            {/if}
          </div>

          <!-- ENTITA' COLLEGATA -->
          <div class="form-group span-2">
            <label for="entityTypeSelect">Entità Collegata (Opzionale)</label>
            <div class="linked-entity-grid">
              <select id="entityTypeSelect" bind:value={linkedEntityType} class="form-control">
                {#if hasVehiclesModule}
                  <option value="vehicle">Mezzo / Furgone</option>
                {/if}
                <option value="user">Utente / Dipendente</option>
                {#if hasContractsModule}
                  <option value="contract">Contratto</option>
                {/if}
                <option value="other">Altro / Testo Libero</option>
              </select>

              {#if linkedEntityType === 'vehicle' && hasVehiclesModule}
                <select id="entitySelect" value={linkedEntityId} onchange={handleEntitySelectChange} class="form-control">
                  <option value="">-- Seleziona Mezzo --</option>
                  {#each vehiclesList as v}
                    <option value={v.id}>{v.name}</option>
                  {/each}
                </select>
              {:else if linkedEntityType === 'user'}
                <select id="entitySelect" value={linkedEntityId} onchange={handleEntitySelectChange} class="form-control">
                  <option value="">-- Seleziona Dipendente --</option>
                  {#each usersList as u}
                    <option value={u.id}>{u.name}</option>
                  {/each}
                </select>
              {:else if linkedEntityType === 'contract' && hasContractsModule}
                <select id="entitySelect" value={linkedEntityId} onchange={handleEntitySelectChange} class="form-control">
                  <option value="">-- Seleziona Contratto --</option>
                  {#each contractsList as c}
                    <option value={c.id}>{c.name}</option>
                  {/each}
                </select>
              {:else}
                <input type="text" bind:value={linkedEntityName} placeholder="Nome dell'entità o riferimento..." class="form-control" />
              {/if}
            </div>
          </div>

          <div class="form-group span-2">
            <label for="notesInput">Note & Dettagli</label>
            <textarea 
              id="notesInput" 
              bind:value={notes} 
              rows="3" 
              placeholder="Note aggiuntive, dettagli sulla polizza o istruzioni per il rinnovo..." 
              class="form-control"
            ></textarea>
          </div>
        </div>

        <div class="form-actions">
          <a href="/dashboard/deadlines" class="btn-cancel">Annulla</a>
          <Button variant="primary" type="submit" disabled={saving}>
            <Save size={18} />
            <span>{saving ? 'Salvataggio...' : `Salva ${labels.singular}`}</span>
          </Button>
        </div>
      </Card>
    </div>
  </form>
</div>

<style>
  .add-deadline-container {
    display: flex;
    flex-direction: column;
    gap: 20px;
    width: 100%;
  }
  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .header-title-box {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .btn-back {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: var(--radius-md);
    background: var(--color-neutral-100);
    color: var(--color-neutral-700);
    text-decoration: none;
  }
  .header-icon {
    width: 44px;
    height: 44px;
    border-radius: var(--radius-lg);
    background: #FFFBEB;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .page-main-title {
    font-size: 20px;
    font-weight: 700;
    margin: 0;
  }
  .page-main-subtitle {
    font-size: 13px;
    color: var(--color-neutral-500);
    margin: 2px 0 0 0;
  }
  .form-layout {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
  .section-title {
    font-size: 16px;
    font-weight: 600;
    margin: 0 0 16px 0;
  }
  .form-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }
  .span-2 { grid-column: span 2; }
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
  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    margin-top: 24px;
  }
  .recurring-box {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 6px;
  }
  .form-control {
    padding: 10px 12px;
    border: 1px solid var(--color-neutral-200);
    border-radius: var(--radius-md);
    font-size: 14px;
    background: white;
  }
  .form-control.small {
    width: 90px;
  }
  .linked-entity-grid {
    display: grid;
    grid-template-columns: 1fr 2fr;
    gap: 12px;
  }
  .form-actions {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 12px;
    margin-top: 24px;
    padding-top: 16px;
    border-top: 1px solid var(--color-neutral-100);
  }
  .btn-cancel {
    padding: 8px 16px;
    color: var(--color-neutral-600);
    text-decoration: none;
    font-size: 14px;
  }
</style>
