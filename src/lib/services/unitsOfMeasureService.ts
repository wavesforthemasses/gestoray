import {
  db,
  collection,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
  writeBatch
} from '$lib/firebase';

export interface UnitOfMeasure {
  id: string;
  code: string;
  label: string;
  symbol?: string;
  category: 'quantity' | 'volume' | 'area' | 'length' | 'weight' | 'time' | 'service' | 'currency';
  decimals?: number;
  aliases: string[];
  isSystem?: boolean;
  updatedAt?: string;
}

export interface UnitResolutionResult {
  isValid: boolean;
  canonicalCode: string;
  unit?: UnitOfMeasure;
  matchedByAlias: boolean;
  rawInput: string;
}

export const DEFAULT_UNITS: UnitOfMeasure[] = [
  {
    id: 'pz',
    code: 'pz',
    label: 'Pezzi (pz)',
    symbol: 'pz',
    category: 'quantity',
    decimals: 0,
    aliases: ['pz', 'pezzi', 'pezzo', 'pc', 'pcs', 'piece', 'pieces', 'cad', 'cad.', 'ciascuno'],
    isSystem: true
  },
  {
    id: 'mc',
    code: 'mc',
    label: 'Metri Cubi (mc)',
    symbol: 'm³',
    category: 'volume',
    decimals: 3,
    aliases: ['mc', 'm3', 'metri cubi', 'metro cubo', 'm^3', 'metrocubo'],
    isSystem: true
  },
  {
    id: 'mq',
    code: 'mq',
    label: 'Metri Quadri (mq)',
    symbol: 'm²',
    category: 'area',
    decimals: 2,
    aliases: ['mq', 'm2', 'metri quadri', 'metro quadro', 'm^2', 'metroquadro'],
    isSystem: true
  },
  {
    id: 'm',
    code: 'm',
    label: 'Metri Lineari (m)',
    symbol: 'm',
    category: 'length',
    decimals: 2,
    aliases: ['m', 'mt', 'metri', 'metro', 'ml', 'metrolineare'],
    isSystem: true
  },
  {
    id: 'kg',
    code: 'kg',
    label: 'Chilogrammi (kg)',
    symbol: 'kg',
    category: 'weight',
    decimals: 3,
    aliases: ['kg', 'kili', 'chili', 'chilogrammi', 'chilogrammo', 'kilo', 'kilos'],
    isSystem: true
  },
  {
    id: 'l',
    code: 'l',
    label: 'Litri (l)',
    symbol: 'l',
    category: 'volume',
    decimals: 2,
    aliases: ['l', 'lt', 'litri', 'litro'],
    isSystem: true
  },
  {
    id: 'ora',
    code: 'ora',
    label: 'Ore (ora)',
    symbol: 'h',
    category: 'time',
    decimals: 2,
    aliases: ['ora', 'ore', 'h', 'hr', 'hours', 'hour'],
    isSystem: true
  },
  {
    id: 'corpo',
    code: 'corpo',
    label: 'A Corpo (corpo)',
    symbol: 'corpo',
    category: 'service',
    decimals: 0,
    aliases: ['corpo', 'a corpo', 'lotto', 'forfait'],
    isSystem: true
  },
  {
    id: 'conf',
    code: 'conf',
    label: 'Confezione (conf)',
    symbol: 'conf',
    category: 'quantity',
    decimals: 0,
    aliases: ['conf', 'confezione', 'confezioni', 'box', 'pacco', 'pacchi'],
    isSystem: true
  },
  {
    id: 'eur',
    code: 'eur',
    label: 'Euro (€)',
    symbol: '€',
    category: 'currency',
    decimals: 2,
    aliases: ['eur', 'euro', '€', 'valuta'],
    isSystem: true
  }
];

let cachedUnits: UnitOfMeasure[] | null = null;

export class UnitsOfMeasureService {
  private static COLLECTION_NAME = 'units_of_measure';

  /**
   * Returns cached units or DEFAULT_UNITS synchronously.
   */
  static getUnitsSync(): UnitOfMeasure[] {
    return cachedUnits || DEFAULT_UNITS;
  }

  /**
   * Fetches current units of measure documents from Firestore collection `units_of_measure`.
   * Automatically seeds default system units into Firestore if collection is empty.
   */
  static async getUnits(): Promise<UnitOfMeasure[]> {
    try {
      const snap = await getDocs(collection(db, this.COLLECTION_NAME));
      if (!snap.empty) {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as UnitOfMeasure));
        cachedUnits = list;
        return cachedUnits;
      }

      // First time setup: Seed DEFAULT_UNITS documents directly into Firestore collection
      const batch = writeBatch(db);
      for (const u of DEFAULT_UNITS) {
        const docRef = doc(db, this.COLLECTION_NAME, u.code);
        batch.set(docRef, { ...u, updatedAt: new Date().toISOString() });
      }
      await batch.commit();

