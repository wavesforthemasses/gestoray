<script lang="ts">
  import { onMount } from 'svelte';
  import { CantieriService } from './cantieri.service';
  import { CantiereSettingsService } from './cantiereSettingsService';
  import type { CantiereItem, CantiereStatus, CantiereSettings } from './schema';
  import { toast } from '$lib/stores/toast.svelte';
  import { Card, SearchToolbar, FilterSelect, Button } from '$lib';
  import { pageTitle } from '$lib/stores/page';
  import { 
    Building2, 
    Plus, 
    CheckCircle2, 
    AlertTriangle, 
    PauseCircle, 
    Euro, 
    User, 
    Eye, 
    Trash2, 
    MapPin, 
    TrendingUp,
    FileText
  } from '@lucide/svelte';

  pageTitle.set('Gestione Cantieri & Commesse');

  let settings = $state<CantiereSettings>({
    entityNaming: 'cantiere',
    prefix: 'CANTIERE-',
    includeYear: true,
    numberPadding: 3,
    lastNumber: 0,
    lastCounterYear: new Date().getFullYear(),
    defaultStatus: 'fase_contrattuale'
  });
  let labels = $derived(CantiereSettingsService.getLabels(settings));

  let cantieri = $state<CantiereItem[]>([]);
  let loading = $state(true);
  let searchQuery = $state('');
  let activeStatusTab = $state<'tutti' | CantiereStatus>('tutti');

  onMount(async () => {
    try {
      const [s, list] = await Promise.all([
        CantiereSettingsService.getSettings(),
        CantieriService.getCantieri()
      ]);
      settings = s;
      cantieri = list;
    } catch (e) {
      console.error('Errore caricamento cantieri:', e);
    } finally {
      loading = false;
    }
  });

  const filteredCantieri = $derived(
    cantieri.filter(item => {
      const matchesStatus = activeStatusTab === 'tutti' || item.status === activeStatusTab;
      const q = searchQuery.toLowerCase().trim();
      const matchesQuery = !q || 
        item.code.toLowerCase().includes(q) || 
        item.name.toLowerCase().includes(q) || 
        (item.clientName && item.clientName.toLowerCase().includes(q)) ||
        (item.address?.city && item.address.city.toLowerCase().includes(q));
      return matchesStatus && matchesQuery;
    })
  );

  // Financial KPI totals
  const totalActive = $derived(cantieri.filter(c => c.status === 'aperto' || c.status === 'fase_contrattuale').length);
  const totalEstimatedPortfolio = $derived(cantieri.reduce((acc, c) => acc + (c.estimatedAmount || 0), 0));
  const totalCompleted = $derived(cantieri.filter(c => c.status === 'completato').length);

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Sei sicuro di voler eliminare il ${labels.singular.toLowerCase()} "${name}"?`)) return;
    try {
      await CantieriService.deleteCantiere(id);
      cantieri = cantieri.filter(c => c.id !== id);
      toast.success(`${labels.singular} eliminato con successo.`);
    } catch (e: any) {
      toast.error('Errore durante l\'eliminazione: ' + e.message);
    }
  }

  function getStatusBadge(status: CantiereStatus) {
    switch (status) {
      case 'aperto':
        return { label: 'Aperto', theme: 'success', icon: CheckCircle2 };
      case 'fase_contrattuale':
        return { label: 'Fase Contrattuale', theme: 'info', icon: FileText };
      case 'in_pausa':
        return { label: 'In Pausa', theme: 'warning', icon: PauseCircle };
      case 'completato':
        return { label: 'Completato', theme: 'neutral', icon: CheckCircle2 };
      default:
        return { label: status, theme: 'neutral', icon: AlertTriangle };
    }
  }

  function formatCurrency(val: number): string {
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(val || 0);
  }
</script>

<div class="cantieri-page animate-fade-in">
  <div class="page-top-actions">
    <div>
      <h2 class="title-header">
        <Building2 size={28} color="var(--color-primary-600)" />
        {labels.plural}
      </h2>
      <p class="subtitle">Verifica avanzamento dello stato commesse, cantieri e progetti aziendali.</p>
    </div>

    <a href="/dashboard/cantieri/add" class="btn-primary-action">
      <Plus size={18} /> {labels.newBtn}
    </a>
  </div>

  <!-- KPI SUMMARY CARDS -->
  <div class="kpi-cards-grid">
    <div class="kpi-card">
      <div class="kpi-icon info"><Building2 size={24} /></div>
      <div class="kpi-content">
        <span class="kpi-num">{totalActive}</span>
        <span class="kpi-label">Commesse in Corso</span>
      </div>
    </div>

    <div class="kpi-card">
      <div class="kpi-icon success"><TrendingUp size={24} /></div>
      <div class="kpi-content">
        <span class="kpi-num">{formatCurrency(totalEstimatedPortfolio)}</span>
        <span class="kpi-label">Portafoglio Lavori Stimato</span>
      </div>
    </div>

    <div class="kpi-card">
      <div class="kpi-icon neutral"><CheckCircle2 size={24} /></div>
      <div class="kpi-content">
        <span class="kpi-num">{totalCompleted}</span>
        <span class="kpi-label">Cantieri Completati</span>
      </div>
    </div>
  </div>

  <!-- FILTER TABS & SEARCH -->
  <Card variant="glass" class="filters-card">
    <div class="filters-bar">
      <div class="status-tabs">
        <button 
          class="tab-btn" 
          class:active={activeStatusTab === 'tutti'} 
          onclick={() => activeStatusTab = 'tutti'}
        >
          Tutti ({cantieri.length})
        </button>
        <button 
          class="tab-btn" 
          class:active={activeStatusTab === 'fase_contrattuale'} 
          onclick={() => activeStatusTab = 'fase_contrattuale'}
        >
          Fase Contrattuale ({cantieri.filter(c => c.status === 'fase_contrattuale').length})
        </button>
        <button 
          class="tab-btn" 
          class:active={activeStatusTab === 'aperto'} 
          onclick={() => activeStatusTab = 'aperto'}
        >
          Aperto ({cantieri.filter(c => c.status === 'aperto').length})
        </button>
        <button 
          class="tab-btn" 
          class:active={activeStatusTab === 'in_pausa'} 
          onclick={() => activeStatusTab = 'in_pausa'}
        >
          In Pausa ({cantieri.filter(c => c.status === 'in_pausa').length})
        </button>
        <button 
          class="tab-btn" 
          class:active={activeStatusTab === 'completato'} 
          onclick={() => activeStatusTab = 'completato'}
        >
          Completato ({cantieri.filter(c => c.status === 'completato').length})
        </button>
      </div>

      <div class="search-box">
        <SearchToolbar 
          bind:searchQuery={searchQuery} 
          placeholder={`Cerca per ditta, codice o indirizzo...`} 
        />
      </div>
    </div>
  </Card>

  <!-- CANTIERI TABLE -->
  {#if loading}
    <div class="loader-box">
      <span class="spinner"></span>
      Caricamento {labels.plural.toLowerCase()} in corso...
    </div>
  {:else if filteredCantieri.length === 0}
    <Card class="empty-card">
      <div class="empty-state">
        <Building2 size={48} color="var(--color-neutral-400)" />
        <h3>Nessun {labels.singular.toLowerCase()} trovato</h3>
        <p>Non sono presenti {labels.plural.toLowerCase()} che corrispondono ai criteri di ricerca.</p>
        <a href="/dashboard/cantieri/add" class="btn-primary-action">
          <Plus size={16} /> Crea il Primo {labels.singular}
        </a>
      </div>
    </Card>
  {:else}
    <Card variant="glass" style="padding: 0; overflow: hidden;">
      <div class="table-container">
        <table class="cantieri-table">
          <thead>
            <tr>
              <th>CODICE</th>
              <th>CLIENTE</th>
              <th>CANTIERE / INDIRIZZO</th>
              <th>STATO</th>
              <th>AVANZAMENTO</th>
              <th>IMPORTO STIMATO</th>
              <th class="text-right">AZIONI</th>
            </tr>
          </thead>
          <tbody>
            {#each filteredCantieri as item}
              {@const badge = getStatusBadge(item.status)}
              {@const BadgeIcon = badge.icon}

              <tr>
                <td class="font-mono font-bold">
                  <a href="/dashboard/cantieri/{item.id}" class="code-link">
                    {item.code}
                  </a>
                </td>

                <td>
                  <div class="client-info font-semibold">
                    <User size={15} class="inline-icon" />
                    {item.clientName || 'Cliente N/D'}
                  </div>
                </td>

                <td>
                  <div class="location-box">
                    <span class="cantiere-name font-semibold">{item.name}</span>
                    {#if item.address?.city || item.address?.street}
                      <span class="address-sub">
                        <MapPin size={13} /> {item.address.street} {item.address.city}
                      </span>
                    {/if}
                  </div>
                </td>

                <td>
                  <span class="status-chip {badge.theme}">
                    <BadgeIcon size={13} /> {badge.label}
                  </span>
                </td>

                <td>
                  <div class="progress-box">
                    <div class="progress-bar-bg">
                      <div class="progress-bar-fill" style="width: {item.progress}%;"></div>
                    </div>
                    <span class="progress-text">{item.progress}%</span>
                  </div>
                </td>

                <td class="font-bold">
                  {formatCurrency(item.estimatedAmount)}
                </td>

                <td class="text-right actions-cell">
                  <a href="/dashboard/cantieri/{item.id}" class="action-btn" title="Dettaglio">
                    <Eye size={16} />
                  </a>
                  <button class="action-btn danger" onclick={() => handleDelete(item.id!, item.name)} title="Elimina">
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </Card>
  {/if}
</div>

<style>
  .cantieri-page {
    width: 100%;
    padding: 20px 0;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .page-top-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .title-header {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 26px;
    font-weight: 700;
    color: var(--color-neutral-800);
    margin: 0 0 4px 0;
  }
  .subtitle {
    font-size: 14px;
    color: var(--color-neutral-500);
    margin: 0;
  }

  .btn-primary-action {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: linear-gradient(135deg, var(--color-primary-500), var(--color-primary-600));
    color: white;
    padding: 10px 18px;
    border-radius: 8px;
    font-weight: 600;
    text-decoration: none;
    transition: all 0.2s ease;
  }
  .btn-primary-action:hover {
    opacity: 0.95;
    transform: translateY(-1px);
  }

  /* KPI CARDS */
  .kpi-cards-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: 16px;
  }
  .kpi-card {
    background: var(--color-surface, #ffffff);
    border: 1px solid var(--color-neutral-200);
    border-radius: 12px;
    padding: 18px;
    display: flex;
    align-items: center;
    gap: 16px;
  }
  .kpi-icon {
    width: 48px;
    height: 48px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .kpi-icon.info { background: #e0f2fe; color: #0284c7; }
  .kpi-icon.success { background: #dcfce7; color: #15803d; }
  .kpi-icon.neutral { background: #f1f5f9; color: #475569; }

  .kpi-content {
    display: flex;
    flex-direction: column;
  }
  .kpi-num {
    font-size: 20px;
    font-weight: 700;
    color: var(--color-neutral-900);
  }
  .kpi-label {
    font-size: 13px;
    color: var(--color-neutral-500);
  }

  /* FILTERS & TABS */
  .filters-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
  }
  .status-tabs {
    display: flex;
    gap: 6px;
    background: var(--color-neutral-100);
    padding: 4px;
    border-radius: 8px;
  }
  .tab-btn {
    padding: 6px 12px;
    border: none;
    background: none;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    color: var(--color-neutral-600);
    cursor: pointer;
    transition: all 0.15s ease;
  }
  .tab-btn.active {
    background: white;
    color: var(--color-primary-600);
    font-weight: 600;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  }

  /* TABLE */
  .table-container {
    width: 100%;
    overflow-x: auto;
  }
  .cantieri-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
  }
  .cantieri-table th {
    background: var(--color-neutral-50);
    padding: 12px 16px;
    text-align: left;
    font-size: 12px;
    font-weight: 600;
    color: var(--color-neutral-500);
    border-bottom: 1px solid var(--color-neutral-200);
  }
  .cantieri-table td {
    padding: 14px 16px;
    border-bottom: 1px solid var(--color-neutral-100);
    color: var(--color-neutral-800);
  }
  .code-link {
    color: var(--color-primary-600);
    text-decoration: none;
  }
  .code-link:hover { text-decoration: underline; }

  .location-box {
    display: flex;
    flex-direction: column;
  }
  .address-sub {
    font-size: 12px;
    color: var(--color-neutral-500);
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .status-chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 4px 10px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
  }
  .status-chip.success { background: #dcfce7; color: #15803d; }
  .status-chip.info { background: #e0f2fe; color: #0284c7; }
  .status-chip.warning { background: #fef3c7; color: #d97706; }
  .status-chip.neutral { background: #f1f5f9; color: #475569; }

  .progress-box {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 130px;
  }
  .progress-bar-bg {
    flex: 1;
    height: 8px;
    background: var(--color-neutral-200);
    border-radius: 4px;
    overflow: hidden;
  }
  .progress-bar-fill {
    height: 100%;
    background: var(--color-primary-500);
    border-radius: 4px;
  }
  .progress-text {
    font-size: 12px;
    font-weight: 600;
    color: var(--color-neutral-600);
  }

  .actions-cell {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 6px;
  }
  .action-btn {
    background: none;
    border: none;
    color: var(--color-neutral-500);
    padding: 6px;
    border-radius: 4px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    text-decoration: none;
  }
  .action-btn:hover { background: var(--color-neutral-100); color: var(--color-neutral-800); }
  .action-btn.danger:hover { background: #fee2e2; color: #dc2626; }

  .empty-state {
    text-align: center;
    padding: 40px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }
  .loader-box {
    padding: 40px;
    text-align: center;
    color: var(--color-neutral-500);
  }
</style>
