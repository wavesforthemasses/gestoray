<script lang="ts">
  import { FormField, Autocomplete } from '$lib';
  import { Building2, FileText, UserCheck, FolderKanban, Hash } from '@lucide/svelte';

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

<div class="form-section-card">
  <div class="section-card-header">
    <div class="header-icon-box">
      <Building2 size={20} />
    </div>
    <div class="header-titles">
      <h3 class="card-title">Cliente & Dati Generali</h3>
      <p class="card-subtitle">Intestazione contratto e associazione {projectLabel.toLowerCase()}</p>
    </div>
  </div>

  <div class="header-grid">
    <!-- Row 1: Cliente Intestatario (6 cols) & Agente Commerciale (6 cols) -->
    <div class="col-client">
      <FormField id="clientId" label="Cliente Intestatario *">
        <Autocomplete
          options={clientOptions}
          bind:value={clientId}
          placeholder="Cerca cliente per nome o ragione sociale..."
        />
      </FormField>
    </div>

    <div class="col-agent">
      <FormField id="agentId" label="Agente / Commerciale">
        <Autocomplete
          options={agentOptions}
          bind:value={agentId}
          placeholder="Seleziona agente responsabile..."
        />
      </FormField>
    </div>

    <!-- Row 2: Titolo Contratto (5 cols), Progetto Correlato (4 cols) & N° Contratto (3 cols) -->
    <div class="col-title">
      <FormField id="title" label={labels.titleLabel}>
        <input type="text" id="title" bind:value={title} placeholder="es. Fornitura e Manutenzione Sede..." />
      </FormField>
    </div>

    <div class="col-project">
      <FormField id="projectId" label="{projectLabel} Correlato">
        <Autocomplete
          options={projectOptions}
          bind:value={projectId}
          placeholder="Seleziona {projectLabel.toLowerCase()} (opzionale)..."
        />
      </FormField>
    </div>

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
  .form-section-card {
    background: var(--color-neutral-0);
    border: 1px solid var(--color-neutral-200);
    border-radius: var(--radius-xl);
    padding: 24px;
    margin-bottom: 24px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
    transition: all 0.2s ease-in-out;
  }

  .form-section-card:focus-within {
    border-color: var(--color-primary-400);
    box-shadow: 0 6px 20px rgba(37, 99, 235, 0.08);
  }

  .section-card-header {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-bottom: 20px;
    padding-bottom: 16px;
    border-bottom: 1px dashed var(--color-neutral-200);
  }

  .header-icon-box {
    width: 42px;
    height: 42px;
    border-radius: 12px;
    background: linear-gradient(135deg, var(--color-primary-50), #eff6ff);
    color: var(--color-primary-600);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    border: 1px solid rgba(37, 99, 235, 0.12);
  }

  .header-titles {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .card-title {
    font-size: 16px;
    font-weight: 700;
    color: var(--color-neutral-900);
    margin: 0;
    letter-spacing: -0.01em;
  }

  .card-subtitle {
    font-size: 13px;
    color: var(--color-neutral-500);
    margin: 0;
  }

  .header-grid {
    display: grid;
    grid-template-columns: repeat(12, 1fr);
    gap: 18px;
  }

  /* Row 1 */
  .col-client { grid-column: span 6; }
  .col-agent { grid-column: span 6; }

  /* Row 2 */
  .col-title { grid-column: span 5; }
  .col-project { grid-column: span 4; }
  .col-number { grid-column: span 3; }

  .input-readonly {
    background-color: var(--color-neutral-100) !important;
    color: var(--color-neutral-600) !important;
    cursor: not-allowed;
    font-weight: 600;
    letter-spacing: 0.03em;
  }

  @media (max-width: 1024px) {
    .col-client, .col-agent { grid-column: span 12; }
    .col-title { grid-column: span 6; }
    .col-project { grid-column: span 6; }
    .col-number { grid-column: span 12; }
  }

  @media (max-width: 640px) {
    .col-title, .col-project { grid-column: span 12; }
  }
</style>
