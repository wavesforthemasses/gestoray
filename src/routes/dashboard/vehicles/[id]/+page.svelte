<script lang="ts">
  import { projectStore } from '$lib/stores/project';
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { VehiclesService } from '../vehicles.service';
  import { VehicleSettingsService } from '../vehicleSettingsService';
  import type { VehicleItem, VehicleSettings } from '../schema';
  import { Card, StatusBadge, Button } from '$lib';
  import { pageTitle } from '$lib/stores/page';
  import { toast } from '$lib/stores/toast.svelte';
  import { Truck, ArrowLeft, Edit3, Trash2 } from '@lucide/svelte';

  let vehicleId = $derived($page.params.id || '');
  let vehicle = $state<VehicleItem | null>(null);
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

  let loading = $state(true);
  let deleting = $state(false);

  let labels = $derived(VehicleSettingsService.getLabels(settings));

  onMount(async () => {
    try {
      if (!vehicleId) return;
      const [s, data] = await Promise.all([
        VehicleSettingsService.getSettings(),
        VehiclesService.getVehicleById(vehicleId)
      ]);
      settings = s;
      vehicle = data;
      if (data) {
        pageTitle.set(`${data.code} - ${data.name}`);
      }
    } catch (e) {
      console.error('Errore caricamento dettaglio mezzo:', e);
      toast.error('Impossibile caricare il dettaglio');
    } finally {
      loading = false;
    }
  });

  async function handleDelete() {
    if (!vehicle) return;
    if (!confirm(`Sei sicuro di voler eliminare questo ${labels.singular.toLowerCase()}?`)) return;

    deleting = true;
    try {
      await VehiclesService.deleteVehicle(vehicle.id);
      toast.success(`${labels.singular} eliminato con successo`);
      goto('/dashboard/vehicles');
    } catch (e) {
      console.error('Errore eliminazione mezzo:', e);
      toast.error('Errore durante l\'eliminazione');
    } finally {
      deleting = false;
    }
  }

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
  <title>{vehicle ? vehicle.name : labels.singular} | {$projectStore?.projectName || 'ERP'}</title>
</svelte:head>

<div class="vehicle-detail-container">
  {#if loading}
    <div class="loading-state">Caricamento in corso...</div>
  {:else if !vehicle}
    <Card class="empty-card">
      <h2>{labels.singular} non trovato</h2>
      <p>L'elemento richiesto non esiste o è stato rimosso.</p>
      <a href="/dashboard/vehicles" class="btn-back-link">Torna alla lista</a>
    </Card>
  {:else}
    <header class="page-header">
      <div class="header-title-box">
        <a href="/dashboard/vehicles" class="btn-back" title="Torna alla lista">
          <ArrowLeft size={20} />
        </a>
        <div class="header-icon">
          <Truck size={24} color="var(--color-primary-500)" />
        </div>
        <div>
          <div class="code-badge">{vehicle.code}</div>
          <h1 class="page-main-title">{vehicle.name}</h1>
        </div>
      </div>

      <div class="header-actions">
        <a href={`/dashboard/vehicles/${vehicle.id}/edit`} class="btn-edit">
          <Edit3 size={16} />
          <span>Modifica</span>
        </a>
        <Button variant="danger" onclick={handleDelete} disabled={deleting} class="btn-delete">
          <Trash2 size={16} color="white" />
          <span>{deleting ? 'Eliminazione...' : 'Elimina'}</span>
        </Button>
      </div>
    </header>

    <div class="detail-grid">
      <Card class="detail-card">
        <h2 class="card-title">Informazioni Generali</h2>
        
        <div class="info-list">
          <div class="info-item">
            <span class="info-label">Stato Operativo</span>
            <StatusBadge status={vehicle.status} label={getStatusLabel(vehicle.status)} />
          </div>
          <div class="info-item">
            <span class="info-label">Tipologia</span>
            <span class="info-value font-capitalize">{vehicle.type}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Targa / Seriale</span>
            <span class="info-value font-mono">{vehicle.licensePlate || 'N/D'}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Data Registrazione</span>
            <span class="info-value">{new Date(vehicle.createdAt).toLocaleDateString('it-IT')}</span>
          </div>
        </div>
      </Card>

      <Card class="detail-card">
        <h2 class="card-title">Note & Dettagli</h2>
        <p class="notes-content">{vehicle.notes || 'Nessuna nota aggiuntiva presente.'}</p>
      </Card>
    </div>
  {/if}
</div>

<style>
  .vehicle-detail-container {
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
  .btn-back {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: var(--radius-md);
    background: var(--color-neutral-100);
    color: var(--color-neutral-700);
    text-decoration: none;
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
  .code-badge {
    font-size: 12px;
    font-weight: 700;
    font-family: monospace;
    color: var(--color-primary-600);
  }
  .page-main-title {
    font-size: 20px;
    font-weight: 700;
    margin: 0;
  }
  .header-actions {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .btn-edit {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    background: var(--color-primary-600);
    color: white;
    font-size: 14px;
    font-weight: 500;
    border-radius: var(--radius-md);
    text-decoration: none;
  }
  .detail-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
  }
  .card-title {
    font-size: 16px;
    font-weight: 600;
    margin: 0 0 16px 0;
  }
  .info-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .info-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--color-neutral-100);
  }
  .info-label {
    font-size: 13px;
    color: var(--color-neutral-500);
  }
  .info-value {
    font-size: 14px;
    font-weight: 600;
  }
  .notes-content {
    font-size: 14px;
    color: var(--color-neutral-700);
    line-height: 1.5;
  }
  .loading-state {
    padding: 40px;
    text-align: center;
  }
  .empty-card {
    padding: 40px;
    text-align: center;
  }
  .font-capitalize { text-transform: capitalize; }
  .font-mono { font-family: monospace; }
</style>
