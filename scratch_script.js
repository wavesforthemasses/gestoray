import { initializeApp } from "firebase/app";
import { getFirestore, getDoc, doc, updateDoc, collectionGroup, getDocs } from "firebase/firestore";

const firebaseConfig = {
  projectId: "gesto-ray",
  // Note: we can use REST API or admin SDK if we have it, but here we can just use the config if emulator is on or if we use firebase-admin.
};

// Actually, we can just use firebase-admin since this is a local project.
