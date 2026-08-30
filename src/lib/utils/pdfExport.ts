import { UnitsOfMeasureService } from '$lib/services/unitsOfMeasureService';
import { toast } from '$lib/stores/toast.svelte';

export interface PrintableDocumentData {
  title: string;
  companyName?: string;
  documentNumber: string;
  date: string;
  clientName: string;
  clientAddress?: string;
  locationName?: string;
  items: { description: string; quantity: number; unit?: string; unitPrice?: number; total?: number }[];
  totalAmount?: number;
  signedByName?: string;
  signedAt?: string;
  signatureData?: string;
  notes?: string;
}

export class PdfExportService {
  static exportDocumentToPdf(data: PrintableDocumentData) {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Consentire i popup del browser per stampare o scaricare il PDF.');
      return;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="it">
      <head>
        <meta charset="UTF-8">
        <title>${data.title} - ${data.documentNumber}</title>
        <style>
          body { font-family: 'Helvetica Neue', Arial, sans-serif; padding: 40px; color: #1e293b; max-width: 800px; margin: 0 auto; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #3b82f6; padding-bottom: 20px; margin-bottom: 30px; }
          .logo { font-size: 28px; font-weight: 800; color: #3b82f6; letter-spacing: -1px; }
          .doc-info { text-align: right; }
          .doc-title { font-size: 20px; font-weight: 700; color: #0f172a; margin: 0 0 6px 0; }
          .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; background: #f8fafc; padding: 16px; border-radius: 8px; font-size: 14px; }
          .meta-item label { font-weight: 600; color: #64748b; display: block; font-size: 12px; }
          .table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
          .table th { background: #f1f5f9; padding: 10px 14px; font-size: 12px; text-transform: uppercase; color: #475569; text-align: left; }
          .table td { padding: 12px 14px; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
          .total-box { text-align: right; font-size: 18px; font-weight: 700; color: #0f172a; margin-top: 20px; }
          .signature-box { margin-top: 40px; border-top: 1px dashed #cbd5e1; padding-top: 20px; display: flex; justify-content: space-between; align-items: flex-end; }
          .signature-img { max-height: 80px; border-bottom: 1px solid #94a3b8; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo">${data.companyName || 'ERP'}</div>
          <div class="doc-info">
            <h1 class="doc-title">${data.title}</h1>
            <div>Codice: <strong>${data.documentNumber}</strong></div>
            <div>Data: <strong>${data.date}</strong></div>
          </div>
        </div>

        <div class="meta-grid">
          <div class="meta-item">
            <label>CLIENTE</label>
            <strong>${data.clientName}</strong>
            ${data.clientAddress ? `<div>${data.clientAddress}</div>` : ''}
          </div>
          <div class="meta-item">
            <label>LUOGO INTERVENTO</label>
            <strong>${data.locationName || 'Sede Principale'}</strong>
          </div>
        </div>

        <table class="table">
          <thead>
            <tr>
              <th>Descrizione Prestazione / Materiale</th>
              <th>Quantità</th>
              <th>Prezzo Unitario</th>
              <th style="text-align: right;">Totale €</th>
            </tr>
          </thead>
          <tbody>
            ${data.items.map(item => `
              <tr>
                <td>${item.description}</td>
                <td>${UnitsOfMeasureService.formatQuantity(item.quantity, item.unit || 'pz')} ${item.unit || ''}</td>
                <td>${item.unitPrice ? '€ ' + (Number(item.unitPrice) || 0).toFixed(2) : '-'}</td>
                <td style="text-align: right;">${item.total ? '€ ' + (Number(item.total) || 0).toFixed(2) : '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        ${data.totalAmount ? `<div class="total-box">Totale Complessivo: € ${(Number(data.totalAmount) || 0).toFixed(2)}</div>` : ''}

        ${data.signatureData ? `
          <div class="signature-box">
            <div>
              <div style="font-size: 12px; color: #64748b;">Firma per Accettazione:</div>
              <strong>${data.signedByName || 'Cliente'}</strong>
              <div style="font-size: 11px; color: #94a3b8;">Fermato il: ${data.signedAt || data.date}</div>
            </div>
            <img src="${data.signatureData}" class="signature-img" alt="Firma Digitale" />
          </div>
        ` : ''}

        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  }
}
