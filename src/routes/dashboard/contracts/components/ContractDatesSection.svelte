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

<div class="form-section-card">
  <div class="section-card-header">
    <div class="header-icon-box">
      <CalendarDays size={20} />
    </div>
    <div class="header-titles">
      <h3 class="card-title">Tipologia & Date Contrattuali</h3>
      <p class="card-subtitle">Periodo di validità, frequenza di rinnovo ed etichette descrittive</p>
    </div>
  </div>

  <div class="dates-grid">
    <!-- Row 1: Tipologia & Stato -->
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

    <!-- Row 3: Tag Input -->
    <div class="col-full">
      <FormField id="tags" label="Tag & Etichette Descrittive">
        <TagInput bind:tags={tags} placeholder="Es. #urgente, #edilizia, #chiavi_in_mano..." />
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

  .dates-grid {
    display: grid;
    grid-template-columns: repeat(12, 1fr);
    gap: 18px;
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
