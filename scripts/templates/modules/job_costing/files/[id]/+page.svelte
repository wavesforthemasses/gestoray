<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { 
    Briefcase, 
    List, 
    RefreshCw, 
    Lock, 
    Unlock, 
    MapPin, 
    Building2, 
    Calendar, 
    Calculator, 
    TrendingUp, 
    TrendingDown,
    Plus, 
    FileText, 
    Layers,
    DollarSign,
    Clock,
    AlertCircle,
    CheckCircle2,
    X
  } from '@lucide/svelte';
  import { JobCostingService } from '../jobCosting.service';
  import type { JobCostingProject, JobCostItem } from '../schema';
  import { formatCurrency } from '$lib/utils/math';
  import JobHealthBadge from '../components/JobHealthBadge.svelte';
  import JobCostBreakdownBars from '../components/JobCostBreakdownBars.svelte';
  import JobBudgetProgressBar from '../components/JobBudgetProgressBar.svelte';

  let projectId = $derived($page.params.id || '');
  let project = $state<JobCostingProject | null>(null);
  let costItems = $state<JobCostItem[]>([]);
  let loading = $state(true);
  let syncing = $state(false);
  let activeTab = $state<'overview' | 'costs' | 'revenues'>('overview');

  // Modal nuova spesa manuale
  let showAddCostModal = $state(false);
  let newCostCategory = $state<'subcontractor' | 'equipment' | 'materials' | 'labor' | 'other'>('subcontractor');
  let newCostDesc = $state('');
  let newCostSupplier = $state('');
  let newCostQty = $state(1);
  let newCostUnitCost = $state(0);
  let newCostDate = $state(new Date().toISOString().split('T')[0]);
  let addingCost = $state(false);

  onMount(async () => {
    await loadProjectData();
  });

  async function loadProjectData() {
    if (!projectId) return;
    loading = true;
    try {
      project = await JobCostingService.getProjectById(projectId);
      if (project) {
        costItems = await JobCostingService.getCostItems(projectId);
      }
    } catch (e) {
      console.error('Errore caricamento commessa:', e);
    } finally {
      loading = false;
    }
  }

  async function handleSync() {
    if (!projectId || project?.status === 'chiusa') return;
    syncing = true;
    try {
      project = await JobCostingService.syncProjectSources(projectId);
      costItems = await JobCostingService.getCostItems(projectId);
    } catch (e) {
      console.error('Errore sincronizzazione commessa:', e);
      alert('Errore durante la riconciliazione delle fonti di cantiere.');
    } finally {
      syncing = false;
    }
  }

  async function handleToggleClose() {
    if (!projectId || !project) return;
    try {
      if (project.status === 'chiusa') {
        if (confirm('Vuoi riaprire la commessa? I consuntivi torneranno a sincronizzarsi in tempo reale.')) {
          await JobCostingService.reopenProject(projectId);
          await loadProjectData();
        }
      } else {
        if (confirm('Sei sicuro di voler chiudere la commessa? I consuntivi e i margini verranno sigillati in modo immutabile (Freeze Snapshot).')) {
          await JobCostingService.closeProject(projectId);
          await loadProjectData();
        }
      }
    } catch (e) {
      console.error('Errore cambio stato chiusura:', e);
    }
  }

  async function handleAddManualCost(e: Event) {
    e.preventDefault();
    if (!projectId || !newCostDesc.trim() || newCostUnitCost <= 0) {
      alert('Inserisci una descrizione e un importo valido.');
      return;
    }

    addingCost = true;
    try {
      await JobCostingService.addCostItem(projectId, {
        date: newCostDate,
        category: newCostCategory,
        description: newCostDesc,
        sourceType: 'manual',
        quantity: Number(newCostQty) || 1,
        unitCost: Number(newCostUnitCost) || 0,
        totalCost: (Number(newCostQty) || 1) * (Number(newCostUnitCost) || 0),
        workerOrSupplierName: newCostSupplier
      });

      showAddCostModal = false;
      newCostDesc = '';
      newCostSupplier = '';
      newCostUnitCost = 0;
      await loadProjectData();
    } catch (err) {
      console.error('Errore inserimento spesa manuale:', err);
      alert('Errore salvataggio spesa.');
    } finally {
      addingCost = false;
    }
  }

  function formatCategoryLabel(cat: string): string {
    switch (cat) {
      case 'labor': return 'Manodopera';
      case 'materials': return 'Materiali FIFO';
      case 'equipment': return 'Mezzi & Noli';
      case 'subcontractor': return 'Subappalto';
      default: return 'Altro / Spese';
    }
  }

  function calcIncidence(val?: number, tot?: number): string {
    const v = Number(val) || 0;
    const t = Number(tot) || 1;
    if (t <= 0) return '0.0%';
    return (Number((v / t) * 100) || 0).toFixed(1) + '%';
  }
