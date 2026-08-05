import { db, collection, getDocs, query, where } from '$lib/firebase';

export async function fetchTodoItems() {
  const items: any[] = [];
  try {
    const snap = await getDocs(query(collection(db, 'cantieri'), where('status', '==', 'aperto')));
    snap.forEach((d: any) => {
      const data = d.data();
      items.push({
        id: `cantiere-${d.id}`,
        sourceModule: 'cantieri',
        title: `Cantiere Aperto: ${data.name || data.code}`,
        subtitle: `Cliente: ${data.clientName || 'N/D'} - Avanzamento: ${data.progress || 0}%`,
        date: data.endDate || data.startDate || data.createdAt,
        status: 'in_corso',
        link: `/dashboard/cantieri/${d.id}`,
        badgeTheme: 'info'
      });
    });
  } catch (e) {
    console.error('Error fetching cantieri todo bridge items:', e);
  }
  return items;
}
