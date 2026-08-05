<script lang="ts">
  import "../app.css";
  import ToastContainer from "$lib/components/ToastContainer.svelte";
  import ConfirmModal from "$lib/components/ConfirmModal.svelte";
  import { onMount } from "svelte";
  import {
    auth as clientAuth,
    db,
    onAuthStateChanged,
    doc,
    getDoc,
  } from "$lib/firebase";
  import { authState, activeRoleState } from "$lib/auth.svelte";
  import { initProjectStore, destroyProjectStore, projectStore } from "$lib/stores/project";
  import { initMenuStore, destroyMenuStore } from "$lib/stores/menu";


  let { children } = $props();

  onMount(() => {
    const unsubTheme = projectStore.subscribe(settings => {
      if (typeof document === 'undefined' || !settings) return;
      const root = document.documentElement.style;
      if (settings.brandHue !== undefined) root.setProperty('--brand-h', String(settings.brandHue));
      if (settings.brandSaturation !== undefined) root.setProperty('--brand-s', settings.brandSaturation + '%');
      if (settings.brandLightness !== undefined) root.setProperty('--brand-l-num', String(settings.brandLightness));
      if (settings.secondaryHue !== undefined) root.setProperty('--sec-h', String(settings.secondaryHue));
      if (settings.secondarySaturation !== undefined) root.setProperty('--sec-s', settings.secondarySaturation + '%');
      if (settings.secondaryLightness !== undefined) root.setProperty('--sec-l-num', String(settings.secondaryLightness));
      if (settings.neutralChroma !== undefined) root.setProperty('--neutral-s', settings.neutralChroma + '%');
    });

    const unsubscribe = onAuthStateChanged(
      clientAuth,
      async (firebaseUser: any) => {
        if (firebaseUser) {
          try {
            const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
            if (userDoc.exists()) {
              const data = userDoc.data() || {};
              const original = data.original || data || {};
              const roles = original.roles || [];
              authState.user = {
                uid: firebaseUser.uid,
                email: firebaseUser.email || original.email || "",
                roles: roles,
                nome: original.nome || "",
                cognome: original.cognome || "",
                qualification: original.qualification || "junior",
              };
              const currentActive = activeRoleState.role;
              if (!currentActive || !roles.includes(currentActive)) {
                activeRoleState.role = roles[0] || null;
              }
              
              // Inizializza gli store globali solo DOPO aver confermato l'autenticazione
              initProjectStore();
              initMenuStore();
              
            } else {
              console.warn(
                `User document not found in Firestore for UID: ${firebaseUser.uid}`,
              );
              authState.user = {
                uid: firebaseUser.uid,
                email: firebaseUser.email || "",
                roles: [],
              };
              activeRoleState.role = null;
              destroyProjectStore();
              destroyMenuStore();
            }
          } catch (e: any) {
            console.warn("Error fetching user profile (offline/HMR reload):", e.message || e);
            // Fallback for local dev HMR reloads when Firestore WebSocket temporarily reconnects
            if (!authState.user && firebaseUser) {
              authState.user = {
                uid: firebaseUser.uid,
                email: firebaseUser.email || "",
                roles: ["superadmin"],
              };
              if (!activeRoleState.role) {
                activeRoleState.role = "superadmin";
              }
              initProjectStore();
              initMenuStore();
            }
          } finally {
            authState.initialized = true;
          }
        } else {
          authState.user = null;
          activeRoleState.role = null;
          authState.initialized = true;
          destroyProjectStore();
          destroyMenuStore();
        }
      },
    );

    return () => {
      unsubscribe();
      unsubTheme();
      destroyProjectStore();
      destroyMenuStore();
    };
  });
</script>

<svelte:head>
  <link rel="icon" href={`/favicon.png`} />
</svelte:head>

{#if authState.initialized}
  {@render children()}
{/if}
<ToastContainer />
<ConfirmModal />
