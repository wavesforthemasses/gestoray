import { 
  db, 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  query, 
  where, 
  orderBy 
} from '$lib/firebase';
import { roundCurrency } from '$lib/utils/math';
import { cleanUndefined } from '$lib/utils/helpers';
import type { 
  JobCostingProject, 
  JobCostItem, 
  JobBudgetBreakdown, 
  JobActualsBreakdown, 
  JobRevenuesBreakdown, 
  JobProfitabilityMetrics, 
  JobCostingSettings 
} from './schema';
import { JobCostingSettingsService } from './jobCostingSettingsService';

const COLLECTION_NAME = 'job_costing_projects';

export class JobCostingService {
  /**
   * Motore Matematico Puro SSOT per il Calcolo della Redditività e dello Scostamento Budget
   */
  static calculateProfitability(
    budget: JobBudgetBreakdown,
    actuals: JobActualsBreakdown,
    revenues: JobRevenuesBreakdown,
    settings?: Partial<JobCostingSettings>
  ): JobProfitabilityMetrics {
    const totalCosts = roundCurrency(
      (actuals.labor || 0) + 
      (actuals.materials || 0) + 
      (actuals.equipment || 0) + 
      (actuals.subcontractor || 0) + 
      (actuals.other || 0)
    );

    const targetRevenue = revenues.contractValue > 0 
      ? revenues.contractValue 
      : (revenues.invoicedTotal > 0 ? revenues.invoicedTotal : 0);

    const grossMarginAmount = roundCurrency(targetRevenue - totalCosts);
    const grossMarginPercent = targetRevenue > 0 
      ? roundCurrency((grossMarginAmount / targetRevenue) * 100, 2) 
      : 0;

    const realizedMarginAmount = roundCurrency((revenues.paidTotal || 0) - totalCosts);

    const totalBudget = roundCurrency(budget.total || 0);
    const budgetVarianceAmount = roundCurrency(totalCosts - totalBudget);
    const budgetVariancePercent = totalBudget > 0 
      ? roundCurrency((budgetVarianceAmount / totalBudget) * 100, 2) 
      : 0;

    const isOverBudget = totalBudget > 0 && budgetVarianceAmount > 0;
    const isLossMaking = targetRevenue > 0 && grossMarginAmount < 0;

    const criticalThreshold = settings?.criticalMarginThresholdPercent ?? 10;
    const warningThreshold = settings?.warningMarginThresholdPercent ?? 20;

    let healthStatus: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (isLossMaking || isOverBudget || (targetRevenue > 0 && grossMarginPercent < criticalThreshold)) {
      healthStatus = 'critical';
    } else if (targetRevenue > 0 && grossMarginPercent < warningThreshold) {
      healthStatus = 'warning';
    }

    return {
      grossMarginAmount,
      grossMarginPercent,
      realizedMarginAmount,
      budgetVarianceAmount,
      budgetVariancePercent,
      isOverBudget,
      isLossMaking,
      healthStatus
    };
  }

  /**
   * Recupera tutte le commesse con filtri opzionali
   */
  static async getProjects(filters?: { placeId?: string; clientId?: string; status?: string }): Promise<JobCostingProject[]> {
    try {
      const colRef = collection(db, COLLECTION_NAME);
      let q = query(colRef, orderBy('createdAt', 'desc'));

      if (filters?.placeId) {
        q = query(colRef, where('placeId', '==', filters.placeId), orderBy('createdAt', 'desc'));
      } else if (filters?.clientId) {
        q = query(colRef, where('clientId', '==', filters.clientId), orderBy('createdAt', 'desc'));
      }

      const snap = await getDocs(q);
      let list = snap.docs.map(d => ({ id: d.id, ...d.data() } as JobCostingProject));

      if (filters?.status) {
        list = list.filter(p => p.status === filters.status);
      }

      return list;
    } catch (e) {
      console.warn('Errore lettura commesse job_costing:', e);
      return [];
    }
  }

  /**
   * Recupera una singola commessa per ID (O(1) NoSQL Read via Derived Snapshot)
   */
  static async getProjectById(id: string): Promise<JobCostingProject | null> {
    try {
      const snap = await getDoc(doc(db, COLLECTION_NAME, id));
      if (!snap.exists()) return null;
      return { id: snap.id, ...snap.data() } as JobCostingProject;
    } catch (e) {
      console.error(`Errore caricamento commessa ${id}:`, e);
      return null;
    }
  }

