import type { PlaceDocument, PlaceAddress, PlaceContact, PlaceType, PlaceStatus } from '../models/place';

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export const VALID_PLACE_TYPES: PlaceType[] = [
  'site',
  'warehouse',
  'headquarters',
  'branch',
  'store',
  'delivery_point',
  'client_site',
  'supplier_site',
  'custom'
];

export const VALID_PLACE_STATUSES: PlaceStatus[] = [
  'active',
  'temporary',
  'completed',
  'archived',
  'attivo',
  'inattivo'
];

export function validatePlaceForm(data: Partial<PlaceDocument>): ValidationResult {
  const errors: ValidationError[] = [];

  // 1. Nome obbligatorio (minimo 2 caratteri)
  if (!data.name || data.name.trim().length < 2) {
    errors.push({
      field: 'name',
      message: 'Il nome del luogo/cantiere deve contenere almeno 2 caratteri.'
    });
  }

  // 2. Types obbligatori (almeno un tipo)
  if (!data.types || !Array.isArray(data.types) || data.types.length === 0) {
    errors.push({
      field: 'types',
      message: 'Seleziona almeno un ruolo/tipologia per questo luogo.'
    });
  } else {
    for (const t of data.types) {
      if (!VALID_PLACE_TYPES.includes(t)) {
        errors.push({
          field: 'types',
          message: `Tipologia non valida: ${t}`
        });
      }
    }
  }

  // 3. Validazione Indirizzo (se presente)
  if (data.address) {
    if (data.address.country && data.address.country.length !== 2) {
      errors.push({
        field: 'address.country',
        message: 'Il codice paese deve essere di 2 caratteri (es. IT).'
      });
    }
  }

  // 4. Validazione Contatti (se presenti)
  if (data.contacts && Array.isArray(data.contacts)) {
    data.contacts.forEach((c, idx) => {
      if (!c.name || c.name.trim().length === 0) {
        errors.push({
          field: `contacts[${idx}].name`,
          message: `Inserisci il nome per il referente #${idx + 1}.`
        });
      }
    });
  }

  // 5. Validazione Geofencing (se presente)
  if (data.geo && typeof data.geo.radiusMeters === 'number') {
    if (data.geo.radiusMeters < 1 || data.geo.radiusMeters > 50000) {
      errors.push({
        field: 'geo.radiusMeters',
        message: 'Il raggio del geofence deve essere compreso tra 1 e 50.000 metri.'
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
