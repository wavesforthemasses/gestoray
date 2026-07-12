import { db, doc, setDoc, collection, getDocs, deleteDoc } from '$lib/firebase';
import { generateId } from '$lib/utils/helpers';

export interface ProductData {
  id?: string;
  name: string;
  listPrice: number;
  minPrice: number;
}

export class ProductsService {
  static async fetchProducts() {
    const querySnapshot = await getDocs(collection(db, 'products'));
    const list: Array<ProductData & { id: string }> = [];
    querySnapshot.forEach((doc: any) => {
      const data = doc.data();
      const orig = data.original || data;
      list.push({
        id: doc.id,
        name: orig.name,
        listPrice: orig.listPrice,
        minPrice: orig.minPrice
      });
    });
    return list;
  }

  static async saveProduct(product: ProductData) {
    if (!product.name || product.listPrice === null || product.minPrice === null) {
      throw new Error('Compila tutti i campi richiesti.');
    }

    if (product.minPrice > product.listPrice) {
      throw new Error('La soglia minima di vendita non può essere superiore al prezzo di listino.');
    }

    const isEditing = !!product.id;
    const id = product.id || generateId('prod');
    const now = new Date().toISOString();
    
    const newProd = {
      original: {
        name: product.name.trim(),
        listPrice: product.listPrice,
        minPrice: product.minPrice
      },
      edits: {
        ...(isEditing ? {} : { createdAt: now }),
        updatedAt: now
      }
    };

    await setDoc(doc(db, 'products', id), newProd, { merge: true });
    return isEditing;
  }

  static async deleteProduct(id: string) {
    await deleteDoc(doc(db, 'products', id));
  }
}
