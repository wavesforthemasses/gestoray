<script lang="ts">
  import { onMount } from 'svelte';
  import type { PlaceDocument, PlaceType, PlaceStatus, PlaceContact } from '../../domain/models/place';
  import { VALID_PLACE_TYPES } from '../../domain/validation/place.schema';
  import { buildNormalizedKey, buildPlaceSummary, calculateGeohash } from '../../domain/services/placeUtils';
  import { NominatimGeocoderAdapter } from '../../infrastructure/geocoding/NominatimGeocoderAdapter';
  import { CacheLookupService } from '$lib/services/cacheLookupService';
  import { PlaceSettingsService } from '../../placeSettingsService';
  import PlaceMapViewer from '../components/PlaceMapViewer.svelte';
  import { toast } from '$lib/stores/toast.svelte';
  import { 
    MapPin, 
    Building2, 
    Warehouse, 
    Store, 
    Save, 
    Search, 
    User, 
    Phone, 
    Mail, 
    Plus, 
    Trash2, 
    Layers, 
    Truck, 
    Check, 
    Navigation,
    Info,
    Compass,
    ChevronDown,
    ChevronUp,
    AlertTriangle
  } from '@lucide/svelte';

  interface Props {
    initialData?: Partial<PlaceDocument>;
    allPlaces?: PlaceDocument[];
    isEditing?: boolean;
    onSubmit: (formData: Partial<PlaceDocument>) => Promise<void>;
  }

  let {
    initialData = {},
    allPlaces = [],
    isEditing = false,
    onSubmit
  }: Props = $props();

  let isSubmitting = $state(false);
  let isGeocoding = $state(false);
  let clients = $state<{ id: string; name: string }[]>([]);

  // Form Fields
  let name = $state(initialData.name || '');
  let code = $state(initialData.code || '');
  let types = $state<PlaceType[]>(initialData.types || ['site']);
  
  let initialStatus: PlaceStatus = 'active';
  if (initialData.status === 'inattivo' || initialData.status === 'archived') initialStatus = 'archived';
  else if (initialData.status === 'temporary') initialStatus = 'temporary';
  else if (initialData.status === 'completed') initialStatus = 'completed';

  let status = $state<PlaceStatus>(initialStatus);
  let clientId = $state(initialData.clientId || initialData.customerId || '');
  let parentId = $state<string | null>(initialData.parentId ?? null);

  // Address
  let street = $state(initialData.address?.street || '');
  let city = $state(initialData.address?.city || '');
  let province = $state(initialData.address?.province || '');
  let postalCode = $state(initialData.address?.postalCode || '');
  let country = $state(initialData.address?.country || 'IT');
  let customAddressEnabled = $state(false);

  // Geo
  let lat = $state<number | null>(
    (initialData.geo?.location as any)?.latitude ?? (initialData.geo?.location as any)?.lat ?? null
  );
  let lng = $state<number | null>(
    (initialData.geo?.location as any)?.longitude ?? (initialData.geo?.location as any)?.lng ?? null
  );
  let radiusMeters = $state(initialData.geo?.radiusMeters || 100);
  let geocodingStatus = $state(initialData.geocodingStatus || 'pending');

  // Contacts
  let contacts = $state<PlaceContact[]>(
    initialData.contacts && initialData.contacts.length > 0
      ? JSON.parse(JSON.stringify(initialData.contacts))
      : [
          {
            id: 'c-1',
            name: '',
            role: 'Referente Cantiere',
            phone: '',
            email: '',
            isPrimary: true
          }
        ]
  );

  // Access Info & Notes
  let accessNotes = $state(initialData.accessInfo?.notes || '');
  let heavyVehicleAccessible = $state(initialData.accessInfo?.heavyVehicleAccessible || false);
  let generalNotes = $state((initialData as any).notes || '');

  // Derived Parent Place & Location for Map Zoom
  let selectedParent = $derived(allPlaces.find(p => p.id === parentId));
  let parentLocation = $derived.by(() => {
    if (!selectedParent || !selectedParent.geo?.location) return null;
    const pLat = (selectedParent.geo.location as any).latitude ?? (selectedParent.geo.location as any).lat;
    const pLng = (selectedParent.geo.location as any).longitude ?? (selectedParent.geo.location as any).lng;
    if (typeof pLat !== 'number' || typeof pLng !== 'number') return null;
    return {
      lat: pLat,
      lng: pLng,
      name: selectedParent.name,
      radiusMeters: selectedParent.geo.radiusMeters || 100
    };
  });

  // Reactive Sync: When parent place is identified (via URL or select) and we are creating, auto-populate inherited fields
  let lastSyncedParentId = $state<string | null>(null);
  $effect(() => {
    if (selectedParent && parentId !== lastSyncedParentId && !isEditing) {
      lastSyncedParentId = parentId;
      if (selectedParent.address && (!street || !city)) {
        street = selectedParent.address.street || street;
        city = selectedParent.address.city || city;
        province = selectedParent.address.province || province;
        postalCode = selectedParent.address.postalCode || postalCode;
        country = selectedParent.address.country || country;
      }
      if (selectedParent.clientId && !clientId) {
        clientId = selectedParent.clientId;
      }
      if (selectedParent.geo?.location && (lat === null || lng === null)) {
        const pLat = (selectedParent.geo.location as any).latitude ?? (selectedParent.geo.location as any).lat;
        const pLng = (selectedParent.geo.location as any).longitude ?? (selectedParent.geo.location as any).lng;
        if (typeof pLat === 'number' && typeof pLng === 'number') {
          lat = pLat;
          lng = pLng;
          radiusMeters = 50;
          geocodingStatus = 'manual';
        }
      }
      if (selectedParent.accessInfo?.heavyVehicleAccessible !== undefined) {
        heavyVehicleAccessible = selectedParent.accessInfo.heavyVehicleAccessible;
      }
    }
  });

  onMount(async () => {
    try {
      clients = await CacheLookupService.getLookup('clients');
    } catch (e) {
      console.warn('Errore lettura lookup clienti:', e);
    }
  });

  function handleParentChange(e: Event) {
    const target = e.target as HTMLSelectElement;
    const newParentId = target.value ? target.value : null;
    parentId = newParentId;

    if (newParentId) {
      const p = allPlaces.find(x => x.id === newParentId);
      if (p) {
        if (!isEditing || (!street && !city)) {
          street = p.address?.street || '';
          city = p.address?.city || '';
          province = p.address?.province || '';
          postalCode = p.address?.postalCode || '';
          country = p.address?.country || 'IT';
        }
        if (!clientId && p.clientId) {
          clientId = p.clientId;
        }
        if (p.geo?.location) {
          const pLat = (p.geo.location as any).latitude ?? (p.geo.location as any).lat;
          const pLng = (p.geo.location as any).longitude ?? (p.geo.location as any).lng;
          if (typeof pLat === 'number' && typeof pLng === 'number') {
            lat = pLat;
            lng = pLng;
            radiusMeters = 50;
            geocodingStatus = 'manual';
          }
        }
        if (p.accessInfo?.heavyVehicleAccessible !== undefined && !isEditing) {
          heavyVehicleAccessible = p.accessInfo.heavyVehicleAccessible;
        }
        toast.info(`Dati collegati al cantiere principale: ${p.name}`);
      }
    }
  }

  function toggleType(type: PlaceType) {
    if (types.includes(type)) {
      if (types.length > 1) {
        types = types.filter(t => t !== type);
      }
    } else {
      types = [...types, type];
    }
  }

  function addContact() {
    contacts = [
      ...contacts,
      {
        id: `c-${Date.now()}`,
        name: '',
        role: 'Referente',
        phone: '',
        email: '',
        isPrimary: contacts.length === 0
      }
    ];
  }

  function removeContact(id: string) {
    contacts = contacts.filter(c => c.id !== id);
    if (contacts.length > 0 && !contacts.some(c => c.isPrimary)) {
      contacts[0].isPrimary = true;
    }
  }

  function setPrimaryContact(id: string) {
    contacts = contacts.map(c => ({
      ...c,
      isPrimary: c.id === id
    }));
  }

  async function handleGeocode() {
    if (!street && !city) {
      toast.error('Inserisci almeno la via o la città per avviare la geocodifica.');
      return;
    }

    isGeocoding = true;
    try {
      const res = await NominatimGeocoderAdapter.geocodeAddress({
        street,
        city,
        postalCode,
        country
      });

      if (res) {
        lat = res.latitude;
        lng = res.longitude;
        geocodingStatus = 'resolved';
        toast.success(`Coordinate rilevate: [${res.latitude.toFixed(4)}, ${res.longitude.toFixed(4)}]`);
      } else {
        toast.error('Indirizzo non trovato su OpenStreetMap. Seleziona il punto manualmente sulla mappa.');
        geocodingStatus = 'failed';
      }
    } catch (e: any) {
      toast.error('Errore durante la geocodifica: ' + e.message);
      geocodingStatus = 'failed';
    } finally {
      isGeocoding = false;
    }
  }

  function handleMapPick(coords: { lat: number; lng: number }) {
    lat = coords.lat;
    lng = coords.lng;
    geocodingStatus = 'manual';
    toast.success(`Punto posizionato: [${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}]`);
  }

  async function handleSubmitForm(e: Event) {
    e.preventDefault();

    if (!name.trim()) {
      toast.error('Inserisci la denominazione obbligatoria del luogo o lotto.');
      return;
    }

    if (types.length === 0) {
      toast.error('Seleziona almeno un ruolo/tipologia per il luogo.');
      return;
    }

    isSubmitting = true;
    try {
      const selectedClient = clients.find(c => c.id === clientId);
      const clientName = selectedClient?.name || '';

      const normalizedKey = buildNormalizedKey({ street, city, postalCode, country });
      const addressObj = {
        street: street.trim(),
        city: city.trim(),
        province: province.trim().toUpperCase(),
        postalCode: postalCode.trim(),
        country: country.trim().toUpperCase(),
        formattedAddress: `${street ? street + ', ' : ''}${postalCode ? postalCode + ' ' : ''}${city}${province ? ' (' + province + ')' : ''}`.trim(),
        normalizedKey
      };

      const geoObj = (lat !== null && lng !== null) ? {
        location: { latitude: lat, longitude: lng } as any,
        geohash: calculateGeohash(lat, lng, 8),
        radiusMeters
      } : undefined;

      const summary = buildPlaceSummary(name.trim(), addressObj);
      const validContacts = contacts.filter(c => c.name.trim() !== '');

      const payload: Partial<PlaceDocument> = {
        name: name.trim(),
        code: code.trim() || undefined,
        types,
        status,
        clientId: clientId || undefined,
        customerId: clientId || undefined,
        clientName: clientName || undefined,
        parentId: parentId || null,
        address: addressObj,
        geo: geoObj,
        geocodingStatus: geocodingStatus as any,
        summary,
        contacts: validContacts,
        accessInfo: {
          notes: accessNotes.trim() || undefined,
          heavyVehicleAccessible
        },
        notes: generalNotes.trim() || undefined
      } as any;

      await onSubmit(payload);
    } catch (err: any) {
      console.error('Errore invio form luogo:', err);
      toast.error('Errore durante il salvataggio: ' + err.message);
    } finally {
      isSubmitting = false;
    }
  }

  const typeOptions: { id: PlaceType; label: string; icon: any }[] = [
    { id: 'site', label: 'Cantiere / Intervento', icon: MapPin },
    { id: 'warehouse', label: 'Magazzino / Deposito', icon: Warehouse },
    { id: 'headquarters', label: 'Sede Legale', icon: Building2 },
    { id: 'branch', label: 'Filiale Operativa', icon: Building2 },
    { id: 'store', label: 'Showroom / Negozio', icon: Store },
    { id: 'delivery_point', label: 'Punto Scarico Merci', icon: Truck },
    { id: 'client_site', label: 'Sede Cliente', icon: User },
    { id: 'custom', label: 'Altro / Personalizzato', icon: Compass }
  ];
