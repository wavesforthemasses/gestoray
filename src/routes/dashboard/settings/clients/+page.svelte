<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { activeRoleState } from '$lib/auth.svelte';
  import { hasAccess } from '$lib/utils/authCheck';
  import { pageTitle } from '$lib/stores/page';
  import { toast } from '$lib/stores/toast.svelte';
  import { ClientSettingsService, DEFAULT_CLIENT_FIELDS_SETTINGS, type ClientFieldsSettings } from '$lib/services/clientSettingsService';
  import { ArrowLeft, Save, Building, FileText, UserCheck, ShieldAlert, Notebook } from '@lucide/svelte';

  pageTitle.set('Configurazione Campi Scheda Cliente');

  let settings = $state<ClientFieldsSettings>(JSON.parse(JSON.stringify(DEFAULT_CLIENT_FIELDS_SETTINGS)));
  let loading = $state(true);
  let saving = $state(false);

  $effect(() => {
    const currentRole = activeRoleState.role;
    if (currentRole && !hasAccess(currentRole, ['superadmin', 'amministrazione', 'direzione'])) {
      goto('/dashboard');
    }
  });

  onMount(async () => {
    try {
      const data = await ClientSettingsService.getSettings();
      settings = data;
    } catch (e) {
      toast.error('Errore nel caricamento delle impostazioni campi clienti.');
    } finally {
      loading = false;
    }
  });

  async function handleSave() {
    saving = true;
    try {
      await ClientSettingsService.saveSettings(settings);
      toast.success('Configurazione campi cliente salvata con successo!');
    } catch (e: any) {
      toast.error('Impossibile salvare la configurazione: ' + (e?.message || e));
    } finally {
      saving = false;
    }
  }
</script>

