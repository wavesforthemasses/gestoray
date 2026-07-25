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
    const x = ('touches' in e ? e.touches[0].clientX : e.clientX) - rect.left;
    const y = ('touches' in e ? e.touches[0].clientY : e.clientY) - rect.top;
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function draw(e: MouseEvent | TouchEvent) {
    if (!isDrawing || !canvasElem) return;
    const ctx = canvasElem.getContext('2d');
    if (!ctx) return;
    const rect = canvasElem.getBoundingClientRect();
    const x = ('touches' in e ? e.touches[0].clientX : e.clientX) - rect.left;
    const y = ('touches' in e ? e.touches[0].clientY : e.clientY) - rect.top;
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  function stopDrawing() {
    isDrawing = false;
    if (canvasElem) {
      signatureData = canvasElem.toDataURL();
    }
  }

  function clearCanvas() {
    if (!canvasElem) return;
    const ctx = canvasElem.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, canvasElem.width, canvasElem.height);
    signatureData = '';
  }

  async function handleConfirm() {
    if (!interventionId || !signerName.trim() || !signatureData) {
      errorMsg = 'Compila il nome del firmatario e firma nell\'apposito riquadro.';
      return;
    }

    submitting = true;
    errorMsg = '';

    try {
      await InterventiService.updateIntervention(interventionId, {
        signatureName: signerName.trim(),
        signatureData,
        signedAt: new Date().toISOString(),
        status: 'completato'
      });

      successMsg = 'Rapportino firmato e confermato con successo! Grazie.';
    } catch (err: any) {
      errorMsg = err.message || 'Errore durante il salvataggio della firma.';
    } finally {
      submitting = false;
    }
  }
</script>

<div class="confirm-page animate-fade-in">
  <div class="card confirm-card">
    <h2 class="title">✍️ Firma Rapportino d'Intervento</h2>

    {#if loading}
      <p class="text-neutral-500">Caricamento rapportino in corso...</p>
    {:else if !intervention}
      <div class="alert error">⚠️ Intervento non trovato o link scaduto.</div>
    {:else if successMsg}
      <div class="alert success">✅ {successMsg}</div>
    {:else}
      {#if errorMsg}
        <div class="alert error">⚠️ {errorMsg}</div>
      {/if}

      <div class="info-box mb-16">
        <p><strong>Intervento N°:</strong> {intervention.interventionNumber}</p>
        <p><strong>Titolo:</strong> {intervention.title}</p>
        <p><strong>Cliente:</strong> {intervention.clientName}</p>
      </div>

      <div class="form-group mb-16">
        <label for="signer">Nome e Cognome Firmatario *</label>
        <input id="signer" type="text" bind:value={signerName} placeholder="es. Mario Rossi" class="form-control" />
      </div>

      <div class="form-group mb-16">
        <label for="signature-canvas">Firma Digitale Cliente *</label>
        <canvas 
          id="signature-canvas"
          bind:this={canvasElem}
          width="400"
          height="150"
          class="signature-canvas"
          onmousedown={startDrawing}
          onmousemove={draw}
          onmouseup={stopDrawing}
          ontouchstart={startDrawing}
          ontouchmove={draw}
          ontouchend={stopDrawing}
        ></canvas>
        <button type="button" onclick={clearCanvas} class="btn-clear">🧹 Pulisci Firma</button>
      </div>

      <button type="button" onclick={handleConfirm} disabled={submitting} class="btn-submit">
        {submitting ? 'Invio in corso...' : '✅ Conferma e Firma Rapportino'}
      </button>
    {/if}
  </div>
</div>

<style>
  .confirm-page { max-width: 500px; margin: 40px auto; padding: 0 16px; }
  .confirm-card { background: white; border: 1px solid var(--color-neutral-200); border-radius: var(--radius-lg); padding: 24px; box-shadow: var(--shadow-md); }
  .title { margin: 0 0 16px 0; font-size: 20px; font-weight: 800; color: var(--color-neutral-900); }
  .info-box { background: var(--color-neutral-50); padding: 12px; border-radius: var(--radius-md); font-size: 13px; }
  .mb-16 { margin-bottom: 16px; }

  .form-group { display: flex; flex-direction: column; gap: 6px; }
  .form-group label { font-size: 13px; font-weight: 600; color: var(--color-neutral-700); }
  .form-control { padding: 10px 14px; font-size: 14px; border: 1px solid var(--color-neutral-300); border-radius: var(--radius-md); outline: none; width: 100%; box-sizing: border-box; }

  .signature-canvas { border: 2px dashed var(--color-neutral-300); border-radius: var(--radius-md); background: #fafafa; cursor: crosshair; touch-action: none; }
  .btn-clear { align-self: flex-start; padding: 4px 8px; font-size: 12px; background: none; border: none; cursor: pointer; color: var(--color-neutral-500); }

  .btn-submit { width: 100%; padding: 12px; font-size: 15px; font-weight: 700; color: white; background: var(--color-primary-600); border: none; border-radius: var(--radius-md); cursor: pointer; }
  .alert { padding: 12px 16px; border-radius: var(--radius-md); font-weight: 600; margin-bottom: 16px; }
  .success { background: #dcfce7; color: #15803d; }
  .error { background: #fee2e2; color: #991b1b; }
</style>
