<script lang="ts">
  import { FormField } from '$lib';
  import { Receipt } from '@lucide/svelte';

  interface Props {
    clientNotes: string;
    adminNotes: string;
    termsAndConditions: string;
  }

  let {
    clientNotes = $bindable(''),
    adminNotes = $bindable(''),
    termsAndConditions = $bindable('')
  }: Props = $props();
</script>

<div class="form-section-card">
  <div class="section-card-header">
    <div class="header-icon-box">
      <Receipt size={20} />
    </div>
    <div class="header-titles">
      <h3 class="card-title">Note & Condizioni Contrattuali</h3>
      <p class="card-subtitle">Note operative per il cliente, annotazioni interne e clausole generali</p>
    </div>
  </div>

  <div class="notes-grid">
    <div class="col-half">
      <FormField id="clientNotes" label="Note Visibili al Cliente">
        <textarea id="clientNotes" bind:value={clientNotes} rows="3" placeholder="Informazioni sulla consegna, modalità d'uso..."></textarea>
      </FormField>
    </div>

    <div class="col-half">
      <FormField id="adminNotes" label="Note Interne Riservate (Amministrazione)">
        <textarea id="adminNotes" bind:value={adminNotes} rows="3" placeholder="Note ad uso esclusivo del team interno..."></textarea>
      </FormField>
    </div>

    <div class="col-full">
      <FormField id="termsAndConditions" label="Termini & Condizioni Contrattuali">
        <textarea id="termsAndConditions" bind:value={termsAndConditions} rows="3" placeholder="Condizioni generali di fornitura, garanzie, clausole..."></textarea>
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

  .notes-grid {
    display: grid;
    grid-template-columns: repeat(12, 1fr);
    gap: 18px;
  }

  .col-half { grid-column: span 6; }
  .col-full { grid-column: span 12; }

  @media (max-width: 768px) {
    .col-half { grid-column: span 12; }
  }
</style>
