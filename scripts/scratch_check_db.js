import admin from 'firebase-admin';

process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';

admin.initializeApp({ projectId: 'gestoray' });
const db = admin.firestore();

async function check() {
  const acts = await db.collection('activities').get();
  console.log('=== ACTIVITIES (' + acts.docs.length + ') ===');
  acts.docs.forEach(d => {
    const data = d.data();
    console.log(JSON.stringify({
      id: d.id,
      title: data.title || data.name,
      scheduledDate: data.scheduledDate,
      placeId: data.placeId,
      placeName: data.placeName || data.placeSummary?.name,
      assignedUid: data.assignedUid,
      assigneeFilterKeys: data.assigneeFilterKeys
    }));
  });

  const places = await db.collection('places').get();
  console.log('=== PLACES (' + places.docs.length + ') ===');
  places.docs.forEach(d => {
    const data = d.data();
    console.log(JSON.stringify({
      id: d.id,
      name: data.name,
      geo: data.geo
    }));
  });

  const users = await db.collection('users').get();
  console.log('=== USERS (' + users.docs.length + ') ===');
  users.docs.forEach(d => {
    const data = d.data();
    console.log(JSON.stringify({
      id: d.id,
      email: data.email,
      displayName: data.displayName
    }));
  });

  process.exit(0);
}
check();
