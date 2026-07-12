<script lang="ts">
  import { Card, KPITile, DeadlinesList } from "$lib";
  import { Clock, AlertTriangle, CreditCard, Banknote, FileText } from "@lucide/svelte";
  import { goto } from "$app/navigation";
  import { formatDate } from "$lib/utils/formatters";

  let { 
    adminPendingContracts,
    adminOverdueInstallments,
    adminUndistributedPayments,
    adminPendingCommissions,
    adminFinalizedCommissions,
    onMarkCommissionPaid
  } = $props<{
    adminPendingContracts: any[];
    adminOverdueInstallments: any[];
    adminUndistributedPayments: any[];
    adminPendingCommissions: any[];
    adminFinalizedCommissions: any[];
    onMarkCommissionPaid: (id: string) => void;
  }>();
</script>

<div class="dashboard-main-split">
  <!-- Left Column: Tables -->
  <div class="dashboard-left-col">
    <div class="admin-table-stack" style="display: flex; flex-direction: column; gap: 24px;">
      <!-- 1. Contratti Da Approvare -->
      <Card title="Nuovi Ordini Da Approvare" description="Elenco dei contratti pendenti. Clicca su Gestisci per approvarli o verificare i dettagli.">
        {#snippet icon()}
          <Clock size={20} class="icon-accent" />
        {/snippet}
        
        {#if adminPendingContracts.length === 0}
          <div class="empty-panel">Nessun ordine in attesa di approvazione.</div>
        {:else}
          <div class="table-wrapper">
            <table class="widescreen-table admin-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Consulente</th>
                  <th>Prezzo Totale</th>
                  <th>Azioni</th>
                </tr>
              </thead>
              <tbody>
                {#each adminPendingContracts as c}
                  <tr>
                    <td><strong>{c.clientName}</strong></td>
                    <td>{c.vendorEmail}</td>
                    <td><strong>€ {c.totalPrice.toFixed(2)}</strong></td>
                    <td>
                      <button onclick={() => goto(`/dashboard/contracts/${c.id}`)} class="approve-collect-btn" style="padding: 4px 10px; font-size: 11px;">
                        Gestisci
                      </button>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      </Card>

      <!-- 2. Scadenziario Recupero Crediti -->
      <DeadlinesList installments={adminOverdueInstallments} {formatDate} />

      <!-- 3. Incassi Da Distribuire -->
      <Card title="Incassi Da Distribuire" description="Pagamenti registrati che hanno ancora del residuo da spalmare sui servizi o provvigioni.">
        {#snippet icon()}
          <CreditCard size={20} class="icon-accent" />
        {/snippet}

        {#if adminUndistributedPayments.length === 0}
          <div class="empty-panel">Nessun incasso con residuo rilevato.</div>
        {:else}
          <div class="table-wrapper">
            <table class="widescreen-table admin-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Data Incasso</th>
                  <th>Importo Totale</th>
                  <th>Residuo</th>
                  <th>Azioni</th>
                </tr>
              </thead>
              <tbody>
                {#each adminUndistributedPayments as p}
                  <tr>
                    <td><strong>{p.clientName}</strong></td>
                    <td>{formatDate(p.date)}</td>
                    <td>€ {p.amount.toFixed(2)}</td>
                    <td><strong style="color: var(--color-warning-text);">€ {(p.remainingToDistribute || 0).toFixed(2)}</strong></td>
                    <td>
                      <button onclick={() => goto(`/dashboard/payments/${p.id}`)} class="approve-collect-btn" style="padding: 4px 10px; font-size: 11px;">
                        Gestisci
                      </button>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      </Card>

      <!-- 4. Bozze Provvigionali -->
      <Card title="Bozze Provvigionali (Da Approvare)" description="Mesi provvigionali attualmente in bozza, in attesa di approvazione per la chiusura.">
        {#snippet icon()}
          <FileText size={20} class="icon-warning-accent" style="color: var(--color-warning);" />
        {/snippet}

        {#if adminPendingCommissions.length === 0}
          <div class="empty-panel">Nessuna bozza provvigionale da approvare.</div>
        {:else}
          <div class="table-wrapper">
            <table class="widescreen-table admin-table">
              <thead>
                <tr>
                  <th>Periodo</th>
                  <th>Data Creazione</th>
                  <th>Azioni</th>
                </tr>
              </thead>
              <tbody>
                {#each adminPendingCommissions as c}
                  <tr>
                    <td><strong>{c.id.replace('_', '/')}</strong></td>
                    <td>{c.updatedAt ? formatDate(c.updatedAt) : '-'}</td>
                    <td>
                      <button onclick={() => goto(`/dashboard/commissions`)} class="approve-collect-btn" style="padding: 4px 10px; font-size: 11px;">
                        Gestisci
                      </button>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      </Card>

      <!-- 5. Provvigioni Da Pagare -->
      <Card title="Provvigioni Da Pagare" description="Mesi provvigionali approvati ma non ancora liquidati ai consulenti.">
        {#snippet icon()}
          <Banknote size={20} class="icon-success-accent" style="color: var(--color-success);" />
        {/snippet}

        {#if adminFinalizedCommissions.length === 0}
          <div class="empty-panel">Nessuna provvigione in attesa di pagamento.</div>
        {:else}
          <div class="table-wrapper">
            <table class="widescreen-table admin-table">
              <thead>
                <tr>
                  <th>Periodo</th>
                  <th>Approvata il</th>
                  <th>Totale da Pagare</th>
                  <th>Azioni</th>
                </tr>
              </thead>
              <tbody>
                {#each adminFinalizedCommissions as c}
                  <tr style="background-color: var(--color-success-light);">
                    <td><strong>{c.id.replace('_', '/')}</strong></td>
                    <td>{c.updatedAt ? formatDate(c.updatedAt) : '-'}</td>
                    <td><strong>€ {(c.totalToPay || 0).toFixed(2)}</strong></td>
                    <td>
                      <button onclick={() => onMarkCommissionPaid(c.id)} class="approve-collect-btn" style="padding: 4px 10px; font-size: 11px; background: var(--color-success); border-color: var(--color-success);">
                        Segna come Pagato
                      </button>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      </Card>
    </div>
  </div>

  <!-- Right Column: KPIs -->
  <div class="dashboard-right-col">
    <div class="kpi-deck">
      <KPITile 
        theme="warning" 
        icon={Clock} 
        title="Da Approvare" 
        value={adminPendingContracts.length} 
        subtitle="Contratti in attesa" 
      />

      <KPITile 
        theme="error" 
        icon={AlertTriangle} 
        title="Rate Overdue" 
        value={adminOverdueInstallments.length} 
        subtitle="Scadenze insolute" 
      />

      <KPITile 
        theme="info" 
        icon={CreditCard} 
        title="Incassi da Distribuire" 
        value={'€ ' + adminUndistributedPayments.reduce((acc, p) => acc + (p.remainingToDistribute || 0), 0).toFixed(2)} 
        subtitle={`${adminUndistributedPayments.length} incassi in sospeso`} 
      />

      <KPITile 
        theme="success" 
        icon={Banknote} 
        title="Provv. da Pagare" 
        value={adminFinalizedCommissions.length} 
        subtitle="Mesi in attesa di saldo" 
      />
    </div>
  </div>
</div>

<style>
  .dashboard-main-split {
    display: flex;
    flex-direction: row;
    gap: 32px;
    margin-top: 24px;
    align-items: flex-start;
  }

  .dashboard-left-col {
    flex: 1;
    min-width: 0;
  }

  .dashboard-right-col {
    width: 280px;
    flex-shrink: 0;
  }

  @media (max-width: 992px) {
    .dashboard-main-split {
      flex-direction: column;
    }
    .dashboard-right-col {
      width: 100%;
    }
  }

  .kpi-deck {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .empty-panel {
    padding: 30px;
    text-align: center;
    color: var(--color-neutral-400);
    background: var(--color-neutral-50);
    border-radius: var(--radius-md);
    font-size: 13.5px;
    font-weight: 500;
  }

  .admin-table th, .admin-table td {
    padding: 10px 14px;
  }

  .approve-collect-btn {
    background: var(--color-primary-500);
    color: var(--color-white);
    border: none;
    border-radius: var(--radius-sm);
    font-family: inherit;
    font-size: 12.5px;
    font-weight: 600;
    cursor: pointer;
    transition: opacity 0.2s;
    box-shadow: 0 2px 6px hsla(var(--brand-h), var(--brand-s), var(--brand-l), 0.15);
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .approve-collect-btn:hover {
    opacity: 0.9;
  }
</style>
