<script lang="ts">
  import { goto } from '$app/navigation';
  import { WarehouseService } from '../../warehouse.service';
  import type { SupplierItem } from '../../schema';
  import { toast } from '$lib/stores/toast.svelte';
  import { Building2, List, CheckCircle2, RefreshCw } from '@lucide/svelte';

  let companyName = $state('');
  let supplierNumber = $state('');
  let vatNumber = $state('');
  let taxCode = $state('');
  let email = $state('');
  let phone = $state('');
  let pec = $state('');
  let sdiCode = $state('');
  let address = $state('');
  let zipCode = $state('');
  let city = $state('');
  let province = $state('');
  let contactPerson = $state('');
  let paymentTerms = $state('Rimessa Diretta 30gg');
  let notes = $state('');
  let isSaving = $state(false);

  async function handleSubmit(e: Event) {
    e.preventDefault();
    if (!companyName.trim()) {
      toast.error('Inserisci la ragione sociale del fornitore');
      return;
    }

    isSaving = true;
    try {
      await WarehouseService.createSupplier({
        companyName: companyName.trim(),
        supplierNumber: supplierNumber.trim(),
        vatNumber: vatNumber.trim(),
        taxCode: taxCode.trim(),
        email: email.trim(),
        phone: phone.trim(),
        pec: pec.trim(),
        sdiCode: sdiCode.trim(),
        address: address.trim(),
        zipCode: zipCode.trim(),
        city: city.trim(),
        province: province.trim(),
        contactPerson: contactPerson.trim(),
        paymentTerms: paymentTerms.trim(),
        notes: notes.trim(),
        status: 'active'
      });

      toast.success('Fornitore creato con successo');
      goto('/dashboard/warehouse/suppliers');
    } catch (err: any) {
      console.error('Errore salvataggio fornitore:', err);
      toast.error(err.message || 'Errore durante il salvataggio');
    } finally {
      isSaving = false;
    }
  }
</script>

<svelte:head>
  <title>Nuovo Fornitore - Gestoray</title>
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
          <h1 class="page-title">Nuovo Fornitore</h1>
          <p class="page-subtitle">Inserisci un nuovo fornitore per ordini e carichi di magazzino</p>
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
    <form onsubmit={handleSubmit} class="form-layout">
      <div class="form-section">
        <h3 class="section-title">Dati Anagrafici & Fiscali</h3>
        <div class="fields-grid">
          <div class="form-group col-span-2">
            <label for="companyName">Ragione Sociale / Nome Fornitore *</label>
            <input type="text" id="companyName" bind:value={companyName} required class="form-input" placeholder="Es. Edilizia & Forniture S.r.l." />
          </div>

          <div class="form-group">
            <label for="vatNumber">Partita IVA</label>
            <input type="text" id="vatNumber" bind:value={vatNumber} class="form-input" placeholder="IT12345678901" />
          </div>

          <div class="form-group">
            <label for="taxCode">Codice Fiscale</label>
            <input type="text" id="taxCode" bind:value={taxCode} class="form-input" />
          </div>

          <div class="form-group">
            <label for="sdiCode">Codice Destinatario SDI</label>
            <input type="text" id="sdiCode" bind:value={sdiCode} maxlength="7" class="form-input" placeholder="M5UXCR1 o 0000000" />
          </div>

          <div class="form-group">
            <label for="pec">Indirizzo PEC</label>
            <input type="email" id="pec" bind:value={pec} class="form-input" placeholder="fornitore@pec.it" />
          </div>
        </div>
      </div>

      <div class="form-section">
        <h3 class="section-title">Contatti & Recapiti</h3>
        <div class="fields-grid">
          <div class="form-group">
            <label for="contactPerson">Referente Commerciale</label>
            <input type="text" id="contactPerson" bind:value={contactPerson} class="form-input" placeholder="Nome e cognome referente" />
          </div>

          <div class="form-group">
            <label for="email">Email Principale</label>
            <input type="email" id="email" bind:value={email} class="form-input" placeholder="ordini@fornitore.it" />
          </div>

          <div class="form-group">
            <label for="phone">Telefono / Cellulare</label>
            <input type="tel" id="phone" bind:value={phone} class="form-input" placeholder="+39 02 123456" />
          </div>

          <div class="form-group">
            <label for="paymentTerms">Condizioni di Pagamento</label>
            <input type="text" id="paymentTerms" bind:value={paymentTerms} class="form-input" placeholder="Es. Bonifico 30/60 gg d.f." />
          </div>

          <div class="form-group col-span-2">
            <label for="address">Indirizzo Sede Legale / Magazzino</label>
            <input type="text" id="address" bind:value={address} class="form-input" placeholder="Via Roma, 10" />
          </div>

          <div class="form-group">
            <label for="city">Città</label>
            <input type="text" id="city" bind:value={city} class="form-input" />
          </div>

          <div class="form-group">
            <label for="province">Provincia (Sigla)</label>
            <input type="text" id="province" bind:value={province} maxlength="2" class="form-input" placeholder="MI" />
          </div>
        </div>
      </div>

      <div class="form-section">
        <h3 class="section-title">Note Interne</h3>
        <div class="form-group">
          <textarea id="notes" bind:value={notes} rows="3" class="form-textarea" placeholder="Note operative, sconti concordati o listini dedicati..."></textarea>
        </div>
      </div>

      <div class="form-actions">
        <a href="/dashboard/warehouse/suppliers" class="btn-secondary">Annulla</a>
        <button type="submit" class="btn-primary" disabled={isSaving}>
          {#if isSaving}
            <RefreshCw size={16} class="animate-spin" />
            <span>Salvataggio...</span>
          {:else}
            <CheckCircle2 size={16} />
            <span>Salva Fornitore</span>
          {/if}
        </button>
      </div>
    </form>
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

  .col-span-2 {
    grid-column: span 2;
  }

  @media (max-width: 640px) {
    .col-span-2 { grid-column: span 1; }
  }

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
    background: #ffffff;
  }

  .form-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 1rem;
  }

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
</style>
