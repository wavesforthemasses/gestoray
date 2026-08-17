<script lang="ts">
  import { projectStore } from '$lib/stores/project';
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { InterventiService } from '../interventi.service';
  import type { InterventionItem, InterventionConsuntivoItem } from '../schema';
  import { InterventionSettingsService, type InterventionSettingsConfig, DEFAULT_INTERVENTION_SETTINGS } from '$lib/services/interventionSettings';
  import { CustomFieldsService } from '$lib/services/customFieldsService';
  import type { CustomFieldDefinition } from '$lib/types/customFields';
  import CustomFieldsRenderer from '$lib/components/CustomFieldsRenderer.svelte';
  import { toast } from '$lib/stores/toast.svelte';

  let interventionId = $derived(page.params.id);
  let intervention = $state<InterventionItem | null>(null);
  let settings = $state<InterventionSettingsConfig>({ ...DEFAULT_INTERVENTION_SETTINGS });
  let products = $state<{ id: string; name: string; price: number }[]>([]);
  let customFieldsList = $state<CustomFieldDefinition[]>([]);
  let loading = $state(true);
  let savingConsuntivo = $state(false);

  // Consuntivo Modal & Form State
  let showConsuntivoModal = $state(false);
  let consuntivoItems = $state<InterventionConsuntivoItem[]>([]);
  let signerName = $state('');
  let signatureData = $state('');

  // Nuova riga materiale
  let selectedProductId = $state('');
  let newItemDesc = $state('');
  let newItemQty = $state(1);
  let newItemPrice = $state(0);

  // Signature Canvas
  let canvasElem: HTMLCanvasElement | null = $state(null);
  let isDrawing = $state(false);

  onMount(async () => {
    try {
      settings = await InterventionSettingsService.getSettings();
      customFieldsList = await CustomFieldsService.getFieldsForModule('interventi');
      await loadIntervention();
      try {
        const mod = await import('../../products/files/products.service');
        if (mod?.ProductsService) {
          const pList = await mod.ProductsService.getProducts();
          products = pList.map((p: any) => ({
            id: p.id,
            name: p.name || p.code,
            price: p.price ?? p.listPrice ?? p.unitPrice ?? 0
          }));
        }
      } catch (e) {
        console.warn('Modulo products non disponibile, caricamento manuale prodotti disabilitato in consuntivazione.');
      }
    } catch (e) {
      console.error('Errore caricamento dettaglio intervento:', e);
    } finally {
      loading = false;
    }
  });

  async function loadIntervention() {
    if (!interventionId) return;
    let attempts = 0;
    while (attempts < 5) {
      intervention = await InterventiService.getInterventionById(interventionId);
      if (intervention) break;
      attempts++;
      await new Promise(r => setTimeout(r, 300));
    }
    if (intervention) {
      consuntivoItems = intervention.items ? [...intervention.items] : [];
      signerName = intervention.signedByName || '';
      signatureData = intervention.clientSignature || '';
    }
  }

  function handleProductSelect() {
    if (selectedProductId) {
      const p = products.find(prod => prod.id === selectedProductId);
      if (p) {
        newItemDesc = p.name;
        newItemPrice = p.price;
      }
    }
  }

  function addMaterialItem() {
    if (!newItemDesc.trim() || newItemQty <= 0) return;
    const newItem: InterventionConsuntivoItem = {
      id: Date.now().toString(),
      productId: selectedProductId || undefined,
      description: newItemDesc.trim(),
      pricingUnit: 'quantita',
      quantity: newItemQty,
      unitPrice: newItemPrice,
      total: newItemQty * newItemPrice
    };
    consuntivoItems = [...consuntivoItems, newItem];
    selectedProductId = '';
    newItemDesc = '';
    newItemQty = 1;
    newItemPrice = 0;
  }

  function removeMaterialItem(id: string) {
    consuntivoItems = consuntivoItems.filter(i => i.id !== id);
  }

  // Signature Drawing
  function startDrawing(e: MouseEvent | TouchEvent) {
    isDrawing = true;
    const ctx = canvasElem?.getContext('2d');
    if (!ctx || !canvasElem) return;
    const rect = canvasElem.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
  }

  function draw(e: MouseEvent | TouchEvent) {
    if (!isDrawing || !canvasElem) return;
    const ctx = canvasElem.getContext('2d');
    if (!ctx) return;
    const rect = canvasElem.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
  }

  function stopDrawing() {
    if (isDrawing && canvasElem) {
      isDrawing = false;
      signatureData = canvasElem.toDataURL();
    }
  }

  function clearSignature() {
    if (canvasElem) {
      const ctx = canvasElem.getContext('2d');
      ctx?.clearRect(0, 0, canvasElem.width, canvasElem.height);
      signatureData = '';
    }
  }

  async function handleConsuntivaSubmit() {
    if (!interventionId) return;
    savingConsuntivo = true;
    try {
      await InterventiService.consuntivaIntervention(
        interventionId, 
        totalHoursForContract, 
        consuntivoItems, 
        signerName.trim(), 
        signatureData
      );
      showConsuntivoModal = false;
      await loadIntervention();
    } catch (e: any) {
      toast.error('Errore consuntivazione: ' + e.message);
    } finally {
      savingConsuntivo = false;
    }
  }

  async function handleSaveInterventionDetails(updatedData: Partial<InterventionItem>) {
    if (!interventionId) return;
    await InterventiService.updateIntervention(interventionId, updatedData);
    toast.success('Dettagli intervento aggiornati con successo!');
    await loadIntervention();
  }

  function printRapportino() {
    window.print();
  }

  let totalHoursForContract = $derived(
    consuntivoItems
      .filter(i => !i.pricingUnit || i.pricingUnit === 'ora')
      .reduce((acc, curr) => acc + (curr.quantity || 0), 0)
  );

  let calculatedConsuntivoTotal = $derived(
    consuntivoItems.reduce((acc, curr) => acc + ((curr.quantity || 0) * (curr.unitPrice || 0)), 0)
  );

  function formatDate(isoStr?: string) {
    if (!isoStr) return '-';
    try {
      return new Date(isoStr).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return isoStr;
    }
  }
