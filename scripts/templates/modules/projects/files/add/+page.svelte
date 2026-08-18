<script lang="ts">
  import { projectStore } from '$lib/stores/project';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { ProjectsService } from '../projects.service';
  import { ProjectSettingsService } from '../projectSettingsService';
  import type { ProjectSettings, ProjectStatus } from '../schema';
  import { CacheLookupService } from '$lib/services/cacheLookupService';
  import { authState } from '$lib/auth.svelte';
  import { toast } from '$lib/stores/toast.svelte';
  import { FolderKanban, List, Save, MapPin } from '@lucide/svelte';
  import { FormField, Autocomplete } from '$lib';

  let settings = $state<ProjectSettings>({
    entityNaming: 'progetto',
    customSingularLabel: '',
    customPluralLabel: '',
    prefix: 'PROG-',
    includeYear: true,
    numberPadding: 3,
    lastNumber: 0,
    lastCounterYear: new Date().getFullYear(),
    defaultStatus: 'fase_contrattuale'
  });
  let labels = $derived(ProjectSettingsService.getLabels(settings));

  let clients = $state<{ id: string; name: string }[]>([]);
  let clientOptions = $derived(clients.map(c => ({ id: c.id, label: c.name })));

  let loading = $state(true);
  let saving = $state(false);

  // Form State
  let name = $state('');
  let clientId = $state('');
  let status = $state<ProjectStatus>('fase_contrattuale');
  let progress = $state(0);
  let estimatedAmount = $state(0);
  let startDate = $state(new Date().toISOString().slice(0, 10));
  let endDate = $state('');
  let street = $state('');
  let city = $state('');
  let zip = $state('');
  let province = $state('');
  let notes = $state('');

  onMount(async () => {
    try {
      const [s, cList] = await Promise.all([
        ProjectSettingsService.getSettings(),
        CacheLookupService.getLookup('clients')
      ]);
      settings = s;
      clients = cList;
      status = s.defaultStatus || 'fase_contrattuale';

      const urlParams = new URLSearchParams(window.location.search);
      const preClient = urlParams.get('clientId');
      if (preClient) {
        clientId = preClient;
      }
    } catch (e) {
      console.error('Errore caricamento dati creazione progetto:', e);
    } finally {
      loading = false;
    }
  });

  async function handleSubmit(e: Event) {
    e.preventDefault();
    if (!clientId) {
      toast.error('Seleziona un cliente intestatario obbligatorio');
      return;
    }

    if (!name.trim()) {
      toast.error('Inserisci la denominazione del progetto');
      return;
    }

    saving = true;

    try {
      const form = {
        name: name.trim(),
        clientId,
        status,
        progress: Number(progress) || 0,
        estimatedAmount: Number(estimatedAmount) || 0,
        startDate,
        endDate: endDate || undefined,
        notes: notes.trim(),
        address: (street || city) ? { street, city, zip, province } : undefined
      };

      const newId = await ProjectsService.createProject(form, authState.user?.uid || '');
      toast.success(`${labels.singular} creato con successo!`);
      goto(`/dashboard/projects/${newId}`);
    } catch (err: any) {
      console.error('Errore salvataggio progetto:', err);
      toast.error('Errore durante la creazione: ' + err.message);
    } finally {
      saving = false;
    }
  }
</script>

<svelte:head>
  <title>{labels.newBtn} | {$projectStore?.projectName || 'ERP'}</title>
</svelte:head>

