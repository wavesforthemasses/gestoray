<script lang="ts">
  import { onMount } from 'svelte';
  import {
    FileSpreadsheet,
    Upload,
    History,
    SlidersHorizontal,
    CheckCircle2,
    AlertCircle,
    RefreshCw,
    Download,
    Layers,
    Building2,
    Package,
    ClipboardList,
    Database
  } from '@lucide/svelte';
  import { db, collection, getDocs, query, orderBy, limit } from '$lib/firebase';
  import { ImportRegistry } from '$lib/services/import/importRegistry';
  import { initImportRegistry } from '$lib/services/import/initImportRegistry';
  import type { ImportModuleSpec, ImportBatchReport } from '$lib/types/importTypes';
  import ImportWizardModal from '$lib/components/import/ImportWizardModal.svelte';

  let registeredSpecs = $state<ImportModuleSpec[]>([]);
  let importLogs = $state<any[]>([]);
  let loadingLogs = $state(true);
  let isModalOpen = $state(false);

  onMount(async () => {
    initImportRegistry();
    registeredSpecs = ImportRegistry.getAllSpecs();
    await fetchImportLogs();
  });

  async function fetchImportLogs() {
    loadingLogs = true;
    try {
      const q = query(
        collection(db, 'system_import_logs'),
        orderBy('createdAt', 'desc'),
        limit(20)
      );
      const snap = await getDocs(q);
      const list: any[] = [];
      snap.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });
      importLogs = list;
    } catch (err) {
      console.warn('[ImportSettingsPage] Could not load import logs:', err);
    } finally {
      loadingLogs = false;
    }
  }

  function getModuleIcon(entityType: string) {
    if (entityType === 'clients') return Building2;
    if (entityType === 'products') return Package;
    if (entityType === 'activities') return ClipboardList;
    return Layers;
  }
  import { projectStore } from '$lib/stores/project';
</script>

<svelte:head>
  <title>Importazione Dati Centralizzata | {$projectStore?.projectName || 'ERP'}</title>
</svelte:head>

