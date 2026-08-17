<script lang="ts">
  import { onMount } from 'svelte';
  import { PlacesService } from '../places.service';
  import { UserCheck, Award, Clock, Briefcase, UserX } from '@lucide/svelte';

  let { placeId }: { placeId?: string } = $props();

  let loading = $state(true);

  let firstAgent = $state<{ name: string; date?: string; source?: string } | null>(null);
  let topSalesAgent = $state<{ name: string; totalAmount: number; contractCount: number } | null>(null);
  let latestAgent = $state<{ name: string; date?: string; source?: string } | null>(null);

  onMount(async () => {
    try {
      if (!placeId) return;

      const { contractsSnap, activitiesSnap } = await PlacesService.getCommercialInsights(placeId);

      const events: { agentName: string; date: string; amount: number; source: 'contract' | 'activity' }[] = [];
      const agentTotals: Record<string, { totalAmount: number; count: number }> = {};

      if (contractsSnap && !contractsSnap.empty) {
        contractsSnap.forEach((d: any) => {
          const data = d.data();
          const agentName = data.agentName || (data.agentId ? `Agente #${data.agentId}` : '');
          if (agentName) {
            const date = data.createdAt || data.startDate || '';
            const amount = data.grandTotalAmount || 0;
            events.push({ agentName, date, amount, source: 'contract' });

            if (!agentTotals[agentName]) {
              agentTotals[agentName] = { totalAmount: 0, count: 0 };
            }
            agentTotals[agentName].totalAmount += amount;
            agentTotals[agentName].count += 1;
          }
        });
      }

      if (activitiesSnap && !activitiesSnap.empty) {
        activitiesSnap.forEach((d: any) => {
          const data = d.data();
          let agentName = data.assignedName || '';
          if (!agentName && Array.isArray(data.assignedEntities)) {
            const userEntity = data.assignedEntities.find((e: any) => e.type === 'user' || e.entityType === 'user');
            if (userEntity) agentName = userEntity.name || userEntity.entityName || '';
          }
          if (agentName) {
            const date = data.scheduledDate || data.executionDate || data.createdAt || '';
            events.push({ agentName, date, amount: 0, source: 'activity' });
          }
        });
      }

      if (events.length > 0) {
        // Sort chronologically (oldest first)
        events.sort((a, b) => a.date.localeCompare(b.date));

        // Primo Commerciale
        const first = events[0];
        firstAgent = {
          name: first.agentName,
          date: first.date ? new Date(first.date).toLocaleDateString('it-IT') : 'Data n.d.',
          source: first.source === 'contract' ? 'Contratto' : 'Attività'
        };

        // Commerciale Più Recente
        const latest = events[events.length - 1];
        latestAgent = {
          name: latest.agentName,
          date: latest.date ? new Date(latest.date).toLocaleDateString('it-IT') : 'Data n.d.',
          source: latest.source === 'contract' ? 'Contratto' : 'Attività'
        };

        // Commerciale Top Sales
        let topAgentName = '';
        let maxAmount = -1;
        let topCount = 0;

        Object.entries(agentTotals).forEach(([name, stat]) => {
          if (stat.totalAmount > maxAmount) {
            maxAmount = stat.totalAmount;
            topAgentName = name;
            topCount = stat.count;
          }
        });

        if (topAgentName && maxAmount >= 0) {
          topSalesAgent = {
            name: topAgentName,
            totalAmount: maxAmount,
            contractCount: topCount
          };
        }
      }
    } catch (e) {
      console.warn('Errore calcolo commerciali per il cantiere:', e);
    } finally {
      loading = false;
    }
  });

  function formatCurrency(val: number): string {
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(val || 0);
  }
</script>

{#if !loading}
  <div class="info-card commercial-insights-card">
    <h3 class="card-title">
      <Briefcase size={18} /> Agenti di Riferimento
    </h3>

    {#if !(firstAgent || topSalesAgent || latestAgent)}
      <div class="empty-commercial-insight">
        <UserX size={28} class="empty-agent-icon" />
        <p class="empty-title">Nessun agente o referente registrato per questo cantiere</p>
        <span class="empty-sub">Associa contratti o attività a questo cantiere per identificare automaticamente il primo commerciale, il top seller ed il referente più recente.</span>
      </div>
    {:else}
      <div class="insights-grid">
        {#if firstAgent}
          <div class="insight-box">
            <div class="insight-header">
              <UserCheck size={16} class="icon-first" />
              <span class="insight-label">Primo Commerciale</span>
            </div>
            <p class="insight-value">{firstAgent.name}</p>
            <span class="insight-sub">{firstAgent.source} del {firstAgent.date}</span>
          </div>
        {/if}

        {#if topSalesAgent}
          <div class="insight-box highlight-box">
            <div class="insight-header">
              <Award size={16} class="icon-top" />
              <span class="insight-label">Top Sales (Maggior Venduto)</span>
            </div>
            <p class="insight-value">{topSalesAgent.name}</p>
            <span class="insight-sub">{formatCurrency(topSalesAgent.totalAmount)} ({topSalesAgent.contractCount} contratti)</span>
          </div>
        {/if}

        {#if latestAgent}
          <div class="insight-box">
            <div class="insight-header">
              <Clock size={16} class="icon-latest" />
              <span class="insight-label">Commerciale Più Recente</span>
            </div>
            <p class="insight-value">{latestAgent.name}</p>
            <span class="insight-sub">{latestAgent.source} del {latestAgent.date}</span>
          </div>
        {/if}
      </div>
    {/if}
  </div>
{/if}

<style>
  .commercial-insights-card {
    background: #ffffff !important;
    border: 1px solid var(--color-neutral-200) !important;
    border-radius: 12px;
    padding: 20px;
    margin-bottom: 20px;
  }

  .card-title {
    font-size: 15px;
    font-weight: 700;
    margin: 0 0 16px 0;
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--color-neutral-900);
  }

  .empty-commercial-insight {
    text-align: center;
    padding: 24px 16px;
    background: var(--color-neutral-50, #f8fafc);
    border: 1px dashed var(--color-neutral-300);
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
  }

  :global(.empty-agent-icon) {
    color: var(--color-neutral-400);
    margin-bottom: 4px;
  }

  .empty-title {
    font-size: 13px;
    font-weight: 700;
    color: var(--color-neutral-700);
    margin: 0;
  }

  .empty-sub {
    font-size: 12px;
    color: var(--color-neutral-500);
    max-width: 440px;
    line-height: 1.4;
  }

  .insights-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 12px;
  }

  .insight-box {
    background: var(--color-neutral-50, #f8fafc);
    border: 1px solid var(--color-neutral-200);
    border-radius: 10px;
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .highlight-box {
    background: #f0fdf4;
    border-color: #bbf7d0;
  }

  .insight-header {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 2px;
  }

  :global(.icon-first) { color: #2563eb; }
  :global(.icon-top) { color: #16a34a; }
  :global(.icon-latest) { color: #d97706; }

  .insight-label {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    color: var(--color-neutral-500);
  }

  .insight-value {
    font-size: 14px;
    font-weight: 700;
    color: var(--color-neutral-900);
    margin: 0;
  }

  .insight-sub {
    font-size: 11px;
    color: var(--color-neutral-500);
  }
</style>
