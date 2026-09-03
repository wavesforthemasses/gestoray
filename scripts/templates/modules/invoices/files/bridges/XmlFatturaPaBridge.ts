import type { InvoiceItem, InvoiceLine, CastellettoItem, InvoiceType, InvoiceStatus } from '../schema';
import type { InvoiceBridgePort, TransmissionResult, SyncUpdate, ImportSummary } from './InvoiceBridgePort';
import { roundCurrency } from '$lib/utils/math';

function xmlEscape(str?: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function xmlExtractTag(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return match ? match[1].trim() : '';
}

function xmlExtractAllBlocks(xml: string, tag: string): string[] {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
  const blocks: string[] = [];
  let match;
  while ((match = regex.exec(xml)) !== null) {
    blocks.push(match[1].trim());
  }
  return blocks;
}

export class XmlFatturaPaBridge implements InvoiceBridgePort {
  readonly id = 'xml_fatturapa';
  readonly name = 'FatturaPA XML Nativo (Standard AdE 1.2.2)';

  /**
   * Genera il file XML conforme al tracciato ministeriale FatturaPA v1.2.2
   */
  async generateXml(invoice: InvoiceItem, companyInfo: any = {}): Promise<string> {
    const isPA = invoice.type === 'TD06' && invoice.clientSdiCode?.length === 6;
    const formatoTrasmissione = isPA ? 'FPA12' : 'FPR12';
    const sdiCode = invoice.clientSdiCode && invoice.clientSdiCode.trim().length > 0
      ? invoice.clientSdiCode.trim().toUpperCase()
      : '0000000';

    const cedenteVat = (companyInfo.vatNumber || 'IT00000000000').replace(/[^a-zA-Z0-9]/g, '');
    const cedenteCountry = companyInfo.country || 'IT';
    const cedentePivaClean = cedenteVat.startsWith(cedenteCountry) ? cedenteVat.substring(cedenteCountry.length) : cedenteVat;

    const progressivoInvio = `${invoice.number}`.padStart(5, '0');

    // Mappa metodo pagamento (MP05 bonifico default)
    let paymentCode = 'MP05';
    if (invoice.paymentMethod === 'contanti') paymentCode = 'MP01';
    else if (invoice.paymentMethod === 'pos_carta') paymentCode = 'MP08';
    else if (invoice.paymentMethod === 'riba') paymentCode = 'MP12';

    // Generazione blocchi Linee
    const lineeXml = invoice.lines.map((line, idx) => {
      const numLinea = idx + 1;
      const desc = xmlEscape(line.description);
      const qty = (Number(line.quantity) || 1).toFixed(2);
      const unitP = (Number(line.unitPrice) || 0).toFixed(4);
      const totP = (Number(line.netAmount) || 0).toFixed(2);
      const vatR = (Number(line.vatRate) || 0).toFixed(2);
      const naturaTag = (line.vatRate === 0 && line.natureCode) ? `\n        <Natura>${line.natureCode}</Natura>` : '';
      const scontoTag = (line.discountPercent && line.discountPercent > 0)
        ? `\n        <ScontoMaggiorazione>\n          <Tipo>SC</Tipo>\n          <Percentuale>${(Number(line.discountPercent) || 0).toFixed(2)}</Percentuale>\n        </ScontoMaggiorazione>`
        : '';

      return `      <DettaglioLinee>
        <NumeroLinea>${numLinea}</NumeroLinea>
        <Descrizione>${desc}</Descrizione>
        <Quantita>${qty}</Quantita>
        <PrezzoUnitario>${unitP}</PrezzoUnitario>${scontoTag}
        <PrezzoTotale>${totP}</PrezzoTotale>
        <AliquotaIVA>${vatR}</AliquotaIVA>${naturaTag}
      </DettaglioLinee>`;
    }).join('\n');

    // Generazione Castelletto DatiRiepilogo
    const riepilogoXml = invoice.castelletto.map(c => {
      const vatR = (c.rate || 0).toFixed(2);
      const taxable = (c.taxableAmount || 0).toFixed(2);
      const vatA = (c.vatAmount || 0).toFixed(2);
      const naturaTag = (c.rate === 0 && c.natureCode) ? `\n        <Natura>${c.natureCode}</Natura>` : '';
      const esigibilita = invoice.isSplitPayment ? 'S' : 'I';
      const normTag = c.normativeRef ? `\n        <RiferimentoNormativo>${xmlEscape(c.normativeRef)}</RiferimentoNormativo>` : '';

      return `      <DatiRiepilogo>
        <AliquotaIVA>${vatR}</AliquotaIVA>${naturaTag}
        <ImponibileImporto>${taxable}</ImponibileImporto>
        <Imposta>${vatA}</Imposta>
        <EsigibilitaIVA>${esigibilita}</EsigibilitaIVA>${normTag}
      </DatiRiepilogo>`;
    }).join('\n');

    // Riferimenti DDT / Bolle
    let ddtXml = '';
    const bolleLines = invoice.lines.filter(l => l.bollaNumber);
    const uniqueBolle = Array.from(new Set(bolleLines.map(l => `${l.bollaNumber}|${l.bollaDate || invoice.date}`)));
    if (uniqueBolle.length > 0) {
      ddtXml = uniqueBolle.map(bStr => {
        const [bNum, bDate] = bStr.split('|');
        return `      <DatiDDT>
        <NumeroDDT>${xmlEscape(bNum)}</NumeroDDT>
        <DataDDT>${bDate}</DataDDT>
      </DatiDDT>`;
      }).join('\n') + '\n';
    }

    // Riferimento fattura collegata se nota di credito TD04
    let collegataXml = '';
    if (invoice.type === 'TD04' && invoice.reversedInvoiceId) {
      collegataXml = `      <DatiFattureCollegate>
        <IdDocumento>${xmlEscape(invoice.reversedInvoiceId)}</IdDocumento>
      </DatiFattureCollegate>\n`;
    }

    // Cassa Previdenziale
    let cassaXml = '';
    if (invoice.pensionFundRate && invoice.pensionFundAmount && invoice.pensionFundAmount > 0) {
      cassaXml = `      <DatiCassaPrevidenziale>
        <TipoCassa>TC07</TipoCassa>
        <AlCassa>${(Number(invoice.pensionFundRate) || 0).toFixed(2)}</AlCassa>
        <ImportoContributoCassa>${(Number(invoice.pensionFundAmount) || 0).toFixed(2)}</ImportoContributoCassa>
        <ImponibileCassa>${(Number(invoice.totalNet) || 0).toFixed(2)}</ImponibileCassa>
        <AliquotaIVA>22.00</AliquotaIVA>
      </DatiCassaPrevidenziale>\n`;
    }

    // Ritenuta d'acconto
    let ritenutaXml = '';
    if (invoice.withholdingTaxRate && invoice.withholdingTaxAmount && invoice.withholdingTaxAmount > 0) {
      ritenutaXml = `      <DatiRitenuta>
        <TipoRitenuta>RT02</TipoRitenuta>
        <ImportoRitenuta>${(Number(invoice.withholdingTaxAmount) || 0).toFixed(2)}</ImportoRitenuta>
        <AliquotaRitenuta>${(Number(invoice.withholdingTaxRate) || 0).toFixed(2)}</AliquotaRitenuta>
        <CausalePagamento>A</CausalePagamento>
      </DatiRitenuta>\n`;
    }

    return `<?xml version="1.0" encoding="UTF-8"?>
<p:FatturaElettronica versione="${formatoTrasmissione}" xmlns:p="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2" xmlns:ds="http://www.w3.org/2000/09/xmldsig#" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <FatturaElettronicaHeader>
    <DatiTrasmissione>
      <IdTrasmittente>
        <IdPaese>${cedenteCountry}</IdPaese>
        <IdCodice>${cedentePivaClean}</IdCodice>
      </IdTrasmittente>
      <ProgressivoInvio>${progressivoInvio}</ProgressivoInvio>
      <FormatoTrasmissione>${formatoTrasmissione}</FormatoTrasmissione>
      <CodiceDestinatario>${sdiCode}</CodiceDestinatario>${invoice.clientPec ? `\n      <PECDestinatario>${xmlEscape(invoice.clientPec)}</PECDestinatario>` : ''}
    </DatiTrasmissione>
    <CedentePrestatore>
      <DatiAnagrafici>
        <IdFiscaleIVA>
          <IdPaese>${cedenteCountry}</IdPaese>
          <IdCodice>${cedentePivaClean}</IdCodice>
        </IdFiscaleIVA>
        <CodiceFiscale>${companyInfo.taxCode || cedentePivaClean}</CodiceFiscale>
        <Anagrafica>
          <Denominazione>${xmlEscape(companyInfo.companyName || 'AZIENDA CEDENTE')}</Denominazione>
        </Anagrafica>
        <RegimeFiscale>${companyInfo.fiscalRegime || 'RF01'}</RegimeFiscale>
      </DatiAnagrafici>
      <Sede>
        <Indirizzo>${xmlEscape(companyInfo.address || 'Via Roma 1')}</Indirizzo>
        <CAP>${companyInfo.cap || '00100'}</CAP>
        <Comune>${xmlEscape(companyInfo.city || 'Roma')}</Comune>
        <Provincia>${xmlEscape(companyInfo.province || 'RM')}</Provincia>
        <Nazione>${cedenteCountry}</Nazione>
      </Sede>
    </CedentePrestatore>
    <CessionarioCommittente>
      <DatiAnagrafici>${invoice.clientVatNumber ? `
        <IdFiscaleIVA>
          <IdPaese>${invoice.clientCountry || 'IT'}</IdPaese>
          <IdCodice>${invoice.clientVatNumber.replace(/[^a-zA-Z0-9]/g, '')}</IdCodice>
        </IdFiscaleIVA>` : ''}${invoice.clientTaxCode ? `
        <CodiceFiscale>${invoice.clientTaxCode.trim().toUpperCase()}</CodiceFiscale>` : ''}
        <Anagrafica>
          <Denominazione>${xmlEscape(invoice.clientName)}</Denominazione>
        </Anagrafica>
      </DatiAnagrafici>
      <Sede>
        <Indirizzo>${xmlEscape(invoice.clientAddress || 'Indirizzo Non Specificato')}</Indirizzo>
        <CAP>${invoice.clientCap || '00000'}</CAP>
        <Comune>${xmlEscape(invoice.clientCity || 'Comune')}</Comune>
        <Provincia>${xmlEscape(invoice.clientProvince || 'RM')}</Provincia>
        <Nazione>${invoice.clientCountry || 'IT'}</Nazione>
      </Sede>
    </CessionarioCommittente>
  </FatturaElettronicaHeader>
  <FatturaElettronicaBody>
    <DatiGenerali>
      <DatiGeneraliDocumento>
        <TipoDocumento>${invoice.type}</TipoDocumento>
        <Divisa>EUR</Divisa>
        <Data>${invoice.date}</Data>
        <Numero>${xmlEscape(invoice.invoiceNumber)}</Numero>${ritenutaXml}${cassaXml}
        <ImportoTotaleDocumento>${(Number(invoice.totalGross) || 0).toFixed(2)}</ImportoTotaleDocumento>
      </DatiGeneraliDocumento>
${ddtXml}${collegataXml}    </DatiGenerali>
    <DatiBeniServizi>
${lineeXml}
${riepilogoXml}
    </DatiBeniServizi>
    <DatiPagamento>
      <CondizioniPagamento>${invoice.paymentStatus === 'pagata_saldata' ? 'TP02' : 'TP01'}</CondizioniPagamento>
      <DettaglioPagamento>
        <ModalitaPagamento>${paymentCode}</ModalitaPagamento>
        <DataScadenzaPagamento>${invoice.dueDate}</DataScadenzaPagamento>
        <ImportoPagamento>${(Number(invoice.netToPay) || 0).toFixed(2)}</ImportoPagamento>${invoice.iban ? `\n        <IBAN>${invoice.iban.replace(/\s+/g, '')}</IBAN>` : ''}
      </DettaglioPagamento>
    </DatiPagamento>
  </FatturaElettronicaBody>
</p:FatturaElettronica>`;
  }

  /**
   * Converte un XML FatturaPA in un oggetto InvoiceItem
   */
  async parseXml(xmlContent: string): Promise<Partial<InvoiceItem>> {
    const tipoDoc = (xmlExtractTag(xmlContent, 'TipoDocumento') || 'TD01') as InvoiceType;
    const dataDoc = xmlExtractTag(xmlContent, 'Data') || new Date().toISOString().split('T')[0];
    const numDoc = xmlExtractTag(xmlContent, 'Numero') || 'DOC-1';
    const importoTot = parseFloat(xmlExtractTag(xmlContent, 'ImportoTotaleDocumento') || '0');

    // Dati Cessionario (Cliente)
    const committenteBlock = xmlExtractTag(xmlContent, 'CessionarioCommittente');
    const clientName = xmlExtractTag(committenteBlock, 'Denominazione') || 
      `${xmlExtractTag(committenteBlock, 'Nome')} ${xmlExtractTag(committenteBlock, 'Cognome')}`.trim() || 'Cliente Sconosciuto';
    const clientPiva = xmlExtractTag(committenteBlock, 'IdCodice');
    const clientCf = xmlExtractTag(committenteBlock, 'CodiceFiscale');
    const clientAddress = xmlExtractTag(committenteBlock, 'Indirizzo');
    const clientCap = xmlExtractTag(committenteBlock, 'CAP');
    const clientCity = xmlExtractTag(committenteBlock, 'Comune');
    const clientProv = xmlExtractTag(committenteBlock, 'Provincia');

    // Linee
    const lineeBlocks = xmlExtractAllBlocks(xmlContent, 'DettaglioLinee');
    const lines: InvoiceLine[] = lineeBlocks.map((b, i) => {
      const desc = xmlExtractTag(b, 'Descrizione') || `Riga ${i + 1}`;
      const qty = parseFloat(xmlExtractTag(b, 'Quantita') || '1') || 1;
      const unitPrice = parseFloat(xmlExtractTag(b, 'PrezzoUnitario') || '0');
      const netAmount = parseFloat(xmlExtractTag(b, 'PrezzoTotale') || '0');
      const vatRate = parseFloat(xmlExtractTag(b, 'AliquotaIVA') || '22');
      const natureCode = xmlExtractTag(b, 'Natura') || undefined;
      const vatAmount = roundCurrency(netAmount * (vatRate / 100));

      return {
        id: `line_${i + 1}`,
        description: desc,
        quantity: qty,
        unitPrice,
        netAmount,
        vatRate,
        natureCode,
        vatAmount,
        grossAmount: roundCurrency(netAmount + vatAmount)
      };
    });

    // Castelletto
    const riepilogoBlocks = xmlExtractAllBlocks(xmlContent, 'DatiRiepilogo');
    const castelletto: CastellettoItem[] = riepilogoBlocks.map(r => ({
      rate: parseFloat(xmlExtractTag(r, 'AliquotaIVA') || '0'),
      natureCode: xmlExtractTag(r, 'Natura') || undefined,
      taxableAmount: parseFloat(xmlExtractTag(r, 'ImponibileImporto') || '0'),
      vatAmount: parseFloat(xmlExtractTag(r, 'Imposta') || '0'),
      normativeRef: xmlExtractTag(r, 'RiferimentoNormativo') || undefined
    }));

    const totalNet = roundCurrency(lines.reduce((s, l) => s + l.netAmount, 0));
    const totalVat = roundCurrency(castelletto.reduce((s, c) => s + c.vatAmount, 0));
    const totalGross = importoTot > 0 ? importoTot : roundCurrency(totalNet + totalVat);

    return {
      type: tipoDoc,
      date: dataDoc,
      invoiceNumber: numDoc,
      number: parseInt(numDoc.replace(/\D/g, '') || '1', 10),
      year: new Date(dataDoc).getFullYear(),
      sezionaleId: 'default',
      sezionaleCode: '',
      status: 'emessa',
      paymentStatus: 'non_pagata',
      clientName,
      clientVatNumber: clientPiva,
      clientTaxCode: clientCf,
      clientAddress,
      clientCap,
      clientCity,
      clientProvince: clientProv,
      lines,
      castelletto,
      totalNet,
      totalVat,
      totalGross,
      netToPay: totalGross,
      paidAmount: 0,
      remainingAmount: totalGross,
      originType: 'manual'
    };
  }

  async transmitInvoice(invoice: InvoiceItem): Promise<TransmissionResult> {
    return {
      success: true,
      transmissionId: `LOCAL_XML_${Date.now()}`,
      sdiIdentifier: `SDI_${Date.now().toString(36).toUpperCase()}`
    };
  }

  async pollSyncUpdates(): Promise<SyncUpdate[]> {
    return [];
  }

  async importBatch(files: Array<{ name: string; content: string }>): Promise<ImportSummary> {
    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const f of files) {
      try {
        const parsed = await this.parseXml(f.content);
        if (parsed && parsed.invoiceNumber) {
          imported++;
        } else {
          skipped++;
        }
      } catch (err: any) {
        errors.push(`Errore nel file ${f.name}: ${err.message}`);
      }
    }

    return { importedCount: imported, skippedCount: skipped, errors };
  }
}
