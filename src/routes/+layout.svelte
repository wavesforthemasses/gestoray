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
  import { initProjectStore, destroyProjectStore } from "$lib/stores/project";
  import { initActivitiesStore, destroyActivitiesStore } from "$lib/stores/activities";
  import { initMenuStore, destroyMenuStore } from "$lib/stores/menu";


  let { children } = $props();

  onMount(() => {
    initProjectStore();
    initActivitiesStore();
    initMenuStore();
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
            }
          } catch (e) {
            console.error("Error fetching user profile:", e);
          }
        } else {
          authState.user = null;
          activeRoleState.role = null;
        }
      },
    );

    return () => {
      unsubscribe();
      destroyProjectStore();
      destroyActivitiesStore();
      destroyMenuStore();
    };
  });
</script>

<svelte:head>
  <link rel="icon" href={`/favicon.png`} />
</svelte:head>

{@render children()}
<ToastContainer />
<ConfirmModal />
