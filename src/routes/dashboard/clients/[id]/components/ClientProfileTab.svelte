<script lang="ts">
  import { Card, FormField } from '$lib';
  import { User, Clock, Trash2 } from '@lucide/svelte';

  interface Props {
    clientName: string;
    clientCognome: string;
    clientEmail: string;
    clientPhone: string;
    clientStatus: string;
    clientCreatedBy: string;
    clientFiscalId: string;
    clientPartitaIva: string;
    clientCodiceFiscale: string;

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
    clientStatus = $bindable(),
    clientCreatedBy = $bindable(),
    clientFiscalId = $bindable(),
    clientPartitaIva = $bindable(),
    clientCodiceFiscale = $bindable(),

    usersList,
    historyList,
    submittingProfile,
    activeRole,
    originalProfile,
    contractsCount,

    onUpdateProfile,
    onDeleteClient
  }: Props = $props();
</script>

<div class="tab-view animate-fade-in">
  <div class="vertical-layout-stack">
    <!-- Edit Profile Form -->
    <Card title="Scheda Anagrafica Cliente" description="Aggiorna le informazioni di contatto principali. Ogni modifica viene tracciata nell'Audit Log.">
      {#snippet icon()}
        <User size={20} class="icon-accent" />
      {/snippet}

      <form onsubmit={onUpdateProfile} class="widescreen-form">
        <div class="form-grid-columns">
          <FormField id="c-nome" label="Nome Azienda">
            <input type="text" id="c-nome" bind:value={clientName} required disabled={submittingProfile || activeRole === 'direzione'} />
          </FormField>

          <FormField id="c-cognome" label="Referente" helpText="Opzionale">
            <input type="text" id="c-cognome" bind:value={clientCognome} disabled={submittingProfile || activeRole === 'direzione'} />
          </FormField>
        </div>

        <div class="form-grid-columns">
          <FormField id="c-email" label="Indirizzo Email" helpText="Opzionale">
            <input type="email" id="c-email" bind:value={clientEmail} placeholder="es. client@azienda.com" disabled={submittingProfile || activeRole === 'direzione'} />
          </FormField>

          <FormField id="c-phone" label="Numero di Telefono" helpText="Opzionale">
            <input type="text" id="c-phone" bind:value={clientPhone} placeholder="es. +39 02 123456" disabled={submittingProfile || activeRole === 'direzione'} />
          </FormField>
        </div>

        <div class="form-grid-columns" style="margin-top: 10px;">
          <FormField id="c-fiscal" label="Identificativo Fiscale *">
            <input type="text" id="c-fiscal" bind:value={clientFiscalId} required disabled={submittingProfile || activeRole === 'direzione'} />
          </FormField>

          <FormField id="c-status" label="Stato Funnel Clienti" helpText="Stato di avanzamento commerciale di questo contatto.">
            <select id="c-status" bind:value={clientStatus} disabled={submittingProfile || activeRole === 'direzione'}>
              <option value="prospect">Prospect (Lead Potenziali)</option>
              <option value="contacted">Contattato (Primo Contatto)</option>
              <option value="proposal_sent">Proposta Inviata (Preventivo Creato)</option>
              <option value="customer">Cliente (Contratto Approvato)</option>
              <option value="churned">Perso / Inattivo</option>
            </select>
          </FormField>
        </div>

        <div class="form-grid-columns" style="margin-top: 10px;">
          <FormField id="c-piva" label="Partita IVA (Opzionale)">
            <input type="text" id="c-piva" bind:value={clientPartitaIva} disabled={submittingProfile || activeRole === 'direzione'} />
          </FormField>

          <FormField id="c-cf" label="Codice Fiscale (Opzionale)">
            <input type="text" id="c-cf" bind:value={clientCodiceFiscale} disabled={submittingProfile || activeRole === 'direzione'} />
          </FormField>
        </div>

        <div class="form-grid-columns" style="margin-top: 10px;">
          {#if activeRole === 'superadmin' || activeRole === 'amministrazione' || activeRole === 'direzione'}
            <FormField id="c-owner" label="Consulente Proprietario (Assegnazione)" helpText="Modifica l'assegnazione di questo cliente ad un altro commerciale.">
              <select id="c-owner" bind:value={clientCreatedBy} disabled={submittingProfile}>
                {#each usersList as u}
                  <option value={u.uid}>{u.nome || ''} {u.cognome || ''} ({u.email})</option>
                {/each}
              </select>
            </FormField>
          {:else}
            <div></div>
          {/if}
          <div></div>
        </div>

        <button type="submit" class="submit-profile-btn" disabled={submittingProfile}>
          {submittingProfile ? 'Aggiornamento...' : 'Salva Modifiche Anagrafica'}
        </button>
      </form>
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
                <span class="audit-time">{log.edits?.createdAt ? new Date(log.edits.createdAt).toLocaleString('it-IT') : 'N/D'}</span>
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
    {#if activeRole === 'superadmin' || activeRole === 'amministrazione'}
      <Card title="Zona Pericolo: Eliminazione Cliente" description="L'eliminazione della scheda anagrafica è irreversibile e cancellerà tutte le attività collegate.">
        {#snippet icon()}
          <Trash2 size={20} style="color: var(--color-error);" />
        {/snippet}

        <div class="vertical-layout-stack" style="gap: 12px; align-items: flex-start;">
          <p style="font-size: 13px; color: var(--color-neutral-500); margin: 0;">
            Puoi eliminare questa anagrafica solo se non possiede contratti associati.
            Se possiede contratti, dovrai prima eliminarli o stornarli singolarmente.
          </p>
          <button 
            type="button"
            onclick={onDeleteClient} 
            class="submit-profile-btn" 
            style="background: var(--color-error); margin-top: 8px; width: fit-content;"
            disabled={submittingProfile}
          >
            <Trash2 size={16} /> Elimina questa Anagrafica Cliente
          </button>
        </div>
      </Card>
    {/if}
  </div>
</div>
