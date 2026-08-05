<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { authState, activeRoleState } from '$lib/auth.svelte';
  import { db, doc, setDoc, collection, getDocs, query, where } from '$lib/firebase';
  import { generateId } from '$lib/utils/helpers';
  import { generateSearchTerms } from '$lib/search-utils';
  import { CacheLookupService } from '$lib/services/cacheLookupService';
  import { ContactsService } from '$lib/services/contacts.service';
  import { ClientSettingsService, DEFAULT_CLIENT_FIELDS_SETTINGS, type ClientFieldsSettings } from '$lib/services/clientSettingsService';

  import { toast } from '$lib/stores/toast.svelte';
  import { FormField } from '$lib';
  import { Building, FileText, UserCheck, ShieldAlert, Notebook } from '@lucide/svelte';

  const dispatch = createEventDispatcher();

  let fieldSettings = $state<ClientFieldsSettings>(DEFAULT_CLIENT_FIELDS_SETTINGS);

  // Form Fields
  let nome = $state('');
  let cognome = $state('');
  let isItalianSubject = $state(true);
  let partitaIva = $state('');
  let codiceFiscale = $state('');
  let clientGroup = $state('Standard');
  let certificationStatus = $state('in_attesa');

  // Sede Operativa / Principale
  let address = $state('');
  let city = $state('');
  let province = $state('');
  let postalCode = $state('');
  let country = $state('Italy');

  // Sede Legale
  let billingAddress = $state('');
  let billingCity = $state('');
  let billingProvince = $state('');
  let billingPostalCode = $state('');
  let billingCountry = $state('Italy');

  // Sede Spedizione
  let shippingAddress = $state('');
  let shippingCity = $state('');
  let shippingProvince = $state('');
  let shippingPostalCode = $state('');
  let shippingCountry = $state('Italy');

  let sdiCode = $state('');
  let pec = $state('');
  let paymentTerms = $state('');
  let mainPhone = $state('');
  let iban = $state('');

  let referenteTecnico = $state('');
  let telReferente = $state('');
  let emailContatto = $state('');
  let emailAlternativa = $state('');

  let internalAdminNotes = $state('');
  let quoteAutoNotes = $state('');

  let submitting = $state(false);

  onMount(async () => {
    try {
      fieldSettings = await ClientSettingsService.getSettings();
      if (fieldSettings.datiAnagrafici?.defaultStatoCertificazione) {
        certificationStatus = fieldSettings.datiAnagrafici.defaultStatoCertificazione;
      }
      if (fieldSettings.datiAnagrafici?.defaultGruppoCliente) {
        clientGroup = fieldSettings.datiAnagrafici.defaultGruppoCliente;
      }
    } catch (e) {
      console.warn('Impossibile caricare impostazioni campi clienti:', e);
    }
  });

  function copyBillingFromOperativa() {
    billingAddress = address;
    billingCity = city;
    billingProvince = province;
    billingPostalCode = postalCode;
    billingCountry = country;
  }

  function copyShippingFromOperativa() {
    shippingAddress = address;
    shippingCity = city;
    shippingProvince = province;
    shippingPostalCode = postalCode;
    shippingCountry = country;
  }

  async function handleCreateClient(e: Event) {
    e.preventDefault();
    if (!authState.user) return;
    if (!nome.trim()) {
      toast.error("La Ragione Sociale / Nome è obbligatoria.");
      return;
    }

    submitting = true;

    try {
      const computedFiscalId = partitaIva.trim() || codiceFiscale.trim();

      // Uniqueness check for fiscal identifier if provided
      if (computedFiscalId) {
        let checkQuery;
        if (['superadmin', 'amministrazione', 'direzione'].includes(activeRoleState.role || '')) {
          checkQuery = query(collection(db, 'clients'), where('original.fiscalId', '==', computedFiscalId));
        } else {
          checkQuery = query(collection(db, 'clients'), where('original.fiscalId', '==', computedFiscalId), where('original.createdBy', '==', authState.user.uid));
        }
        
        const checkSnap = await getDocs(checkQuery);
        if (!checkSnap.empty) {
          throw new Error("L'Identificativo Fiscale inserito è già associato a un'altra anagrafica.");
        }
      }

      // Auto copy from Sede Operativa if enabled in settings
      const copyLegale = fieldSettings.sediConfig?.sedi?.legale?.autoCopyFromDefault;
      const copySpedizione = fieldSettings.sediConfig?.sedi?.spedizione?.autoCopyFromDefault;

      const finalBillingAddress = billingAddress.trim() || (copyLegale ? address.trim() : '');
      const finalBillingCity = billingCity.trim() || (copyLegale ? city.trim() : '');
      const finalBillingProvince = billingProvince.trim() || (copyLegale ? province.trim() : '');
      const finalBillingPostalCode = billingPostalCode.trim() || (copyLegale ? postalCode.trim() : '');
      const finalBillingCountry = billingCountry.trim() || (copyLegale ? country.trim() : 'Italy');

      const finalShippingAddress = shippingAddress.trim() || (copySpedizione ? address.trim() : '');
      const finalShippingCity = shippingCity.trim() || (copySpedizione ? city.trim() : '');
      const finalShippingProvince = shippingProvince.trim() || (copySpedizione ? province.trim() : '');
      const finalShippingPostalCode = shippingPostalCode.trim() || (copySpedizione ? postalCode.trim() : '');
      const finalShippingCountry = shippingCountry.trim() || (copySpedizione ? country.trim() : 'Italy');

      const clientId = generateId('client');
      const now = new Date().toISOString();
      const fullClientName = `${nome.trim()} ${cognome.trim()}`.trim();
      const terms = generateSearchTerms(fullClientName, partitaIva.trim(), codiceFiscale.trim(), emailContatto.trim() || pec.trim());

      const chunkId = await CacheLookupService.updateClientCache(clientId, fullClientName);

      const newClient = {
        original: {
          nome: nome.trim(),
          cognome: cognome.trim(),
          isItalianSubject,
          partitaIva: partitaIva.trim(),
          codiceFiscale: codiceFiscale.trim(),
          clientGroup,
          certificationStatus,

          fiscalId: computedFiscalId,
          
          // Sede Operativa / Principale
          address: address.trim(),
          city: city.trim(),
          province: province.trim(),
          postalCode: postalCode.trim(),
          country: country.trim(),

          // Sede Legale / Fatturazione
          billingAddress: finalBillingAddress,
          billingCity: finalBillingCity,
          billingProvince: finalBillingProvince,
          billingPostalCode: finalBillingPostalCode,
          billingCountry: finalBillingCountry,

          // Sede Spedizione / Cantiere
          shippingAddress: finalShippingAddress,
          shippingCity: finalShippingCity,
          shippingProvince: finalShippingProvince,
          shippingPostalCode: finalShippingPostalCode,
          shippingCountry: finalShippingCountry,

          sdiCode: sdiCode.trim(),
          pec: pec.trim(),
          paymentTerms: paymentTerms.trim(),
          mainPhone: mainPhone.trim(),
          phone: mainPhone.trim(),
          email: emailContatto.trim(),
          iban: iban.trim(),

          referenteTecnico: referenteTecnico.trim(),
          telReferente: telReferente.trim(),
          emailContatto: emailContatto.trim(),
          emailAlternativa: emailAlternativa.trim(),

          internalAdminNotes: internalAdminNotes.trim(),
          quoteAutoNotes: quoteAutoNotes.trim(),


          status: 'prospect',
          notes: [],
          createdBy: authState.user.uid
        },
        edits: {
          createdAt: now,
          createdBy: authState.user.uid
        },
        derived: {
          textSearch: terms,
          ...(chunkId ? { cacheChunkId: chunkId } : {})
        }
      };

      await setDoc(doc(db, 'clients', clientId), newClient);

      // Automatically create linked Contact for Referente if provided
      if (referenteTecnico.trim() || emailContatto.trim() || telReferente.trim()) {
        try {
          const refParts = referenteTecnico.trim().split(/\s+/);
          const fn = refParts[0] || 'Referente';
          const ln = refParts.slice(1).join(' ') || (nome.trim() ? `(${nome.trim()})` : 'Aziendale');
          
          await ContactsService.createOrLinkContact({
            firstName: fn,
            lastName: ln,
            role: 'Referente Principale Aziendale',
            phone: telReferente.trim(),
            email: emailContatto.trim(),
            linkedClientIds: [clientId],
            userId: authState.user.uid
          });

        } catch (cntErr) {
          console.warn('Automatic contact creation warning:', cntErr);
        }
      }
      
      const historyId = generateId('audit');

      await setDoc(doc(db, 'clients', clientId, 'history', historyId), {
        original: {
          clientId,
          updatedBy: authState.user.uid,
          updatedEmail: authState.user.email,
          changes: {
            creation: { oldVal: null, newVal: 'created' }
          }
        },
        edits: {
          createdAt: now
        }
      });

      toast.success(`Anagrafica per "${nome}" creata con successo!`);
      dispatch('created');
    } catch (err: any) {
      toast.error(err.message || 'Errore durante la creazione del cliente.');
    } finally {
      submitting = false;
    }
  }
