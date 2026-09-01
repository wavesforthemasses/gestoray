<script lang="ts">
  import { onMount } from 'svelte';
  import { TargetsSettingsService } from '../../targets/targetsSettingsService';
  import { ChartSettingsService } from '$lib/services/chartSettingsService';
  import type { 
    TargetPlanDefinition, 
    TargetGranularity, 
    TargetSubjectType, 
    TargetCompilationMode, 
    TargetsGlobalSettings,
    TargetPlanPermissions 
  } from '../../targets/schema';
  import { 
    Target, 
    Plus, 
    Edit3, 
    Trash2, 
    Save, 
    X, 
    List, 
    Calendar, 
    Users, 
    Clock, 
    CheckSquare, 
    Sliders,
    Shield,
    AlertCircle
  } from '@lucide/svelte';
  import { toast } from '$lib/stores/toast.svelte';

  let plans = $state<TargetPlanDefinition[]>([]);
  let globalSettings = $state<TargetsGlobalSettings>({
    showCompanySummaryOnTop: true
  });
  let allKpis = $state<Array<{ id: string; name: string; acronym?: string; isCurrency?: boolean; description?: string; requiredModule?: string | null }>>([]);
  let isLoading = $state(true);

  // Modal State
  let isModalOpen = $state(false);
  let isEditing = $state(false);
  let isSaving = $state(false);
  let errorMessage = $state<string | null>(null);

  // Form State
  let planId = $state('');
  let planName = $state('');
  let planDescription = $state('');
  let granularity = $state<TargetGranularity>('mensile');
  let targetSubject = $state<TargetSubjectType>('user');
  let assignedRoles = $state<string[]>(['commerciale']);
  let selectedKpiIds = $state<string[]>([]);
  let compilationMode = $state<TargetCompilationMode>('manager_only');
  let daysBefore = $state(6);
  let daysAfter = $state(2);
  let defaultGrowthPct = $state(5);

  // Form Permissions State
  let userSelfView = $state(true);
  let userSelfEdit = $state(false);
  let userOthersViewRoles = $state<string[]>(['superadmin', 'direzione', 'amministrazione']);
  let userOthersEditRoles = $state<string[]>(['superadmin', 'direzione']);

  let teamMembersView = $state(true);
  let teamMembersEdit = $state(false);
  let teamLeaderView = $state(true);
  let teamLeaderEdit = $state(true);
  let teamOthersViewRoles = $state<string[]>(['superadmin', 'direzione', 'amministrazione']);
  let teamOthersEditRoles = $state<string[]>(['superadmin', 'direzione']);

  let companyViewRoles = $state<string[]>(['superadmin', 'direzione', 'amministrazione', 'commerciale', 'tecnico']);
  let companyEditRoles = $state<string[]>(['superadmin', 'direzione']);

  const AVAILABLE_ROLES = [
    { id: 'commerciale', label: 'Commerciale' },
    { id: 'tecnico', label: 'Tecnico / Operatore' },
    { id: 'amministrazione', label: 'Amministrazione' },
    { id: 'direzione', label: 'Direzione' },
    { id: 'superadmin', label: 'Superadmin' }
  ];

  onMount(async () => {
    await loadData();
  });

  async function loadData() {
    isLoading = true;
    try {
      const [loadedPlans, loadedSettings, loadedKpis] = await Promise.all([
        TargetsSettingsService.getPlans(),
        TargetsSettingsService.getGlobalSettings(),
        ChartSettingsService.getAllKpisMasterListSync()
      ]);
      plans = loadedPlans;
      globalSettings = loadedSettings;
      allKpis = loadedKpis;
    } catch (e) {
      console.error('Errore caricamento impostazioni target:', e);
      toast.error('Errore durante il caricamento delle impostazioni.');
    } finally {
      isLoading = false;
    }
  }

  async function saveGlobalSettings() {
    try {
      await TargetsSettingsService.saveGlobalSettings(globalSettings);
      toast.success('Impostazioni globali salvate!');
    } catch (e) {
      toast.error('Errore nel salvataggio delle impostazioni globali.');
    }
  }

  function openNewPlanModal() {
    isEditing = false;
    planId = `plan_${Date.now()}`;
    planName = '';
    planDescription = '';
    granularity = 'mensile';
    targetSubject = 'user';
    assignedRoles = ['commerciale'];
    selectedKpiIds = allKpis.slice(0, 3).map(k => k.id);
    compilationMode = 'manager_only';
    daysBefore = 6;
    daysAfter = 2;
    defaultGrowthPct = 5;

    userSelfView = true;
    userSelfEdit = false;
    userOthersViewRoles = ['superadmin', 'direzione', 'amministrazione'];
    userOthersEditRoles = ['superadmin', 'direzione'];

    teamMembersView = true;
    teamMembersEdit = false;
    teamLeaderView = true;
    teamLeaderEdit = true;
    teamOthersViewRoles = ['superadmin', 'direzione', 'amministrazione'];
    teamOthersEditRoles = ['superadmin', 'direzione'];

    companyViewRoles = ['superadmin', 'direzione', 'amministrazione', 'commerciale', 'tecnico'];
    companyEditRoles = ['superadmin', 'direzione'];

    errorMessage = null;
    isModalOpen = true;
  }

  function openEditPlanModal(plan: TargetPlanDefinition) {
    isEditing = true;
    planId = plan.id;
    planName = plan.name;
    planDescription = plan.description;
    granularity = plan.granularity;
    targetSubject = plan.targetSubject;
    assignedRoles = [...(plan.assignedRoles || ['commerciale'])];
    selectedKpiIds = [...(plan.kpiIds || [])];
    compilationMode = plan.compilationMode || 'manager_only';
    daysBefore = plan.submissionWindow?.daysBeforePeriodStart ?? 6;
    daysAfter = plan.submissionWindow?.daysAfterPeriodStart ?? 2;
    defaultGrowthPct = plan.defaultGrowthPct ?? 5;

    const p = plan.permissions;
    userSelfView = p?.userSelfView ?? true;
    userSelfEdit = p?.userSelfEdit ?? (plan.compilationMode === 'self_submission');
    userOthersViewRoles = p?.userOthersViewRoles ? [...p.userOthersViewRoles] : ['superadmin', 'direzione', 'amministrazione'];
    userOthersEditRoles = p?.userOthersEditRoles ? [...p.userOthersEditRoles] : ['superadmin', 'direzione'];

    teamMembersView = p?.teamMembersView ?? true;
    teamMembersEdit = p?.teamMembersEdit ?? false;
    teamLeaderView = p?.teamLeaderView ?? true;
    teamLeaderEdit = p?.teamLeaderEdit ?? true;
    teamOthersViewRoles = p?.teamOthersViewRoles ? [...p.teamOthersViewRoles] : ['superadmin', 'direzione', 'amministrazione'];
    teamOthersEditRoles = p?.teamOthersEditRoles ? [...p.teamOthersEditRoles] : ['superadmin', 'direzione'];

    companyViewRoles = p?.companyViewRoles ? [...p.companyViewRoles] : ['superadmin', 'direzione', 'amministrazione', 'commerciale', 'tecnico'];
    companyEditRoles = p?.companyEditRoles ? [...p.companyEditRoles] : ['superadmin', 'direzione'];

    errorMessage = null;
    isModalOpen = true;
  }

  function toggleRole(roleId: string) {
    if (assignedRoles.includes(roleId)) {
      if (assignedRoles.length > 1) {
        assignedRoles = assignedRoles.filter(r => r !== roleId);
      }
    } else {
      assignedRoles = [...assignedRoles, roleId];
    }
  }

  function toggleArrayRole(arr: string[], roleId: string): string[] {
    if (arr.includes(roleId)) {
      return arr.filter(r => r !== roleId);
    }
    return [...arr, roleId];
  }

  function toggleKpi(kpiId: string) {
    if (selectedKpiIds.includes(kpiId)) {
      if (selectedKpiIds.length > 1) {
        selectedKpiIds = selectedKpiIds.filter(k => k !== kpiId);
      }
    } else {
      selectedKpiIds = [...selectedKpiIds, kpiId];
    }
  }

  async function handleSavePlan(e: Event) {
    e.preventDefault();
    errorMessage = null;

    if (!planName.trim()) {
      errorMessage = 'Inserisci un nome per il piano di target.';
      return;
    }

    if (selectedKpiIds.length === 0) {
      errorMessage = 'Seleziona almeno un KPI da monitorare.';
      return;
    }

    isSaving = true;
    try {
      const permissions: TargetPlanPermissions = {
        userSelfView,
        userSelfEdit,
        userOthersViewRoles,
        userOthersEditRoles,
        teamMembersView,
        teamMembersEdit,
        teamLeaderView,
        teamLeaderEdit,
        teamOthersViewRoles,
        teamOthersEditRoles,
        companyViewRoles,
        companyEditRoles
      };

      const planObj: TargetPlanDefinition = {
        id: planId,
        name: planName.trim(),
        description: planDescription.trim(),
        granularity,
        targetSubject,
        assignedRoles,
        kpiIds: selectedKpiIds,
        compilationMode,
        submissionWindow: {
          enabled: true,
          daysBeforePeriodStart: Number(daysBefore) || 0,
          daysAfterPeriodStart: Number(daysAfter) || 0,
          allowLateEdit: false
        },
        permissions,
        defaultGrowthPct: Number(defaultGrowthPct) || 0,
        enabled: true,
        order: plans.length + 1
      };

      await TargetsSettingsService.savePlan(planObj);
      toast.success('Piano target salvato con successo!');
      isModalOpen = false;
      await loadData();
    } catch (err: any) {
      errorMessage = err?.message || 'Errore durante il salvataggio.';
      toast.error('Errore salvataggio piano target.');
    } finally {
      isSaving = false;
    }
  }

  async function handleDeletePlan(plan: TargetPlanDefinition) {
    if (!confirm(`Sei sicuro di voler eliminare il piano "${plan.name}"?`)) return;
    try {
      await TargetsSettingsService.deletePlan(plan.id);
      toast.success('Piano eliminato con successo.');
      await loadData();
    } catch (e) {
      toast.error('Errore durante l\'eliminazione del piano.');
    }
  }
