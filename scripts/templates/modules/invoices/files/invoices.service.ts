import { 
  db, 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  runTransaction 
} from '$lib/firebase';
import { roundCurrency } from '$lib/utils/math';
import { cleanUndefined } from '$lib/utils/helpers';
import { VatRatesService } from '$lib/services/vatRatesService';
import { InvoiceSettingsService } from './invoiceSettingsService';
import type { InvoiceItem, InvoiceLine, CastellettoItem, InvoiceType, InvoiceStatus } from './schema';

export class InvoicesService {
  private static COLLECTION = 'invoices';

  /**
   * Calcola i totali e il Castelletto IVA della fattura usando il metodo SSOT ad aliquote aggregate
   */
  static calculateTotals(
    lines: InvoiceLine[], 
    options: {
      pensionFundRate?: number;
      withholdingTaxRate?: number;
      isSplitPayment?: boolean;
    } = {}
  ): {
    totalNet: number;
    totalVat: number;
    totalGross: number;
    pensionFundAmount: number;
    withholdingTaxAmount: number;
    splitPaymentAmount: number;
    netToPay: number;
    castelletto: CastellettoItem[];
  } {
    // 1. Calcola e assegna imponibile e IVA per ogni singola riga
    const mappedLines = lines.map(l => {
      const qty = Math.max(0, l.quantity || 1);
      const unitP = l.unitPrice || 0;
      const disc = Math.min(100, Math.max(0, l.discountPercent || 0));
      const discountedUnit = unitP * (1 - disc / 100);
      const net = roundCurrency(qty * discountedUnit);
      const rate = Math.max(0, l.vatRate || 0);
      const vat = rate > 0 ? roundCurrency(net * (rate / 100)) : 0;
      return {
        ...l,
        netAmount: net,
        vatAmount: vat,
        grossAmount: roundCurrency(net + vat)
      };
    });

    // 2. Castelletto IVA ufficiale aggregato per aliquota
    const vatCalc = VatRatesService.calculateTotalsByVat(mappedLines);

    // 3. Cassa Previdenza (es. 4% per professionisti)
    let pensionFundAmount = 0;
    const pRate = Math.max(0, options.pensionFundRate || 0);
    if (pRate > 0) {
      pensionFundAmount = roundCurrency(vatCalc.totalNet * (pRate / 100));
    }

    // 4. Ritenuta d'acconto (es. 20% su imponibile)
    let withholdingTaxAmount = 0;
    const wRate = Math.max(0, options.withholdingTaxRate || 0);
    if (wRate > 0) {
      withholdingTaxAmount = roundCurrency(vatCalc.totalNet * (wRate / 100));
    }

    // 5. Totale Lordo e Split Payment PA
    const totalGross = roundCurrency(vatCalc.totalNet + pensionFundAmount + vatCalc.totalVat);
    let splitPaymentAmount = 0;
    if (options.isSplitPayment) {
      splitPaymentAmount = vatCalc.totalVat;
    }

    // 6. Netto effettivo da incassare dal cliente
    const netToPay = Math.max(0, roundCurrency(totalGross - withholdingTaxAmount - splitPaymentAmount));

    return {
      totalNet: vatCalc.totalNet,
      totalVat: vatCalc.totalVat,
      totalGross,
      pensionFundAmount,
      withholdingTaxAmount,
      splitPaymentAmount,
      netToPay,
      castelletto: vatCalc.castelletto
    };
  }

  /**
   * Crea una nuova bozza di fattura senza consumare numeri progressivi
   */
  static async createDraft(
    data: Partial<InvoiceItem>, 
    authorUid?: string
  ): Promise<string> {
    const settings = await InvoiceSettingsService.getSettings();
    const type = data.type || 'TD01';
    const sezionaleId = settings.documentTypeSezionaleMapping?.[type] || 'default';
    const sezConfig = settings.sezionali.find(s => s.id === sezionaleId) || settings.sezionali[0];

    const lines = data.lines || [];
    const totals = this.calculateTotals(lines, {
      pensionFundRate: data.pensionFundRate,
      withholdingTaxRate: data.withholdingTaxRate,
      isSplitPayment: data.isSplitPayment
    });

    const now = new Date();
    const year = now.getFullYear();
    const docRef = doc(collection(db, this.COLLECTION));

    const payload: InvoiceItem = {
      ...data,
      id: docRef.id,
      tenantId: 'default',
      invoiceNumber: `BOZZA-${now.getTime().toString(36).toUpperCase()}`,
      number: 0,
      year: data.year || year,
      sezionaleId: sezConfig.id,
      sezionaleCode: sezConfig.code || '',
      type,
      status: 'bozza',
      date: data.date || now.toISOString().split('T')[0],
      dueDate: data.dueDate || now.toISOString().split('T')[0],
      clientId: data.clientId || '',
      clientName: data.clientName || 'Bozza Documento',
      lines,
      castelletto: totals.castelletto,
      totalNet: totals.totalNet,
      totalVat: totals.totalVat,
      totalGross: totals.totalGross,
      pensionFundAmount: totals.pensionFundAmount,
      withholdingTaxAmount: totals.withholdingTaxAmount,
      splitPaymentAmount: totals.splitPaymentAmount,
      netToPay: totals.netToPay,
      paymentStatus: 'non_pagata',
      paidAmount: 0,
      remainingAmount: totals.netToPay,
      paymentMethod: data.paymentMethod || settings.defaultPaymentMethod || 'bonifico',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      edits: {
        createdBy: authorUid || 'system',
        createdAt: now.toISOString()
      }
    };

    await setDoc(docRef, cleanUndefined(payload));
    return docRef.id;
  }