</script>

<form onsubmit={handleCreateClient} class="client-form form-grid-layout">
    <div class="form-section">
      <div class="section-header">

        <Building size={18} class="section-icon" />
        <span class="section-title">Dati Anagrafici & Identificativi</span>
      </div>

      <FormField id="client-name" label="Ragione Sociale *" helpText="Ragione sociale completa o denominazione aziendale.">
        <input
          type="text"
          id="client-name"
          bind:value={nome}
          placeholder="es. COSTRUZIONI GENERALI SPA"
          required
          disabled={submitting}
        />
      </FormField>

      <div class="checkbox-row">
        <label class="checkbox-label">
          <input type="checkbox" bind:checked={isItalianSubject} disabled={submitting} />
          <span>Soggetto Italiano (disattiva per soggetti esteri)</span>
        </label>
      </div>

      <div class="form-grid-columns">
        <FormField id="client-piva" label="Partita IVA *">
          <input
            type="text"
            id="client-piva"
            bind:value={partitaIva}
            placeholder="es. IT01234567890"
            disabled={submitting}
          />
        </FormField>

        <FormField id="client-cf" label="Codice Fiscale">
          <input
            type="text"
            id="client-cf"
            bind:value={codiceFiscale}
            placeholder="es. 01234567890"
            disabled={submitting}
          />
        </FormField>
      </div>

      <FormField id="client-cognome" label="Referente Principale / Cognome">
        <input
          type="text"
          id="client-cognome"
          bind:value={cognome}
          placeholder="es. Rossi"
          disabled={submitting}
        />
      </FormField>


      <div class="form-grid-columns">
        <FormField id="client-group" label="Gruppo Cliente">
          <select id="client-group" bind:value={clientGroup} disabled={submitting}>
            <option value="Grandi Clienti">Grandi Clienti</option>
            <option value="Standard">Standard</option>
            <option value="Premium">Premium</option>
            <option value="VIP">VIP</option>
          </select>
        </FormField>

        <FormField id="client-cert" label="Stato Certificazione">
          <select id="client-cert" bind:value={certificationStatus} disabled={submitting}>
            <option value="in_attesa">In Attesa</option>
            <option value="certificato">Certificato</option>
            <option value="non_certificato">Non Certificato</option>
          </select>
        </FormField>
      </div>

      <div class="sub-section-block">
        <h4 class="sub-section-title">Indirizzo Sede Operativa / Principale</h4>
        <div class="form-grid-columns">
          <FormField id="client-op-addr" label="Indirizzo e N° Civico">
            <input type="text" id="client-op-addr" bind:value={address} placeholder="es. Via dell'Industria 45" disabled={submitting} />
          </FormField>
          <FormField id="client-op-city" label="Città">
            <input type="text" id="client-op-city" bind:value={city} placeholder="es. Milano" disabled={submitting} />
          </FormField>
        </div>
        <div class="form-grid-triple">
          <FormField id="client-op-prov" label="Provincia">
            <input type="text" id="client-op-prov" bind:value={province} placeholder="es. MI" disabled={submitting} />
          </FormField>
          <FormField id="client-op-cap" label="CAP">
            <input type="text" id="client-op-cap" bind:value={postalCode} placeholder="es. 20100" disabled={submitting} />
          </FormField>
          <FormField id="client-op-country" label="Nazione">
            <input type="text" id="client-op-country" bind:value={country} placeholder="es. Italy" disabled={submitting} />
          </FormField>
        </div>
      </div>
    </div>


  {#if fieldSettings.fatturazioneSede.visible}
    <div class="form-section">
      <div class="section-header">
        <FileText size={18} class="section-icon" />
        <span class="section-title">Fatturazione, Sede Legale & SDI</span>
      </div>

      {#if fieldSettings.sediConfig?.sedi?.legale?.visible}
        <div class="sub-section-header">
          <h4 class="sub-section-title">Indirizzo Sede Legale / Fatturazione</h4>
          <button type="button" class="btn-copy-address" onclick={copyBillingFromOperativa}>
            Copia da Sede Operativa
          </button>
        </div>

        <div class="form-grid-columns">
          <FormField id="client-leg-addr" label="Indirizzo Sede Legale">
            <input type="text" id="client-leg-addr" bind:value={billingAddress} placeholder="es. Via Legale 12" disabled={submitting} />
          </FormField>
          <FormField id="client-leg-city" label="Città">
            <input type="text" id="client-leg-city" bind:value={billingCity} placeholder="es. Milano" disabled={submitting} />
          </FormField>
        </div>
        <div class="form-grid-triple">
          <FormField id="client-leg-prov" label="Provincia">
            <input type="text" id="client-leg-prov" bind:value={billingProvince} placeholder="es. MI" disabled={submitting} />
          </FormField>
          <FormField id="client-leg-cap" label="CAP">
            <input type="text" id="client-leg-cap" bind:value={billingPostalCode} placeholder="es. 20100" disabled={submitting} />
          </FormField>
          <FormField id="client-leg-country" label="Nazione">
            <input type="text" id="client-leg-country" bind:value={billingCountry} placeholder="es. Italy" disabled={submitting} />
          </FormField>
        </div>
      {/if}

      <div class="form-grid-columns">
        <FormField id="client-sdi" label="Codice SDI">
          <input
            type="text"
            id="client-sdi"
            bind:value={sdiCode}
            placeholder="es. K0R9X2"
            disabled={submitting}
          />
        </FormField>

        <FormField id="client-pec" label="PEC Amministrazione">
          <input
            type="email"
            id="client-pec"
            bind:value={pec}
            placeholder="es. amministrazione@pec.cgen.it"
            disabled={submitting}
          />
        </FormField>
      </div>


      <div class="form-grid-columns">
        <FormField id="client-payment-terms" label="Condizioni di Pagamento">
          <input
            type="text"
            id="client-payment-terms"
            bind:value={paymentTerms}
            placeholder="es. Bonifico 60gg DF FM"
            disabled={submitting}
          />
        </FormField>

        <FormField id="client-main-phone" label="Telefono Centralino">
          <input
            type="text"
            id="client-main-phone"
            bind:value={mainPhone}
            placeholder="es. +39 02 9876541"
            disabled={submitting}
          />
        </FormField>
      </div>

      <FormField id="client-iban" label="IBAN di Appoggio">
        <input
          type="text"
          id="client-iban"
          bind:value={iban}
          placeholder="es. IT98A0123412345000000098765"
          disabled={submitting}
        />
      </FormField>
    </div>
  {/if}

  {#if fieldSettings.sediConfig?.sedi?.spedizione?.visible}
    <div class="form-section">
      <div class="section-header">
        <FileText size={18} class="section-icon" />
        <span class="section-title">Indirizzo Sede Spedizione / Destinazione</span>
      </div>

      <div class="sub-section-header">
        <button type="button" class="btn-copy-address" onclick={copyShippingFromOperativa}>
          Copia da Sede Operativa
        </button>
      </div>

      <div class="form-grid-columns">
        <FormField id="client-shp-addr" label="Indirizzo Spedizione / Destinazione">
          <input type="text" id="client-shp-addr" bind:value={shippingAddress} placeholder="es. Via Roma 10" disabled={submitting} />
        </FormField>
        <FormField id="client-shp-city" label="Città">
          <input type="text" id="client-shp-city" bind:value={shippingCity} placeholder="es. Monza" disabled={submitting} />
        </FormField>
      </div>
      <div class="form-grid-triple">
        <FormField id="client-shp-prov" label="Provincia">
          <input type="text" id="client-shp-prov" bind:value={shippingProvince} placeholder="es. MB" disabled={submitting} />
        </FormField>
        <FormField id="client-shp-cap" label="CAP">
          <input type="text" id="client-shp-cap" bind:value={shippingPostalCode} placeholder="es. 20900" disabled={submitting} />
        </FormField>
        <FormField id="client-shp-country" label="Nazione">
          <input type="text" id="client-shp-country" bind:value={shippingCountry} placeholder="es. Italy" disabled={submitting} />
        </FormField>
      </div>
    </div>
  {/if}

  {#if fieldSettings.contattiReferenti.visible}

    <div class="form-section">
      <div class="section-header">
        <UserCheck size={18} class="section-icon" />
        <span class="section-title">Referente Principale Aziendale</span>
      </div>

      <div class="form-grid-columns">
        <FormField id="client-ref-tech" label="Nome e Cognome Referente">
          <input
            type="text"
            id="client-ref-tech"
            bind:value={referenteTecnico}
            placeholder="es. Mario Rossi"
            disabled={submitting}
          />
        </FormField>

        <FormField id="client-ref-phone" label="Telefono Referente">
          <input
            type="text"
            id="client-ref-phone"
            bind:value={telReferente}
            placeholder="es. +39 333 1234567"
            disabled={submitting}
          />
        </FormField>
      </div>

      <div class="form-grid-columns">
        <FormField id="client-email-contact" label="Email Referente">
          <input
            type="email"
            id="client-email-contact"
            bind:value={emailContatto}

            placeholder="es. m.rossi@cgen.it"
            disabled={submitting}
          />
        </FormField>

        <FormField id="client-email-alt" label="Email Alternativa">
          <input
            type="email"
            id="client-email-alt"
            bind:value={emailAlternativa}
            placeholder="es. l.bianchi@cgen.it"
            disabled={submitting}
          />
        </FormField>
      </div>
    </div>
  {/if}



  {#if fieldSettings.noteErp.visible}
    <div class="form-section">
      <div class="section-header">
        <Notebook size={18} class="section-icon" />
        <span class="section-title">Note ERP & Preventivo</span>
      </div>

      <FormField id="client-admin-notes" label="Note Amministrative (Interne)">
        <textarea
          id="client-admin-notes"
          bind:value={internalAdminNotes}
          placeholder="es. Fatturazione mensile posticipata alla consegna del progetto"
          rows="2"
          disabled={submitting}
        ></textarea>
      </FormField>

      <FormField id="client-quote-notes" label="Note Automatiche per Preventivo">
        <textarea
          id="client-quote-notes"
          bind:value={quoteAutoNotes}
          placeholder="es. Quotazione al netto di IVA. Validità 30 giorni. Consegna franco..."
          rows="2"
          disabled={submitting}
        ></textarea>
      </FormField>
    </div>
  {/if}

  <button type="submit" class="submit-btn mt-10" disabled={submitting}>
    {#if submitting}
      Salvataggio in corso...
    {:else}
      Crea Anagrafica Cliente
    {/if}
  </button>
</form>

<style>
  .form-grid-layout {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .form-section {
    background: var(--color-neutral-50, #f9fafb);
    border: 1px solid var(--color-neutral-200, #e5e7eb);
    border-radius: var(--radius-lg, 12px);
    padding: 18px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .section-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--color-neutral-200, #e5e7eb);
    margin-bottom: 4px;
  }

  .section-title {
    font-size: 14px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--color-primary-700, #1d4ed8);
  }

  .checkbox-row {
    margin-top: -4px;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    font-weight: 500;
    color: var(--color-neutral-700, #374151);
    cursor: pointer;
  }

  .form-grid-columns {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }

  .form-grid-triple {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 16px;
  }

  .sub-section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin: 12px 0 8px 0;
  }

  .sub-section-block {
    margin-top: 16px;
    padding-top: 12px;
    border-top: 1px dashed var(--color-neutral-200, #e5e7eb);
  }

  .sub-section-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--color-neutral-700, #374151);
    margin: 0 0 10px 0;
  }


  .btn-copy-address {
    background: #f0f7ff;
    color: #2563eb;
    border: 1px solid #bfdbfe;
    border-radius: 6px;
    padding: 4px 10px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-copy-address:hover {
    background: #dbeafe;
  }

  @media (max-width: 650px) {
    .form-grid-columns, .form-grid-triple {
      grid-template-columns: 1fr;
    }
  }

  .submit-btn {
    background: var(--color-primary-600, #2563eb);
    color: var(--color-white, #ffffff);
    padding: 12px 20px;
    border: none;
    border-radius: var(--radius-md, 8px);
    font-weight: 600;
    font-size: 15px;
    cursor: pointer;
    transition: background 0.2s;
    width: 100%;
  }

  .submit-btn:hover:not(:disabled) {
    background: var(--color-primary-700, #1d4ed8);
  }

  .submit-btn:disabled {
    background: var(--color-primary-400, #93c5fd);
    cursor: not-allowed;
  }

  .mt-10 {
    margin-top: 10px;
  }
</style>

