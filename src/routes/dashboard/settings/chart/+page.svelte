<script lang="ts">
  import { onMount } from 'svelte';
  import { toast } from '$lib/stores/toast.svelte';
  import { Card, FormField, Button } from '$lib';
  import { 
    TrendingUp, 
    Save, 
    Layers, 
    BarChart2, 
    Edit3, 
    Info, 
    Check,
    ArrowUpRight,
    Sliders,
    Tag
  } from '@lucide/svelte';
  import { projectStore } from '$lib/stores/project';
  import { ChartSettingsService, type ChartGlobalSettings, type KPISettingSpec, type EntityChartConfig } from '$lib/services/chartSettingsService';

  let saving = $state(false);
  let loadingSettings = $state(true);
  let config = $state<ChartGlobalSettings>(ChartSettingsService.getSettingsSync());
  let editingKpiId = $state<string | null>(null);

  let activeEntities = $derived.by(() => {
    const installedModuleIds = ChartSettingsService.getInstalledModuleIds();
    return Object.values(config.entities).filter(ent => {
      if (ent.isCore) return true;
      return installedModuleIds.includes(ent.id);
    }).map(ent => ({
      ...ent,
      kpis: ent.kpis.filter(kpi => {
        if (!kpi.requiredModule) return true;
        return installedModuleIds.includes(kpi.requiredModule);
      })
    }));
  });

  let masterKpisList = $derived.by(() => {
    const map = new Map<string, KPISettingSpec>();
    for (const ent of activeEntities) {
      for (const kpi of ent.kpis) {
        if (!map.has(kpi.id)) {
          map.set(kpi.id, kpi);
        }
      }
    }
    return Array.from(map.values());
  });

  onMount(async () => {
    try {
      config = await ChartSettingsService.getSettings();
    } catch (e) {
      console.error('Errore caricamento impostazioni Firestore:', e);
    } finally {
      loadingSettings = false;
    }
  });

  async function handleSave(e: Event) {
    e.preventDefault();
    saving = true;
    try {
      await ChartSettingsService.saveSettings(config);
      toast.success('Impostazioni salvate con successo nel Database Firestore!');
    } catch (err: any) {
      console.error('Errore salvataggio impostazioni Firestore:', err);
      toast.error('Errore durante il salvataggio in Firestore: ' + err.message);
    } finally {
      saving = false;
    }
  }

  function updateMasterKpi(kpiId: string, name: string, acronym: string, description: string) {
    const newEntities = { ...config.entities };
    for (const entKey in newEntities) {
      const kpis = [...newEntities[entKey].kpis];
      let updated = false;
      for (let i = 0; i < kpis.length; i++) {
        if (kpis[i].id === kpiId) {
          kpis[i] = {
            ...kpis[i],
            name,
            acronym,
            description
          };
          updated = true;
        }
      }
      if (updated) {
        newEntities[entKey] = {
          ...newEntities[entKey],
          kpis
        };
      }
    }
    config = {
      ...config,
      entities: newEntities
    };
  }

  function toggleKpiEnabled(entityId: string, kpiId: string) {
    const ent = config.entities[entityId];
    if (!ent) return;
    const kpi = ent.kpis.find(k => k.id === kpiId);
    if (kpi) {
      kpi.enabled = !kpi.enabled;
    }
  }

  function toggleKpiExport(entityId: string, kpiId: string) {
    const ent = config.entities[entityId];
    if (!ent) return;
    const kpi = ent.kpis.find(k => k.id === kpiId);
    if (kpi) {
      kpi.exportToDashboard = !kpi.exportToDashboard;
    }
  }
</script>

<svelte:head>
  <title>Impostazioni Centralizzate Grafici & KPI | {$projectStore?.projectName || 'ERP'}</title>
</svelte:head>

