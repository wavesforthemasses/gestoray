<script lang="ts">
  import { Card } from '$lib';
  import { History, CheckCircle2, Trash2 } from '@lucide/svelte';
  import { formatDateTime } from '$lib/utils/formatters';

  interface Props {
    versions: any[];
    onSelectVersion: (v: any) => void;
    onDeleteVersion: (e: Event, v: any) => void;
  }

  let { versions, onSelectVersion, onDeleteVersion } = $props();
</script>

<div class="panel-history">
  <Card title="Storico Versioni" description="Versioni salvate per questo mese." class="history-card">
    {#snippet icon()}
      <History size={20} class="icon-accent" />
    {/snippet}
    <div class="versions-list-top">
      {#each versions as v, i}
        <div 
          role="button"
          tabindex="0"
          onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelectVersion(v) }}
          class="version-item-top" 
          class:finalized={v.status === 'finalized'}
          onclick={() => onSelectVersion(v)}
        >
          <div class="v-header-top">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span class="v-num">Versione {versions.length - i}</span>
              {#if v.status === 'finalized'}
                <CheckCircle2 size={14} class="v-icon-success" />
              {/if}
            </div>
            <button 
              class="del-v-btn" 
              title="Elimina Versione" 
              onclick={(e) => onDeleteVersion(e, v)}
              style="background: transparent; border: none; color: var(--color-error); cursor: pointer; padding: 4px; display: flex; align-items: center; border-radius: 4px;"
            >
              <Trash2 size={14} />
            </button>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: flex-end;">
            <div>
              <div class="v-date">{formatDateTime(v.generatedAt)}</div>
              <div class="v-mode">Metodo: {v.calculationMode === 'historical' ? 'Storico' : 'Attuale'}</div>
            </div>
            <div class="v-total">€ {v.totalCommissions?.toFixed(2)}</div>
          </div>
        </div>
      {/each}
    </div>
  </Card>
</div>

<style>
  :global(.icon-accent) {
    color: var(--color-primary-500);
  }

  .panel-history {
    flex: 1;
    min-width: 300px;
    max-height: 250px;
  }

  :global(.history-card .card-content) {
    padding: 0 !important;
  }

  .versions-list-top {
    display: flex;
    flex-direction: column;
    max-height: 200px;
    overflow-y: auto;
  }

  .version-item-top {
    background: transparent;
    border: none;
    border-bottom: 1px solid var(--color-neutral-100);
    padding: 12px 16px;
    text-align: left;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .version-item-top:last-child {
    border-bottom: none;
  }

  .version-item-top:hover {
    background: var(--color-neutral-50);
  }

  .version-item-top.finalized {
    border-left: 3px solid var(--color-success);
  }

  .v-header-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .v-num {
    font-weight: 600;
  }

  .v-icon-success {
    color: var(--color-success);
  }

  .v-date {
    font-size: 12px;
    color: var(--color-neutral-600);
  }

  .v-mode {
    font-size: 11px;
    color: var(--color-neutral-400);
  }

  .v-total {
    font-weight: 700;
    color: var(--color-primary-600);
  }
  
  .del-v-btn:hover {
    background: var(--color-error-light) !important;
  }
</style>
