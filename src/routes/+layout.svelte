<script lang="ts">
  import '../app.css';
  import favicon from '$lib/assets/favicon.svg';
  import { onMount } from 'svelte';
  import { auth as clientAuth, db, onAuthStateChanged, doc, getDoc } from '$lib/firebase';
  import { auth, activeRole } from '$lib/auth';
  import { get } from 'svelte/store';

  let { children } = $props();

  onMount(() => {
    const unsubscribe = onAuthStateChanged(clientAuth, async (firebaseUser: any) => {
      if (firebaseUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            const roles = data.roles || [];
            auth.set({
              uid: firebaseUser.uid,
              email: firebaseUser.email || data.email || '',
              roles: roles,
              nome: data.nome || '',
              cognome: data.cognome || '',
              qualification: data.qualification || 'junior'
            });
            const currentActive = get(activeRole);
            if (!currentActive || !roles.includes(currentActive)) {
              activeRole.set(roles[0] || null);
            }
          } else {
            console.warn(`User document not found in Firestore for UID: ${firebaseUser.uid}`);
            auth.set({
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              roles: []
            });
            activeRole.set(null);
          }
        } catch (e) {
          console.error('Error fetching user profile:', e);
        }
      } else {
        auth.set(null);
        activeRole.set(null);
      }
    });

    return () => unsubscribe();
  });
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
</svelte:head>

{@render children()}
