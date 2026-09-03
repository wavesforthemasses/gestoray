import { describe, it, expect } from 'vitest';
import { XmlFatturaPaBridge } from './bridges/XmlFatturaPaBridge';
import type { InvoiceItem } from './schema';

describe('FatturaPA XML Bridge Tests (AdE 1.2.2 Spec)', () => {
  const bridge = new XmlFatturaPaBridge();

  const mockInvoice: InvoiceItem = {
    invoiceNumber: '142/2026',
    number: 142,
    year: 2026,
    sezionaleId: 'default',
    sezionaleCode: '',
    type: 'TD01',
    status: 'emessa',
    date: '2026-09-03',
    dueDate: '2026-10-03',
    clientId: 'cli_1',
    clientName: 'Acme Costruzioni SpA',
    clientVatNumber: 'IT01234567890',
    clientTaxCode: '01234567890',
    clientSdiCode: 'SUBM70N',
    clientPec: 'acme@pec.it',
    clientAddress: 'Via Garibaldi 10',
    clientCap: '20100',
    clientCity: 'Milano',
    clientProvince: 'MI',
    clientCountry: 'IT',
    lines: [
      {
        id: 'l1',
        description: 'Fornitura calcestruzzo RCK 30',
        quantity: 10,
        unitPrice: 85.00,
        vatRate: 22,
        netAmount: 850.00,
        vatAmount: 187.00,
        grossAmount: 1037.00
      }
    ],
    castelletto: [
      {
        rate: 22,
        taxableAmount: 850.00,
        vatAmount: 187.00
      }
    ],
    totalNet: 850.00,
    totalVat: 187.00,
    totalGross: 1037.00,
    netToPay: 1037.00,
    paymentStatus: 'non_pagata',
    paidAmount: 0,
    remainingAmount: 1037.00,
    paymentMethod: 'bonifico',
    iban: 'IT60X0542811101000000123456'
  };

  it('generates a valid FatturaPA 1.2.2 XML with all mandatory tags', async () => {
    const xml = await bridge.generateXml(mockInvoice, {
      companyName: 'Edilizia Generale Srl',
      vatNumber: 'IT98765432109',
      taxCode: '98765432109',
      address: 'Corso Italia 45',
      cap: '00100',
      city: 'Roma',
      province: 'RM',
      fiscalRegime: 'RF01'
    });

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<p:FatturaElettronica');
    expect(xml).toContain('<TipoDocumento>TD01</TipoDocumento>');
    expect(xml).toContain('<Numero>142/2026</Numero>');
    expect(xml).toContain('<CodiceDestinatario>SUBM70N</CodiceDestinatario>');
    expect(xml).toContain('<PECDestinatario>acme@pec.it</PECDestinatario>');
    expect(xml).toContain('<Denominazione>Acme Costruzioni SpA</Denominazione>');
    expect(xml).toContain('<Descrizione>Fornitura calcestruzzo RCK 30</Descrizione>');
    expect(xml).toContain('<ImponibileImporto>850.00</ImponibileImporto>');
    expect(xml).toContain('<Imposta>187.00</Imposta>');
    expect(xml).toContain('<ImportoTotaleDocumento>1037.00</ImportoTotaleDocumento>');
    expect(xml).toContain('<IBAN>IT60X0542811101000000123456</IBAN>');
  });

  it('parses generated XML back into structured InvoiceItem (roundtrip fidelity)', async () => {
    const xml = await bridge.generateXml(mockInvoice, {
      companyName: 'Edilizia Generale Srl',
      vatNumber: 'IT98765432109'
    });

    const parsed = await bridge.parseXml(xml);
    expect(parsed.invoiceNumber).toBe('142/2026');
    expect(parsed.type).toBe('TD01');
    expect(parsed.clientName).toBe('Acme Costruzioni SpA');
    expect(parsed.totalGross).toBe(1037.00);
    expect(parsed.totalNet).toBe(850.00);
    expect(parsed.lines?.length).toBe(1);
    expect(parsed.lines?.[0].description).toBe('Fornitura calcestruzzo RCK 30');
    expect(parsed.castelletto?.length).toBe(1);
  });
});