  /**
   * Emette la fattura assegnando in modo atomico il numero progressivo con retry backoff
   */
  static async issueInvoice(
    invoiceId: string, 
    authorUid?: string
  ): Promise<{ invoiceNumber: string; number: number }> {
    const invoiceRef = doc(db, this.COLLECTION, invoiceId);
    const invoiceSnap = await getDoc(invoiceRef);
    if (!invoiceSnap.exists()) throw new Error('Fattura non trovata');

    const invData = invoiceSnap.data() as InvoiceItem;
    if (invData.status !== 'bozza') {
      return { invoiceNumber: invData.invoiceNumber, number: invData.number };
    }

    const year = invData.year || new Date().getFullYear();
    const sezionaleId = invData.sezionaleId || 'default';
    const settings = await InvoiceSettingsService.getSettings();
    const seq = InvoiceSettingsService.getSequenceForYearAndSezionale(settings, year, sezionaleId);
    const sezConfig = settings.sezionali.find(s => s.id === sezionaleId);
    const sezCode = sezConfig?.code || '';

    let candidateNumber = Math.max(seq.startNumber, (seq.lastAssignedNumber || 0) + 1);
    let attempts = 0;
    const maxAttempts = 5;

    while (attempts < maxAttempts) {
      attempts++;
      const lockKey = `tenant_default_invoice_${year}_${sezionaleId}_${candidateNumber}`;
      const lockRef = doc(db, 'unique_keys', lockKey);

      try {
        const result = await runTransaction(db, async (txn) => {
          const lockSnap = await txn.get(lockRef);
          if (lockSnap.exists()) {
            throw new Error('LOCK_COLLISION');
          }

          // Riserva il lock
          txn.set(lockRef, {
            invoiceId,
            year,
            sezionaleId,
            number: candidateNumber,
            lockedAt: new Date().toISOString()
          });

          // Formatta il numero ufficiale
          const formattedNumber = (seq.pattern || '{NUM}/{YYYY}{SEZ}')
            .replace('{NUM}', String(candidateNumber))
            .replace('{YYYY}', String(year))
            .replace('{SEZ}', sezCode);

          // Aggiorna lo stato fattura
          txn.update(invoiceRef, {
            invoiceNumber: formattedNumber,
            number: candidateNumber,
            status: 'emessa',
            updatedAt: new Date().toISOString(),
            'edits.issuedBy': authorUid || 'system',
            'edits.issuedAt': new Date().toISOString()
          });

          // Aggiorna la sequenza nei settings
          const updatedSequences = (settings.annualSequences || []).map(s => {
            if (s.year === year && s.sezionaleId === sezionaleId) {
              return { ...s, lastAssignedNumber: candidateNumber };
            }
            return s;
          });
          if (!updatedSequences.some(s => s.year === year && s.sezionaleId === sezionaleId)) {
            updatedSequences.push({
              year,
              sezionaleId,
              startNumber: seq.startNumber,
              lastAssignedNumber: candidateNumber,
              pattern: seq.pattern
            });
          }

          txn.set(doc(db, 'settings/invoices'), {
            annualSequences: updatedSequences,
            updatedAt: new Date().toISOString()
          }, { merge: true });

          // Se la fattura ha bolle collegate, le marca come fatturate
          if (Array.isArray(invData.bolleIds) && invData.bolleIds.length > 0) {
            for (const bId of invData.bolleIds) {
              const bRef = doc(db, 'interventions', bId);
              txn.update(bRef, {
                status: 'fatturato',
                phase: 'fatturato',
                invoiceId,
                invoicedAt: new Date().toISOString()
              });
            }
          }

          return { invoiceNumber: formattedNumber, number: candidateNumber };
        });

        return result;
      } catch (err: any) {
        if (err.message === 'LOCK_COLLISION') {
          // Collisione: backoff casuale tra 50 e 150ms e riprova
          candidateNumber++;
          await new Promise(r => setTimeout(r, 50 + Math.random() * 100));
        } else {
          throw err;
        }
      }
    }

    throw new Error(`Impossibile acquisire il numero progressivo dopo ${maxAttempts} tentativi concorrenti.`);
  }

