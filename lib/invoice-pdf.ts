import path from 'path';
import fs from 'fs';

export function getPdfDir(): string {
  const env = process.env.INVOICE_PDF_DIR;
  if (env?.trim()) return env;
  return path.join(process.cwd(), 'invoices-pdf');
}

/** Удаляет файл PDF счёта с диска, если он существует. Не бросает при отсутствии файла. */
export function deleteInvoicePdfFile(invoiceId: string): void {
  const dir = getPdfDir();
  const filePath = path.join(dir, `${invoiceId}.pdf`);
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (e) {
    console.error('deleteInvoicePdfFile', invoiceId, e);
  }
}
