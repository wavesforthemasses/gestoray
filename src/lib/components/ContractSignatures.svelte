<script lang="ts">
  import { Card, Button } from '$lib';
  import { Award, CheckCircle } from 'lucide-svelte';

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

  <div class="signature-pane-box" style="margin-top: 10px; width: 100%; display: flex; flex-direction: column; gap: 16px; align-items: center;">
    {#if contract.original?.signature}
      <div class="saved-signature-display" style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
        <span class="badge" style="background: var(--color-success-light); color: var(--color-success-text); padding: 6px 12px; font-weight: 700; border-radius: 6px; font-size: 12px; display: inline-flex; align-items: center; gap: 6px;">
          <CheckCircle size={14} /> Contratto Firmato dal Cliente
        </span>
        <div class="signature-img-wrapper" style="border: 1px solid var(--color-neutral-300); background: var(--color-neutral-50); border-radius: 8px; padding: 16px; margin-top: 8px; width: 320px; height: 160px; display: flex; align-items: center; justify-content: center;">
          <img src={contract.original.signature} alt="Firma Referente Cliente" style="max-width: 100%; max-height: 100%; object-fit: contain;" />
        </div>
        {#if (activeRole === 'superadmin' || activeRole === 'amministrazione')}
          <button onclick={handleClearSignatureDb} class="clear-sig-btn-db" style="background: transparent; border: 1px solid var(--color-error-border); color: var(--color-error-text); padding: 6px 14px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; margin-top: 8px; transition: background 0.2s;" onmouseover={(e) => e.currentTarget.style.background = 'var(--color-error-light)'} onmouseout={(e) => e.currentTarget.style.background = 'transparent'}>
            Cancella Firma
          </button>
        {/if}
      </div>
    {:else}
      <div class="signature-canvas-container" style="display: flex; flex-direction: column; align-items: center; gap: 12px; width: 100%;">
        <p style="font-size: 13px; color: var(--color-neutral-500); margin: 0; text-align: center;">Firma con il mouse o con il dito nello spazio sottostante:</p>
        <canvas
          bind:this={sigCanvas}
          width="400"
          height="180"
          style="border: 2px dashed var(--color-neutral-300); border-radius: 8px; background: var(--color-white); cursor: crosshair; touch-action: none; max-width: 100%;"
          onmousedown={startDrawing}
          onmousemove={draw}
          onmouseup={stopDrawing}
          onmouseleave={stopDrawing}
          ontouchstart={(e) => startDrawing(e.touches[0])}
          ontouchmove={(e) => draw(e.touches[0])}
          ontouchend={stopDrawing}
        ></canvas>
        <div style="display: flex; gap: 12px;">
          <button onclick={clearSignature} class="cancel-btn" style="padding: 6px 12px; font-size: 12px; border-radius: 6px; border: 1px solid var(--color-neutral-300); background: var(--color-white); cursor: pointer;">
            Pulisci
          </button>
          <Button onclick={saveSignature} disabled={false} style="padding: 6px 16px; font-size: 12px; height: 32px;">
            Salva Firma
          </Button>
        </div>
      </div>
    {/if}
  </div>
</Card>
