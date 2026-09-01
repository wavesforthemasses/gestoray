import type { FieldSemanticsType } from '$lib/services/versioningService';

export const PLACE_FIELD_LABELS: Record<string, string> = {
  'code': 'Codice Identificativo Luogo',
  'name': 'Nome Luogo / Cantiere / Sede',
  'type': 'Tipologia Luogo',
  'status': 'Stato Operativo',
  'clientId': 'ID Cliente Proprietario',
  'clientName': 'Ragione Sociale Cliente',
  'parentId': 'Luogo Padre (Gerarchia)',
  'description': 'Descrizione',
  'address.street': 'Indirizzo',
  'address.city': 'Città',
  'address.province': 'Provincia',
  'address.zip': 'CAP'
};

export const PLACE_SEMANTICS_MAP: Record<string, FieldSemanticsType> = {
  'code': 'ABSOLUTE',
  'name': 'ABSOLUTE',
  'type': 'ABSOLUTE',
  'status': 'ABSOLUTE',
  'clientId': 'ABSOLUTE',
  'clientName': 'ABSOLUTE',
  'parentId': 'ABSOLUTE'
};

export class PlacesVersioningBridge {
  static getFieldLabel(fieldPath: string): string {
    return PLACE_FIELD_LABELS[fieldPath] || fieldPath;
  }

  static getSemanticsMap(): Record<string, FieldSemanticsType> {
    return PLACE_SEMANTICS_MAP;
  }

  static getEntityLabel(placeData: any): string {
    if (!placeData) return 'Luogo';
    const code = placeData.code ? `[${placeData.code}] ` : '';
    const name = placeData.name || placeData.id || 'Luogo / Cantiere';
    return `${code}${name}`.trim();
  }
}
