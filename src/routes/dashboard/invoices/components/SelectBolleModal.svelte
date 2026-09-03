<script lang="ts">
  import { onMount } from 'svelte';
  import { db, collection, query, where, getDocs } from '$lib/firebase';
  import { formatCurrency } from '$lib/utils/math';
  import { FileCheck, Check, Search, AlertCircle, RefreshCw } from '@lucide/svelte';

  let {
    clientId = '',
    onSelect,
    onClose
  }: {
    clientId?: string;
    onSelect: (selectedBolle: any[]) => void;
    onClose: () => void;
  } = $props();

  let loading = $state(true);
  let bolleList = $state<any[]>([]);
  let selectedIds = $state<Set<string>>(new Set());
  let searchQuery = $state('');

  onMount(async () => {
    await fetchBolle();
  });

  async function fetchBolle() {
    loading = true;
    try {
      let q = query(
        collection(db, 'interventions'),
        where('status', 'in', ['firmato', 'completato', 'completata'])
      );

      if (clientId) {
        q = query(q, where('clientId', '==', clientId));
      }

      const snap = await getDocs(q);
      const items: any[] = [];
      snap.forEach(d => {
        const data = d.data();
        if (!data.invoiceId) {
          items.push({ id: d.id, ...data });
        }
      });
      bolleList = items;
    } catch (e) {
      console.warn('Errore lettura bolle non fatturate:', e);
    } finally {
      loading = false;
    }
  }

  function toggleSelect(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    selectedIds = next;
  }

  function toggleSelectAll() {
    if (selectedIds.size === filteredBolle.length) {
      selectedIds = new Set();
    } else {
      selectedIds = new Set(filteredBolle.map(b => b.id));
    }
  }

  let filteredBolle = $derived(
    bolleList.filter(b => {
      const q = searchQuery.toLowerCase();
      return (
        (b.title || '').toLowerCase().includes(q) ||
        (b.number || '').toLowerCase().includes(q) ||
        (b.clientName || '').toLowerCase().includes(q)
      );
    })
  );

  let selectedTotal = $derived(
    bolleList
      .filter(b => selectedIds.has(b.id))
      .reduce((sum, b) => sum + Number(b.totalAmount || b.estimatedCost || 0), 0)
  );

  function confirmSelection() {
    const chosen = bolleList.filter(b => selectedIds.has(b.id));
    onSelect(chosen);
  }
</script>

