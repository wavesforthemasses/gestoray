<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { authState, activeRoleState } from '$lib/auth.svelte';
  import { db, doc, setDoc, collection, getDocs, query, where } from '$lib/firebase';
  import { generateId } from '$lib/utils/helpers';
  import { generateSearchTerms } from '$lib/search-utils';
  import { CacheLookupService } from '$lib/services/cacheLookupService';
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
  let clientCode = $state('');
  let clientGroup = $state('Standard');
  let certificationStatus = $state('Certificato');

  let address = $state('');
  let sdiCode = $state('');
  let pec = $state('');
  let paymentTerms = $state('');
  let mainPhone = $state('');
  let iban = $state('');

  let referenteTecnico = $state('');
  let telReferente = $state('');
  let emailContatto = $state('');
  let emailAlternativa = $state('');

  let crifCheck = $state('ESEGUITO & VALIDO');
  let riskClass = $state('AAA (Basso Rischio)');
  let maxCredit = $state<number | null>(null);
  let residualCredit = $state<number | null>(null);
  let paymentStatus = $state('Regolare');

  let internalAdminNotes = $state('');
  let quoteAutoNotes = $state('');

  let submitting = $state(false);

  onMount(async () => {
    try {
      fieldSettings = await ClientSettingsService.getSettings();
    } catch (e) {
      console.warn('Impossibile caricare impostazioni campi clienti:', e);
    }
  });

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
          clientCode: clientCode.trim(),
          clientGroup,
          certificationStatus,
          fiscalId: computedFiscalId,
          
          address: address.trim(),
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

          crifCheck,
          riskClass,
          maxCredit: maxCredit || 0,
          residualCredit: residualCredit || 0,
          paymentStatus,

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
  {#if fieldSettings.datiAnagrafici.visible}
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

      <div class="form-grid-columns">
        <FormField id="client-code" label="Codice Cliente" helpText="Identificativo univoco ERP (es. C001)">
          <input
            type="text"
            id="client-code"
            bind:value={clientCode}
            placeholder="es. C001"
            disabled={submitting}
          />
        </FormField>

        <FormField id="client-cognome" label="Referente Principale / Cognome">
          <input
            type="text"
            id="client-cognome"
            bind:value={cognome}
            placeholder="es. Rossi"
            disabled={submitting}
          />
        </FormField>
      </div>

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
            <option value="Certificato">Certificato</option>
            <option value="In Attesa">In Attesa</option>
            <option value="Non Certificato">Non Certificato</option>
          </select>
        </FormField>
      </div>
    </div>
  {/if}

  {#if fieldSettings.fatturazioneSede.visible}
    <div class="form-section">
      <div class="section-header">
        <FileText size={18} class="section-icon" />
        <span class="section-title">Fatturazione, Sede Legale & SDI</span>
      </div>

      <FormField id="client-legal-address" label="Indirizzo Sede Legale">
        <input
          type="text"
          id="client-legal-address"
          bind:value={address}
          placeholder="es. Via dell'Industria 45, Milano (MI)"
          disabled={submitting}
        />
      </FormField>

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

  {#if fieldSettings.contattiReferenti.visible}
    <div class="form-section">
      <div class="section-header">
        <UserCheck size={18} class="section-icon" />
        <span class="section-title">Contatti & Referenti Rapidi</span>
      </div>

      <div class="form-grid-columns">
        <FormField id="client-ref-tech" label="Referente Tecnico">
          <input
            type="text"
            id="client-ref-tech"
            bind:value={referenteTecnico}
            placeholder="es. Mario Rossi"
            disabled={submitting}
          />
        </FormField>

        <FormField id="client-ref-phone" label="Tel. Referente">
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
        <FormField id="client-email-contact" label="Email Contatto">
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

  {#if fieldSettings.affidabilitaCredito.visible}
    <div class="form-section">
      <div class="section-header">
        <ShieldAlert size={18} class="section-icon" />
        <span class="section-title">Affidabilità & Credito</span>
      </div>

      <div class="form-grid-columns">
        <FormField id="client-crif" label="Controllo CRIF">
          <select id="client-crif" bind:value={crifCheck} disabled={submitting}>
            <option value="ESEGUITO & VALIDO">✓ ESEGUITO & VALIDO</option>
            <option value="IN ATTESA">IN ATTESA</option>
            <option value="FALLITO">FALLITO</option>
            <option value="NON ESEGUITO">NON ESEGUITO</option>
          </select>
        </FormField>

        <FormField id="client-risk" label="Classe di Rischio">
          <select id="client-risk" bind:value={riskClass} disabled={submitting}>
            <option value="AAA (Basso Rischio)">AAA (Basso Rischio)</option>
            <option value="AA">AA (Rischio Medio-Basso)</option>
            <option value="A">A (Rischio Moderato)</option>
            <option value="BBB">BBB (Rischio Medio)</option>
            <option value="High Risk">High Risk (Alto Rischio)</option>
          </select>
        </FormField>
      </div>

      <div class="form-grid-columns">
        <FormField id="client-max-credit" label="Fido Massimo Concesso (€)">
          <input
            type="number"
            id="client-max-credit"
            bind:value={maxCredit}
            placeholder="es. 50000"
            disabled={submitting}
          />
        </FormField>

        <FormField id="client-res-credit" label="Fido Residuo (€)">
          <input
            type="number"
            id="client-res-credit"
            bind:value={residualCredit}
            placeholder="es. 32400"
            disabled={submitting}
          />
        </FormField>
      </div>

      <FormField id="client-pay-status" label="Stato Pagamenti">
        <select id="client-pay-status" bind:value={paymentStatus} disabled={submitting}>
          <option value="Regolare">Regolare</option>
          <option value="In Ritardo">In Ritardo</option>
          <option value="Bloccato">Bloccato</option>
        </select>
      </FormField>
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
          placeholder="es. Fatturazione mensile posticipata al ricevimento delibera cantiere"
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

  @media (max-width: 650px) {
    .form-grid-columns {
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
