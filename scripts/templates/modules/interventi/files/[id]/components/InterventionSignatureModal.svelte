<script lang="ts">
  interface Props {
    signerName: string;
    signatureData: string;
    showModal: boolean;
    onClose: () => void;
    onSave: (name: string, sig: string) => void;
  }

  let {
    signerName = $bindable(''),
    signatureData = $bindable(''),
    showModal = false,
    onClose,
    onSave
  }: Props = $props();

  let canvasElem: HTMLCanvasElement | null = $state(null);
  let isDrawing = $state(false);

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

  function handleConfirm() {
    onSave(signerName, signatureData);
  }
</script>

{#if showModal}
  <div class="modal-backdrop">
    <div class="modal-card">
      <div class="modal-header">
        <h3>✍️ Firma Digitale Cliente</h3>
        <button onclick={onClose} class="btn-close">✖</button>
      </div>

      <div class="modal-body">
        <div class="form-group">
          <label for="signer-name">Nome & Cognome Firmatario *</label>
          <input id="signer-name" type="text" placeholder="es. Mario Rossi (Referente Sede)" bind:value={signerName} class="form-control" />
        </div>

        <div class="form-group mt-12">
          <div class="label-with-clear">
            <label for="signature-canvas">Firma a Schermo *</label>
            <button type="button" onclick={clearSignature} class="btn-clear">🧹 Pulisci Canvas</button>
          </div>
          <div class="canvas-wrapper">
            <canvas 
              bind:this={canvasElem}
              width="500" 
              height="180" 
              onmousedown={startDrawing}
              onmousemove={draw}
              onmouseup={stopDrawing}
              ontouchstart={startDrawing}
              ontouchmove={draw}
              ontouchend={stopDrawing}
              class="signature-canvas"
            ></canvas>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button onclick={onClose} class="btn btn-secondary">Annulla</button>
        <button onclick={handleConfirm} class="btn btn-primary" disabled={!signerName || !signatureData}>
          Conferma Firma
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(15, 23, 42, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 999;
    padding: 20px;
  }
  .modal-card {
    background: var(--color-white);
    border-radius: var(--radius-xl);
    width: 100%;
    max-width: 560px;
    box-shadow: var(--shadow-xl);
    overflow: hidden;
  }
  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 24px;
    border-bottom: 1px solid var(--color-neutral-200);
  }
  .modal-header h3 { margin: 0; font-size: 18px; color: var(--color-neutral-800); }
  .btn-close { background: transparent; border: none; font-size: 16px; cursor: pointer; color: var(--color-neutral-400); }
  .modal-body { padding: 24px; }
  .form-group { display: flex; flex-direction: column; gap: 6px; }
  .form-group label { font-size: 13px; font-weight: 600; color: var(--color-neutral-700); }
  .mt-12 { margin-top: 12px; }
  .label-with-clear { display: flex; justify-content: space-between; align-items: center; }
  .btn-clear { background: transparent; border: none; color: var(--color-error); font-size: 12px; font-weight: 600; cursor: pointer; }
  .form-control { padding: 10px 12px; font-size: 14px; border: 1px solid var(--color-neutral-300); border-radius: var(--radius-md); width: 100%; box-sizing: border-box; }
  .canvas-wrapper { border: 2px dashed var(--color-neutral-300); border-radius: var(--radius-md); background: #fafafa; margin-top: 6px; touch-action: none; }
  .signature-canvas { width: 100%; height: 180px; display: block; cursor: crosshair; }
  .modal-footer { display: flex; justify-content: flex-end; gap: 12px; padding: 16px 24px; border-top: 1px solid var(--color-neutral-200); background: var(--color-neutral-50); }
  .btn { padding: 10px 20px; font-size: 14px; font-weight: 600; border-radius: var(--radius-md); cursor: pointer; border: none; }
  .btn-primary { background: var(--color-primary-500); color: var(--color-white); }
  .btn-secondary { background: var(--color-white); border: 1px solid var(--color-neutral-300); color: var(--color-neutral-700); }
</style>
