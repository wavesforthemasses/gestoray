<script lang="ts">
  import { auth, activeRole } from '$lib/auth';
  import { auth as clientAuth } from '$lib/firebase';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { Card } from '$lib';
  import { Zap, Shield, Briefcase, TrendingUp } from '@lucide/svelte';

  onMount(() => {
    const unsubscribe = auth.subscribe(($auth) => {
      if (!$auth) {
        setTimeout(() => {
          if (!clientAuth.currentUser) {
            goto('/login');
          }
        }, 800);
      }
    });

    return () => unsubscribe();
  });
</script>

<svelte:head>
  <title>Dashboard | Gestoray</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous">
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
</svelte:head>

{#if $auth}
  <div class="panoramica-container">
    <Card
      title="Benvenuto nel tuo pannello di controllo"
      description="Qui puoi visualizzare le informazioni specifiche abilitate per i tuoi ruoli aziendali."
      variant="glass"
      class="welcome-banner animate-fade-in"
      style="--card-padding: 30px 40px;"
    />

    <section class="homepages-grid">
      {#if $activeRole === 'superadmin'}
        <Card
          title="Homepage Superadmin"
          description="Sei loggato come super amministratore. Hai privilegi di accesso massimi e puoi gestire gli account degli utenti, modificare i loro ruoli ed email."
          variant="accent"
          class="superadmin-homepage animate-fade-in"
          style="--card-border-color: var(--color-primary-700);"
        >
          {#snippet icon()}
            <Zap size={22} class="icon-accent" />
          {/snippet}

          <div class="metric-row">
            <div class="metric-card">
              <span class="metric-val">Illimitato</span>
              <span class="metric-lbl">Privilegi</span>
            </div>
            <div class="metric-card">
              <span class="metric-val">Attivo</span>
              <span class="metric-lbl">Pannello di Controllo</span>
            </div>
          </div>
        </Card>
      {/if}

      {#if $activeRole === 'amministrazione'}
        <Card
          title="Homepage Amministrazione"
          description="Sei loggato come amministratore. Hai accesso completo alla configurazione del sistema e alla gestione dei ruoli degli utenti dal menu laterale."
          variant="accent"
          class="admin-homepage animate-fade-in"
          style="--card-border-color: var(--color-primary-500);"
        >
          {#snippet icon()}
            <Shield size={22} class="icon-accent" />
          {/snippet}

          <div class="metric-row">
            <div class="metric-card">
              <span class="metric-val">Attivo</span>
              <span class="metric-lbl">Pannello Admin</span>
            </div>
            <div class="metric-card">
              <span class="metric-val">Simulato</span>
              <span class="metric-lbl">Database Locale</span>
            </div>
          </div>
        </Card>
      {/if}

      {#if $activeRole === 'commerciale'}
        <Card
          title="Homepage Commerciale"
          description="Sei loggato come commerciale. Hai accesso alla dashboard vendite, alle trattative e alla gestione clienti."
          variant="accent"
          class="commercial-homepage animate-fade-in"
          style="--card-border-color: var(--color-primary-400);"
        >
          {#snippet icon()}
            <Briefcase size={22} class="icon-accent" />
          {/snippet}

          <div class="metric-row">
            <div class="metric-card">
              <span class="metric-val">€ 0.00</span>
              <span class="metric-lbl">Fatturato Mese</span>
            </div>
            <div class="metric-card">
              <span class="metric-val">0</span>
              <span class="metric-lbl">Nuovi Leads</span>
            </div>
          </div>
        </Card>
      {/if}

      {#if $activeRole === 'direzione'}
        <Card
          title="Homepage Direzione"
          description="Sei loggato come direzione. Hai accesso ai report strategici, KPI e andamento aziendale complessivo."
          variant="accent"
          class="direction-homepage animate-fade-in"
          style="--card-border-color: var(--color-primary-600);"
        >
          {#snippet icon()}
            <TrendingUp size={22} class="icon-accent" />
          {/snippet}

          <div class="metric-row">
            <div class="metric-card">
              <span class="metric-val">100%</span>
              <span class="metric-lbl">Performance</span>
            </div>
            <div class="metric-card">
              <span class="metric-val">Stabile</span>
              <span class="metric-lbl">Trend Operativo</span>
            </div>
          </div>
        </Card>
      {/if}
    </section>
  </div>
{/if}

<style>
  .panoramica-container {
    display: flex;
    flex-direction: column;
    gap: 30px;
  }

  :global(.welcome-banner) {
    background: linear-gradient(135deg, var(--color-primary-50), var(--color-neutral-100)) !important;
  }

  .homepages-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
    gap: 24px;
  }

  :global(.role-homepage) {
    min-height: 240px;
  }

  .icon-accent {
    color: var(--color-primary-500);
  }

  .metric-row {
    display: flex;
    gap: 12px;
    margin-top: auto;
  }

  .metric-card {
    flex: 1;
    background: var(--color-neutral-100);
    border: 1px solid var(--color-neutral-200);
    padding: 14px;
    border-radius: var(--radius-md);
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .metric-val {
    font-size: 16px;
    font-weight: 700;
    color: var(--color-neutral-800);
  }

  .metric-lbl {
    font-size: 11px;
    color: var(--color-neutral-500);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  :global(.superadmin-homepage) {
    border-left: 4px solid var(--color-primary-700) !important;
  }
  :global(.admin-homepage) {
    border-left: 4px solid var(--color-primary-500) !important;
  }
  :global(.commercial-homepage) {
    border-left: 4px solid var(--color-primary-400) !important;
  }
  :global(.direction-homepage) {
    border-left: 4px solid var(--color-primary-600) !important;
  }

  .animate-fade-in {
    animation: fadeIn 0.3s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  }
</style>
