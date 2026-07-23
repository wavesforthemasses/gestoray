<script lang="ts">
  import { Card, StatusBadge } from '$lib';
  import { Users } from '@lucide/svelte';

  interface Props {
    vendorSummary: any[];
    isClosingFinalized: boolean;
    calculationMode: string;
    onFinalize: () => void;
    canFinalize: boolean;
    submitting: boolean;
  }

  let { vendorSummary, isClosingFinalized, calculationMode, onFinalize, canFinalize, submitting } = $props();

  let expandedRows = $state<Record<string, boolean>>({});

  function toggleRow(uid: string) {
    expandedRows[uid] = !expandedRows[uid];
  }
</script>

<Card 
  title="Prospetto Provvigionale Consulenti" 
  description="Riepilogo delle provvigioni spettanti a ciascun commerciale per questa versione. Metodo: {calculationMode === 'historical' ? 'Storico' : 'Qualifica Attuale'}."
>
  {#snippet icon()}
    <Users size={20} class="icon-accent" />
  {/snippet}

  {#snippet headerSnippet()}
    {#if canFinalize}
      <button onclick={onFinalize} disabled={submitting || vendorSummary.length === 0} class="approve-closing-btn">
        Approva e Rendi Definitive
      </button>
    {/if}
  {/snippet}

  {#if vendorSummary.length === 0}
    <div class="empty-txt empty-panel-padding center-text subdued-text">Nessun commerciale attivo trovato nel database.</div>
  {:else}
    <table class="widescreen-table">
      <thead>
        <tr>
          <th>Consulente</th>
          <th>Qualifica</th>
          <th>Volume Incassato (Quota)</th>
          <th>Importo Provvigione</th>
          <th>Stato liquidazione</th>
        </tr>
      </thead>
      <tbody>
        {#each vendorSummary as row}
          <tr class="pointer-row" onclick={() => toggleRow(row.uid)} title="Clicca per mostrare/nascondere il dettaglio delle operazioni">
            <td>
              <div class="user-cell flex-row-center gap-8">
                <div class="expand-icon" style="transform: {expandedRows[row.uid] ? 'rotate(90deg)' : 'rotate(0)'};">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                </div>
                <span class="u-name">{row.name}</span>
              </div>
            </td>
            <td>
              <span class="badge qual-badge">{row.qualification.toUpperCase()}</span>
            </td>
            <td><strong>€ {row.sales.toFixed(2)}</strong></td>
            <td><strong class="success-text text-md">€ {row.commission.toFixed(2)}</strong></td>
            <td>
              <StatusBadge status={isClosingFinalized ? 'approved' : 'draft'} label={isClosingFinalized ? 'Pronta per Fatturazione' : 'Bozza Salvata'} />
            </td>
          </tr>
          {#if expandedRows[row.uid]}
            <tr class="details-row">
              <td colspan="5" class="details-td">
                <div class="details-container">
                  <h4 class="details-title">Dettaglio Maturazione Provvigionale</h4>
                  {#if !row.details || row.details.length === 0}
                    <div class="subdued-text text-sm">Nessun dettaglio disponibile per questo consulente.</div>
                  {:else}
                    <table class="widescreen-table details-inner-table no-shadow white-bg bordered-table">
                      <thead>
                        <tr>
                          <th>ID Incasso</th>
                          <th>Contratto / Cliente</th>
                          <th>Servizio / Prodotto</th>
                          <th>Quota Incassata</th>
                          <th>Provvigione Generata</th>
                        </tr>
                      </thead>
                      <tbody>
                        {#each row.details as det}
                          <tr>
                            <td>
                              <a href="/dashboard/payments/{det.paymentId}" class="link-btn-text text-xs">Vedi Incasso</a>
                            </td>
                            <td>
                              <div class="font-medium text-sm">{det.clientName}</div>
                              <a href="/dashboard/contracts/{det.contractId}" class="link-btn-text text-xs">Vedi Contratto</a>
                            </td>
                            <td><span class="text-sm">{det.productName}</span></td>
                            <td><strong class="text-sm">€ {det.allocatedAmount.toFixed(2)}</strong></td>
                            <td><strong class="success-text text-md-sm">€ {det.commission.toFixed(2)}</strong></td>
                          </tr>
                        {/each}
                      </tbody>
                    </table>
                  {/if}
                </div>
              </td>
            </tr>
          {/if}
        {/each}
      </tbody>
    </table>
  {/if}
</Card>

<style>
  :global(.icon-accent) {
    color: var(--color-primary-500);
  }

  .approve-closing-btn {
    background: linear-gradient(135deg, var(--color-success), var(--color-success-text));
    color: var(--color-white);
    border: none;
    padding: 8px 16px;
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-family: inherit;
    font-size: 13px;
    font-weight: 600;
    transition: all 0.2s;
    box-shadow: 0 4px 10px rgba(16, 185, 129, 0.2);
  }

  .approve-closing-btn:hover {
    opacity: 0.9;
  }

  .approve-closing-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .widescreen-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 8px;
  }

  .widescreen-table th {
    text-align: left;
    padding: 12px;
    font-size: 12px;
    text-transform: uppercase;
    color: var(--color-neutral-500);
    border-bottom: 1px solid var(--color-neutral-200);
    letter-spacing: 0.05em;
  }

  .widescreen-table td {
    padding: 14px 12px;
    border-bottom: 1px solid var(--color-neutral-100);
    font-size: 13px;
  }

  .user-cell {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .u-name {
    font-weight: 600;
    color: var(--color-neutral-800);
  }

  .badge {
    font-size: 10px;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: var(--radius-xs);
    letter-spacing: 0.05em;
    display: inline-block;
  }

  .badge.qual-badge {
    background: var(--color-primary-50);
    color: var(--color-primary-700);
  }

  .link-btn-text {
    color: var(--color-primary-600);
    text-decoration: none;
    font-weight: 500;
  }

  .link-btn-text:hover {
    text-decoration: underline;
  }

  .empty-panel-padding { padding: 24px; }
  .center-text { text-align: center; }
  .subdued-text { color: var(--color-neutral-500); }
  .pointer-row { cursor: pointer; }
  .flex-row-center { display: flex; align-items: center; flex-direction: row; }
  .gap-8 { gap: 8px; }
  .expand-icon {
    color: var(--color-primary-500);
    transition: transform 0.2s;
  }
  .success-text { color: var(--color-success-text); }
  .text-md { font-size: 14px; }
  .text-sm { font-size: 12px; }
  .text-xs { font-size: 11px; }
  .text-md-sm { font-size: 13px; }
  .font-medium { font-weight: 500; }
  
  .details-td {
    padding: 0;
    background: var(--color-neutral-50);
  }
  .details-container {
    padding: 16px 24px;
    border-top: 1px solid var(--color-neutral-200);
  }
  .details-title {
    margin: 0 0 12px 0;
    font-size: 13px;
    color: var(--color-neutral-600);
    font-weight: 600;
  }
  .no-shadow { box-shadow: none; }
  .white-bg { background: white; }
  .bordered-table { border: 1px solid var(--color-neutral-200); }
</style>
