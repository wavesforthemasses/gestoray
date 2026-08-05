<script lang="ts">
  import { FormField, Autocomplete } from '$lib';
  import { UserCheck } from '@lucide/svelte';

  interface Props {
    labels: any;
    clientOptions: { id: string; label: string }[];
    agentOptions: { id: string; label: string }[];
    projectOptions: { id: string; label: string }[];
    hasProjectsModule: boolean;
    projectLabel?: string;
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
    projectLabel = 'Progetto',
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
        <input type="text" id="title" bind:value={title} placeholder="es. Fornitura Sede..." />
      </FormField>
    </div>

    <!-- Row 2: Agente, Progetto (se attivo) e N° Contratto -->
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
        <FormField id="projectId" label="{projectLabel} Correlato">
          <Autocomplete
            options={projectOptions}
            bind:value={projectId}
            placeholder="Seleziona {projectLabel.toLowerCase()}..."
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
    background-color: var(--color-neutral-0);
    border: 1px solid var(--color-neutral-200);
    border-radius: var(--radius-lg);
    padding: var(--spacing-5);
    margin-bottom: var(--spacing-6);

    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    transition: border-color 0.2s, box-shadow 0.2s;
  }

  .form-section-block:focus-within {
    border-color: var(--color-primary-300);
    box-shadow: 0 4px 12px rgba(37, 99, 235, 0.06);
  }

  .section-title-row {
    display: flex;
    align-items: center;
    gap: var(--spacing-2);
    margin-bottom: var(--spacing-4);
    padding-bottom: var(--spacing-2);
    border-bottom: 1px dashed var(--color-neutral-200);
  }

  .section-title-text {
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--color-neutral-700);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .header-grid {
    display: grid;
    grid-template-columns: repeat(12, 1fr);
    gap: var(--spacing-4);
  }

  /* Row 1 */
  .col-client { grid-column: span 6; }
  .col-title { grid-column: span 6; }

  /* Row 2 */
  .col-agent-wide { grid-column: span 8; }
  .col-agent { grid-column: span 5; }
  .col-project { grid-column: span 4; }
  .col-number { grid-column: span 3; }

  .input-readonly {
    background-color: var(--color-neutral-100) !important;
    color: var(--color-neutral-600) !important;
    cursor: not-allowed;
    font-weight: 600;
  }

  @media (max-width: 1024px) {
    .col-client, .col-title { grid-column: span 12; }
    .col-agent-wide, .col-agent, .col-project { grid-column: span 6; }
    .col-number { grid-column: span 12; }
  }

  @media (max-width: 640px) {
    .col-agent-wide, .col-agent, .col-project { grid-column: span 12; }
  }
</style>