</script>

<svelte:head>
  <title>{intervention ? intervention.title : 'Dettaglio Intervento'} | {$projectStore?.projectName || 'ERP'}</title>
</svelte:head>

<div class="intervention-detail-page">
  {#if loading}
    <div class="loading-state">Caricamento dettaglio intervento...</div>
  {:else if !intervention}
    <div class="empty-state">
      <h3>Intervento non trovato</h3>
      <a href="/dashboard/interventi" class="btn btn-secondary">← Torna alla Dashboard</a>
    </div>
  {:else}
    <!-- HEADER -->
    <header class="page-header no-print">
      <a href="/dashboard/interventi" class="back-link">← Torna agli Interventi</a>
      <div class="header-main">
        <div>
          <h1 class="page-title">{intervention.title}</h1>
          <p class="page-subtitle">Rapportino N° {intervention.id?.slice(0, 8).toUpperCase()} | Cliente: <strong>{intervention.clientName || 'N.D.'}</strong></p>
        </div>
        <div class="header-actions">
          <button type="button" class="btn btn-secondary" onclick={printRapportino}>🖨️ Stampa Rapportino</button>
          <a href="/dashboard/interventi/{interventionId}/edit" class="btn btn-secondary">✏️ Modifica Intervento</a>
          {#if intervention.status !== 'completato' && intervention.status !== 'approvato' && intervention.status !== 'fatturato'}
            <button type="button" class="btn btn-primary" onclick={() => showConsuntivoModal = true}>⚡ Consuntiva & Trasforma in Bolla</button>
          {:else}
            <button type="button" class="btn btn-secondary" onclick={() => showConsuntivoModal = true}>✏️ Modifica Consuntivo</button>
          {/if}
        </div>
      </div>
    </header>

    <!-- INTESTAZIONE RAPPORTINO PER STAMPA -->
    <div class="print-header">
      <h2>RAPPORTINO DI INTERVENTO TECNICO</h2>
      <p>{$projectStore?.projectName || 'ERP'} Field Service | Id Intervento: {intervention.id}</p>
    </div>

    <!-- CARDS DETTAGLIO -->
    <div class="detail-grid">
      <!-- INFO PRINCIPALI -->
      <section class="detail-card">
        <h3 class="card-title">📌 Informazioni Generali</h3>
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">Stato Intervento:</span>
            <span class="badge badge-primary">{intervention.status.toUpperCase()}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Modalità Valorizzazione:</span>
            {#if intervention.mode === 'ad_erogazione'}
              <span class="badge badge-purple">📦 Ad Erogazione (Monte Ore Contratto)</span>
            {:else}
              <span class="badge badge-blue">📄 A Bolla (€ {intervention.totalAmount || 0})</span>
            {/if}
          </div>
          <div class="info-item">
            <span class="info-label">Tipologia:</span>
            <span>{intervention.type}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Tariffa Oraria Applicata:</span>
            <span>€ {intervention.hourlyRateSnapshot || settings.defaultHourlyRate}/h</span>
          </div>
        </div>

        <div class="info-section">
          <h4>Note Operative:</h4>
          <p class="desc-text">{intervention.description || 'Nessuna nota aggiuntiva.'}</p>
        </div>
      </section>

      <!-- CLIENTE & LUOGO -->
      <section class="detail-card">
        <h3 class="card-title">👤 Cliente & {settings.locationLabel}</h3>
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">Cliente:</span>
            <strong>{intervention.clientName || 'N.D.'}</strong>
          </div>
          <div class="info-item">
            <span class="info-label">{settings.locationLabel}:</span>
            <span class="location-tag">📍 {intervention.locationName || 'Sede Principale'}</span>
          </div>
          {#if intervention.contractTitle}
            <div class="info-item">
              <span class="info-label">Contratto:</span>
              <span>📄 {intervention.contractTitle}</span>
            </div>
          {/if}
        </div>
      </section>

      {#if customFieldsList.length > 0 && intervention.customFields}
        <section class="detail-card">
          <h3 class="card-title">🧩 Campi Personalizzati Aziendali</h3>
          <CustomFieldsRenderer fields={customFieldsList} values={intervention.customFields || {}} readonly={true} />
        </section>
      {/if}

      <!-- TEMPISTICHE STIMA VS REALI -->
      <section class="detail-card">
        <h3 class="card-title">⏰ Tempistiche & Ore Consuntivate</h3>
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">Inizio Programmato:</span>
            <span>{formatDate(intervention.scheduledStartAt)}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Fine Programmata:</span>
            <span>{formatDate(intervention.scheduledEndAt)}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Ore Stimate:</span>
            <span>{intervention.estimatedHours || 0} ore</span>
          </div>
          <div class="info-item">
            <span class="info-label">Ore Reali Lavorate:</span>
            <strong class="text-success">{intervention.actualHoursWorked || intervention.actualQuantityWorked || 0} unità/ore</strong>
          </div>
        </div>
      </section>

      <!-- RISORSE ASSEGNATE -->
      <section class="detail-card">
        <h3 class="card-title">👥 Risorse Umane & Mezzi Aziendali</h3>
        <div class="info-grid">
          {#if intervention.teamName}
            <div class="info-item">
              <span class="info-label">Squadra:</span>
              <span class="badge badge-info">👥 {intervention.teamName}</span>
            </div>
          {/if}
          <div class="info-item">
            <span class="info-label">Operatori Presenti ({intervention.assignedOperatorUids?.length || 0}):</span>
            <span>{intervention.assignedOperatorUids?.join(', ') || 'Nessun operatore assegnato'}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Mezzi Prenotati/Usati ({intervention.vehicleIds?.length || 0}):</span>
            <span>{intervention.vehicleIds?.join(', ') || 'Nessun mezzo'}</span>
          </div>
        </div>
      </section>
    </div>

    <!-- ATTIVITÀ E VOCI (CONSUNTIVO) -->
    <section class="detail-card full-width">
      <h3 class="card-title">📋 Attività & Voci dell'Intervento (Consuntivo)</h3>
      {#if !intervention.items || intervention.items.length === 0}
        <p class="empty-text">Nessuna attività o voce registrata nel rapportino.</p>
      {:else}
        <table class="items-table">
          <thead>
            <tr>
              <th>Voce / Descrizione</th>
              <th>Unità</th>
              <th>Quantità</th>
              <th>Tariffa Unitaria</th>
              <th class="text-right">Subtotale</th>
            </tr>
          </thead>
          <tbody>
            {#each intervention.items as item}
              <tr>
                <td>{item.description || item.type || 'Attività'}</td>
                <td><span class="badge badge-info">{item.pricingUnit || 'ora'}</span></td>
                <td>{item.quantity}</td>
                <td>€ {(item.unitPrice || 0).toFixed(2)}</td>
                <td class="text-right font-bold">€ {(item.total || (item.quantity * (item.unitPrice || 0))).toFixed(2)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      {/if}
    </section>

    <!-- FIRMA E CONFERMA CLIENTE -->
    <section class="detail-card full-width">
      <h3 class="card-title">✍️ Firma & Accettazione Cliente</h3>
      {#if intervention.clientSignature}
        <div class="signature-display">
          <div>
            <p>Firmato da: <strong>{intervention.signedByName || 'Cliente'}</strong></p>
            <p>Data Firma: <span>{formatDate(intervention.signedAt)}</span></p>
          </div>
          <img src={intervention.clientSignature} alt="Firma Cliente" class="signature-img" />
        </div>
      {:else}
        <p class="empty-text">Firma digitale del cliente non ancora raccolta. Puoi raccoglierla cliccando su "Consuntiva & Trasforma in Bolla".</p>
      {/if}
    </section>

    <!-- MODALE DI CONSUNTIVAZIONE E TRASFORMAZIONE IN BOLLA -->
    {#if showConsuntivoModal}
      <div class="modal-overlay">
        <div class="modal-card">
          <div class="modal-header">
            <h2>⚡ Consuntiva Intervento & Trasforma in Bolla</h2>
            <button type="button" class="btn-close" onclick={() => showConsuntivoModal = false}>✕</button>
          </div>

          <form onsubmit={(e) => { e.preventDefault(); handleConsuntivaSubmit(); }}>
            <div class="modal-body">
              <!-- CONSUNTIVAZIONE ATTIVITÀ & VOCI -->
              <div class="materials-section">
                <h4>📋 Attività & Voci dell'Intervento (Consuntivo Quantità)</h4>
                <p class="section-desc">Verifica e rettifica le quantità effettive svolte dai tecnici per ciascuna voce:</p>

                <div class="consuntivo-table-wrap">
                  <table class="items-table modal-items-table">
                    <thead>
                      <tr>
                        <th>Voce / Descrizione</th>
                        <th>Unità</th>
                        <th style="width: 100px;">Qtà Effettiva</th>
                        <th>Tariffa</th>
                        <th class="text-right">Subtotale</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {#each consuntivoItems as item}
                        <tr>
                          <td>
                            <input type="text" bind:value={item.description} class="table-input" />
                          </td>
                          <td>
                            <span class="unit-badge">{item.pricingUnit || 'ora'}</span>
                          </td>
                          <td>
                            <input type="number" step="0.5" min="0" bind:value={item.quantity} class="table-input qty-input" />
                          </td>
                          <td>€ {(item.unitPrice || 0).toFixed(2)}</td>
                          <td class="text-right font-bold">€ {((item.quantity || 0) * (item.unitPrice || 0)).toFixed(2)}</td>
                          <td>
                            <button type="button" class="btn-icon-danger" onclick={() => removeMaterialItem(item.id)} title="Elimina Voce">🗑️</button>
                          </td>
                        </tr>
                      {/each}
                    </tbody>
                  </table>
                </div>

                <h4 style="margin-top: 1.2rem;">📦 Aggiungi Materiale / Ricambio Extra dal Catalogo</h4>
                <div class="add-material-form">
                  <select bind:value={selectedProductId} onchange={handleProductSelect}>
                    <option value="">-- Seleziona da Catalogo --</option>
                    {#each products as p}
                      <option value={p.id}>{p.name} (€ {p.price})</option>
                    {/each}
                  </select>
                  <input type="text" placeholder="Oppure descrizione manuale" bind:value={newItemDesc} />
                  <input type="number" min="1" placeholder="Qtà" bind:value={newItemQty} style="width: 80px;" />
                  <input type="number" step="0.01" placeholder="Prezzo €" bind:value={newItemPrice} style="width: 100px;" />
                  <button type="button" class="btn btn-secondary" onclick={addMaterialItem}>+ Aggiungi</button>
                </div>
              </div>

              <!-- FIRMA DIGITAL CANVAS INTEGRATO NEL MODALE -->
              <div class="signature-section">
                <h4>✍️ Firma Digitale Cliente (Opzionale)</h4>
                <div class="form-group">
                  <label for="signerName">Nome & Cognome Firmatario</label>
                  <input type="text" id="signerName" bind:value={signerName} placeholder="es. Mario Rossi" class="table-input" />
                </div>

                <div class="canvas-wrapper mt-10">
                  <span class="info-label mb-4" style="display: block;">Disegna la firma nel riquadro sottostante (Touch / Mouse):</span>
                  <canvas 
                    bind:this={canvasElem}
                    width={500}
                    height={140}
                    class="signature-canvas"
                    onmousedown={startDrawing}
                    onmousemove={draw}
                    onmouseup={stopDrawing}
                    onmouseleave={stopDrawing}
                    ontouchstart={startDrawing}
                    ontouchmove={draw}
                    ontouchend={stopDrawing}
                  ></canvas>
                  <div class="mt-6 text-right">
                    <button type="button" class="btn-clear-sig" onclick={clearSignature}>🗑️ Pulisci Canvas Firma</button>
                  </div>
                </div>
              </div>

              <div class="tot-preview">
                <div>
                  {#if intervention?.mode === 'ad_erogazione'}
                    <span class="contract-hours-preview">Ore da scaricare dal Contratto: <strong>{totalHoursForContract}h</strong></span>
                  {/if}
                  <div>Totale Consuntivo Intervento ({consuntivoItems.length} voci):</div>
                </div>
                <strong class="total-price-large">€ {calculatedConsuntivoTotal.toFixed(2)}</strong>
              </div>
            </div>

            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" onclick={() => showConsuntivoModal = false}>Annulla</button>
              <button type="submit" class="btn btn-primary" disabled={savingConsuntivo}>
                {savingConsuntivo ? 'Salvataggio...' : 'Conferma Consuntivo & Salva'}
              </button>
            </div>
          </form>
        </div>
      </div>
    {/if}
  {/if}
</div>

<style>
  .intervention-detail-page {
    width: 100%;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .back-link { color: #64748b; text-decoration: none; font-size: 0.88rem; }
  .page-title { font-size: 1.6rem; font-weight: 800; margin: 0.3rem 0 0 0; }
  .page-subtitle { color: #64748b; font-size: 0.9rem; margin: 0.2rem 0 0 0; }

  .header-main { display: flex; justify-content: space-between; align-items: flex-end; }
  .header-actions { display: flex; gap: 0.8rem; }

  .detail-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
    gap: 1.5rem;
  }

  .detail-card {
    background: #ffffff;
    border-radius: 12px;
    border: 1px solid #e2e8f0;
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .full-width { grid-column: 1 / -1; }

  .card-title { font-size: 1.15rem; font-weight: 700; margin: 0; color: #0f172a; }

  .info-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; }
  .info-item { display: flex; flex-direction: column; gap: 0.2rem; }
  .info-label { font-size: 0.82rem; color: #64748b; font-weight: 500; }

  .desc-text { background: #f8fafc; padding: 0.8rem; border-radius: 8px; border: 1px solid #e2e8f0; margin: 0; font-size: 0.9rem; }

  .items-table { width: 100%; border-collapse: collapse; margin-top: 0.5rem; font-size: 0.9rem; }
  .items-table th { background: #f8fafc; padding: 0.8rem; text-align: left; border-bottom: 1px solid #e2e8f0; }
  .items-table td { padding: 0.8rem; border-bottom: 1px solid #f1f5f9; }

  .signature-display { display: flex; align-items: center; justify-content: space-between; background: #f8fafc; padding: 1rem; border-radius: 8px; border: 1px solid #e2e8f0; }
  .signature-img { max-height: 100px; border: 1px solid #cbd5e1; background: white; border-radius: 6px; }

  /* MODAL */
  .modal-overlay { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.6); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 1rem; }
  .modal-card { background: white; border-radius: 12px; max-width: 720px; width: 100%; max-height: 90vh; overflow-y: auto; padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem; }
  .modal-header { display: flex; justify-content: space-between; align-items: center; }
  .btn-close { background: none; border: none; font-size: 1.2rem; cursor: pointer; }

  .modal-body { display: flex; flex-direction: column; gap: 1rem; }
  .materials-section, .signature-section { background: #f8fafc; padding: 1rem; border-radius: 8px; border: 1px solid #e2e8f0; display: flex; flex-direction: column; gap: 0.8rem; }
  .section-desc { font-size: 0.82rem; color: #64748b; margin: -0.3rem 0 0.5rem 0; }

  .consuntivo-table-wrap { overflow-x: auto; max-height: 220px; }
  .modal-items-table { font-size: 0.85rem; }
  .modal-items-table th { padding: 0.5rem; }
  .modal-items-table td { padding: 0.4rem; }

  .table-input { width: 100%; padding: 0.35rem 0.5rem; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.85rem; }
  .qty-input { text-align: center; font-weight: 700; background: #fffbeb; border-color: #fde68a; }
  .unit-badge { background: #e2e8f0; color: #334155; padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: 600; }
  .font-bold { font-weight: 700; color: #0f172a; }

  .add-material-form { display: flex; gap: 0.5rem; flex-wrap: wrap; }

  .tot-preview { display: flex; justify-content: space-between; align-items: center; font-size: 0.95rem; padding: 1rem; background: #ecfdf5; border-radius: 8px; color: #065f46; border: 1px solid #a7f3d0; }
  .total-price-large { font-size: 1.35rem; font-weight: 800; color: #047857; }
  .contract-hours-preview { display: block; font-size: 0.8rem; color: #047857; }

  .modal-footer { display: flex; justify-content: flex-end; gap: 0.8rem; margin-top: 1rem; }

  .btn { padding: 0.6rem 1.2rem; border-radius: 8px; font-weight: 600; cursor: pointer; border: none; text-decoration: none; }
  .btn-primary { background: #3b82f6; color: white; }
  .btn-secondary { background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; }
  .btn-icon-danger { background: none; border: none; cursor: pointer; }

  .badge { display: inline-block; padding: 0.25rem 0.6rem; border-radius: 6px; font-size: 0.78rem; font-weight: 600; }
  .badge-primary { background: #dbeafe; color: #1e40af; }
  .badge-info { background: #e0f2fe; color: #0369a1; }
  .badge-blue { background: #eff6ff; color: #2563eb; }
  .badge-purple { background: #faf5ff; color: #7e22ce; }

  .print-header { display: none; }

  @media print {
    .no-print { display: none !important; }
    .print-header { display: block; margin-bottom: 1.5rem; text-align: center; }
    .intervention-detail-page { max-width: 100%; padding: 0; }
    .detail-card { border: 1px solid #000; box-shadow: none; }
  }
</style>
