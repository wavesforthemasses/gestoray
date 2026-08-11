import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

const app = initializeApp({ projectId: "gestoray-test" }); // wait, gestures uses emulator?
