<script lang="ts">
  import { projectStore } from '$lib/stores/project';
  import { onMount } from 'svelte';
  import { ScheduleSettingsService } from '../../scheduling/scheduleSettingsService';
  import { ScheduleViewsService } from '../../scheduling/scheduleViewsService';
  import type { ScheduleSettings, ScheduleView } from '../../scheduling/schema';
  import { Card, Button } from '$lib';
  import { pageTitle } from '$lib/stores/page';
  import { toast } from '$lib/stores/toast.svelte';
  import { Calendar, Save, Settings, Plus, Trash2, ArrowUp, ArrowDown, Settings2 } from '@lucide/svelte';

  pageTitle.set('Configurazione Pianificazione & Agenda');

  let settings = $state<ScheduleSettings>({
    entityNaming: 'pianificazione',
    customSingularLabel: '',
    customPluralLabel: '',
    defaultSlot: 'giornata_intera'
  });

  let views = $state<ScheduleView[]>([]);
  let loading = $state(true);
  let savingSettings = $state(false);
  let savingViews = $state(false);

  // New View Form Modal/Inline state
  let showNewViewForm = $state(false);
  let newViewName = $state('');
  let newViewLayout = $state<'list' | 'matrix'>('matrix');
  let newViewYAxis = $state<'teams' | 'users' | 'vehicles' | 'places'>('teams');
  let newViewSources = $state<('intervention' | 'activity' | 'deadline')[]>(['intervention', 'activity', 'deadline']);

  onMount(async () => {
    try {
      const [s, v] = await Promise.all([
        ScheduleSettingsService.getSettings(),
        ScheduleViewsService.getViews()
      ]);
      settings = s;
      views = v;
    } catch (e) {
      console.error('Errore caricamento impostazioni scheduling:', e);
      toast.error('Impossibile caricare le impostazioni');
    } finally {
      loading = false;
    }
  });

  async function handleSaveSettings(e: SubmitEvent) {
    e.preventDefault();
    savingSettings = true;
    try {
      await ScheduleSettingsService.saveSettings(settings);
      toast.success('Impostazioni salvate con successo!');
    } catch (e) {
      console.error('Errore salvataggio impostazioni:', e);
      toast.error('Errore durante il salvataggio');
    } finally {
      savingSettings = false;
    }
  }

  async function handleSaveViews() {
    savingViews = true;
    try {
      await ScheduleViewsService.saveViews(views);
      toast.success('Viste di sistema aggiornate!');
    } catch (e) {
      console.error('Errore salvataggio viste:', e);
      toast.error('Errore salvataggio viste');
    } finally {
      savingViews = false;
    }
  }

  function addView() {
    if (!newViewName.trim()) {
      toast.error('Inserisci un nome per la vista');
      return;
    }

    const newView: ScheduleView = {
      id: 'view_' + Date.now(),
      name: newViewName.trim(),
      layout: newViewLayout,
      matrixYAxis: newViewLayout === 'matrix' ? newViewYAxis : undefined,
      filters: {
        sources: [...newViewSources]
      },
      order: views.length
    };

    views = [...views, newView];
    newViewName = '';
    showNewViewForm = false;
    handleSaveViews();
  }

  function deleteView(id: string) {
    if (views.length <= 1) {
      toast.error('Devi mantenere almeno una vista a sistema.');
      return;
    }
    views = views.filter(v => v.id !== id);
    handleSaveViews();
  }

  function moveView(index: number, direction: 'up' | 'down') {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= views.length) return;

    const temp = views[index];
    views[index] = views[targetIdx];
    views[targetIdx] = temp;
    views = [...views];
    handleSaveViews();
  }

  function toggleSourceFilter(sourcesArray: ('intervention' | 'activity' | 'deadline')[], source: 'intervention' | 'activity' | 'deadline') {
    if (sourcesArray.includes(source)) {
      return sourcesArray.filter(s => s !== source);
    } else {
      return [...sourcesArray, source];
    }
  }
</script>

<svelte:head>
  <title>Configurazione Pianificazione | {$projectStore?.projectName || 'ERP'}</title>
