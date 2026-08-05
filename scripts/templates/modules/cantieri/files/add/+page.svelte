<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { CantieriService } from '../cantieri.service';
  import { CantiereSettingsService } from '../cantiereSettingsService';
  import type { CantiereItem, CantiereStatus, CantiereSettings } from '../schema';
  import { activeRoleState, authState } from '$lib/auth.svelte';
  import { toast } from '$lib/stores/toast.svelte';
  import { Card, FormField, Button } from '$lib';
  import { pageTitle } from '$lib/stores/page';
  import { ClientsService } from '../../../../routes/dashboard/clients/clients.service';
  import { Building2, Save, ArrowLeft, User, MapPin, Calendar, Euro, FileText } from '@lucide/svelte';

  pageTitle.set('Nuovo Cantiere');

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

  let clientsList = $state<any[]>([]);
  let loadingClients = $state(true);
  let saving = $state(false);

  let form = $state<Omit<CantiereItem, 'id'>>({
    code: 'AUTO',
    clientId: '',
    clientName: '',
    name: '',
    address: { street: '', city: '', zip: '', province: '' },
    status: 'fase_contrattuale',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    progress: 0,
    estimatedAmount: 0,
    notes: ''
  });

  onMount(async () => {
    try {
      const [s, clientsRes] = await Promise.all([
        CantiereSettingsService.getSettings(),
        ClientsService.fetchClients('', activeRoleState.role || 'superadmin', authState.user?.uid || '', 100)
      ]);
      settings = s;
      clientsList = clientsRes.list || [];
      form.status = settings.defaultStatus || 'fase_contrattuale';
    } catch (e) {
      console.error('Errore caricamento per creazione cantiere:', e);
    } finally {
      loadingClients = false;
    }
  });

  function handleClientSelect(event: Event) {
    const selectedId = (event.target as HTMLSelectElement).value;
    const client = clientsList.find(c => c.id === selectedId);
    if (client) {
      form.clientId = client.id;
      form.clientName = client.name || client.ragioneSociale || `${client.nome || ''} ${client.cognome || ''}`.trim();
      if (client.address) {
        form.address = {
          street: client.address.street || '',
          city: client.address.city || '',
          zip: client.address.zip || '',
          province: client.address.province || ''
        };
      }
    }
  }

  async function handleSubmit() {
    if (!form.clientId) {
      toast.error('Seleziona un cliente valido.');
      return;
    }
    if (!form.name.trim()) {
      toast.error(`Inserisci il nome del ${labels.singular.toLowerCase()}.`);
      return;
    }

    saving = true;
    try {
      const newId = await CantieriService.createCantiere(form, authState.user?.uid || '');
      toast.success(`${labels.singular} creato con successo!`);
      goto(`/dashboard/cantieri/${newId}`);
    } catch (e: any) {
      toast.error('Errore durante la creazione: ' + e.message);
    } finally {
      saving = false;
    }
  }
</script>

