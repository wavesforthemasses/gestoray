import { collection, getDocs, query, where } from '$lib/firebase';

export async function getVehiclesKPIs() {
  try {
    const q = query(collection({} as any, 'vehicles'), where('status', '==', 'disponibile'));
    const snap = await getDocs(q);
    return { availableVehiclesCount: snap.size };
  } catch {
    return { availableVehiclesCount: 0 };
  }
}
