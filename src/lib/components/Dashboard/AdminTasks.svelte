<script lang="ts">
  import { Card, KPITile, Button } from "$lib";
  import { Clock, AlertTriangle, CreditCard, Banknote, FileText } from "@lucide/svelte";
  import { formatDate } from "$lib/utils/formatters";
  import { menuConfigStore } from "$lib/stores/menu";

  let { 
    adminPendingContracts = [],
    adminOverdueInstallments = [],
    adminUndistributedPayments = [],
    adminPendingCommissions = [],
    adminFinalizedCommissions = [],
    onMarkCommissionPaid = () => {}
  } = $props<{
    adminPendingContracts?: any[];
    adminOverdueInstallments?: any[];
    adminUndistributedPayments?: any[];
    adminPendingCommissions?: any[];
    adminFinalizedCommissions?: any[];
    onMarkCommissionPaid?: (id: string) => void;
  }>();

  const activeModuleIds = $derived($menuConfigStore.map(m => m.id));
  const hasContracts = $derived(activeModuleIds.includes('contracts'));
  const hasPayments = $derived(activeModuleIds.includes('payments'));
  const hasCommissions = $derived(activeModuleIds.includes('commissions') || activeModuleIds.includes('my-commissions'));
</script>

<div class="dashboard-main-split">
  <!-- Left Column: Tables -->
  <div class="dashboard-left-col">
    <div class="admin-table-stack">
      {#if hasContracts}
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
                        <Button href={`/dashboard/contracts/${c.id}`} size="sm">
                          Gestisci
                        </Button>
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {/if}
        </Card>
      {/if}

      {#if hasPayments}
        <!-- 2. Scadenziario Recupero Crediti -->
        <Card title="Scadenziario Recupero Crediti" description="Elenco delle rate insolute e dei pagamenti in ritardo.">
          {#if adminOverdueInstallments.length === 0}
            <div class="empty-panel">Nessuna rata scaduta rilevata.</div>
          {:else}
            <div class="table-wrapper">
              <table class="widescreen-table admin-table">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Scadenza</th>
                    <th>Importo Rata</th>
                  </tr>
                </thead>
                <tbody>
                  {#each adminOverdueInstallments as inst}
                    <tr>
                      <td><strong>{inst.clientName || 'Cliente'}</strong></td>
                      <td><span class="warning-text">{formatDate(inst.dueDate)}</span></td>
                      <td><strong>€ {(inst.amount || 0).toFixed(2)}</strong></td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {/if}
        </Card>

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
                      <td><strong class="warning-text">€ {(p.remainingToDistribute || 0).toFixed(2)}</strong></td>
                      <td>
                        <Button href={`/dashboard/payments/${p.id}`} size="sm">
                          Gestisci
                        </Button>
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {/if}
        </Card>
      {/if}

      {#if hasCommissions}
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
                        <Button href={`/dashboard/commissions`} size="sm">
                          Gestisci
                        </Button>
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
                    <tr class="success-row">
                      <td><strong>{c.id.replace('_', '/')}</strong></td>
                      <td>{c.updatedAt ? formatDate(c.updatedAt) : '-'}</td>
                      <td><strong>€ {(c.totalToPay || 0).toFixed(2)}</strong></td>
                      <td>
                        <Button onclick={() => onMarkCommissionPaid(c.id)} variant="success" size="sm">
                          Segna come Pagato
                        </Button>
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {/if}
        </Card>
      {/if}
    </div>
  </div>

  <!-- Right Column: KPIs -->
  <div class="dashboard-right-col">
    <div class="kpi-deck">
      {#if hasContracts}
        <KPITile 
          theme="warning" 
          icon={Clock} 
          title="Da Approvare" 
          value={adminPendingContracts.length} 
          subtitle="Contratti in attesa" 
        />
      {/if}

      {#if hasPayments}
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
          value={'€ ' + adminUndistributedPayments.reduce((acc: any, p: any) => acc + (p.remainingToDistribute || 0), 0).toFixed(2)} 
          subtitle={`${adminUndistributedPayments.length} incassi in sospeso`} 
        />
      {/if}

      {#if hasCommissions}
        <KPITile 
          theme="success" 
          icon={Banknote} 
          title="Provv. da Pagare" 
          value={adminFinalizedCommissions.length} 
          subtitle="Mesi in attesa di saldo" 
        />
      {/if}
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

  .admin-table-stack {
    display: flex;
    flex-direction: column;
    gap: 24px;
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

  .warning-text {
    color: var(--color-warning-text);
  }

  .success-row {
    background-color: var(--color-success-light);
  }
</style>