<div class="add-cantiere-page animate-fade-in">
  <div class="page-top-actions">
    <div>
      <a href="/dashboard/cantieri" class="back-link">
        <ArrowLeft size={16} /> Torna a {labels.plural}
      </a>
      <h2 class="title-header">
        <Building2 size={28} color="var(--color-primary-600)" />
        {labels.newBtn}
      </h2>
    </div>
  </div>

  <form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
    <Card class="form-card">
      <div class="form-sections-grid">
        <!-- 1. INTESTAZIONE E CLIENTE -->
        <div class="form-section">
          <h3><User size={18} /> Cliente & Intestazione</h3>

          <FormField id="cantiere-client" label="Cliente Titolare *" helpText="Seleziona il cliente dal CRM">
            <select id="cantiere-client" value={form.clientId} onchange={handleClientSelect} required>
              <option value="">-- Seleziona Cliente --</option>
              {#each clientsList as c}
                <option value={c.id}>{c.name || c.ragioneSociale || `${c.nome || ''} ${c.cognome || ''}`.trim()}</option>
              {/each}
            </select>
          </FormField>

          <FormField id="cantiere-name" label={`Nome ${labels.singular} / Progetto *`} helpText="Es. Milano Via Dante - Ristrutturazione">
            <input type="text" id="cantiere-name" bind:value={form.name} placeholder="Nome identificativo cantiere" required />
          </FormField>

          <FormField id="cantiere-status" label="Stato Iniziale">
            <select id="cantiere-status" bind:value={form.status}>
              <option value="fase_contrattuale">Fase Contrattuale</option>
              <option value="aperto">Aperto</option>
              <option value="in_pausa">In Pausa</option>
              <option value="completato">Completato</option>
            </select>
          </FormField>
        </div>

        <!-- 2. UBICAZIONE E INDIRIZZO -->
        <div class="form-section">
          <h3><MapPin size={18} /> Ubicazione & Indirizzo Cantiere</h3>

          <FormField id="cand-street" label="Indirizzo / Via">
            <input type="text" id="cand-street" value={form.address?.street || ''} oninput={(e) => { if (!form.address) form.address = { street: '', city: '', zip: '', province: '' }; form.address.street = (e.target as HTMLInputElement).value; }} placeholder="Via Dante 10" />
          </FormField>

          <div class="form-row-2col">
            <FormField id="cand-city" label="Città">
              <input type="text" id="cand-city" value={form.address?.city || ''} oninput={(e) => { if (!form.address) form.address = { street: '', city: '', zip: '', province: '' }; form.address.city = (e.target as HTMLInputElement).value; }} placeholder="Milano" />
            </FormField>
            <FormField id="cand-prov" label="Provincia">
              <input type="text" id="cand-prov" value={form.address?.province || ''} oninput={(e) => { if (!form.address) form.address = { street: '', city: '', zip: '', province: '' }; form.address.province = (e.target as HTMLInputElement).value; }} placeholder="MI" maxLength={2} />
            </FormField>
          </div>
        </div>

        <!-- 3. DATE E VALORI -->
        <div class="form-section">
          <h3><Calendar size={18} /> Date & Importo Stimato</h3>

          <div class="form-row-2col">
            <FormField id="cand-start" label="Data Inizio">
              <input type="date" id="cand-start" bind:value={form.startDate} />
            </FormField>
            <FormField id="cand-end" label="Data Fine Previsionale (Opzionale)">
              <input type="date" id="cand-end" bind:value={form.endDate} />
            </FormField>
          </div>

          <FormField id="cand-amount" label="Importo Stimato (€) Fallback" helpText="Importo preventivato di base se non sono collegati contratti approvati">
            <input type="number" step="0.01" min="0" id="cand-amount" bind:value={form.estimatedAmount} />
          </FormField>
        </div>
      </div>

      <div class="form-footer">
        <a href="/dashboard/cantieri" class="btn-cancel">Annulla</a>
        <Button type="submit" variant="primary" disabled={saving}>
          <Save size={16} /> {saving ? 'Salvataggio in corso...' : `Salva ${labels.singular}`}
        </Button>
      </div>
    </Card>
  </form>
</div>

<style>
  .add-cantiere-page {
    width: 100%;
    padding: 20px 0;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
  .back-link {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: var(--color-neutral-500);
    text-decoration: none;
    font-size: 13px;
    margin-bottom: 6px;
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

  .form-sections-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 24px;
  }
  .form-section {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .form-section h3 {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 16px;
    font-weight: 600;
    color: var(--color-neutral-800);
    margin: 0 0 8px 0;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--color-neutral-200);
  }

  .form-row-2col {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  .form-footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 12px;
    margin-top: 24px;
    padding-top: 16px;
    border-top: 1px solid var(--color-neutral-200);
  }
  .btn-cancel {
    color: var(--color-neutral-600);
    text-decoration: none;
    font-size: 14px;
    padding: 8px 16px;
  }
</style>