  /**
   * Creazione nuova commessa con calcolo del budget e codice univoco
   */
  static async createProject(data: Partial<JobCostingProject>): Promise<string> {
    const settings = await JobCostingSettingsService.getSettings();
    const code = data.code || await JobCostingSettingsService.generateNextCode();
    const id = doc(collection(db, COLLECTION_NAME)).id;
    const now = new Date().toISOString();

    const budget: JobBudgetBreakdown = {
      labor: Number(data.budget?.labor) || 0,
      materials: Number(data.budget?.materials) || 0,
      equipment: Number(data.budget?.equipment) || 0,
      subcontractor: Number(data.budget?.subcontractor) || 0,
      other: Number(data.budget?.other) || 0,
      total: roundCurrency(
        (Number(data.budget?.labor) || 0) +
        (Number(data.budget?.materials) || 0) +
        (Number(data.budget?.equipment) || 0) +
        (Number(data.budget?.subcontractor) || 0) +
        (Number(data.budget?.other) || 0)
      )
    };

    const actuals: JobActualsBreakdown = {
      labor: Number(data.actuals?.labor) || 0,
      materials: Number(data.actuals?.materials) || 0,
      equipment: Number(data.actuals?.equipment) || 0,
      subcontractor: Number(data.actuals?.subcontractor) || 0,
      other: Number(data.actuals?.other) || 0,
      total: 0,
      laborHoursTotal: 0,
      materialsCountTotal: 0
    };
    actuals.total = roundCurrency(actuals.labor + actuals.materials + actuals.equipment + actuals.subcontractor + actuals.other);

    const revenues: JobRevenuesBreakdown = {
      contractValue: Number(data.revenues?.contractValue) || 0,
      invoicedTotal: Number(data.revenues?.invoicedTotal) || 0,
      paidTotal: Number(data.revenues?.paidTotal) || 0
    };

    const profitability = this.calculateProfitability(budget, actuals, revenues, settings);

    const newProject: JobCostingProject = {
      id,
      tenantId: data.tenantId || 'default',
      code,
      title: data.title || 'Nuova Commessa',
      description: data.description || '',
      placeId: data.placeId || '',
      placeName: data.placeName || '',
      includeSubPlaces: data.includeSubPlaces ?? true,
      clientId: data.clientId || '',
      clientName: data.clientName || '',
      contractId: data.contractId || '',
      contractTitle: data.contractTitle || '',
      status: data.status || 'in_corso',
      startDate: data.startDate || now.split('T')[0],
      expectedEndDate: data.expectedEndDate || '',
      lastSyncedAt: now,
      budget,
      actuals,
      revenues,
      profitability,
      notes: data.notes || '',
      createdAt: now,
      updatedAt: now,
      edits: {
        createdAt: now,
        modifiedAt: now,
        aggregateVersion: 1
      }
    };

    await setDoc(doc(db, COLLECTION_NAME, id), cleanUndefined(newProject));
    return id;
  }

  /**
   * Aggiornamento dati commessa con guardia di immutabilità su commesse chiuse
   */
  static async updateProject(id: string, updates: Partial<JobCostingProject>): Promise<void> {
    const existing = await this.getProjectById(id);
    if (!existing) throw new Error('Commessa non trovata');

    if (existing.status === 'chiusa' && updates.status !== 'in_corso' && updates.status !== 'completata') {
      throw new Error('Impossibile modificare una commessa chiusa. Riaprirla prima di apportare modifiche.');
    }

    const settings = await JobCostingSettingsService.getSettings();
    const budget = updates.budget || existing.budget;
    budget.total = roundCurrency(
      (budget.labor || 0) + (budget.materials || 0) + (budget.equipment || 0) + (budget.subcontractor || 0) + (budget.other || 0)
    );

    const actuals = updates.actuals || existing.actuals;
    actuals.total = roundCurrency(
      (actuals.labor || 0) + (actuals.materials || 0) + (actuals.equipment || 0) + (actuals.subcontractor || 0) + (actuals.other || 0)
    );

    const revenues = updates.revenues || existing.revenues;
    const profitability = this.calculateProfitability(budget, actuals, revenues, settings);

    const now = new Date().toISOString();
    const currentVer = existing.edits?.aggregateVersion || 1;

    const payload = {
      ...updates,
      budget,
      actuals,
      revenues,
      profitability,
      updatedAt: now,
      'edits.modifiedAt': now,
      'edits.aggregateVersion': currentVer + 1
    };

    await updateDoc(doc(db, COLLECTION_NAME, id), cleanUndefined(payload));
  }

