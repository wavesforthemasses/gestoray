<script lang="ts">
  import { formatDateTime } from '$lib/utils/formatters';
  import { Card, FormField, Button } from '$lib';
  import { User, Clock, Trash2, Building2, CreditCard, Truck, UserCheck, Copy, Save, ShieldAlert, Notebook } from '@lucide/svelte';

  interface Props {
    clientName: string;
    clientCognome: string;
    clientEmail: string;
    clientPhone: string;
    clientWebsite: string;
    clientStatus: string;
    clientCreatedBy: string;
    clientAssignedAdminId: string;
    clientFiscalId: string;
    clientPartitaIva: string;
    clientCodiceFiscale: string;

    // Anagrafica & ERP
    clientCode?: string;
    clientGroup?: string;
    certificationStatus?: string;
    isItalianSubject?: boolean;

    // SDI & Bank Data
    clientSdiCode: string;
    clientPec: string;
    clientIban: string;
    clientBankName: string;
    clientPaymentTerms: string;

    // Referenti Rapidi
    referenteTecnico?: string;
    telReferente?: string;
    emailContatto?: string;
    emailAlternativa?: string;

    // Affidabilità & Credito
    crifCheck?: string;
    riskClass?: string;
    maxCredit?: number;
    residualCredit?: number;
    paymentStatus?: string;

    // Note ERP
    internalAdminNotes?: string;
    quoteAutoNotes?: string;

    // Sede Principale
    clientAddress: string;
    clientCity: string;
    clientProvince: string;
    clientPostalCode: string;
    clientCountry: string;

    // Fatturazione
    clientBillingAddress: string;
    clientBillingCity: string;
    clientBillingProvince: string;
    clientBillingPostalCode: string;
    clientBillingCountry: string;

    // Spedizione
    clientShippingAddress: string;
    clientShippingCity: string;
    clientShippingProvince: string;
    clientShippingPostalCode: string;
    clientShippingCountry: string;

    usersList: any[];
    historyList: any[];
    submittingProfile: boolean;
    activeRole: string | null;
    originalProfile: any;
    contractsCount?: number;

    onUpdateProfile: (e: Event) => void;
    onDeleteClient: () => void;
    onOpenAnonymize?: () => void;
  }

  let {
    clientName = $bindable(),
    clientCognome = $bindable(),
    clientEmail = $bindable(),
    clientPhone = $bindable(),
    clientWebsite = $bindable(),
    clientStatus = $bindable(),
    clientCreatedBy = $bindable(),
    clientAssignedAdminId = $bindable(),
    clientFiscalId = $bindable(),
    clientPartitaIva = $bindable(),
    clientCodiceFiscale = $bindable(),

    clientCode = $bindable(''),
    clientGroup = $bindable('Standard'),
    certificationStatus = $bindable('Certificato'),
    isItalianSubject = $bindable(true),

    clientSdiCode = $bindable(),
    clientPec = $bindable(),
    clientIban = $bindable(),
    clientBankName = $bindable(),
    clientPaymentTerms = $bindable(),

    referenteTecnico = $bindable(''),
    telReferente = $bindable(''),
    emailContatto = $bindable(''),
    emailAlternativa = $bindable(''),

    crifCheck = $bindable('ESEGUITO & VALIDO'),
    riskClass = $bindable('AAA (Basso Rischio)'),
    maxCredit = $bindable(0),
    residualCredit = $bindable(0),
    paymentStatus = $bindable('Regolare'),

    internalAdminNotes = $bindable(''),
    quoteAutoNotes = $bindable(''),

    clientAddress = $bindable(),
    clientCity = $bindable(),
    clientProvince = $bindable(),
    clientPostalCode = $bindable(),
    clientCountry = $bindable(),

    clientBillingAddress = $bindable(),
    clientBillingCity = $bindable(),
    clientBillingProvince = $bindable(),
    clientBillingPostalCode = $bindable(),
    clientBillingCountry = $bindable(),

    clientShippingAddress = $bindable(),
    clientShippingCity = $bindable(),
    clientShippingProvince = $bindable(),
    clientShippingPostalCode = $bindable(),
    clientShippingCountry = $bindable(),

    usersList,
    historyList,
    submittingProfile,
    activeRole,
    originalProfile,
    contractsCount,

    onUpdateProfile,
    onDeleteClient,
    onOpenAnonymize
  }: Props = $props();

  let activeSubTab = $state<'general' | 'banking' | 'credit' | 'addresses' | 'admin'>('general');

  function copyBillingFromSede() {
    clientBillingAddress = clientAddress;
    clientBillingCity = clientCity;
    clientBillingProvince = clientProvince;
    clientBillingPostalCode = clientPostalCode;
    clientBillingCountry = clientCountry;
  }

  function copyShippingFromBilling() {
    clientShippingAddress = clientBillingAddress || clientAddress;
    clientShippingCity = clientBillingCity || clientCity;
    clientShippingProvince = clientBillingProvince || clientProvince;
    clientShippingPostalCode = clientBillingPostalCode || clientPostalCode;
    clientShippingCountry = clientBillingCountry || clientCountry;
  }
