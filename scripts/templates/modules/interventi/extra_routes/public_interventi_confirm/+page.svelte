<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { InterventiService } from '../../../dashboard/interventi/interventi.service';
  import type { InterventionItem } from '../../../dashboard/interventi/schema';

  let interventionId = $derived(page.url.searchParams.get('id') || '');
  let intervention = $state<InterventionItem | null>(null);
  let loading = $state(true);
  let submitting = $state(false);
  let successMsg = $state('');
  let errorMsg = $state('');

  let signerName = $state('');
  let signatureData = $state('');
  let canvasElem: HTMLCanvasElement | null = $state(null);
  let isDrawing = $state(false);

  onMount(async () => {
    if (interventionId) {
      try {
        intervention = await InterventiService.getInterventionById(interventionId);
      } catch (e) {
        console.error('Errore caricamento intervento pubblico:', e);
      }
    }
    loading = false;
  });

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

  async function handleConfirmSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (!interventionId || !signerName.trim() || !signatureData) {
      errorMsg = 'Nome firmatario e Firma sullo schermo sono obbligatori.';
      return;
    }

    submitting = true;
    errorMsg = '';
    try {
      await InterventiService.updateIntervention(interventionId, {
        signedByName: signerName.trim(),
        clientSignature: signatureData,
        signedAt: new Date().toISOString(),
        status: 'approvato'
      });
      successMsg = 'Rapportino di intervento confermato e firmato con successo! Grazie per la conferma.';
    } catch (err: any) {
      errorMsg = 'Errore durante la firma del rapportino: ' + err.message;
    } finally {
      submitting = false;
    }
  }
</script>

<svelte:head>
  <title>Conferma & Firma Rapportino | Gestoray</title>
</svelte:head>

<div class="confirm-page">
  <div class="confirm-card">
    <header class="confirm-header">
      <h2>✍️ Conferma & Firma Rapportino di Intervento</h2>
      <p>Visualizza il riepilogo del lavoro svolto e firma sullo schermo per confermare la ricezione.</p>
    </header>

    {#if successMsg}
      <div class="alert-success">
        <span class="success-icon">✅</span>
        <p>{successMsg}</p>
      </div>
    {:else if loading}
      <div class="loading-state">Caricamento rapportino...</div>
    {:else if !intervention}
      <div class="alert-danger">
        <p>Intervento non trovato o link non valido. Verificare l'URL fornito dal tecnico.</p>
      </div>
    {:else}
      <div class="summary-box">
        <h3>{intervention.title}</h3>
        <p><strong>Cliente:</strong> {intervention.clientName || 'Cliente'}</p>
        <p><strong>Luogo Intervento:</strong> 📍 {intervention.locationName || 'Sede Cliente'}</p>
        <p><strong>Ore Lavorate Effettive:</strong> ⏱️ {intervention.actualHoursWorked || intervention.estimatedHours || 0} ore</p>
        
        {#if intervention.items && intervention.items.length > 0}
          <div class="items-summary">
            <strong>Materiali Utilizzati:</strong>
            <ul>
              {#each intervention.items as item}
                <li>{item.description} (x{item.quantity})</li>
              {/each}
            </ul>
          </div>
        {/if}

        {#if intervention.mode === 'a_bolla'}
          <p class="tot-price"><strong>Totale Consuntivo:</strong> € {(intervention.totalAmount || 0).toFixed(2)}</p>
        {/if}
      </div>

      {#if errorMsg}
        <div class="alert-danger">{errorMsg}</div>
      {/if}

      <form onsubmit={handleConfirmSubmit} class="signature-form">
        <div class="form-group">
          <label for="signer">Nome e Cognome del Cliente Firmatario *</label>
          <input type="text" id="signer" bind:value={signerName} placeholder="es. Mario Rossi" required />
        </div>

        <div class="form-group">
          <span class="canvas-label">Firma Digitalizzata sullo Schermo *</span>
          <div class="canvas-wrapper">
            <canvas 
              bind:this={canvasElem} 
              width="350" 
              height="160"
              onmousedown={startDrawing}
              onmousemove={draw}
              onmouseup={stopDrawing}
              ontouchstart={startDrawing}
              ontouchmove={draw}
              ontouchend={stopDrawing}
            ></canvas>
            <button type="button" class="btn-clear" onclick={clearSignature}>Cancella Firma</button>
          </div>
        </div>

        <button type="submit" class="btn btn-primary" disabled={submitting}>
          {submitting ? 'Invio Firma in corso...' : 'Conferma e Invia Firma Digitale'}
        </button>
      </form>
    {/if}
  </div>
</div>

<style>
  .confirm-page {
    min-height: 100vh;
    background: #f8fafc;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1.5rem;
  }

  .confirm-card {
    background: white;
    border-radius: 12px;
    border: 1px solid #e2e8f0;
    max-width: 500px;
    width: 100%;
    padding: 2rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05);
  }

  .confirm-header h2 { margin: 0; font-size: 1.3rem; color: #0f172a; }
  .confirm-header p { margin: 0.3rem 0 0 0; font-size: 0.85rem; color: #64748b; }

  .summary-box { background: #f1f5f9; padding: 1rem; border-radius: 8px; font-size: 0.9rem; display: flex; flex-direction: column; gap: 0.4rem; }
  .summary-box h3 { margin: 0 0 0.4rem 0; font-size: 1.05rem; color: #0f172a; }
  .summary-box p { margin: 0; }

  .items-summary ul { margin: 0.2rem 0 0 1.2rem; padding: 0; }
  .tot-price { color: #16a34a; font-weight: 700; font-size: 1rem; margin-top: 0.4rem; }

  .signature-form { display: flex; flex-direction: column; gap: 1.2rem; }
  .form-group { display: flex; flex-direction: column; gap: 0.4rem; }
  .form-group label { font-size: 0.88rem; font-weight: 600; color: #334155; }

  input { padding: 0.6rem 0.8rem; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.9rem; }

  .canvas-wrapper { display: flex; flex-direction: column; align-items: center; gap: 0.4rem; }
  canvas { border: 1px solid #cbd5e1; background: white; border-radius: 8px; cursor: crosshair; }
  .btn-clear { background: none; border: none; color: #ef4444; font-size: 0.8rem; cursor: pointer; text-decoration: underline; }

  .btn { padding: 0.8rem 1.4rem; border-radius: 8px; font-weight: 700; border: none; cursor: pointer; font-size: 0.95rem; }
  .btn-primary { background: #3b82f6; color: white; }

  .alert-success { background: #dcfce7; color: #166534; padding: 1.2rem; border-radius: 8px; text-align: center; }
  .success-icon { font-size: 2.5rem; display: block; margin-bottom: 0.5rem; }
  .alert-danger { background: #fef2f2; color: #991b1b; padding: 0.8rem; border-radius: 8px; font-weight: 600; }
  .loading-state { text-align: center; color: #64748b; }
</style>
