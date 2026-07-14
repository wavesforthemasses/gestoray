<script lang="ts">
  import { formatDateTime } from '$lib/utils/formatters';
  import { Card, FormField, Button } from "$lib";
  import {
    MessageSquare,
    Clock,
    FileText,
    CheckCircle,
    ActivitySquare
  } from "@lucide/svelte";
  import { activitiesConfigStore } from "$lib/stores/activities";

  interface Props {
    activitiesList: any[];
    clientNotes: string[];
    clientCreatedAt: string;
    newlyCreatedId: string;

    // State & actions
    activeRole: string | null;
    submittingActivity: boolean;
    logActivity: (type: string) => void;
    updateActivity: (activityId: string, payload: any) => Promise<void>;
    handleAddNote: (e: Event) => void;
    parseNote: (
      noteRaw: string,
    ) => { text: string; createdAt: string | null; createdByEmail: string };
  }

  let {
    activitiesList,
    clientNotes,
    clientCreatedAt,
    newlyCreatedId,

    activeRole,
    submittingActivity,
    logActivity,
    updateActivity,
    handleAddNote,
    parseNote,
  }: Props = $props();

  let editingId = $state<string | null>(null);
  let editNotes = $state("");
  let editDate = $state("");

  function startEdit(item: any) {
    if (item.source !== 'activity') return;
    editingId = item.id;
    editNotes = item.text || "";
    // format date for datetime-local
    const d = new Date(item.time);
    editDate = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  }

  function cancelEdit() {
    editingId = null;
  }

  async function saveEdit(item: any) {
    if (!editingId) return;
    await updateActivity(editingId, {
      notes: editNotes,
      date: new Date(editDate).toISOString()
    });
    editingId = null;
  }
</script>

