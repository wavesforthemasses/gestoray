<script lang="ts">
  interface Props {
    status: string;
    label?: string;
    type?: string;
  }

  let { status, label, type = 'general' }: Props = $props();

  let displayLabel = $derived(
    label || (
      status === 'approved' ? 'Approvato' :
      status === 'pending' ? 'In attesa' :
      status === 'paid' ? 'Pagato' :
      status === 'overdue' ? 'Scaduto' :
      status === 'rejected' ? 'Rifiutato' :
      status === 'prospect' ? 'Prospect' :
      status === 'contacted' ? 'Contattato' :
      status === 'proposal_sent' ? 'Preventivo' :
      status === 'customer' ? 'Cliente' :
      status === 'churned' ? 'Perso' :
      status
    )
  );
</script>

<span class="status-badge status-{status} type-{type}">
  {displayLabel}
</span>

<style>
  .status-badge {
    font-size: 11px;
    font-weight: 600;
    padding: 3px 8px;
    border-radius: var(--radius-sm);
    text-transform: uppercase;
    letter-spacing: 0.02em;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    white-space: nowrap;
  }

  .status-badge.status-approved, .status-badge.status-paid, .status-badge.status-completata {
    background: var(--color-success-light, hsla(140, 100%, 94%, 1));
    color: var(--color-success-text, hsla(140, 100%, 25%, 1));
  }

  .status-badge.status-pending, .status-badge.status-bozza, .status-badge.status-bozza {
    background: var(--color-warning-light, hsla(35, 100%, 94%, 1));
    color: var(--color-warning-text, hsla(35, 100%, 30%, 1));
  }

  .status-badge.status-overdue, .status-badge.status-rejected {
    background: var(--color-error-light, hsla(0, 100%, 95%, 1));
    color: var(--color-error-text, hsla(0, 100%, 35%, 1));
  }

  .status-badge.status-draft, .status-badge.status-prospect {
    background: var(--color-neutral-100);
    color: var(--color-neutral-600);
  }

  .status-badge.status-contacted {
    background: hsla(200, 100%, 96%, 1);
    color: var(--color-info-600, #0284c7);
  }

  .status-badge.status-proposal_sent {
    background: hsla(270, 100%, 97%, 1);
    color: var(--color-primary-600, #7c3aed);
  }

  .status-badge.status-customer {
    background: var(--color-success-light, hsla(140, 100%, 94%, 1));
    color: var(--color-success-text, hsla(140, 100%, 25%, 1));
  }

  .status-badge.status-churned {
    background: var(--color-error-light, hsla(0, 100%, 95%, 1));
    color: var(--color-error-text, hsla(0, 100%, 35%, 1));
  }
</style>
