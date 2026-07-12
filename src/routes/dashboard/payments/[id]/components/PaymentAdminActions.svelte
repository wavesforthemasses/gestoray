<script lang="ts">
  import { Card } from '$lib';
  import { ShieldAlert, Trash2 } from '@lucide/svelte';

  interface Props {
    activeRole: string;
    submitting: boolean;
    onDeletePayment: () => void;
  }

  let { activeRole, submitting, onDeletePayment } = $props();
</script>

{#if activeRole === 'superadmin' || activeRole === 'amministrazione'}
  <Card title="Zona Pericolo: Storno / Eliminazione" description="L'eliminazione di questo incasso è irreversibile e comporterà lo storno dei relativi crediti dai contratti.">
    {#snippet icon()}
      <ShieldAlert size={20} style="color: var(--color-error);" />
    {/snippet}

    <div class="vertical-layout-stack">
      <p class="danger-desc">
        Se questo incasso è stato inserito erroneamente, puoi stornarlo cliccando sul pulsante sottostante. 
        Tutti i contratti associati vedranno il proprio importo pagato ridursi e, se precedentemente approvati grazie a questo pagamento, torneranno in stato <strong>pending</strong>.
      </p>
      <button 
        onclick={onDeletePayment} 
        class="danger-btn" 
        disabled={submitting}
      >
        <Trash2 size={16} /> Elimina ed Storna questo Incasso
      </button>
    </div>
  </Card>
{/if}

<style>
  .vertical-layout-stack {
    display: flex;
    flex-direction: column;
    gap: 12px;
    align-items: flex-start;
  }

  .danger-desc {
    font-size: 13px;
    color: var(--color-neutral-500);
    margin: 0;
  }

  .danger-desc strong {
    color: var(--color-neutral-800);
  }

  .danger-btn {
    background: var(--color-error);
    color: var(--color-white);
    border: none;
    padding: 12px 24px;
    border-radius: var(--radius-md);
    font-family: inherit;
    font-weight: 600;
    font-size: 14px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    box-shadow: 0 4px 12px rgba(239, 68, 68, 0.2);
    transition: opacity 0.2s;
  }

  .danger-btn:hover {
    opacity: 0.9;
  }

  .danger-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
</style>
