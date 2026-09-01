<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { WarehouseService } from '../../warehouse.service';
  import type { SupplierItem } from '../../schema';
  import { toast } from '$lib/stores/toast.svelte';
  import { confirmStore } from '$lib/stores/confirm.svelte';
  import { Building2, List, CheckCircle2, RefreshCw, Trash2 } from '@lucide/svelte';

  let supplierId = $derived($page.params.id);
  let supplier = $state<SupplierItem | null>(null);
  let loading = $state(true);
  let isSaving = $state(false);

  onMount(async () => {
    if (supplierId) {
      loading = true;
      try {
        supplier = await WarehouseService.getSupplierById(supplierId);
      } catch (err) {
        console.error('Errore caricamento fornitore:', err);
        toast.error('Fornitore non trovato');
      } finally {
        loading = false;
      }
    }
  });

  async function handleUpdate(e: Event) {
    e.preventDefault();
    if (!supplier) return;
    isSaving = true;
    try {
      await WarehouseService.updateSupplier(supplier.id, { ...supplier });
      toast.success('Dati fornitore aggiornati con successo');
      goto('/dashboard/warehouse/suppliers');
    } catch (err: any) {
      toast.error('Errore durante l\'aggiornamento: ' + err.message);
    } finally {
      isSaving = false;
    }
  }

  async function handleDelete() {
    if (!supplier) return;
    const confirmed = await confirmStore.prompt('Sei sicuro di voler eliminare questo fornitore?');
    if (!confirmed) return;
    try {
      await WarehouseService.deleteSupplier(supplier.id);
      toast.success('Fornitore eliminato');
      goto('/dashboard/warehouse/suppliers');
    } catch (err: any) {
      toast.error('Errore eliminazione: ' + err.message);
    }
  }
</script>

<svelte:head>
  <title>{supplier ? supplier.companyName : 'Dettaglio Fornitore'} - Gestoray</title>
</svelte:head>

