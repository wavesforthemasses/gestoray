<script lang="ts">
  import { projectStore } from '$lib/stores/project';
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { PlacesService } from '../../places.service';
  import { PlaceSettingsService } from '../../placeSettingsService';
  import type { PlaceItem, PlaceSettings, PlaceStatus } from '../../schema';
  import { CacheLookupService } from '$lib/services/cacheLookupService';
  import { toast } from '$lib/stores/toast.svelte';
  import { MapPin, ArrowLeft, Save, User, Phone, Pencil } from '@lucide/svelte';
  import { FormField, Autocomplete } from '$lib';

  const placeId = $page.params.id || '';

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

  let place = $state<PlaceItem | null>(null);
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
      const [s, cList, item] = await Promise.all([
        PlaceSettingsService.getSettings(),
        CacheLookupService.getLookup('clients'),
        PlacesService.getPlaceById(placeId)
      ]);
      settings = s;
      clients = cList;
      place = item;

      if (item) {
        name = item.name || '';
        clientId = item.clientId || '';
        status = item.status || 'attivo';
        contactPerson = item.contactPerson || '';
        phone = item.phone || '';
        notes = item.notes || '';
        if (item.address) {
          street = item.address.street || '';
          city = item.address.city || '';
          zip = item.address.zip || '';
          province = item.address.province || '';
        }
      }
    } catch (e) {
      console.error('Errore caricamento modifica luogo:', e);
    } finally {
      loading = false;
    }
  });

  async function handleSubmit(e: Event) {
    e.preventDefault();
    if (!place) return;

    if (!clientId) {
      toast.error('Seleziona un cliente titolare obbligatorio');
      return;
    }

    if (!name.trim()) {
      toast.error('Inserisci la denominazione del ' + labels.singular.toLowerCase());
      return;
    }

    saving = true;

    try {
      const updatePayload: Partial<PlaceItem> = {
        name: name.trim(),
        clientId,
        status,
        contactPerson: contactPerson.trim(),
        phone: phone.trim(),
        notes: notes.trim(),
        address: (street || city) ? { street, city, zip, province } : undefined
      };

      await PlacesService.updatePlace(place.id!, updatePayload);
      toast.success(`${labels.singular} aggiornato con successo!`);
      goto(`/dashboard/places/${place.id}`);
    } catch (err: any) {
      console.error('Errore modifica luogo:', err);
      toast.error('Errore durante il salvataggio: ' + (err.message || err));
    } finally {
      saving = false;
    }
  }
</script>

<svelte:head>
  <title>Modifica {place ? place.name : labels.singular} | {$projectStore?.projectName || 'ERP'}</title>
</svelte:head>

<div class="edit-place-container">
  <header class="page-header">
    <div class="header-title-box">
      <a href="/dashboard/places/{placeId}" class="btn-back" title="Torna al dettaglio">
        <ArrowLeft size={20} />
      </a>
      <div>
        <h1 class="page-main-title">Modifica {labels.singular}</h1>
        <p class="page-main-subtitle">Aggiorna le informazioni dell'ubicazione o del cantiere.</p>
      </div>
    </div>
  </header>

  {#if loading}
    <div class="loading-box">Caricamento scheda in corso...</div>
  {:else if !place}
    <div class="not-found-box">
      <h2>{labels.singular} non trovato</h2>
      <a href="/dashboard/places">Torna alla lista</a>
    </div>
  {:else}
    <form onsubmit={handleSubmit} class="edit-form">
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
        <a href="/dashboard/places/{placeId}" class="btn-cancel">Annulla</a>
        <button type="submit" class="btn-save" disabled={saving}>
          <Save size={18} />
          <span>{saving ? 'Salvataggio...' : `Salva Modifiche`}</span>
        </button>
      </div>
    </form>
  {/if}
</div>

<style>
  .edit-place-container { padding: 24px; width: 100%; max-width: none; }
  .page-header { margin-bottom: 24px; }
  .header-title-box { display: flex; align-items: center; gap: 16px; }
  .btn-back { display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; border-radius: 8px; background: white; border: 1px solid var(--color-neutral-300); color: var(--color-neutral-700); text-decoration: none; }
  .page-main-title { font-size: 24px; font-weight: 700; margin: 0; }
  .page-main-subtitle { font-size: 13px; color: var(--color-neutral-500); margin: 2px 0 0 0; }
  .edit-form { display: flex; flex-direction: column; gap: 24px; }
  .form-section { background: white; border: 1px solid var(--color-neutral-200); border-radius: 12px; padding: 24px; }
  .section-title { font-size: 16px; font-weight: 700; margin: 0 0 16px 0; display: flex; align-items: center; gap: 8px; }
  .section-desc { font-size: 13px; color: var(--color-neutral-500); margin: -10px 0 16px 0; }
  .form-grid-2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; margin-bottom: 16px; }
  .form-control { width: 100%; padding: 10px 14px; border-radius: 8px; border: 1px solid var(--color-neutral-300); font-size: 14px; }
  .input-with-icon { position: relative; }
  .field-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--color-neutral-400); }
  .input-with-icon .form-control { padding-left: 38px; }
  .uppercase { text-transform: uppercase; }
  .form-actions { display: flex; justify-content: flex-end; align-items: center; gap: 12px; }
  .btn-cancel { padding: 10px 20px; border-radius: 8px; border: 1px solid var(--color-neutral-300); background: white; color: var(--color-neutral-700); text-decoration: none; font-weight: 600; }
  .btn-save { display: flex; align-items: center; gap: 8px; padding: 10px 20px; border-radius: 8px; background: var(--color-primary-600); color: white; border: none; font-weight: 600; cursor: pointer; }
</style>
