<script lang="ts">
  import { Card, StatusBadge } from '$lib';
  import { User, DollarSign } from '@lucide/svelte';
  import { formatDateTime } from '$lib/utils/formatters';

  interface Props {
    contract: any;
    vendorQual: string;
  }

  let { contract, vendorQual } = $props();
</script>

<!-- Dati di Riepilogo in Widescreen -->
<div class="grid-3-2">
  <!-- Client & Vendor Card -->
  <Card title="Informazioni Contratto" description="Dettaglio delle parti interessate e dello stato d'ordine.">
    {#snippet icon()}
      <User size={20} class="icon-accent" />
    {/snippet}

    <div class="grid-cols-2">
      <div class="info-item">
        <span class="info-lbl">Cliente</span>
        <span class="info-val">{contract.original?.clientName}</span>
        <span class="info-sub">{contract.original?.clientEmail}</span>
      </div>

      <div class="info-item">
        <span class="info-lbl">Consulente Commerciale</span>
        <span class="info-val">{contract.original?.vendorEmail}</span>
        <span class="info-sub">Livello: <strong class="uppercase-text">{vendorQual}</strong></span>
      </div>

      <div class="info-item">
        <span class="info-lbl">Data Creazione</span>
        <span class="info-val">{formatDateTime(contract.edits?.createdAt || contract.original?.createdAt)}</span>
      </div>

      <div class="info-item">
        <span class="info-lbl">Stato Approvazione</span>
        <div class="flex-col">
          <StatusBadge status={contract.original?.status} />
        </div>
        {#if contract.original?.approvedAt}
          <span class="info-sub block-mt-4">Approvato il {formatDateTime(contract.original.approvedAt)} da {contract.original.approvedEmail}</span>
        {/if}
      </div>
    </div>
  </Card>

  <!-- Totals Card -->
  <Card title="Valori e Provvigioni" description="Importo totale del contratto e calcolo provvigionale stimato.">
    {#snippet icon()}
      <DollarSign size={20} class="icon-accent" />
    {/snippet}

    <div class="totals-dashboard">
      <div class="total-metric">
        <span class="metric-lbl">Importo Lordo Contratto</span>
        <span class="metric-val text-primary">€ {(Number(contract.original?.totalPrice ?? contract.totalAmount) || 0).toFixed(2)}</span>
      </div>

      <div class="total-metric">
        <span class="metric-lbl">Provvigione Commerciale ({vendorQual.toUpperCase()})</span>
        <span class="metric-val text-success">€ {(Number(contract.derived?.commissionTotal) || 0).toFixed(2)}</span>
        <span class="metric-sub">Calcolata con interpolazione lineare basata sullo sconto applicato.</span>
      </div>

      {#if contract.original?.secondVendorUid}
        <div class="co-selling-split-display split-container">
          <h4 class="split-title">Ripartizione Vendita / Co-Selling</h4>
          <table class="split-table split-styled-table">
            <thead>
              <tr class="split-header-row">
                <th class="split-th split-th-left">Consulente</th>
                <th class="split-th split-th-right">Quota %</th>
                <th class="split-th split-th-right">Provvigione</th>
              </tr>
            </thead>
            <tbody>
              <tr class="split-body-row">
                <td class="split-td split-td-left split-font-medium">{contract.original?.vendorEmail} (Principale)</td>
                <td class="split-td split-td-right">{100 - (Number(contract.original?.secondVendorShare) || 0)}%</td>
                <td class="split-td split-td-right split-font-bold split-val-color">€ {(Number(contract.derived?.commissionPrimary) || 0).toFixed(2)}</td>
              </tr>
              <tr>
                <td class="split-td split-td-left split-font-medium">{contract.original?.secondVendorEmail} (Co-selling)</td>
                <td class="split-td split-td-right">{contract.original?.secondVendorShare}%</td>
                <td class="split-td split-td-right split-font-bold split-val-color">€ {(Number(contract.derived?.commissionSecondary) || 0).toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      {/if}
    </div>
  </Card>
</div>

<style>
  :global(.icon-accent) {
    color: var(--color-primary-500);
  }

  .grid-3-2 {
    display: grid;
    grid-template-columns: 3fr 2fr;
    gap: 24px;
    align-items: stretch;
  }
  @media (max-width: 900px) {
    .grid-3-2 { grid-template-columns: 1fr; }
  }

  .grid-cols-2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
  }
  @media (max-width: 500px) {
    .grid-cols-2 { grid-template-columns: 1fr; }
  }

  .info-item {
    display: flex;
    flex-direction: column;
  }

  .info-lbl {
    font-size: 11px;
    font-weight: 600;
    color: var(--color-neutral-400);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .info-val {
    font-size: 14.5px;
    font-weight: 700;
    color: var(--color-neutral-800);
    margin-top: 2px;
  }

  .info-sub {
    font-size: 11px;
    color: var(--color-neutral-500);
    margin-top: 1px;
  }

  .flex-col {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    margin-top: 4px;
  }

  .totals-dashboard {
    display: flex;
    flex-direction: column;
    gap: 24px;
    justify-content: center;
    height: 100%;
  }

  .total-metric {
    display: flex;
    flex-direction: column;
  }

  .metric-lbl {
    font-size: 11px;
    font-weight: 600;
    color: var(--color-neutral-400);
    text-transform: uppercase;
  }

  .metric-val {
    font-size: 24px;
    font-weight: 800;
    margin-top: 4px;
  }

  .metric-val.text-primary { color: var(--color-primary-600); }
  .metric-val.text-success { color: var(--color-success-text); }

  .metric-sub {
    font-size: 10px;
    color: var(--color-neutral-400);
    margin-top: 2px;
  }

  .uppercase-text {
    text-transform: uppercase;
  }

  .block-mt-4 {
    margin-top: 4px;
    display: block;
  }

  .split-container {
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid var(--color-neutral-200);
    width: 100%;
  }

  .split-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--color-neutral-800);
    margin-bottom: 8px;
  }

  .split-styled-table {
    width: 100%;
    font-size: 12px;
    border-collapse: collapse;
  }

  .split-header-row {
    text-align: left;
    border-bottom: 1px solid var(--color-neutral-200);
  }

  .split-th {
    padding: 4px 0;
    color: var(--color-neutral-500);
  }

  .split-th-left { text-align: left; }
  .split-th-right { text-align: right; }

  .split-body-row {
    border-bottom: 1px solid var(--color-neutral-100);
  }

  .split-td {
    padding: 6px 0;
  }

  .split-td-left { text-align: left; }
  .split-td-right { text-align: right; }

  .split-font-medium { font-weight: 500; }
  .split-font-bold { font-weight: 700; }
  .split-val-color { color: var(--color-neutral-800); }
</style>