<div class="chart-settings-page animate-fade-in">
  <div class="page-top-actions">
    <div>
      <h2 class="title-header">
        <TrendingUp size={28} color="var(--color-primary-600)" />
        Command Center Centralizzato Grafici & KPI
      </h2>
      <p class="subtitle">Gestisci il layout grafico, le metriche visibili, le abbreviazioni ed i testi descrittivi per tutte le entità del sistema (Core & Moduli Installati).</p>
    </div>
  </div>

  <form onsubmit={handleSave} class="settings-form">
    <!-- 1. SEZIONE MASTER EDITING KPI & SIGLE (IN ALTO) -->
    <Card title="Registro Globale KPI & Sigle Personalizzate" description="Personalizza qui l'acronimo (sigla), il nome esteso e la descrizione FAQ per tutti i KPI attivi nel sistema. Le modifiche verranno applicate ovunque.">
      <div class="master-kpis-grid">
        {#each masterKpisList as kpi (kpi.id)}
          {@const isEditing = editingKpiId === `master_${kpi.id}`}
          <div class="master-kpi-card" class:editing={isEditing}>
            <div class="master-kpi-header">
              <div class="kpi-tag-box">
                <span class="acronym-pill">{kpi.acronym}</span>
                <strong class="kpi-title">{kpi.name}</strong>
              </div>

              <button 
                type="button" 
                class="btn-icon-subtle" 
                onclick={() => editingKpiId = isEditing ? null : `master_${kpi.id}`}
                title="Modifica acronimo, nome o descrizione FAQ"
              >
                <Edit3 size={15} />
              </button>
            </div>

            <p class="kpi-desc-preview">
              <Info size={13} class="inline-desc-icon" /> {kpi.description}
            </p>

            <!-- EDITING IN-LINE PANEL -->
            {#if isEditing}
              <div class="kpi-edit-panel animate-fade-in">
                <div class="edit-fields-row">
                  <div class="field-item flex-1">
                    <label for="master-name-{kpi.id}">Nome Visualizzato</label>
                    <input 
                      type="text" 
                      id="master-name-{kpi.id}" 
                      value={kpi.name} 
                      oninput={(e) => updateMasterKpi(kpi.id, (e.target as HTMLInputElement).value, kpi.acronym, kpi.description)}
                      class="form-control-sm"
                    />
                  </div>

                  <div class="field-item width-100">
                    <label for="master-acronym-{kpi.id}">Acronimo</label>
                    <input 
                      type="text" 
                      id="master-acronym-{kpi.id}" 
                      value={kpi.acronym} 
                      oninput={(e) => updateMasterKpi(kpi.id, kpi.name, (e.target as HTMLInputElement).value, kpi.description)}
                      class="form-control-sm text-center" 
                      maxLength={6}
                    />
                  </div>
                </div>

                <div class="field-item margin-top-8">
                  <label for="master-desc-{kpi.id}">Descrizione Info / FAQ Tooltip</label>
                  <textarea 
                    id="master-desc-{kpi.id}" 
                    value={kpi.description} 
                    oninput={(e) => updateMasterKpi(kpi.id, kpi.name, kpi.acronym, (e.target as HTMLTextAreaElement).value)}
                    rows="2" 
                    class="form-control-sm"
                  ></textarea>
                </div>

                <div class="edit-panel-footer">
                  <button type="button" class="btn-sm-done" onclick={() => editingKpiId = null}>
                    <Check size={14} /> Fatto
                  </button>
                </div>
              </div>
            {/if}
          </div>
        {/each}
      </div>
    </Card>

    <!-- 2. REGOLAZIONI GENERALI LAYOUT -->
    <Card title="Impostazioni Generali Layout Grafico" description="Configura la posizione delle card KPI ed il livello temporale predefinito per la piattaforma.">
      <div class="form-grid">
        <FormField id="kpi-pos" label="Posizione Card KPI Rispetto al Grafico">
          <select id="kpi-pos" bind:value={config.defaultKpisPosition} class="form-control">
            <option value="right">Affiancate a Destra (Consigliato per Desktop)</option>
            <option value="top">In Alto (Sopra il Grafico)</option>
            <option value="bottom">In Basso (Sotto il Grafico)</option>
            <option value="none">Nessuna Card KPI nel Grafico</option>
          </select>
        </FormField>

        <FormField id="granularity-def" label="Dettaglio Temporale Predefinito">
          <select id="granularity-def" bind:value={config.defaultGranularity} class="form-control">
            <option value="settimanale">Settimanale</option>
            <option value="mensile">Mensile (Predefinito)</option>
            <option value="annuale">Annuale</option>
          </select>
        </FormField>
      </div>
    </Card>

    <!-- 3. CONFIGURAZIONE ENTITA' E MODULI ATTIVI (AGNOSTICO) -->
    <Card title="Configurazione Grafici & Abilitazioni per Entità" description="Mostra solo le entità Core ed i moduli opzionali attualmente installati nel workspace.">
      <div class="entities-list">
        {#each activeEntities as ent (ent.id)}
          <div class="entity-card-item">
            <!-- Header Entità -->
            <div class="entity-header">
              <div class="entity-title-box">
                <Layers size={20} class="icon-primary" />
                <div>
                  <div class="title-with-badge">
                    <h4>{ent.label}</h4>
                    <span class="badge {ent.isCore ? 'badge-core' : 'badge-module'}">
                      {ent.isCore ? 'CORE' : 'MODULO INSTALLATO'}
                    </span>
                  </div>
                  <span class="entity-id-tag">Identificativo: {ent.id}</span>
                </div>
              </div>

              <!-- Interruttori Generali Entità -->
              <div class="entity-switches-row">
                <label class="switch-label">
                  <input type="checkbox" bind:checked={config.entities[ent.id].enabled} />
                  <span>Abilita Grafico</span>
                </label>

                <label class="switch-label">
                  <input type="checkbox" bind:checked={config.entities[ent.id].showSideKpis} />
                  <span>Card KPI Laterali</span>
                </label>

                <label class="switch-label">
                  <input type="checkbox" bind:checked={config.entities[ent.id].exportToDashboard} />
                  <span>Esporta su Dashboard</span>
                </label>
              </div>
            </div>

            <!-- SELEZIONE KPI ATTIVI PER QUESTA ENTITA' -->
            {#if config.entities[ent.id]?.enabled && config.entities[ent.id]?.kpis?.length > 0}
              <div class="kpis-management-box">
                <div class="kpis-box-header">
                  <BarChart2 size={16} class="icon-accent" />
                  <h5>KPI da Abilitare nel Grafico di {ent.label}</h5>
                </div>

                <div class="kpis-checks-flex">
                  {#each ent.kpis as kpi (kpi.id)}
                    <label class="kpi-check-pill" class:active={kpi.enabled}>
                      <input 
                        type="checkbox" 
                        checked={kpi.enabled}
                        onchange={() => toggleKpiEnabled(ent.id, kpi.id)}
                      />
                      <span class="acronym-sub">{kpi.acronym}</span>
                      <span>{kpi.name}</span>
                    </label>
                  {/each}
                </div>
              </div>
            {/if}
          </div>
        {/each}
      </div>
    </Card>

    <div class="form-actions-bar">
      <Button type="submit" variant="primary" disabled={saving}>
        <Save size={16} /> {saving ? 'Salvataggio...' : 'Salva Impostazioni Analytics & KPI'}
      </Button>
    </div>
  </form>
</div>

<style>
  .chart-settings-page {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .page-top-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .title-header {
    font-size: 1.5rem;
    font-weight: 800;
    margin: 0;
    color: var(--color-neutral-900);
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .subtitle {
    font-size: 0.88rem;
    color: var(--color-neutral-500);
    margin: 4px 0 0 0;
  }

  .settings-form {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .form-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }

  @media (max-width: 640px) {
    .form-grid {
      grid-template-columns: 1fr;
    }
  }

  .form-control {
    padding: 8px 12px;
    border: 1px solid var(--color-neutral-300);
    border-radius: var(--radius-md);
    font-size: 14px;
    width: 100%;
    box-sizing: border-box;
  }

  .form-control-sm {
    padding: 6px 10px;
    border: 1px solid var(--color-neutral-300);
    border-radius: var(--radius-sm);
    font-size: 13px;
    width: 100%;
    box-sizing: border-box;
    background: #ffffff;
  }

  .master-kpis-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 16px;
  }

  .master-kpi-card {
    padding: 14px;
    border: 1px solid var(--color-neutral-200);
    border-radius: var(--radius-md);
    background: #ffffff;
    display: flex;
    flex-direction: column;
    gap: 8px;
    box-shadow: var(--shadow-xs);
  }

  .master-kpi-card.editing {
    border-color: var(--color-primary-500);
    box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15);
  }

  .master-kpi-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .kpi-tag-box {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .acronym-pill {
    background: var(--color-primary-600);
    color: #ffffff;
    font-size: 11px;
    font-weight: 800;
    padding: 2px 6px;
    border-radius: 4px;
  }

  .acronym-sub {
    background: var(--color-neutral-200);
    color: var(--color-neutral-800);
    font-size: 10px;
    font-weight: 800;
    padding: 1px 5px;
    border-radius: 3px;
  }

  .kpi-title {
    font-size: 14px;
    color: var(--color-neutral-900);
  }

  .btn-icon-subtle {
    border: none;
    background: transparent;
    color: var(--color-neutral-500);
    padding: 4px;
    border-radius: 4px;
    cursor: pointer;
  }

  .btn-icon-subtle:hover {
    color: var(--color-primary-600);
    background: var(--color-neutral-100);
  }

  .kpi-desc-preview {
    font-size: 12px;
    color: var(--color-neutral-600);
    margin: 0;
    line-height: 1.4;
    display: flex;
    align-items: flex-start;
    gap: 6px;
  }

  .inline-desc-icon {
    flex-shrink: 0;
    margin-top: 2px;
    color: var(--color-neutral-400);
  }

  .kpi-edit-panel {
    margin-top: 8px;
    padding: 12px;
    background: var(--color-neutral-50);
    border: 1px solid var(--color-primary-200);
    border-radius: var(--radius-sm);
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .edit-fields-row {
    display: flex;
    gap: 10px;
  }

  .flex-1 { flex: 1; }
  .width-100 { width: 100px; }
  .margin-top-8 { margin-top: 8px; }

  .field-item label {
    display: block;
    font-size: 11px;
    font-weight: 700;
    color: var(--color-neutral-700);
    margin-bottom: 4px;
  }

  .edit-panel-footer {
    display: flex;
    justify-content: flex-end;
    margin-top: 4px;
  }

  .btn-sm-done {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: var(--color-primary-600);
    color: #ffffff;
    border: none;
    padding: 4px 10px;
    border-radius: var(--radius-sm);
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
  }

  .entities-list {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .entity-card-item {
    padding: 20px;
    border: 1px solid var(--color-neutral-200);
    border-radius: var(--radius-lg);
    background: var(--color-neutral-50);
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .entity-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 16px;
  }

  .entity-title-box {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .title-with-badge {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .title-with-badge h4 {
    margin: 0;
    font-size: 1.05rem;
    font-weight: 800;
    color: var(--color-neutral-900);
  }

  .badge-core {
    background: var(--color-primary-100, #dbeafe);
    color: var(--color-primary-700, #1d4ed8);
    font-size: 10px;
    font-weight: 800;
    padding: 2px 6px;
    border-radius: 4px;
  }

  .badge-module {
    background: var(--color-emerald-100, #d1fae5);
    color: var(--color-emerald-800, #065f46);
    font-size: 10px;
    font-weight: 800;
    padding: 2px 6px;
    border-radius: 4px;
  }

  .entity-id-tag {
    font-size: 0.76rem;
    color: var(--color-neutral-500);
  }

  .entity-switches-row {
    display: flex;
    align-items: center;
    gap: 20px;
    flex-wrap: wrap;
  }

  .switch-label {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    font-weight: 600;
    color: var(--color-neutral-700);
    cursor: pointer;
  }

  .kpis-management-box {
    padding-top: 14px;
    border-top: 1px dashed var(--color-neutral-300);
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .kpis-box-header {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .kpis-box-header h5 {
    margin: 0;
    font-size: 0.84rem;
    font-weight: 700;
    color: var(--color-neutral-800);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .kpis-checks-flex {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }

  .kpi-check-pill {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 6px 14px;
    border: 1px solid var(--color-neutral-300);
    border-radius: var(--radius-sm);
    background: #ffffff;
    font-size: 13px;
    font-weight: 600;
    color: var(--color-neutral-700);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .kpi-check-pill.active {
    background: var(--color-primary-50, #eff6ff);
    border-color: var(--color-primary-500);
    color: var(--color-primary-700);
  }

  .form-actions-bar {
    display: flex;
    justify-content: flex-end;
    margin-top: 10px;
  }
</style>
