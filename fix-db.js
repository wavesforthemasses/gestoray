import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";
import fs from "fs";

// Load firebase config from src/lib/firebase.ts or just configure it
const configRaw = fs.readFileSync('src/lib/firebase.ts', 'utf8');
const configMatch = configRaw.match(/const firebaseConfig = ({[\s\S]*?});/);
if (!configMatch) {
  console.error("Could not find firebase config");
  process.exit(1);
}
const firebaseConfig = eval(`(${configMatch[1]})`);

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const mapping = {
  'telefonata': 'Telefonata',
  'incontro': 'Incontro',
  'appuntamento': 'Appuntamento',
  'sollecito_tel': 'Sollecito Telefonico',
  'sollecito_email': 'Sollecito Email',
  'sollecito_pec': 'Sollecito PEC'
};

async function run() {
  const settingsDocRef = doc(db, 'settings', 'activities');
  const snap = await getDoc(settingsDocRef);
  if (snap.exists()) {
    const data = snap.data();
    if (data.list && Array.isArray(data.list)) {
      const newList = data.list.map(kpi => {
        if (mapping[kpi.id]) {
          console.log(`Mapping ${kpi.id} -> ${mapping[kpi.id]}`);
          kpi.id = mapping[kpi.id];
        }
        return kpi;
      });
      await setDoc(settingsDocRef, { list: newList }, { merge: true });
      console.log("Successfully updated settings/activities!");
    } else {
      console.log("No list found in settings/activities");
    }
  } else {
    console.log("settings/activities document does not exist");
  }
  process.exit(0);
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
