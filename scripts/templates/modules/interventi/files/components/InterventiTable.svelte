<script lang="ts">
  import type { InterventionItem } from '../schema';

  interface Props {
    interventions: InterventionItem[];
    locationLabel?: string;
  }

  let { interventions, locationLabel = 'Luogo' }: Props = $props();

  function getStatusBadge(status: string) {
    switch (status) {
      case 'pianificato': return { label: '📅 Pianificato', class: 'badge-info' };
      case 'in_lavorazione': return { label: '🛠️ In Lavorazione', class: 'badge-warning' };
      case 'completato': return { label: '✅ Consuntivato', class: 'badge-success' };
      case 'approvato': return { label: '⭐ Approvato', class: 'badge-primary' };
      case 'fatturato': return { label: '🧾 Fatturato', class: 'badge-dark' };
      default: return { label: status, class: 'badge-secondary' };
    }
  }

  function formatDate(isoStr?: string) {
    if (!isoStr) return '-';
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return isoStr;
    }
  }
</script>

<div class="table-card">
  {#if interventions.length === 0}
    <div class="empty-state">
      <div class="empty-icon">📭</div>
      <h3>Nessun intervento trovato</h3>
      <p>Non ci sono interventi corrispondenti ai criteri di ricerca impostati.</p>
    </div>
  {:else}
    <div class="table-responsive">
      <table class="data-table">
        <thead>
          <tr>
            <th>Stato</th>
            <th>Titolo & Cliente</th>
            <th>{locationLabel}</th>
            <th>Modalità</th>
            <th>Data Inizio</th>
            <th>Ore Consuntivo</th>
            <th>Totale €</th>
            <th>Azione</th>
          </tr>
        </thead>
        <tbody>
          {#each interventions as item (item.id)}
            {@const badge = getStatusBadge(item.status)}
            <tr class="table-row">
              <td>
                <span class="badge {badge.class}">{badge.label}</span>
              </td>
              <td>
                <div class="title-cell">
                  <a href="/dashboard/interventi/{item.id}" class="item-title">{item.title}</a>
                  <span class="item-client">👤 {item.clientName || 'Cliente non specificato'}</span>
                </div>
              </td>
              <td>
                <span class="location-tag">📍 {item.locationName || 'Sede Principale'}</span>
              </td>
              <td>
                {#if item.mode === 'a_bolla'}
                  <span class="mode-tag bolla">📄 A Bolla</span>
                {:else}
                  <span class="mode-tag erogazione">🔄 Ad Erogazione</span>
                {/if}
              </td>
              <td>
                <span class="date-text">{formatDate(item.scheduledStartAt || item.createdAt)}</span>
              </td>
              <td>
                <span class="hours-text">{item.actualHoursWorked ? `${item.actualHoursWorked} h` : '-'}</span>
              </td>
              <td>
                <span class="price-text">{item.totalAmount ? `€ ${item.totalAmount.toFixed(2)}` : '€ 0.00'}</span>
              </td>
              <td>
                <a href="/dashboard/interventi/{item.id}" class="action-btn">Visualizza ➔</a>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>

<style>
  .table-card {
    background: var(--color-white);
    border: 1px solid var(--color-neutral-200);
    border-radius: var(--radius-lg);
    overflow: hidden;
    box-shadow: var(--shadow-sm);
  }
  .table-responsive {
    width: 100%;
    overflow-x: auto;
  }
  .data-table {
    width: 100%;
    border-collapse: collapse;
    text-align: left;
  }
  .data-table th {
    background: var(--color-neutral-50);
    padding: 12px 16px;
    font-size: 12px;
    font-weight: 600;
    color: var(--color-neutral-600);
    border-bottom: 1px solid var(--color-neutral-200);
    white-space: nowrap;
  }
  .table-row {
    border-bottom: 1px solid var(--color-neutral-100);
    transition: background 0.15s ease;
  }
  .table-row:hover {
    background: var(--color-neutral-50);
  }
  .table-row td {
    padding: 14px 16px;
    font-size: 13px;
    vertical-align: middle;
  }
  .title-cell {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .item-title {
    font-weight: 600;
    color: var(--color-neutral-900);
    text-decoration: none;
  }
  .item-title:hover {
    color: var(--color-primary-500);
  }
  .item-client {
    font-size: 12px;
    color: var(--color-neutral-500);
    white-space: nowrap;
  }
  .badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    border-radius: var(--radius-round);
    font-size: 11px;
    font-weight: 600;
    white-space: nowrap;
  }
  .badge-info { background: #e0f2fe; color: #0369a1; }
  .badge-warning { background: #fef3c7; color: #b45309; }
  .badge-success { background: #dcfce7; color: #15803d; }
  .badge-primary { background: #dbeafe; color: #1d4ed8; }
  .badge-dark { background: #f3f4f6; color: #1f2937; }
  .badge-secondary { background: #f3f4f6; color: #4b5563; }
  .mode-tag {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
    white-space: nowrap;
  }
  .mode-tag.bolla { background: #fef3c7; color: #92400e; }
  .mode-tag.erogazione { background: #f0fdf4; color: #166534; }
  .location-tag {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: var(--color-neutral-600);
    white-space: nowrap;
  }
  .date-text, .hours-text, .price-text {
    font-weight: 500;
    white-space: nowrap;
  }
  .price-text {
    color: var(--color-neutral-900);
    font-weight: 600;
    white-space: nowrap;
  }
  .action-btn {
    color: var(--color-primary-500);
    text-decoration: none;
    font-weight: 600;
    font-size: 12px;
  }
  .action-btn:hover {
    text-decoration: underline;
  }
  .empty-state {
    padding: 48px 24px;
    text-align: center;
  }
  .empty-icon {
    font-size: 36px;
    margin-bottom: 8px;
  }
  .empty-state h3 {
    margin: 0 0 4px 0;
    font-size: 16px;
    color: var(--color-neutral-800);
  }
  @media (max-width: 640px) {
    .data-table thead {
      display: none;
    }
    .table-row {
      display: flex;
      flex-direction: column;
      padding: 12px;
      gap: 8px;
      border-bottom: 1px solid var(--color-neutral-200);
    }
    .table-row td {
      padding: 2px 0;
      border: none;
    }
  }
</style>
