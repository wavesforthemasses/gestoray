<script lang="ts">
  import { projectStore } from '$lib/stores/project';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { NavigationService } from '$lib/services/navigationService';
  import { PlacesService } from '../places.service';
  import { PlaceSettingsService } from '../placeSettingsService';
  import type { PlaceSettings, PlaceStatus } from '../schema';
  import { CacheLookupService } from '$lib/services/cacheLookupService';
  import { authState } from '$lib/auth.svelte';
  import { toast } from '$lib/stores/toast.svelte';
  import { MapPin, ArrowLeft, Save, User, Phone } from '@lucide/svelte';
  import { FormField, Autocomplete } from '$lib';

  let settings = $state<PlaceSettings>({
    entityNaming: 'cantiere',
    customSingularLabel: '',
    customPluralLabel: '',
    prefix: 'LUG-',
    includeYear: true,
    numberPadding: 3,
    lastNumber: 0,
    lastCounterYear: new Date().getFullYear(),
    defaultStatus: 'attivo'
  });
  let labels = $derived(PlaceSettingsService.getLabels(settings));

  let clients = $state<{ id: string; name: string }[]>([]);
  let clientOptions = $derived(clients.map(c => ({ id: c.id, label: c.name })));

  let loading = $state(true);
  let saving = $state(false);

  // Form State
  let name = $state('');
  let clientId = $state('');
  let status = $state<PlaceStatus>('attivo');
  let contactPerson = $state('');
  let phone = $state('');
  let street = $state('');
  let city = $state('');
  let zip = $state('');
  let province = $state('');
  let notes = $state('');

  onMount(async () => {
    try {
      const [s, cList] = await Promise.all([
        PlaceSettingsService.getSettings(),
        CacheLookupService.getLookup('clients')
      ]);
      settings = s;
      clients = cList;
      status = s.defaultStatus || 'attivo';

      const urlParams = new URLSearchParams(window.location.search);
      const preClient = urlParams.get('clientId');
      if (preClient) {
        clientId = preClient;
      }
    } catch (e) {
      console.error('Errore caricamento dati creazione luogo:', e);
    } finally {
      loading = false;
    }
  });

  async function handleSubmit(e: Event) {
    e.preventDefault();
    if (!clientId) {
      toast.error('Seleziona un cliente proprietario/titolare obbligatorio');
      return;
    }

    if (!name.trim()) {
      toast.error('Inserisci la denominazione del luogo/cantiere');
      return;
    }

    saving = true;

    try {
      const form = {
        name: name.trim(),
        clientId,
        status,
        contactPerson: contactPerson.trim(),
        phone: phone.trim(),
        notes: notes.trim(),
        address: (street || city) ? { street, city, zip, province } : undefined
      };

      const newId = await PlacesService.createPlace(form, authState.user?.uid || '');
      toast.success(`${labels.singular} creato con successo!`);
      await NavigationService.submitSuccessReturn($page.url.searchParams, `/dashboard/places/${newId}`);
    } catch (err: any) {
      console.error('Errore salvataggio luogo:', err);
      toast.error('Errore durante il salvataggio: ' + (err.message || err));
    } finally {
      saving = false;
    }
  }
</script>

<svelte:head>
  <title>Nuovo {labels.singular} | {$projectStore?.projectName || 'ERP'}</title>
</svelte:head>

