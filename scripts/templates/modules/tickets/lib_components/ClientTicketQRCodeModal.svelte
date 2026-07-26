<script lang="ts">
  import { Smartphone, Printer, Copy, Check, X } from '@lucide/svelte';

  let {
    isOpen = $bindable(false),
    clientId = '',
    clientName = ''
  }: {
    isOpen: boolean;
    clientId: string;
    clientName: string;
  } = $props();

  let dedicatedLink = $derived(
    typeof window !== 'undefined'
      ? `${window.location.origin}/public/tickets?clientId=${clientId}`
      : `/public/tickets?clientId=${clientId}`
  );

  let copied = $state(false);

  function handleCopy() {
    if (typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(dedicatedLink);
      copied = true;
      setTimeout(() => { copied = false; }, 2500);
    }
  }

  function handlePrint() {
    if (typeof window !== 'undefined') {
      window.print();
    }
  }
</script>

{#if isOpen}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="modal-backdrop" onclick={() => (isOpen = false)}>
    <div class="modal-card" onclick={(e) => e.stopPropagation()}>
      <header class="modal-header">
        <h3 style="display: flex; align-items: center; gap: 8px;"><Smartphone size={18} /> QR Code & Link Assistenza Dedicato</h3>
        <button class="close-btn" onclick={() => (isOpen = false)}><X size={18} /></button>
      </header>

      <div class="modal-body">
        <div class="client-info">
          <span>Cliente:</span>
          <strong>{clientName}</strong>
        </div>

        <!-- Generazione QR Code via SVG API sicura -->
        <div class="qr-box">
          <img
            src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data={encodeURIComponent(dedicatedLink)}"
            alt="QR Code Assistenza Cliente"
            class="qr-image"
          />
          <p class="qr-sub">Inquadra per aprire la Form Assistenza già abbinata a <strong>{clientName}</strong></p>
        </div>

        <div class="link-box">
          <label for="ded-link" class="link-label">Link Dedicato Diretto</label>
          <div class="input-group">
            <input id="ded-link" type="text" readonly value={dedicatedLink} class="link-input" />
            <button onclick={handleCopy} class="btn-copy" style="display: inline-flex; align-items: center; gap: 4px;">
              {#if copied}
                <Check size={14} /> Copiato!
              {:else}
                <Copy size={14} /> Copia Link
              {/if}
            </button>
          </div>
        </div>
      </div>

      <footer class="modal-footer">
        <button onclick={handlePrint} class="btn btn-secondary" style="display: inline-flex; align-items: center; gap: 6px;"><Printer size={16} /> Stampa QR Code</button>
        <button onclick={() => (isOpen = false)} class="btn btn-primary">Chiudi</button>
      </footer>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.6);
    backdrop-filter: blur(4px);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 9999;
    padding: 1rem;
  }

  .modal-card {
    background: #ffffff;
    border-radius: 16px;
    width: 100%;
    max-width: 480px;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2);
    display: flex;
    flex-direction: column;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.2rem 1.5rem;
    border-bottom: 1px solid #e2e8f0;
  }

  .modal-header h3 {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 700;
    color: #0f172a;
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 1.2rem;
    cursor: pointer;
    color: #64748b;
  }

  .modal-body {
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.2rem;
    align-items: center;
    text-align: center;
  }

  .client-info {
    background: #f8fafc;
    padding: 0.6rem 1rem;
    border-radius: 8px;
    font-size: 0.95rem;
    width: 100%;
    display: flex;
    gap: 0.5rem;
    justify-content: center;
  }

  .qr-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.6rem;
  }

  .qr-image {
    width: 180px;
    height: 180px;
    border: 4px solid #f1f5f9;
    border-radius: 12px;
  }

  .qr-sub {
    font-size: 0.82rem;
    color: #64748b;
    margin: 0;
    max-width: 320px;
  }

  .link-box {
    width: 100%;
    text-align: left;
  }

  .link-label {
    font-size: 0.78rem;
    font-weight: 700;
    color: #64748b;
    text-transform: uppercase;
    margin-bottom: 0.3rem;
    display: block;
  }

  .input-group {
    display: flex;
    gap: 0.5rem;
  }

  .link-input {
    flex: 1;
    padding: 0.5rem 0.7rem;
    border-radius: 6px;
    border: 1px solid #cbd5e1;
    font-size: 0.82rem;
    background: #f8fafc;
  }

  .btn-copy {
    background: #3b82f6;
    color: #fff;
    border: none;
    padding: 0.5rem 0.8rem;
    border-radius: 6px;
    font-size: 0.82rem;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.8rem;
    padding: 1rem 1.5rem;
    border-top: 1px solid #e2e8f0;
  }

  .btn {
    padding: 0.55rem 1.1rem;
    border-radius: 8px;
    font-weight: 600;
    font-size: 0.88rem;
    cursor: pointer;
  }

  .btn-primary { background: #3b82f6; color: #fff; border: none; }
  .btn-secondary { background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; }
</style>