<div class="form-page-container">
  <!-- Page Top Actions Bar -->
  <div class="page-top-actions">
    <div class="header-left">
      <div class="title-row">
        <div class="icon-bubble">
          <Building2 size={24} class="text-primary-600" />
        </div>
        <div>
          <h1 class="page-title">{supplier ? supplier.companyName : 'Dettaglio Fornitore'}</h1>
          <p class="page-subtitle">Modifica recapiti fiscali, condizioni commerciali e note</p>
        </div>
      </div>
    </div>

    <div class="header-right">
      <a href="/dashboard/warehouse/suppliers" class="btn-module-list">
        <List size={16} />
        <span>Elenco Fornitori</span>
      </a>
    </div>
  </div>

  <!-- Form Card (100% Full Width) -->
  <div class="form-card">
    {#if loading}
      <div class="loading-state">
        <RefreshCw size={28} class="animate-spin text-primary-500" />
        <p>Caricamento scheda fornitore...</p>
      </div>
    {:else if !supplier}
      <div class="empty-state">
        <p>Fornitore non trovato.</p>
        <a href="/dashboard/warehouse/suppliers" class="btn-secondary">Torna alla lista</a>
      </div>
    {:else}
      <form onsubmit={handleUpdate} class="form-layout">
        <div class="form-section">
          <h3 class="section-title">Dati Anagrafici & Fiscali</h3>
          <div class="fields-grid">
            <div class="form-group col-span-2">
              <label for="companyName">Ragione Sociale *</label>
              <input type="text" id="companyName" bind:value={supplier.companyName} required class="form-input" />
            </div>

            <div class="form-group">
              <label for="vatNumber">Partita IVA</label>
              <input type="text" id="vatNumber" bind:value={supplier.vatNumber} class="form-input" />
            </div>

            <div class="form-group">
              <label for="taxCode">Codice Fiscale</label>
              <input type="text" id="taxCode" bind:value={supplier.taxCode} class="form-input" />
            </div>

            <div class="form-group">
              <label for="sdiCode">Codice Destinatario SDI</label>
              <input type="text" id="sdiCode" bind:value={supplier.sdiCode} maxlength="7" class="form-input" />
            </div>

            <div class="form-group">
              <label for="pec">Indirizzo PEC</label>
              <input type="email" id="pec" bind:value={supplier.pec} class="form-input" />
            </div>
          </div>
        </div>

        <div class="form-section">
          <h3 class="section-title">Contatti & Recapiti</h3>
          <div class="fields-grid">
            <div class="form-group">
              <label for="contactPerson">Referente Commerciale</label>
              <input type="text" id="contactPerson" bind:value={supplier.contactPerson} class="form-input" />
            </div>

            <div class="form-group">
              <label for="email">Email Principale</label>
              <input type="email" id="email" bind:value={supplier.email} class="form-input" />
            </div>

            <div class="form-group">
              <label for="phone">Telefono / Cellulare</label>
              <input type="tel" id="phone" bind:value={supplier.phone} class="form-input" />
            </div>

            <div class="form-group">
              <label for="paymentTerms">Condizioni di Pagamento</label>
              <input type="text" id="paymentTerms" bind:value={supplier.paymentTerms} class="form-input" />
            </div>

            <div class="form-group col-span-2">
              <label for="address">Indirizzo Sede / Magazzino</label>
              <input type="text" id="address" bind:value={supplier.address} class="form-input" />
            </div>

            <div class="form-group">
              <label for="city">Città</label>
              <input type="text" id="city" bind:value={supplier.city} class="form-input" />
            </div>

            <div class="form-group">
              <label for="province">Provincia</label>
              <input type="text" id="province" bind:value={supplier.province} maxlength="2" class="form-input" />
            </div>
          </div>
        </div>

        <div class="form-section">
          <h3 class="section-title">Note Interne</h3>
          <div class="form-group">
            <textarea id="notes" bind:value={supplier.notes} rows="3" class="form-textarea"></textarea>
          </div>
        </div>

        <div class="form-actions">
          <button type="button" class="btn-danger" onclick={handleDelete}>
            <Trash2 size={16} />
            <span>Elimina Fornitore</span>
          </button>
          <div class="flex-spacer"></div>
          <a href="/dashboard/warehouse/suppliers" class="btn-secondary">Annulla</a>
          <button type="submit" class="btn-primary" disabled={isSaving}>
            {#if isSaving}
              <RefreshCw size={16} class="animate-spin" />
              <span>Salvataggio...</span>
            {:else}
              <CheckCircle2 size={16} />
              <span>Aggiorna Dati</span>
            {/if}
          </button>
        </div>
      </form>
    {/if}
  </div>
</div>

<style>
  .form-page-container {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .page-top-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 1rem;
  }

  .header-left .title-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .icon-bubble {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    background: var(--color-primary-50, #eff6ff);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .page-title {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--color-slate-900, #0f172a);
    margin: 0;
  }

  .page-subtitle {
    font-size: 0.875rem;
    color: var(--color-slate-500, #64748b);
    margin: 0.125rem 0 0 0;
  }

  .btn-module-list {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.5rem 0.875rem;
    border-radius: 8px;
    border: 1px solid var(--color-slate-300, #cbd5e1);
    background: #ffffff;
    color: var(--color-slate-700, #334155);
    font-size: 0.875rem;
    font-weight: 500;
    text-decoration: none;
  }

  .form-card {
    width: 100%;
    background: #ffffff;
    border-radius: 12px;
    border: 1px solid var(--color-slate-200, #e2e8f0);
    padding: 2rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  }

  .form-layout {
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  .form-section {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding-bottom: 1.5rem;
    border-bottom: 1px solid var(--color-slate-100, #f1f5f9);
  }

  .section-title {
    font-size: 1rem;
    font-weight: 600;
    color: var(--color-slate-800, #1e293b);
    margin: 0;
  }

  .fields-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 1.25rem;
  }

  .col-span-2 { grid-column: span 2; }
  @media (max-width: 640px) { .col-span-2 { grid-column: span 1; } }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .form-group label {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--color-slate-700, #334155);
  }

  .form-input, .form-textarea {
    width: 100%;
    padding: 0.625rem 0.875rem;
    border-radius: 8px;
    border: 1px solid var(--color-slate-300, #cbd5e1);
    font-size: 0.875rem;
    color: var(--color-slate-900, #0f172a);
  }

  .form-actions {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .flex-spacer { flex: 1; }

  .btn-primary {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1.25rem;
    background: var(--color-primary-600, #2563eb);
    color: #ffffff;
    border-radius: 8px;
    font-weight: 600;
    font-size: 0.875rem;
    border: none;
    cursor: pointer;
  }

  .btn-secondary {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1.25rem;
    background: #ffffff;
    color: var(--color-slate-700, #334155);
    border-radius: 8px;
    font-weight: 500;
    font-size: 0.875rem;
    border: 1px solid var(--color-slate-300, #cbd5e1);
    text-decoration: none;
  }

  .btn-danger {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.625rem 1rem;
    background: #fff1f2;
    color: #e11d48;
    border: 1px solid #fecdd3;
    border-radius: 8px;
    font-weight: 500;
    font-size: 0.875rem;
    cursor: pointer;
  }

  .loading-state, .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4rem 2rem;
    text-align: center;
    gap: 0.75rem;
  }
</style>