</script>

<div class="tab-view animate-fade-in">
  <div class="subnav-container">
    <button 
      type="button" 
      class="subnav-btn" 
      class:active={activeSubTab === 'general'} 
      onclick={() => (activeSubTab = 'general')}
    >
      <Building2 size={16} /> Dettagli Anagrafici
    </button>

    <button 
      type="button" 
      class="subnav-btn" 
      class:active={activeSubTab === 'banking'} 
      onclick={() => (activeSubTab = 'banking')}
    >
      <CreditCard size={16} /> Fatturazione
    </button>

    <button 
      type="button" 
      class="subnav-btn" 
      class:active={activeSubTab === 'credit'} 
      onclick={() => (activeSubTab = 'credit')}
    >
      <ShieldAlert size={16} /> Affidabilità & Fido
    </button>

    <button 
      type="button" 
      class="subnav-btn" 
      class:active={activeSubTab === 'addresses'} 
      onclick={() => (activeSubTab = 'addresses')}
    >
      <Truck size={16} /> Indirizzi Spedizione
    </button>

    <button 
      type="button" 
      class="subnav-btn" 
      class:active={activeSubTab === 'admin'} 
      onclick={() => (activeSubTab = 'admin')}
    >
      <UserCheck size={16} /> Admins & Audit Log
    </button>
  </div>

  <form onsubmit={onUpdateProfile} class="widescreen-form">
    {#if activeSubTab === 'general'}
      <Card title="Scheda Anagrafica Cliente & Sede Principale" description="Aggiorna la ragione sociale, gli identificativi ERP e la sede legale dell'azienda.">
        {#snippet icon()}
          <Building2 size={20} class="icon-accent" />
        {/snippet}

        <div class="vertical-layout-stack">
          <FormField id="c-nome" label="Ragione Sociale / Nome Azienda *">
            <input type="text" id="c-nome" bind:value={clientName} required disabled={submittingProfile || activeRole === 'direzione'} placeholder="es. COSTRUZIONI GENERALI SPA" />
          </FormField>

          <div class="checkbox-row">
            <label class="checkbox-label">
              <input type="checkbox" bind:checked={isItalianSubject} disabled={submittingProfile || activeRole === 'direzione'} />
              <span>Soggetto Italiano (disattiva per soggetti esteri)</span>
            </label>
          </div>

          <div class="form-grid-columns">
            <FormField id="c-group" label="Gruppo Tariffario / Cliente">
              <select id="c-group" bind:value={clientGroup} disabled={submittingProfile || activeRole === 'direzione'}>
                <option value="Standard">Standard</option>
                <option value="Grandi Clienti">Grandi Clienti</option>
                <option value="Premium">Premium</option>
                <option value="VIP">VIP</option>
              </select>
            </FormField>

            <FormField id="c-cert" label="Stato Certificazione">
              <select id="c-cert" bind:value={certificationStatus} disabled={submittingProfile || activeRole === 'direzione'}>
                <option value="in_attesa">In Attesa</option>
                <option value="certificato">Certificato</option>
                <option value="non_certificato">Non Certificato</option>
              </select>
            </FormField>
          </div>


          <div class="form-grid-columns">
            <FormField id="c-email" label="Indirizzo Email Contatto">
              <input type="email" id="c-email" bind:value={clientEmail} placeholder="es. m.rossi@cgen.it" disabled={submittingProfile || activeRole === 'direzione'} />
            </FormField>

            <FormField id="c-phone" label="Telefono Centralino">
              <input type="text" id="c-phone" bind:value={clientPhone} placeholder="es. +39 02 9876541" disabled={submittingProfile || activeRole === 'direzione'} />
            </FormField>
          </div>

          <div class="form-grid-columns">
            <FormField id="c-cognome" label="Referente Tecnico / Referente Operativo">
              <input type="text" id="c-cognome" bind:value={referenteTecnico} disabled={submittingProfile || activeRole === 'direzione'} placeholder="es. Mario Rossi" />
            </FormField>

            <FormField id="c-tel-ref" label="Tel. Referente">
              <input type="text" id="c-tel-ref" bind:value={telReferente} disabled={submittingProfile || activeRole === 'direzione'} placeholder="es. +39 333 1234567" />
            </FormField>
          </div>

          <div class="form-grid-columns">
            <FormField id="c-email-alt" label="Email Alternativa">
              <input type="email" id="c-email-alt" bind:value={emailAlternativa} placeholder="es. l.bianchi@cgen.it" disabled={submittingProfile || activeRole === 'direzione'} />
            </FormField>

            <FormField id="c-status" label="Stato Funnel Clienti">
              <select id="c-status" bind:value={clientStatus} disabled={submittingProfile || activeRole === 'direzione'}>
                <option value="prospect">Prospect (Lead Potenziali)</option>
                <option value="contacted">Contattato (Primo Contatto)</option>
                <option value="proposal_sent">Proposta Inviata (Preventivo Creato)</option>
                <option value="customer">Cliente (Contratto Approvato)</option>
                <option value="churned">Perso / Inattivo</option>
              </select>
            </FormField>
          </div>

          <h4 class="section-divider-title">Identificativi Fiscali</h4>
          <div class="form-grid-columns">
            <FormField id="c-piva" label="Partita IVA *">
              <input type="text" id="c-piva" bind:value={clientPartitaIva} disabled={submittingProfile || activeRole === 'direzione'} placeholder="es. IT01234567890" />
            </FormField>

            <FormField id="c-cf" label="Codice Fiscale">
              <input type="text" id="c-cf" bind:value={clientCodiceFiscale} disabled={submittingProfile || activeRole === 'direzione'} placeholder="es. 01234567890" />
            </FormField>
          </div>

          <h4 class="section-divider-title">Indirizzo Sede Principale / Legale</h4>
          <div class="form-grid-columns">
            <FormField id="c-addr" label="Indirizzo e N° Civico">
              <input type="text" id="c-addr" bind:value={clientAddress} placeholder="es. Via dell'Industria 45" disabled={submittingProfile || activeRole === 'direzione'} />
            </FormField>

            <FormField id="c-city" label="Città">
              <input type="text" id="c-city" bind:value={clientCity} placeholder="es. Milano" disabled={submittingProfile || activeRole === 'direzione'} />
            </FormField>
          </div>

          <div class="form-grid-triple">
            <FormField id="c-prov" label="Provincia">
              <input type="text" id="c-prov" bind:value={clientProvince} placeholder="es. MI" disabled={submittingProfile || activeRole === 'direzione'} />
            </FormField>

            <FormField id="c-cap" label="Codice Postale (CAP)">
              <input type="text" id="c-cap" bind:value={clientPostalCode} placeholder="es. 20100" disabled={submittingProfile || activeRole === 'direzione'} />
            </FormField>

            <FormField id="c-country" label="Nazione">
              <input type="text" id="c-country" bind:value={clientCountry} placeholder="es. Italy" disabled={submittingProfile || activeRole === 'direzione'} />
            </FormField>
          </div>
        </div>
      </Card>
    {/if}

    {#if activeSubTab === 'banking'}
      <div class="vertical-layout-stack">
        <Card title="Indirizzo Sede Legale & Fatturazione" description="Indirizzo ufficiale per fatture, contratti ed estratti conto.">
          {#snippet icon()}
            <Building2 size={20} class="icon-accent" />
          {/snippet}

          <div class="vertical-layout-stack">
            <div class="action-top-row">
              <button type="button" class="btn-copy-address" onclick={copyBillingFromSede}>
                <Copy size={14} /> Copia da Sede Operativa
              </button>
            </div>

            <div class="form-grid-columns">
              <FormField id="c-b-addr" label="Indirizzo Sede Legale / Fatturazione">
                <input type="text" id="c-b-addr" bind:value={clientBillingAddress} placeholder="es. Via dell'Industria 45" disabled={submittingProfile || activeRole === 'direzione'} />
              </FormField>

              <FormField id="c-b-city" label="Città">
                <input type="text" id="c-b-city" bind:value={clientBillingCity} placeholder="es. Milano" disabled={submittingProfile || activeRole === 'direzione'} />
              </FormField>
            </div>

            <div class="form-grid-triple">
              <FormField id="c-b-prov" label="Provincia">
                <input type="text" id="c-b-prov" bind:value={clientBillingProvince} placeholder="es. MI" disabled={submittingProfile || activeRole === 'direzione'} />
              </FormField>

              <FormField id="c-b-cap" label="CAP">
                <input type="text" id="c-b-cap" bind:value={clientBillingPostalCode} placeholder="es. 20100" disabled={submittingProfile || activeRole === 'direzione'} />
              </FormField>

              <FormField id="c-b-country" label="Nazione">
                <input type="text" id="c-b-country" bind:value={clientBillingCountry} placeholder="es. Italy" disabled={submittingProfile || activeRole === 'direzione'} />
              </FormField>
            </div>
          </div>
        </Card>

        <Card title="Fatturazione Elettronica & Dati Bancari" description="Configurazione PEC, Codice Destinatario SDI e coordinate di pagamento.">
          {#snippet icon()}
            <CreditCard size={20} class="icon-accent" />
          {/snippet}

          <div class="vertical-layout-stack">
            <h4 class="section-divider-title">Fatturazione Elettronica</h4>
            <div class="form-grid-columns">
              <FormField id="c-sdi" label="Codice SDI / Destinatario" helpText="Codice alfanumerico di 7 caratteri.">
                <input type="text" id="c-sdi" bind:value={clientSdiCode} placeholder="es. K0R9X2" disabled={submittingProfile || activeRole === 'direzione'} />
              </FormField>

              <FormField id="c-pec" label="PEC Amministrazione">
                <input type="email" id="c-pec" bind:value={clientPec} placeholder="es. amministrazione@pec.cgen.it" disabled={submittingProfile || activeRole === 'direzione'} />
              </FormField>
            </div>

            <h4 class="section-divider-title">Dati Bancari & Modalità di Pagamento</h4>
            <div class="form-grid-columns">
              <FormField id="c-iban" label="IBAN di Appoggio">
                <input type="text" id="c-iban" bind:value={clientIban} placeholder="es. IT98A0123412345000000098765" disabled={submittingProfile || activeRole === 'direzione'} />
              </FormField>

              <FormField id="c-payment-terms" label="Condizioni di Pagamento">
                <input type="text" id="c-payment-terms" bind:value={clientPaymentTerms} placeholder="es. Bonifico 60gg DF FM" disabled={submittingProfile || activeRole === 'direzione'} />
              </FormField>
            </div>
          </div>
        </Card>
      </div>
    {/if}

    {#if activeSubTab === 'credit'}
      <Card title="Affidabilità, Fido & Note ERP" description="Parametri di rischio creditizio, fido concesso e note amministrative/preventivo.">
        {#snippet icon()}
          <ShieldAlert size={20} class="icon-accent" />
        {/snippet}

        <div class="vertical-layout-stack">
          <div class="form-grid-columns">
            <FormField id="c-crif" label="Controllo CRIF">
              <select id="c-crif" bind:value={crifCheck} disabled={submittingProfile || activeRole === 'direzione'}>
                <option value="ESEGUITO & VALIDO">✓ ESEGUITO & VALIDO</option>
                <option value="IN ATTESA">IN ATTESA</option>
                <option value="FALLITO">FALLITO</option>
                <option value="NON ESEGUITO">NON ESEGUITO</option>
              </select>
            </FormField>

            <FormField id="c-risk" label="Classe di Rischio">
              <select id="c-risk" bind:value={riskClass} disabled={submittingProfile || activeRole === 'direzione'}>
                <option value="AAA (Basso Rischio)">AAA (Basso Rischio)</option>
                <option value="AA">AA (Rischio Medio-Basso)</option>
                <option value="A">A (Rischio Moderato)</option>
                <option value="BBB">BBB (Rischio Medio)</option>
                <option value="High Risk">High Risk (Alto Rischio)</option>
              </select>
            </FormField>
          </div>

          <div class="form-grid-columns">
            <FormField id="c-max-credit" label="Fido Massimo Concesso (€)">
              <input type="number" id="c-max-credit" bind:value={maxCredit} placeholder="es. 50000" disabled={submittingProfile || activeRole === 'direzione'} />
            </FormField>

            <FormField id="c-res-credit" label="Fido Residuo (€)">
              <input type="number" id="c-res-credit" bind:value={residualCredit} placeholder="es. 32400" disabled={submittingProfile || activeRole === 'direzione'} />
            </FormField>
          </div>

          <FormField id="c-pay-status" label="Stato Pagamenti">
            <select id="c-pay-status" bind:value={paymentStatus} disabled={submittingProfile || activeRole === 'direzione'}>
              <option value="Regolare">Regolare</option>
              <option value="In Ritardo">In Ritardo</option>
              <option value="Bloccato">Bloccato</option>
            </select>
          </FormField>

          <h4 class="section-divider-title">Note ERP & Preventivo</h4>
          <FormField id="c-admin-notes" label="Note Amministrative (Interne)">
            <textarea id="c-admin-notes" bind:value={internalAdminNotes} rows="2" placeholder="es. Fatturazione mensile posticipata al ricevimento delibera cantiere" disabled={submittingProfile || activeRole === 'direzione'}></textarea>
          </FormField>

          <FormField id="c-quote-notes" label="Note Automatiche per Preventivo">
            <textarea id="c-quote-notes" bind:value={quoteAutoNotes} rows="2" placeholder="es. Quotazione al netto di IVA. Validità 30 giorni. Consegna franco..." disabled={submittingProfile || activeRole === 'direzione'}></textarea>
          </FormField>
        </div>
      </Card>
    {/if}

    {#if activeSubTab === 'addresses'}
      <div class="vertical-layout-stack">
        <Card title="Indirizzo di Spedizione / Destinazione" description="Indirizzo per la consegna delle merci o effettuazione dei servizi.">
          {#snippet icon()}
            <Truck size={20} class="icon-accent" />
          {/snippet}

          <div class="vertical-layout-stack">
            <div class="action-top-row">
              <button type="button" class="btn-copy-address" onclick={copyShippingFromBilling}>
                <Copy size={14} /> Copia da Sede Operativa / Legale
              </button>
            </div>

            <div class="form-grid-columns">
              <FormField id="c-s-addr" label="Indirizzo Spedizione">
                <input type="text" id="c-s-addr" bind:value={clientShippingAddress} placeholder="es. Via Cantiere 10" disabled={submittingProfile || activeRole === 'direzione'} />
              </FormField>

              <FormField id="c-s-city" label="Città">
                <input type="text" id="c-s-city" bind:value={clientShippingCity} placeholder="es. Monza" disabled={submittingProfile || activeRole === 'direzione'} />
              </FormField>
            </div>

            <div class="form-grid-triple">
              <FormField id="c-s-prov" label="Provincia">
                <input type="text" id="c-s-prov" bind:value={clientShippingProvince} placeholder="es. MB" disabled={submittingProfile || activeRole === 'direzione'} />
              </FormField>

              <FormField id="c-s-cap" label="CAP">
                <input type="text" id="c-s-cap" bind:value={clientShippingPostalCode} placeholder="es. 20900" disabled={submittingProfile || activeRole === 'direzione'} />
              </FormField>

              <FormField id="c-s-country" label="Nazione">
                <input type="text" id="c-s-country" bind:value={clientShippingCountry} placeholder="es. Italy" disabled={submittingProfile || activeRole === 'direzione'} />
              </FormField>
            </div>
          </div>
        </Card>
      </div>
    {/if}


    {#if activeSubTab === 'admin'}
      <div class="vertical-layout-stack">
        <Card title="Referenti Internal Staff & Consulenti Assegnati" description="Membri dello staff che gestiscono questo cliente.">
          {#snippet icon()}
            <UserCheck size={20} class="icon-accent" />
          {/snippet}

          <div class="vertical-layout-stack">
            <div class="form-grid-columns">
              <FormField id="c-owner-main" label="Creatore Anagrafica">
                <select id="c-owner-main" bind:value={clientCreatedBy} disabled={activeRole !== 'superadmin' && activeRole !== 'amministrazione'}>
                  {#each usersList as u}
                    <option value={u.uid}>{u.nome || ''} {u.cognome || ''} ({u.email})</option>
                  {/each}
                </select>
              </FormField>

              <FormField id="c-assigned-main" label="Consulente Principale">
                <select id="c-assigned-main" bind:value={clientAssignedAdminId} disabled={activeRole !== 'superadmin' && activeRole !== 'amministrazione'}>
                  {#each usersList as u}
                    <option value={u.uid}>{u.nome || ''} {u.cognome || ''} ({u.email})</option>
                  {/each}
                </select>
              </FormField>
            </div>
          </div>
        </Card>

        <Card title="Audit Trail Storico Modifiche" description="Visualizza cronologicamente chi ha modificato la scheda e quali campi sono variati.">
          {#snippet icon()}
            <Clock size={20} class="icon-accent" />
          {/snippet}

          {#if historyList.length === 0}
            <div class="empty-panel">Nessuna modifica registrata per questa anagrafica.</div>
          {:else}
            <div class="audit-history-list">
              {#each historyList as log}
                <div class="audit-log-item">
                  <div class="audit-log-meta">
                    <span class="audit-author">{log.updatedEmail}</span>
                    <span class="audit-time">{log.edits?.createdAt ? formatDateTime(log.edits.createdAt) : 'N/D'}</span>
                  </div>
                  
                  <div class="audit-log-changes">
                    {#if log.changes && Object.keys(log.changes).length > 0}
                      <ul class="changes-list">
                        {#each Object.keys(log.changes) as field}
                          <li>
                            Campo <strong>{field}</strong>: 
                            <span class="old-val">"{log.changes[field].oldVal || 'N/D'}"</span> 
                            &rarr; 
                            <span class="new-val">"{log.changes[field].newVal || 'N/D'}"</span>
                          </li>
                        {/each}
                      </ul>
                    {/if}
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </Card>

        {#if activeRole === 'superadmin'}
          <Card title="Zona Pericolo: Privacy & Eliminazione" description="Azioni critiche e irreversibili sulla scheda anagrafica del cliente.">
            {#snippet icon()}
              <Trash2 size={20} style="color: var(--color-error);" />
            {/snippet}

            <div class="vertical-layout-stack danger-stack">
              <p class="danger-message" style="margin-bottom: 0;">
                <strong>Anonimizzazione (GDPR)</strong><br>
                Rimuove i dati personali (nome, telefono, email, etc.) sovrascrivendoli, ma mantiene i dati statistici aggregati.
              </p>
              <Button 
                type="button"
                onclick={onOpenAnonymize} 
                variant="secondary"
                disabled={submittingProfile}
                class="btn-anonymize-client"
              >
                <ShieldAlert size={16} /> Anonimizza Cliente (GDPR)
              </Button>

              <hr style="border: none; border-top: 1px solid var(--color-neutral-200); width: 100%; margin: 12px 0;" />

              <p class="danger-message" style="margin-bottom: 0;">
                <strong>Eliminazione Definitiva</strong><br>
                Puoi eliminare questa anagrafica solo se non possiede contratti associati.
              </p>
              <Button 
                type="button"
                onclick={onDeleteClient} 
                variant="danger"
                disabled={submittingProfile}
              >
                <Trash2 size={16} /> Elimina Anagrafica Cliente
              </Button>
            </div>
          </Card>
        {/if}
      </div>
    {/if}

    <div class="submit-footer">
      <Button type="submit" disabled={submittingProfile}>
        <Save size={16} /> {submittingProfile ? 'Aggiornamento in corso...' : 'Salva Modifiche Anagrafica'}
      </Button>
    </div>
  </form>
</div>

<style>
  .tab-view {
    padding-top: 10px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
  .subnav-container {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    background: var(--color-neutral-100, #f3f4f6);
    padding: 6px;
    border-radius: var(--radius-lg, 12px);
    border: 1px solid var(--color-neutral-200, #e5e7eb);
  }
  .subnav-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    border: none;
    border-radius: var(--radius-md, 8px);
    background: transparent;
    color: var(--color-neutral-600, #4b5563);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }
  .subnav-btn:hover {
    background: var(--color-neutral-200, #e5e7eb);
    color: var(--color-neutral-900, #111827);
  }
  .subnav-btn.active {
    background: var(--color-white, #ffffff);
    color: var(--color-primary-600, #2563eb);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  }
  .widescreen-form {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
  .vertical-layout-stack {
    display: flex;
    flex-direction: column;
    gap: 16px;
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
  @media (max-width: 768px) {
    .form-grid-columns, .form-grid-triple {
      grid-template-columns: 1fr;
    }
  }
  .section-divider-title {
    margin: 10px 0 0 0;
    font-size: 13px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--color-primary-700, #1d4ed8);
    border-bottom: 1px solid var(--color-neutral-200, #e5e7eb);
    padding-bottom: 6px;
  }
  .action-top-row {
    display: flex;
    justify-content: flex-end;
  }
  .btn-copy-address {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: var(--color-primary-50, #eff6ff);
    color: var(--color-primary-700, #1d4ed8);
    border: 1px solid var(--color-primary-200, #bfdbfe);
    padding: 6px 12px;
    border-radius: var(--radius-md, 8px);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }
  .btn-copy-address:hover {
    background: var(--color-primary-100, #dbeafe);
  }
  .submit-footer {
    display: flex;
    justify-content: flex-end;
    margin-top: 10px;
  }
  .empty-panel {
    padding: 30px;
    text-align: center;
    color: var(--color-neutral-500, #6b7280);
    background: var(--color-neutral-50, #f9fafb);
    border-radius: var(--radius-md, 8px);
    border: 1px dashed var(--color-neutral-300, #d1d5db);
    font-size: 14px;
  }
  .audit-history-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .audit-log-item {
    padding: 12px;
    border: 1px solid var(--color-neutral-200, #e5e7eb);
    border-radius: var(--radius-md, 8px);
    background: var(--color-neutral-50, #f9fafb);
  }
  .audit-log-meta {
    display: flex;
    justify-content: space-between;
    margin-bottom: 8px;
    font-size: 12px;
    color: var(--color-neutral-500, #6b7280);
  }
  .audit-author {
    font-weight: 600;
    color: var(--color-neutral-700, #374151);
  }
  .changes-list {
    margin: 0;
    padding-left: 20px;
    font-size: 13px;
    color: var(--color-neutral-600, #4b5563);
  }
  .old-val {
    text-decoration: line-through;
    color: var(--color-error, #ef4444);
  }
  .new-val {
    font-weight: 600;
    color: var(--color-success, #10b981);
  }
  :global(.icon-accent) {
    color: var(--color-primary-500, #3b82f6);
  }
  .animate-fade-in {
    animation: fadeIn 0.3s ease;
  }
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .danger-stack {
    gap: 12px;
    align-items: flex-start;
  }
  .danger-message {
    font-size: 13px;
    color: var(--color-neutral-500, #6b7280);
    margin: 0;
  }
</style>
