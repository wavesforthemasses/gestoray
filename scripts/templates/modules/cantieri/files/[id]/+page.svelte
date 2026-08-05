<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { CantieriService } from '../cantieri.service';
  import { CantiereSettingsService } from '../cantiereSettingsService';
  import type { CantiereItem, CantiereStatus, CantiereSettings } from '../schema';
  import { toast } from '$lib/stores/toast.svelte';
  import { Card, Button, StatusBadge } from '$lib';
  import { pageTitle } from '$lib/stores/page';
  import { menuConfigStore } from '$lib/stores/menu';
  import { activeRoleState } from '$lib/auth.svelte';
  import { 
    Building2, 
    ArrowLeft, 
    User, 
    MapPin, 
    Calendar, 
    TrendingUp, 
    CheckCircle2, 
    PauseCircle, 
    FileText, 
    Edit, 
    Trash2, 
    Save, 
    Layers,
    DollarSign,
    Wallet,
    Wrench
  } from '@lucide/svelte';

  const cantiereId = $page.params.id || '';

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

  let cantiere = $state<CantiereItem | null>(null);
  let loading = $state(true);
  let activeTab = $state<'overview' | string>('overview');

  // Dynamic Bridge Tabs Discovery (WordPress/Drupal Hook Pattern)
  const globTabs = import.meta.glob('../cantieri-tabs/*.svelte', { eager: true });
  const activeModuleIds = $derived(new Set($menuConfigStore.map(m => m.id)));

  // Available Bridge Sub-Tabs registered by installed modules
  const installedBridgeTabs = $derived(
    Object.entries(globTabs)
      .map(([path, mod]: [string, any]) => {
        const meta = mod.bridgeMetadata || {};
        return {
          id: meta.id || path.split('/').pop()?.replace('.svelte', ''),
          sourceModule: meta.sourceModule || '',
          label: meta.label || 'Tab Collegata',
          component: mod.default
        };
      })
      .filter(t => !t.sourceModule || activeModuleIds.has(t.sourceModule))
  );

  onMount(async () => {
    try {
      const [s, item] = await Promise.all([
        CantiereSettingsService.getSettings(),
        CantieriService.getCantiereById(cantiereId)
      ]);
      settings = s;
      cantiere = item;
      if (item) {
        pageTitle.set(`${labels.singular} ${item.code}`);
      }
    } catch (e) {
      console.error('Errore caricamento dettaglio cantiere:', e);
    } finally {
      loading = false;
    }
  });

  async function handleStatusChange(newStatus: CantiereStatus) {
    if (!cantiere) return;
    try {
      await CantieriService.updateCantiere(cantiere.id!, { status: newStatus });
      cantiere.status = newStatus;
      toast.success(`Stato ${labels.singular.toLowerCase()} aggiornato in "${newStatus}".`);
    } catch (e: any) {
      toast.error('Errore aggiornamento stato: ' + e.message);
    }
  }

  async function handleProgressChange(newProgress: number) {
    if (!cantiere) return;
    try {
      await CantieriService.updateCantiere(cantiere.id!, { progress: newProgress });
      cantiere.progress = newProgress;
      toast.success('Avanzamento lavori aggiornato.');
    } catch (e: any) {
      toast.error('Errore aggiornamento avanzamento: ' + e.message);
    }
  }

  async function handleDelete() {
    if (!cantiere) return;
    if (!confirm(`Sei sicuro di voler eliminare definitivamente il ${labels.singular.toLowerCase()} ${cantiere.code}?`)) return;
    try {
      await CantieriService.deleteCantiere(cantiere.id!);
      toast.success(`${labels.singular} eliminato.`);
      goto('/dashboard/cantieri');
    } catch (e: any) {
      toast.error('Errore eliminazione: ' + e.message);
    }
  }

  function formatCurrency(val: number): string {
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(val || 0);
  }
</script>

