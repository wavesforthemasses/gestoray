import { db, collection, writeBatch, doc } from '$lib/firebase';
import type { ImportModuleSpec, ConflictStrategy } from '$lib/types/importTypes';
import { CacheLookupService } from '$lib/services/cacheLookupService';
import { uuidv7 } from 'uuidv7';

export const clientsImportSpec: ImportModuleSpec = {
  entityType: 'clients',
  label: 'Anagrafica Clienti',
  collectionName: 'clients',
  prerequisites: [],
  lookupKeys: ['id', 'fiscalId', 'piva', 'codice_fiscale', 'email', 'ragione_sociale', 'nome'],
  fields: [
    {
      key: 'id',
      label: 'ID Cliente / Codice Univoco (Opzionale)',
      type: 'string',
      required: false,
      description: 'ID univoco del cliente. Se non fornito, viene generato automaticamente.'
    },
    { key: 'nome', label: 'Nome / Ragione Sociale', type: 'string', required: true, aliases: ['nome', 'ragione sociale', 'azienda', 'cliente', 'intestazione'] },
    { key: 'cognome', label: 'Cognome / Referente', type: 'string', required: false, aliases: ['cognome', 'referente', 'contatto'] },
    { key: 'email', label: 'Email', type: 'string', required: false, aliases: ['e-mail', 'mail'] },
    { key: 'phone', label: 'Telefono', type: 'string', required: false, aliases: ['tel', 'cellulare', 'telefono fisso', 'recapito'] },
    { key: 'website', label: 'Sito Web', type: 'string', required: false, aliases: ['sito', 'url', 'web'] },
    { key: 'fiscalId', label: 'Identificativo Fiscale', type: 'string', required: false, aliases: ['p.iva / c.f.', 'codice fiscale / p.iva'] },
    { key: 'piva', label: 'Partita IVA', type: 'string', required: false, aliases: ['piva', 'p.iva', 'vat', 'partita iva'] },
    { key: 'codice_fiscale', label: 'Codice Fiscale', type: 'string', required: false, aliases: ['cf', 'c.f.', 'codice fiscale'] },
    { key: 'sdi_code', label: 'Codice SDI', type: 'string', required: false, aliases: ['sdi', 'codice destinatario'] },
    { key: 'pec', label: 'PEC', type: 'string', required: false, aliases: ['posta certificata', 'indirizzo pec'] },
    { key: 'iban', label: 'IBAN', type: 'string', required: false, aliases: ['conto corrente'] },
    { key: 'bankName', label: 'Nome Banca', type: 'string', required: false, aliases: ['banca', 'istituto di credito'] },
    { key: 'paymentTerms', label: 'Modalità di Pagamento', type: 'string', required: false, aliases: ['pagamento', 'condizioni pagamento', 'termini di pagamento'] },
    { key: 'status', label: 'Stato Funnel', type: 'string', required: false, defaultValue: 'prospect', aliases: ['stato'] },
    { key: 'address', label: 'Indirizzo Sede', type: 'string', required: false, aliases: ['indirizzo', 'via', 'sede'] },
    { key: 'city', label: 'Città Sede', type: 'string', required: false, aliases: ['citta', 'città', 'comune'] },
    { key: 'province', label: 'Provincia Sede', type: 'string', required: false, aliases: ['provincia', 'pr'] },
    { key: 'postalCode', label: 'CAP Sede', type: 'string', required: false, aliases: ['cap', 'codice postale'] },
    { key: 'country', label: 'Nazione Sede', type: 'string', required: false, aliases: ['nazione', 'stato sede', 'paese'] },
    { key: 'billingAddress', label: 'Indirizzo Fatturazione', type: 'string', required: false },
    { key: 'billingCity', label: 'Città Fatturazione', type: 'string', required: false },
    { key: 'billingProvince', label: 'Provincia Fatturazione', type: 'string', required: false },
    { key: 'billingPostalCode', label: 'CAP Fatturazione', type: 'string', required: false },
    { key: 'billingCountry', label: 'Nazione Fatturazione', type: 'string', required: false },
    { key: 'shippingAddress', label: 'Indirizzo Spedizione', type: 'string', required: false },
    { key: 'shippingCity', label: 'Città Spedizione', type: 'string', required: false },
    { key: 'shippingProvince', label: 'Provincia Spedizione', type: 'string', required: false },
    { key: 'shippingPostalCode', label: 'CAP Spedizione', type: 'string', required: false },
    { key: 'shippingCountry', label: 'Nazione Spedizione', type: 'string', required: false }
  ],

  processBatch: async (
    rows: Record<string, any>[],
    sessionMap: Record<string, string>,
    conflictStrategy: ConflictStrategy
  ) => {
    const batch = writeBatch(db);
    let succeeded = 0;
    let failed = 0;
    const errors: { row: number; error: string }[] = [];
    const createdMap: Record<string, string> = {};

    rows.forEach((row, idx) => {
      try {
        const explicitId = String(row.id || '').trim();
        const fiscalIdComputed = String(row.fiscalId || row.piva || row.codice_fiscale || '').trim();
        const legacyId = fiscalIdComputed || (row.email ? String(row.email).trim() : '');
        const targetId = explicitId || ((conflictStrategy === 'upsert' && legacyId) ? legacyId : uuidv7());

        const docRef = doc(collection(db, 'clients'), targetId);
        const name = String(row.nome || '').trim();
        const cognome = String(row.cognome || '').trim();
        const fullName = `${name} ${cognome}`.trim();


        const address = row.address || '';
        const city = row.city || '';
        const province = row.province || '';
        const postalCode = row.postalCode || '';
        const country = row.country || 'Italy';

        const billingAddress = row.billingAddress || address;
        const billingCity = row.billingCity || city;
        const billingProvince = row.billingProvince || province;
        const billingPostalCode = row.billingPostalCode || postalCode;
        const billingCountry = row.billingCountry || country;

        const shippingAddress = row.shippingAddress || billingAddress;
        const shippingCity = row.shippingCity || billingCity;
        const shippingProvince = row.shippingProvince || billingProvince;
        const shippingPostalCode = row.shippingPostalCode || billingPostalCode;
        const shippingCountry = row.shippingCountry || billingCountry;

        const clientDoc = {
          original: {
            nome: name,
            cognome: cognome,
            email: row.email || '',
            phone: row.phone || '',
            website: row.website || '',
            fiscalId: fiscalIdComputed,
            partitaIva: row.piva || row.partitaIva || '',
            codiceFiscale: row.codice_fiscale || row.codiceFiscale || '',
            sdiCode: row.sdi_code || row.sdiCode || '',
            pec: row.pec || '',
            iban: row.iban || '',
            bankName: row.bankName || '',
            paymentTerms: row.paymentTerms || '',
            status: row.status || 'prospect',
            address,
            city,
            province,
            postalCode,
            country,
            billingAddress,
            billingCity,
            billingProvince,
            billingPostalCode,
            billingCountry,
            shippingAddress,
            shippingCity,
            shippingProvince,
            shippingPostalCode,
            shippingCountry,
            notes: []
          },
          derived: {
            textSearch: [
              name.toLowerCase(),
              cognome.toLowerCase(),
              fullName.toLowerCase(),
              fiscalIdComputed.toLowerCase(),
              (row.piva || '').toLowerCase(),
              (row.email || '').toLowerCase()
            ].filter(Boolean)
          },
          edits: {
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        };

        batch.set(docRef, clientDoc, { merge: conflictStrategy === 'upsert' });
        succeeded++;

        if (explicitId || legacyId) {
          createdMap[explicitId || legacyId] = targetId;
        }
      } catch (err: any) {
        failed++;
        errors.push({ row: idx, error: err.message || 'Errore di salvataggio record' });
      }
    });

    await batch.commit();

    try {
      await CacheLookupService.rebuildCacheForType('clients');
    } catch (e) {
      console.warn('[clientsImportSpec] Cache rebuild warning:', e);
    }

    return { succeeded, failed, errors, createdMap };
  }
};
