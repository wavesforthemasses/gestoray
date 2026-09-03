<script lang="ts">
  import { formatCurrency } from '$lib/utils/math';
  import type { CastellettoItem } from '../schema';

  let {
    totalNet = 0,
    totalVat = 0,
    totalGross = 0,
    netToPay = 0,
    pensionFundRate = 0,
    pensionFundAmount = 0,
    withholdingTaxRate = 0,
    withholdingTaxAmount = 0,
    isSplitPayment = false,
    splitPaymentAmount = 0,
    castelletto = []
  }: {
    totalNet?: number;
    totalVat?: number;
    totalGross?: number;
    netToPay?: number;
    pensionFundRate?: number;
    pensionFundAmount?: number;
    withholdingTaxRate?: number;
    withholdingTaxAmount?: number;
    isSplitPayment?: boolean;
    splitPaymentAmount?: number;
    castelletto?: CastellettoItem[];
  } = $props();
</script>

<div class="totals-card">
  <h3 class="totals-title">Riepilogo Fiscale & Castelletto</h3>

  <div class="totals-rows">
    <div class="row">
      <span class="label">Totale Imponibile Netto:</span>
      <span class="value">{formatCurrency(totalNet)}</span>
    </div>

    {#if pensionFundAmount > 0}
      <div class="row row-sub">
        <span class="label">Rivalsa Cassa Previdenziale ({pensionFundRate}%):</span>
        <span class="value">+{formatCurrency(pensionFundAmount)}</span>
      </div>
    {/if}

    <!-- Castelletto IVA -->
    {#if castelletto && castelletto.length > 0}
      <div class="castelletto-block">
        <div class="castelletto-header">
          <span>Aliquota / Natura</span>
          <span>Imponibile</span>
          <span>Imposta IVA</span>
        </div>
        {#each castelletto as c}
          <div class="castelletto-row">
            <span class="tag">
              {c.rate}% {#if c.natureCode}({c.natureCode}){/if}
            </span>
            <span>{formatCurrency(c.taxableAmount)}</span>
            <span>{formatCurrency(c.vatAmount)}</span>
          </div>
        {/each}
      </div>
    {/if}

    <div class="row">
      <span class="label">Totale IVA:</span>
      <span class="value">{formatCurrency(totalVat)}</span>
    </div>

    <div class="row row-divider"></div>

    <div class="row row-gross">
      <span class="label">Totale Lordo Documento:</span>
      <span class="value">{formatCurrency(totalGross)}</span>
    </div>

    {#if withholdingTaxAmount > 0}
      <div class="row row-deduction">
        <span class="label">Ritenuta d'Acconto ({withholdingTaxRate}%):</span>
        <span class="value">-{formatCurrency(withholdingTaxAmount)}</span>
      </div>
    {/if}

    {#if isSplitPayment && splitPaymentAmount > 0}
      <div class="row row-deduction">
        <span class="label">Scissione Pagamenti (Split Payment PA):</span>
        <span class="value">-{formatCurrency(splitPaymentAmount)}</span>
      </div>
    {/if}

    <div class="row row-highlight">
      <span class="label">Netto Effettivo da Pagare:</span>
      <span class="value highlight-val">{formatCurrency(netToPay)}</span>
    </div>
  </div>
</div>

<style>
  .totals-card {
    background: var(--surface-card, #ffffff);
    border: 1px solid var(--border-color, #e2e8f0);
    border-radius: 12px;
    padding: 1.25rem 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .totals-title {
    font-size: 1rem;
    font-weight: 700;
    margin: 0;
    color: var(--text-primary, #0f172a);
    border-bottom: 1px solid var(--border-color, #e2e8f0);
    padding-bottom: 0.6rem;
  }

  .totals-rows {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    font-size: 0.875rem;
  }

  .row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    color: var(--text-primary, #334155);
  }

  .row-sub {
    font-size: 0.82rem;
    color: var(--text-muted, #64748b);
  }

  .row-deduction {
    font-size: 0.82rem;
    color: #b91c1c;
  }

  .row-divider {
    height: 1px;
    background: var(--border-color, #e2e8f0);
    margin: 0.4rem 0;
  }

  .row-gross {
    font-weight: 700;
    font-size: 1rem;
    color: var(--text-primary, #0f172a);
  }

  .row-highlight {
    margin-top: 0.5rem;
    padding-top: 0.75rem;
    border-top: 2px solid var(--border-color, #e2e8f0);
    font-weight: 800;
    font-size: 1.15rem;
  }

  .highlight-val {
    color: var(--color-primary-600, #2563eb);
  }

  .castelletto-block {
    background: var(--surface-secondary, #f8fafc);
    border: 1px solid var(--border-color, #e2e8f0);
    border-radius: 8px;
    padding: 0.6rem 0.8rem;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    font-size: 0.75rem;
    margin: 0.25rem 0;
  }

  .castelletto-header {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    font-weight: 700;
    color: var(--text-muted, #64748b);
    border-bottom: 1px solid #e2e8f0;
    padding-bottom: 0.25rem;
  }

  .castelletto-row {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    color: var(--text-primary, #334155);
  }

  .tag {
    font-weight: 700;
    color: var(--color-primary-600, #2563eb);
  }
</style>
