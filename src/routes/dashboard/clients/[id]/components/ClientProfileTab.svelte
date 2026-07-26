<script lang="ts">
  import { formatDateTime } from '$lib/utils/formatters';
  import { Card, FormField, Button } from '$lib';
  import { User, Clock, Trash2, Building2, CreditCard, Truck, UserCheck, Copy, Save } from '@lucide/svelte';

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

    // SDI & Bank Data
    clientSdiCode: string;
    clientPec: string;
    clientIban: string;
    clientBankName: string;
    clientPaymentTerms: string;

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
    contractsCount: number;

    onUpdateProfile: (e: Event) => void;
    onDeleteClient: () => void;
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

    clientSdiCode = $bindable(),
    clientPec = $bindable(),
    clientIban = $bindable(),
    clientBankName = $bindable(),
    clientPaymentTerms = $bindable(),

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
    onDeleteClient
  }: Props = $props();

  let activeSubTab = $state<'general' | 'banking' | 'addresses' | 'admin'>('general');

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
  <!-- Sub-Navigation Bar matching legacy ERP design -->
  <div class="subnav-container">
    <button 
      type="button" 
      class="subnav-btn" 
      class:active={activeSubTab === 'general'} 
      onclick={() => (activeSubTab = 'general')}
    >
      <Building2 size={16} /> Dettagli Cliente & Sede
    </button>

    <button 
      type="button" 
      class="subnav-btn" 
      class:active={activeSubTab === 'banking'} 
      onclick={() => (activeSubTab = 'banking')}
    >
      <CreditCard size={16} /> Dati Bancari & Fatturazione Elettronica
    </button>

    <button 
      type="button" 
      class="subnav-btn" 
      class:active={activeSubTab === 'addresses'} 
      onclick={() => (activeSubTab = 'addresses')}
    >
      <Truck size={16} /> Indirizzi Spedizione & Fatturazione
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
      <Card title="Scheda Anagrafica Cliente & Sede Principale" description="Aggiorna la ragione sociale, i contatti diretti e la sede legale dell'azienda.">
        {#snippet icon()}
          <Building2 size={20} class="icon-accent" />
        {/snippet}

        <div class="vertical-layout-stack">
          <div class="form-grid-columns">
            <FormField id="c-nome" label="Nome Azienda / Ditta *">
              <input type="text" id="c-nome" bind:value={clientName} required disabled={submittingProfile || activeRole === 'direzione'} placeholder="es. Gmix s.r.l." />
            </FormField>

            <FormField id="c-cognome" label="Referente Principale" helpText="Opzionale">
              <input type="text" id="c-cognome" bind:value={clientCognome} disabled={submittingProfile || activeRole === 'direzione'} placeholder="es. Mario Rossi" />
            </FormField>
          </div>

          <div class="form-grid-columns">
            <FormField id="c-email" label="Indirizzo Email" helpText="Opzionale">
              <input type="email" id="c-email" bind:value={clientEmail} placeholder="es. client@azienda.com" disabled={submittingProfile || activeRole === 'direzione'} />
            </FormField>

            <FormField id="c-phone" label="Numero di Telefono" helpText="Opzionale">
              <input type="text" id="c-phone" bind:value={clientPhone} placeholder="es. +39 059 123456" disabled={submittingProfile || activeRole === 'direzione'} />
            </FormField>
          </div>

          <div class="form-grid-columns">
            <FormField id="c-website" label="Sito Web (Website)" helpText="Opzionale">
              <input type="text" id="c-website" bind:value={clientWebsite} placeholder="es. www.azienda.it" disabled={submittingProfile || activeRole === 'direzione'} />
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
            <FormField id="c-fiscal" label="Identificativo Fiscale (Opzionale)">
              <input type="text" id="c-fiscal" bind:value={clientFiscalId} disabled={submittingProfile || activeRole === 'direzione'} placeholder="es. IT01234567890" />
            </FormField>

            <FormField id="c-piva" label="Partita IVA (Opzionale)">
              <input type="text" id="c-piva" bind:value={clientPartitaIva} disabled={submittingProfile || activeRole === 'direzione'} placeholder="es. 01234567890" />
            </FormField>
          </div>

          <div class="form-grid-columns">
            <FormField id="c-cf" label="Codice Fiscale (Opzionale)">
              <input type="text" id="c-cf" bind:value={clientCodiceFiscale} disabled={submittingProfile || activeRole === 'direzione'} placeholder="es. RSSMRA80A01H501U" />
            </FormField>

            {#if activeRole === 'superadmin' || activeRole === 'amministrazione' || activeRole === 'direzione'}
              <FormField id="c-assigned-admin" label="Consulente / Admin Assegnato" helpText="Consulente referente per questo cliente.">
                <select id="c-assigned-admin" bind:value={clientAssignedAdminId} disabled={submittingProfile}>
                  {#each usersList as u}
                    <option value={u.uid}>{u.nome || ''} {u.cognome || ''} ({u.email})</option>
                  {/each}
                </select>
              </FormField>
            {:else}
              <div></div>
            {/if}
          </div>

          <h4 class="section-divider-title">Indirizzo Sede Principale / Legale</h4>
          <div class="form-grid-columns">
            <FormField id="c-addr" label="Indirizzo e N° Civico">
              <input type="text" id="c-addr" bind:value={clientAddress} placeholder="es. Viale M. Finzi N.597" disabled={submittingProfile || activeRole === 'direzione'} />
            </FormField>

            <FormField id="c-city" label="Città">
              <input type="text" id="c-city" bind:value={clientCity} placeholder="es. Modena" disabled={submittingProfile || activeRole === 'direzione'} />
            </FormField>
          </div>

          <div class="form-grid-triple">
            <FormField id="c-prov" label="Provincia">
              <input type="text" id="c-prov" bind:value={clientProvince} placeholder="es. MO" disabled={submittingProfile || activeRole === 'direzione'} />
            </FormField>

            <FormField id="c-cap" label="Codice Postale (CAP)">
              <input type="text" id="c-cap" bind:value={clientPostalCode} placeholder="es. 41122" disabled={submittingProfile || activeRole === 'direzione'} />
            </FormField>

            <FormField id="c-country" label="Nazione">
              <input type="text" id="c-country" bind:value={clientCountry} placeholder="es. Italy" disabled={submittingProfile || activeRole === 'direzione'} />
            </FormField>
          </div>
        </div>
      </Card>
    {/if}

    {#if activeSubTab === 'banking'}
      <Card title="Fatturazione Elettronica & Dati Bancari" description="Configurazione PEC, Codice Destinatario SDI e coordinate di pagamento.">
        {#snippet icon()}
          <CreditCard size={20} class="icon-accent" />
        {/snippet}

        <div class="vertical-layout-stack">
          <h4 class="section-divider-title">Fatturazione Elettronica</h4>
          <div class="form-grid-columns">
            <FormField id="c-sdi" label="Codice SDI / Destinatario" helpText="Codice alfanumerico di 7 caratteri.">
              <input type="text" id="c-sdi" bind:value={clientSdiCode} placeholder="es. M5UXCR1" disabled={submittingProfile || activeRole === 'direzione'} />
            </FormField>

            <FormField id="c-pec" label="Indirizzo PEC">
              <input type="email" id="c-pec" bind:value={clientPec} placeholder="es. azienda@pec.it" disabled={submittingProfile || activeRole === 'direzione'} />
            </FormField>
          </div>

          <h4 class="section-divider-title">Dati Bancari & Modalità di Pagamento</h4>
          <div class="form-grid-columns">
            <FormField id="c-iban" label="IBAN">
              <input type="text" id="c-iban" bind:value={clientIban} placeholder="es. IT60X0542811101000000123456" disabled={submittingProfile || activeRole === 'direzione'} />
            </FormField>

            <FormField id="c-bank" label="Nome Banca">
              <input type="text" id="c-bank" bind:value={clientBankName} placeholder="es. Unicredit Banca" disabled={submittingProfile || activeRole === 'direzione'} />
            </FormField>
          </div>

          <FormField id="c-payment-terms" label="Modalità di Pagamento Predefinita">
            <input type="text" id="c-payment-terms" bind:value={clientPaymentTerms} placeholder="es. Bonifico Bancario 30gg d.f." disabled={submittingProfile || activeRole === 'direzione'} />
          </FormField>
        </div>
      </Card>
    {/if}

    {#if activeSubTab === 'addresses'}
      <div class="vertical-layout-stack">
        <!-- Indirizzo Fatturazione -->
        <Card title="Indirizzo di Fatturazione" description="Indirizzo dove inviare fatture ed estratti conto.">
          {#snippet icon()}
            <Building2 size={20} class="icon-accent" />
          {/snippet}

          <div class="vertical-layout-stack">
            <div class="action-top-row">
              <button type="button" class="btn-copy-address" onclick={copyBillingFromSede}>
                <Copy size={14} /> Uguale a Info Cliente (Sede Legale)
              </button>
            </div>

            <div class="form-grid-columns">
              <FormField id="c-b-addr" label="Indirizzo Fatturazione">
                <input type="text" id="c-b-addr" bind:value={clientBillingAddress} placeholder="es. Via Emilia Est 100" disabled={submittingProfile || activeRole === 'direzione'} />
              </FormField>

              <FormField id="c-b-city" label="Città">
                <input type="text" id="c-b-city" bind:value={clientBillingCity} placeholder="es. Modena" disabled={submittingProfile || activeRole === 'direzione'} />
              </FormField>
            </div>

            <div class="form-grid-triple">
              <FormField id="c-b-prov" label="Provincia">
                <input type="text" id="c-b-prov" bind:value={clientBillingProvince} placeholder="es. MO" disabled={submittingProfile || activeRole === 'direzione'} />
              </FormField>

              <FormField id="c-b-cap" label="CAP">
                <input type="text" id="c-b-cap" bind:value={clientBillingPostalCode} placeholder="es. 41121" disabled={submittingProfile || activeRole === 'direzione'} />
              </FormField>

              <FormField id="c-b-country" label="Nazione">
                <input type="text" id="c-b-country" bind:value={clientBillingCountry} placeholder="es. Italy" disabled={submittingProfile || activeRole === 'direzione'} />
              </FormField>
            </div>
          </div>
        </Card>

        <!-- Indirizzo Spedizione -->
        <Card title="Indirizzo di Spedizione / Cantiere" description="Indirizzo per la consegna delle merci o effettuazione dei servizi.">
          {#snippet icon()}
            <Truck size={20} class="icon-accent" />
          {/snippet}

          <div class="vertical-layout-stack">
            <div class="action-top-row">
              <button type="button" class="btn-copy-address" onclick={copyShippingFromBilling}>
                <Copy size={14} /> Copia Indirizzo Fatturazione
              </button>
            </div>

            <div class="form-grid-columns">
              <FormField id="c-s-addr" label="Indirizzo Spedizione">
                <input type="text" id="c-s-addr" bind:value={clientShippingAddress} placeholder="es. Via del Cantiere 45" disabled={submittingProfile || activeRole === 'direzione'} />
              </FormField>

              <FormField id="c-s-city" label="Città">
                <input type="text" id="c-s-city" bind:value={clientShippingCity} placeholder="es. Sassuolo" disabled={submittingProfile || activeRole === 'direzione'} />
              </FormField>
            </div>

            <div class="form-grid-triple">
              <FormField id="c-s-prov" label="Provincia">
                <input type="text" id="c-s-prov" bind:value={clientShippingProvince} placeholder="es. MO" disabled={submittingProfile || activeRole === 'direzione'} />
              </FormField>

              <FormField id="c-s-cap" label="CAP">
                <input type="text" id="c-s-cap" bind:value={clientShippingPostalCode} placeholder="es. 41049" disabled={submittingProfile || activeRole === 'direzione'} />
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
        <!-- Staff Admin Referral Card -->
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

        <!-- Audit Trail Table -->
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

        <!-- Danger Zone Card (Admin only) -->
        {#if activeRole === 'superadmin'}
          <Card title="Zona Pericolo: Eliminazione Cliente" description="L'eliminazione della scheda anagrafica è irreversibile e cancellerà tutte le attività collegate.">
            {#snippet icon()}
              <Trash2 size={20} style="color: var(--color-error);" />
            {/snippet}

            <div class="vertical-layout-stack danger-stack">
              <p class="danger-message">
                Puoi eliminare questa anagrafica solo se non possiede contratti associati.
                Se possiede contratti, dovrai prima eliminarli o stornarli singolarmente.
              </p>
              <Button 
                onclick={onDeleteClient} 
                variant="danger"
                disabled={submittingProfile}
              >
                <Trash2 size={16} /> Elimina questa Anagrafica Cliente
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
    background: var(--color-neutral-100);
    padding: 6px;
    border-radius: var(--radius-lg);
    border: 1px solid var(--color-neutral-200);
  }
  .subnav-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    border: none;
    border-radius: var(--radius-md);
    background: transparent;
    color: var(--color-neutral-600);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }
  .subnav-btn:hover {
    background: var(--color-neutral-200);
    color: var(--color-neutral-900);
  }
  .subnav-btn.active {
    background: var(--color-white);
    color: var(--color-primary-600);
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
    color: var(--color-primary-700);
    border-bottom: 1px solid var(--color-neutral-200);
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
    background: var(--color-primary-50);
    color: var(--color-primary-700);
    border: 1px solid var(--color-primary-200);
    padding: 6px 12px;
    border-radius: var(--radius-md);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }
  .btn-copy-address:hover {
    background: var(--color-primary-100);
  }
  .submit-footer {
    display: flex;
    justify-content: flex-end;
    margin-top: 10px;
  }
  .empty-panel {
    padding: 30px;
    text-align: center;
    color: var(--color-neutral-500);
    background: var(--color-neutral-50);
    border-radius: var(--radius-md);
    border: 1px dashed var(--color-neutral-300);
    font-size: 14px;
  }
  .audit-history-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .audit-log-item {
    padding: 12px;
    border: 1px solid var(--color-neutral-200);
    border-radius: var(--radius-md);
    background: var(--color-neutral-50);
  }
  .audit-log-meta {
    display: flex;
    justify-content: space-between;
    margin-bottom: 8px;
    font-size: 12px;
    color: var(--color-neutral-500);
  }
  .audit-author {
    font-weight: 600;
    color: var(--color-neutral-700);
  }
  .changes-list {
    margin: 0;
    padding-left: 20px;
    font-size: 13px;
    color: var(--color-neutral-600);
  }
  .old-val {
    text-decoration: line-through;
    color: var(--color-error);
  }
  .new-val {
    font-weight: 600;
    color: var(--color-success);
  }
  :global(.icon-accent) {
    color: var(--color-primary-500);
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
    color: var(--color-neutral-500);
    margin: 0;
  }
</style>
