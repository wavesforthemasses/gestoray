import { 
  db, 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  serverTimestamp 
} from '$lib/firebase';
import type { 
  InterventionItem, 
  LocationItem, 
  InterventionConsuntivoItem 
} from './schema';
import { InterventionSettingsService } from '$lib/services/interventionSettings';

export class InterventiService {
  private static COLLECTION_NAME = 'interventions';

  static async getInterventions(): Promise<InterventionItem[]> {
    const q = query(collection(db, this.COLLECTION_NAME), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as InterventionItem));
  }

  static async getInterventionById(id: string): Promise<InterventionItem | null> {
    const d = await getDoc(doc(db, this.COLLECTION_NAME, id));
    if (!d.exists()) return null;
    return { id: d.id, ...d.data() } as InterventionItem;
  }

  static async checkVehicleOverbooking(
    vehicleIds: string[], 
    startIso: string, 
    endIso: string, 
    excludeInterventionId?: string
  ): Promise<{ overbooked: boolean; vehicleNames: string[] }> {
    if (!vehicleIds || vehicleIds.length === 0 || !startIso || !endIso) {
      return { overbooked: false, vehicleNames: [] };
    }

    const allInterventions = await this.getInterventions();
    const newStart = new Date(startIso).getTime();
    const newEnd = new Date(endIso).getTime();

    const conflicts: string[] = [];

    for (const item of allInterventions) {
      if (excludeInterventionId && item.id === excludeInterventionId) continue;
      if (!item.scheduledStartAt || !item.scheduledEndAt) continue;
      if (item.status === 'completato' || item.status === 'fatturato') continue;

      const itemStart = new Date(item.scheduledStartAt).getTime();
      const itemEnd = new Date(item.scheduledEndAt).getTime();

      if (newStart < itemEnd && newEnd > itemStart) {
        const sharedVehicles = (item.vehicleIds || []).filter(vId => vehicleIds.includes(vId));
        for (const vId of sharedVehicles) {
          if (!conflicts.includes(vId)) {
            conflicts.push(vId);
          }
        }
      }
    }

    return {
      overbooked: conflicts.length > 0,
      vehicleNames: conflicts
    };
  }

  static async createIntervention(data: Partial<InterventionItem>, userUid?: string): Promise<string> {
    const settings = await InterventionSettingsService.getSettings();
    const unitPrice = data.unitPriceSnapshot ?? data.hourlyRateSnapshot ?? settings.defaultHourlyRate;
    const estQty = data.estimatedQuantity ?? data.estimatedHours ?? 1;

    let totalEstimated = 0;
    if (data.mode === 'a_bolla') {
      totalEstimated = estQty * unitPrice;
    }

    const payload: Partial<InterventionItem> = {
      title: data.title || `${data.type || 'Intervento'} - ${data.clientName || 'Cliente'}`,
      description: data.description || '',
      clientId: data.clientId || '',
      clientName: data.clientName || '',
      locationId: data.locationId || '',
      locationName: data.locationName || '',
      contractId: data.contractId || '',
      contractTitle: data.contractTitle || '',
      ticketId: data.ticketId || '',
      ticketSubject: data.ticketSubject || '',
      teamId: data.teamId || '',
      teamName: data.teamName || '',
      assignedOperatorUids: data.assignedOperatorUids || [],
      vehicleIds: data.vehicleIds || [],
      type: data.type || 'Manutenzione',
      pricingUnit: data.pricingUnit || 'ora',
      unitPriceSnapshot: unitPrice,
      hourlyRateSnapshot: unitPrice,
      mode: data.mode || 'a_bolla',
      status: data.status || 'pianificato',
      scheduledStartAt: data.scheduledStartAt || new Date().toISOString(),
      scheduledEndAt: data.scheduledEndAt || new Date(Date.now() + 7200000).toISOString(),
      estimatedQuantity: estQty,
      estimatedHours: estQty,
      actualQuantityWorked: data.actualQuantityWorked || 0,
      actualHoursWorked: data.actualHoursWorked || 0,
      totalAmount: totalEstimated,
      items: data.items || [],
      relatedEntities: data.relatedEntities || [],
      createdBy: userUid || 'system',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    const docRef = await addDoc(collection(db, this.COLLECTION_NAME), payload);
    return docRef.id;
  }

  static async consuntivaIntervention(
    id: string, 
    actualHoursWorked: number, 
    items: InterventionConsuntivoItem[], 
    signedByName?: string, 
    clientSignature?: string
  ): Promise<void> {
    const current = await this.getInterventionById(id);
    if (!current) throw new Error('Intervento non trovato');

    const rate = current.unitPriceSnapshot || current.hourlyRateSnapshot || 45;
    
    // Process items ensuring total is set for each
    const processedItems = (items || []).map(item => ({
      ...item,
      total: (item.quantity || 0) * (item.unitPrice || 0)
    }));

    let itemsTotal = processedItems.reduce((acc, curr) => acc + curr.total, 0);

    let finalTotal = 0;
    if (current.mode === 'a_bolla') {
      finalTotal = processedItems.length > 0 ? itemsTotal : (actualHoursWorked * rate);
    }

    // Compute actual hours for contract deduction (only items measured in 'ora')
    const hourlyItemsSum = processedItems
      .filter(i => !i.pricingUnit || i.pricingUnit === 'ora')
      .reduce((acc, curr) => acc + (curr.quantity || 0), 0);
    const contractDeductionHours = hourlyItemsSum > 0 ? hourlyItemsSum : actualHoursWorked;

    const updatePayload: any = {
      actualQuantityWorked: contractDeductionHours,
      actualHoursWorked: contractDeductionHours,
      items: processedItems,
      totalAmount: finalTotal,
      status: 'completato',
      executedStartAt: current.executedStartAt || new Date().toISOString(),
      executedEndAt: new Date().toISOString(),
      updatedAt: serverTimestamp()
    };

    if (signedByName) updatePayload.signedByName = signedByName;
    if (clientSignature) {
      updatePayload.clientSignature = clientSignature;
      updatePayload.signedAt = new Date().toISOString();
    }

    await updateDoc(doc(db, this.COLLECTION_NAME, id), updatePayload);

    if (current.mode === 'ad_erogazione' && current.contractId) {
      try {
        const contractRef = doc(db, 'contracts', current.contractId);
        const contractSnap = await getDoc(contractRef);
        if (contractSnap.exists()) {
          const cData = contractSnap.data();
          const currentHours = cData.hoursUsed || 0;
          await updateDoc(contractRef, {
            hoursUsed: currentHours + contractDeductionHours,
            updatedAt: serverTimestamp()
          });
        }
      } catch (err) {
        console.warn('Impossibile aggiornare consuntivo ore contratto:', err);
      }
    }
  }

  static async updateIntervention(id: string, data: Partial<InterventionItem>): Promise<void> {
    const sanitized: Record<string, any> = {};
    Object.entries(data).forEach(([key, val]) => {
      if (val !== undefined) {
        sanitized[key] = val;
      }
    });
    sanitized.updatedAt = serverTimestamp();
    await updateDoc(doc(db, this.COLLECTION_NAME, id), sanitized);
  }

  static async deleteIntervention(id: string): Promise<void> {
    await deleteDoc(doc(db, this.COLLECTION_NAME, id));
  }

  // --- LOCATIONS PER CLIENTE ---
  static async getLocationsForClient(clientId: string): Promise<LocationItem[]> {
    if (!clientId) return [];
    try {
      const q = query(collection(db, 'clients', clientId, 'locations'));
      const snap = await getDocs(q);
      return snap.docs.map((d: any) => ({ id: d.id, clientId, ...d.data() } as LocationItem));
    } catch (e) {
      console.warn('Errore recupero luoghi cliente:', e);
      return [];
    }
  }

  static async createLocationForClient(clientId: string, loc: Partial<LocationItem>): Promise<string> {
    const docRef = await addDoc(collection(db, 'clients', clientId, 'locations'), {
      name: loc.name || 'Sede Principale',
      address: loc.address || '',
      city: loc.city || '',
      type: loc.type || 'cantiere',
      notes: loc.notes || '',
      createdAt: serverTimestamp()
    });
    return docRef.id;
  }

  /**
   * Helper: evaluateOverbookingOverlap
   * Synchronously checks if any of the target vehicles are already assigned to another intervention during overlapping time range.
   */
  static evaluateOverbookingOverlap(
    targetVehicleIds: string[],
    startIso: string,
    endIso: string,
    existingInterventions: Array<{ vehicles?: string[]; scheduledStartAt?: string; scheduledEndAt?: string; id?: string }>,
    ignoreInterventionId?: string
  ): { hasOverbooking: boolean; conflictingVehicleId: string | null; conflictingInterventionId: string | null } {
    if (!targetVehicleIds || targetVehicleIds.length === 0 || !startIso || !endIso) {
      return { hasOverbooking: false, conflictingVehicleId: null, conflictingInterventionId: null };
    }

    const startTs = new Date(startIso).getTime();
    const endTs = new Date(endIso).getTime();

    for (const item of existingInterventions) {
      if (ignoreInterventionId && item.id === ignoreInterventionId) continue;
      if (!item.vehicles || item.vehicles.length === 0 || !item.scheduledStartAt || !item.scheduledEndAt) continue;

      const itemStart = new Date(item.scheduledStartAt).getTime();
      const itemEnd = new Date(item.scheduledEndAt).getTime();

      // Check temporal overlap: (itemStart < endTs) AND (itemEnd > startTs)
      if (itemStart < endTs && itemEnd > startTs) {
        for (const vId of targetVehicleIds) {
          if (item.vehicles.includes(vId)) {
            return {
              hasOverbooking: true,
              conflictingVehicleId: vId,
              conflictingInterventionId: item.id || null
            };
          }
        }
      }
    }

    return { hasOverbooking: false, conflictingVehicleId: null, conflictingInterventionId: null };
  }
}
