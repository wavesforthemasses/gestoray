<script lang="ts">
  import type { PlaceDocument, PlaceHierarchyNode } from '../../domain/models/place';
  import { 
    ChevronRight, 
    ChevronDown, 
    MapPin, 
    Folder, 
    FolderOpen, 
    ArrowRightLeft, 
    Eye, 
    Pencil, 
    Check, 
    X,
    Building2,
    Warehouse,
    Store
  } from '@lucide/svelte';

  interface Props {
    nodes: PlaceHierarchyNode[];
    allPlaces: PlaceDocument[];
    selectedPlaceId?: string | null;
    onSelectPlace?: (place: PlaceDocument) => void;
    onReparent?: (targetPlaceId: string, newParentId: string | null) => Promise<void>;
  }

  let {
    nodes = [],
    allPlaces = [],
    selectedPlaceId = null,
    onSelectPlace,
    onReparent
  }: Props = $props();

  let expandedNodeIds = $state<Set<string>>(new Set());
  let reparentTarget = $state<PlaceDocument | null>(null);
  let selectedNewParentId = $state<string | 'root'>('root');
  let isReparenting = $state(false);
  let reparentError = $state<string | null>(null);

  // Auto-espandi le radici
  $effect(() => {
    if (nodes.length > 0 && expandedNodeIds.size === 0) {
      const initial = new Set<string>();
      nodes.forEach(n => initial.add(n.place.id));
      expandedNodeIds = initial;
    }
  });

  function toggleExpand(id: string, e: Event) {
    e.stopPropagation();
    const next = new Set(expandedNodeIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    expandedNodeIds = next;
  }

  function openReparentModal(place: PlaceDocument, e: Event) {
    e.stopPropagation();
    reparentTarget = place;
    selectedNewParentId = place.parentId || 'root';
    reparentError = null;
  }

  function closeReparentModal() {
    reparentTarget = null;
    reparentError = null;
  }

  async function handleConfirmReparent() {
    if (!reparentTarget) return;
    const targetId = reparentTarget.id;
    const newParent = selectedNewParentId === 'root' ? null : selectedNewParentId;

    if (targetId === newParent) {
      reparentError = 'Un luogo non può essere genitore di se stesso.';
      return;
    }

    // Client-side cycle check
    if (newParent) {
      const descendants = allPlaces.filter(p => p.ancestors.includes(targetId)).map(p => p.id);
      if (descendants.includes(newParent)) {
        reparentError = 'Riferimento circolare: impossibile spostare questo nodo sotto un suo discendente.';
        return;
      }
    }

    isReparenting = true;
    try {
      if (onReparent) {
        await onReparent(targetId, newParent);
      }
      closeReparentModal();
    } catch (err: any) {
      reparentError = err.message || 'Errore durante lo spostamento.';
    } finally {
      isReparenting = false;
    }
  }

  function getTypeIcon(types: string[]) {
    if (types.includes('warehouse')) return Warehouse;
    if (types.includes('headquarters') || types.includes('branch')) return Building2;
    if (types.includes('store')) return Store;
    return MapPin;
  }
</script>

{#snippet treeNode(node: PlaceHierarchyNode, depth: number)}
  {@const place = node.place}
  {@const hasChildren = node.children.length > 0}
  {@const isExpanded = expandedNodeIds.has(place.id)}
  {@const isSelected = place.id === selectedPlaceId}
  {@const IconComp = getTypeIcon(place.types || [])}

  <div class="tree-row-wrapper" style="--node-depth: {depth};">
    <div 
      class="tree-node-row {isSelected ? 'selected' : ''}" 
      onclick={() => onSelectPlace?.(place)}
      role="button"
      tabindex="0"
      onkeydown={(e) => { if (e.key === 'Enter') onSelectPlace?.(place); }}
    >
      <!-- Expand / Collapse Toggler -->
      <div class="toggle-slot">
        {#if hasChildren}
          <button 
            type="button" 
            class="btn-toggle" 
            onclick={(e) => toggleExpand(place.id, e)}
            aria-label="Espandi o comprimi nodo"
          >
            {#if isExpanded}
              <ChevronDown size={16} />
            {:else}
              <ChevronRight size={16} />
            {/if}
          </button>
        {:else}
          <div class="tree-bullet"></div>
        {/if}
      </div>

      <!-- Icon Box -->
      <div class="node-icon-box {hasChildren ? 'has-sub' : ''}">
        <IconComp size={16} />
      </div>

      <!-- Place Info -->
      <div class="node-main-info">
        <div class="node-title-row">
          <span class="node-name">{place.name}</span>
          {#if place.code}
            <span class="node-code">{place.code}</span>
          {/if}
          <span class="node-badge status-{place.status}">
            {place.status === 'active' || place.status === 'attivo' ? 'Attivo' : place.status}
          </span>
        </div>
        <div class="node-sub-info">
          {#if place.address?.city}
            <span>{place.address.street ? place.address.street + ', ' : ''}{place.address.city}</span>
          {/if}
          {#if place.clientName}
            <span class="node-client">• {place.clientName}</span>
          {/if}
          {#if hasChildren}
            <span class="node-children-count">({node.children.length} sotto-aree)</span>
          {/if}
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="node-actions" onclick={(e) => e.stopPropagation()} role="group" aria-label="Azioni sul luogo">
        <button 
          type="button" 
          class="btn-node-action" 
          title="Sposta nella gerarchia"
          onclick={(e) => openReparentModal(place, e)}
        >
          <ArrowRightLeft size={14} />
          <span class="btn-text">Sposta</span>
        </button>
        <a 
          href="/dashboard/places/{place.id}" 
          class="btn-node-action" 
          title="Visualizza Dettaglio"
        >
          <Eye size={14} />
        </a>
        <a 
          href="/dashboard/places/{place.id}/edit" 
          class="btn-node-action" 
          title="Modifica"
        >
          <Pencil size={14} />
        </a>
      </div>
    </div>

    <!-- Children Recursive Rendering -->
    {#if hasChildren && isExpanded}
      <div class="tree-children-container">
        {#each node.children as child (child.place.id)}
          {@render treeNode(child, depth + 1)}
        {/each}
      </div>
    {/if}
  </div>
{/snippet}

<div class="hierarchy-tree-root">
  {#if nodes.length === 0}
    <div class="empty-tree-state">
      <MapPin size={32} class="empty-icon" />
      <p>Nessun luogo o cantiere corrisponde ai filtri impostati.</p>
    </div>
  {:else}
    <div class="tree-list">
      {#each nodes as rootNode (rootNode.place.id)}
        {@render treeNode(rootNode, 0)}
      {/each}
    </div>
  {/if}
</div>

<!-- Modal Reparenting Gerarchico -->
{#if reparentTarget}
  <div class="modal-backdrop" onclick={closeReparentModal} role="presentation">
    <div class="modal-dialog" onclick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="reparent-title">
      <header class="modal-header">
        <div class="modal-title-group">
          <ArrowRightLeft size={20} class="text-blue-600" />
          <h3 id="reparent-title" class="modal-title">Sposta nella Gerarchia</h3>
        </div>
        <button type="button" class="btn-close" onclick={closeReparentModal} aria-label="Chiudi">
          <X size={18} />
        </button>
      </header>

      <div class="modal-body">
        <p class="modal-desc">
          Seleziona il nuovo genitore per <strong>{reparentTarget.name}</strong>.
          Tutti i suoi eventuali sotto-luoghi si sposteranno automaticamente mantenendo la struttura.
        </p>

        {#if reparentError}
          <div class="reparent-error-banner">
            <span>{reparentError}</span>
          </div>
        {/if}

        <div class="form-group">
          <label for="newParentSelect" class="form-label">Posizione di Destinazione</label>
          <select 
            id="newParentSelect" 
            bind:value={selectedNewParentId} 
            class="form-select"
            disabled={isReparenting}
          >
            <option value="root">📁 Nodo Principale (Nessun genitore / Livello 0)</option>
            <optgroup label="Luoghi / Cantieri Disponibili">
              {#each allPlaces as p}
                {#if p.id !== reparentTarget.id && !p.ancestors.includes(reparentTarget.id)}
                  <option value={p.id}>
                    {p.name} ({p.code || 'Senza codice'}) {p.depth > 0 ? `[Livello ${p.depth}]` : ''}
                  </option>
                {/if}
              {/each}
            </optgroup>
          </select>
        </div>
      </div>

      <footer class="modal-footer">
        <button 
          type="button" 
          class="btn-cancel" 
          onclick={closeReparentModal} 
          disabled={isReparenting}
        >
          Annulla
        </button>
        <button 
          type="button" 
          class="btn-confirm" 
          onclick={handleConfirmReparent} 
          disabled={isReparenting}
        >
          <Check size={16} />
          <span>{isReparenting ? 'Spostamento in corso...' : 'Conferma Spostamento'}</span>
        </button>
      </footer>
    </div>
  </div>
{/if}

<style>
  .hierarchy-tree-root {
    width: 100%;
    background: var(--surface-color, #ffffff);
    border-radius: 12px;
    border: 1px solid var(--border-color, #e2e8f0);
    padding: 12px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03);
  }

  .empty-tree-state {
    text-align: center;
    padding: 48px 16px;
    color: #64748b;
  }

  .empty-icon {
    margin: 0 auto 12px auto;
    color: #94a3b8;
  }

  .tree-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .tree-row-wrapper {
    display: flex;
    flex-direction: column;
  }

  .tree-node-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    padding-left: calc(14px + (var(--node-depth) * 24px));
    border-radius: 8px;
    background: #ffffff;
    border: 1px solid #f1f5f9;
    transition: all 0.15s ease;
    cursor: pointer;
  }

  .tree-node-row:hover {
    background: #f8fafc;
    border-color: #cbd5e1;
  }

  .tree-node-row.selected {
    background: #eff6ff;
    border-color: #93c5fd;
  }

  .toggle-slot {
    width: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .btn-toggle {
    background: none;
    border: none;
    cursor: pointer;
    color: #64748b;
    padding: 2px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .btn-toggle:hover {
    background: #e2e8f0;
    color: #0f172a;
  }

  .tree-bullet {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #cbd5e1;
  }

  .node-icon-box {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f1f5f9;
    color: #475569;
  }

  .node-icon-box.has-sub {
    background: #dbeafe;
    color: #1d4ed8;
  }

  .node-main-info {
    flex: 1;
    min-width: 0;
  }

  .node-title-row {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .node-name {
    font-weight: 600;
    font-size: 14px;
    color: #0f172a;
  }

  .node-code {
    font-size: 11px;
    font-weight: 700;
    color: #475569;
    background: #f1f5f9;
    padding: 2px 6px;
    border-radius: 4px;
  }

  .node-badge {
    font-size: 11px;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 12px;
    text-transform: capitalize;
  }

  .status-active, .status-attivo {
    background: #dcfce7;
    color: #15803d;
  }

  .status-archived, .status-inattivo {
    background: #f1f5f9;
    color: #64748b;
  }

  .status-temporary {
    background: #fef9c3;
    color: #a16207;
  }

  .node-sub-info {
    font-size: 12px;
    color: #64748b;
    margin-top: 2px;
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }

  .node-children-count {
    color: #2563eb;
    font-weight: 600;
  }

  .node-actions {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .btn-node-action {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 6px 8px;
    border-radius: 6px;
    border: 1px solid #e2e8f0;
    background: #ffffff;
    color: #475569;
    font-size: 12px;
    font-weight: 500;
    text-decoration: none;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-node-action:hover {
    background: #f8fafc;
    border-color: #cbd5e1;
    color: #0f172a;
  }

  .tree-children-container {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-top: 4px;
  }

  /* Modal Styling */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.5);
    backdrop-filter: blur(4px);
    z-index: 1050;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
  }

  .modal-dialog {
    background: #ffffff;
    border-radius: 16px;
    max-width: 520px;
    width: 100%;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
    overflow: hidden;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid #f1f5f9;
  }

  .modal-title-group {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .modal-title {
    font-size: 16px;
    font-weight: 700;
    color: #0f172a;
    margin: 0;
  }

  .btn-close {
    background: none;
    border: none;
    color: #94a3b8;
    cursor: pointer;
    padding: 4px;
    border-radius: 6px;
  }

  .modal-body {
    padding: 20px;
  }

  .modal-desc {
    font-size: 13px;
    color: #475569;
    line-height: 1.5;
    margin-bottom: 16px;
  }

  .reparent-error-banner {
    background: #fef2f2;
    border: 1px solid #fecaca;
    color: #dc2626;
    font-size: 13px;
    padding: 10px 12px;
    border-radius: 8px;
    margin-bottom: 16px;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .form-label {
    font-size: 13px;
    font-weight: 600;
    color: #334155;
  }

  .form-select {
    width: 100%;
    padding: 8px 12px;
    border-radius: 8px;
    border: 1px solid #cbd5e1;
    font-size: 14px;
    background: #ffffff;
  }

  .modal-footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 10px;
    padding: 14px 20px;
    background: #f8fafc;
    border-top: 1px solid #f1f5f9;
  }

  .btn-cancel {
    padding: 8px 14px;
    border-radius: 8px;
    border: 1px solid #cbd5e1;
    background: #ffffff;
    font-size: 13px;
    font-weight: 600;
    color: #475569;
    cursor: pointer;
  }

  .btn-confirm {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    border-radius: 8px;
    border: none;
    background: #2563eb;
    color: #ffffff;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
  }

  .btn-confirm:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
</style>