  /**
   * Elimina una bozza e garantisce il Rollback Simmetrico delle bolle collegate (Principio 7)
   */
  static async deleteDraft(invoiceId: string): Promise<void> {
    const invoiceRef = doc(db, this.COLLECTION, invoiceId);
    const snap = await getDoc(invoiceRef);
    if (!snap.exists()) return;

    const data = snap.data() as InvoiceItem;
    if (data.status !== 'bozza') {
      throw new Error('Solo le bozze possono essere eliminate. Per fatture emesse usa la Nota di Credito.');
    }

    // Rollback simmetrico degli interventi collegati
    if (Array.isArray(data.bolleIds) && data.bolleIds.length > 0) {
      for (const bId of data.bolleIds) {
        try {
          await updateDoc(doc(db, 'interventions', bId), {
            status: 'firmato',
            phase: 'firmato',
            invoiceId: null,
            invoicedAt: null
          });
        } catch (e) {
          console.warn(`Errore rollback bolla ${bId}:`, e);
        }
      }
    }

    await deleteDoc(invoiceRef);
  }

  /**
   * Crea una Nota di Credito (TD04) a storno totale con opzione di svincolo bolle
   */
  static async createCreditNote(
    invoiceId: string, 
    authorUid?: string, 
    releaseBolle: boolean = false
  ): Promise<string> {
    const origRef = doc(db, this.COLLECTION, invoiceId);
    const origSnap = await getDoc(origRef);
    if (!origSnap.exists()) throw new Error('Fattura originale non trovata');

    const orig = origSnap.data() as InvoiceItem;
    if (orig.type === 'TD04') {
      throw new Error('Non è possibile stornare una Nota di Credito.');
    }

    const settings = await InvoiceSettingsService.getSettings();
    const ncSezionaleId = settings.documentTypeSezionaleMapping?.TD04 || 'NC';

    // Inverte i segni degli importi
    const reversedLines: InvoiceLine[] = (orig.lines || []).map(l => ({
      ...l,
      id: `nc_${l.id}`,
      unitPrice: -Math.abs(l.unitPrice),
      netAmount: -Math.abs(l.netAmount),
      vatAmount: -Math.abs(l.vatAmount),
      grossAmount: -Math.abs(l.grossAmount)
    }));

    const totals = this.calculateTotals(reversedLines);
    const now = new Date();
    const docRef = doc(collection(db, this.COLLECTION));

    const creditNoteData: InvoiceItem = {
      ...orig,
      id: docRef.id,
      invoiceNumber: `BOZZA-NC-${now.getTime().toString(36).toUpperCase()}`,
      number: 0,
      year: now.getFullYear(),
      sezionaleId: ncSezionaleId,
      sezionaleCode: settings.sezionali.find(s => s.id === ncSezionaleId)?.code || '/NC',
      type: 'TD04',
      status: 'bozza',
      date: now.toISOString().split('T')[0],
      lines: reversedLines,
      castelletto: totals.castelletto,
      totalNet: totals.totalNet,
      totalVat: totals.totalVat,
      totalGross: totals.totalGross,
      netToPay: 0,
      paidAmount: 0,
      remainingAmount: 0,
      paymentStatus: 'pagata_saldata',
      reversedInvoiceId: orig.invoiceNumber,
      notes: `Storno totale a fronte della fattura n. ${orig.invoiceNumber} del ${orig.date}. ${orig.notes || ''}`,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    };

    await setDoc(docRef, cleanUndefined(creditNoteData));

    // Se richiesto, svincola le bolle per renderle nuovamente fatturabili
    if (releaseBolle && Array.isArray(orig.bolleIds) && orig.bolleIds.length > 0) {
      for (const bId of orig.bolleIds) {
        await updateDoc(doc(db, 'interventions', bId), {
          status: 'firmato',
          phase: 'firmato',
          invoiceId: null,
          invoicedAt: null
        });
      }
    }

    // Segna la fattura originale come stornata
    await updateDoc(origRef, {
      creditNoteInvoiceId: docRef.id,
      paymentStatus: 'pagata_saldata',
      updatedAt: now.toISOString()
    });

    return docRef.id;
  }