<div class="create-project-container">
  <div class="top-nav-bar">
    <a href="/dashboard/projects" class="btn-module-list" title="Vai all'elenco {labels.plural}" aria-label="Vai all'elenco {labels.plural}">
      <List size={20} />
    </a>
  </div>

  <header class="create-header">
    <div class="header-icon">
      <FolderKanban size={24} color="var(--color-primary-500)" />
    </div>
    <div>
      <h1 class="page-title">{labels.newBtn}</h1>
      <p class="page-subtitle">Inserisci le informazioni generali del nuovo contenitore / progetto.</p>
    </div>
  </header>

  {#if loading}
    <p>Caricamento...</p>
  {:else}
    <form onsubmit={handleSubmit} class="form-grid-layout">
      <div class="form-card">
        <h3>Informazioni Generali</h3>

        <div class="form-group">
          <FormField id="clientId" label="Cliente Intestatario *">
            <Autocomplete
              options={clientOptions}
              bind:value={clientId}
              placeholder="Seleziona cliente..."
            />
          </FormField>
        </div>

        <div class="form-group">
          <label for="name">Denominazione / Titolo {labels.singular} *</label>
          <input type="text" id="name" bind:value={name} required placeholder="es. Progetto Ristrutturazione Sede" class="form-input" />
        </div>

        <div class="form-row-2">
          <div class="form-group">
            <label for="status">Stato Iniziale</label>
            <select id="status" bind:value={status} class="form-select">
              <option value="fase_contrattuale">Fase Contrattuale / Valutazione</option>
              <option value="aperto">Aperto / In Corso</option>
              <option value="in_pausa">In Pausa / Sospeso</option>
              <option value="completato">Completato / Chiuso</option>
            </select>
          </div>

          <div class="form-group">
            <label for="estimatedAmount">Importo Stimato (€)</label>
            <input type="number" id="estimatedAmount" bind:value={estimatedAmount} min="0" step="100" class="form-input" />
          </div>
        </div>

        <div class="form-row-2">
          <div class="form-group">
            <label for="startDate">Data Inizio</label>
            <input type="date" id="startDate" bind:value={startDate} class="form-input" />
          </div>
          <div class="form-group">
            <label for="endDate">Data Fine Prevista</label>
            <input type="date" id="endDate" bind:value={endDate} class="form-input" />
          </div>
        </div>

        <div class="address-section-card">
          <div class="section-subtitle-heading">
            <MapPin size={16} class="text-primary" />
            <span>Ubicazione & Indirizzo {labels.singular}</span>
          </div>

          <div class="form-group">
            <label for="street">Indirizzo e Civico</label>
            <input type="text" id="street" bind:value={street} placeholder="es. Via Garibaldi 45" class="form-input" />
          </div>

          <div class="form-row-3">
            <div class="form-group">
              <label for="city">Città / Comune</label>
              <input type="text" id="city" bind:value={city} placeholder="es. Milano" class="form-input" />
            </div>

            <div class="form-group">
              <label for="zip">CAP</label>
              <input type="text" id="zip" bind:value={zip} placeholder="es. 20121" class="form-input" />
            </div>

            <div class="form-group">
              <label for="province">Provincia (Sigla)</label>
              <input type="text" id="province" bind:value={province} placeholder="es. MI" maxlength="2" class="form-input uppercase-input" />
            </div>
          </div>
        </div>

        <div class="form-group margin-top-16">
          <label for="notes">Note Generali & Istruzioni Cantiere</label>
          <textarea id="notes" bind:value={notes} rows="3" class="form-textarea" placeholder="Note operative, accesso, referenti..."></textarea>
        </div>

        <div class="actions-row">
          <a href="/dashboard/projects" class="btn-cancel">Annulla</a>
          <button type="submit" class="btn-submit" disabled={saving}>
            <Save size={16} />
            <span>{saving ? 'Salvataggio...' : 'Crea Progetto'}</span>
          </button>
        </div>
      </div>
    </form>
  {/if}
</div>

<style>
  .create-project-container {
    padding: 24px;
    width: 100%;
    max-width: none;
  }
  .top-nav-bar { margin-bottom: 16px; }
  .back-link {
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--color-neutral-600);
    text-decoration: none;
    font-size: 13px;
  }
  .create-header {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 24px;
  }
  .header-icon {
    width: 44px;
    height: 44px;
    border-radius: 10px;
    background: var(--color-primary-50);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .page-title { font-size: 20px; font-weight: 700; margin: 0; }
  .page-subtitle { font-size: 13px; color: var(--color-neutral-500); margin: 2px 0 0 0; }
  .form-card {
    background: white;
    border-radius: 12px;
    border: 1px solid var(--color-neutral-200);
    padding: 24px;
  }
  .form-card h3 { font-size: 16px; margin: 0 0 16px 0; }
  .form-group { display: flex; flex-direction: column; gap: 6px; margin-bottom: 16px; }
  .form-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .form-row-3 { display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 16px; }
  .address-section-card {
    background: var(--color-neutral-50, #f8fafc);
    border: 1px solid var(--color-neutral-200, #e2e8f0);
    border-radius: var(--radius-lg, 10px);
    padding: 16px 18px;
    margin: 16px 0;
  }
  .section-subtitle-heading {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    font-weight: 700;
    color: var(--color-neutral-800, #1e293b);
    margin-bottom: 14px;
  }
  .uppercase-input { text-transform: uppercase; }
  .margin-top-16 { margin-top: 16px; }
  .text-primary { color: var(--color-primary-600, #2563eb); }
  .form-input, .form-select, .form-textarea {
    padding: 10px 12px;
    border-radius: 8px;
    border: 1px solid var(--color-neutral-300);
    font-size: 14px;
  }
  .actions-row {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    margin-top: 20px;
  }
  .btn-cancel {
    padding: 10px 16px;
    border-radius: 8px;
    text-decoration: none;
    color: var(--color-neutral-600);
    background: var(--color-neutral-100);
    font-size: 14px;
  }
  .btn-submit {
    display: flex;
    align-items: center;
    gap: 8px;
    background: var(--color-primary-600);
    color: white;
    padding: 10px 18px;
    border-radius: 8px;
    border: none;
    font-weight: 600;
    font-size: 14px;
    cursor: pointer;
  }
</style>
