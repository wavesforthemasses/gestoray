<script lang="ts">
  import { Card, FormField, Button } from '$lib';
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

        <Button type="submit" disabled={submittingProfile}>
          {submittingProfile ? 'Aggiornamento...' : 'Salva Modifiche Anagrafica'}
        </Button>
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
    {#if activeRole === 'superadmin'}
      <Card title="Zona Pericolo: Eliminazione Cliente" description="L'eliminazione della scheda anagrafica è irreversibile e cancellerà tutte le attività collegate.">
        {#snippet icon()}
          <Trash2 size={20} style="color: var(--color-error);" />
        {/snippet}

        <div class="vertical-layout-stack" style="gap: 12px; align-items: flex-start;">
          <p style="font-size: 13px; color: var(--color-neutral-500); margin: 0;">
            Puoi eliminare questa anagrafica solo se non possiede contratti associati.
            Se possiede contratti, dovrai prima eliminarli o stornarli singolarmente.
          </p>
          <Button 
            onclick={onDeleteClient} 
            variant="danger"
            style="margin-top: 8px; width: fit-content;"
            disabled={submittingProfile}
          >
            <Trash2 size={16} /> Elimina questa Anagrafica Cliente
          </Button>
        </div>
      </Card>
    {/if}
  </div>
</div>

<style>
  .tab-view {
    padding-top: 10px;
  }
  .vertical-layout-stack {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
  .widescreen-form {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .form-grid-columns {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
  }
  @media (max-width: 768px) {
    .form-grid-columns {
      grid-template-columns: 1fr;
    }
  }
  .submit-profile-btn {
    background: linear-gradient(135deg, var(--color-primary-500), var(--color-primary-600));
    color: var(--color-white);
    border: none;
    padding: 12px 20px;
    border-radius: var(--radius-md);
    font-weight: 600;
    cursor: pointer;
    margin-top: 10px;
    font-size: 14px;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    transition: all var(--transition-fast);
  }
  .submit-profile-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
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
    gap: 16px;
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
</style>