<div class="cantiere-detail-page animate-fade-in">
  <div class="page-top-actions">
    <div>
      <a href="/dashboard/cantieri" class="back-link">
        <ArrowLeft size={16} /> Torna a {labels.plural}
      </a>
      <h2 class="title-header">
        <Building2 size={28} color="var(--color-primary-600)" />
        {cantiere?.code || labels.singular}
      </h2>
    </div>

    <div class="header-btns">
      <button class="btn-danger-outline" onclick={handleDelete}>
        <Trash2 size={16} /> Elimina
      </button>
    </div>
  </div>

  {#if loading}
    <div class="loader-box">
      <span class="spinner"></span>
      Caricamento dettaglio {labels.singular.toLowerCase()}...
    </div>
  {:else if !cantiere}
    <Card class="empty-card">
      <div class="empty-state">
        <Building2 size={48} color="var(--color-neutral-400)" />
        <h3>{labels.singular} non trovato</h3>
        <p>Il {labels.singular.toLowerCase()} richiesto non esiste o è stato rimosso.</p>
        <a href="/dashboard/cantieri" class="btn-primary-action">Torna all'Elenco</a>
      </div>
    </Card>
  {:else}
    <!-- HEADER SUMMARY CARD -->
    <Card variant="glass" class="cantiere-header-card">
      <div class="ch-split">
        <div class="ch-left">
          <div class="ch-title-row">
            <h3>{cantiere.name}</h3>
            <span class="status-chip {cantiere.status}">
              {cantiere.status.replace('_', ' ').toUpperCase()}
            </span>
          </div>

          <div class="ch-meta-row">
            <span class="meta-item font-semibold">
              <User size={15} /> Cliente: <a href="/dashboard/clients/{cantiere.clientId}" class="client-link">{cantiere.clientName || 'N/D'}</a>
            </span>
            {#if cantiere.address?.street || cantiere.address?.city}
              <span class="meta-item">
                <MapPin size={15} /> {cantiere.address.street} {cantiere.address.city}
              </span>
            {/if}
            {#if cantiere.startDate}
              <span class="meta-item">
                <Calendar size={15} /> Inizio: {cantiere.startDate.split('T')[0]}
              </span>
            {/if}
          </div>
        </div>

        <div class="ch-right">
          <!-- STATUS WORKFLOW SELECTOR -->
          <div class="workflow-selector">
            <span class="wf-label">Cambia Stato:</span>
            <div class="wf-btns">
              <button 
                class="wf-btn" 
                class:active={cantiere.status === 'fase_contrattuale'}
                onclick={() => handleStatusChange('fase_contrattuale')}
              >
                Fase Contrattuale
              </button>
              <button 
                class="wf-btn" 
                class:active={cantiere.status === 'aperto'}
                onclick={() => handleStatusChange('aperto')}
              >
                Aperto
              </button>
              <button 
                class="wf-btn" 
                class:active={cantiere.status === 'in_pausa'}
                onclick={() => handleStatusChange('in_pausa')}
              >
                In Pausa
              </button>
              <button 
                class="wf-btn" 
                class:active={cantiere.status === 'completato'}
                onclick={() => handleStatusChange('completato')}
              >
                Completato
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- PROGRESS BAR -->
      <div class="progress-section">
        <div class="ps-header">
          <span>Avanzamento Lavori: <strong>{cantiere.progress}%</strong></span>
          <div class="progress-slider-box">
            <input 
              type="range" 
              min="0" 
              max="100" 
              value={cantiere.progress} 
              onchange={(e) => handleProgressChange(Number((e.target as HTMLInputElement).value))}
            />
          </div>
        </div>
        <div class="progress-bar-bg">
          <div class="progress-bar-fill" style="width: {cantiere.progress}%;"></div>
        </div>
      </div>
    </Card>

    <!-- HYBRID FINANCIAL SUMMARY CARDS -->
    <div class="financial-summary-grid">
      <div class="fin-card">
        <div class="fin-icon"><DollarSign size={22} /></div>
        <div class="fin-info">
          <span class="fin-num">{formatCurrency(cantiere.estimatedAmount)}</span>
          <span class="fin-label">Valore Stimato / Base</span>
        </div>
      </div>

      <div class="fin-card">
        <div class="fin-icon success"><FileText size={22} /></div>
        <div class="fin-info">
          <span class="fin-num">{formatCurrency(cantiere.derived?.contractedAmount || cantiere.estimatedAmount)}</span>
          <span class="fin-label">Contrattato / Approvato</span>
        </div>
      </div>

      <div class="fin-card">
        <div class="fin-icon warning"><Wrench size={22} /></div>
        <div class="fin-info">
          <span class="fin-num">{formatCurrency(cantiere.derived?.executedAmount || 0)}</span>
          <span class="fin-label">Erogato / Avanzamento</span>
        </div>
      </div>

      <div class="fin-card">
        <div class="fin-icon info"><Wallet size={22} /></div>
        <div class="fin-info">
          <span class="fin-num">{formatCurrency(cantiere.derived?.collectedAmount || 0)}</span>
          <span class="fin-label">Incassato Effettivo</span>
        </div>
      </div>
    </div>

    <!-- DYNAMIC SUB-TABS (Attività & Documenti Collegati) -->
    <Card variant="glass" style="padding: 0; overflow: hidden;">
      <div class="sub-tabs-header">
        <button 
          class="sub-tab-btn" 
          class:active={activeTab === 'overview'}
          onclick={() => activeTab = 'overview'}
        >
          <Building2 size={16} /> Panoramica & Note
        </button>

        {#each installedBridgeTabs as bTab}
          <button 
            class="sub-tab-btn" 
            class:active={activeTab === bTab.id}
            onclick={() => activeTab = bTab.id}
          >
            <Layers size={16} /> {bTab.label}
          </button>
        {/each}
      </div>

      <div class="tab-content-container">
        {#if activeTab === 'overview'}
          <div class="overview-box">
            <h4>Note & Indicazioni del Cantiere</h4>
            <p>{cantiere.notes || 'Nessuna nota aggiuntiva registrata per questo cantiere.'}</p>
          </div>
        {:else}
          {#each installedBridgeTabs as bTab}
            {#if activeTab === bTab.id}
              <bTab.component cantiereId={cantiere.id} clientId={cantiere.clientId} />
            {/if}
          {/each}
        {/if}
      </div>
    </Card>
  {/if}
</div>

<style>
  .cantiere-detail-page {
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
  .back-link {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: var(--color-neutral-500);
    text-decoration: none;
    font-size: 13px;
    margin-bottom: 4px;
  }
  .title-header {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 26px;
    font-weight: 700;
    color: var(--color-neutral-800);
    margin: 0;
  }

  .header-btns {
    display: flex;
    gap: 10px;
  }
  .btn-danger-outline {
    background: none;
    border: 1px solid var(--color-red-300, #fca5a5);
    color: var(--color-red-600, #dc2626);
    padding: 8px 14px;
    border-radius: 6px;
    font-weight: 600;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .cantiere-header-card {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
  .ch-split {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 20px;
    flex-wrap: wrap;
  }
  .ch-title-row {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 8px;
  }
  .ch-title-row h3 {
    margin: 0;
    font-size: 22px;
    color: var(--color-neutral-900);
  }
  .ch-meta-row {
    display: flex;
    gap: 16px;
    font-size: 14px;
    color: var(--color-neutral-600);
    flex-wrap: wrap;
  }
  .meta-item {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .client-link {
    color: var(--color-primary-600);
    text-decoration: none;
  }

  /* WORKFLOW BUTTONS */
  .workflow-selector {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 6px;
  }
  .wf-label {
    font-size: 12px;
    color: var(--color-neutral-500);
  }
  .wf-btns {
    display: flex;
    gap: 6px;
    background: var(--color-neutral-100);
    padding: 4px;
    border-radius: 8px;
  }
  .wf-btn {
    border: none;
    background: none;
    padding: 6px 10px;
    font-size: 12px;
    font-weight: 500;
    border-radius: 6px;
    cursor: pointer;
  }
  .wf-btn.active {
    background: white;
    font-weight: 700;
    color: var(--color-primary-600);
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  }

  /* PROGRESS BAR */
  .progress-section {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .ps-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 13px;
    color: var(--color-neutral-700);
  }
  .progress-bar-bg {
    width: 100%;
    height: 10px;
    background: var(--color-neutral-200);
    border-radius: 5px;
    overflow: hidden;
  }
  .progress-bar-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--color-primary-500), var(--color-emerald-500));
    border-radius: 5px;
  }

  /* FINANCIAL SUMMARY CARDS */
  .financial-summary-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 16px;
  }
  .fin-card {
    background: var(--color-surface, #ffffff);
    border: 1px solid var(--color-neutral-200);
    border-radius: 10px;
    padding: 16px;
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .fin-icon {
    width: 42px;
    height: 42px;
    border-radius: 10px;
    background: var(--color-neutral-100);
    color: var(--color-neutral-600);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .fin-icon.success { background: #dcfce7; color: #15803d; }
  .fin-icon.warning { background: #fef3c7; color: #d97706; }
  .fin-icon.info { background: #e0f2fe; color: #0284c7; }

  .fin-info {
    display: flex;
    flex-direction: column;
  }
  .fin-num {
    font-size: 17px;
    font-weight: 700;
    color: var(--color-neutral-900);
  }
  .fin-label {
    font-size: 12px;
    color: var(--color-neutral-500);
  }

  /* SUB TABS HEADER */
  .sub-tabs-header {
    display: flex;
    gap: 4px;
    background: var(--color-neutral-50);
    border-bottom: 1px solid var(--color-neutral-200);
    padding: 8px 12px 0 12px;
  }
  .sub-tab-btn {
    border: none;
    background: none;
    padding: 10px 16px;
    font-size: 13px;
    font-weight: 600;
    color: var(--color-neutral-600);
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 6px;
    border-bottom: 2px solid transparent;
  }
  .sub-tab-btn.active {
    color: var(--color-primary-600);
    border-bottom-color: var(--color-primary-600);
    background: white;
    border-radius: 6px 6px 0 0;
  }

  .tab-content-container {
    padding: 20px;
  }
  .overview-box h4 {
    margin: 0 0 8px 0;
    font-size: 15px;
    color: var(--color-neutral-800);
  }
  .overview-box p {
    margin: 0;
    font-size: 14px;
    color: var(--color-neutral-600);
    line-height: 1.5;
  }
</style>