</svelte:head>

<div class="settings-page-container">
  <header class="page-header">
    <div class="header-title-box">
      <a href="/dashboard/settings" class="btn-module-list" title="Vai a Impostazioni" aria-label="Vai a Impostazioni">
        <Settings size={20} />
      </a>
      <div class="header-icon">
        <Calendar size={24} color="var(--color-primary-500)" />
      </div>
      <div>
        <h1 class="page-main-title">Configurazione Pianificazione & Agenda</h1>
        <p class="page-main-subtitle">Personalizza la denominazione agnostica e le Viste del Calendario.</p>
      </div>
    </div>
  </header>

  {#if loading}
    <div class="loading-state">Caricamento impostazioni...</div>
  {:else}
    <form onsubmit={handleSaveSettings}>
      <Card class="form-card">
        <h2 class="section-title">Denominazione Agnostica (Entity Naming)</h2>
        <p class="section-desc">Scegli come la funzionalità viene presentata nell'interfaccia (es. Pianificazione, Agenda, Programma Lavori, Turni).</p>

        <div class="form-grid">
          <div class="form-group span-2">
            <label for="entityNaming">Tipologia Denominazione *</label>
            <select id="entityNaming" bind:value={settings.entityNaming} class="form-control">
              <option value="pianificazione">Pianificazione (Singolare: Pianificazione | Plurale: Pianificazioni & Agenda)</option>
              <option value="agenda">Agenda Operativa (Singolare: Appuntamento Agenda | Plurale: Agenda Operativa)</option>
              <option value="programma">Programma Lavori (Singolare: Programma Lavoro | Plurale: Programma Lavori)</option>
              <option value="turni">Turni & Assegnazioni (Singolare: Turno | Plurale: Turni & Assegnazioni)</option>
              <option value="custom">Denominazione Personalizzata...</option>
            </select>
          </div>

          {#if settings.entityNaming === 'custom'}
            <div class="form-group">
              <label for="customSingular">Etichetta Singolare Personalizzata *</label>
              <input id="customSingular" type="text" bind:value={settings.customSingularLabel} placeholder="es. Assegnazione" required class="form-control" />
            </div>

            <div class="form-group">
              <label for="customPlural">Etichetta Plurale Personalizzata *</label>
              <input id="customPlural" type="text" bind:value={settings.customPluralLabel} placeholder="es. Assegnazioni Operative" required class="form-control" />
            </div>
          {/if}
        </div>

        <div class="form-actions">
          <Button variant="primary" type="submit" disabled={savingSettings}>
            <Save size={18} />
            <span>{savingSettings ? 'Salvataggio...' : 'Salva Impostazioni'}</span>
          </Button>
        </div>
      </Card>
    </form>

    <!-- SECTION: SYSTEM VIEWS CONFIGURATION -->
    <Card class="form-card mt-24">
      <div class="views-header">
        <div>
          <h2 class="section-title">Viste del Calendario (System Views)</h2>
          <p class="section-desc">Configura i Tab visibili nella pagina Agenda. Ogni vista definisce il layout (Lista o Matrice) e i filtri di origine.</p>
        </div>
        <button type="button" class="btn-add-view" onclick={() => showNewViewForm = !showNewViewForm}>
          <Plus size={16} />
          <span>{showNewViewForm ? 'Annulla' : 'Nuova Vista'}</span>
        </button>
      </div>

      {#if showNewViewForm}
        <div class="new-view-box">
          <h3>Aggiungi Nuova Vista di Sistema</h3>
          <div class="form-grid">
            <div class="form-group">
              <label for="viewName">Nome della Vista *</label>
              <input id="viewName" type="text" bind:value={newViewName} placeholder="es. Calendario Mezzi" class="form-control" />
            </div>

            <div class="form-group">
              <label for="viewLayout">Formato Layout *</label>
              <select id="viewLayout" bind:value={newViewLayout} class="form-control">
                <option value="matrix">Matrice (Griglia X/Y)</option>
                <option value="list">Lista Carte Completa</option>
              </select>
            </div>

            {#if newViewLayout === 'matrix'}
              <div class="form-group">
                <label for="viewYAxis">Raggruppamento Asse Y (Righe) *</label>
                <select id="viewYAxis" bind:value={newViewYAxis} class="form-control">
                  <option value="teams">Squadre & Risorse</option>
                  <option value="users">Operatori / Utenti Singoli</option>
                  <option value="vehicles">Mezzi & Attrezzature</option>
                  <option value="places">Luoghi / Cantieri</option>
                </select>
              </div>
            {/if}
          </div>

          <div class="view-actions">
            <Button variant="primary" type="button" onclick={addView}>
              <Save size={16} />
              <span>Crea Vista</span>
            </Button>
          </div>
        </div>
      {/if}

      <div class="views-list">
        {#each views as view, idx (view.id)}
          <div class="view-row">
            <div class="view-order-btns">
              <button type="button" class="btn-icon" disabled={idx === 0} onclick={() => moveView(idx, 'up')}>
                <ArrowUp size={14} />
              </button>
              <button type="button" class="btn-icon" disabled={idx === views.length - 1} onclick={() => moveView(idx, 'down')}>
                <ArrowDown size={14} />
              </button>
            </div>

            <div class="view-main-info">
              <span class="view-name">{view.name}</span>
              <span class="view-badge">
                {view.layout === 'matrix' ? `Matrice (${view.matrixYAxis || 'teams'})` : 'Lista Completa'}
              </span>
            </div>

            <div class="view-row-actions">
              <button type="button" class="btn-icon-danger" onclick={() => deleteView(view.id)} title="Elimina vista">
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        {/each}
      </div>
    </Card>
  {/if}
</div>

<style>
  .settings-page-container {
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
  .form-card {
    padding: 24px;
  }
  .section-title {
    font-size: 16px;
    font-weight: 600;
    margin: 0 0 4px 0;
  }
  .section-desc {
    font-size: 13px;
    color: var(--color-neutral-500);
    margin: 0 0 16px 0;
  }
  .form-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }
  .span-2 { grid-column: span 2; }
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
    background: white;
  }
  .form-actions {
    display: flex;
    justify-content: flex-end;
    margin-top: 24px;
    padding-top: 16px;
    border-top: 1px solid var(--color-neutral-100);
  }
  .loading-state {
    padding: 40px;
    text-align: center;
  }
  .mt-24 { margin-top: 24px; }

  .views-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }
  .btn-add-view {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    background: var(--color-primary-50);
    color: var(--color-primary-700);
    border: 1px solid var(--color-primary-200);
    border-radius: var(--radius-md);
    font-weight: 600;
    font-size: 13px;
    cursor: pointer;
  }
  .new-view-box {
    background: #f8fafc;
    border: 1px solid var(--color-neutral-200);
    border-radius: var(--radius-md);
    padding: 16px;
    margin-bottom: 20px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .new-view-box h3 {
    font-size: 14px;
    font-weight: 700;
    margin: 0;
  }
  .view-actions {
    display: flex;
    justify-content: flex-end;
    margin-top: 8px;
  }
  .views-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .view-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    background: white;
    border: 1px solid var(--color-neutral-200);
    border-radius: var(--radius-md);
  }
  .view-order-btns {
    display: flex;
    gap: 4px;
  }
  .view-main-info {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 1;
    margin-left: 12px;
  }
  .view-name {
    font-size: 14px;
    font-weight: 700;
    color: var(--color-neutral-800);
  }
  .view-badge {
    font-size: 11px;
    font-weight: 600;
    background: var(--color-neutral-100);
    color: var(--color-neutral-600);
    padding: 3px 8px;
    border-radius: 12px;
    text-transform: capitalize;
  }
  .btn-icon {
    background: none;
    border: 1px solid var(--color-neutral-200);
    padding: 4px 6px;
    border-radius: 4px;
    cursor: pointer;
    color: var(--color-neutral-600);
  }
  .btn-icon:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
  .btn-icon-danger {
    background: none;
    border: none;
    padding: 4px;
    color: #ef4444;
    cursor: pointer;
  }
</style>
