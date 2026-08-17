<script lang="ts">
  import { onMount } from 'svelte';
  import { FileText, Eye, Plus, ExternalLink } from '@lucide/svelte';

  let { projectId, clientId }: { projectId?: string; clientId?: string } = $props();

  export const bridgeMetadata = {
    id: 'contracts',
    sourceModule: 'contracts',
    label: 'Preventivi & Contratti'
  };

  let contractsList = $state<any[]>([]);
  let loading = $state(true);

  onMount(async () => {
    try {
      if (projectId) {
        let list: any[] = [];
        try {
          const mod = await import('../../../../contracts/files/ContractService');
          if (mod?.ContractService) {
            list = await mod.ContractService.getProjectContracts(projectId);
          }
        } catch (err) {
            console.warn('Modulo contracts non disponibile per ProjectContractsTab', err);
          }

        contractsList = list;
      }
    } catch (e) {
      console.error('Errore caricamento contratti collegati al progetto:', e);
    } finally {
      loading = false;
    }
  });

  function formatCurrency(val: number): string {
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(val || 0);
  }
</script>

<div class="project-contracts-bridge-tab">
  <div class="bridge-header-row">
    <div class="bridge-header-info">
      <h4 class="bridge-title">Preventivi & Contratti Collegati</h4>
      <p class="bridge-sub">Gestisci i contratti di lavoro, accordi e preventivi associati a questo contenitore.</p>
    </div>
    <a 
      href="/dashboard/contracts/add?projectId={projectId || ''}&clientId={clientId || ''}" 
      class="btn-create-contract"
    >
      <Plus size={16} />
      <span>Nuovo Contratto</span>
    </a>
  </div>

  {#if loading}
    <p class="loading-text">Caricamento contratti collegati...</p>
  {:else if contractsList.length === 0}
    <div class="empty-bridge">
      <div class="empty-icon-circle">
        <FileText size={32} />
      </div>
      <h5 class="empty-title">Nessun Contratto Collegato</h5>
      <p class="empty-desc">Non è ancora presente alcun contratto o preventivo associato a questo cantiere/progetto.</p>
      <a 
        href="/dashboard/contracts/add?projectId={projectId || ''}&clientId={clientId || ''}" 
        class="btn-create-contract-empty"
      >
        <Plus size={16} />
        <span>Crea Primo Contratto per questo Cantiere</span>
      </a>
    </div>
  {:else}
    <div class="contracts-bridge-table-box">
      <table class="bridge-table">
        <thead>
          <tr>
            <th>NUMERO CONTRATTO</th>
            <th>TITOLO</th>
            <th>TIPOLOGIA</th>
            <th>STATO</th>
            <th>IMPORTO TOTALE</th>
            <th class="text-right">AZIONI</th>
          </tr>
        </thead>
        <tbody>
          {#each contractsList as ctr}
            <tr>
              <td class="font-mono font-bold">
                <a href="/dashboard/contracts/{ctr.id}" class="code-link">
                  {ctr.contractNumber || ctr.number || ctr.id}
                </a>
              </td>
              <td class="font-medium text-neutral-800">{ctr.title || 'Senza Titolo'}</td>
              <td>{ctr.type || 'Non Ricorrente'}</td>
              <td>
                <span class="status-chip status-{ctr.status || 'bozza'}">
                  {ctr.status || 'bozza'}
                </span>
              </td>
              <td class="font-bold text-primary">{formatCurrency(ctr.totalAmount ?? ctr.original?.totalPrice ?? 0)}</td>
              <td class="text-right">
                <a href="/dashboard/contracts/{ctr.id}" class="action-btn" title="Vedi Dettaglio Contratto">
                  <Eye size={15} />
                  <span>Apri</span>
                </a>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>

<style>
  .project-contracts-bridge-tab {
    padding: 8px 0;
  }

  .bridge-header-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 20px;
    padding-bottom: 14px;
    border-bottom: 1px solid var(--color-neutral-200);
  }

  .bridge-title {
    font-size: var(--font-size-md, 15px);
    font-weight: 700;
    color: var(--color-neutral-900);
    margin: 0 0 2px 0;
  }

  .bridge-sub {
    font-size: var(--font-size-xs, 12px);
    color: var(--color-neutral-500);
    margin: 0;
  }

  .btn-create-contract {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    border-radius: var(--radius-md, 8px);
    background-color: var(--color-primary-600);
    color: white;
    font-size: var(--font-size-xs, 12px);
    font-weight: 600;
    text-decoration: none;
    transition: all 0.2s ease;
    box-shadow: 0 2px 4px rgba(37, 99, 235, 0.15);
  }

  .btn-create-contract:hover {
    background-color: var(--color-primary-700);
    box-shadow: 0 4px 10px rgba(37, 99, 235, 0.25);
  }

  .contracts-bridge-table-box {
    width: 100%;
    overflow-x: auto;
    border: 1px solid var(--color-neutral-200);
    border-radius: var(--radius-lg, 10px);
  }

  .bridge-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }

  .bridge-table th {
    text-align: left;
    padding: 12px 14px;
    background: var(--color-neutral-50);
    color: var(--color-neutral-600);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.03em;
    border-bottom: 1px solid var(--color-neutral-200);
  }

  .bridge-table td {
    padding: 12px 14px;
    border-bottom: 1px solid var(--color-neutral-100);
    vertical-align: middle;
  }

  .bridge-table tr:last-child td {
    border-bottom: none;
  }

  .code-link {
    color: var(--color-primary-600);
    text-decoration: none;
    font-weight: 600;
  }

  .code-link:hover {
    text-decoration: underline;
  }

  .status-chip {
    display: inline-block;
    padding: 3px 10px;
    border-radius: 9999px;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.02em;
  }

  .status-attivo { background: #dcfce7; color: #15803d; }
  .status-bozza { background: #f3f4f6; color: #4b5563; }
  .status-completato { background: #dbeafe; color: #1e40af; }
  .status-annullato { background: #fee2e2; color: #b91c1c; }

  .action-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 5px 10px;
    border-radius: var(--radius-md, 8px);
    background: var(--color-neutral-100);
    color: var(--color-neutral-700);
    font-size: 12px;
    font-weight: 600;
    text-decoration: none;
    transition: background 0.15s ease;
  }

  .action-btn:hover {
    background: var(--color-primary-50);
    color: var(--color-primary-700);
  }

  .empty-bridge {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 48px 24px;
    text-align: center;
    background: var(--color-neutral-50);
    border: 1px dashed var(--color-neutral-300);
    border-radius: var(--radius-xl, 12px);
  }

  .empty-icon-circle {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    background-color: var(--color-neutral-200);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-neutral-500);
    margin-bottom: 16px;
  }

  .empty-title {
    font-size: var(--font-size-md, 15px);
    font-weight: 700;
    color: var(--color-neutral-800);
    margin: 0 0 6px 0;
  }

  .empty-desc {
    font-size: var(--font-size-xs, 12px);
    color: var(--color-neutral-500);
    margin: 0 0 20px 0;
    max-width: 360px;
  }

  .btn-create-contract-empty {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 20px;
    border-radius: var(--radius-lg, 10px);
    background-color: var(--color-primary-600);
    color: white;
    font-size: var(--font-size-xs, 12px);
    font-weight: 700;
    text-decoration: none;
    box-shadow: 0 4px 12px rgba(37, 99, 235, 0.2);
    transition: all 0.2s ease;
  }

  .btn-create-contract-empty:hover {
    background-color: var(--color-primary-700);
    transform: translateY(-1px);
    box-shadow: 0 6px 16px rgba(37, 99, 235, 0.3);
  }

  .text-right { text-align: right; }
  .text-neutral-800 { color: var(--color-neutral-800); }
  .text-primary { color: var(--color-primary-700); }
</style>