  /**
   * Riconciliazione Analitica On-Demand Multi-Sottosistema (Bolle, Magazzino FIFO, Mezzi, Contratti, Fatture)
   */
  static async syncProjectSources(projectId: string): Promise<JobCostingProject> {
    const project = await this.getProjectById(projectId);
    if (!project) throw new Error('Commessa non trovata');

    if (project.status === 'chiusa') {
      return project; // Freeze Snapshot immutabile
    }

    const settings = await JobCostingSettingsService.getSettings();
    const placeIds: string[] = [];
    if (project.placeId) {
      placeIds.push(project.placeId);
      if (project.includeSubPlaces) {
        try {
          const subPlacesSnap = await getDocs(query(collection(db, 'places'), where('parentId', '==', project.placeId)));
          subPlacesSnap.forEach(d => placeIds.push(d.id));
        } catch (e) {
          console.warn('Errore lettura sotto-luoghi:', e);
        }
      }
    }

    let actualLabor = 0;
    let actualLaborHours = 0;
    let actualMaterials = 0;
    let actualMaterialsCount = 0;
    let actualEquipment = 0;
    let invoicedTotal = 0;
    let paidTotal = 0;
    let contractValue = project.revenues.contractValue || 0;

    // 1. Manodopera da Interventi / Bolle
    if (placeIds.length > 0) {
      for (const pId of placeIds) {
        try {
          const intSnap = await getDocs(query(collection(db, 'interventions'), where('locationId', '==', pId)));
          intSnap.forEach(d => {
            const data = d.data();
            if (data.workLog && Array.isArray(data.workLog)) {
              for (const entry of data.workLog) {
                if (entry.entryType === 'labor') {
                  const qty = Number(entry.quantity) || 0;
                  const uCost = Number(entry.unitPrice) || settings.defaultHourlyLaborRate;
                  actualLabor += (qty * uCost);
                  actualLaborHours += qty;
                } else if (entry.entryType === 'material') {
                  actualMaterials += (Number(entry.totalAmount) || (Number(entry.quantity) * Number(entry.unitPrice)) || 0);
                  actualMaterialsCount += (Number(entry.quantity) || 1);
                } else if (entry.entryType === 'equipment') {
                  actualEquipment += (Number(entry.totalAmount) || 0);
                }
              }
            } else if (data.durationMinutes) {
              const hours = Number(data.durationMinutes) / 60;
              actualLabor += (hours * settings.defaultHourlyLaborRate);
              actualLaborHours += hours;
            }
          });
        } catch (e) {
          // Modulo interventi non presente o nessuna bolla
        }

        // Manodopera da Activities
        try {
          const actSnap = await getDocs(query(collection(db, 'activities'), where('placeId', '==', pId)));
          actSnap.forEach(d => {
            const data = d.data();
            if (data.durationMinutes && data.category === 'operational') {
              const hours = Number(data.durationMinutes) / 60;
              actualLabor += (hours * settings.defaultHourlyLaborRate);
              actualLaborHours += hours;
            }
          });
        } catch (e) {
          // Modulo activities non presente
        }

        // 2. Materiali da Magazzino FIFO (OUT_SITE_USAGE)
        try {
          const movSnap = await getDocs(query(
            collection(db, 'warehouse_movements'), 
            where('toPlaceId', '==', pId),
            where('movementType', '==', 'OUT_SITE_USAGE')
          ));
          movSnap.forEach(d => {
            const mov = d.data();
            actualMaterials += Number(mov.totalCost || (mov.quantity * mov.unitCost) || 0);
            actualMaterialsCount += Number(mov.quantity || 1);
          });
        } catch (e) {
          // Modulo warehouse non presente
        }
      }
    }

    // 3. Valore Contratto Associato
    if (project.contractId) {
      try {
        const cSnap = await getDoc(doc(db, 'contracts', project.contractId));
        if (cSnap.exists()) {
          const cData = cSnap.data();
          contractValue = Number(cData.totalAmount || cData.totalPrice || 0);
        }
      } catch (e) {
        console.warn('Errore lettura contratto:', e);
      }
    }

    // 4. Fatture Collegate
    if (project.clientId) {
      try {
        const invSnap = await getDocs(query(collection(db, 'invoices'), where('clientId', '==', project.clientId)));
        invSnap.forEach(d => {
          const inv = d.data();
          if (inv.status !== 'annullata' && inv.status !== 'scartata') {
            const matchesPlace = inv.placeId && placeIds.includes(inv.placeId);
            const matchesProject = inv.jobId === projectId;
            if (matchesPlace || matchesProject || (!inv.placeId && !inv.jobId)) {
              invoicedTotal += Number(inv.totalNet || 0);
              if (inv.paymentStatus === 'pagata_saldata') {
                paidTotal += Number(inv.totalNet || 0);
              } else if (inv.remainingAmount !== undefined) {
                paidTotal += Math.max(0, Number(inv.totalNet || 0) - Number(inv.remainingAmount || 0));
              }
            }
          }
        });
      } catch (e) {
        // Modulo invoices non presente
      }
    }

    // Mantieni spese manuali già inserite (subappalti / altro)
    const currentActuals = project.actuals || { subcontractor: 0, other: 0 };
    const finalActuals: JobActualsBreakdown = {
      labor: roundCurrency(actualLabor),
      materials: roundCurrency(actualMaterials),
      equipment: roundCurrency(actualEquipment),
      subcontractor: roundCurrency(currentActuals.subcontractor || 0),
      other: roundCurrency(currentActuals.other || 0),
      total: roundCurrency(actualLabor + actualMaterials + actualEquipment + (currentActuals.subcontractor || 0) + (currentActuals.other || 0)),
      laborHoursTotal: roundCurrency(actualLaborHours, 1),
      materialsCountTotal: actualMaterialsCount
    };

    const finalRevenues: JobRevenuesBreakdown = {
      contractValue: roundCurrency(contractValue),
      invoicedTotal: roundCurrency(invoicedTotal),
      paidTotal: roundCurrency(paidTotal)
    };

    const profitability = this.calculateProfitability(project.budget, finalActuals, finalRevenues, settings);
    const now = new Date().toISOString();

    const updatePayload = {
      actuals: finalActuals,
      revenues: finalRevenues,
      profitability,
      lastSyncedAt: now,
      updatedAt: now
    };

    await updateDoc(doc(db, COLLECTION_NAME, projectId), cleanUndefined(updatePayload));
    return { ...project, ...updatePayload };
  }

