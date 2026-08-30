<script lang="ts">
  import { 
    Wrench, 
    ClipboardList, 
    Calendar, 
    Users, 
    Truck, 
    Settings, 
    Plus, 
    Clock, 
    Euro, 
    List 
  } from '@lucide/svelte';

  interface Props {
    locationLabel?: string;
    totalCount: number;
    plannedCount: number;
    totalActualHours: number;
    totalValueBolla: number;
    viewMode: 'list' | 'calendar';
  }

  let {
    locationLabel = 'Luogo',
    totalCount,
    plannedCount,
    totalActualHours,
    totalValueBolla,
    viewMode = $bindable('list')
  }: Props = $props();
</script>

<header class="page-header">
  <div class="header-titles">
    <h1 class="page-title"><Wrench size={22} class="inline-icon text-primary" /> Interventi & Rapportini di Lavoro</h1>
    <p class="page-subtitle">Pianifica, gestisci e consuntiva gli interventi sul campo per {locationLabel}.</p>
  </div>
  <div class="header-actions">
    <div class="view-toggle">
      <button 
        class="toggle-btn" 
        class:active={viewMode === 'list'} 
        onclick={() => viewMode = 'list'}
        title="Vista Elenco"
      >
        <List size={14} /> Elenco
      </button>
      <button 
        class="toggle-btn" 
        class:active={viewMode === 'calendar'} 
        onclick={() => viewMode = 'calendar'}
        title="Vista Calendario"
      >
        <Calendar size={14} /> Calendario
      </button>
    </div>

    <a href="/dashboard/interventi/teams" class="btn btn-secondary"><Users size={14} /> Squadre</a>
    <a href="/dashboard/interventi/vehicles" class="btn btn-secondary"><Truck size={14} /> Mezzi</a>
    <a href="/dashboard/settings/interventi" class="btn btn-icon-only" title="Impostazioni Modulo"><Settings size={16} /></a>
    <a href="/dashboard/interventi/add" class="btn btn-primary"><Plus size={16} /> Nuovo Intervento</a>
  </div>
</header>

<!-- KPI BAR -->
<div class="kpi-grid">
  <div class="kpi-card">
    <div class="kpi-icon"><ClipboardList size={22} class="text-primary" /></div>
    <div class="kpi-info">
      <span class="kpi-label">Totale Interventi</span>
      <span class="kpi-value">{totalCount}</span>
    </div>
  </div>
  <div class="kpi-card">
    <div class="kpi-icon warning"><Calendar size={22} class="text-warning" /></div>
    <div class="kpi-info">
      <span class="kpi-label">Pianificati / In Lavorazione</span>
      <span class="kpi-value">{plannedCount}</span>
    </div>
  </div>
  <div class="kpi-card">
    <div class="kpi-icon info"><Clock size={22} class="text-info" /></div>
    <div class="kpi-info">
      <span class="kpi-label">Ore Consuntivate Totali</span>
      <span class="kpi-value">{(Number(totalActualHours) || 0).toFixed(1)} h</span>
    </div>
  </div>
  <div class="kpi-card">
    <div class="kpi-icon success"><Euro size={22} class="text-success" /></div>
    <div class="kpi-info">
      <span class="kpi-label">Valore a Bolla Totale</span>
      <span class="kpi-value">€ {(Number(totalValueBolla) || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}</span>
    </div>
  </div>
</div>

<style>
  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    margin-bottom: 24px;
    flex-wrap: wrap;
  }
  .page-title {
    font-size: 24px;
    font-weight: 700;
    margin: 0 0 4px 0;
    color: var(--color-neutral-800);
  }
  .page-subtitle {
    margin: 0;
    font-size: 14px;
    color: var(--color-neutral-500);
  }
  .header-actions {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }
  .view-toggle {
    display: flex;
    background: var(--color-neutral-200);
    padding: 3px;
    border-radius: var(--radius-md);
  }
  .toggle-btn {
    border: none;
    background: transparent;
    padding: 6px 12px;
    font-size: 13px;
    font-weight: 600;
    border-radius: var(--radius-sm);
    cursor: pointer;
    color: var(--color-neutral-600);
    transition: all 0.2s ease;
  }
  .toggle-btn.active {
    background: var(--color-white);
    color: var(--color-neutral-900);
    box-shadow: var(--shadow-sm);
  }
  .btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    font-size: 14px;
    font-weight: 600;
    border-radius: var(--radius-md);
    text-decoration: none;
    cursor: pointer;
    border: none;
    transition: all 0.2s ease;
  }
  .btn-primary {
    background: var(--color-primary-500);
    color: var(--color-white);
  }
  .btn-primary:hover {
    background: var(--color-primary-600);
  }
  .btn-secondary {
    background: var(--color-white);
    color: var(--color-neutral-700);
    border: 1px solid var(--color-neutral-300);
  }
  .btn-secondary:hover {
    background: var(--color-neutral-100);
  }
  .btn-icon-only {
    padding: 8px 12px;
    background: var(--color-white);
    border: 1px solid var(--color-neutral-300);
    color: var(--color-neutral-700);
  }
  .kpi-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 16px;
    margin-bottom: 24px;
  }
  .kpi-card {
    background: var(--color-white);
    border: 1px solid var(--color-neutral-200);
    border-radius: var(--radius-lg);
    padding: 16px;
    display: flex;
    align-items: center;
    gap: 14px;
    box-shadow: var(--shadow-sm);
  }
  .kpi-icon {
    width: 44px;
    height: 44px;
    border-radius: var(--radius-md);
    background: var(--color-neutral-100);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
  }
  .kpi-icon.warning { background: #fef3c7; }
  .kpi-icon.info { background: #e0f2fe; }
  .kpi-icon.success { background: #dcfce7; }
  .kpi-info {
    display: flex;
    flex-direction: column;
  }
  .kpi-label {
    font-size: 12px;
    font-weight: 500;
    color: var(--color-neutral-500);
  }
  .kpi-value {
    font-size: 18px;
    font-weight: 700;
    color: var(--color-neutral-800);
  }
</style>