  /**
   * Genera una bozza di fattura a partire da uno o più interventi/bolle
   */
  static async createFromInterventi(
    bolleList: Array<{ id: string; number?: string; date?: string; title: string; clientName: string; clientId: string; items?: any[] }>,
    clientId: string,
    authorUid?: string
  ): Promise<string> {
    if (bolleList.length === 0) throw new Error('Seleziona almeno una bolla');

    const first = bolleList[0];
    const lines: InvoiceLine[] = [];

    bolleList.forEach(bolla => {
      // Riga descrittiva obbligatoria per riferimento normativo
      lines.push({
        id: `hdr_${bolla.id}`,
        description: `Rif. Bolla/Rapporto n. ${bolla.number || bolla.id} del ${bolla.date || 'N/D'} - ${bolla.title}`,
        quantity: 1,
        unitPrice: 0,
        vatRate: 0,
        netAmount: 0,
        vatAmount: 0,
        grossAmount: 0,
        bollaId: bolla.id,
        bollaNumber: bolla.number || bolla.id,
        bollaDate: bolla.date,
        entryType: 'other'
      });

      // Righe di consuntivo
      if (Array.isArray(bolla.items) && bolla.items.length > 0) {
        bolla.items.forEach((item, idx) => {
          const qty = Number(item.quantity || 1);
          const price = Number(item.unitPrice || item.totalAmount || 0);
          const vatRate = 22; // default ordinaria
          const net = roundCurrency(qty * price);
          const vat = roundCurrency(net * (vatRate / 100));

          lines.push({
            id: `line_${bolla.id}_${idx}`,
            description: item.description || item.productName || 'Voce di lavoro',
            quantity: qty,
            unitPrice: price,
            vatRate,
            netAmount: net,
            vatAmount: vat,
            grossAmount: roundCurrency(net + vat),
            bollaId: bolla.id,
            bollaNumber: bolla.number || bolla.id,
            bollaDate: bolla.date,
            entryType: item.entryType || 'service'
          });
        });
      }
    });

    const isMultiBolla = bolleList.length > 1;
    const type: InvoiceType = isMultiBolla ? 'TD24' : 'TD01';

    return this.createDraft({
      type,
      clientId,
      clientName: first.clientName,
      lines,
      originType: 'bolle',
      bolleIds: bolleList.map(b => b.id),
      notes: `Fatturazione ${isMultiBolla ? 'differita riepilogativa' : 'immediata'} interventi.`
    }, authorUid);
  }

  /**
   * Recupera le fatture con filtri
   */
  static async getInvoices(filters: {
    year?: number;
    sezionaleId?: string;
    clientId?: string;
    status?: InvoiceStatus;
    paymentStatus?: string;
  } = {}): Promise<InvoiceItem[]> {
    try {
      let q = query(collection(db, this.COLLECTION));
      if (filters.clientId) {
        q = query(q, where('clientId', '==', filters.clientId));
      }
      if (filters.status) {
        q = query(q, where('status', '==', filters.status));
      }

      const snap = await getDocs(q);
      let list: InvoiceItem[] = [];
      snap.forEach(d => {
        list.push({ id: d.id, ...d.data() } as InvoiceItem);
      });

      // Filtri in memoria per flessibilità su anno e sezionale
      if (filters.year) {
        list = list.filter(i => i.year === filters.year);
      }
      if (filters.sezionaleId && filters.sezionaleId !== 'all') {
        list = list.filter(i => i.sezionaleId === filters.sezionaleId);
      }
      if (filters.paymentStatus && filters.paymentStatus !== 'all') {
        list = list.filter(i => i.paymentStatus === filters.paymentStatus);
      }

      // Ordina per data e numero decrescente
      list.sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.number || 0) - (a.number || 0));
      return list;
    } catch (e) {
      console.warn('Errore lettura fatture:', e);
      return [];
    }
  }

  /**
   * Recupera una singola fattura per ID
   */
  static async getInvoiceById(id: string): Promise<InvoiceItem | null> {
    try {
      const snap = await getDoc(doc(db, this.COLLECTION, id));
      if (snap.exists()) {
        return { id: snap.id, ...snap.data() } as InvoiceItem;
      }
    } catch (e) {
      console.error(`Errore getInvoiceById ${id}:`, e);
    }
    return null;
  }
}