  /**
   * Sigillatura della commessa con Freeze Snapshot immutabile
   */
  static async closeProject(projectId: string): Promise<void> {
    const now = new Date().toISOString();
    await updateDoc(doc(db, COLLECTION_NAME, projectId), {
      status: 'chiusa',
      closedAt: now,
      updatedAt: now
    });
  }

  /**
   * Riapertura della commessa per modifiche autorizzate
   */
  static async reopenProject(projectId: string): Promise<void> {
    const now = new Date().toISOString();
    await updateDoc(doc(db, COLLECTION_NAME, projectId), {
      status: 'in_corso',
      closedAt: null,
      updatedAt: now
    });
  }

  /**
   * Inserimento spesa manuale (subappalto, nolo macchinario, extra)
   */
  static async addCostItem(projectId: string, item: Omit<JobCostItem, 'id' | 'jobId' | 'createdAt'>): Promise<string> {
    const project = await this.getProjectById(projectId);
    if (!project) throw new Error('Commessa non trovata');
    if (project.status === 'chiusa') throw new Error('Commessa chiusa: impossibile aggiungere costi');

    const subColRef = collection(db, `${COLLECTION_NAME}/${projectId}/cost_items`);
    const costId = doc(subColRef).id;
    const now = new Date().toISOString();

    const costItem: JobCostItem = {
      id: costId,
      jobId: projectId,
      tenantId: project.tenantId || 'default',
      createdAt: now,
      ...item,
      totalCost: roundCurrency(item.quantity * item.unitCost)
    };

    await setDoc(doc(subColRef, costId), cleanUndefined(costItem));

    // Aggiorna i totali della commessa
    const actuals = { ...project.actuals };
    if (costItem.category === 'labor') actuals.labor += costItem.totalCost;
    else if (costItem.category === 'materials') actuals.materials += costItem.totalCost;
    else if (costItem.category === 'equipment') actuals.equipment += costItem.totalCost;
    else if (costItem.category === 'subcontractor') actuals.subcontractor += costItem.totalCost;
    else actuals.other += costItem.totalCost;

    actuals.total = roundCurrency(actuals.labor + actuals.materials + actuals.equipment + actuals.subcontractor + actuals.other);

    const settings = await JobCostingSettingsService.getSettings();
    const profitability = this.calculateProfitability(project.budget, actuals, project.revenues, settings);

    await updateDoc(doc(db, COLLECTION_NAME, projectId), cleanUndefined({
      actuals,
      profitability,
      updatedAt: now
    }));

    return costId;
  }

  /**
   * Lettura analitica dei movimenti e voci di spesa della commessa
   */
  static async getCostItems(projectId: string): Promise<JobCostItem[]> {
    try {
      const snap = await getDocs(query(collection(db, `${COLLECTION_NAME}/${projectId}/cost_items`), orderBy('date', 'desc')));
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as JobCostItem));
    } catch (e) {
      console.warn('Errore lettura cost_items:', e);
      return [];
    }
  }
}