</script>

<div class="job-detail-page animate-fade-in">
  {#if loading}
    <div class="loading-state card">
      <div class="spinner"></div>
      <p>Caricamento radiografia economica della commessa...</p>
    </div>
  {:else if !project}
    <div class="empty-state card">
      <AlertCircle size={44} class="text-danger" />
      <h3>Commessa non trovata</h3>
      <a href="/dashboard/job_costing" class="btn btn-secondary btn-sm">Torna all'elenco</a>
    </div>
  {:else}
    <!-- 1. Header & Actions Bar (Principi 12 & 23) -->
    <div class="page-top-actions">
      <div class="title-with-icon">
        <div class="header-icon-box" class:closed={project.status === 'chiusa'}>
          <Briefcase size={22} class="text-primary" />
        </div>
        <div>
          <div class="code-badge-row">
            <span class="project-code">{project.code}</span>
            <span class="badge-status {project.status}">
              {project.status === 'chiusa' ? 'Sigillata (Chiusa)' : project.status}
            </span>
            <JobHealthBadge status={project.profitability?.healthStatus} marginPercent={project.profitability?.grossMarginPercent || 0} />
          </div>
          <h1 class="page-title">{project.title}</h1>
          <div class="meta-row">
            {#if project.placeName}
              <span class="meta-item"><MapPin size={14} /> Cantiere: <strong>{project.placeName}</strong></span>
            {/if}
            {#if project.clientName}
              <span class="meta-item"><Building2 size={14} /> Cliente: <strong>{project.clientName}</strong></span>
            {/if}
            <span class="meta-item"><Calendar size={14} /> Dal {project.startDate} {project.expectedEndDate ? `al ${project.expectedEndDate}` : ''}</span>
          </div>
        </div>
      </div>

      <div class="actions-group">
        <a href="/dashboard/job_costing" class="btn btn-secondary btn-module-list" title="Vai all'elenco commesse">
          <List size={16} />
          <span>Elenco Commesse</span>
        </a>

        {#if project.status !== 'chiusa'}
          <button class="btn btn-outline" onclick={handleSync} disabled={syncing} title="Riconcilia bolle, magazzino e fatture in tempo reale">
            <RefreshCw size={15} class={syncing ? 'animate-spin' : ''} />
            <span>{syncing ? 'Sincronizzazione...' : 'Riconcilia Dati'}</span>
          </button>
        {/if}

        <button 
          class="btn {project.status === 'chiusa' ? 'btn-outline' : 'btn-secondary'}" 
          onclick={handleToggleClose}
          title={project.status === 'chiusa' ? 'Riapri commessa' : 'Sigilla commessa con Freeze Snapshot'}
        >
          {#if project.status === 'chiusa'}
            <Unlock size={15} />
            <span>Riapri Commessa</span>
          {:else}
            <Lock size={15} />
            <span>Chiudi Commessa</span>
          {/if}
        </button>
      </div>
    </div>

    <!-- Alert se commessa chiusa -->
    {#if project.status === 'chiusa'}
      <div class="freeze-banner">
        <CheckCircle2 size={18} class="text-success" />
        <div>
          <strong>Freeze Snapshot Attivo:</strong> I consuntivi e la marginalità sono sigillati a fini di bilancio. Nessun ricalcolo automatico modificherà i dati consolidati.
        </div>
      </div>
    {/if}

    <!-- 2. KPI Radiografia Finanziaria -->
    <div class="kpi-grid-row">
      <div class="kpi-card">
        <div class="kpi-body">
          <span class="kpi-label">Valore Target Ricavi</span>
          <span class="kpi-value text-primary">{formatCurrency(project.revenues?.contractValue || project.revenues?.invoicedTotal || 0)}</span>
          <span class="kpi-sub">Fatturato: {formatCurrency(project.revenues?.invoicedTotal || 0)} | Incassato: {formatCurrency(project.revenues?.paidTotal || 0)}</span>
        </div>
      </div>

      <div class="kpi-card">
        <div class="kpi-body">
          <span class="kpi-label">Spesa Consuntivata vs Budget</span>
          <span class="kpi-value">{formatCurrency(project.actuals?.total || 0)}</span>
          <div style="margin-top: 0.35rem;">
            <JobBudgetProgressBar spent={project.actuals?.total || 0} budget={project.budget?.total || 0} />
          </div>
        </div>
      </div>

      <div class="kpi-card">
        <div class="kpi-body">
          <span class="kpi-label">Margine Lordo Effettivo</span>
          <span class="kpi-value" class:text-success={project.profitability?.grossMarginAmount >= 0} class:text-danger={project.profitability?.grossMarginAmount < 0}>
            {formatCurrency(project.profitability?.grossMarginAmount || 0)}
          </span>
          <span class="kpi-sub">Redditività: <strong>{project.profitability?.grossMarginPercent}%</strong></span>
        </div>
      </div>

      <div class="kpi-card">
        <div class="kpi-body">
          <span class="kpi-label">Scostamento di Budget</span>
          <span class="kpi-value" class:text-danger={project.profitability?.isOverBudget} class:text-success={!project.profitability?.isOverBudget}>
            {project.profitability?.budgetVarianceAmount > 0 ? `+${formatCurrency(project.profitability?.budgetVarianceAmount)}` : formatCurrency(project.profitability?.budgetVarianceAmount || 0)}
          </span>
          <span class="kpi-sub">{project.profitability?.isOverBudget ? 'Sforamento rispetto al preventivo' : 'Spesa al di sotto del budget'}</span>
        </div>
      </div>
    </div>

    <!-- 3. Navigazione a Schede -->
    <div class="tabs-nav">
      <button class="tab-btn" class:active={activeTab === 'overview'} onclick={() => activeTab = 'overview'}>
        <Calculator size={16} />
        <span>Bilancio Economico & Budget</span>
      </button>
      <button class="tab-btn" class:active={activeTab === 'costs'} onclick={() => activeTab = 'costs'}>
        <Layers size={16} />
        <span>Registro Costi Analitico ({costItems.length})</span>
      </button>
      <button class="tab-btn" class:active={activeTab === 'revenues'} onclick={() => activeTab = 'revenues'}>
        <DollarSign size={16} />
        <span>Ricavi & Fatturazione</span>
      </button>
    </div>

    <!-- Contenuto Schede -->
    {#if activeTab === 'overview'}
      <div class="tab-content card">
        <h3 class="section-title">Confronto Analitico Budget vs Consuntivo Reale</h3>
        
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Categoria di Spesa</th>
                <th class="text-right">Budget Stimato</th>
                <th class="text-right">Consuntivo Reale</th>
                <th class="text-right">Scostamento (€)</th>
                <th class="text-right">Incidenza (%)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Manodopera Interna & Operatori</strong> ({project.actuals?.laborHoursTotal || 0} ore lavorate)</td>
                <td class="text-right text-muted">{formatCurrency(project.budget?.labor || 0)}</td>
                <td class="text-right font-medium">{formatCurrency(project.actuals?.labor || 0)}</td>
                <td class="text-right" class:text-danger={(project.actuals?.labor || 0) > (project.budget?.labor || 0)}>
                  {formatCurrency((project.actuals?.labor || 0) - (project.budget?.labor || 0))}
                </td>
                <td class="text-right">{calcIncidence(project.actuals?.labor, project.actuals?.total)}</td>
              </tr>
              <tr>
                <td><strong>Materiali da Magazzino (Scarichi FIFO)</strong> ({project.actuals?.materialsCountTotal || 0} articoli)</td>
                <td class="text-right text-muted">{formatCurrency(project.budget?.materials || 0)}</td>
                <td class="text-right font-medium">{formatCurrency(project.actuals?.materials || 0)}</td>
                <td class="text-right" class:text-danger={(project.actuals?.materials || 0) > (project.budget?.materials || 0)}>
                  {formatCurrency((project.actuals?.materials || 0) - (project.budget?.materials || 0))}
                </td>
                <td class="text-right">{calcIncidence(project.actuals?.materials, project.actuals?.total)}</td>
              </tr>
              <tr>
                <td><strong>Mezzi & Noli Attrezzature</strong></td>
                <td class="text-right text-muted">{formatCurrency(project.budget?.equipment || 0)}</td>
                <td class="text-right font-medium">{formatCurrency(project.actuals?.equipment || 0)}</td>
                <td class="text-right" class:text-danger={(project.actuals?.equipment || 0) > (project.budget?.equipment || 0)}>
                  {formatCurrency((project.actuals?.equipment || 0) - (project.budget?.equipment || 0))}
                </td>
                <td class="text-right">{calcIncidence(project.actuals?.equipment, project.actuals?.total)}</td>
              </tr>
              <tr>
                <td><strong>Subappalti & Terzisti Esterni</strong></td>
                <td class="text-right text-muted">{formatCurrency(project.budget?.subcontractor || 0)}</td>
                <td class="text-right font-medium">{formatCurrency(project.actuals?.subcontractor || 0)}</td>
                <td class="text-right" class:text-danger={(project.actuals?.subcontractor || 0) > (project.budget?.subcontractor || 0)}>
                  {formatCurrency((project.actuals?.subcontractor || 0) - (project.budget?.subcontractor || 0))}
                </td>
                <td class="text-right">{calcIncidence(project.actuals?.subcontractor, project.actuals?.total)}</td>
              </tr>
              <tr>
                <td><strong>Altro / Spese Generali</strong></td>
                <td class="text-right text-muted">{formatCurrency(project.budget?.other || 0)}</td>
                <td class="text-right font-medium">{formatCurrency(project.actuals?.other || 0)}</td>
                <td class="text-right" class:text-danger={(project.actuals?.other || 0) > (project.budget?.other || 0)}>
                  {formatCurrency((project.actuals?.other || 0) - (project.budget?.other || 0))}
                </td>
                <td class="text-right">{calcIncidence(project.actuals?.other, project.actuals?.total)}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr class="table-total-row">
                <th>TOTALE SPESA CONSUNTIVATA</th>
                <th class="text-right">{formatCurrency(project.budget?.total || 0)}</th>
                <th class="text-right">{formatCurrency(project.actuals?.total || 0)}</th>
                <th class="text-right" class:text-danger={project.profitability?.isOverBudget}>
                  {formatCurrency(project.profitability?.budgetVarianceAmount || 0)}
                </th>
                <th class="text-right">100.0%</th>
              </tr>
            </tfoot>
          </table>
        </div>

        <div class="bars-section">
          <h4 class="sub-title">Composizione Spesa Consuntivata</h4>
          <JobCostBreakdownBars actuals={project.actuals} />
        </div>
      </div>
    {:else if activeTab === 'costs'}
      <div class="tab-content card">
        <div class="tab-header-row">
          <div>
            <h3 class="section-title">Registro Movimenti di Costo</h3>
            <p class="section-sub">Movimenti generati da bolle, scarichi magazzino FIFO e spese manuali</p>
          </div>
          {#if project.status !== 'chiusa'}
            <button class="btn btn-primary btn-sm" onclick={() => showAddCostModal = true}>
              <Plus size={14} />
              <span>Inserisci Spesa Manuale</span>
            </button>
          {/if}
        </div>

        {#if costItems.length === 0}
          <div class="empty-state">
            <Layers size={36} class="text-muted" />
            <p>Nessun movimento analitico registrato. Clicca su "Riconcilia Dati" in alto per estrarre bolle e materiali.</p>
          </div>
        {:else}
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Categoria</th>
                  <th>Descrizione</th>
                  <th>Fornitore / Operatore</th>
                  <th>Fonte</th>
                  <th class="text-right">Q.tà</th>
                  <th class="text-right">Costo Unit.</th>
                  <th class="text-right">Totale Costo</th>
                </tr>
              </thead>
              <tbody>
                {#each costItems as item}
                  <tr>
                    <td>{item.date}</td>
                    <td><span class="badge-cat {item.category}">{formatCategoryLabel(item.category)}</span></td>
                    <td><strong>{item.description}</strong></td>
                    <td>{item.workerOrSupplierName || '—'}</td>
                    <td>
                      <span class="badge-source">{item.sourceType}</span>
                    </td>
                    <td class="text-right">{item.quantity}</td>
                    <td class="text-right text-muted">{formatCurrency(item.unitCost)}</td>
                    <td class="text-right font-medium">{formatCurrency(item.totalCost)}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      </div>
    {:else if activeTab === 'revenues'}
      <div class="tab-content card">
        <h3 class="section-title">Ricavi Contrattuali & Fatture Collegate</h3>
        <div class="revenues-summary-box">
          <div class="rev-card">
            <span class="rev-label">Preventivo / Contratto</span>
            <span class="rev-val">{formatCurrency(project.revenues?.contractValue || 0)}</span>
            <span class="rev-sub">{project.contractTitle || 'Nessun contratto associato'}</span>
          </div>
          <div class="rev-card">
            <span class="rev-label">Fatturato Emesso</span>
            <span class="rev-val text-primary">{formatCurrency(project.revenues?.invoicedTotal || 0)}</span>
            <span class="rev-sub">Totale imponibile fatturato</span>
          </div>
          <div class="rev-card">
            <span class="rev-label">Incassato Effettivo</span>
            <span class="rev-val text-success">{formatCurrency(project.revenues?.paidTotal || 0)}</span>
            <span class="rev-sub">Liquidità incassata a saldo</span>
          </div>
        </div>
      </div>
    {/if}
  {/if}

  <!-- Modal Inserimento Spesa Manuale -->
  {#if showAddCostModal}
    <div class="modal-backdrop">
      <div class="modal-card">
        <div class="modal-header">
          <h3>Inserisci Spesa o Subappalto Cantiere</h3>
          <button class="btn-close" onclick={() => showAddCostModal = false} aria-label="Chiudi"><X size={16} /></button>
        </div>
        <form onsubmit={handleAddManualCost} class="modal-body">
          <div class="form-group">
            <label for="mCat">Categoria Spesa *</label>
            <select id="mCat" bind:value={newCostCategory} class="form-control">
              <option value="subcontractor">Subappalto / Ditta Terza</option>
              <option value="equipment">Nolo Mezzo / Macchinario</option>
              <option value="materials">Materiale Extra Fuori Magazzino</option>
              <option value="labor">Manodopera Extra</option>
              <option value="other">Altra Spesa Generale</option>
            </select>
          </div>

          <div class="form-group">
            <label for="mDesc">Descrizione Spesa *</label>
            <input type="text" id="mDesc" bind:value={newCostDesc} placeholder="es. Nolo cestello elevatore 2gg..." class="form-control" required />
          </div>

          <div class="form-group">
            <label for="mSupp">Fornitore / Artigiano</label>
            <input type="text" id="mSupp" bind:value={newCostSupplier} placeholder="Nome impresa fornitrice..." class="form-control" />
          </div>

          <div class="form-row">
            <div class="form-group flex-1">
              <label for="mDate">Data</label>
              <input type="date" id="mDate" bind:value={newCostDate} class="form-control" required />
            </div>
            <div class="form-group flex-1">
              <label for="mQty">Quantità</label>
              <input type="number" id="mQty" min="1" step="0.5" bind:value={newCostQty} class="form-control" required />
            </div>
            <div class="form-group flex-1">
              <label for="mUnit">Costo Unitario (€) *</label>
              <input type="number" id="mUnit" min="0" step="0.01" bind:value={newCostUnitCost} class="form-control" required />
            </div>
          </div>

          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" onclick={() => showAddCostModal = false}>Annulla</button>
            <button type="submit" class="btn btn-primary" disabled={addingCost}>
              {addingCost ? 'Salvataggio...' : 'Aggiungi al Consuntivo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  {/if}
</div>

<style>
  .job-detail-page {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    width: 100%;
  }

  .page-top-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 1rem;
  }

  .title-with-icon {
    display: flex;
    align-items: center;
    gap: 0.85rem;
  }

  .header-icon-box {
    width: 46px;
    height: 46px;
    border-radius: 12px;
    background: rgba(59, 130, 246, 0.12);
    color: #2563eb;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .header-icon-box.closed {
    background: rgba(107, 114, 128, 0.15);
    color: #4b5563;
  }

  .code-badge-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.2rem;
  }

  .project-code {
    font-size: 0.775rem;
    font-weight: 700;
    color: var(--color-primary-600, #2563eb);
  }

  .page-title {
    font-size: 1.5rem;
    font-weight: 700;
    margin: 0;
    color: var(--color-text-main, #0f172a);
  }

  .meta-row {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    font-size: 0.825rem;
    color: var(--color-text-muted, #64748b);
    margin-top: 0.35rem;
  }

  .meta-item {
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }

  .actions-group {
    display: flex;
    align-items: center;
    gap: 0.65rem;
  }

  .freeze-banner {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.85rem 1.15rem;
    background: rgba(16, 185, 129, 0.08);
    border: 1px solid rgba(16, 185, 129, 0.25);
    border-radius: 12px;
    font-size: 0.85rem;
    color: #065f46;
  }

  .kpi-grid-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 1rem;
  }

  .kpi-card {
    background: var(--color-surface, #ffffff);
    border: 1px solid var(--color-border, #e2e8f0);
    border-radius: 14px;
    padding: 1.1rem;
    box-shadow: 0 1px 3px rgba(0,0,0,0.03);
  }

  .kpi-label {
    font-size: 0.75rem;
    color: var(--color-text-muted, #64748b);
    text-transform: uppercase;
    font-weight: 600;
  }

  .kpi-value {
    font-size: 1.4rem;
    font-weight: 700;
    margin: 0.2rem 0;
  }

  .kpi-sub {
    font-size: 0.75rem;
    color: var(--color-text-muted, #64748b);
  }

  .tabs-nav {
    display: flex;
    gap: 0.5rem;
    border-bottom: 1px solid var(--color-border, #e2e8f0);
  }

  .tab-btn {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    padding: 0.65rem 1.15rem;
    border: none;
    background: none;
    color: var(--color-text-muted, #64748b);
    font-weight: 600;
    font-size: 0.875rem;
    cursor: pointer;
    border-bottom: 2px solid transparent;
    transition: all 0.15s ease;
  }

  .tab-btn:hover {
    color: var(--color-text-main, #0f172a);
  }

  .tab-btn.active {
    color: var(--color-primary-600, #2563eb);
    border-bottom-color: var(--color-primary-600, #2563eb);
  }

  .tab-content {
    background: var(--color-surface, #ffffff);
    border: 1px solid var(--color-border, #e2e8f0);
    border-radius: 14px;
    padding: 1.25rem;
  }

  .section-title {
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--color-text-main, #1e293b);
    margin: 0 0 0.5rem 0;
  }

  .section-sub {
    font-size: 0.825rem;
    color: var(--color-text-muted, #64748b);
    margin: 0 0 1rem 0;
  }

  .tab-header-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .table-responsive {
    overflow-x: auto;
    width: 100%;
  }

  .data-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;
  }

  .data-table th {
    background: var(--color-bg-subtle, #f8fafc);
    color: var(--color-text-muted, #475569);
    font-weight: 600;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--color-border, #e2e8f0);
    text-align: left;
  }

  .data-table td {
    padding: 0.85rem 1rem;
    border-bottom: 1px solid var(--color-border, #f1f5f9);
    color: var(--color-text-main, #1e293b);
  }

  .table-total-row {
    background: var(--color-bg-subtle, #f8fafc);
    border-top: 2px solid var(--color-border, #cbd5e1);
  }

  .table-total-row th {
    padding: 0.9rem 1rem;
    font-weight: 700;
  }

  .badge-status {
    padding: 0.2rem 0.5rem;
    border-radius: 9999px;
    font-size: 0.725rem;
    font-weight: 600;
  }

  .badge-status.in_corso { background: rgba(59, 130, 246, 0.1); color: #2563eb; }
  .badge-status.chiusa { background: rgba(107, 114, 128, 0.12); color: #374151; }

  .badge-cat {
    padding: 0.15rem 0.45rem;
    border-radius: 6px;
    font-size: 0.725rem;
    font-weight: 600;
  }

  .badge-cat.labor { background: rgba(59, 130, 246, 0.1); color: #2563eb; }
  .badge-cat.materials { background: rgba(139, 92, 246, 0.1); color: #7c3aed; }
  .badge-cat.equipment { background: rgba(245, 158, 11, 0.1); color: #d97706; }
  .badge-cat.subcontractor { background: rgba(6, 182, 212, 0.1); color: #0891b2; }
  .badge-cat.other { background: rgba(100, 116, 139, 0.1); color: #475569; }

  .badge-source {
    font-size: 0.7rem;
    color: var(--color-text-muted, #64748b);
    background: var(--color-bg-subtle, #f1f5f9);
    padding: 0.1rem 0.35rem;
    border-radius: 4px;
  }

  .bars-section {
    margin-top: 1.5rem;
    padding-top: 1.25rem;
    border-top: 1px solid var(--color-border, #e2e8f0);
  }

  .sub-title {
    font-size: 0.95rem;
    font-weight: 600;
    margin: 0 0 0.75rem 0;
  }

  .revenues-summary-box {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 1rem;
  }

  .rev-card {
    background: var(--color-bg-subtle, #f8fafc);
    border: 1px solid var(--color-border, #e2e8f0);
    border-radius: 12px;
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
  }

  .rev-label {
    font-size: 0.75rem;
    text-transform: uppercase;
    color: var(--color-text-muted, #64748b);
    font-weight: 600;
  }

  .rev-val {
    font-size: 1.5rem;
    font-weight: 700;
    margin: 0.35rem 0;
  }

  .rev-sub {
    font-size: 0.775rem;
    color: var(--color-text-muted, #64748b);
  }

  .text-right { text-align: right; }
  .text-success { color: #059669; }
  .text-danger { color: #dc2626; }
  .text-primary { color: #2563eb; }

  /* Modal */
  .modal-backdrop {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(15, 23, 42, 0.5);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 999;
    padding: 1rem;
  }

  .modal-card {
    background: var(--color-surface, #ffffff);
    border-radius: 14px;
    width: 100%;
    max-width: 520px;
    box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1);
    overflow: hidden;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.1rem 1.25rem;
    border-bottom: 1px solid var(--color-border, #e2e8f0);
  }

  .modal-header h3 {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 700;
  }

  .btn-close {
    background: none;
    border: none;
    font-size: 1rem;
    cursor: pointer;
    color: var(--color-text-muted, #94a3b8);
  }

  .modal-body {
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .form-row {
    display: flex;
    gap: 0.75rem;
  }

  .flex-1 { flex: 1; }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    margin-top: 0.5rem;
  }
</style>
