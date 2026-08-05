import { db, collection, getDocs, query, where } from '$lib/firebase';

export class ProjectsTodoBridge {
  static async fetchTodoItems() {
    const items: any[] = [];
    try {
      const snap = await getDocs(query(collection(db, 'projects'), where('status', '==', 'aperto')));
      snap.forEach(d => {
        const data = d.data();
        items.push({
          id: `project-${d.id}`,
          title: `Progetto in corso: ${data.code || d.id} - ${data.name || ''}`,
          sourceModule: 'projects',
          status: 'aperto',
          priority: 'media',
          createdAt: data.createdAt || new Date().toISOString(),
          link: `/dashboard/projects/${d.id}`
        });
      });
    } catch (e) {
      console.error('Error fetching projects todo bridge items:', e);
    }
    return items;
  }
}
