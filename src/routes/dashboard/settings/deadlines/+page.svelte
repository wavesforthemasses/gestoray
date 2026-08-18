<script lang="ts">
  import { projectStore } from '$lib/stores/project';
  import { onMount } from 'svelte';
  import { DeadlineSettingsService } from '../../deadlines/deadlineSettingsService';
  import type { DeadlineSettings } from '../../deadlines/schema';
  import { Card, Button } from '$lib';
  import { pageTitle } from '$lib/stores/page';
  import { toast } from '$lib/stores/toast.svelte';
  import { AlertTriangle, Save, Settings, Bell } from '@lucide/svelte';

  pageTitle.set('Configurazione Scadenzario & Allarmi');

  let settings = $state<DeadlineSettings>({
    entityNaming: 'scadenzario',
    customSingularLabel: '',
    customPluralLabel: '',
    prefix: 'DDL-',
    includeYear: true,
    numberPadding: 4,
    lastNumber: 0,
    lastCounterYear: new Date().getFullYear(),
    defaultStatus: 'attiva',
    defaultReminderDays: [30, 15, 7, 1],
    enablePushNotifications: false,
    fcmMessagingSenderId: ''
  });

  let reminderDaysString = $state('30, 15, 7, 1');
  let loading = $state(true);
  let saving = $state(false);

  onMount(async () => {
    try {
      settings = await DeadlineSettingsService.getSettings();
      if (settings.defaultReminderDays) {
        reminderDaysString = settings.defaultReminderDays.join(', ');
      }
    } catch (e) {
      console.error('Errore caricamento impostazioni deadlines:', e);
      toast.error('Impossibile caricare le impostazioni');
    } finally {
      loading = false;
    }
  });

  async function handleSave(e: SubmitEvent) {
    e.preventDefault();

    const parsedDays = reminderDaysString
      .split(',')
      .map(s => parseInt(s.trim()))
      .filter(n => !isNaN(n) && n > 0)
      .sort((a, b) => b - a);

    settings.defaultReminderDays = parsedDays.length > 0 ? parsedDays : [30, 15, 7, 1];

    saving = true;
    try {
      await DeadlineSettingsService.saveSettings(settings);
      toast.success('Impostazioni salvate con successo!');
    } catch (e) {
      console.error('Errore salvataggio impostazioni:', e);
      toast.error('Errore durante il salvataggio');
    } finally {
      saving = false;
    }
  }
</script>

<svelte:head>
  <title>Configurazione Scadenzario | {$projectStore?.projectName || 'ERP'}</title>
</svelte:head>

<div class="settings-page-container">
  <header class="page-header">
    <div class="header-title-box">
      <a href="/dashboard/settings" class="btn-module-list" title="Vai a Impostazioni" aria-label="Vai a Impostazioni">
        <Settings size={20} />
      </a>
      <div class="header-icon">
        <AlertTriangle size={24} color="#D97706" />
      </div>
      <div>
        <h1 class="page-main-title">Configurazione Scadenzario & Allarmi</h1>
        <p class="page-main-subtitle">Personalizza la denominazione agnostica, i giorni di preavviso allarmi e le notifiche push FCM.</p>
      </div>
    </div>
  </header>

  {#if loading}
    <div class="loading-state">Caricamento impostazioni...</div>
  {:else}
    <form onsubmit={handleSave}>
      <Card class="form-card">
        <h2 class="section-title">Denominazione Agnostica (Entity Naming)</h2>
        <p class="section-desc">Scegli la denominazione ufficiale utilizzata nel sistema (es. Scadenzario, Allarmi, Avvisi).</p>

        <div class="form-grid">
          <div class="form-group span-2">
            <label for="entityNaming">Tipologia Denominazione *</label>
            <select id="entityNaming" bind:value={settings.entityNaming} class="form-control">
              <option value="scadenzario">Scadenzario (Singolare: Scadenza | Plurale: Scadenzario & Allarmi)</option>
              <option value="allarmi">Allarmi & Avvisi (Singolare: Allarme | Plurale: Allarmi & Avvisi)</option>
              <option value="avvisi">Avvisi Operativi (Singolare: Avviso | Plurale: Avvisi Operativi)</option>
              <option value="custom">Denominazione Personalizzata...</option>
            </select>
          </div>

          {#if settings.entityNaming === 'custom'}
            <div class="form-group">
              <label for="customSingular">Etichetta Singolare Personalizzata *</label>
              <input id="customSingular" type="text" bind:value={settings.customSingularLabel} placeholder="es. Scadenza" required class="form-control" />
            </div>

            <div class="form-group">
              <label for="customPlural">Etichetta Plurale Personalizzata *</label>
              <input id="customPlural" type="text" bind:value={settings.customPluralLabel} placeholder="es. Scadenze Operative" required class="form-control" />
            </div>
          {/if}
        </div>

        <h2 class="section-title mt-24">Automatismi & Notifiche Allarmi</h2>
        <div class="form-grid">
          <div class="form-group span-2">
            <label for="remindersInput">Giorni di Preavviso Notifica (separati da virgola)</label>
            <input 
              id="remindersInput" 
              type="text" 
              bind:value={reminderDaysString} 
              placeholder="30, 15, 7, 1" 
              class="form-control"
            />
            <span class="help-text">Verranno inviate notifiche in-app N giorni prima della data di scadenza.</span>
          </div>

          <div class="form-group span-2 mt-12">
            <label for="pushToggle" class="checkbox-label">
              <input id="pushToggle" type="checkbox" bind:checked={settings.enablePushNotifications} />
              <span>Abilita Notifiche Push Firebase (FCM Mobile / Web)</span>
            </label>
            {#if settings.enablePushNotifications}
              <div class="fcm-box">
                <label for="fcmSenderId">Firebase Messaging Sender ID / App ID:</label>
                <input 
                  id="fcmSenderId" 
                  type="text" 
                  bind:value={settings.fcmMessagingSenderId} 
                  placeholder="es. 1234567890" 
                  class="form-control"
                />
              </div>
            {/if}
          </div>
        </div>

        <h2 class="section-title mt-24">Numerazione Automatica Codici</h2>
        <div class="form-grid">
          <div class="form-group">
            <label for="prefix">Prefisso Codice *</label>
            <input id="prefix" type="text" bind:value={settings.prefix} placeholder="DDL-" required class="form-control" />
          </div>

          <div class="form-group">
            <label for="padding">Cifre Zeri Padding *</label>
            <input id="padding" type="number" min="2" max="6" bind:value={settings.numberPadding} required class="form-control" />
          </div>
        </div>

        <div class="form-actions">
          <Button variant="primary" type="submit" disabled={saving}>
            <Save size={18} />
            <span>{saving ? 'Salvataggio...' : 'Salva Impostazioni'}</span>
          </Button>
        </div>
      </Card>
    </form>
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
    background: #FFFBEB;
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
  .help-text {
    font-size: 12px;
    color: var(--color-neutral-500);
  }
  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
  }
  .fcm-box {
    margin-top: 10px;
    background: var(--color-neutral-50);
    padding: 12px;
    border-radius: var(--radius-md);
    display: flex;
    flex-direction: column;
    gap: 6px;
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
  .mt-12 { margin-top: 12px; }
  .mt-24 { margin-top: 24px; }
</style>
