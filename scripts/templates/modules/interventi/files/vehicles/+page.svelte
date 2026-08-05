<script lang="ts">
  import { projectStore } from '$lib/stores/project';
  import { onMount } from 'svelte';
  import { VehiclesService } from '../vehicles.service';
  import type { VehicleItem } from '../schema';

  let vehicles = $state<VehicleItem[]>([]);
  let loading = $state(true);
  let showModal = $state(false);
  let saving = $state(false);
  let searchQuery = $state('');

  // Form State
  let editingId = $state<string | null>(null);
  let vehName = $state('');
  let vehPlate = $state('');
  let vehType = $state('Furgone');
  let vehStatus = $state<'disponibile' | 'in_uso' | 'manutenzione'>('disponibile');
  let vehNotes = $state('');

  onMount(async () => {
    try {
      await loadVehicles();
    } catch (e) {
      console.error('Errore caricamento veicoli:', e);
    } finally {
      loading = false;
    }
  });

  async function loadVehicles() {
    vehicles = await VehiclesService.getVehicles();
  }

  function openCreateModal() {
    editingId = null;
    vehName = '';
    vehPlate = '';
    vehType = 'Furgone';
    vehStatus = 'disponibile';
    vehNotes = '';
    showModal = true;
  }

  function openEditModal(v: VehicleItem) {
    editingId = v.id || null;
    vehName = v.name;
    vehPlate = v.plate || '';
    vehType = v.type || 'Furgone';
    vehStatus = v.status || 'disponibile';
    vehNotes = v.notes || '';
    showModal = true;
  }

  async function handleSaveVehicle(e: SubmitEvent) {
    e.preventDefault();
    if (!vehName.trim()) return;

    saving = true;
    try {
      if (editingId) {
        await VehiclesService.updateVehicle(editingId, {
          name: vehName.trim(),
          plate: vehPlate.trim(),
          type: vehType,
          status: vehStatus,
          notes: vehNotes.trim()
        });
      } else {
        await VehiclesService.createVehicle({
          name: vehName.trim(),
          plate: vehPlate.trim(),
          type: vehType,
          status: vehStatus,
          notes: vehNotes.trim()
        });
      }
      showModal = false;
      await loadVehicles();
    } catch (err: any) {
      alert('Errore salvataggio mezzo: ' + err.message);
    } finally {
      saving = false;
    }
  }

  async function handleStatusChange(v: VehicleItem, newStatus: 'disponibile' | 'in_uso' | 'manutenzione') {
    if (!v.id) return;
    try {
      await VehiclesService.updateVehicle(v.id, { status: newStatus });
      await loadVehicles();
    } catch (e: any) {
      alert('Errore aggiornamento stato mezzo: ' + e.message);
    }
  }

  async function handleDeleteVehicle(id?: string) {
    if (!id || !confirm('Sei sicuro di voler eliminare questo mezzo?')) return;
    try {
      await VehiclesService.deleteVehicle(id);
      await loadVehicles();
    } catch (e: any) {
      alert('Errore eliminazione mezzo: ' + e.message);
    }
  }

  let filteredVehicles = $derived(
    vehicles.filter(v => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return v.name.toLowerCase().includes(q) || (v.plate && v.plate.toLowerCase().includes(q));
    })
  );

  function getStatusBadge(status: string) {
    switch (status) {
      case 'disponibile': return { label: '🟢 Disponibile', class: 'badge-success' };
      case 'in_uso': return { label: '🟡 In Uso', class: 'badge-warning' };
      case 'manutenzione': return { label: '🔴 In Officina', class: 'badge-danger' };
      default: return { label: status, class: 'badge-secondary' };
    }
  }
</script>

<svelte:head>
  <title>Parco Mezzi & Attrezzature | {$projectStore?.projectName || 'ERP'}</title>
</svelte:head>