<div class="create-place-container">
  <header class="page-header">
    <div class="header-title-box">
      <button 
        type="button" 
        class="btn-back btn-back-context" 
        onclick={() => NavigationService.navigateBack($page.url.searchParams, '/dashboard/places')}
        title={NavigationService.getBackLabel($page.url.searchParams, 'Torna alla lista')}
      >
        <ArrowLeft size={20} />
      </button>
      <div>
        <h1 class="page-main-title">Nuovo {labels.singular}</h1>
        <p class="page-main-subtitle">Inserisci un nuovo cantiere, luogo fisico o destinazione operativa.</p>
      </div>
    </div>
  </header>

  {#if loading}
    <div class="loading-box">Caricamento modulo in corso...</div>
  {:else}
    <form onsubmit={handleSubmit} class="create-form">
      <div class="form-section">
        <h3 class="section-title">Informazioni Generali</h3>
        
        <div class="form-grid-2">
          <FormField id="clientId" label="Cliente Intestatario / Titolare" required>
            <Autocomplete
              options={clientOptions}
              bind:value={clientId}
              placeholder="Cerca e seleziona cliente..."
            />
          </FormField>

          <FormField id="name" label="Denominazione {labels.singular}" required>
            <input 
              type="text" 
              id="name" 
              bind:value={name} 
              placeholder="Es. Cantiere Via Dante / Sede Operativa Milano" 
              required
              class="form-control"
            />
          </FormField>
        </div>

        <div class="form-grid-2">
          <FormField id="status" label="Stato Operativo">
            <select id="status" bind:value={status} class="form-control">
              <option value="attivo">Attivo</option>
              <option value="inattivo">Inattivo / Concluso</option>
            </select>
          </FormField>

          <FormField id="contactPerson" label="Persona di Riferimento / Custode">
            <div class="input-with-icon">
              <User size={16} class="field-icon" />
              <input 
                type="text" 
                id="contactPerson" 
                bind:value={contactPerson} 
                placeholder="Es. Mario Rossi (Capocantiere)"
                class="form-control"
              />
            </div>
          </FormField>
        </div>

        <div class="form-grid-2">
          <FormField id="phone" label="Telefono di Riferimento Cantiere">
            <div class="input-with-icon">
              <Phone size={16} class="field-icon" />
              <input 
                type="text" 
                id="phone" 
                bind:value={phone} 
                placeholder="Es. +39 340 1234567"
                class="form-control"
              />
            </div>
          </FormField>
        </div>
      </div>

      <div class="form-section">
        <h3 class="section-title"><MapPin size={18} /> Ubicazione & Indirizzo del Cantiere</h3>
        <p class="section-desc">Inserisci i dati per consentire ai tecnici ed ai mezzi di raggiungere il luogo.</p>
        
        <div class="form-grid-2">
          <FormField id="street" label="Indirizzo e Civico">
            <input 
              type="text" 
              id="street" 
              bind:value={street} 
              placeholder="Es. Via Dante Alighieri 15" 
              class="form-control"
            />
          </FormField>

          <FormField id="city" label="Città / Comune">
            <input 
              type="text" 
              id="city" 
              bind:value={city} 
              placeholder="Es. Milano" 
              class="form-control"
            />
          </FormField>
        </div>

        <div class="form-grid-2">
          <FormField id="zip" label="CAP">
            <input 
              type="text" 
              id="zip" 
              bind:value={zip} 
              placeholder="Es. 20121" 
              class="form-control"
            />
          </FormField>

          <FormField id="province" label="Provincia (Sigla)">
            <input 
              type="text" 
              id="province" 
              bind:value={province} 
              placeholder="Es. MI" 
              maxLength={2}
              class="form-control uppercase"
            />
          </FormField>
        </div>
      </div>

      <div class="form-section">
        <h3 class="section-title">Note & Istruzioni d'Accesso</h3>
        <FormField id="notes" label="Note Operative">
          <textarea 
            id="notes" 
            bind:value={notes} 
            rows={4} 
            placeholder="Istruzioni per l'accesso, Orari cantiere, Note per i tecnici..."
            class="form-control"
          ></textarea>
        </FormField>
      </div>

      <div class="form-actions">
        <a href="/dashboard/places" class="btn-cancel">Annulla</a>
        <button type="submit" class="btn-save" disabled={saving}>
          <Save size={18} />
          <span>{saving ? 'Salvataggio...' : `Salva ${labels.singular}`}</span>
        </button>
      </div>
    </form>
  {/if}
</div>

<style>
  .create-place-container {
    padding: 24px;
    width: 100%;
    max-width: none;
  }
  .page-header {
    margin-bottom: 24px;
  }
  .header-title-box {
    display: flex;
    align-items: center;
    gap: 16px;
  }
  .btn-back {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 8px;
    background: white;
    border: 1px solid var(--color-neutral-300);
    color: var(--color-neutral-700);
    text-decoration: none;
  }
  .page-main-title {
    font-size: 24px;
    font-weight: 700;
    margin: 0;
  }
  .page-main-subtitle {
    font-size: 13px;
    color: var(--color-neutral-500);
    margin: 2px 0 0 0;
  }
  .create-form {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }
  .form-section {
    background: white;
    border: 1px solid var(--color-neutral-200);
    border-radius: 12px;
    padding: 24px;
  }
  .section-title {
    font-size: 16px;
    font-weight: 700;
    margin: 0 0 16px 0;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .section-desc {
    font-size: 13px;
    color: var(--color-neutral-500);
    margin: -10px 0 16px 0;
  }
  .form-grid-2 {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 16px;
    margin-bottom: 16px;
  }
  .form-control {
    width: 100%;
    padding: 10px 14px;
    border-radius: 8px;
    border: 1px solid var(--color-neutral-300);
    font-size: 14px;
  }
  .input-with-icon {
    position: relative;
  }
  .field-icon {
    position: absolute;
    left: 12px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--color-neutral-400);
  }
  .input-with-icon .form-control {
    padding-left: 38px;
  }
  .uppercase {
    text-transform: uppercase;
  }
  .form-actions {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 12px;
  }
  .btn-cancel {
    padding: 10px 20px;
    border-radius: 8px;
    border: 1px solid var(--color-neutral-300);
    background: white;
    color: var(--color-neutral-700);
    text-decoration: none;
    font-weight: 600;
  }
  .btn-save {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 20px;
    border-radius: 8px;
    background: var(--color-primary-600);
    color: white;
    border: none;
    font-weight: 600;
    cursor: pointer;
  }
</style>
