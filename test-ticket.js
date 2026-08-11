const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, limit, query } = require('firebase/firestore');

const firebaseConfig = { projectId: "gestoray-test" }; // wait, how do I connect to emulator?
// Better to just run a svelte page or check a file.
