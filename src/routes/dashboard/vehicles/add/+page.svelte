<script lang="ts">
  import { projectStore } from '$lib/stores/project';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { VehiclesService } from '../vehicles.service';
  import { VehicleSettingsService } from '../vehicleSettingsService';
  import type { VehicleSettings, VehicleType, VehicleStatus } from '../schema';
  import { pageTitle } from '$lib/stores/page';
  import { Card, Button } from '$lib';
  import { toast } from '$lib/stores/toast.svelte';
  import { Truck, ArrowLeft, Save } from '@lucide/svelte';

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

  let labels = $derived(VehicleSettingsService.getLabels(settings));

  let name = $state('');
  let type = $state<VehicleType>('furgone');
  let licensePlate = $state('');
  let status = $state<VehicleStatus>('disponibile');
  let notes = $state('');
  let saving = $state(false);

  onMount(async () => {
    try {
      settings = await VehicleSettingsService.getSettings();
      status = settings.defaultStatus || 'disponibile';
      pageTitle.set(`Nuovo ${labels.singular}`);
    } catch (e) {
      console.error('Errore caricamento impostazioni:', e);
    }
  });

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error(`Inserisci il nome / modello del ${labels.singular.toLowerCase()}`);
      return;
    }

    saving = true;
    try {
      await VehiclesService.createVehicle({
        name,
        type,
        licensePlate,
        status,
        notes
      });
      toast.success(`${labels.singular} creato con successo!`);
      goto('/dashboard/vehicles');
    } catch (e) {
      console.error('Errore salvataggio mezzo:', e);
      toast.error('Errore durante il salvataggio');
    } finally {
      saving = false;
    }
  }
</script>

<svelte:head>
  <title>Nuovo {labels.singular} | {$projectStore?.projectName || 'ERP'}</title>
</svelte:head>

<div class="add-vehicle-container">
  <header class="page-header">
    <div class="header-title-box">
      <a href="/dashboard/vehicles" class="btn-back" title="Torna alla lista">
        <ArrowLeft size={20} />
      </a>
      <div class="header-icon">
        <Truck size={24} color="var(--color-primary-500)" />
      </div>
      <div>
        <h1 class="page-main-title">{labels.newBtn}</h1>
        <p class="page-main-subtitle">Inserisci i dati per registrare un nuovo {labels.singular.toLowerCase()} nel parco aziendale.</p>
      </div>
    </div>
  </header>

  <form onsubmit={handleSubmit}>
    <Card class="form-card">
      <div class="form-grid">
        <div class="form-group span-2">
          <label for="name">Nome / Modello *</label>
          <input 
            id="name" 
            type="text" 
            bind:value={name} 
            placeholder="es. Fiat Ducato 35 / Escavatore Cat 302" 
            required 
            class="form-control"
          />
        </div>

        <div class="form-group">
          <label for="type">Tipologia</label>
          <select id="type" bind:value={type} class="form-control">
            <option value="furgone">Furgone</option>
            <option value="autocarro">Autocarro</option>
            <option value="macchinario">Macchinario</option>
            <option value="attrezzatura">Attrezzatura</option>
            <option value="altro">Altro</option>
          </select>
        </div>

        <div class="form-group">
          <label for="licensePlate">Targa / Numero Seriale</label>
          <input 
            id="licensePlate" 
            type="text" 
            bind:value={licensePlate} 
            placeholder="es. AB123CD" 
            class="form-control"
          />
        </div>

        <div class="form-group">
          <label for="status">Stato Operativo</label>
          <select id="status" bind:value={status} class="form-control">
            <option value="disponibile">Disponibile</option>
            <option value="in_uso">In Uso</option>
            <option value="manutenzione">In Manutenzione</option>
            <option value="dismesso">Dismesso</option>
          </select>
        </div>

        <div class="form-group span-2">
          <label for="notes">Note Aggiuntive</label>
          <textarea 
            id="notes" 
            bind:value={notes} 
            rows="3" 
            placeholder="Eventuali note su scadenze bollo, assicurazione o tagliandi..." 
            class="form-control"
          ></textarea>
        </div>
      </div>

      <div class="form-actions">
        <a href="/dashboard/vehicles" class="btn-cancel">Annulla</a>
        <Button variant="primary" type="submit" disabled={saving}>
          <Save size={18} />
          <span>{saving ? 'Salvataggio...' : `Salva ${labels.singular}`}</span>
        </Button>
      </div>
    </Card>
  </form>
</div>

<style>
  .add-vehicle-container {
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
  .page-main-title {
    font-size: 20px;
    font-weight: 700;
    margin: 0;
  }
  .page-main-subtitle {
    font-size: 13px;
    color: var(--color-neutral-500);
    margin: 2px 0 0 0;
  }
  .form-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    padding: 8px 0;
  }
  .span-2 {
    grid-column: span 2;
  }
  .form-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .form-control {
    padding: 10px 12px;
    border: 1px solid var(--color-neutral-200);
    border-radius: var(--radius-md);
    font-size: 14px;
  }
  .form-actions {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 12px;
    margin-top: 24px;
    padding-top: 16px;
    border-top: 1px solid var(--color-neutral-100);
  }
  .btn-cancel {
    padding: 8px 16px;
    color: var(--color-neutral-600);
    text-decoration: none;
    font-size: 14px;
  }
</style>
