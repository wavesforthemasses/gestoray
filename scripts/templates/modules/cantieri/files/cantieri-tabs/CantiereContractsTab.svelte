<script lang="ts">
  import { onMount } from 'svelte';
  import { db, collection, getDocs, query, where } from '$lib/firebase';
  import { FileText, Eye, CheckCircle2, AlertTriangle } from '@lucide/svelte';

  let { cantiereId, clientId }: { cantiereId?: string; clientId?: string } = $props();

  export const bridgeMetadata = {
    id: 'contracts',
    sourceModule: 'contracts',
    label: 'Contratti & Preventivi Collegati'
  };

  let contractsList = $state<any[]>([]);
  let loading = $state(true);

  onMount(async () => {
    try {
      if (clientId) {
        const snap = await getDocs(query(collection(db, 'contracts'), where('clientId', '==', clientId)));
        const list: any[] = [];
        snap.forEach(d => {
          list.push({ id: d.id, ...d.data() });
        });
        contractsList = list;
      }
    } catch (e) {
      console.error('Errore caricamento contratti collegati al cantiere:', e);
    } finally {
      loading = false;
    }
  });

  function formatCurrency(val: number): string {
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(val || 0);
  }
</script>

<div class="cantiere-contracts-bridge-tab">
  {#if loading}
    <p class="loading-text">Caricamento contratti collegati...</p>
  {:else if contractsList.length === 0}
    <div class="empty-bridge">
      <FileText size={36} color="var(--color-neutral-400)" />
      <p>Nessun contratto o preventivo associato al cliente di questo cantiere.</p>
    </div>
  {:else}
    <div class="contracts-bridge-table-box">
      <table class="bridge-table">
        <thead>
          <tr>
            <th>NUMERO CONTRATTO</th>
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
                  {ctr.number || ctr.id}
                </a>
              </td>
              <td>{ctr.type || 'Non Ricorrente'}</td>
              <td>
                <span class="status-chip {ctr.status}">
                  {ctr.status || 'bozza'}
                </span>
              </td>
              <td class="font-bold">{formatCurrency(ctr.totalAmount ?? ctr.original?.totalPrice ?? 0)}</td>
              <td class="text-right">
                <a href="/dashboard/contracts/{ctr.id}" class="action-btn" title="Vedi Contratto">
                  <Eye size={16} />
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
  .cantiere-contracts-bridge-tab {
    padding: 10px 0;
  }
  .contracts-bridge-table-box {
    width: 100%;
    overflow-x: auto;
  }
  .bridge-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }
  .bridge-table th {
    background: var(--color-neutral-50);
    padding: 10px 14px;
    text-align: left;
    font-size: 11px;
    font-weight: 600;
    color: var(--color-neutral-500);
    border-bottom: 1px solid var(--color-neutral-200);
  }
  .bridge-table td {
    padding: 12px 14px;
    border-bottom: 1px solid var(--color-neutral-100);
  }
  .code-link {
    color: var(--color-primary-600);
    text-decoration: none;
  }

  .status-chip {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
  }
  .status-chip.approvato { background: #dcfce7; color: #15803d; }
  .status-chip.in_attesa { background: #fef3c7; color: #d97706; }
  .status-chip.bozza { background: #f1f5f9; color: #475569; }

  .action-btn {
    color: var(--color-neutral-500);
    padding: 4px;
  }
  .action-btn:hover { color: var(--color-primary-600); }

  .empty-bridge {
    text-align: center;
    padding: 24px;
    color: var(--color-neutral-500);
  }
  .loading-text {
    font-size: 13px;
    color: var(--color-neutral-500);
  }
</style>