<div class="modal-backdrop" onclick={onClose} role="presentation">
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div class="modal-card" onclick={e => e.stopPropagation()} role="dialog" aria-modal="true">
    <div class="modal-header">
      <div class="header-title">
        <FileCheck size={20} class="header-icon" />
        <div>
          <h3>Seleziona Bolle / Rapportini da Fatturare</h3>
          <p class="subtitle">Interventi firmati pronti per fatturazione differita o raggruppata</p>
        </div>
      </div>
      <button class="btn-close" onclick={onClose}>×</button>
    </div>

    <div class="modal-toolbar">
      <div class="search-wrap">
        <Search size={16} />
        <input 
          type="text" 
          placeholder="Cerca per numero, titolo o cliente..." 
          bind:value={searchQuery} 
          class="search-input"
        />
      </div>
      <button class="btn btn-secondary" onclick={toggleSelectAll} disabled={filteredBolle.length === 0}>
        {selectedIds.size === filteredBolle.length ? 'Deseleziona Tutto' : 'Seleziona Tutto'}
      </button>
    </div>

    <div class="modal-body">
      {#if loading}
        <div class="empty-state">
          <RefreshCw size={28} class="spin" />
          <p>Ricerca bolle non fatturate...</p>
        </div>
      {:else if filteredBolle.length === 0}
        <div class="empty-state">
          <AlertCircle size={32} />
          <p>Nessuna bolla/intervento firmato in attesa di fatturazione.</p>
        </div>
      {:else}
        <div class="bolle-list">
          {#each filteredBolle as bolla (bolla.id)}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
            <div 
              class="bolla-row {selectedIds.has(bolla.id) ? 'selected' : ''}"
              onclick={() => toggleSelect(bolla.id)}
            >
              <div class="checkbox-col">
                <input 
                  type="checkbox" 
                  checked={selectedIds.has(bolla.id)} 
                  onclick={e => e.stopPropagation()} 
                  onchange={() => toggleSelect(bolla.id)}
                />
              </div>
              <div class="info-col">
                <div class="bolla-top">
                  <span class="bolla-num">Bolla #{bolla.number || bolla.id.slice(0, 6)}</span>
                  <span class="bolla-date">{bolla.date || 'Data N/D'}</span>
                  <span class="client-tag">{bolla.clientName || 'Cliente'}</span>
                </div>
                <div class="bolla-title">{bolla.title || 'Intervento di assistenza'}</div>
              </div>
              <div class="amount-col">
                <span class="amount">{formatCurrency(bolla.totalAmount || bolla.estimatedCost || 0)}</span>
                <span class="vat-note">+IVA</span>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>

    <div class="modal-footer">
      <div class="footer-summary">
        Selezionate: <strong>{selectedIds.size} bolle</strong> • Totale: <strong>{formatCurrency(selectedTotal)}</strong>
      </div>
      <div class="footer-actions">
        <button class="btn btn-secondary" onclick={onClose}>Annulla</button>
        <button class="btn btn-primary" onclick={confirmSelection} disabled={selectedIds.size === 0}>
          <Check size={16} /> Includi in Fattura ({selectedIds.size})
        </button>
      </div>
    </div>
  </div>
</div>

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.45);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    padding: 1rem;
  }

  .modal-card {
    background: #ffffff;
    border-radius: 14px;
    width: 100%;
    max-width: 720px;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
    overflow: hidden;
  }

  .modal-header {
    padding: 1.25rem 1.5rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid var(--border-color, #e2e8f0);
  }

  .header-title {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  :global(.header-icon) {
    color: var(--color-primary-600, #2563eb);
  }

  h3 {
    margin: 0;
    font-size: 1.15rem;
    font-weight: 700;
  }

  .subtitle {
    margin: 0.15rem 0 0 0;
    font-size: 0.8rem;
    color: var(--text-muted, #64748b);
  }

  .btn-close {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: #64748b;
  }

  .modal-toolbar {
    padding: 0.75rem 1.5rem;
    display: flex;
    gap: 0.75rem;
    background: var(--surface-secondary, #f8fafc);
    border-bottom: 1px solid var(--border-color, #e2e8f0);
  }

  .search-wrap {
    flex: 1;
    position: relative;
    display: flex;
    align-items: center;
  }

  .search-wrap :global(svg) {
    position: absolute;
    left: 0.75rem;
    color: #94a3b8;
  }

  .search-input {
    width: 100%;
    padding: 0.5rem 0.75rem 0.5rem 2.25rem;
    font-size: 0.875rem;
    border: 1px solid var(--border-color, #cbd5e1);
    border-radius: 8px;
  }

  .modal-body {
    flex: 1;
    overflow-y: auto;
    padding: 1rem 1.5rem;
  }

  .bolle-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .bolla-row {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.75rem 1rem;
    border-radius: 8px;
    border: 1px solid var(--border-color, #e2e8f0);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .bolla-row:hover {
    background: #f8fafc;
    border-color: #cbd5e1;
  }

  .bolla-row.selected {
    background: rgba(37, 99, 235, 0.05);
    border-color: var(--color-primary-600, #2563eb);
  }

  .info-col {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .bolla-top {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.75rem;
  }

  .bolla-num {
    font-weight: 700;
    color: var(--color-primary-600, #2563eb);
  }

  .bolla-date {
    color: var(--text-muted, #64748b);
  }

  .client-tag {
    background: #f1f5f9;
    padding: 0.1rem 0.4rem;
    border-radius: 4px;
    color: #475569;
  }

  .bolla-title {
    font-weight: 600;
    font-size: 0.9rem;
    color: var(--text-primary, #1e293b);
  }

  .amount-col {
    text-align: right;
  }

  .amount {
    display: block;
    font-weight: 700;
    font-size: 1rem;
    color: var(--text-primary, #0f172a);
  }

  .vat-note {
    font-size: 0.7rem;
    color: var(--text-muted, #64748b);
  }

  .modal-footer {
    padding: 1rem 1.5rem;
    background: #f8fafc;
    border-top: 1px solid #e2e8f0;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .footer-summary {
    font-size: 0.875rem;
    color: var(--text-muted, #64748b);
  }

  .footer-actions {
    display: flex;
    gap: 0.75rem;
  }

  .btn {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.5rem 1rem;
    border-radius: 8px;
    font-size: 0.875rem;
    font-weight: 600;
    border: none;
    cursor: pointer;
  }

  .btn-primary {
    background: var(--color-primary-600, #2563eb);
    color: #ffffff;
  }

  .btn-secondary {
    background: var(--surface-secondary, #f1f5f9);
    color: var(--text-primary, #334155);
    border: 1px solid var(--border-color, #cbd5e1);
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem 1rem;
    color: var(--text-muted, #64748b);
    gap: 0.75rem;
  }

  :global(.spin) {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
</style>