<div class="settings-page">
  <!-- Page Header -->
  <div class="page-header">
    <div class="header-text">
      <h1 class="page-title">
        <FileSpreadsheet class="title-icon" size={28} />
        Importazione Dati Centralizzata
      </h1>
      <p class="page-description">
        Gestisci l'importazione di massa di anagrafiche, prodotti e attività da file CSV o TSV con mappatura dinamica e riconciliazione semi-manuale.
      </p>
    </div>
    <button type="button" class="btn-primary" onclick={() => (isModalOpen = true)}>
      <Upload size={18} /> Avvia Importazione Guidata
    </button>
  </div>

  <!-- Registered Module Adapters Section -->
  <div class="section-card">
    <div class="card-header">
      <h2 class="card-title">
        <Layers size={20} class="icon-accent" />
        Moduli Abilitati per l'Importazione ({registeredSpecs.length})
      </h2>
    </div>
    <div class="modules-grid">
      {#each registeredSpecs as spec}
        {@const IconComponent = getModuleIcon(spec.entityType)}
        <div class="module-item-card">
          <div class="module-icon-wrapper">
            <IconComponent size={24} />
          </div>
          <div class="module-info">
            <h3 class="module-name">{spec.label}</h3>
            <span class="module-code">Collezione: <code>{spec.collectionName}</code></span>
            <div class="module-badges">
              <span class="badge-fields">{spec.fields.length} campi dichiarati</span>
              {#if spec.prerequisites && spec.prerequisites.length > 0}
                <span class="badge-prereq">Richiede: {spec.prerequisites.join(', ')}</span>
              {:else}
                <span class="badge-standalone">Autonomo</span>
              {/if}
            </div>
          </div>
        </div>
      {/each}
    </div>
  </div>

  <!-- Import Execution Logs History -->
  <div class="section-card">
    <div class="card-header flex-between">
      <h2 class="card-title">
        <History size={20} class="icon-accent" />
        Storico Importazioni Eseguite
      </h2>
      <button type="button" class="btn-ghost" onclick={fetchImportLogs} disabled={loadingLogs}>
        <RefreshCw size={16} class={loadingLogs ? 'spin' : ''} /> Aggiorna
      </button>
    </div>

    {#if loadingLogs}
      <div class="loading-state">
        <RefreshCw size={24} class="spin" />
        <span>Caricamento storico importazioni...</span>
      </div>
    {:else if importLogs.length === 0}
      <div class="empty-state">
        <Database size={40} class="text-muted" />
        <p class="empty-title">Nessuna importazione eseguita finora</p>
        <p class="empty-subtitle">Fai clic su "Avvia Importazione Guidata" per caricare il tuo primo file CSV.</p>
      </div>
    {:else}
      <div class="table-wrapper">
        <table class="logs-table">
          <thead>
            <tr>
              <th>ID Sessione</th>
              <th>Data & Ora</th>
              <th>Modulo Destinazione</th>
              <th>Totale Righe</th>
              <th>Salvati con Successo</th>
              <th>Scartati / Errati</th>
            </tr>
          </thead>
          <tbody>
            {#each importLogs as log}
              <tr>
                <td><code>{log.importId || log.id}</code></td>
                <td>{log.timestamp ? new Date(log.timestamp).toLocaleString('it-IT') : '-'}</td>
                <td>
                  <span class="module-badge">{log.entityType}</span>
                </td>
                <td><strong>{log.totalRows || 0}</strong></td>
                <td>
                  <span class="text-success fw-600">{log.succeeded || 0}</span>
                </td>
                <td>
                  {#if log.failed > 0}
                    <span class="text-danger fw-600">{log.failed}</span>
                  {:else}
                    <span class="text-muted">0</span>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>
</div>

<!-- Embedded Universal Import Wizard Modal -->
<ImportWizardModal bind:isOpen={isModalOpen} onClose={fetchImportLogs} />

<style>
  .settings-page {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    padding: 1.5rem;
    max-width: 1200px;
    margin: 0 auto;
  }

  .page-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  .page-title {
    font-size: 1.5rem;
    font-weight: 700;
    margin: 0;
    color: var(--text-heading, #0f172a);
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .title-icon {
    color: var(--color-primary, #2563eb);
  }

  .page-description {
    margin: 0.35rem 0 0 0;
    font-size: 0.938rem;
    color: var(--text-muted, #64748b);
  }

  .section-card {
    background: var(--bg-surface, #ffffff);
    border-radius: 12px;
    border: 1px solid var(--border-color, #e2e8f0);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .card-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .flex-between {
    justify-content: space-between;
  }

  .card-title {
    font-size: 1.1rem;
    font-weight: 700;
    margin: 0;
    color: var(--text-heading, #0f172a);
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .icon-accent {
    color: var(--color-primary, #2563eb);
  }

  .modules-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 1rem;
  }

  .module-item-card {
    background: var(--bg-subtle, #f8fafc);
    border: 1px solid var(--border-color, #e2e8f0);
    border-radius: 8px;
    padding: 1rem;
    display: flex;
    align-items: flex-start;
    gap: 1rem;
  }

  .module-icon-wrapper {
    background: var(--bg-surface, #fff);
    border: 1px solid var(--border-color, #cbd5e1);
    padding: 0.625rem;
    border-radius: 8px;
    color: var(--color-primary, #2563eb);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .module-info {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .module-name {
    font-size: 0.95rem;
    font-weight: 700;
    margin: 0;
    color: var(--text-heading, #0f172a);
  }

  .module-code {
    font-size: 0.8rem;
    color: var(--text-muted, #64748b);
  }

  .module-badges {
    display: flex;
    gap: 0.35rem;
    margin-top: 0.35rem;
  }

  .badge-fields {
    background: #e0f2fe;
    color: #0369a1;
    font-size: 0.72rem;
    padding: 0.1rem 0.4rem;
    border-radius: 4px;
    font-weight: 500;
  }

  .badge-prereq {
    background: #fef3c7;
    color: #b45309;
    font-size: 0.72rem;
    padding: 0.1rem 0.4rem;
    border-radius: 4px;
    font-weight: 500;
  }

  .badge-standalone {
    background: #dcfce7;
    color: #15803d;
    font-size: 0.72rem;
    padding: 0.1rem 0.4rem;
    border-radius: 4px;
    font-weight: 500;
  }

  .btn-primary {
    background: var(--color-primary, #2563eb);
    color: #ffffff;
    border: none;
    padding: 0.625rem 1.25rem;
    border-radius: 8px;
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2);
  }

  .btn-ghost {
    background: transparent;
    border: 1px solid var(--border-color, #cbd5e1);
    color: var(--text-heading, #0f172a);
    padding: 0.4rem 0.875rem;
    border-radius: 6px;
    font-size: 0.84rem;
    font-weight: 500;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }

  .table-wrapper {
    overflow-x: auto;
    border: 1px solid var(--border-color, #e2e8f0);
    border-radius: 8px;
  }

  .logs-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;
  }

  .logs-table th {
    background: var(--bg-subtle, #f8fafc);
    padding: 0.75rem 1rem;
    text-align: left;
    font-weight: 600;
    color: var(--text-heading, #0f172a);
    border-bottom: 1px solid var(--border-color, #e2e8f0);
  }

  .logs-table td {
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--border-color, #f1f5f9);
  }

  .module-badge {
    background: #f1f5f9;
    color: #334155;
    padding: 0.15rem 0.5rem;
    border-radius: 4px;
    font-size: 0.78rem;
    font-weight: 600;
    font-family: monospace;
  }

  .empty-state {
    padding: 3rem 1.5rem;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }

  .empty-title {
    font-weight: 600;
    font-size: 1rem;
    margin: 0;
    color: var(--text-heading, #0f172a);
  }

  .empty-subtitle {
    font-size: 0.85rem;
    color: var(--text-muted, #64748b);
    margin: 0;
  }

  .loading-state {
    padding: 2rem;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    color: var(--text-muted, #64748b);
  }

  .text-success { color: #16a34a; }
  .text-danger { color: #dc2626; }
  .text-muted { color: #94a3b8; }
  .fw-600 { font-weight: 600; }

  .spin {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
</style>
