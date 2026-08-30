import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, doc, setDoc, connectFirestoreEmulator } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword, connectAuthEmulator } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "fake-api-key",
  authDomain: "gesto-ray.firebaseapp.com",
  projectId: "gesto-ray",
  storageBucket: "gesto-ray.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
connectAuthEmulator(auth, 'http://localhost:9099');
connectFirestoreEmulator(db, 'localhost', 8080);

async function seed() {
  console.log('Authenticating as test-super@app.local...');
  await signInWithEmailAndPassword(auth, 'test-super@app.local', 'password123');
  console.log('Authenticated! Seeding demo Place and Activity for Global Sentinel...');

  const todayStr = new Date().toISOString().split('T')[0];

  // 1. Create Place
  const placeRef = await addDoc(collection(db, 'places'), {
    code: 'PLC-2026-001',
    name: 'Cantiere Milano Duomo',
    address: 'Piazza del Duomo, 20122 Milano MI',
    latitude: 45.4642,
    longitude: 9.1900,
    radiusMeters: 100,
    status: 'attivo',
    isGeofenceEnabled: true,
    requiresGpsVerification: true,
    scheduledOpeningTime: '08:00',
    scheduledClosingTime: '18:00',
    tags: ['cantiere', 'centro'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  console.log('Created place:', placeRef.id);

  // 2. Create Activity scheduled for today assigned to all users (or test-super)
  const actRef = await addDoc(collection(db, 'activities'), {
    title: 'Ristrutturazione Facciata Nord Duomo',
    placeId: placeRef.id,
    placeName: 'Cantiere Milano Duomo',
    placeSummary: {
      id: placeRef.id,
      name: 'Cantiere Milano Duomo',
      latitude: 45.4642,
      longitude: 9.1900,
      radiusMeters: 100
    },
    scheduledDate: todayStr,
    scheduledStartTime: '08:30',
    scheduledEndTime: '17:30',
    status: 'in_corso',
    type: 'sopralluogo',
    assigneeFilterKeys: ['user:all', 'u:all'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  console.log('Created activity:', actRef.id);

  console.log('Seed completed successfully!');
  process.exit(0);
}

seed().catch(err => {
  console.error('Seed error:', err);
  process.exit(1);
});
