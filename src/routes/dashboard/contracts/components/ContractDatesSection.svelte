<script lang="ts">
  import { FormField, TagInput } from '$lib';
  import { CalendarDays } from '@lucide/svelte';
  import type { ContractType, RecurringFrequency, ContractStatus } from '../schema';

  interface Props {
    labels: any;
    availableTypes: ContractType[];
    showEndDate: boolean;
    isEndDateRequired: boolean;
    type: ContractType;
    status: ContractStatus;
    billingFrequency: RecurringFrequency;
    startDate: string;
    endDate: string;
    tags: string[];
  }

  let {
    labels,
    availableTypes,
    showEndDate,
    isEndDateRequired,
    type = $bindable('Ricorrente'),
    status = $bindable('bozza'),
    billingFrequency = $bindable('mensile'),
    startDate = $bindable(''),
    endDate = $bindable(''),
    tags = $bindable([])
  }: Props = $props();
</script>

<div class="form-section-block">
  <div class="section-title-row">
    <CalendarDays size={18} class="icon-accent" />
    <span class="section-title-text">Tipologia & Date Contrattuali</span>
  </div>

  <div class="dates-grid">
    <!-- Row 1: Tipologia (50%) & Stato (50%) — Tipologia nascosta se un solo tipo -->
    {#if availableTypes.length > 1}
      <div class="col-type">
        <FormField id="type" label={`${labels.typeLabel} *`}>
          <select id="type" bind:value={type}>
            {#each availableTypes as t}
              <option value={t}>
                {t === 'Ricorrente' ? 'Ricorrente (Canone / Abbonamento)' : 'Non Ricorrente (Fornitura / Quotazione)'}
              </option>
            {/each}
          </select>
        </FormField>
      </div>
    {/if}

    <div class={availableTypes.length > 1 ? "col-status" : "col-full"}>
      <FormField id="status" label="Stato Iniziale Documento *">
        <select id="status" bind:value={status}>
          <option value="bozza">Bozza</option>
          <option value="inviato">Inviato al Cliente</option>
          <option value="attivo">Attivo / Accettato</option>
          <option value="in_scadenza">In Scadenza</option>
        </select>
      </FormField>
    </div>

    <!-- Row 2: Frequenza + Dates -->
    {#if type === 'Ricorrente'}
      <div class="col-third">
        <FormField id="billingFrequency" label="Frequenza Rinnovo">
          <select id="billingFrequency" bind:value={billingFrequency}>
            <option value="mensile">Mensile</option>
            <option value="bimestrale">Bimestrale</option>
            <option value="trimestrale">Trimestrale</option>
            <option value="semestrale">Semestrale</option>
            <option value="annuale">Annuale</option>
          </select>
        </FormField>
      </div>

      <div class="col-third">
        <FormField id="startDate" label="Data Decorrenza *">
          <input type="date" id="startDate" bind:value={startDate} required />
        </FormField>
      </div>

      <div class="col-third">
        <FormField id="endDate" label="Data Scadenza *">
          <input type="date" id="endDate" bind:value={endDate} required />
        </FormField>
      </div>
    {:else}
      <div class={showEndDate ? "col-half" : "col-full"}>
        <FormField id="startDate" label="Data Decorrenza *">
          <input type="date" id="startDate" bind:value={startDate} required />
        </FormField>
      </div>

      {#if showEndDate}
        <div class="col-half">
          <FormField id="endDate" label={isEndDateRequired ? 'Data Scadenza *' : 'Data Scadenza'}>
            <input type="date" id="endDate" bind:value={endDate} required={isEndDateRequired} />
          </FormField>
        </div>
      {/if}
    {/if}

    <!-- Row 3: Tag Input (Full Width) -->
    <div class="col-full">
      <FormField id="tags" label="Tag & Etichette Descrittive">
        <TagInput bind:tags={tags} placeholder="Es. #urgente, #edilizia, #chiavi_in_mano..." />
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

  .dates-grid {
    display: grid;
    grid-template-columns: repeat(12, 1fr);
    gap: 16px;
  }

  .col-type { grid-column: span 6; }
  .col-status { grid-column: span 6; }

  .col-third { grid-column: span 4; }
  .col-half { grid-column: span 6; }
  .col-full { grid-column: span 12; }

  @media (max-width: 900px) {
    .col-type, .col-status, .col-third, .col-half, .col-full {
      grid-column: span 12;
    }
  }
</style>
