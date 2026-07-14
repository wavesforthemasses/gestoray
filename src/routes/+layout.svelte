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
  import { auth, activeRole } from "$lib/auth";
  import { initProjectStore, destroyProjectStore } from "$lib/stores/project";
  import { initActivitiesStore, destroyActivitiesStore } from "$lib/stores/activities";
  import { initMenuStore, destroyMenuStore } from "$lib/stores/menu";
  import { get } from "svelte/store";

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
              auth.set({
                uid: firebaseUser.uid,
                email: firebaseUser.email || original.email || "",
                roles: roles,
                nome: original.nome || "",
                cognome: original.cognome || "",
                qualification: original.qualification || "junior",
              });
              const currentActive = get(activeRole);
              if (!currentActive || !roles.includes(currentActive)) {
                activeRole.set(roles[0] || null);
              }
            } else {
              console.warn(
                `User document not found in Firestore for UID: ${firebaseUser.uid}`,
              );
              auth.set({
                uid: firebaseUser.uid,
                email: firebaseUser.email || "",
                roles: [],
              });
              activeRole.set(null);
            }
          } catch (e) {
            console.error("Error fetching user profile:", e);
          }
        } else {
          auth.set(null);
          activeRole.set(null);
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
