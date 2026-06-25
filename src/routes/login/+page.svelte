<script lang="ts">
  import { enhance } from "$app/forms";
  import { auth as clientAuth, signInWithCustomToken } from "$lib/firebase";
  import { goto } from "$app/navigation";
  import { FormField } from "$lib";

  let { form } = $props<{ form: any }>();

  let email = $state("");
  let pin = $state("");
  let currentStep = $state(1);
  let errorMessage = $state("");
  let loading = $state(false);
  let localPinNotification = $state("");

  $effect(() => {
    if (form) {
      if (form.error) {
        errorMessage = form.error;
        loading = false;
      } else if (form.success && form.debugPin) {
        currentStep = 2;
        email = form.email;
        localPinNotification = form.debugPin;
        errorMessage = "";
        loading = false;
      } else if (form.success && form.customToken) {
        loading = true;
        signInWithCustomToken(clientAuth, form.customToken)
          .then(() => {
            goto("/dashboard");
          })
          .catch((err) => {
            console.error("Auth error:", err);
            errorMessage = "Errore di autenticazione client: " + err.message;
            loading = false;
          });
      }
    }
  });

  function handleSubmit() {
    loading = true;
    errorMessage = "";
  }
</script>

<svelte:head>
  <title>Login | Gestoray</title>
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

<div class="login-container">
  <div class="background-glows">
    <div class="glow glow-1"></div>
    <div class="glow glow-2"></div>
  </div>

  <div class="card">
    <div class="logo">
      <img src="/logo.png?gestoray" alt="Gestoray Logo" class="login-logo" />
    </div>

    {#if errorMessage}
      <div class="alert error animate-fade-in">
        <span>{errorMessage}</span>
      </div>
    {/if}

    {#if localPinNotification}
      <div class="alert info animate-bounce">
        <div class="info-content">
          <p><strong>PIN Ricevuto (Simulazione Locale):</strong></p>
          <code class="pin-code">{localPinNotification}</code>
          <p class="sub-text">
            Copia questo codice o leggilo dal terminale del server.
          </p>
        </div>
      </div>
    {/if}

    {#if currentStep === 1}
      <form method="POST" action="?/sendPin" use:enhance={handleSubmit}>
        <div class="header">
          <h2>Benvenuto</h2>
          <p>
            Inserisci il tuo indirizzo email registrato per ricevere il codice
            PIN di accesso.
          </p>
        </div>

        <FormField id="email" label="Indirizzo Email" class="input-group">
          <input
            type="email"
            id="email"
            name="email"
            bind:value={email}
            placeholder="nome@esempio.com"
            required
            disabled={loading}
          />
        </FormField>

        <button type="submit" class="btn" disabled={loading}>
          {#if loading}
            <span class="spinner"></span>
            Invio in corso...
          {:else}
            Invia codice PIN
          {/if}
        </button>
      </form>
    {:else}
      <form method="POST" action="?/verifyPin" use:enhance={handleSubmit}>
        <input type="hidden" name="email" value={email} />

        <div class="header">
          <h2>Verifica PIN</h2>
          <p>
            Inserisci il codice PIN di 6 cifre inviato all'indirizzo <strong
              >{email}</strong
            >.
          </p>
        </div>

        <FormField id="pin" label="Codice PIN" class="input-group">
          <input
            type="text"
            id="pin"
            name="pin"
            bind:value={pin}
            placeholder="123456"
            maxlength="6"
            pattern={"[0-9]{6}"}
            required
            disabled={loading}
            autocomplete="one-time-code"
            class="pin-input"
          />
        </FormField>

        <button type="submit" class="btn btn-primary" disabled={loading}>
          {#if loading}
            <span class="spinner"></span>
            Verifica in corso...
          {:else}
            Accedi
          {/if}
        </button>

        <button
          type="button"
          class="btn btn-secondary"
          disabled={loading}
          onclick={() => {
            currentStep = 1;
            localPinNotification = "";
            errorMessage = "";
          }}
        >
          Indietro
        </button>
      </form>
    {/if}
  </div>
</div>

<style>
  .login-container {
    position: relative;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    z-index: 1;
    background-color: var(--color-neutral-50);
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
      hsla(var(--brand-h), var(--brand-s), 50%, 0.12) 0%,
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
      hsla(calc(var(--brand-h) + 40), var(--brand-s), 50%, 0.08) 0%,
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

  .login-logo {
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

  :global(.input-group) {
    margin-bottom: 20px;
  }

  .pin-input {
    letter-spacing: 0.5em;
    text-align: center;
    font-size: 20px;
    font-weight: 600;
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
    margin-bottom: 10px;
  }

  .btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .btn:not(.btn-secondary):not(.btn-primary) {
    background: linear-gradient(
      135deg,
      var(--color-primary-500),
      var(--color-primary-600)
    );
    color: var(--color-white);
    box-shadow: 0 4px 12px hsla(var(--brand-h), var(--brand-s), 50%, 0.2);
  }

  .btn:not(.btn-secondary):not(.btn-primary):hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 6px 16px hsla(var(--brand-h), var(--brand-s), 50%, 0.25);
  }

  .btn-primary {
    background: linear-gradient(
      135deg,
      var(--color-success),
      var(--color-success-text)
    );
    color: var(--color-white);
    box-shadow: 0 4px 12px hsla(142, 76%, 36%, 0.2);
  }

  .btn-primary:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 6px 16px hsla(142, 76%, 36%, 0.25);
  }

  .btn-secondary {
    background: var(--color-neutral-100);
    border: 1px solid var(--color-neutral-200);
    color: var(--color-neutral-600);
  }

  .btn-secondary:hover:not(:disabled) {
    background: var(--color-neutral-200);
    color: var(--color-neutral-800);
  }

  .alert {
    padding: 14px 16px;
    border-radius: var(--radius-md);
    font-size: 14px;
    margin-bottom: 20px;
    line-height: 1.4;
  }

  .alert.error {
    background: var(--color-error-light);
    border: 1px solid var(--color-error-border);
    color: var(--color-error-text);
  }

  .alert.info {
    background: var(--color-primary-50);
    border: 1px solid var(--color-primary-200);
    color: var(--color-primary-800);
    text-align: center;
  }

  .info-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }

  .info-content p {
    margin: 0;
  }

  .pin-code {
    background: var(--color-white);
    border: 1px dashed var(--color-primary-400);
    padding: 6px 16px;
    font-size: 20px;
    font-weight: 700;
    border-radius: var(--radius-sm);
    letter-spacing: 0.1em;
    color: var(--color-primary-700);
  }

  .sub-text {
    font-size: 12px;
    color: var(--color-neutral-500);
  }

  .animate-fade-in {
    animation: fadeIn 0.3s ease;
  }

  .animate-bounce {
    animation: bounceIn 0.4s ease;
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

  @keyframes bounceIn {
    0% {
      transform: scale(0.95);
      opacity: 0;
    }
    50% {
      transform: scale(1.02);
    }
    100% {
      transform: scale(1);
      opacity: 1;
    }
  }

  .spinner {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-radius: 50%;
    border-top-color: white;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