<div class="settings-page animate-fade-in">
  <div class="page-header">
    <div class="header-left">
      <button class="btn-back" onclick={() => goto('/dashboard/settings')} aria-label="Torna a Impostazioni">
        <ArrowLeft size={20} />
      </button>
      <div>
        <h2 class="page-title">Configurazione Campi Scheda Cliente</h2>
        <p class="page-subtitle">Scegli quali sezioni e gruppi di campi mostrare o nascondere nei form ed anagrafiche dei clienti.</p>
      </div>
    </div>

    <button class="btn-save" onclick={handleSave} disabled={saving || loading}>
      <Save size={18} />
      {#if saving}Salvataggio...{:else}Salva Modifiche{/if}
    </button>
  </div>

  {#if loading}
    <div class="loading-state">Caricamento impostazioni in corso...</div>
  {:else}
    <div class="settings-card">
      <h3 class="card-section-title">Sezioni Form & Scheda Anagrafica</h3>
      <p class="card-section-desc">Disattiva le sezioni non necessarie per semplificare la compilazione per i tuoi utenti.</p>

      <div class="group-list">
        <div class="group-item">
          <div class="group-info">
            <div class="group-icon primary"><Building size={22} /></div>
            <div>
              <div class="group-name">Dati Anagrafici</div>
              <div class="group-detail">Ragione Sociale, Soggetto Italiano, Partita IVA, Codice Fiscale, Codice Cliente, Gruppo Cliente, Stato Certificazione</div>
            </div>
          </div>
          <label class="switch">
            <input type="checkbox" bind:checked={settings.datiAnagrafici.visible} />
            <span class="slider"></span>
          </label>
        </div>

        <div class="group-item">
          <div class="group-info">
            <div class="group-icon info"><FileText size={22} /></div>
            <div>
              <div class="group-name">Fatturazione</div>
              <div class="group-detail">Indirizzo Sede Legale, Codice SDI, PEC Amministrazione, Condizioni di Pagamento, Telefono Centralino, IBAN di Appoggio</div>
            </div>
          </div>
          <label class="switch">
            <input type="checkbox" bind:checked={settings.fatturazioneSede.visible} />
            <span class="slider"></span>
          </label>
        </div>

        <div class="group-item">
          <div class="group-info">
            <div class="group-icon success"><UserCheck size={22} /></div>
            <div>
              <div class="group-name">Referenti Rapidi</div>
              <div class="group-detail">Referente Tecnico/Capocantiere, Tel. Referente, Email Contatto, Email Alternativa</div>
            </div>
          </div>
          <label class="switch">
            <input type="checkbox" bind:checked={settings.contattiReferenti.visible} />
            <span class="slider"></span>
          </label>
        </div>

        <div class="group-item">
          <div class="group-info">
            <div class="group-icon warning"><ShieldAlert size={22} /></div>
            <div>
              <div class="group-name">Affidabilità & Fido</div>
              <div class="group-detail">Esito Controllo CRIF, Classe di Rischio, Fido Massimo Concesso, Fido Residuo, Stato Pagamenti</div>
            </div>
          </div>
          <label class="switch">
            <input type="checkbox" bind:checked={settings.affidabilitaCredito.visible} />
            <span class="slider"></span>
          </label>
        </div>

        <div class="group-item">
          <div class="group-info">
            <div class="group-icon secondary"><Notebook size={22} /></div>
            <div>
              <div class="group-name">Note ERP & Automatiche Preventivo</div>
              <div class="group-detail">Note Amministrative Interne, Note Automatiche da includere nei preventivi</div>
            </div>
          </div>
          <label class="switch">
            <input type="checkbox" bind:checked={settings.noteErp.visible} />
            <span class="slider"></span>
          </label>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .settings-page {
    padding: 24px 0;
    max-width: 900px;
  }
  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
  }
  .header-left {
    display: flex;
    align-items: center;
    gap: 16px;
  }
  .btn-back {
    background: var(--color-neutral-100, #f3f4f6);
    border: 1px solid var(--color-neutral-200, #e5e7eb);
    padding: 8px;
    border-radius: var(--radius-md, 8px);
    cursor: pointer;
    display: flex;
    align-items: center;
    color: var(--color-neutral-700, #374151);
  }
  .btn-back:hover {
    background: var(--color-neutral-200, #e5e7eb);
  }
  .page-title {
    font-size: 24px;
    font-weight: 700;
    margin: 0;
    color: var(--color-neutral-900, #111827);
  }
  .page-subtitle {
    font-size: 14px;
    color: var(--color-neutral-500, #6b7280);
    margin: 4px 0 0 0;
  }
  .btn-save {
    display: flex;
    align-items: center;
    gap: 8px;
    background: var(--color-primary-600, #2563eb);
    color: white;
    padding: 10px 18px;
    border: none;
    border-radius: var(--radius-md, 8px);
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
  }
  .btn-save:hover:not(:disabled) {
    background: var(--color-primary-700, #1d4ed8);
  }
  .btn-save:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  .loading-state {
    padding: 40px;
    text-align: center;
    color: var(--color-neutral-500, #6b7280);
  }
  .settings-card {
    background: white;
    border: 1px solid var(--color-neutral-200, #e5e7eb);
    border-radius: var(--radius-lg, 12px);
    padding: 24px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
  }
  .card-section-title {
    font-size: 18px;
    font-weight: 600;
    margin: 0 0 4px 0;
    color: var(--color-neutral-800, #1f2937);
  }
  .card-section-desc {
    font-size: 14px;
    color: var(--color-neutral-500, #6b7280);
    margin: 0 0 20px 0;
  }
  .group-list {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .group-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px;
    background: var(--color-neutral-50, #f9fafb);
    border: 1px solid var(--color-neutral-200, #e5e7eb);
    border-radius: var(--radius-md, 8px);
  }
  .group-info {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .group-icon {
    width: 44px;
    height: 44px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .group-icon.primary { background: #eff6ff; color: #2563eb; }
  .group-icon.info { background: #f0fdf4; color: #16a34a; }
  .group-icon.success { background: #faf5ff; color: #9333ea; }
  .group-icon.warning { background: #fff7ed; color: #ea580c; }
  .group-icon.secondary { background: #f8fafc; color: #475569; }

  .group-name {
    font-size: 15px;
    font-weight: 600;
    color: var(--color-neutral-800, #1f2937);
  }
  .group-detail {
    font-size: 13px;
    color: var(--color-neutral-500, #6b7280);
    margin-top: 2px;
  }

  /* Toggle switch styling */
  .switch {
    position: relative;
    display: inline-block;
    width: 48px;
    height: 26px;
  }
  .switch input {
    opacity: 0;
    width: 0;
    height: 0;
  }
  .slider {
    position: absolute;
    cursor: pointer;
    top: 0; left: 0; right: 0; bottom: 0;
    background-color: #cbd5e1;
    transition: .3s;
    border-radius: 26px;
  }
  .slider:before {
    position: absolute;
    content: "";
    height: 20px;
    width: 20px;
    left: 3px;
    bottom: 3px;
    background-color: white;
    transition: .3s;
    border-radius: 50%;
  }
  input:checked + .slider {
    background-color: var(--color-primary-600, #2563eb);
  }
  input:checked + .slider:before {
    transform: translateX(22px);
  }
</style>
