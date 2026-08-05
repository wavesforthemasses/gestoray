<script lang="ts">
  import { onMount } from 'svelte';
  import { db, collection, getDocs, query, where } from '$lib/firebase';
  import { FileText, Eye, CheckCircle2, AlertTriangle } from '@lucide/svelte';

  let { projectId, clientId }: { projectId?: string; clientId?: string } = $props();

  export const bridgeMetadata = {
    id: 'contracts',
    sourceModule: 'contracts',
    label: 'Contratti & Preventivi Collegati'
  };

  let contractsList = $state<any[]>([]);
  let loading = $state(true);

  onMount(async () => {
    try {
      if (projectId) {
        // Query contracts explicitly linked to this project container
        const snap = await getDocs(query(collection(db, 'contracts'), where('projectId', '==', projectId)));
        const list: any[] = [];
        snap.forEach(d => {
          list.push({ id: d.id, ...d.data() });
        });

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
  {#if loading}
    <p class="loading-text">Caricamento contratti collegati...</p>
  {:else if contractsList.length === 0}
    <div class="empty-bridge">
      <FileText size={36} color="var(--color-neutral-400)" />
      <p>Nessun contratto o preventivo associato a questo progetto / contenitore.</p>
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
                  {ctr.number || ctr.contractNumber || ctr.id}
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
  .project-contracts-bridge-tab {
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
    text-align: left;
    padding: 10px 12px;
    background: var(--color-neutral-100);
    color: var(--color-neutral-600);
    font-size: 11px;
    font-weight: 600;
  }
  .bridge-table td {
    padding: 10px 12px;
    border-bottom: 1px solid var(--color-neutral-200);
  }
  .code-link {
    color: var(--color-primary-600);
    text-decoration: none;
  }
  .status-chip {
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    background: var(--color-neutral-100);
  }
  .empty-bridge {
    text-align: center;
    padding: 30px;
    color: var(--color-neutral-500);
  }
</style>