<div class="tab-view animate-fade-in">
  <div class="vertical-layout-stack">
    {#if activeRole !== "direzione"}
      <!-- Activities Logger Form -->
      <Card
        title="Registrazione Rapida Attività"
        description="Clicca sul pulsante corrispondente per registrare immediatamente l'attività. Potrai aggiungere note o programmare una data/ora cliccando su 'Modifica' nello storico qui sotto."
      >
        {#snippet icon()}
          <ActivitySquare size={20} class="icon-accent" />
        {/snippet}

        <div class="quick-log-actions">
          {#each $activitiesConfigStore.filter(kpi => kpi.rolesInsert.includes(activeRole || '')) as kpi}
            <Button
              onclick={() => logActivity(kpi.id)}
              variant="outline"
              disabled={submittingActivity}
            >
              {kpi.name}
            </Button>
          {/each}
          {#if $activitiesConfigStore.filter(kpi => kpi.rolesInsert.includes(activeRole || '')).length === 0}
            <p style="color: var(--color-neutral-500); font-size: 13px;">Nessun KPI disponibile per il tuo ruolo.</p>
          {/if}
        </div>
      </Card>

      <!-- Quick notes text form -->
      <Card
        title="Note Libere Cronologiche"
        description="Se vuoi registrare una nota informativa slegata da una specifica telefonata o incontro."
      >
        {#snippet icon()}
          <FileText size={20} class="icon-accent" />
        {/snippet}

        <form onsubmit={handleAddNote} class="simple-note-form">
          <FormField
            id="free-note"
            label="Testo della nota"
            helpText="Aggiungi una nota libera al profilo cliente."
          >
            <div class="note-input-row">
              <input
                type="text"
                id="free-note"
                name="noteText"
                placeholder="Scrivi una nota per questa anagrafica..."
                required
              />
              <Button
                type="submit"
                style="background: var(--color-neutral-800); border: none;"
                >Scrivi Nota</Button
              >
            </div>
          </FormField>
        </form>
      </Card>
    {/if}

    <!-- Combined Activities & Notes Timeline -->
    <Card
      title="Cronologia Attività e Note"
      description="Storico cronologico inverso di tutte le interazioni registrate su questa scheda cliente."
    >
      {#snippet icon()}
        <Clock size={20} class="icon-accent" />
      {/snippet}

      <div class="timeline-container">
        {#if activitiesList.length === 0 && clientNotes.length === 0}
          <div class="empty-panel">
            Nessuna interazione o nota salvata per questo cliente.
          </div>
        {:else}
          <!-- Construct unified items list -->
          {@const timelineItems = [
            ...activitiesList.map((a) => ({
              id: a.id,
              time: new Date(a.date),
              author: a.loggedEmail,
              badge: a.type,
              text: a.notes,
              source: "activity",
            })),
            ...clientNotes.map((nRaw, idx) => {
              const parsed = parseNote(nRaw);
              return {
                id: `note-${idx}`,
                time: parsed.createdAt
                  ? new Date(parsed.createdAt)
                  : new Date(clientCreatedAt),
                author: parsed.createdByEmail,
                badge: "NOTA",
                text: parsed.text,
                source: "note",
              };
            }),
          ].sort((a, b) => b.time.getTime() - a.time.getTime())}

          <div class="timeline-flow">
            {#each timelineItems as item}
              <div
                id="timeline-item-{item.id}"
                class="timeline-card"
                class:note-item={item.source === "note"}
                class:glow={item.id === newlyCreatedId}
              >
                <div class="card-top">
                  <span
                    class="item-badge"
                    class:badge-nota={item.badge === "NOTA"}
                    class:badge-tel={item.badge === "Telefonata" ||
                      item.badge === "Sollecito Telefonico"}
                    class:badge-inc={item.badge === "Incontro" ||
                      item.badge === "Sollecito PEC"}
                    class:badge-app={item.badge === "Appuntamento" ||
                      item.badge === "Sollecito Email"}
                  >
                    {item.badge}
                  </span>
                  <span class="item-time"
                    >{formatDateTime(item.time)}</span
                  >
                  <span class="item-author">&bull; {item.author}</span>
                  {#if item.source === 'activity'}
                    <button class="btn-edit-inline" onclick={() => startEdit(item)}>Modifica</button>
                  {/if}
                </div>
                
                {#if editingId === item.id}
                  <div class="edit-activity-form">
                    <FormField id="edit-date-{item.id}" label="Data e Ora">
                      <input type="datetime-local" bind:value={editDate} disabled={submittingActivity} />
                    </FormField>
                    <FormField id="edit-notes-{item.id}" label="Note">
                      <textarea bind:value={editNotes} rows="3" disabled={submittingActivity}></textarea>
                    </FormField>
                    <div class="edit-actions">
                      <Button variant="outline" onclick={cancelEdit} disabled={submittingActivity}>Annulla</Button>
                      <Button variant="primary" onclick={() => saveEdit(item)} disabled={submittingActivity}>Salva Modifiche</Button>
                    </div>
                  </div>
                {:else}
                  <p class="card-text">
                    {item.text || "Nessuna nota aggiuntiva."}
                  </p>
                {/if}
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </Card>
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
  .activity-logger-shell {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .quick-log-actions {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    margin-top: 8px;
  }
  .log-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    border-radius: var(--radius-md);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    border: none;
    color: var(--color-white);
    transition: all var(--transition-fast);
  }
  .log-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .phone-btn {
    background: var(--color-success);
  }
  .phone-btn:hover:not(:disabled) {
    background: hsl(142, 76%, 30%);
  }
  .meeting-btn {
    background: var(--color-warning);
  }
  .meeting-btn:hover:not(:disabled) {
    background: hsl(38, 92%, 40%);
  }
  .appt-btn {
    background: var(--color-primary-500);
  }
  .appt-btn:hover:not(:disabled) {
    background: var(--color-primary-600);
  }
  .btn-edit-inline {
    background: none;
    border: none;
    color: var(--color-primary-600);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    margin-left: auto;
    padding: 2px 8px;
    border-radius: 4px;
  }
  .btn-edit-inline:hover {
    background: var(--color-primary-50);
  }
  .edit-activity-form {
    margin-top: 12px;
    padding: 12px;
    background: var(--color-neutral-50);
    border-radius: var(--radius-md);
    border: 1px dashed var(--color-neutral-200);
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .edit-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
  .simple-note-form {
    display: flex;
    flex-direction: column;
  }
  .note-input-row {
    display: flex;
    gap: 12px;
  }
  .note-input-row input {
    flex: 1;
  }
  .add-note-btn {
    background: var(--color-neutral-800);
    color: var(--color-white);
    border: none;
    padding: 0 20px;
    border-radius: var(--radius-md);
    font-weight: 600;
    cursor: pointer;
    transition: background var(--transition-fast);
  }
  .add-note-btn:hover {
    background: var(--color-neutral-900);
  }
  .timeline-container {
    padding-top: 10px;
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
  .timeline-flow {
    display: flex;
    flex-direction: column;
    gap: 16px;
    position: relative;
  }
  .timeline-flow::before {
    content: "";
    position: absolute;
    top: 0;
    bottom: 0;
    left: 20px;
    width: 2px;
    background: var(--color-neutral-200);
    z-index: 0;
  }
  .timeline-card {
    position: relative;
    z-index: 1;
    background: var(--color-white);
    border: 1px solid var(--color-neutral-200);
    border-radius: var(--radius-md);
    padding: 16px;
    margin-left: 40px;
  }
  .timeline-card::before {
    content: "";
    position: absolute;
    top: 20px;
    left: -24px;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--color-primary-500);
    border: 2px solid var(--color-white);
    box-shadow: 0 0 0 2px var(--color-neutral-200);
  }
  .note-item {
    background: var(--color-neutral-50);
  }
  .note-item::before {
    background: var(--color-neutral-500);
  }
  .glow {
    animation: highlightGlow 2s ease-out;
  }
  @keyframes highlightGlow {
    0% {
      box-shadow: 0 0 0 2px var(--color-primary-500);
    }
    100% {
      box-shadow: 0 0 0 0 rgba(0, 0, 0, 0);
    }
  }
  .card-top {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 8px;
    flex-wrap: wrap;
  }
  .item-badge {
    font-size: 11px;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: var(--radius-sm);
    background: var(--color-neutral-200);
    color: var(--color-neutral-700);
  }
  .badge-nota {
    background: var(--color-neutral-200);
  }
  .badge-tel {
    background: var(--color-success-light);
    color: var(--color-success-text);
  }
  .badge-inc {
    background: var(--color-warning-light);
    color: var(--color-warning-text);
  }
  .badge-app {
    background: var(--color-primary-100);
    color: var(--color-primary-700);
  }

  .item-time {
    font-size: 13px;
    color: var(--color-neutral-500);
  }
  .item-author {
    font-size: 13px;
    color: var(--color-neutral-600);
    font-weight: 500;
  }
  .card-text {
    margin: 0;
    font-size: 14px;
    color: var(--color-neutral-800);
    line-height: 1.5;
    white-space: pre-wrap;
  }
  :global(.icon-accent) {
    color: var(--color-primary-500);
  }
  .animate-fade-in {
    animation: fadeIn 0.3s ease;
  }
  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(4px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
</style>
