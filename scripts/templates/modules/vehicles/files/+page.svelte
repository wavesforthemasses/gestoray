<script lang="ts">
  import { projectStore } from '$lib/stores/project';
  import { onMount } from 'svelte';
  import { VehiclesService } from './vehicles.service';
  import { VehicleSettingsService } from './vehicleSettingsService';
  import type { VehicleItem, VehicleSettings } from './schema';
  import { Card, StatusBadge } from '$lib';
  import { pageTitle } from '$lib/stores/page';
  import { 
    Truck, 
    Plus, 
    Search, 
    CheckCircle2, 
    Wrench,
    Eye,
    Tag
  } from '@lucide/svelte';

  let settings = $state<VehicleSettings>({
    entityNaming: 'mezzo',
    customSingularLabel: '',
    customPluralLabel: '',
    prefix: 'VEH-',
    includeYear: true,
    numberPadding: 3,
    lastNumber: 0,
    lastCounterYear: new Date().getFullYear(),
    defaultStatus: 'disponibile'
  });

  let vehicles = $state<VehicleItem[]>([]);
  let loading = $state(true);
  let searchFilter = $state('');
  let statusFilter = $state<string>('all');

  let labels = $derived(VehicleSettingsService.getLabels(settings));

  let filteredVehicles = $derived(
    vehicles.filter(v => {
      const matchSearch = searchFilter === '' || 
        v.code.toLowerCase().includes(searchFilter.toLowerCase()) ||
        v.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
        (v.licensePlate || '').toLowerCase().includes(searchFilter.toLowerCase());
      
      const matchStatus = statusFilter === 'all' || v.status === statusFilter;
      return matchSearch && matchStatus;
    })
  );

  let availableCount = $derived(
    vehicles.filter(v => v.status === 'disponibile').length
  );
  let inUseCount = $derived(
    vehicles.filter(v => v.status === 'in_uso').length
  );
  let maintenanceCount = $derived(
    vehicles.filter(v => v.status === 'manutenzione').length
  );

  onMount(async () => {
    try {
      const [s, list] = await Promise.all([
        VehicleSettingsService.getSettings(),
        VehiclesService.getVehicles()
      ]);
      settings = s;
      vehicles = list;
      pageTitle.set(labels.plural);
    } catch (e) {
      console.error('Errore caricamento mezzi:', e);
    } finally {
      loading = false;
    }
  });

  function getStatusLabel(status: string): string {
    switch (status) {
      case 'disponibile': return 'Disponibile';
      case 'in_uso': return 'In Uso';
      case 'manutenzione': return 'In Manutenzione';
      case 'dismesso': return 'Dismesso';
      default: return status;
    }
  }
</script>

<svelte:head>
  <title>{labels.plural} | {$projectStore?.projectName || 'ERP'}</title>
</svelte:head>

