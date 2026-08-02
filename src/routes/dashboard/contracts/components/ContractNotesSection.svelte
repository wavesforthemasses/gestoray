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

<div class="form-section-block">
  <div class="section-title-row">
    <Receipt size={18} class="icon-accent" />
    <span class="section-title-text">Note & Condizioni Contrattuali</span>
  </div>

  <div class="form-group-row">
    <FormField id="clientNotes" label="Note Visibili al Cliente" class="flex-1">
      <textarea id="clientNotes" bind:value={clientNotes} rows="3" placeholder="Informazioni sulla consegna, modalità d'uso..."></textarea>
    </FormField>

    <FormField id="adminNotes" label="Note Interne Riservate (Amministrazione)" class="flex-1">
      <textarea id="adminNotes" bind:value={adminNotes} rows="3" placeholder="Note ad uso esclusivo del team interno..."></textarea>
    </FormField>
  </div>

  <div class="margin-top-12">
    <FormField id="termsAndConditions" label="Termini & Condizioni Contrattuali">
      <textarea id="termsAndConditions" bind:value={termsAndConditions} rows="3" placeholder="Condizioni generali di fornitura, garanzie, clausole..."></textarea>
    </FormField>
  </div>
</div>

<style>
  .form-section-block {
    display: flex;
    flex-direction: column;
    gap: 16px;
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

  .form-group-row {
    display: flex;
    gap: 20px;
  }

  .margin-top-12 {
    margin-top: 4px;
  }

  @media (max-width: 768px) {
    .form-group-row {
      flex-direction: column;
      gap: 16px;
    }
  }
</style>
