<script lang="ts">
  import { functions, httpsCallable } from "$lib/firebase";
  import { ShieldCheck, Loader2 } from "lucide-svelte";

  let status = $state<"idle" | "loading" | "success" | "error">("idle");
  let message = $state("");

  async function handleInit() {
    status = "loading";
    message = "";
    try {
      const initFn = httpsCallable(functions, "initSuperAdmin");
      const result = await initFn();
      if (result.data && result.data.status === "success") {
        status = "success";
        message = result.data.message;
      } else {
        status = "error";
        message = result.data.message || "Errore sconosciuto durante l'inizializzazione.";
      }
    } catch (err: any) {
      console.error("Init Error:", err);
      status = "error";
      message = err.message || "Errore durante l'esecuzione dell'operazione.";
    }
  }
</script>

<svelte:head>
  <title>Setup Iniziale | Gestoray</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link
    rel="preconnect"
    href="https://fonts.gstatic.com"
    crossorigin="anonymous"
  />
  <link
    href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap"
    rel="stylesheet"
  />
</svelte:head>

<div class="setup-container">
  <div class="background-glows">
    <div class="glow glow-1"></div>
    <div class="glow glow-2"></div>
  </div>

  <div class="card">
    <div class="logo">
      <img src="/logo.png?gestoray" alt="Gestoray Logo" class="setup-logo" />
    </div>

    <div class="header">
      <h2>Setup Iniziale Database</h2>
      <p>
        Questa procedura inizializzerà l'account Superadmin reale per consentire
        l'accesso al CRM Gestoray.
      </p>
    </div>

    {#if status === "idle"}
      <div class="info-box">
        <p>L'account che verrà creato è:</p>
        <code class="email-code">wavesforthemasses@gmail.com</code>
      </div>

      <button onclick={handleInit} class="btn btn-primary">
        Inizializza Superadmin
      </button>
    {:else}
      <div class="result-box animate-fade-in">
        {#if status === "loading"}
          <div class="status-content">
            <span class="spinner icon-loading">
              <Loader2 size={36} />
            </span>
            <p>Seeding in corso nel database europeo...</p>
          </div>
        {:else}
          <div class="status-content">
            {#if status === "success"}
              <div class="icon-circle success">
                <ShieldCheck size={32} />
              </div>
              <h3>Completato!</h3>
              <p class="success-message">{message}</p>
              <a href="/login" class="btn btn-primary mt-20">Vai al Login</a>
            {:else}
              <div class="icon-circle error">❌</div>
              <h3>Errore</h3>
              <p class="error-message">{message}</p>
              <button onclick={() => status = "idle"} class="btn btn-secondary mt-20">Riprova</button>
            {/if}
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>

<style>
  .setup-container {
    position: relative;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    z-index: 1;
    background-color: var(--color-neutral-50);
    font-family: 'Outfit', sans-serif;
  }

  .background-glows {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    overflow: hidden;
    pointer-events: none;
    z-index: -1;
  }

  .glow {
    position: absolute;
    border-radius: 50%;
    filter: blur(100px);
    opacity: 0.12;
  }

  .glow-1 {
    top: -10%;
    left: -10%;
    width: 60vw;
    height: 60vw;
    background: radial-gradient(
      circle,
      hsla(var(--brand-h), var(--brand-s), var(--brand-l), 0.12) 0%,
      transparent 70%
    );
  }

  .glow-2 {
    bottom: -10%;
    right: -10%;
    width: 60vw;
    height: 60vw;
    background: radial-gradient(
      circle,
      hsla(calc(var(--brand-h) + 40), var(--brand-s), var(--brand-l), 0.08) 0%,
      transparent 70%
    );
  }

  .card {
    width: 100%;
    max-width: 440px;
    background: var(--color-white);
    border: 1px solid var(--color-neutral-200);
    border-radius: var(--radius-xl);
    padding: 40px;
    box-shadow: var(--shadow-xl);
    box-sizing: border-box;
  }

  .logo {
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 30px;
  }

  .setup-logo {
    height: 48px;
    width: auto;
    object-fit: contain;
    display: block;
  }

  .header {
    text-align: center;
    margin-bottom: 25px;
  }

  .header h2 {
    font-size: 20px;
    font-weight: 600;
    margin: 0 0 8px 0;
    color: var(--color-neutral-800);
  }

  .header p {
    font-size: 14px;
    color: var(--color-neutral-500);
    line-height: 1.5;
    margin: 0;
  }

  .info-box {
    background: var(--color-neutral-50);
    border: 1px solid var(--color-neutral-200);
    border-radius: var(--radius-md);
    padding: 16px;
    text-align: center;
    margin-bottom: 25px;
  }

  .info-box p {
    margin: 0 0 8px 0;
    font-size: 13px;
    color: var(--color-neutral-600);
  }

  .email-code {
    background: var(--color-white);
    border: 1px solid var(--color-neutral-300);
    padding: 4px 10px;
    font-size: 14px;
    font-weight: 600;
    border-radius: var(--radius-sm);
    color: var(--color-neutral-800);
  }

  .btn {
    width: 100%;
    padding: 14px;
    border: none;
    border-radius: var(--radius-md);
    font-family: inherit;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    text-decoration: none;
  }

  .btn-primary {
    background: linear-gradient(
      135deg,
      var(--color-primary-500),
      var(--color-primary-600)
    );
    color: var(--color-white);
    box-shadow: 0 4px 12px hsla(var(--brand-h), var(--brand-s), var(--brand-l), 0.2);
  }

  .btn-primary:hover {
    transform: translateY(-1px);
    box-shadow: 0 6px 16px hsla(var(--brand-h), var(--brand-s), var(--brand-l), 0.25);
  }

  .btn-secondary {
    background: var(--color-neutral-100);
    border: 1px solid var(--color-neutral-200);
    color: var(--color-neutral-600);
  }

  .btn-secondary:hover {
    background: var(--color-neutral-200);
    color: var(--color-neutral-800);
  }

  .mt-20 {
    margin-top: 20px;
  }

  .result-box {
    padding: 10px 0;
  }

  .status-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 12px;
  }

  .status-content p {
    font-size: 14px;
    color: var(--color-neutral-500);
    margin: 0;
  }

  .status-content h3 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: var(--color-neutral-800);
  }

  .icon-circle {
    width: 60px;
    height: 60px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
  }

  .icon-circle.success {
    background: var(--color-success-light);
    color: var(--color-success);
  }

  .icon-circle.error {
    background: var(--color-error-light);
  }

  .success-message {
    color: var(--color-success-text) !important;
    font-weight: 500;
  }

  .error-message {
    color: var(--color-error-text) !important;
  }

  .spinner {
    display: inline-block;
    animation: spin 1s linear infinite;
  }

  .icon-loading {
    color: var(--color-primary-500);
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .animate-fade-in {
    animation: fadeIn 0.3s ease;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(-5px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
</style>