</script>

<form class="place-form-fullwidth" onsubmit={handleSubmitForm}>
  <!-- SEZIONE 1: DATI GENERALI, GERARCHIA & RUOLI -->
  <div class="form-section-card">
    <div class="section-header">
      <Building2 size={20} class="text-blue-600" />
      <div>
        <h3 class="section-title">Informazioni Generali & Gerarchia</h3>
        <p class="section-desc">Definisci denominazione, codice univoco, gerarchia e ruoli operativi.</p>
      </div>
    </div>

    <!-- Scheda Informativa Genitore quando è selezionata una Sotto-Area -->
    {#if selectedParent}
      <div class="parent-cantiere-card">
        <div class="parent-card-header">
          <div class="parent-badge">
            <Layers size={14} />
            <span>SOTTO-AREA / LOTTO DEL CANTIERE</span>
          </div>
          <h4 class="parent-cantiere-title">
            {selectedParent.name} {selectedParent.code ? `(${selectedParent.code})` : ''}
          </h4>
        </div>
        <div class="parent-specs-grid">
          <div class="spec-item">
            <span class="spec-label">Cliente Titolare</span>
            <span class="spec-val font-semibold">{selectedParent.clientName || 'Nessun cliente specificato'}</span>
          </div>
          <div class="spec-item">
            <span class="spec-label">Indirizzo Fisico Padre</span>
            <span class="spec-val">
              {selectedParent.address?.formattedAddress || (selectedParent.address?.street ? `${selectedParent.address.street}, ${selectedParent.address.city}` : 'Non specificato')}
            </span>
          </div>
          <div class="spec-item">
            <span class="spec-label">Stato Coordinate Genitore</span>
            <span class="spec-val {parentLocation ? 'text-emerald-700 font-semibold' : 'text-amber-700 font-semibold'}">
              {#if parentLocation}
                ✓ GPS Attivo ({parentLocation.lat.toFixed(4)}, {parentLocation.lng.toFixed(4)})
              {:else}
                ⚠️ Nessuna coordinata nel genitore
              {/if}
            </span>
          </div>
        </div>
      </div>
    {/if}

    <div class="fields-grid grid-3 mt-3">
      <!-- Nome -->
      <div class="form-group col-span-2">
        <label for="placeName" class="form-label required">
          {selectedParent ? 'Denominazione Lotto / Sotto-Area' : 'Denominazione Luogo / Cantiere'}
        </label>
        <input 
          id="placeName"
          type="text" 
          bind:value={name} 
          placeholder={selectedParent ? "es. Lotto 1 - Scavi e Movimento Terra / Palazzina B" : "es. Cantiere Residenziale Le Palme"} 
          class="form-input" 
          required 
        />
      </div>

      <!-- Codice -->
      <div class="form-group">
        <label for="placeCode" class="form-label">Codice Univoco Identificativo</label>
        <input 
          id="placeCode"
          type="text" 
          bind:value={code} 
          placeholder="es. CNT-2026-001 (auto-generato se vuoto)" 
          class="form-input font-mono" 
        />
      </div>

      <!-- Stato -->
      <div class="form-group">
        <label for="placeStatus" class="form-label">Stato Operativo</label>
        <select id="placeStatus" bind:value={status} class="form-select">
          <option value="active">Attivo / In Corso</option>
          <option value="temporary">Temporaneo / Provvisorio</option>
          <option value="completed">Completato / Chiuso</option>
          <option value="archived">Archiviato / Inattivo</option>
        </select>
      </div>

      <!-- Cliente Titolare -->
      <div class="form-group">
        <label for="placeClient" class="form-label">Cliente Titolare (Opzionale)</label>
        <select id="placeClient" bind:value={clientId} class="form-select">
          <option value="">-- Nessun Cliente Collegato --</option>
          {#each clients as c}
            <option value={c.id}>{c.name}</option>
          {/each}
        </select>
      </div>

      <!-- Luogo Genitore (Gerarchia ad Albero) -->
      <div class="form-group">
        <label for="placeParent" class="form-label">Luogo Genitore (Sotto-area / Lotto di)</label>
        <select id="placeParent" value={parentId || ''} onchange={handleParentChange} class="form-select">
          <option value="">📁 Nessun Genitore (Luogo Principale Livello 0)</option>
          {#each allPlaces as p}
            {#if !initialData.id || (p.id !== initialData.id && !p.ancestors?.includes(initialData.id))}
              <option value={p.id}>{p.name} {p.code ? `(${p.code})` : ''}</option>
            {/if}
          {/each}
        </select>
      </div>
    </div>

    <!-- Ruoli / Tipologie Multipli -->
    <div class="form-group mt-4">
      <label class="form-label required">Ruoli & Tipologie Assegnate (Seleziona uno o più)</label>
      <div class="types-chips-grid">
        {#each typeOptions as opt}
          {@const isChecked = types.includes(opt.id)}
          {@const IconComp = opt.icon}
          <button 
            type="button" 
            class="type-chip-btn {isChecked ? 'active' : ''}" 
            onclick={() => toggleType(opt.id)}
          >
            <IconComp size={16} />
            <span>{opt.label}</span>
            {#if isChecked}
              <Check size={14} class="check-icon" />
            {/if}
          </button>
        {/each}
      </div>
    </div>
  </div>

  <!-- SEZIONE 2: LOCALIZZAZIONE, MAPPA & GEOFENCING -->
  <div class="form-section-card">
    <div class="section-header">
      <MapPin size={20} class="text-blue-600" />
      <div>
        <h3 class="section-title">
          {selectedParent ? 'Posizionamento Lotto & Radar Geofencing' : 'Indirizzo, Mappa & Geofencing Radar'}
        </h3>
        <p class="section-desc">
          {selectedParent ? 'Posiziona il punto esatto del lotto/varco all\'interno dell\'area del cantiere principale.' : 'Indica la posizione fisica e configura il raggio radar di prossimità.'}
        </p>
      </div>
    </div>

    <!-- Gestione Indirizzo: Ereditato o Personalizzato -->
    {#if selectedParent}
      <div class="inherited-address-card">
        <div class="inherited-header">
          <div class="address-info-col">
            <span class="text-xs font-bold text-slate-500 uppercase tracking-wider">Indirizzo Fisico del Cantiere</span>
            <div class="address-display-val">
              {street ? `${street}, ${postalCode ? postalCode + ' ' : ''}${city}${province ? ' (' + province + ')' : ''}` : 'Nessun indirizzo impostato nel cantiere principale.'}
            </div>
          </div>
          <button 
            type="button" 
            class="btn-toggle-custom-address" 
            onclick={() => { customAddressEnabled = !customAddressEnabled; }}
          >
            {customAddressEnabled ? 'Usa indirizzo del cantiere principale' : 'Specifica indirizzo/ingresso dedicato per questo lotto'}
          </button>
        </div>

        {#if customAddressEnabled}
          <div class="custom-address-fields mt-3 pt-3 border-t border-slate-200">
            <div class="fields-grid grid-4">
              <div class="form-group col-span-2">
                <label for="street" class="form-label">Via / Ingresso Lotto</label>
                <input id="street" type="text" bind:value={street} placeholder="es. Via Roma 12 (Gate 2)" class="form-input" />
              </div>
              <div class="form-group">
                <label for="city" class="form-label">Città</label>
                <input id="city" type="text" bind:value={city} placeholder="es. Milano" class="form-input" />
              </div>
              <div class="form-group">
                <label for="province" class="form-label">Provincia</label>
                <input id="province" type="text" bind:value={province} placeholder="es. MI" maxlength="4" class="form-input" />
              </div>
              <div class="form-group">
                <label for="cap" class="form-label">C.A.P.</label>
                <input id="cap" type="text" bind:value={postalCode} placeholder="es. 20121" maxlength="10" class="form-input" />
              </div>
              <div class="form-group">
                <label for="country" class="form-label">Paese</label>
                <input id="country" type="text" bind:value={country} placeholder="IT" maxlength="2" class="form-input uppercase" />
              </div>
              <div class="form-group col-span-2 flex items-end">
                <button type="button" class="btn-geocode" onclick={handleGeocode} disabled={isGeocoding}>
                  <Compass size={16} />
                  <span>{isGeocoding ? 'Rilevamento...' : 'Geocodifica OpenStreetMap'}</span>
                </button>
              </div>
            </div>
          </div>
        {/if}
      </div>
    {:else}
      <!-- Campi Indirizzo Standard per Luogo Principale -->
      <div class="fields-grid grid-4">
        <div class="form-group col-span-2">
          <label for="street" class="form-label">Indirizzo e Numero Civico</label>
          <input id="street" type="text" bind:value={street} placeholder="es. Via Roma 12" class="form-input" />
        </div>
        <div class="form-group">
          <label for="city" class="form-label">Città</label>
          <input id="city" type="text" bind:value={city} placeholder="es. Milano" class="form-input" />
        </div>
        <div class="form-group">
          <label for="province" class="form-label">Provincia</label>
          <input id="province" type="text" bind:value={province} placeholder="es. MI" maxlength="4" class="form-input" />
        </div>
        <div class="form-group">
          <label for="cap" class="form-label">C.A.P.</label>
          <input id="cap" type="text" bind:value={postalCode} placeholder="es. 20121" maxlength="10" class="form-input" />
        </div>
        <div class="form-group">
          <label for="country" class="form-label">Paese</label>
          <input id="country" type="text" bind:value={country} placeholder="IT" maxlength="2" class="form-input uppercase" />
        </div>
        <div class="form-group col-span-2 flex items-end">
          <button 
            type="button" 
            class="btn-geocode" 
            onclick={handleGeocode} 
            disabled={isGeocoding}
          >
            <Compass size={16} />
            <span>{isGeocoding ? 'Rilevamento in corso...' : 'Rileva Coordinate Automatiche'}</span>
          </button>
        </div>
      </div>
    {/if}

    <!-- Geofencing & Map Picker -->
    <div class="geo-preview-box mt-4">
      <div class="geo-controls-row">
        <div class="coordinates-display">
          <span class="coord-label">Coordinate GPS:</span>
          {#if lat !== null && lng !== null}
            <span class="coord-val font-mono">{lat.toFixed(5)}, {lng.toFixed(5)}</span>
          {:else}
            <span class="coord-none text-slate-400">Nessuna coordinata (clicca sulla mappa per posizionare)</span>
          {/if}
        </div>

        <div class="radius-slider-group">
          <label for="radiusMeters" class="slider-label">
            <Navigation size={14} />
            <span>Raggio Radar Geofence: <strong>{radiusMeters}m</strong></span>
          </label>
          <input 
            id="radiusMeters" 
            type="range" 
            min="1" 
            max="1500" 
            step="1" 
            bind:value={radiusMeters} 
            class="range-slider" 
          />
        </div>
      </div>

      <!-- Banner Istruzioni Mappa -->
      {#if selectedParent && parentLocation}
        <div class="map-instruction-banner">
          <Navigation size={15} class="text-indigo-600 shrink-0" />
          <span>
            La mappa è focalizzata sul cantiere <strong>{selectedParent.name}</strong> a Zoom 18 con il perimetro viola tratteggiato. <strong>Fai clic sulla mappa</strong> per posizionare il marker esatto di questo lotto o varco.
          </span>
        </div>
      {/if}

      <!-- Map Viewer Component in Picker Mode with Parent Reference & Dynamic High Zoom -->
      <div class="map-container-box">
        <PlaceMapViewer 
          height="340px"
          interactivePicker={true}
          pickerLocation={lat !== null && lng !== null ? { lat, lng } : null}
          pickerRadiusMeters={radiusMeters}
          parentLocation={parentLocation}
          zoom={parentLocation ? 18 : 13}
          onLocationPick={handleMapPick}
        />
      </div>
    </div>
  </div>

  <!-- SEZIONE 3: CONTATTI SUL POSTO & ACCESSIBILITÀ -->
  <div class="form-section-card">
    <div class="section-header">
      <User size={20} class="text-blue-600" />
      <div>
        <h3 class="section-title">
          {selectedParent ? 'Referenti del Lotto & Vincoli di Accesso' : 'Referenti sul Posto & Istruzioni di Accesso'}
        </h3>
        <p class="section-desc">Contatti rapidi per operai e trasportatori e vincoli di accesso.</p>
      </div>
    </div>

    <!-- Contacts Repeater -->
    <div class="contacts-repeater">
      <div class="repeater-header">
        <h4 class="repeater-title">
          {selectedParent ? 'Referente Operativo di questo Lotto' : 'Referenti e Contatti di Cantiere'}
        </h4>
        <button type="button" class="btn-add-contact" onclick={addContact}>
          <Plus size={14} />
          <span>Aggiungi Referente</span>
        </button>
      </div>

      <div class="contacts-list">
        {#each contacts as contact (contact.id)}
          <div class="contact-row-card">
            <div class="contact-fields-grid">
              <div class="form-group">
                <label class="form-label-sm">Nome & Cognome</label>
                <input type="text" bind:value={contact.name} placeholder="es. Mario Rossi" class="form-input-sm" />
              </div>
              <div class="form-group">
                <label class="form-label-sm">Ruolo / Mansione</label>
                <input type="text" bind:value={contact.role} placeholder={selectedParent ? "es. Caposquadra Lotto" : "es. Capocantiere"} class="form-input-sm" />
              </div>
              <div class="form-group">
                <label class="form-label-sm">Telefono</label>
                <input type="tel" bind:value={contact.phone} placeholder="es. +39 340 1234567" class="form-input-sm" />
              </div>
              <div class="form-group">
                <label class="form-label-sm">Email (Opzionale)</label>
                <input type="email" bind:value={contact.email} placeholder="es. cantiere@azienda.it" class="form-input-sm" />
              </div>
            </div>

            <div class="contact-actions">
              <button 
                type="button" 
                class="btn-primary-tag {contact.isPrimary ? 'active' : ''}" 
                onclick={() => setPrimaryContact(contact.id)}
              >
                {contact.isPrimary ? '★ Principale' : 'Imposta Principale'}
              </button>
              {#if contacts.length > 1}
                <button type="button" class="btn-del-contact" onclick={() => removeContact(contact.id)}>
                  <Trash2 size={15} />
                </button>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    </div>

    <!-- Access Info -->
    <div class="fields-grid grid-2 mt-4">
      <div class="form-group">
        <label for="accessNotes" class="form-label">Istruzioni Cancello / Varco / Consegne</label>
        <textarea 
          id="accessNotes" 
          bind:value={accessNotes} 
          rows="2" 
          placeholder={selectedParent ? "es. Accesso da Gate 2 su via secondaria. Codice citofono 4920." : "es. Codice cancello: 4920#. Citofonare a interno 3 dopo le 08:30."}
          class="form-textarea"
        ></textarea>
      </div>

      <div class="form-group">
        <label for="generalNotes" class="form-label">Note Operative Generali</label>
        <textarea 
          id="generalNotes" 
          bind:value={generalNotes} 
          rows="2" 
          placeholder="Eventuali note interne o dettagli sui lavori..."
          class="form-textarea"
        ></textarea>
      </div>
    </div>

    <div class="form-group mt-3">
      <label class="checkbox-label">
        <input type="checkbox" bind:checked={heavyVehicleAccessible} class="form-checkbox" />
        <span class="font-medium text-slate-800">Accessibile a Mezzi Pesanti / Camion &gt; 3.5t</span>
      </label>
    </div>
  </div>

  <!-- Form Actions Bar -->
  <div class="form-actions-bar">
    <a href="/dashboard/places" class="btn-cancel">
      Annulla
    </a>
    <button type="submit" class="btn-save-primary" disabled={isSubmitting}>
      <Save size={18} />
      <span>{isSubmitting ? 'Salvataggio in corso...' : (isEditing ? 'Aggiorna Luogo' : (selectedParent ? 'Crea Sotto-Area / Lotto' : 'Crea Luogo'))}</span>
    </button>
  </div>
</form>

<style>
  .place-form-fullwidth {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .form-section-card {
    background: #ffffff;
    border: 1px solid var(--border-color, #e2e8f0);
    border-radius: 14px;
    padding: 24px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.02);
  }

  .section-header {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    margin-bottom: 20px;
    padding-bottom: 14px;
    border-bottom: 1px solid #f1f5f9;
  }

  .section-title {
    font-size: 16px;
    font-weight: 700;
    color: #0f172a;
    margin: 0 0 2px 0;
  }

  .section-desc {
    font-size: 13px;
    color: #64748b;
    margin: 0;
  }

  .parent-cantiere-card {
    background: #f5f3ff;
    border: 1px solid #ddd6fe;
    border-radius: 12px;
    padding: 16px 20px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-bottom: 16px;
  }

  .parent-card-header {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .parent-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    font-weight: 800;
    color: #6d28d9;
    letter-spacing: 0.05em;
  }

  .parent-cantiere-title {
    font-size: 17px;
    font-weight: 800;
    color: #3b0764;
    margin: 0;
  }

  .parent-specs-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
    background: #ffffff;
    border: 1px solid #e9d5ff;
    border-radius: 8px;
    padding: 12px 16px;
  }

  @media (max-width: 768px) {
    .parent-specs-grid {
      grid-template-columns: 1fr;
    }
  }

  .spec-item {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .spec-label {
    font-size: 11px;
    font-weight: 600;
    color: #7c3aed;
    text-transform: uppercase;
  }

  .spec-val {
    font-size: 13px;
    color: #1e1b4b;
  }

  .inherited-address-card {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    padding: 14px 18px;
    margin-bottom: 16px;
  }

  .inherited-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    flex-wrap: wrap;
  }

  .address-info-col {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .address-display-val {
    font-size: 14px;
    font-weight: 700;
    color: #0f172a;
  }

  .btn-toggle-custom-address {
    font-size: 12px;
    font-weight: 600;
    color: #2563eb;
    background: #ffffff;
    border: 1px solid #bfdbfe;
    border-radius: 6px;
    padding: 6px 12px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-toggle-custom-address:hover {
    background: #eff6ff;
  }

  .fields-grid {
    display: grid;
    gap: 16px;
  }

  .grid-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .grid-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .grid-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }

  @media (max-width: 768px) {
    .grid-2, .grid-3, .grid-4 {
      grid-template-columns: 1fr;
    }
  }

  .col-span-2 {
    grid-column: span 2;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .form-label {
    font-size: 13px;
    font-weight: 600;
    color: #334155;
  }

  .form-label.required::after {
    content: " *";
    color: #ef4444;
  }

  .form-input, .form-select, .form-textarea {
    width: 100%;
    padding: 9px 12px;
    font-size: 14px;
    color: #0f172a;
    background: #ffffff;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    transition: all 0.2s ease;
    box-sizing: border-box;
  }

  .form-input:focus, .form-select:focus, .form-textarea:focus {
    border-color: #2563eb;
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
    outline: none;
  }

  .types-chips-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }

  .type-chip-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 14px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    color: #475569;
    cursor: pointer;
    transition: all 0.18s ease;
  }

  .type-chip-btn:hover {
    background: #f1f5f9;
    border-color: #cbd5e1;
    color: #1e293b;
  }

  .type-chip-btn.active {
    background: #eff6ff;
    border-color: #3b82f6;
    color: #1d4ed8;
    box-shadow: 0 1px 3px rgba(37, 99, 235, 0.12);
  }

  .btn-geocode {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    height: 40px;
    padding: 0 16px;
    background: #f8fafc;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    color: #334155;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-geocode:hover:not(:disabled) {
    background: #eff6ff;
    border-color: #93c5fd;
    color: #2563eb;
  }

  .geo-preview-box {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .geo-controls-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 16px;
  }

  .coordinates-display {
    font-size: 13px;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .coord-label {
    font-weight: 600;
    color: #475569;
  }

  .coord-val {
    background: #ffffff;
    padding: 4px 8px;
    border-radius: 6px;
    border: 1px solid #cbd5e1;
    color: #1e293b;
    font-weight: 600;
  }

  .radius-slider-group {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .slider-label {
    font-size: 12px;
    font-weight: 600;
    color: #475569;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .range-slider {
    width: 140px;
    accent-color: #2563eb;
  }

  .map-instruction-banner {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    background: #eff6ff;
    border: 1px solid #bfdbfe;
    border-radius: 8px;
    font-size: 13px;
    color: #1e40af;
    line-height: 1.4;
  }

  .map-container-box {
    width: 100%;
    overflow: hidden;
    border-radius: 10px;
  }

  .contacts-repeater {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 16px;
  }

  .repeater-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }

  .repeater-title {
    font-size: 14px;
    font-weight: 700;
    color: #1e293b;
    margin: 0;
  }

  .btn-add-contact {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    background: #ffffff;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    color: #334155;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-add-contact:hover {
    background: #eff6ff;
    border-color: #93c5fd;
    color: #2563eb;
  }

  .contacts-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .contact-row-card {
    background: #ffffff;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .contact-fields-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 10px;
  }

  @media (max-width: 900px) {
    .contact-fields-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  .form-label-sm {
    font-size: 11px;
    font-weight: 600;
    color: #64748b;
    text-transform: uppercase;
  }

  .form-input-sm {
    width: 100%;
    padding: 6px 10px;
    font-size: 13px;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    box-sizing: border-box;
  }

  .contact-actions {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 10px;
  }

  .btn-primary-tag {
    font-size: 11px;
    font-weight: 600;
    padding: 4px 8px;
    border-radius: 4px;
    background: #f1f5f9;
    border: 1px solid #cbd5e1;
    color: #475569;
    cursor: pointer;
  }

  .btn-primary-tag.active {
    background: #fef3c7;
    border-color: #f59e0b;
    color: #92400e;
  }

  .btn-del-contact {
    padding: 4px 6px;
    background: transparent;
    border: none;
    color: #94a3b8;
    cursor: pointer;
  }

  .btn-del-contact:hover {
    color: #ef4444;
  }

  .checkbox-label {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    cursor: pointer;
  }

  .form-checkbox {
    width: 16px;
    height: 16px;
    accent-color: #2563eb;
  }

  .form-actions-bar {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 14px;
    padding-top: 10px;
  }

  .btn-cancel {
    padding: 10px 18px;
    font-size: 14px;
    font-weight: 600;
    color: #64748b;
    text-decoration: none;
    border-radius: 8px;
    transition: all 0.2s ease;
  }

  .btn-cancel:hover {
    color: #0f172a;
    background: #f1f5f9;
  }

  .btn-save-primary {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 24px;
    background: #2563eb;
    color: #ffffff;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 2px 6px rgba(37, 99, 235, 0.25);
    transition: all 0.2s ease;
  }

  .btn-save-primary:hover:not(:disabled) {
    background: #1d4ed8;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(37, 99, 235, 0.35);
  }

  .btn-save-primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
</style>
