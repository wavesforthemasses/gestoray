<script lang="ts">
  import { auth } from '$lib/auth';
  import { db, doc, setDoc, collection, getDocs, query, where } from '$lib/firebase';
  import { generateId } from '$lib/utils/helpers';
  import { generateSearchTerms } from '$lib';
  import { toast } from '$lib/stores/toast';
  import { FormField } from '$lib';
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();

  let nome = $state('');
  let cognome = $state('');
  let email = $state('');
  let phone = $state('');
  let fiscalId = $state('');
  let partitaIva = $state('');
  let codiceFiscale = $state('');
  let submitting = $state(false);

  async function handleCreateClient(e: Event) {
    e.preventDefault();
    if (!$auth) return;
    if (!nome.trim()) {
      toast.error("Il Nome Azienda è obbligatorio.");
      return;
    }
    if (!fiscalId.trim() && !partitaIva.trim() && !codiceFiscale.trim()) {
      toast.error("L'Identificativo Fiscale è obbligatorio.");
      return;
    }
    if (!email.trim() && !phone.trim()) {
      toast.error("Inserire almeno un contatto tra Email e Telefono.");
      return;
    }

    submitting = true;

    try {
      // Uniqueness check for fiscalId
      const checkQuery = query(collection(db, 'clients'), where('original.fiscalId', '==', fiscalId.trim()));
      const checkSnap = await getDocs(checkQuery);
      if (!checkSnap.empty) {
        throw new Error("L'Identificativo Fiscale inserito è già associato a un'altra anagrafica.");
      }

      const clientId = generateId('client');
      const now = new Date().toISOString();

      const newClient = {
        original: {
          nome: nome.trim(),
          cognome: cognome.trim(),
          email: email.trim(),
          phone: phone.trim(),
          fiscalId: fiscalId.trim(),
          partitaIva: partitaIva.trim(),
          codiceFiscale: codiceFiscale.trim(),
          status: 'prospect',
          notes: [],
          createdBy: $auth.uid
        },
        derived: {
          contractsCount: 0,
          approvedContractsCount: 0,
          totalContractValue: 0,
          totalPaid: 0,
          totalRemaining: 0,
          activitiesCount: 0,
          quotesCount: 0,
          nncfDate: null,
          nncfOrderId: null,
          lastActivityDate: null,
          textSearch: generateSearchTerms(nome.trim() + ' ' + (partitaIva ? partitaIva.trim() : '') + ' ' + (codiceFiscale ? codiceFiscale.trim() : ''))
        },
        edits: {
          createdAt: now,
          createdBy: $auth.uid
        }
      };

      await setDoc(doc(db, 'clients', clientId), newClient);
      
      const historyId = generateId('audit');
      await setDoc(doc(db, 'clients', clientId, 'history', historyId), {
        original: {
          clientId,
          updatedBy: $auth.uid,
          updatedEmail: $auth.email,
          changes: {
            creation: { oldVal: null, newVal: 'created' }
          }
        },
        edits: {
          createdAt: now
        }
      });

      toast.success(`Anagrafica per "${nome}" creata con successo!`);
      nome = '';
      cognome = '';
      fiscalId = '';
      email = '';
      phone = '';
      partitaIva = '';
      codiceFiscale = '';
      
      dispatch('created');
    } catch (err: any) {
      toast.error(err.message || 'Errore durante la creazione del cliente.');
    } finally {
      submitting = false;
    }
  }
</script>

<form onsubmit={handleCreateClient} class="client-form" style="display: grid; gap: 16px;">
  <FormField id="client-name" label="Nome Azienda *" helpText="Ragione sociale o nome dell'attività.">
    <input
      type="text"
      id="client-name"
      bind:value={nome}
      placeholder="es. Mario Rossi s.r.l."
      required
      disabled={submitting}
    />
  </FormField>

  <FormField id="client-fiscal" label="Identificativo Fiscale *" helpText="Codice Fiscale o Partita IVA principale. Deve essere univoco nel sistema.">
    <input
      type="text"
      id="client-fiscal"
      bind:value={fiscalId}
      placeholder="es. IT12345678901"
      required
      disabled={submitting}
    />
  </FormField>

  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
    <FormField id="client-cognome" label="Referente / Cognome" helpText="Cognome della persona di contatto.">
      <input
        type="text"
        id="client-cognome"
        bind:value={cognome}
        placeholder="es. Rossi"
        disabled={submitting}
      />
    </FormField>

    <FormField id="client-phone" label="Numero di Telefono" helpText="Obbligatorio se l'email è vuota.">
      <input
        type="text"
        id="client-phone"
        bind:value={phone}
        placeholder="es. +39 02 123456"
        disabled={submitting}
      />
    </FormField>
  </div>

  <FormField id="client-email" label="Indirizzo Email" helpText="Obbligatorio se il telefono è vuota.">
    <input
      type="email"
      id="client-email"
      bind:value={email}
      placeholder="es. info@azienda.com"
      disabled={submitting}
    />
  </FormField>

  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
    <FormField id="client-piva" label="Partita IVA (Opzionale)">
      <input
        type="text"
        id="client-piva"
        bind:value={partitaIva}
        placeholder="es. 12345678901"
        disabled={submitting}
      />
    </FormField>

    <FormField id="client-cf" label="Codice Fiscale (Opzionale)">
      <input
        type="text"
        id="client-cf"
        bind:value={codiceFiscale}
        placeholder="es. RSSMRA80A01H501U"
        disabled={submitting}
      />
    </FormField>
  </div>

  <button type="submit" class="submit-btn" disabled={submitting} style="margin-top: 10px;">
    {#if submitting}
      Salvataggio in corso...
    {:else}
      Crea Anagrafica Cliente
    {/if}
  </button>
</form>

<style>
  .submit-btn {
    background: var(--color-primary-600);
    color: var(--color-white);
    padding: 12px 20px;
    border: none;
    border-radius: var(--radius-md);
    font-weight: 600;
    font-size: 14px;
    cursor: pointer;
    transition: background 0.2s;
  }

  .submit-btn:hover {
    background: var(--color-primary-700);
  }

  .submit-btn:disabled {
    background: var(--color-primary-400);
    cursor: not-allowed;
  }
</style>