</script>

<div class="settings-page-container">
  <!-- 1. Page Top Actions Bar -->
  <div class="page-top-actions">
    <div class="header-left">
      <div class="icon-wrap">
        <Target size={26} class="page-main-icon" />
      </div>
      <div>
        <h1 class="page-title">Configurazione Target & Budget</h1>
        <p class="page-subtitle">Gestione piani di performance, metriche KPI assegnate, finestre di compilazione e ruoli</p>
      </div>
    </div>

    <div class="header-actions">
      <a href="/dashboard/targets" class="btn btn-outline" title="Vai all'elenco target">
        <List size={16} />
        <span>Elenco Target</span>
      </a>

      <button class="btn btn-primary" onclick={openNewPlanModal} type="button">
        <Plus size={16} />
        <span>+ Aggiungi Piano Target</span>
      </button>
    </div>
  </div>

  <!-- 2. Global Preferences Card -->
  <div class="settings-card">
    <div class="card-header">
      <Sliders size={18} class="card-icon" />
      <h2 class="card-title">Preferenze Generali di Visualizzazione</h2>
    </div>

    <div class="preferences-grid">
      <label class="toggle-option">
        <input 
          type="checkbox" 
          bind:checked={globalSettings.showCompanySummaryOnTop} 
          onchange={saveGlobalSettings} 
        />
        <div class="toggle-text">
          <span class="toggle-title">Mostra Banner Riepilogo Aziendale in Cima</span>
          <span class="toggle-desc">Visualizza la somma complessiva degli obiettivi e dell'avanzamento aziendale in cima alla dashboard.</span>
        </div>
      </label>
    </div>
  </div>

  <!-- 3. Target Plans Grid -->
  <div class="plans-section">
    <h2 class="section-title">Piani di Target Configurati ({plans.length})</h2>

    {#if isLoading}
      <div class="loading-state">
        <div class="spinner"></div>
        <p>Caricamento piani target in corso...</p>
      </div>
    {:else if plans.length === 0}
      <div class="empty-state">
        <Target size={36} />
        <p>Nessun piano di target configurato. Crea il primo piano per iniziare.</p>
        <button class="btn btn-primary" onclick={openNewPlanModal} type="button">
          <Plus size={16} />
          <span>Crea Piano</span>
        </button>
      </div>
    {:else}
      <div class="plans-grid">
        {#each plans as plan (plan.id)}
          <div class="plan-card">
            <div class="plan-card-header">
              <div>
                <h3 class="plan-name">{plan.name}</h3>
                <p class="plan-desc">{plan.description || 'Nessuna descrizione.'}</p>
              </div>
              <div class="plan-actions">
                <button class="icon-btn" onclick={() => openEditPlanModal(plan)} title="Modifica piano" type="button">
                  <Edit3 size={16} />
                </button>
                <button class="icon-btn text-danger" onclick={() => handleDeletePlan(plan)} title="Elimina piano" type="button">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            <div class="plan-badges-row">
              <span class="badge badge-blue">
                <Calendar size={12} />
                <span>{plan.granularity}</span>
              </span>
              <span class="badge badge-purple">
                <Users size={12} />
                <span>Soggetto: {plan.targetSubject}</span>
              </span>
              <span class="badge badge-gray">
                <Clock size={12} />
                <span>Finestra: -{plan.submissionWindow?.daysBeforePeriodStart}gg / +{plan.submissionWindow?.daysAfterPeriodStart}gg</span>
              </span>
            </div>

            <div class="plan-meta-box">
              <div class="meta-item">
                <span class="meta-label">Ruoli Coinvolti:</span>
                <span class="meta-value">{plan.assignedRoles.join(', ')}</span>
              </div>

              <div class="meta-item">
                <span class="meta-label">Modalità Compilazione:</span>
                <span class="meta-value">{plan.compilationMode === 'manager_only' ? 'Solo Manager' : 'Auto-Compilazione con Approvazione'}</span>
              </div>
            </div>

            <div class="plan-kpis-box">
              <span class="kpi-box-title">KPI Monitorati ({plan.kpiIds.length}):</span>
              <div class="kpis-tags">
                {#each plan.kpiIds as kpiId}
                  {@const meta = allKpis.find(m => m.id === kpiId)}
                  <span class="kpi-pill" title={meta?.description}>
                    {meta?.name || kpiId} {meta?.acronym ? `(${meta.acronym})` : ''}
                  </span>
                {/each}
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<!-- Modal Crea/Modifica Piano Target -->
{#if isModalOpen}
  <div class="modal-backdrop" onclick={() => isModalOpen = false} role="presentation">
    <div class="modal-card" onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
      <div class="modal-header">
        <div class="header-title-wrap">
          <Target size={20} class="header-icon" />
          <h2 class="modal-title">{isEditing ? 'Modifica Piano Target' : 'Nuovo Piano Target'}</h2>
        </div>
        <button class="close-btn" onclick={() => isModalOpen = false} type="button">
          <X size={20} />
        </button>
      </div>

      {#if errorMessage}
        <div class="error-banner">
          <AlertCircle size={16} />
          <span>{errorMessage}</span>
        </div>
      {/if}

      <form onsubmit={handleSavePlan} class="modal-form">
        <!-- Dati Base -->
        <div class="form-row">
          <div class="form-group flex-2">
            <label class="form-label" for="pName">Nome del Piano *</label>
            <input id="pName" type="text" bind:value={planName} class="form-control" placeholder="es. Target Commerciali Mensili" required />
          </div>

          <div class="form-group flex-1">
            <label class="form-label" for="pGranularity">Granularità Temporale</label>
            <select id="pGranularity" bind:value={granularity} class="form-select">
              <option value="settimanale">Settimanale</option>
              <option value="mensile">Mensile</option>
              <option value="annuale">Annuale</option>
            </select>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label" for="pDesc">Descrizione Sintetica</label>
          <input id="pDesc" type="text" bind:value={planDescription} class="form-control" placeholder="Scopo e regole del piano di budgeting..." />
        </div>

        <div class="form-row">
          <div class="form-group flex-1">
            <label class="form-label" for="pSubject">Soggetto Assegnatario</label>
            <select id="pSubject" bind:value={targetSubject} class="form-select">
              <option value="user">Singolo Utente / Collaboratore</option>
              <option value="team">Squadra / Team di Lavoro</option>
              <option value="company">Totale Globale Aziendale</option>
            </select>
          </div>

          <div class="form-group flex-1">
            <label class="form-label" for="pMode">Modalità di Compilazione</label>
            <select id="pMode" bind:value={compilationMode} class="form-select">
              <option value="manager_only">Solo Direzione / Manager</option>
              <option value="self_submission">Auto-compilazione Collaboratore</option>
            </select>
          </div>
        </div>

        <!-- Ruoli Assegnatari Coinvolti -->
        <div class="form-group">
          <label class="form-label">Ruoli Assegnatari Coinvolti</label>
          <div class="checkbox-row">
            {#each AVAILABLE_ROLES as role}
              <label class="checkbox-label">
                <input 
                  type="checkbox" 
                  checked={assignedRoles.includes(role.id)} 
                  onchange={() => toggleRole(role.id)} 
                />
                <span>{role.label}</span>
              </label>
            {/each}
          </div>
        </div>

        <!-- SEZIONE GOVERNANCE DEI PERMESSI PER SOGGETTO -->
        <div class="permissions-config-box">
          <div class="perm-header">
            <Shield size={16} class="perm-icon" />
            <span class="perm-title">Governance Permessi ({targetSubject === 'user' ? 'Singolo Utente' : (targetSubject === 'team' ? 'Squadra' : 'Azienda')})</span>
          </div>

          {#if targetSubject === 'user'}
            <div class="perm-grid">
              <label class="perm-toggle">
                <input type="checkbox" bind:checked={userSelfView} />
                <span>Il collaboratore può visualizzare il proprio target</span>
              </label>
              <label class="perm-toggle">
                <input type="checkbox" bind:checked={userSelfEdit} />
                <span>Il collaboratore può auto-compilare il proprio target</span>
              </label>

              <div class="perm-roles-section">
                <span class="perm-sublabel">Ruoli autorizzati a visualizzare i target degli altri:</span>
                <div class="checkbox-row compact">
                  {#each AVAILABLE_ROLES as role}
                    <label class="checkbox-label">
                      <input 
                        type="checkbox" 
                        checked={userOthersViewRoles.includes(role.id)} 
                        onchange={() => userOthersViewRoles = toggleArrayRole(userOthersViewRoles, role.id)}
                      />
                      <span>{role.label}</span>
                    </label>
                  {/each}
                </div>
              </div>

              <div class="perm-roles-section">
                <span class="perm-sublabel">Ruoli autorizzati a compilare/modificare per altri:</span>
                <div class="checkbox-row compact">
                  {#each AVAILABLE_ROLES as role}
                    <label class="checkbox-label">
                      <input 
                        type="checkbox" 
                        checked={userOthersEditRoles.includes(role.id)} 
                        onchange={() => userOthersEditRoles = toggleArrayRole(userOthersEditRoles, role.id)}
                      />
                      <span>{role.label}</span>
                    </label>
                  {/each}
                </div>
              </div>
            </div>
          {:else if targetSubject === 'team'}
            <div class="perm-grid">
              <label class="perm-toggle">
                <input type="checkbox" bind:checked={teamLeaderView} />
                <span>Il caposquadra può visualizzare il target della sua squadra</span>
              </label>
              <label class="perm-toggle">
                <input type="checkbox" bind:checked={teamLeaderEdit} />
                <span>Il caposquadra può compilare/modificare il target della sua squadra</span>
              </label>
              <label class="perm-toggle">
                <input type="checkbox" bind:checked={teamMembersView} />
                <span>I membri del team possono visualizzare il target di squadra</span>
              </label>
              <label class="perm-toggle">
                <input type="checkbox" bind:checked={teamMembersEdit} />
                <span>I membri del team possono compilare il target</span>
              </label>

              <div class="perm-roles-section">
                <span class="perm-sublabel">Ruoli esterni autorizzati a visualizzare il target di squadra:</span>
                <div class="checkbox-row compact">
                  {#each AVAILABLE_ROLES as role}
                    <label class="checkbox-label">
                      <input 
                        type="checkbox" 
                        checked={teamOthersViewRoles.includes(role.id)} 
                        onchange={() => teamOthersViewRoles = toggleArrayRole(teamOthersViewRoles, role.id)}
                      />
                      <span>{role.label}</span>
                    </label>
                  {/each}
                </div>
              </div>

              <div class="perm-roles-section">
                <span class="perm-sublabel">Ruoli esterni autorizzati a compilare per la squadra:</span>
                <div class="checkbox-row compact">
                  {#each AVAILABLE_ROLES as role}
                    <label class="checkbox-label">
                      <input 
                        type="checkbox" 
                        checked={teamOthersEditRoles.includes(role.id)} 
                        onchange={() => teamOthersEditRoles = toggleArrayRole(teamOthersEditRoles, role.id)}
                      />
                      <span>{role.label}</span>
                    </label>
                  {/each}
                </div>
              </div>
            </div>
          {:else}
            <div class="perm-grid">
              <div class="perm-roles-section">
                <span class="perm-sublabel">Ruoli che possono visualizzare il target globale:</span>
                <div class="checkbox-row compact">
                  {#each AVAILABLE_ROLES as role}
                    <label class="checkbox-label">
                      <input 
                        type="checkbox" 
                        checked={companyViewRoles.includes(role.id)} 
                        onchange={() => companyViewRoles = toggleArrayRole(companyViewRoles, role.id)}
                      />
                      <span>{role.label}</span>
                    </label>
                  {/each}
                </div>
              </div>

              <div class="perm-roles-section">
                <span class="perm-sublabel">Ruoli che possono compilare/modificare il target globale:</span>
                <div class="checkbox-row compact">
                  {#each AVAILABLE_ROLES as role}
                    <label class="checkbox-label">
                      <input 
                        type="checkbox" 
                        checked={companyEditRoles.includes(role.id)} 
                        onchange={() => companyEditRoles = toggleArrayRole(companyEditRoles, role.id)}
                      />
                      <span>{role.label}</span>
                    </label>
                  {/each}
                </div>
              </div>
            </div>
          {/if}
        </div>

        <!-- Finestra Temporale -->
        <div class="form-group">
          <label class="form-label">Finestra Temporale di Compilazione</label>
          <div class="window-inputs-row">
            <div class="inline-input">
              <span>Apre:</span>
              <input type="number" min="0" max="60" bind:value={daysBefore} class="form-control short" />
              <span>giorni prima dell'inizio del periodo</span>
            </div>
            <div class="inline-input">
              <span>Chiude:</span>
              <input type="number" min="0" max="60" bind:value={daysAfter} class="form-control short" />
              <span>giorni dopo l'inizio del periodo</span>
            </div>
          </div>
        </div>

        <!-- Selezione KPI Dinamici -->
        <div class="form-group">
          <label class="form-label">KPI da Assegnare e Monitorare ({selectedKpiIds.length} selezionati)</label>
          <div class="kpis-selection-grid">
            {#each allKpis as kpi (kpi.id)}
              <label class="kpi-checkbox-card {selectedKpiIds.includes(kpi.id) ? 'selected' : ''}">
                <input 
                  type="checkbox" 
                  checked={selectedKpiIds.includes(kpi.id)} 
                  onchange={() => toggleKpi(kpi.id)} 
                />
                <div class="kpi-card-content">
                  <div class="kpi-card-title-row">
                    <span class="kpi-card-name">{kpi.name}</span>
                    {#if kpi.acronym}
                      <span class="kpi-card-tag">{kpi.acronym}</span>
                    {/if}
                  </div>
                  {#if kpi.description}
                    <span class="kpi-card-desc">{kpi.description}</span>
                  {/if}
                </div>
              </label>
            {/each}
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn btn-secondary" onclick={() => isModalOpen = false} type="button" disabled={isSaving}>
            Annulla
          </button>
          <button class="btn btn-primary" type="submit" disabled={isSaving}>
            <Save size={16} />
            <span>{isSaving ? 'Salvataggio...' : 'Salva Piano'}</span>
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<style>
  .settings-page-container {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    width: 100%;
    max-width: 100%;
    padding-bottom: 3rem;
  }

  .page-top-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .icon-wrap {
    width: 48px;
    height: 48px;
    border-radius: 12px;
    background: linear-gradient(135deg, rgba(59, 130, 246, 0.12), rgba(37, 99, 235, 0.2));
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .page-main-icon {
    color: var(--color-primary-600, #2563eb);
  }

  .page-title {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--color-text-primary, #111827);
  }

  .page-subtitle {
    margin: 0.125rem 0 0 0;
    font-size: 0.875rem;
    color: var(--color-text-muted, #6b7280);
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    border-radius: var(--radius-md, 8px);
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    text-decoration: none;
    transition: all 0.15s ease;
  }

  .btn-primary {
    background: var(--color-primary-600, #2563eb);
    color: #ffffff;
    border: 1px solid transparent;
  }

  .btn-primary:hover:not(:disabled) {
    background: var(--color-primary-700, #1d4ed8);
  }

  .btn-outline {
    background: transparent;
    color: var(--color-text-secondary, #4b5563);
    border: 1px solid var(--color-border-subtle, #d1d5db);
  }

  .btn-outline:hover {
    background: var(--color-bg-hover, #f3f4f6);
    color: var(--color-text-primary, #111827);
  }

  .btn-secondary {
    background: var(--color-bg-surface, #ffffff);
    color: var(--color-text-secondary, #374151);
    border: 1px solid var(--color-border-subtle, #d1d5db);
  }

  .settings-card {
    background: var(--color-bg-surface, #ffffff);
    border: 1px solid var(--color-border-subtle, #e5e7eb);
    border-radius: var(--radius-lg, 12px);
    padding: 1.25rem 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  }

  .card-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .card-icon {
    color: var(--color-primary-600, #2563eb);
  }

  .card-title {
    margin: 0;
    font-size: 1rem;
    font-weight: 700;
    color: var(--color-text-primary, #111827);
  }

  .preferences-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
    gap: 1.25rem;
  }

  .toggle-option {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    cursor: pointer;
  }

  .toggle-option input {
    margin-top: 0.25rem;
    width: 18px;
    height: 18px;
  }

  .toggle-text {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .toggle-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-text-primary, #1f2937);
  }

  .toggle-desc {
    font-size: 0.75rem;
    color: var(--color-text-muted, #6b7280);
    line-height: 1.3;
  }

  .plans-section {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .section-title {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 700;
    color: var(--color-text-primary, #111827);
  }

  .plans-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
    gap: 1.25rem;
  }

  .plan-card {
    background: var(--color-bg-surface, #ffffff);
    border: 1px solid var(--color-border-subtle, #e5e7eb);
    border-radius: var(--radius-lg, 12px);
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.875rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  }

  .plan-card-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .plan-name {
    margin: 0;
    font-size: 1rem;
    font-weight: 700;
    color: var(--color-text-primary, #111827);
  }

  .plan-desc {
    margin: 0.25rem 0 0 0;
    font-size: 0.8125rem;
    color: var(--color-text-muted, #6b7280);
  }

  .plan-actions {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .icon-btn {
    width: 30px;
    height: 30px;
    border-radius: var(--radius-sm, 6px);
    border: 1px solid var(--color-border-subtle, #e5e7eb);
    background: var(--color-bg-surface, #ffffff);
    color: var(--color-text-secondary, #4b5563);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .icon-btn:hover {
    background: var(--color-bg-hover, #f3f4f6);
    color: var(--color-text-primary, #111827);
  }

  .icon-btn.text-danger:hover {
    background: rgba(239, 68, 68, 0.1);
    color: #dc2626;
    border-color: rgba(239, 68, 68, 0.3);
  }

  .plan-badges-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
  }

  .badge {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
    font-size: 0.6875rem;
    font-weight: 600;
    text-transform: capitalize;
  }

  .badge-blue {
    background: var(--color-primary-50, #eff6ff);
    color: var(--color-primary-700, #1d4ed8);
  }

  .badge-purple {
    background: rgba(139, 92, 246, 0.1);
    color: #7c3aed;
  }

  .badge-gray {
    background: var(--color-bg-subtle, #f3f4f6);
    color: var(--color-text-secondary, #4b5563);
  }

  .plan-meta-box {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    background: var(--color-bg-subtle, #f9fafb);
    padding: 0.625rem 0.75rem;
    border-radius: var(--radius-sm, 6px);
    font-size: 0.75rem;
  }

  .meta-item {
    display: flex;
    gap: 0.375rem;
  }

  .meta-label {
    font-weight: 600;
    color: var(--color-text-secondary, #4b5563);
  }

  .meta-value {
    color: var(--color-text-primary, #111827);
  }

  .plan-kpis-box {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .kpi-box-title {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--color-text-secondary, #4b5563);
  }

  .kpis-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
  }

  .kpi-pill {
    background: var(--color-bg-surface, #ffffff);
    border: 1px solid var(--color-border-subtle, #d1d5db);
    padding: 0.125rem 0.5rem;
    border-radius: 999px;
    font-size: 0.6875rem;
    font-weight: 600;
    color: var(--color-text-primary, #111827);
  }

  /* Modal Styling */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.6);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1rem;
  }

  .modal-card {
    background: var(--color-bg-surface, #ffffff);
    border-radius: var(--radius-xl, 16px);
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
    border: 1px solid var(--color-border-subtle, #e5e7eb);
    width: 100%;
    max-width: 720px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid var(--color-border-subtle, #e5e7eb);
  }

  .header-title-wrap {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .header-icon {
    color: var(--color-primary-500, #3b82f6);
  }

  .modal-title {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 700;
  }

  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: var(--radius-sm, 6px);
    border: none;
    background: transparent;
    color: var(--color-text-muted, #9ca3af);
    cursor: pointer;
  }

  .error-banner {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.5rem;
    background: rgba(239, 68, 68, 0.1);
    color: #dc2626;
    font-size: 0.875rem;
    border-bottom: 1px solid rgba(239, 68, 68, 0.2);
  }

  .modal-form {
    padding: 1.5rem;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .form-row {
    display: flex;
    gap: 1rem;
  }

  .flex-1 { flex: 1; }
  .flex-2 { flex: 2; }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .form-label {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--color-text-secondary, #374151);
  }

  .form-control, .form-select {
    padding: 0.5rem 0.75rem;
    border-radius: var(--radius-sm, 6px);
    border: 1px solid var(--color-border-subtle, #d1d5db);
    font-size: 0.875rem;
  }

  .form-control.short {
    width: 70px;
    text-align: center;
  }

  .checkbox-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.875rem;
  }

  .checkbox-row.compact {
    gap: 0.625rem;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.8125rem;
    cursor: pointer;
  }

  .permissions-config-box {
    background: var(--color-bg-subtle, #f9fafb);
    border: 1px solid var(--color-primary-200, #bfdbfe);
    border-radius: var(--radius-md, 8px);
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.875rem;
  }

  .perm-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .perm-icon {
    color: var(--color-primary-600, #2563eb);
  }

  .perm-title {
    font-size: 0.875rem;
    font-weight: 700;
    color: var(--color-text-primary, #111827);
  }

  .perm-grid {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .perm-toggle {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--color-text-secondary, #374151);
    cursor: pointer;
  }

  .perm-roles-section {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    background: var(--color-bg-surface, #ffffff);
    border: 1px solid var(--color-border-subtle, #e5e7eb);
    padding: 0.625rem;
    border-radius: var(--radius-sm, 6px);
  }

  .perm-sublabel {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--color-text-secondary, #4b5563);
  }

  .window-inputs-row {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    background: var(--color-bg-subtle, #f9fafb);
    padding: 0.75rem;
    border-radius: var(--radius-md, 8px);
    border: 1px solid var(--color-border-subtle, #e5e7eb);
  }

  .inline-input {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8125rem;
    color: var(--color-text-secondary, #374151);
  }

  .kpis-selection-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 0.625rem;
    max-height: 180px;
    overflow-y: auto;
    padding: 0.25rem;
    border: 1px solid var(--color-border-subtle, #e5e7eb);
    border-radius: var(--radius-md, 8px);
  }

  .kpi-checkbox-card {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    padding: 0.5rem 0.625rem;
    border-radius: var(--radius-sm, 6px);
    border: 1px solid var(--color-border-subtle, #e5e7eb);
    background: var(--color-bg-surface, #ffffff);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .kpi-checkbox-card:hover {
    background: var(--color-bg-hover, #f9fafb);
  }

  .kpi-checkbox-card.selected {
    background: var(--color-primary-50, #eff6ff);
    border-color: var(--color-primary-300, #93c5fd);
  }

  .kpi-card-content {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .kpi-card-title-row {
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }

  .kpi-card-name {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--color-text-primary, #111827);
  }

  .kpi-card-tag {
    font-size: 0.625rem;
    font-weight: 700;
    color: var(--color-primary-700, #1d4ed8);
    background: var(--color-primary-100, #dbeafe);
    padding: 0.0625rem 0.25rem;
    border-radius: 4px;
  }

  .kpi-card-desc {
    font-size: 0.6875rem;
    color: var(--color-text-muted, #6b7280);
    line-height: 1.2;
  }

  .modal-footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.75rem;
    padding-top: 0.5rem;
  }

  .loading-state, .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: var(--color-bg-surface, #ffffff);
    border: 1px solid var(--color-border-subtle, #e5e7eb);
    border-radius: var(--radius-lg, 12px);
    padding: 3rem 1.5rem;
    text-align: center;
  }

  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--color-border-subtle, #e5e7eb);
    border-top-color: var(--color-primary-600, #2563eb);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin-bottom: 0.75rem;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>
