<script lang="ts">
  import { Card, Button } from '$lib';
  import { Award, CheckCircle } from '@lucide/svelte';

  interface Props {
    contract: any;
    activeRole: string | null;
    sigCanvas: HTMLCanvasElement | null;
    startDrawing: (e: any) => void;
    draw: (e: any) => void;
    stopDrawing: () => void;
    clearSignature: () => void;
    saveSignature: () => void;
    handleClearSignatureDb: () => void;
  }

  let {
    contract,
    activeRole,
    sigCanvas = $bindable(),
    startDrawing,
    draw,
    stopDrawing,
    clearSignature,
    saveSignature,
    handleClearSignatureDb
  }: Props = $props();
</script>

<Card title="Firma Olografa del Cliente" description="Firma digitale olografa del referente per l'accettazione e convalida dei termini contrattuali.">
  {#snippet icon()}
    <Award size={20} class="icon-accent" />
  {/snippet}

  <div class="signature-pane-box layout-column-center">
    {#if contract.original?.signature}
      <div class="saved-signature-display layout-column-center-gap8">
        <span class="badge success-badge">
          <CheckCircle size={14} /> Contratto Firmato dal Cliente
        </span>
        <div class="signature-img-wrapper sig-wrapper-styles">
          <img src={contract.original.signature} alt="Firma Referente Cliente" class="sig-img" />
        </div>
        {#if (activeRole === 'superadmin' || activeRole === 'amministrazione')}
          <button onclick={handleClearSignatureDb} class="clear-sig-btn-db outline-danger-btn">
            Cancella Firma
          </button>
        {/if}
      </div>
    {:else}
      <div class="signature-canvas-container layout-column-center-gap12">
        <p class="sig-instruction">Firma con il mouse o con il dito nello spazio sottostante:</p>
        <canvas
          bind:this={sigCanvas}
          width="400"
          height="180"
          class="sig-canvas"
          onmousedown={startDrawing}
          onmousemove={draw}
          onmouseup={stopDrawing}
          onmouseleave={stopDrawing}
          ontouchstart={(e) => startDrawing(e.touches[0])}
          ontouchmove={(e) => draw(e.touches[0])}
          ontouchend={stopDrawing}
        ></canvas>
        <div class="flex-gap-12">
          <button onclick={clearSignature} class="cancel-btn outline-btn">
            Pulisci
          </button>
          <Button onclick={saveSignature} disabled={false} class="save-sig-btn">
            Salva Firma
          </Button>
        </div>
      </div>
    {/if}
  </div>
</Card>

<style>
  :global(.icon-accent) {
    color: var(--color-primary-500);
  }

  .layout-column-center {
    margin-top: 10px;
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 16px;
    align-items: center;
  }

  .layout-column-center-gap8 {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }

  .layout-column-center-gap12 {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    width: 100%;
  }

  .success-badge {
    background: var(--color-success-light);
    color: var(--color-success-text);
    padding: 6px 12px;
    font-weight: 700;
    border-radius: 6px;
    font-size: 12px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .sig-wrapper-styles {
    border: 1px solid var(--color-neutral-300);
    background: var(--color-neutral-50);
    border-radius: 8px;
    padding: 16px;
    margin-top: 8px;
    width: 320px;
    height: 160px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .sig-img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
  }

  .outline-danger-btn {
    background: transparent;
    border: 1px solid var(--color-error-border);
    color: var(--color-error-text);
    padding: 6px 14px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    margin-top: 8px;
    transition: background 0.2s;
  }

  .outline-danger-btn:hover {
    background: var(--color-error-light);
  }

  .sig-instruction {
    font-size: 13px;
    color: var(--color-neutral-500);
    margin: 0;
    text-align: center;
  }

  .sig-canvas {
    border: 2px dashed var(--color-neutral-300);
    border-radius: 8px;
    background: var(--color-white);
    cursor: crosshair;
    touch-action: none;
    max-width: 100%;
  }

  .flex-gap-12 {
    display: flex;
    gap: 12px;
  }

  .outline-btn {
    padding: 6px 12px;
    font-size: 12px;
    border-radius: 6px;
    border: 1px solid var(--color-neutral-300);
    background: var(--color-white);
    cursor: pointer;
  }

  :global(.save-sig-btn) {
    padding: 6px 16px !important;
    font-size: 12px !important;
    height: 32px !important;
  }
</style>
