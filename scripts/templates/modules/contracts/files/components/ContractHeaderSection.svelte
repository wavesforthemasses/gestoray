<script lang="ts">
  import { FormField, Autocomplete } from '$lib';
  import { UserCheck } from '@lucide/svelte';

  interface Props {
    labels: any;
    clientOptions: { id: string; label: string }[];
    agentOptions: { id: string; label: string }[];
    projectOptions: { id: string; label: string }[];
    hasProjectsModule: boolean;
    clientId: string;
    title: string;
    agentId: string;
    contractNumber: string;
    projectId: string;
  }

  let {
    labels,
    clientOptions,
    agentOptions,
    projectOptions,
    hasProjectsModule,
    clientId = $bindable(''),
    title = $bindable(''),
    agentId = $bindable(''),
    contractNumber = $bindable(''),
    projectId = $bindable('')
  }: Props = $props();
</script>

<div class="form-section-block">
  <div class="section-title-row">
    <UserCheck size={18} class="icon-accent" />
    <span class="section-title-text">Cliente & Riferimenti Generali</span>
  </div>

  <div class="header-grid">
    <!-- Row 1: Cliente & Titolo (50% - 50%) -->
    <div class="col-client">
      <FormField id="clientId" label="Cliente Intestatario *">
        <Autocomplete
          options={clientOptions}
          bind:value={clientId}
          placeholder="Cerca cliente per nome o ragione sociale..."
        />
      </FormField>
    </div>

    <div class="col-title">
      <FormField id="title" label={labels.titleLabel}>
        <input type="text" id="title" bind:value={title} placeholder="es. Fornitura Massetti Sede..." />
      </FormField>
    </div>

    <!-- Row 2: Agente, Cantiere (se attivo) e N° Contratto -->
    <div class={hasProjectsModule ? "col-agent" : "col-agent-wide"}>
      <FormField id="agentId" label="Agente / Commerciale">
        <Autocomplete
          options={agentOptions}
          bind:value={agentId}
          placeholder="Seleziona agente responsabile..."
        />
      </FormField>
    </div>

    {#if hasProjectsModule}
      <div class="col-project">
        <FormField id="projectId" label="Cantiere / Progetto Correlato">
          <Autocomplete
            options={projectOptions}
            bind:value={projectId}
            placeholder="Seleziona cantiere..."
          />
        </FormField>
      </div>
    {/if}

    <div class="col-number">
      <FormField id="contractNumber" label={labels.numberLabel}>
        <input
          type="text"
          id="contractNumber"
          value={contractNumber}
          disabled
          readonly
          class="input-readonly"
          title="Assegnato automaticamente al salvataggio"
        />
      </FormField>
    </div>
  </div>
</div>

<style>
  :global(.icon-accent) {
    color: var(--color-primary-500);
  }

  .form-section-block {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding-bottom: 20px;
    border-bottom: 1px solid var(--color-neutral-200);
  }

  .section-title-row {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    font-weight: 700;
    color: var(--color-neutral-800);
    letter-spacing: 0.02em;
  }

  .header-grid {
    display: grid;
    grid-template-columns: repeat(12, 1fr);
    gap: 16px;
  }

  /* Row 1: 50% - 50% */
  .col-client { grid-column: span 6; }
  .col-title { grid-column: span 6; }

  /* Row 2: Agente + Cantiere + Numero Contratto */
  .col-agent { grid-column: span 5; }
  .col-agent-wide { grid-column: span 9; }
  .col-project { grid-column: span 4; }
  .col-number { grid-column: span 3; }

  .input-readonly {
    background: var(--color-neutral-100) !important;
    color: var(--color-neutral-500) !important;
    cursor: not-allowed;
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
    text-align: center;
    letter-spacing: 0.05em;
    font-weight: 600;
  }

  @media (max-width: 900px) {
    .col-client, .col-title, .col-agent, .col-agent-wide, .col-project, .col-number {
      grid-column: span 12;
    }
  }
</style>
