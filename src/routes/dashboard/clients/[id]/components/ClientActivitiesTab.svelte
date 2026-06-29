<script lang="ts">
  import { Card, FormField } from '$lib';
  import { MessageSquare, Phone, Calendar, Users, FileText, Clock } from '@lucide/svelte';

  interface Props {
    activitiesList: any[];
    clientNotes: string[];
    clientCreatedAt: string;
    newlyCreatedId: string;

    // Bindables
    activityNotesText: string;
    appointmentDateTime: string;

    // State & actions
    activeRole: string | null;
    submittingActivity: boolean;
    logActivity: (type: 'Telefonata' | 'Incontro' | 'Appuntamento' | 'Sollecito Telefonico' | 'Sollecito Email' | 'Sollecito PEC', datetimeVal?: string) => void;
    handleAddNote: (e: Event) => void;
    parseNote: (noteRaw: string) => { text: string; createdAt: string | null; createdByEmail: string };
  }

  let {
    activitiesList,
    clientNotes,
    clientCreatedAt,
    newlyCreatedId,

    activityNotesText = $bindable(),
    appointmentDateTime = $bindable(),

    activeRole,
    submittingActivity,
    logActivity,
    handleAddNote,
    parseNote
  }: Props = $props();
</script>

<div class="tab-view animate-fade-in">
  <div class="vertical-layout-stack">
    {#if activeRole !== 'direzione'}
      <!-- Activities Logger Form -->
      <Card title="Registrazione Attività Semplificata" description="Aggiungi una nota testuale e clicca sul pulsante dell'attività corrispondente. Le attività di Telefonata e Incontro verranno registrate all'istante, gli Appuntamenti consentono di pianificare data/ora.">
        {#snippet icon()}
          <MessageSquare size={20} class="icon-accent" />
        {/snippet}

        <div class="activity-logger-shell">
          <FormField id="act-notes" label="Note Attività" helpText="Riassumi brevemente l'esito della telefonata o dell'incontro.">
            <textarea 
              id="act-notes" 
              bind:value={activityNotesText} 
              placeholder="es. Il cliente ha richiesto una quotazione per 3 licenze..."
              rows="3"
              disabled={submittingActivity}
            ></textarea>
          </FormField>

          <div class="appointment-time-picker">
            <FormField id="appt-date" label="Data e Ora Appuntamento" helpText="Richiesto solo in caso di registrazione Appuntamento.">
              <input 
                type="datetime-local" 
                id="appt-date" 
                bind:value={appointmentDateTime} 
                disabled={submittingActivity} 
              />
            </FormField>
          </div>

          <div class="quick-log-actions">
            {#if activeRole === 'amministrazione'}
              <button 
                onclick={() => logActivity('Sollecito Telefonico')} 
                class="log-btn phone-btn"
                disabled={submittingActivity}
              >
                <Phone size={14} /> Sollecito Telefonico
              </button>
              <button 
                onclick={() => logActivity('Sollecito Email')} 
                class="log-btn meeting-btn"
                disabled={submittingActivity}
              >
                <MessageSquare size={14} /> Sollecito Email
              </button>
              <button 
                onclick={() => logActivity('Sollecito PEC')} 
                class="log-btn appt-btn"
                disabled={submittingActivity}
              >
                <Calendar size={14} /> Sollecito PEC
              </button>
            {:else}
              <button 
                onclick={() => logActivity('Telefonata')} 
                class="log-btn phone-btn"
                disabled={submittingActivity}
              >
                <Phone size={14} /> Registra Telefonata
              </button>
              <button 
                onclick={() => logActivity('Incontro')} 
                class="log-btn meeting-btn"
                disabled={submittingActivity}
              >
                <Users size={14} /> Registra Incontro
              </button>
              <button 
                onclick={() => logActivity('Appuntamento', new Date(appointmentDateTime).toISOString())} 
                class="log-btn appt-btn"
                disabled={submittingActivity || !appointmentDateTime}
              >
                <Calendar size={14} /> Registra Appuntamento
              </button>
            {/if}
          </div>
        </div>
      </Card>

      <!-- Quick notes text form -->
      <Card title="Note Libere Cronologiche" description="Se vuoi registrare una nota informativa slegata da una specifica telefonata o incontro.">
        {#snippet icon()}
          <FileText size={20} class="icon-accent" />
        {/snippet}

        <form onsubmit={handleAddNote} class="simple-note-form">
          <div class="note-input-row">
            <input type="text" name="noteText" placeholder="Scrivi una nota per questa anagrafica..." required />
            <button type="submit" class="add-note-btn">Posa Nota</button>
          </div>
        </form>
      </Card>
    {/if}

    <!-- Combined Activities & Notes Timeline -->
    <Card title="Cronologia Attività e Note" description="Storico cronologico inverso di tutte le interazioni registrate su questa scheda cliente.">
      {#snippet icon()}
        <Clock size={20} class="icon-accent" />
      {/snippet}

      <div class="timeline-container">
        {#if activitiesList.length === 0 && clientNotes.length === 0}
          <div class="empty-panel">Nessuna interazione o nota salvata per questo cliente.</div>
        {:else}
          <!-- Construct unified items list -->
          {@const timelineItems = [
            ...activitiesList.map(a => ({
              id: a.id,
              time: new Date(a.date),
              author: a.loggedEmail,
              badge: a.type,
              text: a.notes,
              source: 'activity'
            })),
            ...clientNotes.map((nRaw, idx) => {
              const parsed = parseNote(nRaw);
              return {
                id: `note-${idx}`,
                time: parsed.createdAt ? new Date(parsed.createdAt) : new Date(clientCreatedAt),
                author: parsed.createdByEmail,
                badge: 'NOTA',
                text: parsed.text,
                source: 'note'
              };
            })
          ].sort((a, b) => b.time.getTime() - a.time.getTime())}

          <div class="timeline-flow">
            {#each timelineItems as item}
              <div 
                id="timeline-item-{item.id}"
                class="timeline-card" 
                class:note-item={item.source === 'note'}
                class:glow={item.id === newlyCreatedId}
              >
                <div class="card-top">
                  <span class="item-badge" class:badge-nota={item.badge === 'NOTA'} class:badge-tel={item.badge === 'Telefonata' || item.badge === 'Sollecito Telefonico'} class:badge-inc={item.badge === 'Incontro' || item.badge === 'Sollecito PEC'} class:badge-app={item.badge === 'Appuntamento' || item.badge === 'Sollecito Email'}>
                    {item.badge}
                  </span>
                  <span class="item-time">{item.time.toLocaleString('it-IT')}</span>
                  <span class="item-author">&bull; {item.author}</span>
                </div>
                <p class="card-text">{item.text || 'Nessuna nota aggiuntiva.'}</p>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </Card>
  </div>
</div>