      cachedUnits = [...DEFAULT_UNITS];
      return cachedUnits;
    } catch (err) {
      console.warn('[UnitsOfMeasureService] Firestore fetch warning, using defaults:', err);
      cachedUnits = [...DEFAULT_UNITS];
      return cachedUnits;
    }
  }

  /**
   * Returns allowed decimal places for a given unit code (defaulting to 2 if unspecified).
   */
  static getUnitDecimals(unitCode?: string): number {
    if (!unitCode) return 2;
    const resolved = this.resolveUnitSync(unitCode);
    const unit = resolved.unit;
    if (unit && typeof unit.decimals === 'number') {
      return unit.decimals;
    }
    return 2;
  }

  /**
   * Returns the HTML input `step` string for a given unit (e.g. '1', '0.01', '0.001').
   */
  static getStepForUnit(unitCode?: string): string {
    const decimals = this.getUnitDecimals(unitCode);
    if (decimals <= 0) return '1';
    return `0.${'0'.repeat(decimals - 1)}1`;
  }

  /**
   * Rounds a numerical quantity value according to the unit's defined decimal places.
   */
  static roundQuantity(value: number, unitCode?: string): number {
    if (typeof value !== 'number' || isNaN(value)) return 0;
    const decimals = this.getUnitDecimals(unitCode);
    const factor = Math.pow(10, decimals);
    return Math.round((value + Number.EPSILON) * factor) / factor;
  }

  /**
   * Formats a quantity value into a Italian locale string with exact decimal precision for its unit.
   */
  static formatQuantity(
    value: number | string | null | undefined,
    unitCode?: string,
    includeSymbol = false
  ): string {
    const num = typeof value === 'string' ? parseFloat(value.replace(',', '.')) : Number(value);
    if (isNaN(num)) return '-';

    const resolved = this.resolveUnitSync(unitCode || 'pz');
    const decimals = this.getUnitDecimals(resolved.canonicalCode);
    const symbol = resolved.unit?.symbol || resolved.canonicalCode;

    const formattedNum = num.toLocaleString('it-IT', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });

    return includeSymbol ? `${formattedNum} ${symbol}` : formattedNum;
  }

  /**
   * Saves or updates a single unit document in Firestore collection `units_of_measure/{code}`.
   */
  static async saveUnit(unit: UnitOfMeasure): Promise<void> {
    const docRef = doc(db, this.COLLECTION_NAME, unit.code);
    const payload = {
      ...unit,
      id: unit.code,
      decimals: typeof unit.decimals === 'number' ? unit.decimals : 2,
      updatedAt: new Date().toISOString()
    };
    await setDoc(docRef, payload, { merge: true });

    if (cachedUnits) {
      const idx = cachedUnits.findIndex((u) => u.code === unit.code);
      if (idx >= 0) {
        cachedUnits[idx] = payload;
      } else {
        cachedUnits.push(payload);
      }
    }
  }

  /**
   * Saves or updates multiple unit documents in Firestore collection `units_of_measure`.
   */
  static async saveUnits(units: UnitOfMeasure[]): Promise<void> {
    const batch = writeBatch(db);
    const now = new Date().toISOString();
    for (const u of units) {
      const docRef = doc(db, this.COLLECTION_NAME, u.code);
      const payload = {
        ...u,
        id: u.code,
        decimals: typeof u.decimals === 'number' ? u.decimals : 2,
        updatedAt: now
      };
      batch.set(docRef, payload, { merge: true });
    }
    await batch.commit();
    cachedUnits = [...units];
  }

  /**
   * Deletes a custom unit document from Firestore collection `units_of_measure/{code}`.
   */
  static async deleteUnit(code: string): Promise<void> {
    await deleteDoc(doc(db, this.COLLECTION_NAME, code));
    if (cachedUnits) {
      cachedUnits = cachedUnits.filter((u) => u.code !== code);
    }
  }

  /**
   * Resets collection to default system units in Firestore.
   */
  static async resetDefaults(): Promise<void> {
    const snap = await getDocs(collection(db, this.COLLECTION_NAME));
    const batch = writeBatch(db);

    // Delete existing custom docs
    snap.docs.forEach((d) => {
      batch.delete(d.ref);
    });

    // Re-seed system defaults
    for (const u of DEFAULT_UNITS) {
      const docRef = doc(db, this.COLLECTION_NAME, u.code);
      batch.set(docRef, { ...u, updatedAt: new Date().toISOString() });
    }

    await batch.commit();
    cachedUnits = [...DEFAULT_UNITS];
  }

  /**
   * Synchronous / memory resolution of raw unit strings (used by import validator and forms).
   */
  static resolveUnitSync(
    rawUnit: string,
    catalog: UnitOfMeasure[] = cachedUnits || DEFAULT_UNITS
  ): UnitResolutionResult {
    if (!rawUnit || !String(rawUnit).trim()) {
      return {
        isValid: true,
        canonicalCode: 'pz',
        unit: catalog.find((u) => u.code === 'pz'),
        matchedByAlias: false,
        rawInput: rawUnit || ''
      };
    }

    const cleanInput = String(rawUnit).trim().toLowerCase().replace(/[^a-z0-9àèéìòù³²^]/g, '');

    // 1. Direct code match
    const exactMatch = catalog.find((u) => u.code.toLowerCase() === cleanInput);
    if (exactMatch) {
      return {
        isValid: true,
        canonicalCode: exactMatch.code,
        unit: exactMatch,
        matchedByAlias: false,
        rawInput: rawUnit
      };
    }

    // 2. Alias match
    for (const unit of catalog) {
      for (const alias of unit.aliases) {
        const cleanAlias = alias.trim().toLowerCase().replace(/[^a-z0-9àèéìòù³²^]/g, '');
        if (cleanAlias === cleanInput) {
          return {
            isValid: true,
            canonicalCode: unit.code,
            unit,
            matchedByAlias: true,
            rawInput: rawUnit
          };
        }
      }
    }

    // 3. Unknown unit
    return {
      isValid: false,
      canonicalCode: cleanInput || 'pz',
      matchedByAlias: false,
      rawInput: rawUnit
    };
  }

  /**
   * Async resolution helper.
   */
  static async resolveUnit(rawUnit: string): Promise<UnitResolutionResult> {
    const catalog = await this.getUnits();
    return this.resolveUnitSync(rawUnit, catalog);
  }
}