<div class="vehicles-page">
  <!-- HEADER -->
  <header class="page-header">
    <div>
      <a href="/dashboard/interventi" class="back-link">← Torna agli Interventi</a>
      <h1 class="page-title">🚚 Parco Mezzi & Attrezzature Aziendali</h1>
      <p class="page-subtitle">Gestisci veicoli, targhe, manutenzioni e disponibilità per gli interventi.</p>
    </div>
    <div class="header-actions">
      <button type="button" class="btn btn-primary" onclick={openCreateModal}>+ Nuovo Mezzo</button>
    </div>
  </header>

  <!-- MODULE SUB-NAV BAR -->
  <nav class="module-nav-bar">
    <a href="/dashboard/interventi" class="nav-tab">📋 Interventi & Cantieri</a>
    <a href="/dashboard/interventi/teams" class="nav-tab">👥 Squadre di Lavoro</a>
    <a href="/dashboard/interventi/vehicles" class="nav-tab active">🚚 Parco Mezzi ({vehicles.length})</a>
    <a href="/dashboard/settings/interventi" class="nav-tab tab-settings">⚙️ Impostazioni Modulo</a>
  </nav>

  <!-- SEARCH BOX -->
  <div class="filter-card">
    <input 
      type="text" 
      placeholder="🔍 Cerca veicolo per nome o targa..." 
      bind:value={searchQuery} 
      class="search-input"
    />
  </div>

  {#if loading}
    <div class="loading-state">Caricamento parco mezzi...</div>
  {:else if filteredVehicles.length === 0}
    <div class="empty-state">
      <span class="empty-icon">🚚</span>
      <h3>Nessun veicolo trovato</h3>
      <p>Registra i veicoli aziendali per gestire le prenotazioni ed evitare overbooking.</p>
      <button type="button" class="btn btn-primary" onclick={openCreateModal}>+ Registra Primo Mezzo</button>
    </div>
  {:else}
    <div class="table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>Nome Veicolo / Attrezzatura</th>
            <th>Targa / Seriale</th>
            <th>Tipologia</th>
            <th>Stato Operativo</th>
            <th>Note</th>
            <th class="text-right">Azioni</th>
          </tr>
        </thead>
        <tbody>
          {#each filteredVehicles as v}
            {@const statusBadge = getStatusBadge(v.status)}
            <tr>
              <td>
                <strong class="veh-title">{v.name}</strong>
              </td>
              <td>
                <span class="plate-badge">{v.plate || 'No Targa'}</span>
              </td>
              <td>
                <span>{v.type}</span>
              </td>
              <td>
                <select 
                  value={v.status} 
                  onchange={(e: any) => handleStatusChange(v, e.target.value)}
                  class="status-select"
                >
                  <option value="disponibile">🟢 Disponibile</option>
                  <option value="in_uso">🟡 In Uso</option>
                  <option value="manutenzione">🔴 In Officina / Manutenzione</option>
                </select>
              </td>
              <td>
                <span class="notes-text">{v.notes || '-'}</span>
              </td>
              <td class="text-right">
                <button type="button" class="btn-action" onclick={() => openEditModal(v)}>Modifica</button>
                <button type="button" class="btn-action-danger" onclick={() => handleDeleteVehicle(v.id)}>Elimina</button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}

  <!-- MODALE CREAZIONE / MODIFICA -->
  {#if showModal}
    <div class="modal-overlay">
      <div class="modal-card">
        <div class="modal-header">
          <h2>{editingId ? '✏️ Modifica Mezzo' : '🚚 Registra Nuovo Mezzo'}</h2>
          <button type="button" class="btn-close" onclick={() => showModal = false}>✕</button>
        </div>

        <form onsubmit={handleSaveVehicle}>
          <div class="modal-body">
            <div class="form-group">
              <label for="vName">Nome Veicolo / Modello *</label>
              <input type="text" id="vName" bind:value={vehName} placeholder="es. Furgone Iveco Daily 35C" required />
            </div>

            <div class="form-row">
              <div class="form-group">
                <label for="vPlate">Targa / Seriale</label>
                <input type="text" id="vPlate" bind:value={vehPlate} placeholder="es. AB123CD" />
              </div>

              <div class="form-group">
                <label for="vType">Tipologia</label>
                <select id="vType" bind:value={vehType}>
                  <option value="Furgone">Furgone</option>
                  <option value="Camion">Camion</option>
                  <option value="Piattaforma">Piattaforma Aerea</option>
                  <option value="Auto">Auto Aziendale</option>
                  <option value="Attrezzatura">Attrezzatura Speciale</option>
                </select>
              </div>

              <div class="form-group">
                <label for="vStatus">Stato Iniziale</label>
                <select id="vStatus" bind:value={vehStatus}>
                  <option value="disponibile">🟢 Disponibile</option>
                  <option value="in_uso">🟡 In Uso</option>
                  <option value="manutenzione">🔴 In Officina / Manutenzione</option>
                </select>
              </div>
            </div>

            <div class="form-group">
              <label for="vNotes">Note / Scadenze</label>
              <textarea id="vNotes" rows="2" bind:value={vehNotes} placeholder="es. Tagliando previsto per Ottobre..."></textarea>
            </div>
          </div>

          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" onclick={() => showModal = false}>Annulla</button>
            <button type="submit" class="btn btn-primary" disabled={saving}>
              {saving ? 'Salvataggio...' : (editingId ? 'Aggiorna Mezzo' : 'Registra Mezzo')}
            </button>
          </div>
        </form>
      </div>
    </div>
  {/if}
</div>

<style>
  .vehicles-page {
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .back-link { color: #64748b; text-decoration: none; font-size: 0.88rem; }
  .page-header { display: flex; justify-content: space-between; align-items: center; }
  .page-title { font-size: 1.6rem; font-weight: 800; margin: 0.2rem 0 0 0; }
  .page-subtitle { color: #64748b; font-size: 0.9rem; margin: 0.2rem 0 0 0; }

  .header-actions { display: flex; gap: 0.8rem; }

  .module-nav-bar {
    display: flex;
    gap: 0.5rem;
    background: #ffffff;
    border: 1px solid #e2e8f0;
    padding: 0.4rem;
    border-radius: 12px;
    overflow-x: auto;
  }

  .nav-tab {
    padding: 0.55rem 1rem;
    border-radius: 8px;
    font-size: 0.88rem;
    font-weight: 600;
    color: #64748b;
    text-decoration: none;
    white-space: nowrap;
    transition: all 0.15s ease;
  }

  .nav-tab:hover {
    background: #f1f5f9;
    color: #0f172a;
  }

  .nav-tab.active {
    background: #eff6ff;
    color: #2563eb;
  }

  .nav-tab.tab-settings {
    margin-left: auto;
    color: #64748b;
  }

  .filter-card { background: white; border: 1px solid #e2e8f0; padding: 0.8rem; border-radius: 12px; }
  .search-input { width: 100%; padding: 0.6rem 0.8rem; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.9rem; }

  .table-container { background: white; border-radius: 12px; border: 1px solid #e2e8f0; overflow-x: auto; }
  .data-table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
  .data-table th { background: #f8fafc; padding: 0.8rem 1rem; text-align: left; font-weight: 600; color: #475569; border-bottom: 1px solid #e2e8f0; }
  .data-table td { padding: 0.9rem 1rem; border-bottom: 1px solid #f1f5f9; }

  .veh-title { color: #0f172a; font-weight: 700; }
  .plate-badge { font-family: monospace; background: #f1f5f9; padding: 0.2rem 0.5rem; border-radius: 4px; font-weight: 700; }
  .status-select { padding: 0.35rem 0.6rem; border-radius: 6px; border: 1px solid #cbd5e1; font-size: 0.82rem; }

  .notes-text { font-size: 0.82rem; color: #64748b; }

  .btn { padding: 0.6rem 1.2rem; border-radius: 8px; font-weight: 600; cursor: pointer; border: none; text-decoration: none; font-size: 0.88rem; display: inline-flex; align-items: center; }
  .btn-primary { background: #3b82f6; color: white; }
  .btn-secondary { background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; }
  .btn-action { color: #2563eb; background: none; border: none; font-weight: 600; cursor: pointer; margin-right: 0.5rem; }
  .btn-action-danger { color: #ef4444; background: none; border: none; font-weight: 600; cursor: pointer; }

  /* MODAL */
  .modal-overlay { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.6); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 1rem; }
  .modal-card { background: white; border-radius: 12px; max-width: 550px; width: 100%; max-height: 90vh; overflow-y: auto; padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem; }
  .modal-header { display: flex; justify-content: space-between; align-items: center; }
  .btn-close { background: none; border: none; font-size: 1.2rem; cursor: pointer; }

  .modal-body { display: flex; flex-direction: column; gap: 1rem; }
  .form-group { display: flex; flex-direction: column; gap: 0.4rem; }
  .form-group label { font-size: 0.88rem; font-weight: 600; color: #334155; }
  .form-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 0.8rem; }

  input, select, textarea { padding: 0.6rem 0.8rem; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.9rem; }

  .modal-footer { display: flex; justify-content: flex-end; gap: 0.8rem; margin-top: 1rem; }
  .loading-state, .empty-state { text-align: center; padding: 3rem; background: white; border-radius: 12px; border: 1px solid #e2e8f0; }
  .empty-icon { font-size: 3rem; display: block; margin-bottom: 0.5rem; }
  .text-right { text-align: right; }
</style>
