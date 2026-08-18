import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import modulesRegistry from './config/modules.registry.json';

export const scheduledReconciliation = onSchedule(
  {
    schedule: '0 3 * * *',
    timeZone: 'Europe/Rome',
    region: 'europe-west3'
  },
  async () => {
    // Scheduled reconciliation placeholder
  }
);

// Built-in Core Aggregation Specs for Core entities that don't belong to optional modules
const CORE_AGGREGATION_SPECS: Record<string, any> = {
  nuove_anagrafiche: {
    collection: 'clients',
    type: 'count',
    dateFields: ['edits.createdAt', 'createdAt', 'original.createdAt'],
    createdByFilterField: 'original.createdBy'
  },
  nncf: {
    collection: 'clients',
    type: 'count',
    dateFields: ['derived.nncfDate'],
    createdByFilterField: 'original.createdBy'
  }
};

export const getChartAggregations = onCall({ region: 'europe-west3', cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Devi essere loggato.');
  }

  const { entity, periods, filters } = request.data;
  
  if (!entity || !periods || !Array.isArray(periods)) {
    throw new HttpsError('invalid-argument', 'Parametri mancanti.');
  }

  const registryList = Array.isArray(modulesRegistry) ? modulesRegistry : (modulesRegistry as any)?.modules || [];
  const activeModulesMap = new Map(registryList.map((m: any) => [m.id, m]));

  // Build dynamic map of all available KPI aggregation specs from active modules & core
  const aggregationSpecsMap: Record<string, any> = { ...CORE_AGGREGATION_SPECS };

  for (const moduleObj of registryList) {
    if (moduleObj.enabled !== false && Array.isArray(moduleObj.kpiTiles)) {
      for (const tile of moduleObj.kpiTiles) {
        if (tile.id && tile.aggregation) {
          aggregationSpecsMap[tile.id] = {
            ...tile.aggregation,
            moduleId: moduleObj.id
          };
        }
      }
    }
  }

  const spec = aggregationSpecsMap[entity];
  const db = admin.firestore();
  const results: number[] = [];

  // Helper to extract timestamp in ms from various formats
  const getMs = (raw: any): number => {
    if (!raw) return 0;
    if (typeof raw === 'number') return raw;
    if (typeof raw === 'string') {
      const d = new Date(raw);
      return isNaN(d.getTime()) ? 0 : d.getTime();
    }
    if (raw.toDate && typeof raw.toDate === 'function') return raw.toDate().getTime();
    if (raw._seconds !== undefined) return raw._seconds * 1000;
    if (raw instanceof Date) return raw.getTime();
    const d = new Date(raw);
    return isNaN(d.getTime()) ? 0 : d.getTime();
  };

  // Helper to extract nested property safely (e.g. 'original.vendorUid')
  const getNestedValue = (obj: any, path: string): any => {
    if (!obj || !path) return undefined;
    return path.split('.').reduce((acc, part) => (acc && acc[part] !== undefined ? acc[part] : undefined), obj);
  };

  try {
    // If no spec exists for requested entity or its module is disabled, return zeros
    if (!spec || (spec.moduleId && !activeModulesMap.has(spec.moduleId))) {
      const zeros = periods.map(() => 0);
      return { data: zeros, results: zeros };
    }

    // Fetch snapshot dynamically based on collection or collectionGroup
    let snap: admin.firestore.QuerySnapshot;
    if (spec.collectionGroup) {
      snap = await db.collectionGroup(spec.collectionGroup).get();
    } else if (spec.collection) {
      snap = await db.collection(spec.collection).get();
    } else {
      const zeros = periods.map(() => 0);
      return { data: zeros, results: zeros };
    }

    const minStartMs = Math.min(...periods.map((p: any) => new Date(p.start).getTime()).filter(t => !isNaN(t)));
    const maxEndMs = Math.max(...periods.map((p: any) => new Date(p.end).getTime()).filter(t => !isNaN(t)));

    // Fast-pass: filter out soft-deleted and out-of-range documents immediately
    const relevantDocs: Array<{ data: any; dateMs: number }> = [];

    for (const d of snap.docs) {
      const data = d.data();
      if (data.derived?.deleted || data.deleted) continue;

      let dateMs = 0;
      if (Array.isArray(spec.dateFields)) {
        for (const fieldPath of spec.dateFields) {
          const raw = getNestedValue(data, fieldPath);
          if (raw) {
            dateMs = getMs(raw);
            if (dateMs > 0) break;
          }
        }
      }

      if (dateMs >= minStartMs && dateMs <= maxEndMs) {
        relevantDocs.push({ data, dateMs });
      }
    }

    for (const period of periods) {
      const startMs = new Date(period.start).getTime();
      const endMs = new Date(period.end).getTime();
      let periodTotal = 0;

      for (const { data, dateMs } of relevantDocs) {
        if (dateMs < startMs || dateMs > endMs) continue;

        // 2. Apply filters dynamically
        if (spec.vendorFields && filters?.vendorUid) {
          const match = spec.vendorFields.some((f: string) => {
            const val = getNestedValue(data, f);
            return val === filters.vendorUid || data.agentId === filters.vendorUid;
          });
          if (!match) continue;
        }

        if (spec.createdByFilterField && filters?.createdBy) {
          const val = getNestedValue(data, spec.createdByFilterField);
          if (val && val !== filters.createdBy) continue;
        }

        if (spec.typeFilterField && filters?.type && filters.type !== 'all') {
          const val = getNestedValue(data, spec.typeFilterField);
          if (val && val !== filters.type) continue;
        }

        if (spec.loggedByFilterField && filters?.loggedBy) {
          const val = getNestedValue(data, spec.loggedByFilterField);
          if (val && val !== filters.loggedBy) continue;
        }

        // 3. Accumulate metric (sum or count)
        if (spec.type === 'sum') {
          let value = 0;
          if (Array.isArray(spec.sumFields)) {
            for (const sumPath of spec.sumFields) {
              const rawVal = getNestedValue(data, sumPath);
              if (rawVal !== undefined && rawVal !== null) {
                value = Number(rawVal);
                break;
              }
            }
          }
          periodTotal += isNaN(value) ? 0 : value;
        } else {
          // count
          periodTotal += 1;
        }
      }

      results.push(periodTotal);
    }

    // Return both data and results for 100% backward & forward compatibility
    return { data: results, results };
  } catch (err: any) {
    console.error(`Error in generic getChartAggregations for entity ${entity}:`, err);
    const zeros = periods.map(() => 0);
    return { data: zeros, results: zeros };
  }
});
