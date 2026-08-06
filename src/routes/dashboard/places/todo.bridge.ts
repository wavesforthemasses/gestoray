import { db, collection, getDocs, query, where } from '$lib/firebase';

export class PlacesTodoBridge {
  static async fetchTodoItems() {
    const items: any[] = [];
    try {
      const snap = await getDocs(query(collection(db, 'places'), where('status', '==', 'attivo')));
      snap.forEach(d => {
        const data = d.data();
        items.push({
          id: `place-${d.id}`,
          title: `Cantiere/Luogo attivo: ${data.code || d.id} - ${data.name || ''}`,
          sourceModule: 'places',
          status: 'aperto',
          priority: 'media',
          createdAt: data.createdAt || new Date().toISOString(),
          link: `/dashboard/places/${d.id}`
        });
      });
    } catch (e) {
      console.error('Error fetching places todo bridge items:', e);
    }
    return items;
  }
}