<div class="vehicles-page-container">
  <header class="page-header">
    <div class="header-title-box">
      <div class="header-icon">
        <Truck size={26} color="var(--color-primary-500)" />
      </div>
      <div>
        <h1 class="page-main-title">{labels.plural}</h1>
        <p class="page-main-subtitle">Anagrafica e gestione del parco mezzi, furgoni, macchinari e strumenti.</p>
      </div>
    </div>

    <a href="/dashboard/vehicles/add" class="btn-create-vehicle">
      <Plus size={18} />
      <span>{labels.newBtn}</span>
    </a>
  </header>

  <div class="kpi-grid">
    <Card class="stat-card">
      <div class="kpi-card">
        <div class="kpi-icon-wrapper active">
          <Truck size={20} />
        </div>
        <div class="kpi-content">
          <span class="kpi-label">{labels.plural} Totali</span>
          <span class="kpi-value">{vehicles.length}</span>
        </div>
      </div>
    </Card>

    <Card class="stat-card">
      <div class="kpi-card">
        <div class="kpi-icon-wrapper success">
          <CheckCircle2 size={20} />
        </div>
        <div class="kpi-content">
          <span class="kpi-label">Disponibili</span>
          <span class="kpi-value text-success">{availableCount}</span>
        </div>
      </div>
    </Card>

    <Card class="stat-card">
      <div class="kpi-card">
        <div class="kpi-icon-wrapper warning">
          <Tag size={20} />
        </div>
        <div class="kpi-content">
          <span class="kpi-label">In Uso</span>
          <span class="kpi-value text-warning">{inUseCount}</span>
        </div>
      </div>
    </Card>

    <Card class="stat-card">
      <div class="kpi-card">
        <div class="kpi-icon-wrapper error">
          <Wrench size={20} />
        </div>
        <div class="kpi-content">
          <span class="kpi-label">In Manutenzione</span>
          <span class="kpi-value text-error">{maintenanceCount}</span>
        </div>
      </div>
    </Card>
  </div>

  <div class="search-toolbar">
    <div class="search-input-box">
      <Search size={18} class="search-icon" />
      <input 
        type="text" 
        placeholder="Cerca per codice, marca/modello o targa..." 
        bind:value={searchFilter} 
        class="search-input"
      />
    </div>

    <div class="filters-box">
      <select bind:value={statusFilter} class="filter-select">
        <option value="all">Tutti gli stati</option>
        <option value="disponibile">Disponibile</option>
        <option value="in_uso">In Uso</option>
        <option value="manutenzione">In Manutenzione</option>
        <option value="dismesso">Dismesso</option>
      </select>
    </div>
  </div>

  {#if loading}
    <div class="loading-box">Caricamento {labels.plural.toLowerCase()} in corso...</div>
  {:else if filteredVehicles.length === 0}
    <Card class="empty-card">
      <Truck size={40} color="var(--color-neutral-400)" />
      <h3>Nessun {labels.singular.toLowerCase()} trovato</h3>
      <p>Non ci sono {labels.plural.toLowerCase()} corrispondenti ai filtri impostati o ancora registrati.</p>
      <a href="/dashboard/vehicles/add" class="btn-create-vehicle secondary">
        <Plus size={16} />
        <span>Crea il primo {labels.singular.toLowerCase()}</span>
      </a>
    </Card>
  {:else}
    <Card class="table-card">
      <table class="data-table">
        <thead>
          <tr>
            <th>Codice</th>
            <th>Nome / Modello</th>
            <th>Tipo</th>
            <th>Targa / Seriale</th>
            <th>Stato</th>
            <th class="text-right">Azione</th>
          </tr>
        </thead>
        <tbody>
          {#each filteredVehicles as item (item.id)}
            <tr>
              <td class="font-mono font-bold">{item.code}</td>
              <td>
                <div class="vehicle-name">{item.name}</div>
              </td>
              <td><span class="badge-type">{item.type}</span></td>
              <td>{item.licensePlate || '-'}</td>
              <td>
                <StatusBadge status={item.status} label={getStatusLabel(item.status)} />
              </td>
              <td class="text-right">
                <a href={`/dashboard/vehicles/${item.id}`} class="btn-icon" title="Vedi dettaglio">
                  <Eye size={18} />
                </a>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </Card>
  {/if}
</div>

<style>
  .vehicles-page-container {
    display: flex;
    flex-direction: column;
    gap: 20px;
    width: 100%;
  }
  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .header-title-box {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .header-icon {
    width: 44px;
    height: 44px;
    border-radius: var(--radius-lg);
    background: var(--color-primary-50);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .page-main-title {
    font-size: 22px;
    font-weight: 700;
    margin: 0;
  }
  .page-main-subtitle {
    font-size: 13px;
    color: var(--color-neutral-500);
    margin: 2px 0 0 0;
  }
  .btn-create-vehicle {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    background: var(--color-primary-600);
    color: white;
    font-size: 14px;
    font-weight: 600;
    border-radius: var(--radius-md);
    text-decoration: none;
    transition: background 0.15s ease;
  }
  .btn-create-vehicle:hover {
    background: var(--color-primary-700);
  }
  .btn-create-vehicle.secondary {
    background: var(--color-neutral-100);
    color: var(--color-neutral-800);
    margin-top: 12px;
  }
  .kpi-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
  }
  .kpi-card {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .kpi-icon-wrapper {
    width: 42px;
    height: 42px;
    border-radius: var(--radius-md);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .kpi-icon-wrapper.active { background: var(--color-primary-50); color: var(--color-primary-600); }
  .kpi-icon-wrapper.success { background: #ECFDF5; color: #059669; }
  .kpi-icon-wrapper.warning { background: #FFFBEB; color: #D97706; }
  .kpi-icon-wrapper.error { background: #FEF2F2; color: #DC2626; }
  .kpi-content {
    display: flex;
    flex-direction: column;
  }
  .kpi-label { font-size: 12px; color: var(--color-neutral-500); font-weight: 500; }
  .kpi-value { font-size: 20px; font-weight: 700; color: var(--color-neutral-900); }
  .search-toolbar {
    display: flex;
    gap: 16px;
    align-items: center;
  }
  .search-input-box {
    position: relative;
    flex: 1;
  }
  .search-icon {
    position: absolute;
    left: 12px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--color-neutral-400);
  }
  .search-input {
    width: 100%;
    padding: 10px 12px 10px 38px;
    border: 1px solid var(--color-neutral-200);
    border-radius: var(--radius-md);
    font-size: 14px;
  }
  .filter-select {
    padding: 10px 14px;
    border: 1px solid var(--color-neutral-200);
    border-radius: var(--radius-md);
    font-size: 14px;
    background: white;
  }
  .loading-box {
    padding: 40px;
    text-align: center;
    color: var(--color-neutral-500);
  }
  .empty-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 48px;
    text-align: center;
    gap: 12px;
  }
  .data-table {
    width: 100%;
    border-collapse: collapse;
  }
  .data-table th, .data-table td {
    padding: 12px 16px;
    text-align: left;
    border-bottom: 1px solid var(--color-neutral-100);
  }
  .data-table th {
    font-size: 12px;
    font-weight: 600;
    color: var(--color-neutral-500);
    background: var(--color-neutral-50);
  }
  .badge-type {
    text-transform: capitalize;
    font-size: 12px;
    background: var(--color-neutral-100);
    padding: 2px 8px;
    border-radius: var(--radius-md);
  }
  .btn-icon {
    color: var(--color-neutral-500);
    padding: 6px;
    border-radius: var(--radius-md);
    display: inline-flex;
  }
  .btn-icon:hover { background: var(--color-neutral-100); color: var(--color-primary-600); }
</style>
