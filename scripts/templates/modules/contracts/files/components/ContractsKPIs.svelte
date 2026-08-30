<script lang="ts">
  import { Award, Clock } from '@lucide/svelte';
  import { activeRoleState } from '$lib/auth.svelte';

  interface Props {
    commercialStats: {
      sospese: number;
      maturate: number;
      totalVenduto: number;
    };
  }

  let { commercialStats } = $props();
</script>

{#if activeRoleState.role === 'commerciale'}
  <div class="stats-row animate-fade-in">
    <div class="stat-card border-success">
      <div class="stat-icon success">
        <Award size={22} />
      </div>
      <div class="stat-body">
        <span class="stat-lbl">Provvigioni Maturate (Incassate)</span>
        <span class="stat-val">€ {(Number(commercialStats?.maturate) || 0).toFixed(2)}</span>
        <span class="stat-sub">Fatturato incassato: € {(Number(commercialStats?.totalVenduto) || 0).toFixed(2)}</span>
      </div>
    </div>

    <div class="stat-card border-warning">
      <div class="stat-icon warning">
        <Clock size={22} />
      </div>
      <div class="stat-body">
        <span class="stat-lbl">Provvigioni Sospese (In Attesa)</span>
        <span class="stat-val">€ {(Number(commercialStats?.sospese) || 0).toFixed(2)}</span>
        <span class="stat-sub">Visualizzato non appena l'amministrazione approva l'incasso.</span>
      </div>
    </div>
  </div>
{/if}

<style>
  .stats-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
    margin-bottom: 30px;
  }

  @media (max-width: 768px) {
    .stats-row {
      grid-template-columns: 1fr;
    }
  }

  .stat-card {
    background: var(--color-white);
    border: 1px solid var(--color-neutral-200);
    border-radius: var(--radius-lg);
    padding: 24px;
    display: flex;
    gap: 20px;
    align-items: center;
    box-shadow: var(--shadow-sm);
    border-left: 5px solid var(--color-secondary-500);
  }

  .border-success { border-left-color: var(--color-success-500); }
  .border-warning { border-left-color: var(--color-warning-500); }

  .stat-icon {
    width: 48px;
    height: 48px;
    border-radius: var(--radius-md);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .stat-icon.success {
    background: var(--color-success-100);
    color: var(--color-success-700);
  }
  .stat-icon.warning {
    background: var(--color-warning-100);
    color: var(--color-warning-700);
  }

  .stat-body {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .stat-lbl {
    font-size: 12px;
    font-weight: 600;
    color: var(--color-neutral-500);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .stat-val {
    font-size: 22px;
    font-weight: 700;
  }

  .stat-sub {
    font-size: 11px;
    color: var(--color-neutral-400);
  }

  .animate-fade-in {
    animation: fadeIn 0.3s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  }
</style>
